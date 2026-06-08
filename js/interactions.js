// ============================================================
// interactions.js
// Interactions souris : selection, deplacement, redimensionnement (poignees), trace des zones et allees, hitTest, setTool.
// ============================================================

// ════════════════════════════════════════════════════════════
// MOUSE / TOUCH
// ════════════════════════════════════════════════════════════
// Convertit un évènement souris / un point tactile en {ox,oy,clientX,clientY} relatif au canvas.
function ptFromMouse(e){return{ox:e.offsetX,oy:e.offsetY,clientX:e.clientX,clientY:e.clientY};}
function ptFromTouch(t){const r=cv.getBoundingClientRect();return{ox:t.clientX-r.left,oy:t.clientY-r.top,clientX:t.clientX,clientY:t.clientY};}

function pointerMove(p){
  mousePos={x:p.ox,y:p.oy};
  const wp=s2w(p.ox,p.oy);

  if(S.tool==='place'&&S.pending){
    if(S.pending.type==='alley'&&drawPath){
      const last=drawPath.points[drawPath.points.length-1];
      if(!last||Math.hypot(wp.x-last.x,wp.y-last.y)>0.25){drawPath.points.push({x:Math.max(0,wp.x),y:Math.max(0,wp.y)});}
      draw();drawPathPreview();
      return;
    }
    const isRect=RECT_TYPES.includes(S.pending.type);
    if(isRect&&drawZone){
      drawZone.x2=wp.x; drawZone.y2=wp.y;
      draw(); drawZonePreview();
      return;
    }
    // Ghost follows cursor
    draw();
    if(S.pending.type!=='alley'){
      ctx.globalAlpha=.55;
      const ghost={...S.pending,id:-999,x:wp.x-(S.pending.w||S.pending.spread||0)/2,y:wp.y-(S.pending.d||S.pending.spread||0)/2};
      drawEl(ghost);
      ctx.globalAlpha=1;
    }
    return;
  }

  if(resizeEl&&resizeData){
    const {u,v,sx,sy,anchor}=resizeData;
    const APx=wp.x-anchor.x, APy=wp.y-anchor.y;
    let nw=(APx*u.x+APy*u.y)*sx;
    let nd=(APx*v.x+APy*v.y)*sy;
    nw=Math.max(0.5,nw); nd=Math.max(0.5,nd);
    if(S.snap){nw=Math.max(0.5,Math.round(nw));nd=Math.max(0.5,Math.round(nd));}
    const cx=anchor.x+u.x*sx*nw/2+v.x*sy*nd/2;
    const cy=anchor.y+u.y*sx*nw/2+v.y*sy*nd/2;
    resizeEl.w=+nw.toFixed(2); resizeEl.d=+nd.toFixed(2);
    resizeEl.x=cx-nw/2; resizeEl.y=cy-nd/2;
    draw();return;
  }

  if(dragEl&&dragElStart){
    let dx=wp.x-dragElStart.wx, dy=wp.y-dragElStart.wy;
    if(dragEl.path){
      dragEl.path=dragElStart.origPath.map(pt=>({x:Math.max(0,pt.x+dx),y:Math.max(0,pt.y+dy)}));
    } else if(dragEl.poly&&dragElStart.origPoly){
      dragEl.poly=dragElStart.origPoly.map(pt=>({x:pt.x+dx,y:pt.y+dy}));
      const bb=polyBBox(dragEl.poly);dragEl.x=bb.minx;dragEl.y=bb.miny;
    } else {
      dragEl.x=Math.max(0,snap(dragElStart.ex+dx));
      dragEl.y=Math.max(0,snap(dragElStart.ey+dy));
    }
    draw();return;
  }
  if(dragging&&dragStart){
    CAM.x=dragStart.cx+(p.clientX-dragStart.mx);
    CAM.y=dragStart.cy+(p.clientY-dragStart.my);
    draw();
  }
  // Tooltip
  const hit=hitTest(wp);
  const tt=document.getElementById('tooltip');
  if(hit&&S.step===ST.FINAL){
    let cx,cy;
    if(hit.type==='tree'){cx=hit.x;cy=hit.y;}
    else if(hit.path){cx=hit.path[0].x;cy=hit.path[0].y;}
    else{cx=hit.x+hit.w/2;cy=hit.y+hit.d/2;}
    const {x,y}=w2s(cx,cy);
    tt.style.display='block';
    tt.style.left=(x+10)+'px';tt.style.top=(y-30)+'px';
    tt.textContent=hit.name+(hit.type==='tree'?` — H:${hit.h}m ⌀${(hit.spread*2).toFixed(1)}m`:hit.path?' (allée)':(hit.w&&hit.d?` — ${hit.w}×${hit.d}m`:''));
  } else { tt.style.display='none'; }
}
cv.addEventListener('mousemove',e=>{ if(rotating){doRotate(e);return;} pointerMove(ptFromMouse(e)); });

