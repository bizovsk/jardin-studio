// ============================================================
// canvas2d.js
// Rendu du plan 2D (canvas) : camera, draw(), drawEl(), arbres 2D, helpers snap/croissance/rotation.
// ============================================================

// ════════════════════════════════════════════════════════════
// CANVAS 2D
// ════════════════════════════════════════════════════════════
const cv = document.getElementById('c2d');
const ctx = cv.getContext('2d');
let CAM = {x:0,y:0,scale:30,rot:0,pivot:{x:0,y:0}}; // rot = orientation du plan (rad) ; pivot = centre de rotation (m)
let dragging=false,dragStart=null,dragEl=null,dragElStart=null;
let resizeEl=null,resizeData=null;
let drawZone=null;
let drawPath=null;
const RECT_TYPES=['house','terrace','lawn','hedge'];
let mousePos={x:0,y:0};

function resize(){
  const area=document.querySelector('.canvas-area');
  cv.width=area.clientWidth; cv.height=area.clientHeight;
  fitView(); draw();
}
window.addEventListener('resize',resize);

function fitView(){
  if(!S.garden.w||!S.garden.h) return;
  const area=document.querySelector('.canvas-area');
  const pad=80;
  CAM.scale=Math.min((area.clientWidth-pad*2)/S.garden.w,(area.clientHeight-pad*2)/S.garden.h,60);
  // pivot de rotation = centre du terrain ; on cadre ce centre au milieu de la zone (valable même tourné)
  CAM.pivot=gardenHasPoly()?polyCentroid(gardenPoly()):{x:S.garden.w/2,y:S.garden.h/2};
  CAM.x=area.clientWidth/2 - CAM.scale*CAM.pivot.x;
  CAM.y=area.clientHeight/2 - CAM.scale*CAM.pivot.y;
}

// Conversions monde↔écran, prenant en compte la rotation du plan autour de CAM.pivot.
function w2s(x,y){
  const c=Math.cos(CAM.rot), s=Math.sin(CAM.rot);
  const dx=x-CAM.pivot.x, dy=y-CAM.pivot.y;
  const wx=CAM.pivot.x + dx*c - dy*s;
  const wy=CAM.pivot.y + dx*s + dy*c;
  return {x:CAM.x+wx*CAM.scale, y:CAM.y+wy*CAM.scale};
}
function s2w(px,py){
  const c=Math.cos(CAM.rot), s=Math.sin(CAM.rot);
  const wx=(px-CAM.x)/CAM.scale, wy=(py-CAM.y)/CAM.scale;
  const dx=wx-CAM.pivot.x, dy=wy-CAM.pivot.y;
  return {x:CAM.pivot.x + dx*c + dy*s, y:CAM.pivot.y - dx*s + dy*c};
}

