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
      : ({ INSIDE_SHORTS: 50, BETWEEN_SHORT_AND_LONG_PROFITABLE: 76, BETWEEN_SHORT_AND_LONG: 76, OUTSIDE_LONGS: 96 }[zone] || 50);
  let zones;
  let boundaries;
  if (isPut) {
    zones = '<line x1="4" x2="20" class="risk-red"/><line x1="20" x2="42" class="risk-orange"/><line x1="42" x2="96" class="risk-green"/>';
    boundaries = '<line x1="20" x2="20" y1="-8" y2="8" class="long-boundary"/><line x1="42" x2="42" y1="-8" y2="8" class="short-boundary"/>';
  } else if (isCall) {
    zones = '<line x1="4" x2="58" class="risk-green"/><line x1="58" x2="80" class="risk-orange"/><line x1="80" x2="96" class="risk-red"/>';
    boundaries = '<line x1="58" x2="58" y1="-8" y2="8" class="short-boundary"/><line x1="80" x2="80" y1="-8" y2="8" class="long-boundary"/>';
  } else {
    zones = '<line x1="4" x2="14" class="risk-red"/><line x1="14" x2="34" class="risk-orange"/><line x1="34" x2="66" class="risk-green"/><line x1="66" x2="86" class="risk-orange"/><line x1="86" x2="96" class="risk-red"/>';
    boundaries = '<line x1="14" x2="14" y1="-8" y2="8" class="long-boundary"/><line x1="34" x2="34" y1="-8" y2="8" class="short-boundary"/><line x1="66" x2="66" y1="-8" y2="8" class="short-boundary"/><line x1="86" x2="86" y1="-8" y2="8" class="long-boundary"/>';
  }
  return `<svg class="position-map" viewBox="0 0 100 32" role="img" aria-label="Normalized SPX risk-zone map; ${positionZoneBadge(zone).replace(/<[^>]+>/g, "")}">
    <g transform="translate(0 16)">${zones}${boundaries}<circle cx="${markerX}" cy="0" r="3.5" fill="${markerColor}" stroke="#111827" stroke-width="1.5"/></g>
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

function lineChart(target, series, options = {}) {
  const node = document.querySelector(target);
  const chartPoints = s => s.rows.map(r => ({ t: new Date(r[s.x]).getTime(), y: Number(r[s.y]) })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.y));
  const leftSeries = series.filter(s => s.axis !== "right");
  const rightSeries = series.filter(s => s.axis === "right");
  const leftPoints = leftSeries.flatMap(chartPoints);
  const rightPoints = rightSeries.flatMap(chartPoints);
  const all = [...leftPoints, ...rightPoints];
  if (!all.length) { node.innerHTML = `<div class="chart-empty">No chart data are available for this period.</div>`; return; }
  const width = 1000, height = 310, pad = { l: 76, r: rightPoints.length ? 76 : 24, t: 18, b: 42 };
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
    return `<path d="${points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${seriesY(p.y).toFixed(1)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.5}" vector-effect="non-scaling-stroke"/>`;
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
  </svg><div class="chart-legend">${series.map(s => `<span class="legend-key" style="--key:${s.color}">${s.label}</span>`).join("")}</div>`;
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
  badge.textContent = pub.status.replaceAll("_", " ");
  badge.classList.add(pub.status === "FINAL_AFTER_CLOSE" ? "badge--final" : "badge--preliminary");
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
  if (pub.status !== "FINAL_AFTER_CLOSE") {
    warning.classList.remove("hidden");
    warning.textContent = pub.status === "PRELIMINARY_SESSION_ACTIVE" ? "This snapshot was generated during the trading session and remains preliminary. The scheduled after-close publication will replace it." : "No completed-session activity was available for this publication date.";
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
    ? `Economic calendar window: ${coverageWindow}. Reviewed ${tradingStatus.calendar_reviewed_on || "—"}; valid through ${tradingStatus.calendar_valid_through || "—"}.`
    : `Economic calendar coverage is incomplete for the seven-day window (${coverageWindow}).`;
  table("#calendar-alerts", [
    ["Date (ET)", "date"], ["Flag", "flag"], ["Event", "event"],
  ], tradingStatus.calendar_flags || []);
  const activeAlerts = (tradingStatus.alerts || []).filter(row => row.state === "ACTIVE");
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
  summaryMetrics("#pnl-metrics", [
    ["Daily synchronized P&L", value(pnlSummary.daily_synchronized_pnl, money), pnlClass(pnlSummary.daily_synchronized_pnl)],
    ["Daily P&L (ledger change)", value(pnlSummary.daily_ledger_pnl, money), pnlClass(pnlSummary.daily_ledger_pnl)],
    ["Unrealized P&L", value(pnlSummary.unrealized_pnl, money), pnlClass(pnlSummary.unrealized_pnl)],
    ["Realized P&L on exits", value(exitActivity.realized_pnl, money), pnlClass(exitActivity.realized_pnl)],
  ]);
  summaryMetrics("#evaluation-metrics", [
    ["Candidates examined", value(funnel.candidates_examined)], ["Terminal positive", value(funnel.terminal_positive_candidates)],
    ["Quadrature survivors", value(funnel.quadrature_survivors)], ["Path confirmed", value(funnel.path_confirmed_candidates)],
    ["Eligible", value(funnel.eligible_candidates)], ["Entry orders submitted", value(funnel.orders_submitted)],
    ["Entries filled", value(funnel.trades_filled)], ["Open positions", value(funnel.trades_open)],
  ]);
  summaryMetrics("#exit-metrics", [
    ["Exits filled today", value(exitActivity.exits_filled)],
    ["Net fill slippage", value(exitActivity.net_fill_slippage, money), slippageClass(exitActivity.net_fill_slippage)],
    ["Transaction costs on exits", value(exitActivity.transaction_costs, money)],
    ["Capital released by exits", value(exitActivity.released_capital, money)],
  ]);
  metrics("#capacity-metrics", [
    ["Reserved risk", value(summary.reserved_risk, money)],
    ["Total capacity available", value(ledger.capacity.aggregate_available_capacity, money)],
    ["Available new-entry capacity now", value(ledger.capacity.daily_new_capacity_available ?? ledger.capacity.available_capacity, money)],
    ["Effective capacity unlocked", value(ledger.capacity.timed_capacity_released, money)],
    ["Carried from prior window (25%)", value(ledger.capacity.timed_capacity_carried_forward, money)],
    ["Unused capacity forfeited today", value(ledger.capacity.timed_capacity_forfeited, money)],
    ["Long-dated (4+ DTE) capacity available", value(ledger.capacity.long_dated_available_capacity ?? ledger.capacity.seven_dte_available_capacity, money)],
  ]);
  const positionColors = ["#f76915", "#eede04", "#a0d636", "#2fa236", "#fd0100", "#8a3ffc"];
  const positionSeries = (daily.position_pnl || []).map((item, index) => ({
    rows: item.points, x: "time_et", y: "net_pnl", label: item.position,
    color: positionColors[index % positionColors.length], width: 2,
  }));
  const positionMarkers = (daily.position_pnl || []).flatMap(item => item.points
    .filter(point => point.event === "Entry" || point.event === "Exit")
    .map(point => ({ ...point, position: item.position })));
  lineChart("#daily-chart", [
    ...positionSeries,
    { rows: daily.portfolio_pnl, x: "time_et", y: "net_pnl", label: "TOTAL", color: "#333ed4", width: 4 },
    {
      rows: daily.spx_history || [], x: "time_et", y: "spx", label: "SPX",
      color: "#aeb4bd", width: 2.5, axis: "right", shadeRelativeToFirst: true,
      aboveColor: "#2fa236", belowColor: "#fd0100",
    },
  ], {
    money: true, includeZero: true, leftTickStep: 250, rightTickStep: 50,
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
    ["Allocation", "allocation", null, v => value(v, money)], ["Base expected", "base_expected_net_pnl", pnlClass, v => value(v, money)],
    ["Unrealized", "unrealized_net_pnl", pnlClass, v => value(v, money)], ["Realized", "realized_net_pnl", pnlClass, v => value(v, money)],
    ["Max unrealized", "maximum_unrealized_pnl", pnlClass, v => value(v, money)], ["Min unrealized", "minimum_unrealized_pnl", pnlClass, v => value(v, money)],
    ["Exit reason", "exit_reason"],
  ], daily.trades);
  metrics("#ledger-metrics", [
    ["Starting cash", value(summary.starting_cash, money)], ["Equity", value(summary.equity, money)],
    ["Realized P&L", value(summary.realized_pnl, money), pnlClass(summary.realized_pnl)], ["Unrealized P&L", value(summary.unrealized_pnl, money), pnlClass(summary.unrealized_pnl)],
    ["Reserved risk", value(summary.reserved_risk, money)], ["Available capacity", value(ledger.capacity.available_capacity, money)],
    ["Open positions", value(summary.open_positions)], ["Closed trades", value(summary.closed_trades)],
  ]);
  lineChart("#portfolio-chart", [{ rows: ledger.portfolio_pnl, x: "time_et", y: "net_pnl", label: "Portfolio net P&L", color: "#333ed4", width: 3 }], { money: true, label: "Portfolio P&L history" });
  lineChart("#calibration-chart", [
    { rows: ledger.cumulative_expected_realized, x: "settled_at_et", y: "cumulative_base_expected_net_pnl", label: "Base expected net P&L", color: "#f76915" },
    { rows: ledger.cumulative_expected_realized, x: "settled_at_et", y: "cumulative_realized_net_pnl", label: "Realized net P&L", color: "#2fa236", width: 3 },
  ], { money: true, label: "Expected versus realized P&L" });
  table("#calibration-table", [
    ["Frequency", "frequency"], ["Period", "period"], ["Trades", "closed_trades"],
    ["Risk deployed", "gross_risk_deployed", null, v => value(v, money)], ["Expected", "base_expected_net_pnl", pnlClass, v => value(v, money)],
    ["Realized", "realized_net_pnl", pnlClass, v => value(v, money)], ["Difference", "forecast_error", pnlClass, v => value(v, money)],
    ["Expected return", "expected_return_on_allocation", null, v => value(v, percent)], ["Realized return", "realized_return_on_allocation", null, v => value(v, percent)],
    ["Error SD", "normalized_error_standard_deviation", null, v => value(v, percent)],
  ], ledger.calibration_periods);
  const perf = ledger.performance;
  metrics("#performance-metrics", [
    ["Settled trades", value(perf.settled_trades)], ["Trading days", value(perf.trading_days)], ["Net P&L", value(perf.total_net_pnl, money), pnlClass(perf.total_net_pnl)],
    ["Expectancy / trade", value(perf.expectancy_per_trade, money), pnlClass(perf.expectancy_per_trade)], ["Win rate", value(perf.trade_win_rate, percent)], ["Maximum day drawdown", value(perf.maximum_daily_drawdown, money)],
  ]);
  const groups = [...perf.by_strategy.map(r => ({ dimension: "Strategy", group: r.strategy, ...r })), ...perf.by_dte.map(r => ({ dimension: "DTE", group: r.dte, ...r }))];
  table("#performance-table", [
    ["Dimension", "dimension"], ["Group", "group"], ["Trades", "trades"], ["Win rate", "win_rate", null, v => value(v, percent)],
    ["Net P&L", "net_pnl", pnlClass, v => value(v, money)], ["Expectancy", "expectancy", pnlClass, v => value(v, money)],
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