function getRectCorners(el){
  const cx=el.x+el.w/2, cy=el.y+el.d/2, rot=el.rot||0;
  const c=Math.cos(rot), s=Math.sin(rot);
  const u={x:c,y:s}, v={x:-s,y:c};
  const signs=[[-1,-1],[1,-1],[1,1],[-1,1]];
  return signs.map(([sx,sy])=>({x:cx+u.x*sx*el.w/2+v.x*sy*el.d/2, y:cy+u.y*sx*el.w/2+v.y*sy*el.d/2,sx,sy,u,v}));
}
function handleHitTest(ox,oy){
  const el=S.elements.find(e=>e.id===S.selected);
  if(!el||el.fill||el.type==='tree'||el.path||el.poly) return null;
  const cs=getRectCorners(el);
  for(let i=0;i<4;i++){const sp=w2s(cs[i].x,cs[i].y); if(Math.abs(ox-sp.x)<9&&Math.abs(oy-sp.y)<9) return {el,corner:cs[i]};}
  return null;
}

function pointerDown(p){
  const wp=s2w(p.ox,p.oy);

  // Placement mode
  if(S.tool==='place'&&S.pending){
    if(S.pending.type==='alley'){
      drawPath={width:S.pending.width||1,points:[{x:Math.max(0,wp.x),y:Math.max(0,wp.y)}]};
      return;
    }
    if(RECT_TYPES.includes(S.pending.type)){drawZone={x1:wp.x,y1:wp.y,x2:wp.x,y2:wp.y};return;}
    placeElement(wp);return;
  }
  if(S.tool==='delete'){
    const hit=hitTest(wp);
    if(hit){S.elements=S.elements.filter(el=>el.id!==hit.id);S.selected=null;draw();updateStats();renderPanel();}
    return;
  }

  // Resize handle of selected element?
  const hh=handleHitTest(p.ox,p.oy);
  if(hh){
    const el=hh.el, ci=hh.corner;
    const anchor={x:el.x+el.w/2 - ci.u.x*ci.sx*el.w/2 - ci.v.x*ci.sy*el.d/2,
                  y:el.y+el.d/2 - ci.u.y*ci.sx*el.w/2 - ci.v.y*ci.sy*el.d/2};
    resizeEl=el;resizeData={u:ci.u,v:ci.v,sx:ci.sx,sy:ci.sy,anchor};
    return;
  }

  // Select / drag element, else pan
  const hit=hitTest(wp);
  if(hit){
    S.selected=hit.id===S.selected?null:hit.id;
    dragEl=hit.fill?null:hit;   // le gazon de fond se sélectionne mais ne se déplace pas
    dragElStart={ex:hit.x,ey:hit.y,wx:wp.x,wy:wp.y,
      origPath:hit.path?hit.path.map(pt=>({...pt})):null,
      origPoly:hit.poly?hit.poly.map(pt=>({...pt})):null};
  } else {
    S.selected=null;
    dragging=true;dragStart={mx:p.clientX,my:p.clientY,cx:CAM.x,cy:CAM.y};
  }
  draw();renderPanel();
}