// ── Helpers terrain polygonal ──
// Le terrain est soit un rectangle (S.garden.w×h), soit un polygone (S.garden.poly).
function gardenHasPoly(){return !!(S.garden.poly&&S.garden.poly.length>=3);}
function gardenPoly(){
  if(gardenHasPoly())return S.garden.poly;
  const w=S.garden.w||0,h=S.garden.h||0;
  return [{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
}
function polyBBox(poly){
  let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
  poly.forEach(p=>{minx=Math.min(minx,p.x);miny=Math.min(miny,p.y);maxx=Math.max(maxx,p.x);maxy=Math.max(maxy,p.y);});
  return{minx,miny,maxx,maxy,w:maxx-minx,h:maxy-miny};
}
function polyArea(poly){
  let a=0;for(let i=0,j=poly.length-1;i<poly.length;j=i++)a+=(poly[j].x+poly[i].x)*(poly[j].y-poly[i].y);
  return Math.abs(a/2);
}
function polyCentroid(poly){
  let x=0,y=0,a=0;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const f=poly[j].x*poly[i].y-poly[i].x*poly[j].y;
    x+=(poly[j].x+poly[i].x)*f;y+=(poly[j].y+poly[i].y)*f;a+=f;
  }
  if(Math.abs(a)<1e-6){const bb=polyBBox(poly);return{x:(bb.minx+bb.maxx)/2,y:(bb.miny+bb.maxy)/2};}
  a*=0.5;return{x:x/(6*a),y:y/(6*a)};
}
// Orientation dominante d'un polygone (rad, dans (-π/4, π/4]) : moyenne circulaire des
// directions d'arêtes pondérée par leur longueur, modulo 90° (donc robuste pour un quadrilatère).
function polyDominantAngle(poly){
  let sx=0,sy=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i], b=poly[(i+1)%poly.length];
    const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy);
    if(L<0.01)continue;
    const ang=Math.atan2(dy,dx);
    sx+=L*Math.cos(4*ang); sy+=L*Math.sin(4*ang);
  }
  return Math.atan2(sy,sx)/4;
}
function pointInPoly(pt,poly){
  let inside=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
    const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;
    if(((yi>pt.y)!==(yj>pt.y))&&(pt.x<(xj-xi)*(pt.y-yi)/(yj-yi)+xi))inside=!inside;
  }
  return inside;
}
function gardenArea(){return gardenHasPoly()?polyArea(gardenPoly()):(S.garden.w||0)*(S.garden.h||0);}
// Définit le terrain comme polygone (points {x,y} en m) : normalise le coin haut-gauche à (0,0) et synchronise w/h.
function setGardenPolygon(poly){
  const bb=polyBBox(poly);
  S.garden.poly=poly.map(p=>({x:+(p.x-bb.minx).toFixed(2),y:+(p.y-bb.miny).toFixed(2)}));
  S.garden.w=+bb.w.toFixed(2);S.garden.h=+bb.h.toFixed(2);
}
function clearGardenPolygon(){S.garden.poly=null;S.garden.north=0;}
// Trace le contour du terrain (coords écran) dans le contexte courant.
function traceGardenPath(c){
  const poly=gardenPoly();
  c.beginPath();
  const p0=w2s(poly[0].x,poly[0].y);c.moveTo(p0.x,p0.y);
  for(let i=1;i<poly.length;i++){const p=w2s(poly[i].x,poly[i].y);c.lineTo(p.x,p.y);}
  c.closePath();
}

function draw(){
  ctx.clearRect(0,0,cv.width,cv.height);
  if(!S.garden.w) return;

  // Garden background (rectangle OU polygone)
  const poly=gardenPoly();
  const bb=polyBBox(poly);
  const fmt=v=>v.toFixed(v<10?1:0);

  // Soft shadow + fill
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.2)';ctx.shadowBlur=20;ctx.shadowOffsetX=4;ctx.shadowOffsetY=4;
  ctx.fillStyle='#1e3820';traceGardenPath(ctx);ctx.fill();
  ctx.restore();

  // Grid (rognée sur le terrain)
  ctx.save();
  traceGardenPath(ctx);ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
  for(let x=Math.floor(bb.minx);x<=Math.ceil(bb.maxx);x++){const a=w2s(x,bb.miny),b=w2s(x,bb.maxy);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  for(let y=Math.floor(bb.miny);y<=Math.ceil(bb.maxy);y++){const a=w2s(bb.minx,y),b=w2s(bb.maxx,y);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  ctx.restore();

  // Border
  ctx.strokeStyle='rgba(122,158,114,0.6)';ctx.lineWidth=2;ctx.setLineDash([]);
  traceGardenPath(ctx);ctx.stroke();

  // Dimension labels (rectangle englobant) + superficie si polygone
  const topMid=w2s((bb.minx+bb.maxx)/2,bb.miny);
  const leftMid=w2s(bb.minx,(bb.miny+bb.maxy)/2);
  ctx.fillStyle='rgba(194,217,188,0.6)';ctx.font='500 11px Outfit';
  ctx.textAlign='center'; ctx.textBaseline='bottom';
  ctx.fillText(fmt(bb.w)+'m', topMid.x, topMid.y-6);
  ctx.save();ctx.translate(leftMid.x-6,leftMid.y);ctx.rotate(-Math.PI/2);
  ctx.textBaseline='bottom';ctx.fillText(fmt(bb.h)+'m',0,0);ctx.restore();
  if(gardenHasPoly()){
    const ct=polyCentroid(poly);const c=w2s(ct.x,ct.y);
    ctx.fillStyle='rgba(194,217,188,0.3)';ctx.font='600 12px Outfit';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(Math.round(polyArea(poly))+' m²', c.x, c.y);
  }

  // Elements (back to front)
  const order=['lawn','alley','terrace','house','hedge','tree'];
  const sorted=[...S.elements].sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type));
  sorted.forEach(el=>drawEl(el));

  // Marqueurs de calibration AR (coins A/B) — dessinés par ar-webxr.js si disponible
  if(typeof drawARRefMarkers==='function') drawARRefMarkers();

  updateCompass2d();
}

