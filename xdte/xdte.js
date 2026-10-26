function deployedCapacityChart(rows) {
  const node = document.querySelector("#deployed-capacity-chart");
  if (!node) return;
  if (!rows.length) {node.textContent="No deployed-capacity history available.";return;}
  const width=1050,height=310,pad={l:85,r:25,t:25,b:65};
  const maximum=Math.max(1,...rows.flatMap(r=>[r.deployed,r.reserved_today,r.exited_today]));
  const step=(width-pad.l-pad.r)/rows.length;
  const x=i=>pad.l+step*(i+.5), y=v=>height-pad.b-v/maximum*(height-pad.t-pad.b);
  const ticks=Array.from({length:5},(_,i)=>maximum*i/4);
  let marks=ticks.map(v=>`<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/><text x="${pad.l-8}" y="${y(v)+4}" text-anchor="end" font-size="12">${money.format(v)}</text>`).join("");
  const labelEvery=Math.max(1,Math.ceil(rows.length/12));
  rows.forEach((r,i)=>{
    const tooltip=`${r.date}: starting deployed ${money.format(r.opening_deployed)}; reserved ${money.format(r.reserved_today)}; exited ${money.format(r.exited_today)}; cancelled/unfilled releases ${money.format(r.cancelled_today)}; ending/current deployed ${money.format(r.deployed)}${r.status!=="COMPLETE"?" (incomplete history)":""}`;
    [[r.reserved_today,-.27,"#f76915"],[r.exited_today,.02,"#2fa236"]].forEach(([v,offset,color])=>{
      marks+=`<rect x="${x(i)+step*offset}" y="${y(v)}" width="${step*.25}" height="${Math.max(0,y(0)-y(v))}" fill="${color}" opacity=".65"><title>${tooltip}</title></rect>`;
    });
    if(i%labelEvery===0||i===rows.length-1) marks+=`<text transform="translate(${x(i)},${height-pad.b+18}) rotate(-30)" text-anchor="end" font-size="12">${r.date}</text>`;
  });
  marks+=`<path d="${rows.map((r,i)=>`${i?'L':'M'}${x(i)},${y(r.deployed)}`).join(' ')}" fill="none" stroke="#333ed4" stroke-width="3"/>`;
  rows.forEach((r,i)=>{marks+=`<circle cx="${x(i)}" cy="${y(r.deployed)}" r="4" fill="#333ed4"><title>${r.date}: starting ${money.format(r.opening_deployed)}; ending/current deployed ${money.format(r.deployed)}; reserved ${money.format(r.reserved_today)}; exited ${money.format(r.exited_today)}; cancelled/unfilled ${money.format(r.cancelled_today)}</title></circle>`;});
  node.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily deployed reserve capital, new reservations and exited capacity">${marks}</svg><div class="chart-legend"><span class="legend-key" style="--key:#333ed4">Deployed reserves</span><span class="legend-key" style="--key:#f76915">New reservations</span><span class="legend-key" style="--key:#2fa236">Exited capacity</span></div>`;
  if(rows.some(r=>r.status!=="COMPLETE"))node.insertAdjacentHTML("beforeend","<p>Warning: capacity history is incomplete.</p>");
}