// — Rotation du plan 2D au bouton du milieu (orientation N/S/E/O) —
let rotating=false, rotStart=null;
function pivotScreen(){return w2s(CAM.pivot.x,CAM.pivot.y);}
function startRotate(e){
  rotating=true;
  const ps=pivotScreen();
  rotStart={ang:Math.atan2(e.offsetY-ps.y,e.offsetX-ps.x),rot:CAM.rot};
}
function doRotate(e){
  const ps=pivotScreen();
  const ang=Math.atan2(e.offsetY-ps.y,e.offsetX-ps.x);
  CAM.rot=rotStart.rot+(ang-rotStart.ang);
  draw();
}
function resetNorth(){CAM.rot=0;draw();toast((S.garden.north?'Plan aligné sur le terrain':'Nord en haut ⬆'));}

cv.addEventListener('mousedown',e=>{
  if(e.button===1){ e.preventDefault(); startRotate(e); return; }   // molette enfoncée → pivoter le plan
  pointerDown(ptFromMouse(e));
});
window.addEventListener('mouseup',()=>{ if(rotating)rotating=false; });

function pointerUp(p){
  if(resizeEl){resizeEl=null;resizeData=null;updateStats();renderPanel();autosave();dragging=false;dragEl=null;dragElStart=null;return;}
  if(drawPath&&S.pending){
    if(drawPath.points.length>=2){
      S.elements.push({id:S.nextId++,type:'alley',name:'Allée',path:drawPath.points,width:drawPath.width,h:0.08});
      toast('Allée tracée ! ✓');
    }
    drawPath=null;S.pending=null;setTool('move');
    draw();updateStats();renderPanel();autosave();
  } else if(drawZone&&S.pending){
    let x=Math.max(0,Math.min(drawZone.x1,drawZone.x2));
    let y=Math.max(0,Math.min(drawZone.y1,drawZone.y2));
    let w=Math.abs(drawZone.x2-drawZone.x1);
    let d=Math.abs(drawZone.y2-drawZone.y1);
    if(w<0.3||d<0.3){
      const defW={house:8,terrace:4,lawn:6,hedge:4};
      const defD={house:6,terrace:3,lawn:5,hedge:0.6};
      w=S.pending.w||defW[S.pending.type]||4;
      d=S.pending.d||defD[S.pending.type]||4;
      const wp=p?s2w(p.ox,p.oy):{x:S.garden.w/2,y:S.garden.h/2};
      x=Math.max(0,snap(wp.x-w/2));y=Math.max(0,snap(wp.y-d/2));
      S.elements.push({...S.pending,id:S.nextId++,w,d,x,y});
    } else {
      if(S.snap){x=Math.round(x);y=Math.round(y);w=Math.max(0.5,Math.round(w));d=Math.max(0.5,Math.round(d));}
      S.elements.push({...S.pending,id:S.nextId++,x,y,w:+w.toFixed(1),d:+d.toFixed(1)});
    }
    drawZone=null;S.pending=null;setTool('move');
    toast('Zone tracée ! ✓');
    draw();updateStats();renderPanel();autosave();
  }
  dragging=false;
  if(dragEl){autosave();}
  dragEl=null;dragElStart=null;
}
cv.addEventListener('mouseup',e=>{ if(e.button===1)return; pointerUp(ptFromMouse(e)); });

// Zoom centré sur un point écran (molette + pincement) — compatible rotation du plan
function zoomAt(ox,oy,factor){
  const rx=(ox-CAM.x)/CAM.scale, ry=(oy-CAM.y)/CAM.scale;  // coord. "monde tournée" sous le curseur
  CAM.scale=Math.max(3,Math.min(120,CAM.scale*factor));
  CAM.x=ox-rx*CAM.scale;
  CAM.y=oy-ry*CAM.scale;
  draw();
}
cv.addEventListener('wheel',e=>{
  e.preventDefault();
  zoomAt(e.offsetX,e.offsetY,e.deltaY>0?.88:1.14);
},{passive:false});

