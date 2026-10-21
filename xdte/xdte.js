const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 2 });

const value = (v, formatter = number) => v === null || v === undefined || Number.isNaN(Number(v)) ? "—" : formatter.format(Number(v));
const pnlClass = v => Number(v) > 0 ? "positive" : Number(v) < 0 ? "negative" : "";
const shortTime = v => v ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(v)) : "—";

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
  const minY0 = Math.min(...all.map(p => p.y)), maxY0 = Math.max(...all.map(p => p.y));
  const range = Math.max(maxY0 - minY0, 1), minY = minY0 - range * .08, maxY = maxY0 + range * .08;
  const x = t => pad.l + (t - minT) / Math.max(maxT - minT, 1) * (width - pad.l - pad.r);
  const y = v => pad.t + (maxY - v) / Math.max(maxY - minY, 1) * (height - pad.t - pad.b);
  const ticks = Array.from({ length: 5 }, (_, i) => minY + (maxY - minY) * i / 4);
  const paths = series.map(s => {
    const points = s.rows.map(r => ({ t: new Date(r[s.x]).getTime(), y: Number(r[s.y]) })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.y));
    return `<path d="${points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.5}" vector-effect="non-scaling-stroke"/>`;
  }).join("");
  const zero = minY <= 0 && maxY >= 0 ? `<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="#a7a19a" stroke-dasharray="5 5"/>` : "";
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.label || "Time series"}">
    ${ticks.map(v => `<line x1="${pad.l}" x2="${width-pad.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e4dfd6"/><text x="${pad.l-10}" y="${y(v)+4}" text-anchor="end" fill="#667085" font-size="12">${options.money ? money.format(v) : number.format(v)}</text>`).join("")}
    ${zero}${paths}
    <text x="${pad.l}" y="${height-12}" fill="#667085" font-size="12">${shortTime(minT)}</text>
    <text x="${width-pad.r}" y="${height-12}" text-anchor="end" fill="#667085" font-size="12">${shortTime(maxT)}</text>
  </svg><div class="chart-legend">${series.map(s => `<span class="legend-key" style="--key:${s.color}">${s.label}</span>`).join("")}</div>`;
}

async function load() {
  const response = await fetch(`data/latest.json?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`);
  const data = await response.json();
  const pub = data.publication, daily = data.daily, ledger = data.ledger, funnel = daily.funnel, summary = ledger.summary;
  const badge = document.querySelector("#status-badge");
  badge.textContent = pub.status.replaceAll("_", " ");
  badge.classList.add(pub.status === "FINAL_AFTER_CLOSE" ? "badge--final" : "badge--preliminary");
  document.querySelector("#as-of").textContent = `Trading date ${pub.trade_date} · published ${shortTime(pub.published_at_et)} ET`;
  document.querySelector("#footer-date").textContent = `Snapshot ${pub.trade_date}`;
  if (pub.status !== "FINAL_AFTER_CLOSE") {
    const warning = document.querySelector("#data-warning"); warning.classList.remove("hidden");
    warning.textContent = pub.status === "PRELIMINARY_SESSION_ACTIVE" ? "This snapshot was generated during the trading session and remains preliminary. The scheduled after-close publication will replace it." : "No completed-session activity was available for this publication date.";
  }
  metrics("#daily-metrics", [
    ["Candidates examined", value(funnel.candidates_examined)], ["Terminal positive", value(funnel.terminal_positive_candidates)],
    ["Quadrature survivors", value(funnel.quadrature_survivors)], ["Path confirmed", value(funnel.path_confirmed_candidates)],
    ["Eligible", value(funnel.eligible_candidates)], ["Orders submitted", value(funnel.orders_submitted)],
    ["Filled", value(funnel.trades_filled)], ["Open positions", value(funnel.trades_open)],
    ["Current unrealized P&L", value(funnel.current_unrealized_pnl, money), pnlClass(funnel.current_unrealized_pnl)],
  ]);
  lineChart("#daily-chart", [{ rows: daily.portfolio_pnl, x: "time_et", y: "net_pnl", label: "Portfolio net P&L", color: "#333ed4", width: 3 }], { money: true, label: "Daily portfolio P&L" });
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

load().catch(error => {
  const warning = document.querySelector("#data-warning"); warning.classList.remove("hidden");
  warning.textContent = `The public snapshot could not be loaded: ${error.message}`;
  document.querySelector("#status-badge").textContent = "DATA UNAVAILABLE";
});