function reserveCapacityChart(flow) {
  const node = document.querySelector("#capacity-flow-chart");
  if (!node) return;
  const rows = flow?.rows || [];
  if (!rows.length) { node.textContent = "Capacity history unavailable."; return; }
  const width=900, height=260, left=85, right=25, top=32, bottom=60;
  const max=Math.max(1, ...rows.flatMap(r=>[r.start,r.end]));
  const min=Math.min(0, ...rows.flatMap(r=>[r.start,r.end]));
  const y=v=>top+(max-v)/(max-min)*(height-top-bottom);
  const step=(width-left-right)/rows.length;
  const colors={total:"#333ed4",reserved:"#f76915",released:"#2fa236"};
  let marks="";
  for(let i=0;i<=4;i++) { const v=min+(max-min)*i/4; marks+=`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end" font-size="12">${money.format(v)}</text>`; }
  rows.forEach((r,i)=>{ const x=left+i*step+step*.17, w=step*.66;
    marks+=`<rect x="${x}" y="${Math.min(y(r.start),y(r.end))}" width="${w}" height="${Math.max(1,Math.abs(y(r.start)-y(r.end)))}" fill="${colors[r.kind]}"><title>${r.label}: ${money.format(r.amount)}; available after step ${money.format(r.end)}</title></rect><text x="${x+w/2}" y="${Math.min(y(r.start),y(r.end))-9}" text-anchor="middle" font-size="12">${money.format(r.amount)}</text><text x="${x+w/2}" y="${height-bottom+22}" text-anchor="middle" font-size="12">${r.label}</text>`;
  });
  node.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Available aggregate reserve capacity: starting capacity, new reservations, exits and current availability">${marks}</svg>`;
  document.querySelector("#capacity-flow-note").textContent=`Aggregate limit ${money.format(flow.aggregate_limit)}; carried-in reserves ${money.format(flow.opening_reserved)}. New reservations consume capacity; exits and cancellations release it. The separate daily new-entry budget is not recycled.${flow.status !== "COMPLETE" ? " Warning: saved capacity history is incomplete." : ""}`;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

const value = (v, formatter = number) => v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : formatter.format(Number(v));
const pnlClass = v => Number(v) > 0 ? "positive" : Number(v) < 0 ? "negative" : "";
const slippageClass = v => Number(v) < 0 ? "positive" : Number(v) > 0 ? "negative" : "";
const positionZoneBadge = zone => {
  const values = {
    INSIDE_SHORTS: ["position-zone--green", "Inside short strikes"],
    BETWEEN_SHORT_AND_LONG_PROFITABLE: ["position-zone--yellow", "Between strikes · profitable"],
    BETWEEN_SHORT_AND_LONG: ["position-zone--orange", "Between short and long"],
    OUTSIDE_LONGS: ["position-zone--red", "Outside long strikes"],
  };
  const [className, label] = values[zone] || ["position-zone--unavailable", "Unavailable"];
  return `<span class="position-zone ${className}">${label}</span>`;
};
const positionMap = (zone, row = {}) => {
  if (!zone || zone === "UNAVAILABLE") return '<span class="position-map--unavailable">—</span>';
  const strategy = String(row.strategy || "");
  const isPut = strategy === "BULL_PUT_CREDIT_SPREAD";
  const isCall = strategy === "BEAR_CALL_CREDIT_SPREAD";
  const direction = String(row.spx_position_direction || "CENTER");
  const markerColor = {
    INSIDE_SHORTS: "#2fa236",
    BETWEEN_SHORT_AND_LONG_PROFITABLE: "#eede04",
    BETWEEN_SHORT_AND_LONG: "#f76915",
    OUTSIDE_LONGS: "#fd0100",
  }[zone] || "#7a8491";
  const markerX = isPut
    ? ({ INSIDE_SHORTS: 72, BETWEEN_SHORT_AND_LONG_PROFITABLE: 32, BETWEEN_SHORT_AND_LONG: 32, OUTSIDE_LONGS: 8 }[zone] || 50)
    : isCall
      ? ({ INSIDE_SHORTS: 28, BETWEEN_SHORT_AND_LONG_PROFITABLE: 68, BETWEEN_SHORT_AND_LONG: 68, OUTSIDE_LONGS: 92 }[zone] || 50)
      : zone === "INSIDE_SHORTS"
        ? 50
        : zone === "OUTSIDE_LONGS"
          ? (direction === "LOWER" ? 8 : 92)
          : (direction === "LOWER" ? 24 : 76);
  let zones;
  let boundaries;
  const ticks = [4, 15.5, 27, 38.5, 50, 61.5, 73, 84.5, 96]
    .map(x => `<line x1="${x}" x2="${x}" y1="-5" y2="5" class="distance-tick"/>`)
    .join("");
  if (isPut) {
    zones = '<line x1="4" x2="20" class="risk-red"/><line x1="20" x2="42" class="risk-orange"/><line x1="42" x2="96" class="risk-green"/>';
    boundaries = '<line x1="20" x2="20" y1="-9" y2="9" class="long-boundary"/><text x="20" y="17" class="boundary-label">LP</text><line x1="42" x2="42" y1="-9" y2="9" class="short-boundary"/><text x="42" y="17" class="boundary-label">SP</text>';
  } else if (isCall) {
    zones = '<line x1="4" x2="58" class="risk-green"/><line x1="58" x2="80" class="risk-orange"/><line x1="80" x2="96" class="risk-red"/>';
    boundaries = '<line x1="58" x2="58" y1="-9" y2="9" class="short-boundary"/><text x="58" y="17" class="boundary-label">SC</text><line x1="80" x2="80" y1="-9" y2="9" class="long-boundary"/><text x="80" y="17" class="boundary-label">LC</text>';
  } else {
    zones = '<line x1="4" x2="14" class="risk-red"/><line x1="14" x2="34" class="risk-orange"/><line x1="34" x2="66" class="risk-green"/><line x1="66" x2="86" class="risk-orange"/><line x1="86" x2="96" class="risk-red"/>';
    boundaries = '<line x1="14" x2="14" y1="-9" y2="9" class="long-boundary"/><text x="14" y="17" class="boundary-label">LP</text><line x1="34" x2="34" y1="-9" y2="9" class="short-boundary"/><text x="34" y="17" class="boundary-label">SP</text><line x1="66" x2="66" y1="-9" y2="9" class="short-boundary"/><text x="66" y="17" class="boundary-label">SC</text><line x1="86" x2="86" y1="-9" y2="9" class="long-boundary"/><text x="86" y="17" class="boundary-label">LC</text>';
  }
  return `<svg class="position-map" viewBox="0 0 100 44" role="img" aria-label="Normalized SPX risk-zone map; ${positionZoneBadge(zone).replace(/<[^>]+>/g, "")}">
    <g transform="translate(0 15)"><line x1="4" x2="96" class="axis-baseline"/>${zones}${ticks}${boundaries}<circle cx="${markerX}" cy="0" r="3.5" fill="${markerColor}" stroke="#111827" stroke-width="1.5"/></g>
    <text x="4" y="41" class="axis-end-label">Lower SPX</text><text x="96" y="41" text-anchor="end" class="axis-end-label">Higher SPX</text>
  </svg>`;
};
const shortTime = v => v ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(v)) : "—";
const shortDate = v => v ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${v}T00:00:00Z`)) : "—";
const liveFeedUrl = "https://storage.googleapis.com/ibkr-steamroller-coins-xdte-feed/latest.json";
const refreshCooldownMilliseconds = 5 * 60 * 1000;
const autoRefreshIntervalMilliseconds = 5 * 60 * 1000;
let refreshAvailableAt = 0;
let lastSuccessfulRefreshAt = 0;
let refreshInFlight = false;

function metrics(target, items) {
  document.querySelector(target).innerHTML = items.map(([label, display, className = ""]) =>
    `<div class="metric"><span class="metric__label">${label}</span><span class="metric__value ${className}">${display}</span></div>`
  ).join("");
}

function summaryMetrics(target, items) {
  document.querySelector(target).innerHTML = items.map(([label, display, className = ""]) =>
    `<div class="summary-metric"><span class="summary-metric__label">${label}</span><span class="summary-metric__value ${className}">${display}</span></div>`
  ).join("");
}

function table(target, columns, rows, options = {}) {
  const node = document.querySelector(target);
  const isCompactEmpty = !rows.length && options.compactEmpty;
  node.classList.toggle("table-wrap--compact-empty", Boolean(isCompactEmpty));
  if (!rows.length) {
    node.innerHTML = `<div class="chart-empty">${options.emptyMessage || "No qualifying records are available."}</div>`;
    return;
  }
  node.innerHTML = `<table><thead><tr>${columns.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map(row =>
    `<tr>${columns.map(c => `<td class="${c[2] ? c[2](row[c[1]]) : ""}">${c[3] ? c[3](row[c[1]], row) : (row[c[1]] ?? "—")}</td>`).join("")}</tr>`
  ).join("")}</tbody></table>`;
}

function renderUnsuccessfulEntries(rows) {
  table("#unsuccessful-entry-attempts", [
    ["Time (ET)", "time_et", null, shortTime],
    ["Strategy", "strategy", null, v => String(v || "Unspecified").replaceAll("_", " ")],
    ["DTE at evaluation", "dte"],
    ["Failure stage", "stage", null, v => String(v || "Unknown").replaceAll("_", " ")],
    ["Broker submission", "submission", null, v => ({CONFIRMED_SUBMITTED: "Submitted", CONFIRMED_NOT_SUBMITTED: "Not submitted", UNKNOWN: "Unconfirmed"}[v] || "Unconfirmed")],
    ["Broker status", "broker_status"], ["Filled qty", "filled_quantity"],
    ["Requested credit (points)", "limit_credit", null, v => v == null ? "—" : Number(v).toFixed(2)],
    ["Capacity required", "capacity_required", null, v => value(v, money)],
    ["Capacity available", "capacity_available", null, v => value(v, money)],
    ["Capacity shortfall", "capacity_shortfall", null, v => value(v, money)],
    ["Explanation", "details"],
  ], rows || [], { compactEmpty: true, emptyMessage: "No unsuccessful entry attempts recorded for this session." });
}

function lineChart(target, series, options = {}) {
  const node = document.querySelector(target);
  const chartPoints = s => s.rows.map(r => ({ t: new Date(r[s.x]).getTime(), y: Number(r[s.y]) })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.y));
  const leftSeries = series.filter(s => s.axis !== "right");
  const rightSeries = series.filter(s => s.axis === "right");
  const leftPoints = leftSeries.flatMap(chartPoints);
  const rightPoints = rightSeries.flatMap(chartPoints);
  const all = [...leftPoints, ...rightPoints];
  if (!all.length) { node.innerHTML = `<div class="chart-empty">No chart data are available for this period.</div>`; return; }
  const width = 1000, height = options.height || 310, pad = { l: 76, r: rightPoints.length ? 76 : 24, t: 18, b: 42 };
  const minT = Math.min(...all.map(p => p.t)), maxT = Math.max(...all.map(p => p.t));
  const observedMinY = leftPoints.length ? Math.min(...leftPoints.map(p => p.y)) : 0;
  const observedMaxY = leftPoints.length ? Math.max(...leftPoints.map(p => p.y)) : 0;
  const minY0 = options.includeZero ? Math.min(observedMinY, 0) : observedMinY;
  const maxY0 = options.includeZero ? Math.max(observedMaxY, 0) : observedMaxY;
  const steppedBounds = (minimum, maximum, step, includeZero = false) => {
    let low = includeZero ? Math.min(minimum, 0) : minimum;
    let high = includeZero ? Math.max(maximum, 0) : maximum;
    low = Math.floor(low / step) * step;
    high = Math.ceil(high / step) * step;
    if (low === high) { low -= step; high += step; }
    return [low, high];
  };
  const leftBounds = options.leftTickStep
    ? steppedBounds(minY0, maxY0, options.leftTickStep, options.includeZero)
    : (() => { const range = Math.max(maxY0 - minY0, 1); return [minY0 - range * .08, maxY0 + range * .08]; })();
  const minY = leftBounds[0], maxY = leftBounds[1];
  const rightObservedMin = rightPoints.length ? Math.min(...rightPoints.map(p => p.y)) : 0;
  const rightObservedMax = rightPoints.length ? Math.max(...rightPoints.map(p => p.y)) : 0;
  const rightBounds = rightPoints.length
    ? (options.rightTickStep
      ? steppedBounds(rightObservedMin, rightObservedMax, options.rightTickStep)
      : (() => { const range = Math.max(rightObservedMax - rightObservedMin, 1); return [rightObservedMin - range * .08, rightObservedMax + range * .08]; })())
    : [0, 1];
  const x = t => pad.l + (t - minT) / Math.max(maxT - minT, 1) * (width - pad.l - pad.r);
  const y = v => pad.t + (maxY - v) / Math.max(maxY - minY, 1) * (height - pad.t - pad.b);
  const rightY = v => pad.t + (rightBounds[1] - v) / Math.max(rightBounds[1] - rightBounds[0], 1) * (height - pad.t - pad.b);
  const axisTicks = (minimum, maximum, step) => step
    ? Array.from({ length: Math.round((maximum - minimum) / step) + 1 }, (_, i) => minimum + i * step)
    : Array.from({ length: 5 }, (_, i) => minimum + (maximum - minimum) * i / 4);
  const ticks = axisTicks(minY, maxY, options.leftTickStep);
  const rightTicks = rightPoints.length ? axisTicks(rightBounds[0], rightBounds[1], options.rightTickStep) : [];
  const relativeAreas = series.map(s => {
    if (!s.shadeRelativeToFirst) return "";
    const points = chartPoints(s);
    if (points.length < 2) return "";
    const seriesY = s.axis === "right" ? rightY : y;
    const baseline = points[0].y;
    const baselineY = seriesY(baseline);
    const polygon = (left, right, color) => `<path d="M${x(left.t).toFixed(1)},${seriesY(left.y).toFixed(1)} L${x(right.t).toFixed(1)},${seriesY(right.y).toFixed(1)} L${x(right.t).toFixed(1)},${baselineY.toFixed(1)} L${x(left.t).toFixed(1)},${baselineY.toFixed(1)} Z" fill="${color}" fill-opacity="0.16" stroke="none"/>`;
    const regions = [];
    for (let i = 1; i < points.length; i += 1) {
      const left = points[i - 1], right = points[i];
      const leftDifference = left.y - baseline, rightDifference = right.y - baseline;
      if (leftDifference * rightDifference < 0) {
        const crossingFraction = -leftDifference / (rightDifference - leftDifference);
        const crossing = { t: left.t + (right.t - left.t) * crossingFraction, y: baseline };
        regions.push(polygon(left, crossing, leftDifference > 0 ? s.aboveColor : s.belowColor));
        regions.push(polygon(crossing, right, rightDifference > 0 ? s.aboveColor : s.belowColor));
      } else {
        const midpointDifference = (leftDifference + rightDifference) / 2;
        if (midpointDifference !== 0) regions.push(polygon(left, right, midpointDifference > 0 ? s.aboveColor : s.belowColor));
      }
    }
    return `<g aria-label="${s.label} area relative to opening level">${regions.join("")}<line x1="${pad.l}" x2="${width-pad.r}" y1="${baselineY.toFixed(1)}" y2="${baselineY.toFixed(1)}" stroke="${s.color}" stroke-width="1" stroke-dasharray="4 4" opacity="0.8"><title>${s.label} opening level ${number.format(baseline)}</title></line></g>`;
  }).join("");
  const paths = series.map(s => {
    const points = chartPoints(s), seriesY = s.axis === "right" ? rightY : y;
    return `<path d="${points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${seriesY(p.y).toFixed(1)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.5}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""} vector-effect="non-scaling-stroke"/>`;
  }).join("");
  const markers = (options.markers || []).map(marker => {
    const t = new Date(marker.time_et).getTime(), v = Number(marker.net_pnl);
    if (!Number.isFinite(t) || !Number.isFinite(v)) return "";
    const cx = x(t), cy = y(v), color = marker.event === "Exit" ? "#c62828" : "#2e7d32";
    if (marker.event === "Exit") {
      return `<rect x="${(cx-5).toFixed(1)}" y="${(cy-5).toFixed(1)}" width="10" height="10" rx="1" fill="${color}" stroke="white" stroke-width="1.5"><title>${marker.position} Exit · ${money.format(v)}</title></rect>`;
    }
    return `<path d="M${cx.toFixed(1)},${(cy-6).toFixed(1)} L${(cx-6).toFixed(1)},${(cy+5).toFixed(1)} L${(cx+6).toFixed(1)},${(cy+5).toFixed(1)} Z" fill="${color}" stroke="white" stroke-width="1.5"><title>${marker.position} Entry · ${money.format(v)}</title></path>`;
  }).join("");
  const zero = minY <= 0 && maxY >= 0 ? `<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="#7b8495" stroke-width="1.75"/>` : "";
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.label || "Time series"}">
    ${ticks.map(v => `<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e4dfd6"/><text x="${pad.l-10}" y="${y(v)+4}" text-anchor="end" fill="#667085" font-size="12">${options.money ? money.format(v) : number.format(v)}</text>`).join("")}
    ${rightTicks.map(v => `<line x1="${width-pad.r}" x2="${width-pad.r+5}" y1="${rightY(v)}" y2="${rightY(v)}" stroke="#667085"/><text x="${width-pad.r+10}" y="${rightY(v)+4}" fill="#667085" font-size="12">${number.format(v)}</text>`).join("")}
    ${relativeAreas}${zero}${paths}${markers}
    <text x="${pad.l}" y="${height-12}" fill="#667085" font-size="12">${shortTime(minT)}</text>
    <text x="${width-pad.r}" y="${height-12}" text-anchor="end" fill="#667085" font-size="12">${shortTime(maxT)}</text>
  </svg><div class="chart-legend">${series.filter((s,i,a)=>a.findIndex(t=>(t.legendLabel||t.label)===(s.legendLabel||s.label))===i).map(s => `<span class="legend-key${s.dash ? " legend-key--dashed" : ""}" style="--key:${s.color}">${s.legendLabel || s.label}</span>`).join("")}</div>`;
}

function portfolioDailyChart(target, rows, expectedHistory = []) {
  // Refuse old marked-to-market snapshots; only matched settled-trade totals.
  rows = (rows || []).filter(row => row.basis === "SETTLED_TRADES_ONLY");
  const node = document.querySelector(target);
  const finite = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  if (!(rows || []).length) {
    node.innerHTML = '<div class="chart-empty">No portfolio session history is available.</div>';
    return;
  }
  const width = 1000, height = 365, pad = {l: 96, r: 100, t: 30, b: 66};
  const plotWidth = width-pad.l-pad.r, plotHeight = height-pad.t-pad.b;
  const x = i => pad.l+(i+.5)*plotWidth/rows.length;
  const bounds = values => {
    const maximum = Math.max(1, ...values.filter(finite).map(v => Math.abs(Number(v))));
    const rawStep = maximum/3, power = 10**Math.floor(Math.log10(rawStep));
    const ratio = rawStep/power;
    const step = (ratio<=1 ? 1 : ratio<=2 ? 2 : ratio<=5 ? 5 : 10)*power;
    return {maximum: Math.ceil(maximum/step)*step, step};
  };
  const left = bounds(rows.map(r=>r.realized_net_pnl)), right = bounds(rows.flatMap(r=>[r.net_pnl,r.expected_net_pnl]));
  const scale = (v,b) => pad.t+(b.maximum-Number(v))/(2*b.maximum)*plotHeight;
  const y = v=>scale(v,left), ry = v=>scale(v,right);
  const ticks = b => Array.from({length:2*Math.round(b.maximum/b.step)+1},(_,i)=>-b.maximum+i*b.step);
  const grid = ticks(left).map(v=>`<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e4dfd6"/><text x="${pad.l-10}" y="${y(v)+4}" text-anchor="end" fill="#667085" font-size="12">${money.format(v)}</text>`).join("");
  const rightTicks = ticks(right).map(v=>`<text x="${width-pad.r+10}" y="${ry(v)+4}" fill="#333ed4" font-size="12">${money.format(v)}</text>`).join("");
  const barWidth = Math.min(60,plotWidth/rows.length*.65);
  const bars = rows.map((r,i)=> {
    if (!finite(r.realized_net_pnl)) return "";
    const amount = Number(r.realized_net_pnl), top = Math.min(y(0),y(amount));
    const color = amount>0 ? "#2fa236" : amount<0 ? "#dc2626" : "#8b939f";
    return `<rect data-session="${r.date}" data-realized="${amount}" x="${x(i)-barWidth/2}" y="${top}" width="${barWidth}" height="${Math.max(1,Math.abs(y(amount)-y(0)))}" fill="${color}" fill-opacity="0.65"><title>${r.date}: realized net P&amp;L ${money.format(amount)} · ${r.closed_trades || 0} closed trade(s)</title></rect>`;
  }).join("");
  let drawing = false;
  const path = rows.map((r,i)=>{
    if (!finite(r.net_pnl)) { drawing=false;return ""; }
    const move = drawing ? "L" : "M"; drawing=true;
    return `${move}${x(i).toFixed(2)},${ry(r.net_pnl).toFixed(2)}`;
  }).join(" ");
  const dots = rows.map((r,i)=>finite(r.net_pnl) ? `<circle cx="${x(i)}" cy="${ry(r.net_pnl)}" r="3.5" fill="#333ed4"><title>${r.date}: cumulative settled net P&amp;L ${money.format(r.net_pnl)}</title></circle>` : "").join("");
  let expectedDrawing = false;
  const expectedPath = rows.map((r,i)=>{
    if (!finite(r.expected_net_pnl)) { expectedDrawing=false;return ""; }
    const move = expectedDrawing ? "L" : "M"; expectedDrawing=true;
    return `${move}${x(i).toFixed(2)},${ry(r.expected_net_pnl).toFixed(2)}`;
  }).join(" ");
  const expectedDots = rows.map((r,i)=>finite(r.expected_net_pnl) ? `<circle cx="${x(i)}" cy="${ry(r.expected_net_pnl)}" r="3" fill="#7c3aed"><title>${r.date}: cumulative saved expected net P&amp;L for settled trades ${money.format(r.expected_net_pnl)}</title></circle>` : "").join("");
  const dateFormat = new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
  const interval = Math.max(1,Math.ceil(rows.length/8));
  const labels = rows.map((r,i)=>(i%interval===0 || i===rows.length-1) ? `<text x="${x(i)}" y="${height-39}" text-anchor="middle" fill="#667085" font-size="12">${dateFormat.format(new Date(r.date+"T12:00:00Z"))}</text>` : "").join("");
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily realized P&amp;L bars, cumulative settled net P&amp;L and cumulative expected P&amp;L by trading session">
    ${grid}${rightTicks}
    <line data-zero-axis="left" x1="${pad.l}" x2="${width-pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="#7b8495" stroke-width="1.75"/>
    ${bars}<path d="${path}" stroke="#333ed4" stroke-width="3" fill="none" vector-effect="non-scaling-stroke"/>${dots}<path data-series="expected" d="${expectedPath}" stroke="#7c3aed" stroke-dasharray="6 4" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/>${expectedDots}${labels}
    <text transform="translate(17,${pad.t+plotHeight/2}) rotate(-90)" text-anchor="middle" fill="#667085" font-size="12">Daily realized P&amp;L ($) · left</text>
    <text transform="translate(${width-12},${pad.t+plotHeight/2}) rotate(90)" text-anchor="middle" fill="#333ed4" font-size="12">Total / expected P&amp;L ($) · right</text>
    <text x="${width/2}" y="${height-10}" text-anchor="middle" fill="#667085" font-size="12">Trading sessions (ET; non-market days omitted)</text>
  </svg><div class="chart-legend"><span class="legend-key" style="--key:#2fa236">Positive realized P&amp;L · left</span><span class="legend-key" style="--key:#dc2626">Negative realized P&amp;L · left</span><span class="legend-key" style="--key:#333ed4">Cumulative settled net P&amp;L · right</span><span class="legend-key" style="--key:#7c3aed">Expected P&amp;L (dashed) · settled trades · right</span></div>`;
}

function positionOutcomeChart(target, rows) {
  const node = document.querySelector(target);
  const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const positions = (rows || []).filter(row => row.entry_time_et && [
    row.allocation, row.maximum_profit, row.base_expected_net_pnl,
    row.unrealized_net_pnl, row.realized_net_pnl,
    row.maximum_unrealized_pnl, row.minimum_unrealized_pnl,
  ].some(finite));
  if (!positions.length) {
    node.innerHTML = '<div class="chart-empty">No filled-position outcome data are available.</div>';
    return;
  }
  const values = positions.flatMap(row => [
    finite(row.allocation) ? -Number(row.allocation) : null,
    row.maximum_profit, row.base_expected_net_pnl, row.unrealized_net_pnl,
    row.realized_net_pnl, row.maximum_unrealized_pnl, row.minimum_unrealized_pnl,
  ].filter(finite).map(Number));
  const rawMin = Math.min(0, ...values), rawMax = Math.max(0, ...values);
  const magnitude = Math.max(Math.abs(rawMin), Math.abs(rawMax), 1);
  const tickStep = magnitude > 5000 ? 1000 : magnitude > 2000 ? 500 : magnitude > 750 ? 250 : magnitude > 300 ? 100 : 50;
  let minValue = Math.floor(rawMin / tickStep) * tickStep;
  let maxValue = Math.ceil(rawMax / tickStep) * tickStep;
  if (minValue === maxValue) { minValue -= tickStep; maxValue += tickStep; }
  const width = 1000, rowHeight = 52, height = 64 + positions.length * rowHeight;
  const pad = { l: 118, r: 26, t: 24, b: 40 };
  const x = value => pad.l + (Number(value) - minValue) / (maxValue - minValue) * (width - pad.l - pad.r);
  const y = index => pad.t + index * rowHeight + rowHeight / 2;
  const ticks = Array.from(
    { length: Math.round((maxValue - minValue) / tickStep) + 1 },
    (_, index) => minValue + index * tickStep,
  );
  const title = (row, label, value) => `${row.position} · ${row.strategy || "Strategy unavailable"} · ${label}: ${money.format(Number(value))}`;
  const rowMarks = positions.map((row, index) => {
    const cy = y(index);
    const allocation = finite(row.allocation) ? -Number(row.allocation) : null;
    const maximum = finite(row.maximum_profit) ? Number(row.maximum_profit) : null;
    const observedMin = finite(row.minimum_unrealized_pnl) ? Number(row.minimum_unrealized_pnl) : null;
    const observedMax = finite(row.maximum_unrealized_pnl) ? Number(row.maximum_unrealized_pnl) : null;
    const envelope = allocation !== null && maximum !== null
      ? `<line x1="${x(allocation)}" x2="${x(maximum)}" y1="${cy}" y2="${cy}" class="outcome-envelope"><title>${row.position} risk/reward range: ${money.format(allocation)} to ${money.format(maximum)}</title></line>
         <line x1="${x(allocation)}" x2="${x(allocation)}" y1="${cy-9}" y2="${cy+9}" class="outcome-allocation"><title>${title(row, "Negative allocation", allocation)}</title></line>
         <line x1="${x(maximum)}" x2="${x(maximum)}" y1="${cy-9}" y2="${cy+9}" class="outcome-maximum"><title>${title(row, "Maximum profit", maximum)}</title></line>`
      : "";
    const observed = observedMin !== null && observedMax !== null
      ? `<line x1="${x(observedMin)}" x2="${x(observedMax)}" y1="${cy}" y2="${cy}" class="outcome-observed"><title>${row.position} observed P&amp;L: ${money.format(observedMin)} to ${money.format(observedMax)}</title></line>
         <circle cx="${x(observedMin)}" cy="${cy}" r="3" class="outcome-observed-point"><title>${title(row, "Minimum unrealized", observedMin)}</title></circle>
         <circle cx="${x(observedMax)}" cy="${cy}" r="3" class="outcome-observed-point"><title>${title(row, "Maximum unrealized", observedMax)}</title></circle>`
      : "";
    const base = finite(row.base_expected_net_pnl) ? Number(row.base_expected_net_pnl) : null;
    const unrealized = finite(row.unrealized_net_pnl) ? Number(row.unrealized_net_pnl) : null;
    const status = String(row.status || "").toUpperCase();
    const isClosed = Boolean(row.exit_time_et) || ["CLOSED", "SETTLED", "EXPIRED"].includes(status);
    const realized = isClosed && finite(row.realized_net_pnl) ? Number(row.realized_net_pnl) : null;
    const baseMark = base === null ? "" : `<path d="M${x(base)},${cy-6} L${x(base)+6},${cy} L${x(base)},${cy+6} L${x(base)-6},${cy} Z" class="outcome-base"><title>${title(row, "Base expected", base)}</title></path>`;
    const unrealizedMark = unrealized === null ? "" : `<circle cx="${x(unrealized)}" cy="${cy}" r="5" class="outcome-unrealized"><title>${title(row, "Unrealized", unrealized)}</title></circle>`;
    const realizedMark = realized === null ? "" : `<rect x="${x(realized)-5}" y="${cy-5}" width="10" height="10" rx="1" class="outcome-realized"><title>${title(row, "Realized", realized)}</title></rect>`;
    return `<text x="${pad.l-12}" y="${cy+4}" text-anchor="end" class="outcome-row-label">${row.position}</text>${envelope}${observed}${baseMark}${unrealizedMark}${realizedMark}`;
  }).join("");
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Position risk, expected value, and observed profit and loss map">
    ${ticks.map(value => `<line x1="${x(value)}" x2="${x(value)}" y1="${pad.t-8}" y2="${height-pad.b}" class="outcome-grid${value === 0 ? " outcome-zero" : ""}"/><text x="${x(value)}" y="${height-14}" text-anchor="middle" class="outcome-axis-label">${money.format(value)}</text>`).join("")}
    ${rowMarks}
  </svg><div class="chart-legend outcome-legend">
    <span class="legend-key" style="--key:#d0d5dd">Allocation to maximum profit</span>
    <span class="legend-key" style="--key:#333ed4">Observed min/max</span>
    <span class="legend-symbol legend-symbol--base">Base expected</span>
    <span class="legend-symbol legend-symbol--unrealized">Unrealized</span>
    <span class="legend-symbol legend-symbol--realized">Realized</span>
  </div>`;
}

