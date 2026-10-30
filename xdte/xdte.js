function renderDistributionComparison(data) {
  const controls=document.querySelector("#distribution-expiration-controls");
  const chart=document.querySelector("#distribution-comparison-chart");
  const note=document.querySelector("#distribution-comparison-note");
  const slider=document.querySelector("#distribution-scan-slider");
  const scanOutput=document.querySelector("#distribution-scan-output");
  const scans=(data?.scans?.length?data.scans:[{
    snapshot_id:"latest",observed_at_et:data?.observed_at_et,
    expirations:data?.expirations || [],
  }]).filter(scan=>(scan.expirations||[]).length);
  if(!scans.length){controls.replaceChildren();slider.disabled=true;scanOutput.textContent="Unavailable";chart.innerHTML='<p class="chart-empty">No matching blended-reference and risk-neutral curves are available.</p>';note.textContent="";return;}
  const sessionChanged=slider.dataset.sessionDate!==(data?.session_date||"");
  const priorMaximum=Number(slider.max);
  const priorValue=Number(slider.value);
  const wasFollowingLatest=slider.dataset.followLatest!=="false" && (!Number.isFinite(priorValue)||priorValue>=priorMaximum);
  let selectedScanIndex=sessionChanged||wasFollowingLatest?scans.length-1:Math.max(0,Math.min(scans.length-1,priorValue));
  slider.min="0";slider.max=String(scans.length-1);slider.step="1";slider.value=String(selectedScanIndex);slider.disabled=scans.length===1;
  slider.dataset.sessionDate=data?.session_date||"";
  slider.dataset.followLatest=String(selectedScanIndex===scans.length-1);
  const timeLabel=value=>value?new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(value))+" ET":"Unknown time";
  let rows=[];
  let selectedExpiration="";
  const setActiveButton=()=>controls.querySelectorAll("button").forEach(button=>{
    const active=button.dataset.distributionExpiration===selectedExpiration;
    button.classList.toggle("is-active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  const setScan=()=>{
    const scan=scans[selectedScanIndex];
    rows=scan.expirations||[];
    const previous=controls.dataset.selectedExpiration;
    selectedExpiration=rows.some(row=>row.expiration===previous)?previous:(rows[0]?.expiration||"");
    controls.dataset.selectedExpiration=selectedExpiration;
    scanOutput.textContent=`${timeLabel(scan.observed_at_et)} · scan ${selectedScanIndex+1} of ${scans.length}`;
    const buttons=rows.map(row=>{
      const button=document.createElement("button");
      button.type="button";
      button.dataset.distributionExpiration=row.expiration;
      button.textContent=row.expiration.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
      button.onclick=()=>{selectedExpiration=row.expiration;controls.dataset.selectedExpiration=selectedExpiration;setActiveButton();draw();};
      return button;
    });
    controls.replaceChildren(...buttons);
    setActiveButton();
    draw();
  };
  function draw() {
    const row=rows.find(row=>row.expiration===selectedExpiration);
    if(!row){chart.innerHTML='<p class="chart-empty">No matching blended-reference and risk-neutral curves are available in this scan.</p>';note.textContent="";return;}
    const xmin=-7.5,xmax=7.5,xTicks=[-7.5,-5,-2.5,0,2.5,5,7.5];
    const ymin=0,ymax=1,yTicks=[0,.25,.5,.75,1];
    const inView=points=>(points||[]).filter(p=>Number.isFinite(p.return_pct)&&Number.isFinite(p.density)&&p.return_pct>=xmin&&p.return_pct<=xmax);
    const compactPoints=field=>(row[field]||[]).map((density,index)=>({return_pct:data.return_grid?.[index],density}));
    const reference=inView(row.reference||compactPoints("reference_density")),riskNeutral=inView(row.risk_neutral||compactPoints("risk_neutral_density"));
    const all=[...reference,...riskNeutral];
    const observedMax=Math.max(...all.map(p=>p.density));
    if(!(all.length>1 && observedMax>0)){chart.textContent="No valid distribution values fall within the displayed ±7.5% return range.";return;}
    const width=1050,height=420,left=70,right=25,top=25,bottom=65;
    const x=v=>left+(v-xmin)/(xmax-xmin)*(width-left-right);
    const y=v=>height-bottom-(v-ymin)/(ymax-ymin)*(height-top-bottom);
    const line=points=>points.map((p,i)=>`${i?'L':'M'}${x(p.return_pct).toFixed(2)},${y(p.density).toFixed(2)}`).join(' ');
    let axes='';
    for(const v of xTicks){const label=`${v>0?'+':''}${v.toFixed(1)}%`;axes+=`<line x1="${x(v)}" x2="${x(v)}" y1="${top}" y2="${height-bottom}" stroke="${v===0?'#aeb4bc':'#eceff2'}"/><text x="${x(v)}" y="${height-bottom+23}" text-anchor="middle">${label}</text>`;}
    for(const v of yTicks){axes+=`<line x1="${left}" x2="${width-right}" y1="${y(v)}" y2="${y(v)}" stroke="#ddd"/><text x="${left-8}" y="${y(v)+4}" text-anchor="end">${v.toFixed(2)}</text>`;}
    const ivLabel=value=>typeof value==='number' && Number.isFinite(value) && value>=0 ? `${(100*value).toFixed(2)}%` : 'unavailable';
    const ivLegend=`<text x="${left+12}" y="${top+18}" fill="#168a91">Blended reference IV: ${ivLabel(row.reference_iv)}</text><text x="${left+12}" y="${top+40}" fill="#8b5cf6">Risk-neutral IV: ${ivLabel(row.risk_neutral_iv)}</text><text x="${left+12}" y="${top+60}" fill="#555" font-size="12">Annualized · selected expiration</text>`;
    chart.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Blended reference versus risk-neutral terminal SPX return density, displayed from minus 7.5 percent to plus 7.5 percent on a fixed zero-to-one density scale"><defs><clipPath id="distribution-density-clip"><rect x="${left}" y="${top}" width="${width-left-right}" height="${height-top-bottom}"/></clipPath></defs>${axes}${ivLegend}<g clip-path="url(#distribution-density-clip)"><path d="${line(reference)}" fill="none" stroke="#168a91" stroke-width="3" stroke-opacity="0.6"/><path d="${line(riskNeutral)}" fill="none" stroke="#8b5cf6" stroke-width="3" stroke-opacity="0.6"/></g><text x="${width/2}" y="${height-10}" text-anchor="middle">SPX return from snapshot level (%) at expiration</text><text transform="translate(17 ${height/2}) rotate(-90)" text-anchor="middle">Density per percentage point</text></svg>`;
    const scan=scans[selectedScanIndex];
    const age=Math.max(0,(Date.now()-Date.parse(scan.observed_at_et))/1000);
    const isLatest=selectedScanIndex===scans.length-1;
    const stateLabel=!isLatest?"HISTORICAL SCAN — ":data.status==="RETAINED_SESSION"?"RETAINED SESSION CLOSE — ":age>180?"STALE — ":"";
    const clippingNote=observedMax>ymax?' Density above 1.00 is clipped in the chart only; stored values are unchanged.':'';
    const retention=data.status==="RETAINED_SESSION"&&isLatest?" The completed session remains displayed until the next session records a valid distribution.":"";
    note.textContent=`${stateLabel}As of ${scan.observed_at_et} · ${Math.round(age/60)} minutes old · Option-implied fit: ${row.quality}. Teal: blended reference. Purple: option-implied risk-neutral density. The display is fixed at −7.5% to +7.5% and 0.00 to 1.00 density, with identical vertical ticks for every expiration.${clippingNote} Stored tails and probability calculations are not truncated or renormalized. Risk-neutral probabilities are pricing measures, not real-world forecasts. Missing expirations are not replaced across scans.${retention}`;
  }
  slider.oninput=()=>{selectedScanIndex=Math.max(0,Math.min(scans.length-1,Number(slider.value)||0));slider.dataset.followLatest=String(selectedScanIndex===scans.length-1);setScan();};
  setScan();
}

function settlementScenarioChart(target, scenario) {
  const node = document.querySelector(target);
  if (!node) return;
  const rows = (scenario?.rows || []).filter(r => [r.spx_level, r.all_open_net_pnl, r.expiring_today_net_pnl].every(v => typeof v === "number" && Number.isFinite(v)));
  if (!rows.length) { node.textContent = `Settlement scenarios for ${scenario?.session_date || "the selected session"} unavailable: ${scenario?.status || "no snapshot"}.`; return; }
  const retainedClose = scenario.display_mode === "RETAINED_SESSION_CLOSE" && !scenario.forward_session;
  const expiryLabel = retainedClose ? "Expiration-settled positions" : (scenario.forward_session ? `Expiring on ${scenario.session_date}` : "Expiring today only");
  const allLabel = retainedClose ? "Session-ending book · settlement payoff" : (scenario.forward_session ? "Outstanding at target · hypothetical settlement" : "All open · hypothetical settlement");
  const width=1000,height=390,p={l:95,r:30,t:30,b:65};
  const low=rows[0].spx_level,high=rows[rows.length-1].spx_level;
  const finiteValue=value=>value!==null && value!==undefined && value!=="" && Number.isFinite(Number(value));
  const hasRealizedPoint = retainedClose && finiteValue(scenario.realized_expiry_net_pnl) && finiteValue(scenario.realized_settlement_spx);
  const extent=Math.max(1,...rows.flatMap(r=>[Math.abs(r.all_open_net_pnl),Math.abs(r.expiring_today_net_pnl)]),...(hasRealizedPoint?[Math.abs(Number(scenario.realized_expiry_net_pnl))]:[]))*1.08;
  const ymin=-extent,ymax=extent;
  const x=v=>p.l+(v-low)/(high-low||1)*(width-p.l-p.r),y=v=>p.t+(ymax-v)/(ymax-ymin)*(height-p.t-p.b);
  let marks="";
  for(let i=0;i<=6;i++){const v=ymin+(ymax-ymin)*i/6;marks+=`<line x1="${p.l}" x2="${width-p.r}" y1="${y(v)}" y2="${y(v)}" stroke="#e4e7ec"/><text x="${p.l-10}" y="${y(v)+4}" text-anchor="end" font-size="12">${money.format(v)}</text>`;}
  const tickEvery=Math.max(1,Math.ceil(rows.length/9));
  rows.forEach((r,i)=>{if(i%tickEvery===0||i===rows.length-1)marks+=`<text x="${x(r.spx_level)}" y="${height-p.b+24}" text-anchor="middle" font-size="12">${number.format(r.spx_level)}</text>`;});
  marks+=`<line x1="${p.l}" x2="${width-p.r}" y1="${y(0)}" y2="${y(0)}" stroke="#475467" stroke-width="1.5"/>`;
  const specs=[["all_open_net_pnl",allLabel, "#333ED4", ""],["expiring_today_net_pnl",expiryLabel, "#F76915", "7 4"]];
  for(const [field,label,color,dash] of specs){
    const line=rows.map((r,i)=>`${i?'L':'M'}${x(r.spx_level)},${y(r[field])}`).join(' ');
    marks+=`<path d="${line} L${x(high)},${y(0)} L${x(low)},${y(0)} Z" fill="${color}" fill-opacity=".10"/><path d="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-opacity=".65" stroke-dasharray="${dash}"/>`;
    rows.forEach(r=>{marks+=`<circle cx="${x(r.spx_level)}" cy="${y(r[field])}" r="4" fill="${color}" fill-opacity=".18"><title>SPX ${number.format(r.spx_level)} · ${label}: ${money.format(r[field])}</title></circle>`;});
  }
  const referenceSpx=hasRealizedPoint?Number(scenario.realized_settlement_spx):scenario.spot;
  if(typeof referenceSpx === "number")marks+=`<line x1="${x(referenceSpx)}" x2="${x(referenceSpx)}" y1="${p.t}" y2="${height-p.b}" stroke="#667085" stroke-dasharray="4 4"/><text x="${x(referenceSpx)}" y="${p.t-10}" text-anchor="middle" font-size="12">${retainedClose?"Settlement":"Current"} SPX ${number.format(referenceSpx)}</text>`;
  if(hasRealizedPoint)marks+=`<circle cx="${x(Number(scenario.realized_settlement_spx))}" cy="${y(Number(scenario.realized_expiry_net_pnl))}" r="7" fill="#2FA236" stroke="white" stroke-width="2"><title>Aggregate realized net P&amp;L at settlement: ${money.format(Number(scenario.realized_expiry_net_pnl))}</title></circle>`;
  node.innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Net settlement payoff versus hypothetical SPX: outstanding positions and positions expiring on the selected session"><text x="${(p.l+width-p.r)/2}" y="${height-8}" text-anchor="middle" font-size="13">Hypothetical SPX settlement level · five-point increments</text>${marks}</svg><div class="chart-legend"><span class="legend-key" style="--key:#333ED4">${allLabel} (${scenario.all_open_count})</span><span class="legend-key" style="--key:#F76915">${expiryLabel} (${scenario.expiring_today_count})</span></div>`;
  if(hasRealizedPoint)node.insertAdjacentHTML("beforeend",`<div class="chart-legend"><span class="legend-key" style="--key:#2FA236">Actual expiration-settled net P&amp;L ${money.format(Number(scenario.realized_expiry_net_pnl))}</span></div>`);
  const note=document.createElement("p");note.className="chart-note";note.textContent=`${scenario.note} Session ${scenario.session_date}. ${scenario.as_of_et ? `SPX as of ${scenario.as_of_et}. ` : ""}${scenario.excluded_count ? `Warning: ${scenario.excluded_count} open position(s) excluded; incomplete result. ` : ""}${scenario.expiring_today_count===0 ? `No open positions expire on ${scenario.session_date}; orange curve is zero.` : ""}`;node.appendChild(note);
}

function renderSettlementScenarioHorizons(horizons, afterMidnightHorizons = [], rollForwardAtEt = null, history = null) {
  const controls=document.querySelector("#settlement-horizon-controls");
  const slider=document.querySelector("#settlement-scan-slider");
  const scanOutput=document.querySelector("#settlement-scan-output");
  const rollForwardAt=Date.parse(rollForwardAtEt || "");
  const useAfterMidnight=Array.isArray(afterMidnightHorizons) && afterMidnightHorizons.length && Number.isFinite(rollForwardAt) && Date.now()>=rollForwardAt;
  const selectedHorizons=useAfterMidnight?afterMidnightHorizons:horizons;
  const currentScenarios=(Array.isArray(selectedHorizons)?selectedHorizons:[]).filter(Boolean);
  const activeSession=currentScenarios[0]?.reference_session_date || currentScenarios[0]?.session_date || "";
  const savedScans=history?.session_date===activeSession && Array.isArray(history?.scans)?history.scans:[];
  const scans=(savedScans.length?savedScans:[{observed_at_et:currentScenarios[0]?.as_of_et,horizons:currentScenarios}]).filter(scan=>(scan.horizons||[]).length);
  controls.dataset.rollForwardApplied=String(Boolean(useAfterMidnight));
  if(!scans.length){controls.replaceChildren();slider.disabled=true;scanOutput.textContent="Unavailable";settlementScenarioChart("#settlement-scenario-chart",{status:"NO_SETTLEMENT_HORIZONS",rows:[]});return;}
  const sessionChanged=slider.dataset.sessionDate!==activeSession;
  const priorMaximum=Number(slider.max),priorValue=Number(slider.value);
  const wasFollowingLatest=slider.dataset.followLatest!=="false"&&(!Number.isFinite(priorValue)||priorValue>=priorMaximum);
  let selectedScanIndex=sessionChanged||wasFollowingLatest?scans.length-1:Math.max(0,Math.min(scans.length-1,priorValue));
  slider.min="0";slider.max=String(scans.length-1);slider.step="1";slider.value=String(selectedScanIndex);slider.disabled=scans.length===1;
  slider.dataset.sessionDate=activeSession;slider.dataset.followLatest=String(selectedScanIndex===scans.length-1);
  const timeLabel=value=>value?new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit",timeZone:"America/New_York"}).format(new Date(value))+" ET":"Current";
  let scenarios=[];
  const offsetFor=(scenario,index)=>Number.isInteger(scenario?.horizon_trading_days)
    ? scenario.horizon_trading_days : index;
  let selected=0;
  const setActiveButton=()=>controls.querySelectorAll("button").forEach(button=>{
    const active=Number(button.dataset.settlementHorizon)===selected;
    button.classList.toggle("is-active",active);
    button.setAttribute("aria-pressed",String(active));
  });
  const draw=()=>{
    const scenario=scenarios.find((item,index)=>offsetFor(item,index)===selected);
    settlementScenarioChart("#settlement-scenario-chart",scenario || {status:"NO_SETTLEMENT_HORIZONS",rows:[]});
  };
  const setScan=()=>{
    const scan=scans[selectedScanIndex];
    scenarios=(scan.horizons||[]).filter(Boolean);
    const previous=Number.parseInt(controls.dataset.selectedHorizon||"0",10);
    selected=scenarios.some((scenario,index)=>offsetFor(scenario,index)===previous)?previous:(scenarios.length?offsetFor(scenarios[0],0):0);
    const provenance=String(scan.capture_mode||"").startsWith("RECONSTRUCTED_")?" · reconstructed":"";
    scanOutput.textContent=`${timeLabel(scan.observed_at_et)}${provenance} · scan ${selectedScanIndex+1} of ${scans.length}`;
    const buttons=scenarios.map((scenario,index)=>{
      const offset=offsetFor(scenario,index);
      const button=document.createElement("button");
      button.type="button";
      button.dataset.settlementHorizon=String(offset);
      button.textContent=scenario.horizon_label || (offset===0 ? "Today" : `+${offset} day${offset===1?"":"s"}`);
      button.title=`Target session ${scenario.session_date || "unavailable"}`;
      button.onclick=()=>{selected=offset;controls.dataset.selectedHorizon=String(selected);setActiveButton();draw();};
      return button;
    });
    controls.dataset.selectedHorizon=String(selected);
    controls.replaceChildren(...buttons);
    setActiveButton();
    draw();
  };
  slider.oninput=()=>{selectedScanIndex=Math.max(0,Math.min(scans.length-1,Number(slider.value)||0));slider.dataset.followLatest=String(selectedScanIndex===scans.length-1);setScan();};
  setScan();
}

function deployedCapacityChart(rows) {
  const node = document.querySelector("#deployed-capacity-chart");
  if (!node) return;
  const controls = document.querySelector("#deployed-capacity-period-controls");
  const history = (Array.isArray(rows) ? rows : []).filter(row=>row?.date && Number.isFinite(Date.parse(`${row.date}T00:00:00Z`))).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if (!history.length) {node.textContent="No deployed-capacity history available.";return;}
  let selectedWindow = Number(controls?.dataset?.selectedWindow || 30);

  const draw = () => {
    const latestDay=Date.parse(`${history[history.length-1].date}T00:00:00Z`);
    const cutoff=latestDay-(Math.max(1,selectedWindow)-1)*24*60*60*1000;
    const displayed=history.filter(row=>Date.parse(`${row.date}T00:00:00Z`)>=cutoff);
    const width=1050,height=370,pad={l:90,r:105,t:46,b:72};
    const numeric=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
    // Four fixed reserve slots keep the accounting sequence uninterrupted.
    // Daily P&L spans the full session as a background bar behind reserve data.
    const slotsPerSession=4;
    const maximumSlot=Math.max(1,displayed.length*slotsPerSession-1);
    const sessionX=(index,slot)=>pad.l+(index*slotsPerSession+slot)/maximumSlot*(width-pad.l-pad.r);
    const reserveTimeline=displayed.flatMap((row,index)=>{
      const opening=numeric(row.opening_deployed);
      const afterAdded=numeric(row.after_new_deployment,opening+numeric(row.reserved_today));
      const afterExited=numeric(row.after_exits,afterAdded-numeric(row.exited_today));
      return [
        {row,index,slot:0,phase:"Starting",value:opening,color:"#8da2fb"},
        {row,index,slot:1,phase:"After added",value:afterAdded,color:"#f76915"},
        {row,index,slot:2,phase:"After exited",value:afterExited,color:"#2fa236"},
        {row,index,slot:3,phase:"Ending",value:numeric(row.deployed),color:"#333ed4"},
      ];
    });
    const changeBars=displayed.flatMap((row,index)=>{
      const opening=numeric(row.opening_deployed),reserved=numeric(row.reserved_today);
      const afterNew=numeric(row.after_new_deployment,opening+reserved);
      const afterExits=numeric(row.after_exits,afterNew-numeric(row.exited_today));
      return [
        {row,index,slot:1,label:"New filled",start:opening,end:afterNew,amount:reserved,color:"#f76915",anchor:"opening deployed"},
        {row,index,slot:2,label:"Exited / released",start:afterNew,end:afterExits,amount:afterExits-afterNew,color:"#2fa236",anchor:"post-fill deployed"},
      ];
    });
    const capacityValues=[0,...reserveTimeline.map(item=>item.value),...changeBars.flatMap(item=>[item.start,item.end])];
    let capacityMinimum=Math.min(...capacityValues),capacityMaximum=Math.max(...capacityValues);
    if(capacityMinimum===capacityMaximum)capacityMaximum=capacityMinimum+1;
    const capacityY=value=>pad.t+(capacityMaximum-numeric(value))/(capacityMaximum-capacityMinimum)*(height-pad.t-pad.b);
    const pnlRows=displayed.map((row,index)=>({row,index,value:Number(row.realized_pnl)}))
      .filter(item=>Number.isFinite(item.value));
    const pnlExtent=Math.max(1,...pnlRows.map(item=>Math.abs(item.value)));
    const pnlMinimum=-pnlExtent,pnlMaximum=pnlExtent;
    const pnlY=value=>pad.t+(pnlMaximum-value)/(pnlMaximum-pnlMinimum)*(height-pad.t-pad.b);
    const capacityTicks=Array.from({length:5},(_,i)=>capacityMinimum+(capacityMaximum-capacityMinimum)*i/4);
    let marks=capacityTicks.map(value=>`<line x1="${pad.l}" x2="${width-pad.r}" y1="${capacityY(value)}" y2="${capacityY(value)}" stroke="#ddd"/><text x="${pad.l-8}" y="${capacityY(value)+4}" text-anchor="end" font-size="12">${money.format(value)}</text>`).join("");
    if(pnlRows.length){
      const pnlTicks=Array.from({length:5},(_,i)=>pnlMinimum+(pnlMaximum-pnlMinimum)*i/4);
      marks+=pnlTicks.map(value=>`<text x="${width-pad.r+9}" y="${pnlY(value)+4}" text-anchor="start" fill="#6b7280" font-size="12">${money.format(value)}</text>`).join("");
      marks+=`<line x1="${pad.l}" x2="${width-pad.r}" y1="${pnlY(0)}" y2="${pnlY(0)}" stroke="#6b7280" stroke-opacity=".4" stroke-dasharray="4 4"/>`;
      pnlRows.forEach(item=>{const left=sessionX(item.index,0),right=sessionX(item.index,3),top=Math.min(pnlY(0),pnlY(item.value)),barHeight=Math.max(1,Math.abs(pnlY(0)-pnlY(item.value)));marks+=`<rect data-capacity-layer="pnl-overlay" data-capacity-date="${item.row.date}" data-capacity-left-x="${left}" data-capacity-right-x="${right}" x="${left}" y="${top}" width="${right-left}" height="${barHeight}" fill="#6b7280" opacity=".16"><title>${item.row.date}: daily realized P&L background bar ${money.format(item.value)}</title></rect>`;});
    }
    const labelEvery=Math.max(1,Math.ceil(displayed.length/12));
    changeBars.forEach(item=>{
      const top=Math.min(capacityY(item.start),capacityY(item.end));
      const barHeight=Math.max(1,Math.abs(capacityY(item.start)-capacityY(item.end)));
      const left=(sessionX(item.index,item.slot-1)+sessionX(item.index,item.slot))/2;
      const right=(sessionX(item.index,item.slot)+sessionX(item.index,item.slot+1))/2;
      marks+=`<rect data-capacity-layer="change" data-capacity-date="${item.row.date}" data-capacity-change="${item.label}" data-capacity-left-x="${left}" data-capacity-right-x="${right}" x="${left}" y="${top}" width="${right-left}" height="${barHeight}" fill="${item.color}" opacity=".78"><title>${item.row.date}: ${item.label} ${money.format(Math.abs(item.amount))}; starts at ${item.anchor} ${money.format(item.start)}; ends at ${money.format(item.end)}</title></rect>`;
    });
    // Session-to-session continuity is a dashed connector.  The solid line is
    // restarted within each day so its state order cannot cross day boundaries.
    for(let index=1;index<displayed.length;index++){
      const prior=reserveTimeline.find(item=>item.index===index-1&&item.phase==="Ending");
      const current=reserveTimeline.find(item=>item.index===index&&item.phase==="Starting");
      marks+=`<line data-capacity-layer="overnight-connector" x1="${sessionX(index-1,3)}" y1="${capacityY(prior.value)}" x2="${sessionX(index,0)}" y2="${capacityY(current.value)}" stroke="#333ed4" stroke-width="1.5" stroke-opacity=".48" stroke-dasharray="4 4"><title>${prior.row.date} close to ${current.row.date} open: ${money.format(prior.value)} → ${money.format(current.value)}</title></line>`;
    }
    displayed.forEach((row,index)=>{
      const points=reserveTimeline.filter(item=>item.index===index);
      marks+=`<path data-capacity-layer="session-line" data-capacity-date="${row.date}" d="${points.map((item,pointIndex)=>`${pointIndex?'L':'M'}${sessionX(item.index,item.slot)},${capacityY(item.value)}`).join(' ')}" fill="none" stroke="#333ed4" stroke-width="2.5"/>`;
    });
    reserveTimeline.forEach(item=>{marks+=`<circle data-capacity-layer="state" data-capacity-date="${item.row.date}" data-capacity-stage="${item.phase}" cx="${sessionX(item.index,item.slot)}" cy="${capacityY(item.value)}" r="4" fill="${item.color}" stroke="white" stroke-width="1"><title>${item.row.date} ${item.phase.toLowerCase()}: deployed reserve ${money.format(item.value)}</title></circle>`;});
    displayed.forEach((row,index)=>{
      if(index%labelEvery===0||index===displayed.length-1){const center=(sessionX(index,1)+sessionX(index,2))/2;marks+=`<text transform="translate(${center},${height-pad.b+20}) rotate(-30)" text-anchor="end" font-size="12">${row.date}</text>`;}
    });
    marks+=`<text x="${(pad.l+width-pad.r)/2}" y="18" text-anchor="middle" fill="#475467" font-size="12">Reserve sequence: Open → +New → −Exit → Close · P&amp;L is a full-session background bar</text>`;
    marks+=`<text x="${(pad.l+width-pad.r)/2}" y="${height-10}" text-anchor="middle" font-size="12">Trading sessions only (ET; closed days omitted)</text><text transform="translate(18 ${(pad.t+height-pad.b)/2}) rotate(-90)" text-anchor="middle" font-size="12">Deployed reserve ($)</text><text transform="translate(${width-15} ${(pad.t+height-pad.b)/2}) rotate(90)" text-anchor="middle" fill="#6b7280" font-size="12">Daily realized P&amp;L ($; zero centered)</text>`;
    node.innerHTML=`<svg data-capacity-stage-order="open,new,exit,close" viewBox="0 0 ${width} ${height}" role="img" aria-label="Deployed reserve follows open, new fills, exits, and close in that uninterrupted fixed order; daily realized P and L is a translucent full-session background bar">${marks}</svg><div class="chart-legend"><span class="legend-key" style="--key:#8da2fb">Opening reserve · line point</span><span class="legend-key" style="--key:#f76915">After new fills · line point and change bar</span><span class="legend-key" style="--key:#2fa236">After exits · line point and change bar</span><span class="legend-key" style="--key:#333ed4">Closing reserve · line point</span><span class="legend-key" style="--key:#6b7280">Daily realized P&amp;L · background bar · right axis</span></div><p class="chart-note">The reserve sequence is uninterrupted: Open → +New → −Exit → Close. The +New and −Exit change bars touch at their shared boundary. Each daily realized-P&amp;L value is a translucent gray background bar spanning that session from Open through Close on the independent right axis. It is drawn behind every capacity bar, line, and point, so P&amp;L never occupies a reserve stage. Dashed segments connect one session's close to the next session's open. The selected lookback is ${selectedWindow} calendar days; weekends and full-market holidays are omitted.</p>`;
    const reconciliationFailures=displayed.filter(row=>Math.abs(numeric(row.reconciliation_difference))>.01);
    if(reconciliationFailures.length)node.insertAdjacentHTML("beforeend",`<p class="chart-note">Warning: ${reconciliationFailures.length} displayed session(s) do not reconcile opening + deployment − exits to ending reserve.</p>`);
    if(displayed.some(row=>row.status!=="COMPLETE"))node.insertAdjacentHTML("beforeend","<p class=\"chart-note\">Warning: capacity or realized-P&amp;L history is incomplete.</p>");
  };

  if(controls){
    controls.querySelectorAll("button").forEach(button=>{
      const windowValue=Number(button.dataset.capacityWindow);
      const active=windowValue===selectedWindow;
      button.classList.toggle("is-active",active);
      button.setAttribute("aria-pressed",String(active));
      button.onclick=()=>{
        selectedWindow=windowValue;
        controls.dataset.selectedWindow=String(windowValue);
        controls.querySelectorAll("button").forEach(candidate=>{
          const isActive=Number(candidate.dataset.capacityWindow)===selectedWindow;
          candidate.classList.toggle("is-active",isActive);
          candidate.setAttribute("aria-pressed",String(isActive));
        });
        draw();
      };
    });
  }
  draw();
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
const capacityClass = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) <= 0 ? "negative" : "";
const pnlClass = v => Number(v) > 0 ? "positive" : Number(v) < 0 ? "negative" : "";
const slippageClass = v => Number(v) < 0 ? "positive" : Number(v) > 0 ? "negative" : "";
const positionZoneBadge = zone => {
  const values = {
    INSIDE_SHORTS: ["position-zone--green", "Inside", "Inside short strikes"],
    BETWEEN_SHORT_AND_LONG_PROFITABLE: ["position-zone--yellow", "Between +", "Between short and long strikes; position remains profitable"],
    BETWEEN_SHORT_AND_LONG: ["position-zone--orange", "Between", "Between short and long strikes"],
    OUTSIDE_LONGS: ["position-zone--red", "Outside", "Outside long strikes"],
  };
  const [className, label, title] = values[zone] || ["position-zone--unavailable", "N/A", "Unavailable"];
  return `<span class="position-zone ${className}" title="${title}">${label}</span>`;
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
const shortDate = v => v ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${v}T00:00:00Z`)) : "—";
const liveFeedUrl = "https://storage.googleapis.com/ibkr-steamroller-coins-xdte-feed/latest.json";
const autoRefreshIntervalMilliseconds = 5 * 60 * 1000;
const publicationRefreshDelayMilliseconds = 90 * 1000;
function publicationWindowDelay(now = Date.now()) {
  const offset = now % autoRefreshIntervalMilliseconds;
  return offset < publicationRefreshDelayMilliseconds ? publicationRefreshDelayMilliseconds - offset : 0;
}
function nextAutomaticRefreshDelay(now = Date.now()) {
  const boundary = Math.floor(now / autoRefreshIntervalMilliseconds) * autoRefreshIntervalMilliseconds;
  const target = boundary + publicationRefreshDelayMilliseconds;
  return (target > now ? target : target + autoRefreshIntervalMilliseconds) - now;
}
function scheduleAutomaticRefresh() {
  setTimeout(() => {
    scheduleAutomaticRefresh();
    if (!document.hidden) refresh();
  }, nextAutomaticRefreshDelay());
}

let lastSuccessfulRefreshAt = 0;
let refreshInFlight = false;
let lastRenderedPublicationAt = 0;

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

function fullCreditProbability(probability, row) {
  const displayed = value(probability, percent);
  return probability !== null && probability !== undefined && Number.isFinite(Number(probability)) && ["BLACK_SCHOLES", "BLACK_SCHOLES_RECONSTRUCTED"].includes(row.probability_of_full_credit_source)
    ? `${displayed} <span title="Black–Scholes fallback from saved entry probability or entry delta/IV; reconstructed estimates use the forward-delta convention">(BS)</span>`
    : displayed;
}

function expiresToday(expiration, now = new Date()) {
  if (typeof expiration !== "string") return false;
  const normalized=expiration.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  const parts=new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const part=type=>parts.find(p=>p.type===type).value;
  return normalized === `${part("year")}-${part("month")}-${part("day")}`;
}

function table(target, columns, rows, options = {}) {
  const node = document.querySelector(target);
  const isCompactEmpty = !rows.length && options.compactEmpty;
  node.classList.toggle("table-wrap--compact-empty", Boolean(isCompactEmpty));
  if (!rows.length) {
    node.innerHTML = `<div class="chart-empty">${options.emptyMessage || "No qualifying records are available."}</div>`;
    return;
  }
  node.innerHTML = `<table><thead><tr>${columns.map(c => `<th${c[4] ? ` title="${c[4]}"` : ""}>${c[0]}</th>`).join("")}</tr></thead><tbody>${rows.map(row =>
    `<tr class="${target === "#trade-table" && expiresToday(row.expiration_date) ? "expiring-today" : ""}">${columns.map(c => `<td class="${c[2] ? c[2](row[c[1]]) : ""}">${c[3] ? c[3](row[c[1]], row) : (row[c[1]] ?? "—")}</td>`).join("")}</tr>`
  ).join("")}</tbody></table>`;
}

const compactRecordType = value => {
  const label = String(value || "");
  if (label.startsWith("Carried")) return "Carried";
  if (label === "Today" || label.startsWith("Entered") || label.startsWith("Candidate")) return "Today";
  return label || "—";
};
const compactStrategy = value => {
  const strategies = {
    IRON_CONDOR: ["IC", "Iron condor"],
    BULL_PUT_CREDIT_SPREAD: ["BPS", "Bull-put credit spread"],
    BEAR_CALL_CREDIT_SPREAD: ["BCS", "Bear-call credit spread"],
  };
  const [label, title] = strategies[value] || [String(value || "—").replaceAll("_", " "), ""];
  return title ? `<abbr title="${title}">${label}</abbr>` : label;
};
const compactStatus = value => ({
  ENTRY_PARTIAL: "Partial",
  EXIT_WORKING: "Exiting",
  ORDER_ATTEMPTED: "Attempted",
}[value] || String(value || "—").replaceAll("_", " "));
const compactExitReason = value => {
  const reasons = {
    MANUAL_EMERGENCY_EXIT: ["Emergency", "Manual emergency exit"],
    HARD_EXIT_TIME: ["Hard exit", "Hard-exit time"],
    PROFIT_TARGET: ["Target", "Profit target"],
    POSITION_STOP: ["Stop", "Position stop"],
    SHORT_STRIKE_TOUCH: ["Strike touch", "Short-strike touch"],
    SHORT_DELTA_EXIT: ["Delta exit", "Short-delta exit"],
    VOLATILITY_REBOUND: ["Vol rebound", "Volatility-rebound exit"],
  };
  const [label, title] = reasons[value] || [String(value || "—").replaceAll("_", " "), ""];
  return title ? `<abbr title="${title}">${label}</abbr>` : label;
};

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
  const chartPoints = s => s.rows.map(r => ({ t: new Date(r[s.x]).getTime(), y: Number(r[s.y]), row: r })).filter(p => Number.isFinite(p.t) && Number.isFinite(p.y));
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
    const polygon = (left, right, color) => `<path class="spx-opening-area" d="M${x(left.t).toFixed(1)},${seriesY(left.y).toFixed(1)} L${x(right.t).toFixed(1)},${seriesY(right.y).toFixed(1)} L${x(right.t).toFixed(1)},${baselineY.toFixed(1)} L${x(left.t).toFixed(1)},${baselineY.toFixed(1)} Z" fill="${color}" fill-opacity="0.16" stroke="none"/>`;
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
    if (s.dashCarriedForward) {
      const segments=[];
      for(let i=1;i<points.length;i+=1){
        const left=points[i-1],right=points[i];
        const leftHeld=Boolean(left.row?.is_carried_forward),rightHeld=Boolean(right.row?.is_carried_forward);
        const leftEstimated=Boolean(left.row?.is_estimated_mark),rightEstimated=Boolean(right.row?.is_estimated_mark);
        if(leftHeld && !rightHeld){
          segments.push(`<path d="M${x(left.t).toFixed(1)},${seriesY(left.y).toFixed(1)} L${x(right.t).toFixed(1)},${seriesY(left.y).toFixed(1)}" fill="none" stroke="${s.color}" stroke-width="${s.width||2.5}" stroke-dasharray="7 5" vector-effect="non-scaling-stroke"><title>${s.label} · held at last accounting mark until ${shortTime(right.t)}</title></path>`);
          const estimateDash=rightEstimated?' stroke-dasharray="3 3"':'';
          segments.push(`<path d="M${x(right.t).toFixed(1)},${seriesY(left.y).toFixed(1)} L${x(right.t).toFixed(1)},${seriesY(right.y).toFixed(1)}" fill="none" stroke="${s.color}" stroke-width="${s.width||2.5}"${estimateDash} vector-effect="non-scaling-stroke"/>`);
          continue;
        }
        const held=leftHeld||rightHeld,estimated=leftEstimated||rightEstimated;
        const dash=held?' stroke-dasharray="7 5"':estimated?' stroke-dasharray="3 3"':'';
        const qualityTitle=held?`<title>${s.label} · held at last accounting mark</title>`:estimated?`<title>${s.label} · estimated zero-bid midpoint</title>`:"";
        segments.push(`<path d="M${x(left.t).toFixed(1)},${seriesY(left.y).toFixed(1)} L${x(right.t).toFixed(1)},${seriesY(right.y).toFixed(1)}" fill="none" stroke="${s.color}" stroke-width="${s.width||2.5}"${dash} vector-effect="non-scaling-stroke">${qualityTitle}</path>`);
      }
      return segments.join("");
    }
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
  </svg><div class="chart-legend">${series.filter((s,i,a)=>a.findIndex(t=>(t.legendLabel||t.label)===(s.legendLabel||s.label))===i).map(s => `<span class="legend-key${s.dash ? " legend-key--dashed" : ""}" style="--key:${s.color}">${s.legendLabel || s.label}</span>`).join("")}${options.estimatedMarkLegend ? '<span class="legend-key legend-key--estimated" style="--key:#667085">Estimated zero-bid midpoint</span>' : ''}${options.carriedForwardLegend ? '<span class="legend-key legend-key--dashed" style="--key:#667085">Held at last accounting mark</span>' : ''}</div>`;
}

function portfolioDailyChart(target, rows, expectedHistory = [], intradayHistory = []) {
  // Refuse old marked-to-market snapshots; only matched settled-trade totals.
  rows = (rows || []).filter(row => row.basis === "SETTLED_TRADES_ONLY");
  const node = document.querySelector(target);
  const finite = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  if (!(rows || []).length) {
    node.innerHTML = '<div class="chart-empty">No portfolio session history is available.</div>';
    return;
  }
  // Saved aggregate marks include closed positions at realized value plus open marks.
  const intraday = intradayHistory.filter(r => r.time_et && finite(r.net_pnl));
  const sessions = new Map(rows.map(r => [r.date, r]));
  intraday.forEach(r => {
    const day = r.time_et.slice(0, 10);
    if (!sessions.has(day)) sessions.set(day, {date:day, realized_net_pnl:null, net_pnl:null, expected_net_pnl:null});
  });
  rows = [...sessions.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const width = 1000, height = 365, pad = {l: 96, r: 100, t: 30, b: 66};
  const plotWidth = width-pad.l-pad.r, plotHeight = height-pad.t-pad.b;
  const x = i => pad.l+(i+.5)*plotWidth/rows.length;
  const intradayPoints = intraday.slice()
    .sort((a,b)=>Date.parse(a.time_et)-Date.parse(b.time_et))
    .map(r=>{
      const day=r.time_et.slice(0,10),index=rows.findIndex(session=>session.date===day);
      const clock=r.time_et.slice(11,19).split(":").map(Number);
      const fraction=Math.max(0,Math.min(1,(clock[0]*60+clock[1]+clock[2]/60-570)/390));
      return {...r,day,index,stamp:new Date(r.time_et),px:pad.l+(index+.1+.8*fraction)*plotWidth/rows.length};
    })
    .filter(point=>point.index>=0);
  const totalSessionAnchors=new Map();
  intradayPoints.forEach(point=>totalSessionAnchors.set(point.day,point));
  // Settled/expected cumulative values are session-close quantities.  Put
  // their points at the exact horizontal coordinate of that session's final
  // TOTAL mark; use the right edge only when no TOTAL mark exists.
  const cumulativeX=(row,index)=>totalSessionAnchors.get(row.date)?.px
    ?? (pad.l+(index+.9)*plotWidth/rows.length);
  const bounds = values => {
    const maximum = Math.max(1, ...values.filter(finite).map(v => Math.abs(Number(v))));
    const rawStep = maximum/3, power = 10**Math.floor(Math.log10(rawStep));
    const ratio = rawStep/power;
    const step = (ratio<=1 ? 1 : ratio<=2 ? 2 : ratio<=5 ? 5 : 10)*power;
    return {maximum: Math.ceil(maximum/step)*step, step};
  };
  const left = bounds(rows.map(r=>r.realized_net_pnl)), right = bounds([...rows.flatMap(r=>[r.net_pnl,r.expected_net_pnl]), ...intraday.map(r=>r.net_pnl)]);
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
    return `${move}${cumulativeX(r,i).toFixed(2)},${ry(r.net_pnl).toFixed(2)}`;
  }).join(" ");
  const dots = rows.map((r,i)=>finite(r.net_pnl) ? `<circle data-series="cumulative-settled" data-session="${r.date}" cx="${cumulativeX(r,i)}" cy="${ry(r.net_pnl)}" r="3.5" fill="#333ed4"><title>${r.date}: cumulative settled net P&amp;L ${money.format(r.net_pnl)}</title></circle>` : "").join("");
  let expectedDrawing = false;
  const expectedPath = rows.map((r,i)=>{
    if (!finite(r.expected_net_pnl)) { expectedDrawing=false;return ""; }
    const move = expectedDrawing ? "L" : "M"; expectedDrawing=true;
    return `${move}${cumulativeX(r,i).toFixed(2)},${ry(r.expected_net_pnl).toFixed(2)}`;
  }).join(" ");
  const expectedDots = rows.map((r,i)=>finite(r.expected_net_pnl) ? `<circle data-series="cumulative-expected" data-session="${r.date}" cx="${cumulativeX(r,i)}" cy="${ry(r.expected_net_pnl)}" r="3" fill="#7c3aed"><title>${r.date}: cumulative saved expected net P&amp;L for settled trades ${money.format(r.expected_net_pnl)}</title></circle>` : "").join("");
  let previousMark = null;
  let previousPoint = null;
  const overnightSegments = [];
  const intradayPath = intradayPoints.map(r=>{
    const contiguous=previousMark && previousMark.day===r.day && r.stamp-previousMark.stamp<=15*60*1000;
    const point=`${r.px.toFixed(2)},${ry(r.net_pnl).toFixed(2)}`;
    if(previousMark && previousMark.day!==r.day) overnightSegments.push(`M${previousPoint} L${point}`);
    previousPoint=point;
    previousMark=r;
    return `${contiguous ? "L" : "M"}${r.px.toFixed(2)},${ry(r.net_pnl).toFixed(2)}`;
  }).join(" ");
  const totalAnchorDots=[...totalSessionAnchors.values()].map(r=>`<circle data-series="total-session-anchor" data-session="${r.day}" cx="${r.px}" cy="${ry(r.net_pnl)}" r="3" fill="#707780"><title>${r.day}: final saved TOTAL P&amp;L ${money.format(r.net_pnl)}</title></circle>`).join("");
  const dateFormat = new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
  const interval = Math.max(1,Math.ceil(rows.length/8));
  const labels = rows.map((r,i)=>(i%interval===0 || i===rows.length-1) ? `<text x="${x(i)}" y="${height-39}" text-anchor="middle" fill="#667085" font-size="12">${dateFormat.format(new Date(r.date+"T12:00:00Z"))}</text>` : "").join("");
  node.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Daily realized P&amp;L bars, cumulative settled net P&amp;L and cumulative expected P&amp;L by trading session">
    ${grid}${rightTicks}
    <line data-zero-axis="left" x1="${pad.l}" x2="${width-pad.r}" y1="${y(0)}" y2="${y(0)}" stroke="#7b8495" stroke-width="1.75"/>
    ${bars}<path data-series="intraday-total" d="${intradayPath}" stroke="#707780" stroke-width="2.3" stroke-opacity="0.6" fill="none" vector-effect="non-scaling-stroke"/><path data-series="overnight-total" d="${overnightSegments.join(" ")}" stroke="#707780" stroke-width="2.3" stroke-opacity="0.6" stroke-dasharray="5 4" fill="none" vector-effect="non-scaling-stroke"/>${totalAnchorDots}<path data-series="cumulative-settled" d="${path}" stroke="#333ed4" stroke-width="3" fill="none" vector-effect="non-scaling-stroke"/>${dots}<path data-series="expected" d="${expectedPath}" stroke="#7c3aed" stroke-dasharray="6 4" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/>${expectedDots}${labels}
    <text transform="translate(17,${pad.t+plotHeight/2}) rotate(-90)" text-anchor="middle" fill="#667085" font-size="12">Daily realized P&amp;L ($) · left</text>
    <text transform="translate(${width-12},${pad.t+plotHeight/2}) rotate(90)" text-anchor="middle" fill="#333ed4" font-size="12">Total / expected P&amp;L ($) · right</text>
    <text x="${width/2}" y="${height-10}" text-anchor="middle" fill="#667085" font-size="12">Trading sessions (ET; non-market days omitted)</text>
  </svg><div class="chart-legend"><span class="legend-key" style="--key:#2fa236">Positive realized P&amp;L · left</span><span class="legend-key" style="--key:#dc2626">Negative realized P&amp;L · left</span><span class="legend-key" style="--key:#333ed4">Cumulative settled net P&amp;L · right</span><span class="legend-key" style="--key:#7c3aed">Expected P&amp;L (dashed) · settled trades · right</span><span class="legend-key" style="--key:#707780">Total P&amp;L including unrealized · intraday · right</span></div>`;
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
  const expiryBackgrounds = positions.map((row,index) => expiresToday(row.expiration_date)
    ? `<rect x="0" y="${pad.t+index*rowHeight}" width="${width}" height="${rowHeight}" class="outcome-expiring-today"/>` : "").join("");
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
    ${expiryBackgrounds}
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
  rows = rows.filter(row => !["Terminal-payoff survivors", "Quadrature survivors"].includes(row.stage));
  const node = document.querySelector(target);
  if (!rows.length) {
    node.innerHTML = '<div class="chart-empty">No funnel observations are available for this period.</div>';
    return;
  }
  const stages = ["Candidates examined", "Terminal positive", "Path confirmed", "Eligible", "Entry orders submitted", "Entries filled", "Open positions"];
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
  const cellWidth = 122, cellHeight = 34;
  const pad = { l: 248, r: 18, t: 104, b: 26 };
  const width = pad.l + stages.length * cellWidth + pad.r;
  const height = pad.t + labels.length * cellHeight + pad.b;
  const maximum = Math.max(1, ...rows.map(row => Number(row.count) || 0));
  const cells = labels.flatMap((label, rowIndex) => stages.map((stage, columnIndex) => {
    const count = lookup.get([stage, label].join("||")) || 0;
    const intensity = count ? .14 + .86 * Math.log1p(count) / Math.log1p(maximum) : 0;
    const x = pad.l + columnIndex * cellWidth, y = pad.t + rowIndex * cellHeight;
    return `<rect x="${x}" y="${y}" width="${cellWidth-3}" height="${cellHeight-3}" rx="3" fill="#333ed4" style="fill-opacity:${intensity.toFixed(3)}"><title>${escapeText(stage)} · ${escapeText(label)}: ${number.format(count)}</title></rect>${count ? `<text x="${x+(cellWidth-3)/2}" y="${y+21}" text-anchor="middle" fill="${intensity > .56 ? "white" : "#172033"}" font-size="11" font-weight="700">${number.format(count)}</text>` : ""}`;
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

let selectedPercentilePeriod = "day";
function renderCandidatePercentiles(history) {
  const selected=history?.[selectedPercentilePeriod] || {rows:[]};
  table("#candidate-percentile-table", [
    ["DTE","dte"], ["Strategy","strategy",null,v=>String(v).replaceAll("_"," ")],
    ["Evaluation scope","evaluation_scope",null,v=>String(v || "EXECUTION_FINALIST").replaceAll("_"," ")],
    ["Observations","finalist_samples"], ["Return samples","return_samples"],
    ["P90 raw expected return","raw_return_p90",null,v=>value(v,percent)],
    ["P90 duration-adjusted return","duration_adjusted_return_p90",null,v=>value(v,percent)],
    ["P90 full-credit probability","full_credit_probability_p90",null,v=>value(v,percent)],
    ["Probability samples","probability_samples"], ["Reference samples","reference_probability_samples"],
    ["BS fallback samples","bs_probability_samples"],
  ], selected.rows || []);
  document.querySelectorAll("[data-percentile-period]").forEach(button=>{
    button.classList.toggle("is-active",button.dataset.percentilePeriod===selectedPercentilePeriod);
    button.onclick=()=>{selectedPercentilePeriod=button.dataset.percentilePeriod;renderCandidatePercentiles(history);};
  });
  document.querySelector("#candidate-percentile-window").textContent=selected.start_date ? `${selected.start_date} through ${selected.end_date} · ${selected.trading_days} trading day(s)` : "No persisted metrics available.";
}

let selectedFunnelPeriod = "day";
let selectedMarketOpportunitySnapshot = "__LATEST__";
const marketSnapshotTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
});
function marketSnapshotTimeLabel(snapshot) {
  const stamp = Date.parse(snapshot?.scan_bucket || snapshot?.observed_at_et || "");
  return Number.isFinite(stamp) ? marketSnapshotTimeFormatter.format(new Date(stamp)) : "Time unavailable";
}
function renderMarketOpportunities(data, snapshotHistory = []) {
  const snapshotsByBucket = new Map();
  [data, ...(Array.isArray(snapshotHistory) ? snapshotHistory : [])].forEach(snapshot => {
    if(snapshot?.scan_bucket && !snapshotsByBucket.has(snapshot.scan_bucket)) snapshotsByBucket.set(snapshot.scan_bucket, snapshot);
  });
  const snapshots = [...snapshotsByBucket.values()];
  const latest = data?.scan_bucket ? data : (snapshots[0] || null);
  if(selectedMarketOpportunitySnapshot !== "__LATEST__" && !snapshotsByBucket.has(selectedMarketOpportunitySnapshot)) {
    selectedMarketOpportunitySnapshot = "__LATEST__";
  }
  const market = selectedMarketOpportunitySnapshot === "__LATEST__"
    ? (latest || {rows:[]})
    : (snapshotsByBucket.get(selectedMarketOpportunitySnapshot) || {rows:[]});
  const controls = document.querySelector('#market-opportunity-snapshot-controls');
  if(controls) {
    const options = latest ? [
      {key:"__LATEST__", label:`Latest · ${marketSnapshotTimeLabel(latest)}`},
      ...snapshots.filter(snapshot => snapshot.scan_bucket !== latest.scan_bucket).map(snapshot => ({
        key:snapshot.scan_bucket, label:marketSnapshotTimeLabel(snapshot),
      })),
    ] : [];
    controls.hidden = !options.length;
    controls.innerHTML = options.map(option => `<button type="button" data-market-snapshot="${escapeText(option.key)}">${escapeText(option.label)}</button>`).join("");
    controls.querySelectorAll("[data-market-snapshot]").forEach(button => {
      const active = button.dataset.marketSnapshot === selectedMarketOpportunitySnapshot;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
      button.onclick = () => {
        selectedMarketOpportunitySnapshot = button.dataset.marketSnapshot;
        renderMarketOpportunities(data, snapshotHistory);
      };
    });
  }
  const marketTable = document.querySelector('#market-opportunities-table');
  if(marketTable) table('#market-opportunities-table', [
    ['Market rank','market_rank'],['Strategy','strategy'],['DTE','target_dte'],['Expiration','expiration'],
    ['Expected net P&L','base_edge_dollars',null,v=>value(v,money)],
    ['Raw return','base_edge_return_on_planned_loss',null,v=>value(v,percent)],
    ['Duration-adjusted return','duration_adjusted_base_edge_return_on_planned_loss',null,v=>value(v,percent)],
    ['Full-credit probability','reference_full_credit_probability',null,v=>value(v,percent)],
    ['Q−P','q_minus_p_probability_wedge',null,v=>value(v,percent)],
    ['Required reserve','capital_reserve',null,v=>value(v,money)],
    ['Entry hurdle','required_base_edge_return_on_planned_loss',null,v=>value(v,percent)],
    ['Entry status','entry_status'],['Entry blockers','entry_blocking_reasons',null,v=>(v||[]).join(', ')],
  ], market.rows || []);
  const marketNote = document.querySelector('#market-opportunities-note');
  if(marketNote) marketNote.textContent = market.scan_bucket
    ? `Scan ${market.scan_bucket} · recorded ${market.observed_at_et}. ${(market.rows || []).length ? 'Market rank is independent of account capacity; entry status is a scan-time assessment, not an order approval.' : 'No independent market opportunities were saved for this scan.'}`
    : 'Awaiting the first independent market-opportunity scan; historical finalists are not relabeled.';
}

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
  button.disabled = refreshInFlight;
  button.textContent = refreshInFlight ? "Refreshing…" : "Refresh P&L";
}

async function load() {
  const retrieved = await retrieveSnapshot();
  const data = retrieved.data;
  const publicationAt=Date.parse(data.publication?.published_at_et || '');
  if(!Number.isFinite(publicationAt))throw new Error('Snapshot publication timestamp is invalid');
  if(publicationAt<lastRenderedPublicationAt)return lastRenderedPublicationAt;

  const pub = data.publication, daily = data.daily, ledger = data.ledger, funnel = daily.funnel, summary = ledger.summary;
  renderDistributionComparison(data.distribution_comparison);
  renderCandidatePercentiles(data.daily.candidate_percentiles);
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
  document.querySelector("#feed-status").textContent = `Source: ${retrieved.source} · refreshes automatically every five minutes after a 90-second publication allowance`;
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
  const recoveredAlerts = (tradingStatus.alerts || []).filter(row => row.state === "RESOLVED" && row.recovery_confirmed === true);
  const informationalAlerts = (tradingStatus.alerts || []).filter(row => row.state === "RESOLVED" && row.recovery_confirmed !== true);
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
    ["Daily P&L", value(pnlSummary.daily_ledger_pnl, money), pnlClass(pnlSummary.daily_ledger_pnl)],
    ["Unrealized P&L", value(pnlSummary.unrealized_pnl, money), pnlClass(pnlSummary.unrealized_pnl)],
    ["Realized P&L on exits", value(exitActivity.realized_pnl, money), pnlClass(exitActivity.realized_pnl)],
  ]);
  const baselineNote = document.querySelector("#ledger-baseline-note");
  if (baselineNote) baselineNote.textContent = pnlSummary.daily_ledger_pnl == null
    ? "Daily P&L unavailable: prior-session closing equity is incomplete."
    : "Daily P&L is current ledger equity minus prior-session closing equity. Open-position marks include estimated entry/closing fees and exclude modeled slippage.";
  if (baselineNote && pnlSummary.accounting_basis_adjustment) baselineNote.textContent += ` Accounting-basis adjustment: ${money.format(pnlSummary.accounting_basis_adjustment)}; this removes modeled slippage and is not trading profit.`;
  summaryMetrics("#evaluation-metrics", [
    ["Candidates examined", value(funnel.candidates_examined)], ["Terminal positive", value(funnel.terminal_positive_candidates)],
    ["Path confirmed", value(funnel.path_confirmed_candidates)],
    ["Eligible", value(funnel.eligible_candidates)], ["Entry orders submitted", value(funnel.orders_submitted)],
    ["Entries filled", value(funnel.trades_filled)], ["Open positions", value(funnel.trades_open)],
    ["Entry fill slippage", value(daily.entry_activity?.entry_slippage, money), slippageClass(daily.entry_activity?.entry_slippage)],
  ]);
  const entrySlippageNote = document.querySelector("#entry-slippage-note");
  if (entrySlippageNote) entrySlippageNote.textContent = `Entry fill slippage: requested credit minus filled credit, in dollars. Positive is worse; negative is price improvement. Measured for ${daily.entry_activity?.measured_trades ?? 0} of ${daily.entry_activity?.filled_trades ?? 0} filled trades today.`;
  renderFunnelHistory(daily.funnel_history || {});
  renderMarketOpportunities(daily.market_opportunities, daily.market_opportunity_snapshots);
  summaryMetrics("#exit-metrics", [
    ["Exits filled today", value(exitActivity.exits_filled)],
    ["Transaction costs on exits", value(exitActivity.transaction_costs, money)],
    ["Capital released by exits", value(exitActivity.released_capital, money)],
  ]);
  deployedCapacityChart(ledger.deployed_capacity_history || []);
  metrics("#capacity-metrics", [
    ["Reserved capacity", value(ledger.capacity.total_position_reserve ?? ledger.capacity.aggregate_reserved_capacity ?? summary.reserved_risk, money), capacityClass(ledger.capacity.total_position_reserve ?? ledger.capacity.aggregate_reserved_capacity ?? summary.reserved_risk)],
    ["Total put reserve", value(ledger.capacity.total_put_reserve, money), capacityClass(ledger.capacity.total_put_reserve)],
    ["Total call reserve", value(ledger.capacity.total_call_reserve, money), capacityClass(ledger.capacity.total_call_reserve)],
    ["Lowest nearby-interval headroom", value(ledger.capacity.nearby_interval_headroom, money), capacityClass(ledger.capacity.nearby_interval_headroom)],
    ["Capacity reserved today", value(ledger.capacity.capacity_reserved_today, money), capacityClass(ledger.capacity.capacity_reserved_today)],
    ["Total capacity available", value(ledger.capacity.aggregate_available_capacity, money), capacityClass(ledger.capacity.aggregate_available_capacity)],
    ["Available new-entry capacity now", value(ledger.capacity.daily_new_capacity_available ?? ledger.capacity.available_capacity, money), capacityClass(ledger.capacity.daily_new_capacity_available ?? ledger.capacity.available_capacity)],
    ["Effective capacity unlocked", value(ledger.capacity.timed_capacity_released, money), capacityClass(ledger.capacity.timed_capacity_released)],
    ["Carried from prior window (25%)", value(ledger.capacity.timed_capacity_carried_forward, money), capacityClass(ledger.capacity.timed_capacity_carried_forward)],
    ["Unused capacity forfeited today", value(ledger.capacity.timed_capacity_forfeited, money), capacityClass(ledger.capacity.timed_capacity_forfeited)],
    ["Long-dated (4+ DTE) capacity available", value(ledger.capacity.long_dated_available_capacity ?? ledger.capacity.seven_dte_available_capacity, money), capacityClass(ledger.capacity.long_dated_available_capacity ?? ledger.capacity.seven_dte_available_capacity)],
  ]);
  const positionSeries = [...(daily.position_pnl || [])].sort((a,b) => {
    const dateKey = item => /^\d{4}-\d{2}-\d{2}$/.test(item.exit_date_group || "") ? item.exit_date_group : "9999-99-99";
    return dateKey(a).localeCompare(dateKey(b));
  }).map(item => ({
    rows: item.points, x: "time_et", y: "net_pnl", label: `${item.position} · expiry ${item.exit_date_group || "unknown"}`,
    legendLabel: `Expiry ${item.exit_date_group || "unknown"}`,
    color: item.exit_date_color || "#8b939f", width: 2, dashCarriedForward: true,
  }));
  const positionMarkers = (daily.position_pnl || []).flatMap(item => item.points
    .filter(point => point.event === "Entry" || point.event === "Exit")
    .map(point => ({ ...point, position: item.position })));
  lineChart("#daily-chart", [
    ...positionSeries,
    { rows: daily.portfolio_pnl, x: "time_et", y: "net_pnl", label: "TOTAL", color: "rgba(24,24,27,0.5)", width: 4 },
    {
      rows: daily.spx_history || [], x: "time_et", y: "spx", label: "SPX",
      color: "#aeb4bd", width: 2.5, dash: "7 5", axis: "right", shadeRelativeToFirst: true,
      aboveColor: "#2fa236", belowColor: "#fd0100",
    },
  ], {
    money: true, height: 465, includeZero: true, leftTickStep: 250, rightTickStep: 25,
    label: "Daily position and portfolio P&L with SPX", markers: positionMarkers,
    carriedForwardLegend: true, estimatedMarkLegend: true,
  });
  const dailyChartNode=document.querySelector("#daily-chart");
  if(dailyChartNode && (daily.carried_forward_mark_count||daily.stale_mark_count)>0){
    const warning=document.createElement("p");warning.className="chart-note";
    const count=daily.carried_forward_mark_count||daily.stale_mark_count;
    warning.textContent=`Long-dashed segments and TOTAL retain the last accounting mark during quote gaps for ${count} position(s). Dotted segments use bounded zero-bid midpoint estimates when fresh asks and current SPX support them.`;
    dailyChartNode.appendChild(warning);
  }
  if(dailyChartNode && daily.estimated_mark_count>0 && !(daily.carried_forward_mark_count||daily.stale_mark_count)){
    const note=document.createElement("p");note.className="chart-note";
    note.textContent=`Dotted segments use bounded zero-bid midpoint estimates for ${daily.estimated_mark_count} position(s); these are fair-value estimates, not executable closing quotes.`;
    dailyChartNode.appendChild(note);
  }
  table("#trade-table", [
    ["Pos.", "position", null, null, "Position"], ["Type", "record_type", null, compactRecordType, "Record type"], ["Strat.", "strategy", null, compactStrategy, "Strategy: IC = iron condor; BPS = bull-put spread; BCS = bear-call spread"], ["DTE", "dte", null, null, "Entry DTE"],
    ["Status", "status", null, compactStatus],
    ["SPX zone", "spx_position_zone", null, positionZoneBadge, "Current SPX location"],
    ["SPX map", "spx_position_zone", null, positionMap, "Position map"],
    ["Entry", "entry_time_et", null, shortTime, "Entry time (ET)"],
    ["Expiry", "expiration_date", null, shortDate],
    ["Exp. return", "modeled_expected_return", null, v => value(v, percent), "Modeled expected return"],
    ["Full-credit P", "probability_of_full_credit", null, fullCreditProbability, "Probability of full credit"],
    ["Q−P (pp)", "entry_q_minus_p", null, v => v === null || v === undefined ? "—" : `${Number(v) >= 0 ? "+" : ""}${(Number(v) * 100).toFixed(2)} pp`],
    ["Reserve", "total_short_reserve", null, v => value(v, money), "Total reserve"],
    ["Call res.", "short_call_reserve", null, v => value(v, money), "Short-call reserve"],
    ["Put res.", "short_put_reserve", null, v => value(v, money), "Short-put reserve"], ["Max profit", "maximum_profit", pnlClass, v => value(v, money), "Maximum profit"], ["Base EV", "base_expected_net_pnl", pnlClass, v => value(v, money), "Base expected net P&L"],
    ["uPnL", "unrealized_net_pnl", pnlClass, v => value(v, money), "Unrealized P&L"], ["Realized", "realized_net_pnl", pnlClass, v => value(v, money)],
    ["Max uPnL", "maximum_unrealized_pnl", pnlClass, v => value(v, money), "Maximum unrealized P&L"], ["Min uPnL", "minimum_unrealized_pnl", pnlClass, v => value(v, money), "Minimum unrealized P&L"],
    ["Exit", "exit_time_et", null, shortTime, "Exit time (ET)"],
    ["Reason", "exit_reason", null, compactExitReason, "Exit reason"],
  ], daily.trades);
  positionOutcomeChart("#position-outcome-chart", daily.trades);
  renderSettlementScenarioHorizons(
    daily.settlement_scenario_horizons || [
      daily.settlement_scenarios,
      daily.settlement_scenarios_next_session,
    ],
    daily.settlement_scenario_horizons_after_midnight || [],
    daily.settlement_scenario_roll_forward_at_et,
    daily.settlement_scenario_history
  );
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
  portfolioDailyChart("#portfolio-chart", ledger.portfolio_daily || [], [], ledger.portfolio_pnl || []);
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
    ["Settled trades", value(perf.settled_trades)], ["Trading days", value(perf.trading_days)], ["Total net P&L ($)", value(perf.total_net_pnl, money), pnlClass(perf.total_net_pnl)], ["Net return on deployed capital", value(perf.net_return_on_deployed_capital, percent), pnlClass(perf.net_return_on_deployed_capital)],
    ["Expectancy / trade", value(perf.expectancy_return_per_trade, percent), pnlClass(perf.expectancy_return_per_trade)], ["Win rate", value(perf.trade_win_rate, percent)], ["Full-credit (%)", value(perf.full_credit_rate, percent)], ["Max realized drawdown", value(perf.maximum_realized_drawdown, money)], ["Max daily-close drawdown", value(perf.maximum_daily_drawdown, money)],
  ]);
  const fullCreditNote = document.querySelector('#full-credit-note');
  if(fullCreditNote) fullCreditNote.textContent = `Full credit: ${perf.full_credit_trades ?? '—'} of ${perf.settled_trades ?? '—'} settled trades retained the entire premium at expiration before fees. Known outcomes: ${perf.full_credit_samples ?? '—'}. Early closes count as not full credit; missing outcome data makes the percentage unavailable.`;
  const groups = [...perf.by_strategy.map(r => ({ dimension: "Strategy", group: r.strategy, ...r })), ...perf.by_dte.map(r => ({ dimension: "DTE", group: r.dte, ...r }))];
  table("#performance-table", [
    ["Dimension", "dimension"], ["Group", "group"], ["Trades", "trades"], ["Win rate", "win_rate", null, v => value(v, percent)],
    ["Total net ($)", "net_pnl", pnlClass, v => value(v, money)], ["Net return (%)", "net_return_on_deployed_capital", pnlClass, v => value(v, percent)], ["Expectancy / trade", "expectancy_return_per_trade", pnlClass, v => value(v, percent)],
  ], groups);
  lastRenderedPublicationAt=publicationAt;
  return publicationAt;
}

async function refresh({ manual = false } = {}) {
  if (refreshInFlight) return;
  refreshInFlight = true;
  updateRefreshButton();
  try {
    const publicationWait = manual ? 0 : publicationWindowDelay();
    if (publicationWait > 0) await new Promise(resolve => setTimeout(resolve, publicationWait));
    const expectedBoundary=Math.floor(Date.now()/autoRefreshIntervalMilliseconds)*autoRefreshIntervalMilliseconds;
    let publishedAt=await load();
    // A slow publisher may finish after the normal 90-second grace.
    // Retry only automatic refreshes; manual requests always fetch immediately.
    for(let retry=0; !manual && publishedAt<expectedBoundary && retry<3; retry++){
      await new Promise(resolve=>setTimeout(resolve,20000));
      publishedAt=await load();
    }
    lastSuccessfulRefreshAt = Date.now();
  } catch (error) {
    showLoadError(error, lastSuccessfulRefreshAt > 0);
  } finally {
    refreshInFlight = false;
    updateRefreshButton();
  }
}

function initializeThesisBanner() {
  const box = document.querySelector("#thesis-banner");
  const button = document.querySelector("#load-thesis-animation");
  const hint = document.querySelector("#thesis-animation-hint");
  if (!box || !button || !hint) return;
  button.addEventListener("click", () => {
    if (button.disabled) return;
    button.disabled = true;
    box.setAttribute("aria-busy", "true");
    hint.textContent = "Loading animation…";
    // Create and request the image only after explicit mouse/keyboard activation.
    const image = document.createElement("img");
    image.className = "thesis-banner-image";
    image.width = 2000;
    image.height = 400;
    image.alt = "Animated steamroller and a person collecting coins along a road.";
    image.decoding = "async";
    image.onload = () => {
      box.setAttribute("aria-busy", "false");
      box.replaceChildren(image);
    };
    image.onerror = () => {
      box.setAttribute("aria-busy", "false");
      button.disabled = false;
      hint.textContent = "Animation could not load. Click to try again.";
    };
    image.src = button.dataset.bannerSrc;
  });
}

initializeThesisBanner();

document.querySelector("#refresh-feed").addEventListener("click", () => {
  refresh({ manual: true });
});
scheduleAutomaticRefresh();
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