// Boussole du plan 2D : la rose tourne avec l'orientation de la vue.
function updateCompass2d(){
  const cp=document.getElementById('compass2d');
  if(!cp) return;
  cp.style.display=(S.view==='2d'&&S.garden.w)?'flex':'none';
  const rose=document.getElementById('compass2dRose');
  // la rose pointe le VRAI nord : rotation de la vue + décalage nord du terrain (cadastre)
  if(rose) rose.style.transform='rotate('+(CAM.rot+(S.garden.north||0))+'rad)';
}

function drawEl(el){
  const sel=el.id===S.selected;
  ctx.save();

  if(el.type==='tree'){
    drawTree2d(el,sel);
  } else if(el.type==='alley'&&el.path){
    drawAlleyPath(el,sel);
  } else if(el.type==='lawn'&&el.poly){
    drawLawnPoly(el);
  } else if(el.type==='house'&&el.poly){
    drawHousePoly(el,sel);
  } else {
    const w=el.w*CAM.scale, h=el.d*CAM.scale;
    const cs=w2s(el.x+el.w/2, el.y+el.d/2);
    const rot=(el.rot||0)+CAM.rot;   // rotation propre de l'élément + rotation de la vue
    ctx.translate(cs.x,cs.y);
    ctx.rotate(rot);
    const ox=-w/2, oy=-h/2;
    const palette={
      house:{fill:'#b09070',stroke:'rgba(255,255,255,0.25)'},
      terrace:{fill:'#c8a870',stroke:'rgba(255,255,255,0.2)'},
      lawn:{fill:'#3a7a35',stroke:'rgba(100,200,80,0.4)'},
      hedge:{fill:'#1e4a1e',stroke:'rgba(60,140,50,0.5)'},
    };
    const pal=palette[el.type]||{fill:'#666',stroke:'#888'};

    if(el.type==='lawn'){
      ctx.fillStyle=pal.fill;ctx.fillRect(ox,oy,w,h);
      ctx.fillStyle='rgba(50,120,45,0.4)';
      for(let i=0;i<el.w;i+=2) ctx.fillRect(ox+i*CAM.scale,oy,CAM.scale,h);
    } else if(el.type==='hedge'){
      const hc=(HEDGE_DATA[el.name]&&HEDGE_DATA[el.name].color)||pal.fill;
      ctx.fillStyle=hc;ctx.fillRect(ox,oy,w,h);
      ctx.fillStyle='rgba(0,0,0,0.18)';
      const bs=Math.max(4,CAM.scale*.3);
      for(let i=0;i<Math.ceil(w/bs);i++) for(let j=0;j<Math.ceil(h/bs);j++) if((i+j)%2) ctx.fillRect(ox+i*bs,oy+j*bs,bs,bs);
    } else {
      ctx.fillStyle=pal.fill;
      if(el.type==='house'){ctx.shadowColor='rgba(0,0,0,0.25)';ctx.shadowBlur=12;ctx.shadowOffsetY=4;}
      ctx.fillRect(ox,oy,w,h);
      ctx.shadowColor='transparent';ctx.shadowBlur=0;
      if(el.type==='house'){
        ctx.fillStyle='rgba(0,0,0,0.12)';ctx.fillRect(ox,oy,w,4);
        if(CAM.scale>12){
          ctx.fillStyle='rgba(120,160,200,0.35)';
          ctx.fillRect(ox+w*.1,oy+h*.12,w*.25,h*.28);
          ctx.fillRect(ox+w*.65,oy+h*.12,w*.25,h*.28);
        }
      }
    }

    ctx.strokeStyle=sel?'#e8c870':pal.stroke;
    ctx.lineWidth=sel?2:1;
    if(sel)ctx.setLineDash([5,4]);
    ctx.strokeRect(ox,oy,w,h);
    ctx.setLineDash([]);

    if(w>30&&h>16){
      const lbl={house:'Maison',terrace:'Terrasse',lawn:'Pelouse',hedge:'Haie'};
      ctx.fillStyle=sel?'#e8c870':'rgba(255,255,255,0.65)';
      ctx.font='500 '+Math.min(12,Math.max(9,w*.08))+'px Outfit';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(lbl[el.type]||'',0,0);
    }

    // Resize handles (only when selected, not full-fill lawn)
    if(sel&&!el.fill){
      const corners=[[ox,oy],[ox+w,oy],[ox+w,oy+h],[ox,oy+h]];
      ctx.fillStyle='#e8c870';ctx.strokeStyle='#1a1f1a';ctx.lineWidth=1.5;
      corners.forEach(c=>{ctx.beginPath();ctx.rect(c[0]-5,c[1]-5,10,10);ctx.fill();ctx.stroke();});
    }
  }
  ctx.restore();
}