const escapeText = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

function funnelHeatmap(target, rows) {
  const node = document.querySelector(target);
  if (!rows.length) {
    node.innerHTML = '<div class="chart-empty">No funnel observations are available for this period.</div>';
    return;
  }
  const stages = ["Candidates examined", "Terminal positive", "Terminal-payoff survivors", "Path confirmed", "Eligible", "Entry orders submitted", "Entries filled", "Open positions"];
  const labels = [...new Set(rows.map(row => {
    const strategy = String(row.strategy || "UNATTRIBUTED").replaceAll("_", " ");
    const dte = /^\d+$/.test(String(row.dte)) ? `${row.dte}DTE` : "Unattributed";
    return `${strategy} · ${dte}`;
  }))].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  const lookup = new Map(rows.map(row => {
    const strategy = String(row.strategy || "UNATTRIBUTED").replaceAll("_", " ");
    const dte = /^\d+$/.test(String(row.dte)) ? `${row.dte}DTE` : "Unattributed";
    return [[row.stage, `${strategy} · ${dte}`].join("||"), Number(row.count) || 0];
  }));
  const width = 1200, cellWidth = 122, cellHeight = 34;
  const pad = { l: 248, r: 18, t: 104, b: 26 };
  const height = pad.t + labels.length * cellHeight + pad.b;
  const maximum = Math.max(1, ...rows.map(row => Number(row.count) || 0));
  const cells = labels.flatMap((label, rowIndex) => stages.map((stage, columnIndex) => {
    const count = lookup.get([stage, label].join("||")) || 0;
    const intensity = count ? .14 + .86 * Math.log1p(count) / Math.log1p(maximum) : 0;
    const x = pad.l + columnIndex * cellWidth, y = pad.t + rowIndex * cellHeight;
    return `<rect x="${x}" y="${y}" width="${cellWidth-3}" height="${cellHeight-3}" rx="3" fill="#333ed4" fill-opacity="${intensity.toFixed(3)}"><title>${escapeText(stage)} · ${escapeText(label)}: ${number.format(count)}</title></rect>${count ? `<text x="${x+(cellWidth-3)/2}" y="${y+21}" text-anchor="middle" fill="${intensity > .56 ? "white" : "#172033"}" font-size="11" font-weight="700">${number.format(count)}</text>` : ""}`;
  })).join("");
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Candidate funnel counts by strategy and DTE">
    ${stages.map((stage, index) => `<text transform="translate(${pad.l + index*cellWidth + 16},${pad.t-12}) rotate(-38)" font-size="12" font-weight="700" fill="#667085">${escapeText(stage)}</text>`).join("")}
    ${labels.map((label, index) => `<text x="${pad.l-10}" y="${pad.t+index*cellHeight+21}" text-anchor="end" font-size="11" font-weight="700" fill="#667085">${escapeText(label)}</text>`).join("")}
    ${cells}
  </svg>`;
}

function rejectionBarChart(target, rows) {
  const node = document.querySelector(target);
  if (!rows.length) {
    node.innerHTML = '<div class="chart-empty">No recorded rejection reasons are available for this period.</div>';
    return;
  }
  const aggregated = new Map();
  rows.forEach(row => {
    const key = `${row.reason}||${row.category}`;
    aggregated.set(key, (aggregated.get(key) || 0) + (Number(row.count) || 0));
  });
  const reasonTotals = new Map();
  aggregated.forEach((count, key) => {
    const reason = key.split("||")[0];
    reasonTotals.set(reason, (reasonTotals.get(reason) || 0) + count);
  });
  const reasons = [...reasonTotals].sort((a, b) => b[1] - a[1]).slice(0, 20).map(item => item[0]);
  const categories = ["Scanner decision", "Path confirmation"];
  const colors = { "Scanner decision": "#333ed4", "Path confirmation": "#f76915" };
  const maximum = Math.max(1, ...reasons.map(reason => reasonTotals.get(reason) || 0));
  const width = 1000, rowHeight = 34, height = 38 + reasons.length * rowHeight;
  const pad = { l: 350, r: 58, t: 16, b: 22 };
  const plotWidth = width - pad.l - pad.r;
  const marks = reasons.map((reason, index) => {
    let cursor = pad.l;
    const bars = categories.map(category => {
      const count = aggregated.get(`${reason}||${category}`) || 0;
      const segmentWidth = count / maximum * plotWidth;
      const mark = count ? `<rect x="${cursor}" y="${pad.t+index*rowHeight}" width="${segmentWidth}" height="22" rx="2" fill="${colors[category]}"><title>${escapeText(reason)} · ${category}: ${number.format(count)}</title></rect>` : "";
      cursor += segmentWidth;
      return mark;
    }).join("");
    const total = reasonTotals.get(reason) || 0;
    return `<text x="${pad.l-10}" y="${pad.t+index*rowHeight+16}" text-anchor="end" font-size="11" fill="#667085">${escapeText(reason)}</text>${bars}<text x="${cursor+7}" y="${pad.t+index*rowHeight+16}" font-size="11" font-weight="700" fill="#172033">${number.format(total)}</text>`;
  }).join("");
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Recorded rejection reasons">${marks}</svg><div class="chart-legend"><span class="legend-key" style="--key:${colors["Scanner decision"]}">Scanner decision</span><span class="legend-key" style="--key:${colors["Path confirmation"]}">Path confirmation</span></div>`;
}

