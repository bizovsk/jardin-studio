// ============================================================
// three-realistic.js
// Vue 3D+ realiste : ombres, ciel, materiaux PBR, maisons/haies/arbres detailles, destroy3d(), setView().
// ============================================================

// ════════════════════════════════════════════════════════════
// 3D+ REALISTIC
// ════════════════════════════════════════════════════════════
// Ciel en dégradé (texture canvas) — sert au dôme ET à l'éclairage d'ambiance (IBL).
function makeSkyTexture(){
  const cv=document.createElement('canvas');cv.width=64;cv.height=512;
  const g=cv.getContext('2d');
  const grd=g.createLinearGradient(0,0,0,512);
  grd.addColorStop(0,'#3a6fb0');     // zénith
  grd.addColorStop(0.45,'#7fb0dd');
  grd.addColorStop(0.78,'#cfe2ef');
  grd.addColorStop(1,'#eaf1f4');     // horizon pâle
  g.fillStyle=grd;g.fillRect(0,0,64,512);
  const t=new THREE.CanvasTexture(cv);
  t.encoding=THREE.sRGBEncoding;
  return t;
}
// Texture d'herbe procédurale (mouchetis de verts) — répétée sur le sol.
function makeGrassTexture(){
  const cv=document.createElement('canvas');cv.width=256;cv.height=256;
  const g=cv.getContext('2d');
  g.fillStyle='#4e8a3c';g.fillRect(0,0,256,256);
  const tones=['#3f7a32','#5a9a45','#4e8a3c','#6aa850','#46813a','#3a6e2e'];
  for(let i=0;i<5000;i++){
    g.globalAlpha=0.35+Math.random()*0.4;
    g.fillStyle=tones[(Math.random()*tones.length)|0];
    g.fillRect(Math.random()*256,Math.random()*256,1.3,2.6);
  }
  g.globalAlpha=1;
  const t=new THREE.CanvasTexture(cv);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.encoding=THREE.sRGBEncoding;
  return t;
}

function initRealistic3d(){
  const area=document.querySelector('.canvas-area');
  const c=document.getElementById('c3d');
  c.innerHTML='';

  const renderer=new THREE.WebGLRenderer({antialias:true});
  renderer.setSize(area.clientWidth,area.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputEncoding=THREE.sRGBEncoding;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;   // rendu « filmique » plus réaliste
  renderer.toneMappingExposure=1.0;
  c.appendChild(renderer.domElement);

  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x9fc4e0);
  scene.fog=new THREE.Fog(0x9fc4e0,90,320);

  const cam=new THREE.PerspectiveCamera(52,area.clientWidth/area.clientHeight,.1,800);
  orbit.radius=Math.max(S.garden.w,S.garden.h)*1.6;
  updateOrbitCamera(cam);

  // Ciel en dégradé (non affecté par le brouillard pour rester visible)
  const skyTex=makeSkyTexture();
  const sky=new THREE.Mesh(new THREE.SphereGeometry(400,24,16),
    new THREE.MeshBasicMaterial({map:skyTex,side:THREE.BackSide,fog:false}));
  scene.add(sky);

  // Éclairage d'ambiance réaliste (IBL) calculé depuis le ciel → reflets + lumière douce
  const pmrem=new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envSrc=makeSkyTexture();envSrc.mapping=THREE.EquirectangularReflectionMapping;
  scene.environment=pmrem.fromEquirectangular(envSrc).texture;
  pmrem.dispose();envSrc.dispose();

  // Lighting (allégé car l'IBL fournit déjà l'ambiance ; le soleil porte les ombres)
  const hemi=new THREE.HemisphereLight(0xbfe0ff,0x556b3a,0.5);
  scene.add(hemi);
  const sun=new THREE.DirectionalLight(0xfff4e0,2.2);
  sun.position.set(S.garden.w*0.7,Math.max(S.garden.w,S.garden.h)*1.1,-S.garden.h*0.4);
  sun.castShadow=true;
  const sd=Math.max(S.garden.w,S.garden.h);
  sun.shadow.mapSize.set(2048,2048);
  sun.shadow.camera.left=-sd; sun.shadow.camera.right=sd;
  sun.shadow.camera.top=sd; sun.shadow.camera.bottom=-sd;
  sun.shadow.camera.near=1; sun.shadow.camera.far=sd*4;
  sun.shadow.bias=-0.0005; sun.shadow.normalBias=0.02; sun.shadow.radius=3;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff,0.12));

  // Ground (grass texturé) — rectangle ou polygone
  const grassTex=makeGrassTexture();
  grassTex.repeat.set(0.5,0.5);   // ~tuile de 2 m (UV en mètres)
  const ground=new THREE.Mesh(
    gardenGroundGeometry(),
    new THREE.MeshStandardMaterial({map:grassTex,roughness:1,metalness:0})
  );
  ground.position.y=0;
  ground.receiveShadow=true;
  scene.add(ground);
  // Surrounding earth
  const around=new THREE.Mesh(
    new THREE.PlaneGeometry(S.garden.w*4,S.garden.h*4),
    new THREE.MeshStandardMaterial({color:0x6b7a4a,roughness:1})
  );
  around.rotation.x=-Math.PI/2;around.position.set(S.garden.w/2,-0.05,S.garden.h/2);
  scene.add(around);

  S.elements.forEach(el=>add3dRealistic(scene,el));

  // three r128 ne décode pas les couleurs sRGB des matériaux → on convertit en linéaire
  // (sinon les verts foncés rendent délavés), et on calme l'intensité de l'IBL.
  scene.traverse(o=>{
    if(!o.material) return;
    (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{
      if(m.map) return;                      // textures déjà décodées (encoding sRGB)
      if(m.color) m.color.convertSRGBToLinear();
      if(m.emissive) m.emissive.convertSRGBToLinear();
      if('envMapIntensity' in m) m.envMapIntensity=0.5;
    });
  });

  scene.userData.sun=sun;
  three={renderer,scene,cam,raf:null};
  // sync slider values
  document.getElementById('sunHour').value=S.sun.hour;
  document.getElementById('sunMonth').value=S.sun.month;
  document.getElementById('sunHourVal').textContent=S.sun.hour+'h';
  document.getElementById('sunMonthVal').textContent=MONTHS[S.sun.month-1];
  applySun();
  attachOrbit(renderer,cam);
  const loop=()=>{three.raf=requestAnimationFrame(loop);renderer.render(scene,cam);};loop();
}