// Bâtiment à contour réel (emprise importée du cadastre)
function drawHousePoly(el,sel){
  const poly=el.poly;
  const trace=()=>{
    ctx.beginPath();
    const p0=w2s(poly[0].x,poly[0].y);ctx.moveTo(p0.x,p0.y);
    for(let i=1;i<poly.length;i++){const p=w2s(poly[i].x,poly[i].y);ctx.lineTo(p.x,p.y);}
    ctx.closePath();
  };
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.25)';ctx.shadowBlur=10;ctx.shadowOffsetX=2;ctx.shadowOffsetY=3;
  ctx.fillStyle='#b09070';trace();ctx.fill();
  ctx.restore();
  // liseré de toit
  ctx.fillStyle='rgba(0,0,0,0.10)';trace();ctx.save();ctx.clip();
  const bb=polyBBox(poly);const tp=w2s(bb.minx,bb.miny);
  ctx.fillRect(tp.x,tp.y,bb.w*CAM.scale,4);ctx.restore();
  ctx.strokeStyle=sel?'#e8c870':'rgba(255,255,255,0.3)';ctx.lineWidth=sel?2:1.2;
  if(sel)ctx.setLineDash([5,4]);
  trace();ctx.stroke();ctx.setLineDash([]);
  // étiquette si l'emprise est assez grande à l'écran
  if(bb.w*CAM.scale>40&&bb.h*CAM.scale>22){
    const ct=polyCentroid(poly);const c=w2s(ct.x,ct.y);
    ctx.fillStyle=sel?'#e8c870':'rgba(255,255,255,0.7)';
    ctx.font='500 11px Outfit';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(el.name||'Maison',c.x,c.y);
  }
}

