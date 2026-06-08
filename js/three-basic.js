// ============================================================
// three-basic.js
// Vue 3D performante (Three.js) : init3d(), controles orbitaux, constructeurs d'elements legers.
// ============================================================

// ════════════════════════════════════════════════════════════
// 3D — Three.js
// ════════════════════════════════════════════════════════════
let three={renderer:null,scene:null,cam:null,raf:null};
let orbit={theta:0.6,phi:1.0,radius:0};

// Géométrie horizontale (plan XZ, normale vers le haut) à partir d'un polygone {x,y} en mètres.
function shapeGeomFromPoly(poly){
  const shape=new THREE.Shape();
  shape.moveTo(poly[0].x,-poly[0].y);
  for(let i=1;i<poly.length;i++)shape.lineTo(poly[i].x,-poly[i].y);
  shape.closePath();
  const g=new THREE.ShapeGeometry(shape);
  g.rotateX(-Math.PI/2);   // plan XY → plan XZ ; le -y du shape redonne +z = y monde
  return g;
}
function gardenGroundGeometry(){return shapeGeomFromPoly(gardenPoly());}

// Volume extrudé (murs) à partir d'un polygone {x,y} en mètres, hauteur h, posé sur le sol.
function extrudeGeomFromPoly(poly,h){
  const shape=new THREE.Shape();
  shape.moveTo(poly[0].x,-poly[0].y);
  for(let i=1;i<poly.length;i++)shape.lineTo(poly[i].x,-poly[i].y);
  shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});
  g.rotateX(-Math.PI/2);   // extrusion +z → hauteur +y ; base au sol (y=0)
  return g;
}

function init3d(){
  const area=document.querySelector('.canvas-area');
  const c=document.getElementById('c3d');
  c.innerHTML='';

  const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});
  renderer.setSize(area.clientWidth,area.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));
  renderer.shadowMap.enabled=false;
  renderer.setClearColor(0x111811);
  c.appendChild(renderer.domElement);

  const scene=new THREE.Scene();
  scene.fog=new THREE.Fog(0x111811,60,250);

  const cam=new THREE.PerspectiveCamera(55,area.clientWidth/area.clientHeight,.1,600);
  orbit.radius=Math.max(S.garden.w,S.garden.h)*1.7;
  updateOrbitCamera(cam);

  // Lights
  scene.add(new THREE.AmbientLight(0x445544,2.5));
  const sun=new THREE.DirectionalLight(0xfff0d0,2.5);
  sun.position.set(S.garden.w*.8,40,-15);
  scene.add(sun);
  const fill=new THREE.DirectionalLight(0x446655,0.8);
  fill.position.set(-S.garden.w,20,S.garden.h);
  scene.add(fill);

  // Ground (rectangle ou polygone)
  const g=new THREE.Mesh(gardenGroundGeometry(),new THREE.MeshLambertMaterial({color:0x1e3820}));
  g.position.y=0;scene.add(g);

  // Border (suit le contour du terrain)
  const poly=gardenPoly();
  const bpts=poly.map(p=>new THREE.Vector3(p.x,0,p.y));bpts.push(bpts[0].clone());
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bpts),new THREE.LineBasicMaterial({color:0x4a8c3f})));

  S.elements.forEach(el=>add3d(scene,el));

  three={renderer,scene,cam,raf:null};
  attachOrbit(renderer,cam);
  const loop=()=>{three.raf=requestAnimationFrame(loop);renderer.render(scene,cam);};loop();
}

function attachOrbit(renderer,cam){
  const dom=renderer.domElement;
  let isDown=false,lastM={x:0,y:0};
  const orbitBy=(dx,dy)=>{
    orbit.theta-=dx*0.006;
    orbit.phi=Math.max(.12,Math.min(Math.PI/2-.02,orbit.phi-dy*0.006));
    updateOrbitCamera(cam);
  };
  dom.addEventListener('mousedown',e=>{isDown=true;lastM={x:e.clientX,y:e.clientY};});
  dom.addEventListener('mousemove',e=>{
    if(!isDown)return;
    orbitBy(e.clientX-lastM.x,e.clientY-lastM.y);
    lastM={x:e.clientX,y:e.clientY};
  });
  window.addEventListener('mouseup',()=>isDown=false);
  dom.addEventListener('wheel',e=>{
    orbit.radius=Math.max(6,Math.min(400,orbit.radius*(e.deltaY>0?1.1:0.91)));
    updateOrbitCamera(cam);
  },{passive:true});
  // Tactile : 1 doigt = orbite, 2 doigts = zoom (pincement)
  let oPinch=null;
  dom.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      const a=e.touches[0],b=e.touches[1];
      oPinch=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
    } else if(e.touches.length===1){
      oPinch=null;isDown=true;lastM={x:e.touches[0].clientX,y:e.touches[0].clientY};
    }
    e.preventDefault();
  },{passive:false});
  dom.addEventListener('touchmove',e=>{
    if(oPinch!=null&&e.touches.length===2){
      const a=e.touches[0],b=e.touches[1];
      const d=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
      if(oPinch>0){orbit.radius=Math.max(6,Math.min(400,orbit.radius*(oPinch/d)));updateOrbitCamera(cam);}
      oPinch=d;
    } else if(e.touches.length===1&&isDown){
      orbitBy(e.touches[0].clientX-lastM.x,e.touches[0].clientY-lastM.y);
      lastM={x:e.touches[0].clientX,y:e.touches[0].clientY};
    }
    e.preventDefault();
  },{passive:false});
  dom.addEventListener('touchend',e=>{if(e.touches.length<2)oPinch=null;if(e.touches.length===0)isDown=false;});
}

