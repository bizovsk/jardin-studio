// ============================================================
// calendar.js
// Calendrier d'entretien : agregation des taches, decalage regional, estimation d'arrosage, export .ics.
// ============================================================

// ════════════════════════════════════════════════════════════
// CALENDAR
// ════════════════════════════════════════════════════════════
function openCalendar(){
  const overlay=document.getElementById('calOverlay');
  overlay.style.display='block';
  renderCalendar();
}
function closeCalendar(){document.getElementById('calOverlay').style.display='none';}

function shiftMonth(m,off){let r=((m-1+off)%12+12)%12;return r+1;}

function gatherTasks(){
  const off=REGIONS[S.region]||0;
  const tasks={};for(let m=1;m<=12;m++)tasks[m]=[];
  S.elements.forEach(el=>{
    let maint;
    if(el.type==='lawn') maint=MAINTENANCE.lawn;
    else if(el.type==='hedge') maint=HEDGE_DATA[el.name]||MAINTENANCE.hedge;
    else if(el.type==='tree') maint=MAINTENANCE[el.name]||MAINTENANCE.default;
    else return; // alley/terrace/house: no maintenance
    (maint.tasks||[]).forEach(t=>{
      t.months.forEach(m0=>{
        // shift only seasonal tasks (taille/plantation/traitement), arrosage stays
        const m=(t.type==='arrosage')?m0:shiftMonth(m0,off);
        const who=el.type==='hedge'?`Haie — ${el.name}`:(el.name||el.type);
        tasks[m].push({text:t.text,type:t.type,who});
      });
    });
  });
  // de-dupe per month
  for(let m=1;m<=12;m++){
    const seen=new Set(),out=[];
    tasks[m].forEach(t=>{const k=t.text+t.who;if(!seen.has(k)){seen.add(k);out.push(t);}});
    tasks[m]=out;
  }
  return tasks;
}

function waterEstimate(){
  // rough summer weekly water need
  const lawnArea=S.elements.filter(e=>e.type==='lawn').reduce((a,e)=>a+(e.w||0)*(e.d||0),0);
  const trees=S.elements.filter(e=>e.type==='tree').length;
  const hedgeLen=S.elements.filter(e=>e.type==='hedge').reduce((a,e)=>a+(e.w||0),0);
  const liters=Math.round(lawnArea*10 + trees*30 + hedgeLen*8); // L/week in summer
  return liters;
}

function renderCalendar(){
  const tasks=gatherTasks();
  const now=new Date().getMonth()+1;

  // This-month reminder
  let html='';
  const cur=tasks[now]||[];
  html+=`<div class="reminder-card"><div class="rc-title">📌 Ce mois-ci — ${MONTHS[now-1]}</div>`;
  if(cur.length===0) html+='<div style="font-size:12px;color:var(--ink3)">Rien d\'urgent ce mois-ci. Profitez de votre jardin !</div>';
  else html+=cur.map(t=>`<span class="cal-tag tag-${t.type}" style="display:inline-block;margin:2px 4px 2px 0">${t.text} — ${t.who}</span>`).join('');
  html+='</div>';

  // Controls: region + exports
  html+=`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:18px">
    <label style="font-size:12px;color:var(--ink3)">Région climatique :</label>
    <select onchange="S.region=this.value;renderCalendar();autosave()" style="background:white;border:1px solid var(--cream2);color:var(--ink);border-radius:6px;padding:6px 10px;font-size:12px;width:auto">
      ${Object.keys(REGIONS).map(r=>`<option${r===S.region?' selected':''}>${r}</option>`).join('')}
    </select>
    <button class="mini-btn" onclick="exportICS()" style="margin-left:auto">📆 Exporter agenda (.ics)</button>
    <button class="mini-btn" onclick="window.print()">🖨 Imprimer</button>
  </div>`;

  // Water estimate
  const water=waterEstimate();
  if(water>0) html+=`<div style="background:#e0eef8;border:1px solid #b8d4ee;border-radius:10px;padding:12px;margin-bottom:18px;font-size:13px;color:#235585">💧 Besoin d'arrosage estimé en été : <strong>~${water.toLocaleString('fr-FR')} L / semaine</strong> <span style="opacity:.7;font-size:11px">(estimation pour climat tempéré, hors pluie)</span></div>`;

  // Month grid
  html+='<div class="cal-grid">';
  MONTHS.forEach((mn,i)=>{
    const m=i+1,mt=tasks[m]||[];
    const isCur=now===m;
    html+=`<div class="cal-month" style="${isCur?'border:2px solid #c8a84b;':''}">`;
    html+=`<div class="cal-month-name" style="${isCur?'color:#c8a84b':''}">${mn}</div>`;
    if(mt.length===0){html+='<span class="cal-empty">—</span>';}
    else mt.forEach(t=>{html+=`<span class="cal-tag tag-${t.type}">${t.text}<br><small style="opacity:.7">${t.who}</small></span>`;});
    html+='</div>';
  });
  html+='</div>';

  html+=`<div class="cal-legend" style="margin-bottom:18px">
    <div class="leg-item"><div class="leg-dot" style="background:#4a8c3f"></div>Taille / Tonte</div>
    <div class="leg-item"><div class="leg-dot" style="background:#4a85c0"></div>Arrosage</div>
    <div class="leg-item"><div class="leg-dot" style="background:#c8951f"></div>Traitement</div>
    <div class="leg-item"><div class="leg-dot" style="background:#a845c8"></div>Plantation</div>
  </div>`;

  // Plant info cards
  const species=[...new Set(S.elements.filter(e=>e.type==='tree'||e.type==='hedge').map(e=>e.name))];
  if(species.length){
    html+='<h2 style="font-family:Cormorant Garamond,serif;font-size:24px;color:var(--ink);margin:8px 0 12px">Fiches plantes</h2>';
    species.forEach(sp=>{
      const tip=PLANT_INFO[sp]||'Entretien standard : taille adaptée à la saison et surveillance des maladies.';
      html+=`<div class="plant-card"><div class="pc-name">${sp}</div><div class="pc-tip">${tip}</div></div>`;
    });
  }

  document.getElementById('calContent').innerHTML=html;
}

function exportICS(){
  const tasks=gatherTasks();
  const yr=new Date().getFullYear();
  let ics='BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Jardin Studio//FR\r\nCALSCALE:GREGORIAN\r\n';
  for(let m=1;m<=12;m++){
    (tasks[m]||[]).forEach((t,idx)=>{
      const dt=`${yr}${String(m).padStart(2,'0')}05`;
      const dtend=`${yr}${String(m).padStart(2,'0')}06`;
      ics+='BEGIN:VEVENT\r\n';
      ics+=`UID:${yr}-${m}-${idx}-${Math.random().toString(36).slice(2)}@jardin\r\n`;
      ics+=`DTSTART;VALUE=DATE:${dt}\r\nDTEND;VALUE=DATE:${dtend}\r\n`;
      ics+=`SUMMARY:🌿 ${t.text} (${t.who})\r\n`;
      ics+='END:VEVENT\r\n';
    });
  }
  ics+='END:VCALENDAR';
  downloadFile('entretien-jardin.ics',ics,'text/calendar');
  toast('Agenda .ics exporté');
}