let selectedFunnelPeriod = "day";
function renderFunnelHistory(history) {
  const selected = history?.[selectedFunnelPeriod] || { funnel: [], rejections: [] };
  funnelHeatmap("#funnel-history-chart", selected.funnel || []);
  rejectionBarChart("#rejection-history-chart", selected.rejections || []);
  const hasUnattributed = (selected.funnel || []).some(row => row.detail_status === "HISTORICAL_DETAIL_UNAVAILABLE");
  document.querySelector("#funnel-history-note").textContent = hasUnattributed
    ? "Unattributed cells preserve totals from older aggregate-only scans. New scans persist exact strategy/DTE detail at every funnel stage."
    : "All displayed funnel observations include strategy and DTE attribution.";
  document.querySelectorAll("[data-funnel-period]").forEach(button => {
    const active = button.dataset.funnelPeriod === selectedFunnelPeriod;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.onclick = () => {
      selectedFunnelPeriod = button.dataset.funnelPeriod;
      renderFunnelHistory(history);
    };
  });
}

async function fetchSnapshot(url, source) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${source} ${response.status}`);
  return { data: await response.json(), source };
}

function selectNewestSnapshot(candidates) {
  return [...candidates].sort((left, right) => {
    const leftTime = Date.parse(left.data?.publication?.published_at_et || "") || 0;
    const rightTime = Date.parse(right.data?.publication?.published_at_et || "") || 0;
    if (leftTime !== rightTime) return rightTime - leftTime;
    const leftFinal = left.data?.publication?.status === "FINAL_AFTER_CLOSE" ? 1 : 0;
    const rightFinal = right.data?.publication?.status === "FINAL_AFTER_CLOSE" ? 1 : 0;
    return rightFinal - leftFinal;
  })[0];
}

async function retrieveSnapshot() {
  const version = Date.now();
  const results = await Promise.allSettled([
    fetchSnapshot(`${liveFeedUrl}?v=${version}`, "Live five-minute feed"),
    fetchSnapshot(`data/latest.json?v=${version}`, "After-close snapshot"),
  ]);
  const candidates = results.filter(result => result.status === "fulfilled").map(result => result.value);
  if (!candidates.length) {
    const errors = results.map(result => result.reason?.message || "unknown error").join("; ");
    throw new Error(`Snapshot requests failed (${errors})`);
  }
  return selectNewestSnapshot(candidates);
}

function updateRefreshButton() {
  const button = document.querySelector("#refresh-feed");
  const remaining = Math.max(0, refreshAvailableAt - Date.now());
  button.disabled = refreshInFlight || remaining > 0;
  button.textContent = refreshInFlight ? "Refreshing…" : remaining > 0 ? `Refresh in ${Math.ceil(remaining / 60000)}m` : "Refresh P&L";
}

async function load() {
  const retrieved = await retrieveSnapshot();
  const data = retrieved.data;
  const pub = data.publication, daily = data.daily, ledger = data.ledger, funnel = daily.funnel, summary = ledger.summary;
  const pnlSummary = daily.pnl_summary || {};
  const exitActivity = daily.exit_activity || {};
  const badge = document.querySelector("#status-badge");
  const marketDataStatus = pub.market_data_status || (pub.status === "PRELIMINARY_SESSION_ACTIVE" ? "MARKET_OPEN" : "MARKET_CLOSED");
  badge.textContent = marketDataStatus.replaceAll("_", " ");
  badge.classList.remove("badge--final", "badge--preliminary");
  badge.classList.add(marketDataStatus === "MARKET_CLOSED" ? "badge--final" : "badge--preliminary");
  const readiness = daily.system_readiness || { status: "PENDING" };
  const readinessBadge = document.querySelector("#readiness-badge");
  const readinessDetail = document.querySelector("#readiness-detail");
  readinessBadge.classList.remove("badge--ready", "badge--failed", "badge--pending");
  if (readiness.status === "READY") {
    readinessBadge.textContent = "SYSTEM READY";
    readinessBadge.classList.add("badge--ready");
    readinessDetail.textContent = `Premarket readiness check passed · ${value(readiness.passed_checks)}/${value(readiness.total_checks)} checks · ${shortTime(readiness.checked_at_et)} ET`;
  } else if (readiness.status === "NOT_READY") {
    readinessBadge.textContent = "READINESS FAILED";
    readinessBadge.classList.add("badge--failed");
    readinessDetail.textContent = `Premarket readiness check failed · ${value(readiness.failed_checks)} of ${value(readiness.total_checks)} checks failed · ${shortTime(readiness.checked_at_et)} ET`;
  } else {
    readinessBadge.textContent = "CHECK PENDING";
    readinessBadge.classList.add("badge--pending");
    readinessDetail.textContent = "Today’s premarket readiness result is not yet available.";
  }
  document.querySelector("#as-of").textContent = `Trading date ${pub.trade_date} · published ${shortTime(pub.published_at_et)} ET`;
  document.querySelector("#footer-date").textContent = `Snapshot ${pub.trade_date}`;
  document.querySelector("#feed-status").textContent = `Source: ${retrieved.source} · refreshes automatically every five minutes`;
  const warning = document.querySelector("#data-warning");
  if (marketDataStatus === "MARKET_CLOSED") {
    warning.classList.remove("hidden");
    warning.textContent = `Market Closed — retaining Daily P&L for ${pub.trade_date} until the next regular trading session opens. Values are not live market data.`;
  } else if (pub.status !== "FINAL_AFTER_CLOSE") {
    warning.classList.remove("hidden");
    warning.textContent = "This snapshot was generated during the trading session and remains preliminary. The scheduled after-close publication will replace it.";
  } else {
    warning.classList.add("hidden");
    warning.textContent = "";
  }
  const tradingStatus = daily.trading_status_and_alerts || {};
  const statusSummary = document.querySelector("#trading-status-summary");
  statusSummary.innerHTML = `<span class="alert-label">${tradingStatus.session_status?.replaceAll("_", " ") || "STATUS UNAVAILABLE"}</span><p>${tradingStatus.session_message || "Trading status is unavailable in this snapshot."}</p>`;
  const coverage = document.querySelector("#calendar-coverage");
  const coverageWindow = tradingStatus.calendar_as_of_date && tradingStatus.calendar_window_end_date
    ? `${tradingStatus.calendar_as_of_date} through ${tradingStatus.calendar_window_end_date}` : "unavailable";
  coverage.textContent = tradingStatus.calendar_coverage_complete
    ? `Economic calendar window: ${coverageWindow}. Reviewed ${tradingStatus.calendar_reviewed_on || "—"}; freshness valid through ${tradingStatus.calendar_fresh_until || tradingStatus.calendar_valid_through || "—"}; event coverage through ${tradingStatus.calendar_coverage_end || "—"}.`
    : `Economic calendar coverage is incomplete for the seven-day window (${coverageWindow}).`;
  table("#calendar-alerts", [
    ["Date (ET)", "date"], ["Flag", "flag"], ["Event", "event"],
  ], tradingStatus.calendar_flags || []);
  const activeAlerts = (tradingStatus.alerts || []).filter(row => row.state === "ACTIVE");
  const criticalAlerts = activeAlerts.filter(row => String(row.severity || "").toUpperCase() === "CRITICAL");
  const criticalBanner = document.querySelector("#critical-alert-banner");
  const criticalText = document.querySelector("#critical-alert-text");
  if (criticalAlerts.length) {
    const alertTitles = criticalAlerts.map(row => row.title || "Critical trading condition");
    const countLabel = `${criticalAlerts.length} active critical alert${criticalAlerts.length === 1 ? "" : "s"}`;
    criticalText.textContent = `${countLabel}: ${alertTitles.join("; ")}. View details.`;
    criticalBanner.classList.remove("hidden");
  } else {
    criticalText.textContent = "";
    criticalBanner.classList.add("hidden");
  }
  const recoveredAlerts = (tradingStatus.alerts || []).filter(row => row.state === "RESOLVED" && row.severity !== "INFO");
  const informationalAlerts = (tradingStatus.alerts || []).filter(row => row.state === "RESOLVED" && row.severity === "INFO");
  const alertColumns = [
    ["Severity", "severity"], ["Category", "category"], ["Alert", "title"],
    ["Details", "details"], ["First observed (ET)", "first_seen_at_et", null, shortTime],
    ["Last affected (ET)", "last_seen_at_et", null, shortTime],
  ];
  table("#active-alerts", alertColumns, activeAlerts, { compactEmpty: true, emptyMessage: "None" });
  table("#recovered-alerts", alertColumns, recoveredAlerts, { compactEmpty: true, emptyMessage: "None" });
  table("#informational-alerts", alertColumns, informationalAlerts, { compactEmpty: true, emptyMessage: "None" });
  renderUnsuccessfulEntries(data.daily.unsuccessful_entry_attempts || []);
  summaryMetrics("#pnl-metrics", [
    ["Daily synchronized P&L", value(pnlSummary.daily_synchronized_pnl, money), pnlClass(pnlSummary.daily_synchronized_pnl)],
    ["Daily P&L (ledger change)", value(pnlSummary.daily_ledger_pnl, money), pnlClass(pnlSummary.daily_ledger_pnl)],
    ["Unrealized P&L", value(pnlSummary.unrealized_pnl, money), pnlClass(pnlSummary.unrealized_pnl)],
    ["Realized P&L on exits", value(exitActivity.realized_pnl, money), pnlClass(exitActivity.realized_pnl)],
  ]);
  const baselineNote = document.querySelector("#ledger-baseline-note");
  if (baselineNote) baselineNote.textContent = pnlSummary.ledger_baseline_status === "ACTUAL_PRIOR_SESSION_LEDGER_CLOSE_UNAVAILABLE"
    ? "Ledger change unavailable: no actual prior-session closing ledger-equity snapshot was saved. Open-position marks include saved liquidation expenses."
    : "Ledger change uses actual saved closing equity. Open-position marks include saved liquidation expenses; realized exits use recorded net P&L.";
  summaryMetrics("#evaluation-metrics", [
    ["Candidates examined", value(funnel.candidates_examined)], ["Terminal positive", value(funnel.terminal_positive_candidates)],
    ["Terminal-payoff survivors", value(funnel.quadrature_survivors)], ["Path confirmed", value(funnel.path_confirmed_candidates)],
    ["Eligible", value(funnel.eligible_candidates)], ["Entry orders submitted", value(funnel.orders_submitted)],
    ["Entries filled", value(funnel.trades_filled)], ["Open positions", value(funnel.trades_open)],
    ["Entry fill slippage", value(daily.entry_activity?.entry_slippage, money), slippageClass(daily.entry_activity?.entry_slippage)],
  ]);
  const entrySlippageNote = document.querySelector("#entry-slippage-note");
  if (entrySlippageNote) entrySlippageNote.textContent = `Entry fill slippage: requested credit minus filled credit, in dollars. Positive is worse; negative is price improvement. Measured for ${daily.entry_activity?.measured_trades ?? 0} of ${daily.entry_activity?.filled_trades ?? 0} filled trades today.`;
  renderFunnelHistory(daily.funnel_history || {});
  summaryMetrics("#exit-metrics", [
    ["Exits filled today", value(exitActivity.exits_filled)],
    ["Net fill slippage", value(exitActivity.net_fill_slippage, money), slippageClass(exitActivity.net_fill_slippage)],
    ["Transaction costs on exits", value(exitActivity.transaction_costs, money)],
    ["Capital released by exits", value(exitActivity.released_capital, money)],
  ]);
  deployedCapacityChart(ledger.deployed_capacity_history || []);
  metrics("#capacity-metrics", [
    ["Capacity reserved today", value(ledger.capacity.capacity_reserved_today, money)],
    ["Reserved risk", value(summary.reserved_risk, money)],
    ["Total capacity available", value(ledger.capacity.aggregate_available_capacity, money)],
    ["Available new-entry capacity now", value(ledger.capacity.daily_new_capacity_available ?? ledger.capacity.available_capacity, money)],
    ["Effective capacity unlocked", value(ledger.capacity.timed_capacity_released, money)],
    ["Carried from prior window (25%)", value(ledger.capacity.timed_capacity_carried_forward, money)],
    ["Unused capacity forfeited today", value(ledger.capacity.timed_capacity_forfeited, money)],
    ["Long-dated (4+ DTE) capacity available", value(ledger.capacity.long_dated_available_capacity ?? ledger.capacity.seven_dte_available_capacity, money)],
  ]);
  const positionSeries = [...(daily.position_pnl || [])].sort((a,b) => {
    const dateKey = item => /^\d{4}-\d{2}-\d{2}$/.test(item.exit_date_group || "") ? item.exit_date_group : "9999-99-99";
    return dateKey(a).localeCompare(dateKey(b));
  }).map(item => ({
    rows: item.points, x: "time_et", y: "net_pnl", label: `${item.position} · expiry ${item.exit_date_group || "unknown"}`,
    legendLabel: `Expiry ${item.exit_date_group || "unknown"}`,
    color: item.exit_date_color || "#8b939f", width: 2,
  }));
  const positionMarkers = (daily.position_pnl || []).flatMap(item => item.points
    .filter(point => point.event === "Entry" || point.event === "Exit")
    .map(point => ({ ...point, position: item.position })));
  lineChart("#daily-chart", [
    ...positionSeries,
    { rows: daily.portfolio_pnl, x: "time_et", y: "net_pnl", label: "TOTAL", color: "rgba(55,65,81,0.5)", width: 4 },
    {
      rows: daily.spx_history || [], x: "time_et", y: "spx", label: "SPX",
      color: "#aeb4bd", width: 2.5, dash: "7 5", axis: "right", shadeRelativeToFirst: true,
      aboveColor: "#2fa236", belowColor: "#fd0100",
    },
  ], {
    money: true, height: 465, includeZero: true, leftTickStep: 250, rightTickStep: 25,
    label: "Daily position and portfolio P&L with SPX", markers: positionMarkers,
  });
  table("#trade-table", [
    ["Position", "position"], ["Record type", "record_type"], ["Strategy", "strategy"], ["Entry DTE", "dte"],
    ["Status", "status"],
    ["Current SPX location", "spx_position_zone", null, positionZoneBadge],
    ["Position map", "spx_position_zone", null, positionMap],
    ["Entry (ET)", "entry_time_et", null, shortTime],
    ["Expiry", "expiration_date", null, shortDate],
    ["Exit (ET)", "exit_time_et", null, shortTime],
    ["Allocation", "allocation", null, v => value(v, money)], ["Maximum profit", "maximum_profit", pnlClass, v => value(v, money)], ["Base expected", "base_expected_net_pnl", pnlClass, v => value(v, money)],
    ["Unrealized", "unrealized_net_pnl", pnlClass, v => value(v, money)], ["Realized", "realized_net_pnl", pnlClass, v => value(v, money)],
    ["Max unrealized", "maximum_unrealized_pnl", pnlClass, v => value(v, money)], ["Min unrealized", "minimum_unrealized_pnl", pnlClass, v => value(v, money)],
    ["Exit reason", "exit_reason"],
  ], daily.trades);
  positionOutcomeChart("#position-outcome-chart", daily.trades);
  const averages = ledger.trade_averages || {};
  metrics("#ledger-metrics", [
    ["Starting cash", value(summary.starting_cash, money)], ["Equity", value(summary.equity, money)],
    ["Realized P&L", value(summary.realized_pnl, money), pnlClass(summary.realized_pnl)], ["Unrealized P&L", value(summary.unrealized_pnl, money), pnlClass(summary.unrealized_pnl)],
    ["Reserved risk", value(summary.reserved_risk, money)], ["Available capacity", value(ledger.capacity.available_capacity, money)],
    ["Open positions", value(summary.open_positions)], ["Closed trades", value(summary.closed_trades)],
    ["Average P&L / trade", value(averages.average_net_pnl, money), pnlClass(averages.average_net_pnl)],
    ["Average capacity / trade", value(averages.average_capacity, money)],
    ["Average return / trade", value(averages.average_return, percent), pnlClass(averages.average_return)],
    ["Average duration / trade", averages.average_duration_hours == null ? "—" : `${number.format(averages.average_duration_hours)} hours`],
  ]);
  portfolioDailyChart("#portfolio-chart", ledger.portfolio_daily || []);
  const settledHistory = (ledger.portfolio_daily || []).filter(row => row.basis === "SETTLED_TRADES_ONLY");
  const settledCoverage = settledHistory.at(-1);
  document.querySelector("#expected-entry-coverage").textContent = settledCoverage
    ? `Saved entry-time expectations available for ${settledCoverage.modeled_settled_trades_to_date} of ${settledCoverage.settled_trades_to_date} settled trades. Both cumulative lines recognize trades on settlement dates; open positions are excluded. Missing estimates create a gap rather than a partial total.`
    : "No settled-trade history is available.";
  table("#calibration-table", [
    ["Frequency", "frequency"], ["Period", "period"], ["Trades", "closed_trades"],
    ["Risk deployed", "gross_risk_deployed", null, v => value(v, money)], ["Expected", "base_expected_net_pnl", pnlClass, v => value(v, money)],
    ["Realized", "realized_net_pnl", pnlClass, v => value(v, money)], ["Difference", "forecast_error", pnlClass, v => value(v, money)],
    ["Expected return", "expected_return_on_allocation", null, v => value(v, percent)], ["Realized return", "realized_return_on_allocation", null, v => value(v, percent)],
    ["Error SD", "normalized_error_standard_deviation", null, v => value(v, percent)],
  ], ledger.calibration_periods);
  document.querySelector("#trade-average-coverage").textContent = `Settled trades only (${averages.settled_trades || 0}). Duration includes nights and weekends. Duration observations: ${averages.duration_samples || 0}; missing inputs make that average unavailable.`;
  const perf = ledger.performance;
  metrics("#performance-metrics", [
    ["Settled trades", value(perf.settled_trades)], ["Trading days", value(perf.trading_days)], ["Net return on deployed capital", value(perf.net_return_on_deployed_capital, percent), pnlClass(perf.net_return_on_deployed_capital)],
    ["Expectancy / trade", value(perf.expectancy_return_per_trade, percent), pnlClass(perf.expectancy_return_per_trade)], ["Win rate", value(perf.trade_win_rate, percent)], ["Maximum day drawdown", value(perf.maximum_daily_drawdown, money)],
  ]);
  const groups = [...perf.by_strategy.map(r => ({ dimension: "Strategy", group: r.strategy, ...r })), ...perf.by_dte.map(r => ({ dimension: "DTE", group: r.dte, ...r }))];
  table("#performance-table", [
    ["Dimension", "dimension"], ["Group", "group"], ["Trades", "trades"], ["Win rate", "win_rate", null, v => value(v, percent)],
    ["Net return", "net_return_on_deployed_capital", pnlClass, v => value(v, percent)], ["Expectancy / trade", "expectancy_return_per_trade", pnlClass, v => value(v, percent)],
  ], groups);
}

async function refresh({ manual = false } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  updateRefreshButton();
  try {
    await load();
    lastSuccessfulRefreshAt = Date.now();
  } catch (error) {
    showLoadError(error, lastSuccessfulRefreshAt > 0);
  } finally {
    if (manual) refreshAvailableAt = Date.now() + refreshCooldownMilliseconds;
    refreshInFlight = false;
    updateRefreshButton();
  }
}

document.querySelector("#refresh-feed").addEventListener("click", () => {
  if (Date.now() >= refreshAvailableAt) refresh({ manual: true });
});
setInterval(updateRefreshButton, 1000);
setInterval(() => {
  if (!document.hidden) refresh();
}, autoRefreshIntervalMilliseconds);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && Date.now() - lastSuccessfulRefreshAt >= autoRefreshIntervalMilliseconds) refresh();
});

function showLoadError(error, preserveCurrent = false) {
  const warning = document.querySelector("#data-warning"); warning.classList.remove("hidden");
  warning.textContent = preserveCurrent
    ? `Automatic refresh failed; the last successfully loaded snapshot remains displayed: ${error.message}`
    : `The public snapshot could not be loaded: ${error.message}`;
  if (!preserveCurrent) {
    document.querySelector("#status-badge").textContent = "DATA UNAVAILABLE";
    document.querySelector("#readiness-badge").textContent = "READINESS UNKNOWN";
    document.querySelector("#readiness-badge").className = "badge badge--pending";
  }
}

refresh({ manual: true });
