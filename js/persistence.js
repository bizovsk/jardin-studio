// ============================================================
// persistence.js
// Sauvegarde/chargement (localStorage), projets, import/export .json, export PNG.
// ============================================================

// PERSISTENCE / PROJECTS
// ════════════════════════════════════════════════════════════
const LS_PREFIX='jardinstudio:';
function serialize(){return JSON.stringify({garden:S.garden,elements:S.elements,nextId:S.nextId,region:S.region,projectName:S.projectName,step:S.step,customSpecies:S.customSpecies});}
function applyData(d){
  S.garden=d.garden||{w:0,h:0};
  S.elements=d.elements||[];
  S.nextId=d.nextId||(S.elements.reduce((m,e)=>Math.max(m,e.id),0)+1);
  S.region=d.region||'Centre';
  S.projectName=d.projectName||'Mon jardin';
  S.step=d.step!=null?d.step:ST.FINAL;
  S.customSpecies=d.customSpecies||{trees:{},hedges:{}};
  if(typeof reinjectCustomSpecies==='function')reinjectCustomSpecies(); // réintègre les espèces GBIF dans TREE_DATA/HEDGE_DATA
  S.selected=null;
}
function lsAvailable(){try{localStorage.setItem('__t','1');localStorage.removeItem('__t');return true;}catch(e){return false;}}
function autosave(){if(!lsAvailable())return;try{localStorage.setItem(LS_PREFIX+'__autosave',serialize());}catch(e){}}
function loadAutosave(){
  if(!lsAvailable())return false;
  try{const raw=localStorage.getItem(LS_PREFIX+'__autosave');if(!raw)return false;applyData(JSON.parse(raw));return true;}catch(e){return false;}
}
function quickSave(){
  if(!S.garden.w){toast('Rien à enregistrer pour l\'instant');return;}
  if(!lsAvailable()){toast('Stockage indisponible — utilisez Exporter .json');return;}
  saveProjectNamed(S.projectName||'Mon jardin');
  toast('💾 Enregistré : '+S.projectName);
}
function saveProjectNamed(name){
  try{localStorage.setItem(LS_PREFIX+'proj:'+name,serialize());
    localStorage.setItem(LS_PREFIX+'proj:'+name+':date',new Date().toLocaleString('fr-FR'));}catch(e){}
}
function listProjects(){
  if(!lsAvailable())return [];
  return Object.keys(localStorage).filter(k=>k.startsWith(LS_PREFIX+'proj:')&&!k.endsWith(':date'))
    .map(k=>({name:k.slice((LS_PREFIX+'proj:').length),date:localStorage.getItem(k+':date')||''}));
}
function openProjects(){
  document.getElementById('projNameInput').value=S.projectName||'Mon jardin';
  renderProjectList();
  document.getElementById('projModal').style.display='flex';
}
function closeProjects(){document.getElementById('projModal').style.display='none';}
function renderProjectList(){
  const list=listProjects();
  const el=document.getElementById('projList');
  if(!lsAvailable()){el.innerHTML='<div style="font-size:12px;color:rgba(255,255,255,.4)">Stockage local indisponible dans ce contexte. Utilisez Exporter / Importer .json.</div>';return;}
  if(!list.length){el.innerHTML='<div style="font-size:12px;color:rgba(255,255,255,.35)">Aucun projet enregistré.</div>';return;}
  el.innerHTML=list.map(p=>`<div class="proj-row">
    <div class="nm">${p.name}<div class="dt">${p.date}</div></div>
    <button class="mini-btn" onclick="loadProject('${p.name.replace(/'/g,"\\'")}')">Ouvrir</button>
    <button class="mini-btn danger" onclick="deleteProject('${p.name.replace(/'/g,"\\'")}')">✕</button>
  </div>`).join('');
}
function saveProjectAs(){
  const name=(document.getElementById('projNameInput').value||'Mon jardin').trim();
  S.projectName=name;
  if(!lsAvailable()){toast('Stockage indisponible — exportez en .json');return;}
  saveProjectNamed(name);renderProjectList();toast('💾 Projet sauvegardé');
}
function loadProject(name){
  try{const raw=localStorage.getItem(LS_PREFIX+'proj:'+name);if(!raw){toast('Introuvable');return;}
    applyData(JSON.parse(raw));closeProjects();
    enterLoadedState();toast('Projet chargé : '+name);
  }catch(e){toast('Erreur de chargement');}
}
function deleteProject(name){
  try{localStorage.removeItem(LS_PREFIX+'proj:'+name);localStorage.removeItem(LS_PREFIX+'proj:'+name+':date');}catch(e){}
  renderProjectList();
}
function newGarden(){
  S.garden={w:0,h:0};S.elements=[];S.nextId=1;S.selected=null;S.step=ST.TERRAIN;S.growth=0;S.projectName='Mon jardin';
  closeProjects();setView('2d');
  document.getElementById('viewSwitch').style.display='none';
  document.getElementById('growthPanel').style.display='none';
  document.getElementById('sunPanel').style.display='none';
  fitView();draw();renderPanel();autosave();
}
function enterLoadedState(){
  S.step=ST.FINAL;setTool('move');
  document.getElementById('viewSwitch').style.display='flex';
  document.getElementById('growthPanel').style.display='block';
  setView('2d');fitView();draw();renderPanel();updateStats();
}

// Export / import JSON file
function downloadFile(filename,content,mime){
  const blob=new Blob([content],{type:mime||'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportJSON(){
  downloadFile((S.projectName||'jardin')+'.json',serialize(),'application/json');
  toast('Projet exporté en .json');
}
function importJSON(ev){
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=()=>{try{applyData(JSON.parse(r.result));closeProjects();enterLoadedState();toast('Projet importé');}catch(e){toast('Fichier invalide');}};
  r.readAsText(f);
  ev.target.value='';
}

// Export PNG of the 2D plan
function exportPNG(){
  if(S.view!=='2d'){toast('Passez en Plan 2D pour exporter l\'image');return;}
  if(!S.garden.w){toast('Rien à exporter');return;}
  draw();
  try{
    const url=cv.toDataURL('image/png');
    const a=document.createElement('a');a.href=url;a.download=(S.projectName||'jardin')+'-plan.png';a.click();
    toast('🖼 Image du plan exportée');
  }catch(e){toast('Export impossible');}
}

