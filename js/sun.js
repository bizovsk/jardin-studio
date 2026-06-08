// ============================================================
// sun.js
// Controle d'ensoleillement de la vue realiste (position/couleur du soleil selon heure et mois).
// ============================================================

// ════════════════════════════════════════════════════════════
// SUN CONTROL (realistic 3D)
// ════════════════════════════════════════════════════════════
function setSun(){
  S.sun.hour=+document.getElementById('sunHour').value;
  S.sun.month=+document.getElementById('sunMonth').value;
  document.getElementById('sunHourVal').textContent=S.sun.hour+'h';
  document.getElementById('sunMonthVal').textContent=MONTHS[S.sun.month-1];
  applySun();
}
function applySun(){
  if(S.view!=='r3d'||!three.scene)return;
  const sun=three.scene.userData.sun;
  if(!sun)return;
  const t=(S.sun.hour-6)/14;                 // 0 at 6h → 1 at 20h
  const az=Math.PI*(1-t);                    // east→west
  const seasonAlt=0.6+0.4*Math.sin((S.sun.month-3)/12*Math.PI*2); // higher in summer
  const elev=Math.max(0.05,Math.sin(t*Math.PI))*0.9*seasonAlt+0.05;
  const dist=Math.max(S.garden.w,S.garden.h)*1.2;
  const cx=S.garden.w/2, cz=S.garden.h/2;
  sun.position.set(cx+Math.cos(az)*dist, dist*elev+5, cz+Math.sin(az)*dist*0.6 - S.garden.h*0.3);
  const warm=1-Math.sin(t*Math.PI);
  sun.color.setRGB(1,1-warm*0.25,1-warm*0.5);
  sun.intensity=1.4+Math.sin(t*Math.PI)*1.2;
  if(three.scene.background) three.scene.background.setRGB(0.53+warm*0.25,0.72-warm*0.15,0.88-warm*0.25);
}

// ════════════════════════════════════════════════════════════