// ── Tactile (mobile / tablette) ──
// 1 doigt = comme la souris (sélection / déplacement / pan / tracé).
// 2 doigts = manipulation du plan facon carte : pincer pour zoomer ET pivoter
//            (rotation des 2 doigts = équivalent du bouton du milieu), point médian ancré.
let gesture=null,lastTouchPt=null;
function twoFingerState(e){
  const a=ptFromTouch(e.touches[0]),b=ptFromTouch(e.touches[1]);
  return {dist:Math.hypot(a.ox-b.ox,a.oy-b.oy), ang:Math.atan2(b.oy-a.oy,b.ox-a.ox), mx:(a.ox+b.ox)/2, my:(a.oy+b.oy)/2};
}
cv.addEventListener('touchstart',e=>{
  if(e.touches.length===2){
    // démarrage 2 doigts : on annule toute interaction à un doigt
    dragging=false;dragEl=null;dragElStart=null;resizeEl=null;resizeData=null;drawZone=null;drawPath=null;
    gesture=twoFingerState(e);
  } else if(e.touches.length===1){
    gesture=null;lastTouchPt=ptFromTouch(e.touches[0]);
    pointerDown(lastTouchPt);
  }
  e.preventDefault();
},{passive:false});
cv.addEventListener('touchmove',e=>{
  if(gesture&&e.touches.length===2){
    const g=twoFingerState(e);
    // point monde sous le médian AVANT transformation (pour l'ancrer)
    const W=s2w(g.mx,g.my);
    if(gesture.dist>0) CAM.scale=Math.max(3,Math.min(120,CAM.scale*(g.dist/gesture.dist)));
    CAM.rot+=(g.ang-gesture.ang);                 // rotation des 2 doigts → orientation du plan
    // garder le point médian fixe sous les doigts
    const c=Math.cos(CAM.rot), s=Math.sin(CAM.rot);
    const rwx=CAM.pivot.x+(W.x-CAM.pivot.x)*c-(W.y-CAM.pivot.y)*s;
    const rwy=CAM.pivot.y+(W.x-CAM.pivot.x)*s+(W.y-CAM.pivot.y)*c;
    CAM.x=g.mx-CAM.scale*rwx; CAM.y=g.my-CAM.scale*rwy;
    draw();
    gesture=g;
  } else if(e.touches.length===1){
    lastTouchPt=ptFromTouch(e.touches[0]);
    pointerMove(lastTouchPt);
  }
  e.preventDefault();
},{passive:false});
cv.addEventListener('touchend',e=>{
  if(gesture&&e.touches.length<2)gesture=null;
  if(e.touches.length===0){
    pointerUp(lastTouchPt);
    lastTouchPt=null;
    document.getElementById('tooltip').style.display='none';
  }
  e.preventDefault();
},{passive:false});

function distToSeg(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const l2=dx*dx+dy*dy;
  if(l2===0)return Math.hypot(p.x-a.x,p.y-a.y);
  let t=((p.x-a.x)*dx+(p.y-a.y)*dy)/l2;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));
}

function hitTest(wp){
  for(let i=S.elements.length-1;i>=0;i--){
    const el=S.elements[i];
    if(el.type==='tree'){const r=el.spread/2;if(Math.hypot(wp.x-el.x,wp.y-el.y)<r)return el;}
    else if(el.path){
      const half=(el.width||1)/2+0.3;
      for(let j=0;j<el.path.length-1;j++) if(distToSeg(wp,el.path[j],el.path[j+1])<half) return el;
    }
    else if(el.poly){           // bâtiment à contour OU gazon polygonal
      if(pointInPoly(wp,el.poly)) return el;
    }
    else {
      const cx=el.x+el.w/2, cy=el.y+el.d/2;
      const lp=unrotate(wp.x,wp.y,cx,cy,el.rot||0);
      if(lp.x>=el.x&&lp.x<=el.x+el.w&&lp.y>=el.y&&lp.y<=el.y+el.d)return el;
    }
  }
  return null;
}

function drawAlleyPath(el,sel){
  if(el.path.length<2)return;
  ctx.save();
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#a09080';
  ctx.lineWidth=Math.max(2,(el.width||1)*CAM.scale);
  ctx.beginPath();
  const s0=w2s(el.path[0].x,el.path[0].y);ctx.moveTo(s0.x,s0.y);
  for(let i=1;i<el.path.length;i++){const s=w2s(el.path[i].x,el.path[i].y);ctx.lineTo(s.x,s.y);}
  ctx.stroke();
  // center dashed line
  ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1;ctx.setLineDash([4,5]);
  ctx.stroke();ctx.setLineDash([]);
  if(sel){
    ctx.strokeStyle='#e8c870';ctx.lineWidth=Math.max(2,(el.width||1)*CAM.scale)+3;
    ctx.globalAlpha=.4;ctx.beginPath();
    ctx.moveTo(s0.x,s0.y);
    for(let i=1;i<el.path.length;i++){const s=w2s(el.path[i].x,el.path[i].y);ctx.lineTo(s.x,s.y);}
    ctx.stroke();ctx.globalAlpha=1;
  }
  ctx.restore();
}

