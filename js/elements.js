// ============================================================
// elements.js
// Navigation entre etapes et fonctions d'ajout d'elements (bati, allees, pelouse, haies, arbres).
// ============================================================

// ════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════
function goNext(){
  if(S.step===ST.TERRAIN&&(!S.garden.w||!S.garden.h)){toast('⚠ Entrez les dimensions du terrain');return;}
  S.step=Math.min(S.step+1,ST.FINAL);
  setTool('move');S.pending=null;
  fitView();draw();renderPanel();
}
function goPrev(){S.step=Math.max(S.step-1,0);setTool('move');renderPanel();draw();}
function jumpStep(i){if(i<=S.step)S.step=i;setTool('move');renderPanel();draw();}
function goFinalize(){
  S.step=ST.FINAL;setTool('move');S.pending=null;
  fitView();draw();renderPanel();
  document.getElementById('viewSwitch').style.display='flex';
  document.getElementById('growthPanel').style.display='block';
  updateStats();autosave();
  setTimeout(()=>toast('Jardin modélisé ! Passez en 3D 🌳'),400);
}

// ════════════════════════════════════════════════════════════
// ADD ELEMENTS
// ════════════════════════════════════════════════════════════
function addBati(){
  const type=document.getElementById('bType').value;
  const w=parseFloat(document.getElementById('bW')?.value)||0;
  const d=parseFloat(document.getElementById('bD')?.value)||0;
  const defH={house:3.5,terrace:0.2};
  const h=parseFloat(document.getElementById('bH')?.value)||defH[type];
  const names={house:'Maison',terrace:'Terrasse'};
  const el={id:-1,type,name:names[type],w,d,h,x:S.garden.w/2-w/2,y:S.garden.h/2-d/2};
  S.pending={...el};
  setTool('place');
  document.getElementById('tbPlace').style.display='inline-flex';
  toast('Tracez la zone sur le plan');
}

function addAlley(){
  const width=parseFloat(document.getElementById('aW')?.value)||1;
  S.pending={type:'alley',name:'Allée',width};
  setTool('place');
  document.getElementById('tbPlace').style.display='inline-flex';
  toast('Maintenez le clic et tracez le chemin');
}

function fillLawn(){
  // Remove any previous full-fill lawn, add one covering the whole garden behind everything
  S.elements=S.elements.filter(e=>!(e.type==='lawn'&&e.fill));
  const lawn={id:S.nextId++,type:'lawn',name:'Gazon (terrain)',fill:true,w:S.garden.w,d:S.garden.h,h:0,x:0,y:0};
  if(gardenHasPoly()) lawn.poly=gardenPoly().map(p=>({...p})); // épouse le terrain non rectangulaire
  S.elements.unshift(lawn);
  draw();updateStats();renderPanel();
  toast('Terrain rempli de gazon 🌿');
}

function addLawn(){
  const w=parseFloat(document.getElementById('lW')?.value)||0;
  const d=parseFloat(document.getElementById('lD')?.value)||0;
  const el={id:-1,type:'lawn',name:'Pelouse',w,d,h:0,x:0,y:0};
  S.pending={...el};setTool('place');
  document.getElementById('tbPlace').style.display='inline-flex';
  toast('Tracez la zone de pelouse sur le plan');
}

function addHedge(){
  const species=document.getElementById('hSpecies')?.value||Object.keys(HEDGE_DATA)[0];
  const w=parseFloat(document.getElementById('hW')?.value)||0;
  const d=parseFloat(document.getElementById('hD')?.value)||0;
  const h=parseFloat(document.getElementById('hH')?.value)||1.8;
  const el={id:-1,type:'hedge',name:species,w,d,h,x:0,y:0};
  S.pending={...el};setTool('place');
  document.getElementById('tbPlace').style.display='inline-flex';
  toast('Tracez la haie sur le plan');
}

function addTree(){
  const name=document.getElementById('tType').value;
  const height=parseFloat(document.getElementById('tH').value)||5;
  const base=TREE_DATA[name]?.spread||4;
  const spread=parseFloat((base*Math.min(1.6,height/7)).toFixed(1));
  const el={id:-1,type:'tree',name,h:height,spread,x:S.garden.w/2,y:S.garden.h/2};
  S.pending={...el};setTool('place');
  document.getElementById('tbPlace').style.display='inline-flex';
  toast('Cliquez pour placer l\'arbre');
}