// Gazon épousant un polygone de terrain (fill)
function drawLawnPoly(el){
  const poly=el.poly;
  ctx.beginPath();
  const p0=w2s(poly[0].x,poly[0].y);ctx.moveTo(p0.x,p0.y);
  for(let i=1;i<poly.length;i++){const p=w2s(poly[i].x,poly[i].y);ctx.lineTo(p.x,p.y);}
  ctx.closePath();
  ctx.fillStyle='#3a7a35';ctx.fill();
  ctx.save();ctx.clip();
  const bb=polyBBox(poly);
  ctx.fillStyle='rgba(50,120,45,0.4)';
  for(let i=Math.floor(bb.minx);i<bb.maxx;i+=2){const a=w2s(i,bb.miny);ctx.fillRect(a.x,a.y,CAM.scale,(bb.maxy-bb.miny)*CAM.scale);}
  ctx.restore();
}

function drawTree2d(el,sel){
  const p=w2s(el.x,el.y);
  const r=effSpread(el)*CAM.scale/2;
  const data=TREE_DATA[el.name]||TREE_DATA['Chêne'];

  if(r>3){
    // Ground shadow
    ctx.fillStyle='rgba(0,0,0,0.18)';
    ctx.beginPath();ctx.ellipse(p.x+r*.12,p.y+r*.15,r,r*.65,0,0,Math.PI*2);ctx.fill();
    // Foliage layers
    const layers=[
      {scale:1.0,color:lighten(data.color,-20)},
      {scale:0.82,color:data.color},
      {scale:0.65,color:lighten(data.color,15)},
      {scale:0.42,color:lighten(data.color,30)},
    ];
    layers.forEach(l=>{
      ctx.fillStyle=l.color;
      ctx.beginPath();ctx.arc(p.x,p.y,r*l.scale,0,Math.PI*2);ctx.fill();
    });
    // Highlight
    ctx.fillStyle='rgba(255,255,255,0.12)';
    ctx.beginPath();ctx.ellipse(p.x-r*.22,p.y-r*.28,r*.28,r*.2,-0.5,0,Math.PI*2);ctx.fill();
    // Trunk dot
    ctx.fillStyle=data.trunk;
    ctx.beginPath();ctx.arc(p.x,p.y,Math.max(2,r*.08),0,Math.PI*2);ctx.fill();
  }

  if(sel){
    ctx.strokeStyle='#e8c870';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.arc(p.x,p.y,r+4,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
  }
  if(r>12){
    ctx.fillStyle=sel?'#e8c870':'rgba(255,255,255,0.55)';
    ctx.font='500 '+Math.min(11,r*.25)+'px Outfit';
    ctx.textAlign='center';ctx.textBaseline='top';
    ctx.fillText(el.name.slice(0,8),p.x,p.y+r+4);
  }
}

function lighten(hex,amt){
  let r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
  r=Math.min(255,Math.max(0,r+amt));g=Math.min(255,Math.max(0,g+amt));b=Math.min(255,Math.max(0,b+amt));
  return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');
}

// ── Snap / growth / rotation helpers ──
function snap(v){return S.snap?Math.round(v):v;}
function toggleSnap(){
  S.snap=!S.snap;
  document.getElementById('tbSnap').classList.toggle('snap-on',S.snap);
  toast(S.snap?'Aimant activé (grille 1 m)':'Aimant désactivé');
}
// Effective tree size given growth projection (years)
function growthFactor(){return 1+Math.min(S.growth,20)*0.035;} // up to ~1.7x at 20 yrs
function effH(el){return el.type==='tree'?el.h*growthFactor():el.h;}
function effSpread(el){return el.type==='tree'?el.spread*growthFactor():el.spread;}
function setGrowth(y){
  S.growth=y;
  document.getElementById('growthVal').textContent=y===0?"aujourd'hui":('+'+y+' an'+(y>1?'s':''));
  if(S.view==='2d')draw(); else if(S.view==='3d')init3d(); else if(S.view==='r3d')initRealistic3d();
}
// Rotate a world point around a center by -rot (to test in element-local space)
function unrotate(px,py,cx,cy,rot){
  if(!rot)return{x:px,y:py};
  const c=Math.cos(-rot),s=Math.sin(-rot);
  const dx=px-cx,dy=py-cy;
  return{x:cx+dx*c-dy*s,y:cy+dx*s+dy*c};
}