function drawPathPreview(){
  if(!drawPath||drawPath.points.length<1)return;
  ctx.save();
  ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#a09080';ctx.globalAlpha=.6;
  ctx.lineWidth=Math.max(2,drawPath.width*CAM.scale);
  ctx.beginPath();
  const s0=w2s(drawPath.points[0].x,drawPath.points[0].y);ctx.moveTo(s0.x,s0.y);
  for(let i=1;i<drawPath.points.length;i++){const s=w2s(drawPath.points[i].x,drawPath.points[i].y);ctx.lineTo(s.x,s.y);}
  ctx.stroke();ctx.globalAlpha=1;
  ctx.restore();
}

function drawZonePreview(){
  if(!drawZone)return;
  const x1=Math.min(drawZone.x1,drawZone.x2), y1=Math.min(drawZone.y1,drawZone.y2);
  const x2=Math.max(drawZone.x1,drawZone.x2), y2=Math.max(drawZone.y1,drawZone.y2);
  const colors={house:'#b09070',terrace:'#c8a870',alley:'#a09080',lawn:'#3a7a35',hedge:'#1e4a1e'};
  // 4 coins en monde → écran (quad correct même si le plan est tourné)
  const c=[w2s(x1,y1),w2s(x2,y1),w2s(x2,y2),w2s(x1,y2)];
  ctx.save();
  ctx.beginPath();ctx.moveTo(c[0].x,c[0].y);for(let i=1;i<4;i++)ctx.lineTo(c[i].x,c[i].y);ctx.closePath();
  ctx.globalAlpha=.45;ctx.fillStyle=colors[S.pending.type]||'#888';ctx.fill();
  ctx.globalAlpha=1;ctx.strokeStyle='#e8c870';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
  // Étiquettes de dimensions au milieu des côtés
  const wm=(x2-x1).toFixed(1), dm=(y2-y1).toFixed(1);
  const top={x:(c[0].x+c[1].x)/2,y:(c[0].y+c[1].y)/2};
  const left={x:(c[0].x+c[3].x)/2,y:(c[0].y+c[3].y)/2};
  ctx.fillStyle='#e8c870';ctx.font='600 12px Outfit';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(wm+'m',top.x,top.y-10);
  ctx.fillText(dm+'m',left.x-10,left.y);
  ctx.restore();
}

function placeElement(wp){
  const el={...S.pending,id:S.nextId++};
  if(el.type==='tree'){el.x=snap(wp.x);el.y=snap(wp.y);}
  else{el.x=Math.max(0,snap(wp.x-el.w/2));el.y=Math.max(0,snap(wp.y-el.d/2));}
  S.elements.push(el);
  S.pending=null;
  setTool('move');
  toast('Placé ! ✓');
  draw();updateStats();renderPanel();autosave();
}

function setTool(t){
  S.tool=t;
  ['move','place','delete'].forEach(n=>{
    const b=document.getElementById('tb'+n.charAt(0).toUpperCase()+n.slice(1));
    if(b)b.classList.toggle('active',n===t);
  });
  const hint=document.getElementById('placeHint');
  hint.style.display=t==='place'?'block':'none';
  if(t==='place'&&S.pending){
    hint.textContent=S.pending.type==='alley'
      ?'✏ Maintenez le clic et tracez le chemin de l\'allée'
      :RECT_TYPES.includes(S.pending.type)
      ?'✏ Cliquez-glissez pour tracer la zone (ou cliquez pour centrer)'
      :'Cliquez sur le plan pour placer l\'arbre';
  }
  if(t!=='place'){S.pending=null;drawZone=null;drawPath=null;}
  document.getElementById('tbPlace').style.display=S.pending?'inline-flex':'none';
}