function add3dRealistic(scene,el){
  if(el.type==='lawn'){
    if(el.fill) return;          // le sol est déjà une herbe texturée → gazon de fond inutile en réaliste
    const gt=makeGrassTexture();
    const mat=new THREE.MeshStandardMaterial({map:gt,roughness:1});
    if(el.poly){
      gt.repeat.set(0.5,0.5);
      const m=new THREE.Mesh(shapeGeomFromPoly(el.poly),mat);
      m.position.y=.02;m.receiveShadow=true;scene.add(m);
    } else {
      gt.repeat.set(Math.max(1,el.w/2),Math.max(1,el.d/2));
      const m=new THREE.Mesh(new THREE.PlaneGeometry(el.w,el.d),mat);
      m.rotation.x=-Math.PI/2;m.position.set(el.x+el.w/2,.02,el.y+el.d/2);
      m.receiveShadow=true;scene.add(m);
    }
  } else if(el.type==='hedge'){
    const hw=el.w,hd=el.d,hh=el.h||1.8;
    const hcol=new THREE.Color((HEDGE_DATA[el.name]&&HEDGE_DATA[el.name].color)||'#1e4a1e');
    const mat=new THREE.MeshStandardMaterial({color:hcol,roughness:0.95});
    const g=new THREE.Group();g.position.set(el.x+hw/2,0,el.y+hd/2);g.rotation.y=-(el.rot||0);
    const body=new THREE.Mesh(new THREE.BoxGeometry(hw,hh,hd),mat);
    body.position.y=hh/2;body.castShadow=true;body.receiveShadow=true;g.add(body);
    const bumps=Math.min(40,Math.max(3,Math.round(hw)));
    for(let i=0;i<bumps;i++){
      const bs=Math.min(hd,hh)*0.5*(0.7+Math.random()*0.5);
      const b=new THREE.Mesh(new THREE.IcosahedronGeometry(bs,0),
        new THREE.MeshStandardMaterial({color:hcol.clone().offsetHSL(0,0,(Math.random()-0.5)*0.08),roughness:0.95}));
      b.position.set(-hw/2+(i+0.5)/bumps*hw, hh+bs*0.2, (Math.random()-0.5)*hd*0.3);
      b.castShadow=true;g.add(b);
    }
    scene.add(g);
  } else if(el.type==='house'&&el.poly){
    // emprise cadastrale : murs extrudés + dalle de toit (toit plat)
    const hh=el.h||4;
    const wallMat=new THREE.MeshStandardMaterial({color:0xe8ddc8,roughness:0.9});
    const walls=new THREE.Mesh(extrudeGeomFromPoly(el.poly,hh),wallMat);
    walls.castShadow=true;walls.receiveShadow=true;scene.add(walls);
    const roof=new THREE.Mesh(extrudeGeomFromPoly(el.poly,0.3),
      new THREE.MeshStandardMaterial({color:0x9c4a35,roughness:0.85}));
    roof.position.y=hh;roof.castShadow=true;scene.add(roof);
  } else if(el.type==='house'){
    const hh=el.h||4;
    const g=new THREE.Group();g.position.set(el.x+el.w/2,0,el.y+el.d/2);g.rotation.y=-(el.rot||0);
    const wallMat=new THREE.MeshStandardMaterial({color:0xe8ddc8,roughness:0.9});
    const walls=new THREE.Mesh(new THREE.BoxGeometry(el.w,hh,el.d),wallMat);
    walls.position.y=hh/2;walls.castShadow=true;walls.receiveShadow=true;g.add(walls);
    const rh=Math.min(el.w,el.d)*0.45;
    const roofMat=new THREE.MeshStandardMaterial({color:0x9c4a35,roughness:0.85});
    const longSide=el.w>=el.d;
    const ridgeLen=longSide?el.w:el.d, span=longSide?el.d:el.w;
    const shape=new THREE.Shape();
    shape.moveTo(-span/2,0);shape.lineTo(span/2,0);shape.lineTo(0,rh);shape.lineTo(-span/2,0);
    const rgeo=new THREE.ExtrudeGeometry(shape,{depth:ridgeLen,bevelEnabled:false});
    rgeo.translate(0,0,-ridgeLen/2);
    const roof=new THREE.Mesh(rgeo,roofMat);roof.castShadow=true;
    if(longSide) roof.rotation.y=Math.PI/2;
    roof.position.y=hh;g.add(roof);
    const door=new THREE.Mesh(new THREE.BoxGeometry(Math.min(1,el.w*0.2),Math.min(2.1,hh*0.6),0.1),
      new THREE.MeshStandardMaterial({color:0x5a3a22,roughness:0.7}));
    door.position.set(0,Math.min(2.1,hh*0.6)/2,-el.d/2+0.02);g.add(door);
    const winMat=new THREE.MeshStandardMaterial({color:0x9fd0e8,roughness:0.2,metalness:0.1,emissive:0x223344,emissiveIntensity:0.3});
    [-0.25,0.28].forEach(fx=>{
      const win=new THREE.Mesh(new THREE.BoxGeometry(Math.min(1,el.w*0.18),Math.min(1,hh*0.3),0.1),winMat);
      win.position.set(el.w*fx,hh*0.6,-el.d/2+0.02);g.add(win);
    });
    scene.add(g);
  } else if(el.type==='terrace'){
    const m=new THREE.Mesh(new THREE.BoxGeometry(el.w,.2,el.d),
      new THREE.MeshStandardMaterial({color:0xcaa66a,roughness:0.8}));
    m.position.set(el.x+el.w/2,.1,el.y+el.d/2);m.rotation.y=-(el.rot||0);m.receiveShadow=true;scene.add(m);
  } else if(el.type==='alley'){
    if(el.path&&el.path.length>=2) addAlleyPath3d(scene,el,0xb0a088,true);
    else if(el.w){
      const m=new THREE.Mesh(new THREE.BoxGeometry(el.w,.1,el.d),
        new THREE.MeshStandardMaterial({color:0xb0a088,roughness:0.95}));
      m.position.set(el.x+el.w/2,.05,el.y+el.d/2);m.receiveShadow=true;scene.add(m);
    }
  } else if(el.type==='tree'){
    addTreeRealistic(scene,el);
  }
}