function updateOrbitCamera(cam){
  const cx=S.garden.w/2,cz=S.garden.h/2;
  cam.position.x=cx+orbit.radius*Math.sin(orbit.phi)*Math.sin(orbit.theta);
  cam.position.y=orbit.radius*Math.cos(orbit.phi);
  cam.position.z=cz+orbit.radius*Math.sin(orbit.phi)*Math.cos(orbit.theta);
  cam.lookAt(new THREE.Vector3(cx,0,cz));
}

function add3d(scene,el){
  if(el.type==='lawn'){
    if(el.poly){
      const m=new THREE.Mesh(shapeGeomFromPoly(el.poly),new THREE.MeshLambertMaterial({color:0x3a7a35}));
      m.position.y=.01;scene.add(m);
    } else {
      const m=new THREE.Mesh(new THREE.PlaneGeometry(el.w,el.d),new THREE.MeshLambertMaterial({color:0x3a7a35}));
      m.rotation.x=-Math.PI/2;m.position.set(el.x+el.w/2,.01,el.y+el.d/2);scene.add(m);
    }
  } else if(el.type==='hedge'){
    const hw=el.w,hd=el.d,hh=el.h||1.8;
    const hcol=new THREE.Color((HEDGE_DATA[el.name]&&HEDGE_DATA[el.name].color)||'#1e4a1e');
    const m=new THREE.Mesh(new THREE.BoxGeometry(hw,hh,hd),new THREE.MeshLambertMaterial({color:hcol}));
    m.position.set(el.x+hw/2,hh/2,el.y+hd/2);m.rotation.y=-(el.rot||0);scene.add(m);
    const top=new THREE.Mesh(new THREE.BoxGeometry(hw+.1,0.1,hd+.1),new THREE.MeshLambertMaterial({color:hcol.clone().offsetHSL(0,0,.06)}));
    top.position.set(el.x+hw/2,hh+.05,el.y+hd/2);top.rotation.y=-(el.rot||0);scene.add(top);
  } else if(el.type==='house'){
    const hh=el.h||4;
    if(el.poly){
      // emprise cadastrale : murs extrudés (toit plat)
      const walls=new THREE.Mesh(extrudeGeomFromPoly(el.poly,hh),new THREE.MeshLambertMaterial({color:0xc9b79a}));
      scene.add(walls);
      const roof=new THREE.Mesh(extrudeGeomFromPoly(el.poly,0.25),new THREE.MeshLambertMaterial({color:0x9c5a40}));
      roof.position.y=hh;scene.add(roof);
    } else {
      const g=new THREE.Group();g.position.set(el.x+el.w/2,0,el.y+el.d/2);g.rotation.y=-(el.rot||0);
      const walls=new THREE.Mesh(new THREE.BoxGeometry(el.w,hh,el.d),new THREE.MeshLambertMaterial({color:0xb09070}));
      walls.position.y=hh/2;g.add(walls);
      const ridge=Math.max(el.w,el.d)*.5;
      const roof=new THREE.Mesh(new THREE.ConeGeometry(ridge*.72,hh*.5,4),new THREE.MeshLambertMaterial({color:0x7a5030}));
      roof.position.y=hh+hh*.25;roof.rotation.y=Math.PI/4;g.add(roof);
      scene.add(g);
    }
  } else if(el.type==='terrace'){
    const m=new THREE.Mesh(new THREE.BoxGeometry(el.w,.18,el.d),new THREE.MeshLambertMaterial({color:0xc8a870}));
    m.position.set(el.x+el.w/2,.09,el.y+el.d/2);m.rotation.y=-(el.rot||0);scene.add(m);
  } else if(el.type==='alley'){
    if(el.path&&el.path.length>=2){
      addAlleyPath3d(scene,el,0xa09080,false);
    } else if(el.w){
      const m=new THREE.Mesh(new THREE.BoxGeometry(el.w,.08,el.d),new THREE.MeshLambertMaterial({color:0xa09080}));
      m.position.set(el.x+el.w/2,.04,el.y+el.d/2);scene.add(m);
    }
  } else if(el.type==='tree'){
    addTree3d(scene,el);
  }
}

