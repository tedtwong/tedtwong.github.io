const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

const value = (v, formatter = number) => v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : formatter.format(Number(v));
const pnlClass = v => Number(v) > 0 ? "positive" : Number(v) < 0 ? "negative" : "";
const shortTime = v => v ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(v)) : "—";
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

function table(target, columns, rows) {
  const node = document.querySelector(target);
  if (!rows.length) { node.innerHTML = `<div class="chart-empty">No qualifying records are available.</div>`; return; }
  node.innerHTML = `<table><thead><tr>${columns.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map(row =>
    `<tr>${columns.map(c => `<td class="${c[2] ? c[2](row[c[1]]) : ""}">${c[3] ? c[3](row[c[1]]) : (row[c[1]] ?? "—")}</td>`).join("")}</tr>`
  ).join("")}</tbody></table>`;
}

function lineChart(target, series, options = {}) {
  const node = document.querySelector(target);
  const all = series.flatMap(s => s.rows.map(r => ({ t: new Date(r[s.x]).getTime(), y: Number(r[s.y]) }))).filter(p => Number.isFinite(p.t) && Number.isFinite(p.y));
  if (!all.length) { node.innerHTML = `<div class="chart-empty">No chart data are available for this period.</div>`; return; }
  const width = 1000, height = 310, pad = { l: 76, r: 24, t: 18, b: 42 };
  const minT = Math.min(...all.map(p => p.t)), maxT = Math.max(...all.map(p => p.t));
  const observedMinY = Math.min(...all.map(p => p.y)), observedMaxY = Math.max(...all.map(p => p.y));
  const minY0 = options.includeZero ? Math.min(observedMinY, 0) : observedMinY;
  const maxY0 = options.includeZero ? Math.max(observedMaxY, 0) : observedMaxY;
  const range = Math.max(maxY0 - minY0, 1), minY = minY0 - range * .08, maxY = maxY0 + range * .08;
  const x = t => pad.l + (t - minT) / Math.max(maxT - minT, 1) * (width - pad.l - pad.r);
  const y = v => pad.t + (maxY - v) / Math.max(maxY - minY, 1) * (height - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => minY + (maxY - minY) * i / 4);
  const paths = series.map(s => {
    const points = s.rows.map(r => ({ t: new Date(r[s.x]).getTime(), y: Number(r[s.y]) })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.y));
    return `<path d="${points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.5}" vector-effect="non-scaling-stroke"/>`;
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
  const zero = minY <= 0 && maxY >= 0 ? `<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="#7b8495" stroke-width="1.5"/><text x="${pad.l-10}" y="${y(0)+4}" text-anchor="end" fill="#4b5565" font-size="12">${options.money ? money.format(0) : number.format(0)}</text>` : "";
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.label || "Time series"}">
    ${ticks.map(v => `<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e4dfd6"/><text x="${pad.l-10}" y="${y(v)+4}" text-anchor="end" fill="#667085" font-size="12">${options.money ? money.format(v) : number.format(v)}</text>`).join("")}
    ${zero}${paths}${markers}
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
  table("#active-alerts", alertColumns, activeAlerts);
  table("#recovered-alerts", alertColumns, recoveredAlerts);
  table("#informational-alerts", alertColumns, informationalAlerts);
  metrics("#daily-metrics", [
    ["Candidates examined", value(funnel.candidates_examined)], ["Terminal positive", value(funnel.terminal_positive_candidates)],
    ["Quadrature survivors", value(funnel.quadrature_survivors)], ["Path confirmed", value(funnel.path_confirmed_candidates)],
    ["Eligible", value(funnel.eligible_candidates)], ["Orders submitted", value(funnel.orders_submitted)],
    ["Filled", value(funnel.trades_filled)], ["Open positions", value(funnel.trades_open)],
    ["Current unrealized P&L", value(funnel.current_unrealized_pnl, money), pnlClass(funnel.current_unrealized_pnl)],
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
  ], { money: true, includeZero: true, label: "Daily position and portfolio P&L", markers: positionMarkers });
  table("#trade-table", [
    ["Position", "position"], ["Strategy", "strategy"], ["DTE", "dte"], ["Status", "status"],
    ["Entry (ET)", "entry_time_et", null, shortTime], ["Exit (ET)", "exit_time_et", null, shortTime],
    ["Allocation", "allocation", null, v => value(v, money)], ["Base expected", "base_expected_net_pnl", pnlClass, v => value(v, money)],
    ["Unrealized", "unrealized_net_pnl", pnlClass, v => value(v, money)], ["Realized", "realized_net_pnl", pnlClass, v => value(v, money)],
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