function addTreeRealistic(scene,el){
  const data=TREE_DATA[el.name]||TREE_DATA['Chêne'];
  const h=effH(el),r=effSpread(el);
  const trunkH=h*0.32,trunkR=Math.max(0.07,r*0.06);
  const trunkMat=new THREE.MeshStandardMaterial({color:new THREE.Color(data.trunk),roughness:0.95});
  const folMat=c=>new THREE.MeshStandardMaterial({color:c,roughness:0.9});
  const base=new THREE.Color(data.color);

  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(trunkR*0.8,trunkR*1.2,trunkH,8),trunkMat);
  trunk.position.set(el.x,trunkH/2,el.y);trunk.castShadow=true;scene.add(trunk);

  const form=data.form;
  if(form==='cone'||form==='column'){
    const layers=form==='cone'?4:3;
    for(let i=0;i<layers;i++){
      const lr=r*(0.95-0.22*i/layers),lh=h*0.42;
      const cone=new THREE.Mesh(new THREE.ConeGeometry(lr,lh,12),folMat(base.clone().offsetHSL(0,0,0.03*i)));
      cone.position.set(el.x,trunkH+lh/2+i*h*0.16,el.y);cone.castShadow=true;scene.add(cone);
    }
  } else if(form==='palm'){
    const col=new THREE.Mesh(new THREE.CylinderGeometry(trunkR*0.7,trunkR,h*0.78,8),trunkMat);
    col.position.set(el.x,h*0.39,el.y);col.castShadow=true;scene.add(col);
    for(let i=0;i<9;i++){
      const a=i/9*Math.PI*2,len=r*1.3;
      const blade=new THREE.Mesh(new THREE.BoxGeometry(0.18,len,0.05),folMat(base.clone()));
      blade.position.set(el.x+Math.cos(a)*len*0.42,h*0.82,el.y+Math.sin(a)*len*0.42);
      blade.rotation.set(-0.8*Math.cos(a+Math.PI/2),a,0.8*Math.sin(a+Math.PI/2));
      blade.castShadow=true;scene.add(blade);
    }
  } else if(form==='narrow'){
    const c1=new THREE.Mesh(new THREE.ConeGeometry(r*0.75,h*0.78,12),folMat(base));
    c1.position.set(el.x,trunkH+h*0.38,el.y);c1.castShadow=true;scene.add(c1);
  } else if(form==='weeping'){
    // saule pleureur : dôme aplati + rideaux retombants
    const cy=trunkH+h*0.5;
    const dome=new THREE.Mesh(new THREE.IcosahedronGeometry(r*0.6,1),folMat(base));
    dome.position.set(el.x,cy,el.y);dome.scale.y=0.65;dome.castShadow=true;scene.add(dome);
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2;
      const drop=new THREE.Mesh(new THREE.ConeGeometry(r*0.14,h*0.55,6),folMat(base.clone().offsetHSL(0,0,(Math.random()-0.3)*0.06)));
      drop.position.set(el.x+Math.cos(a)*r*0.52,trunkH+h*0.28,el.y+Math.sin(a)*r*0.52);
      drop.castShadow=true;scene.add(drop);
    }
  } else {
    // round/oval: cluster of icospheres for organic canopy
    const blobs=form==='oval'?6:7;
    const cy=trunkH+h*0.42;
    for(let i=0;i<blobs;i++){
      const ang=i/blobs*Math.PI*2;
      const rad=r*0.32;
      const br=r*(0.34+Math.random()*0.12);
      const blob=new THREE.Mesh(new THREE.IcosahedronGeometry(br,1),folMat(base.clone().offsetHSL(0,0,(Math.random()-0.4)*0.08)));
      const yy=cy+(Math.random()-0.4)*h*0.15*(form==='oval'?1.6:1);
      blob.position.set(el.x+Math.cos(ang)*rad*(0.6+Math.random()*0.6),yy,el.y+Math.sin(ang)*rad*(0.6+Math.random()*0.6));
      blob.castShadow=true;scene.add(blob);
    }
    const cap=new THREE.Mesh(new THREE.IcosahedronGeometry(r*0.4,1),folMat(base.clone().offsetHSL(0,0,0.06)));
    cap.position.set(el.x,cy+h*(form==='oval'?0.28:0.18),el.y);cap.castShadow=true;scene.add(cap);
  }
}