function addAlleyPath3d(scene,el,color,realistic){
  const w=el.width||1;
  const mat=realistic
    ? new THREE.MeshStandardMaterial({color,roughness:0.95,metalness:0})
    : new THREE.MeshLambertMaterial({color});
  for(let i=0;i<el.path.length-1;i++){
    const a=el.path[i],b=el.path[i+1];
    const len=Math.hypot(b.x-a.x,b.y-a.y);
    if(len<0.01)continue;
    const seg=new THREE.Mesh(new THREE.BoxGeometry(len+w*0.5,0.08,w),mat);
    seg.position.set((a.x+b.x)/2,0.04,(a.y+b.y)/2);
    seg.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);
    if(realistic)seg.receiveShadow=true;
    scene.add(seg);
  }
}

function addTree3d(scene,el){
  const data=TREE_DATA[el.name]||TREE_DATA['Chêne'];
  const h=effH(el),r=effSpread(el);
  const trunkH=h*.3,trunkR=Math.max(.06,r*.055);
  const foliageColor=new THREE.Color(data.color);
  const trunkColor=new THREE.Color(data.trunk);

  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(trunkR*.8,trunkR,trunkH,7),new THREE.MeshLambertMaterial({color:trunkColor}));
  trunk.position.set(el.x,trunkH/2,el.y);scene.add(trunk);

  const form=data.form;
  if(form==='cone'||form==='column'){
    const layers=form==='cone'?3:2;
    for(let i=0;i<layers;i++){
      const lr=r*(1-.3*i/layers),lh=h*.45;
      const c=new THREE.Mesh(new THREE.ConeGeometry(lr,lh,8),new THREE.MeshLambertMaterial({color:foliageColor.clone().offsetHSL(0,0,.04*i)}));
      c.position.set(el.x,trunkH+lh/2+i*h*.15,el.y);scene.add(c);
    }
  } else if(form==='palm'){
    const col=new THREE.Mesh(new THREE.CylinderGeometry(trunkR*.7,trunkR,h*.75,6),new THREE.MeshLambertMaterial({color:trunkColor}));
    col.position.set(el.x,h*.375,el.y);scene.add(col);
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2,len=r*1.2;
      const blade=new THREE.Mesh(new THREE.BoxGeometry(.15,len,.06),new THREE.MeshLambertMaterial({color:foliageColor}));
      blade.position.set(el.x+Math.cos(a)*len*.4,h*.8,el.y+Math.sin(a)*len*.4);
      blade.rotation.set(-0.7*Math.cos(a+Math.PI/2),a,.7*Math.sin(a+Math.PI/2));
      scene.add(blade);
    }
  } else if(form==='narrow'){
    const c=new THREE.Mesh(new THREE.ConeGeometry(r*.7,h*.7,8),new THREE.MeshLambertMaterial({color:foliageColor}));
    c.position.set(el.x,trunkH+h*.35,el.y);scene.add(c);
  } else if(form==='weeping'){
    // saule pleureur : dôme large + retombées
    const dome=new THREE.Mesh(new THREE.SphereGeometry(r*.6,8,6),new THREE.MeshLambertMaterial({color:foliageColor}));
    dome.position.set(el.x,trunkH+h*.5,el.y);dome.scale.y=.7;scene.add(dome);
    for(let i=0;i<7;i++){
      const a=i/7*Math.PI*2;
      const drop=new THREE.Mesh(new THREE.ConeGeometry(r*.16,h*.5,5),new THREE.MeshLambertMaterial({color:foliageColor.clone().offsetHSL(0,0,.04)}));
      drop.position.set(el.x+Math.cos(a)*r*.5,trunkH+h*.28,el.y+Math.sin(a)*r*.5);
      scene.add(drop);
    }
  } else {
    // round / oval
    const geom=form==='oval'?new THREE.SphereGeometry(r*.6,8,6):new THREE.SphereGeometry(r*.65,8,6);
    const fs=new THREE.Mesh(geom,new THREE.MeshLambertMaterial({color:foliageColor}));
    fs.position.set(el.x,trunkH+h*.45,el.y);
    if(form==='oval')fs.scale.y=1.3;
    scene.add(fs);
    const top=new THREE.Mesh(new THREE.SphereGeometry(r*.4,7,5),new THREE.MeshLambertMaterial({color:foliageColor.clone().offsetHSL(0,0,.06)}));
    top.position.set(el.x,trunkH+h*.65,el.y);scene.add(top);
  }
}