function destroy3d(){
  if(three.raf)cancelAnimationFrame(three.raf);
  if(three.renderer){three.renderer.dispose();three.renderer.domElement.remove();}
  three={renderer:null,scene:null,cam:null,raf:null};
}

function setView(v){
  S.view=v;
  const cv2d=document.getElementById('c2d');
  const cv3d=document.getElementById('c3d');
  document.getElementById('vs2d').classList.toggle('active',v==='2d');
  document.getElementById('vs3d').classList.toggle('active',v==='3d');
  document.getElementById('vsr3d').classList.toggle('active',v==='r3d');
  document.getElementById('compass').style.display=(v==='3d'||v==='r3d')?'flex':'none';
  document.getElementById('compass2d').style.display=(v==='2d'&&S.garden.w)?'flex':'none';
  document.getElementById('sunPanel').style.display=(v==='r3d')?'block':'none';
  document.getElementById('growthPanel').style.display='block';
  if(v==='2d'){
    destroy3d();cv2d.style.display='block';cv3d.style.display='none';draw();
    document.getElementById('topBar').style.display='flex';
  } else {
    destroy3d();
    cv2d.style.display='none';cv3d.style.display='block';
    document.getElementById('topBar').style.display='none';
    if(v==='r3d') initRealistic3d(); else init3d();
  }
}

