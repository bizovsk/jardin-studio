// ============================================================
// species-search.js
// Recherche de N'IMPORTE QUELLE plante via l'API GBIF (gratuit, sans clé, CORS ouvert).
// L'espèce choisie est enregistrée dans TREE_DATA / HEDGE_DATA avec une forme déduite de la
// famille botanique et un entretien générique (repli), puis devient sélectionnable.
// Les espèces ajoutées sont mémorisées dans S.customSpecies (donc sérialisées / persistées).
// ============================================================

const GBIF_BACKBONE='d7dddbf4-2cf0-4f39-9b2a-bb099caae36c';

// Déduit une apparence 3D plausible à partir de la famille botanique.
function guessTreeDef(family){
  const f=(family||'').toLowerCase();
  if(/pinaceae|cupressaceae|taxaceae|sciadopityaceae|araucariaceae/.test(f)) return {spread:3,form:'cone',color:'#1e4a1e',trunk:'#5a3a1a'};
  if(/arecaceae/.test(f)) return {spread:3,form:'palm',color:'#5a9040',trunk:'#8a6a2a'};
  if(/poaceae/.test(f)) return {spread:1.5,form:'column',color:'#5a8840',trunk:'#5a8840'};
  if(/salicaceae/.test(f)) return {spread:6,form:'weeping',color:'#7aa84a',trunk:'#6a5a2a'};
  return {spread:4,form:'round',color:'#4a8035',trunk:'#5a3a1a'};
}

// Enregistre (sans écraser) une espèce d'arbre. Renvoie le nom retenu.
function registerCustomTree(name,family){
  if(!name||TREE_DATA[name]) return name;            // déjà connue : on réutilise
  const def={...guessTreeDef(family),custom:true};
  TREE_DATA[name]=def;
  S.customSpecies.trees[name]=def;
  return name;
}
// Enregistre (sans écraser) une espèce de haie/arbuste. Entretien générique de haie.
function registerCustomHedge(name){
  if(!name||HEDGE_DATA[name]) return name;
  const def={color:'#2e5a2c',custom:true,tasks:MAINTENANCE.hedge.tasks.map(t=>({...t}))};
  HEDGE_DATA[name]=def;
  S.customSpecies.hedges[name]=def;
  return name;
}
// Réintègre les espèces persistées au chargement d'un projet.
function reinjectCustomSpecies(){
  const cs=S.customSpecies||{trees:{},hedges:{}};
  Object.entries(cs.trees||{}).forEach(([n,d])=>{if(!TREE_DATA[n])TREE_DATA[n]=d;});
  Object.entries(cs.hedges||{}).forEach(([n,d])=>{if(!HEDGE_DATA[n])HEDGE_DATA[n]=d;});
}

// Recherche GBIF (référentiel backbone) → [{name, fr, sci, family}] dédupliqué.
async function gbifSearch(q){
  // highertaxonKey=6 → uniquement le règne végétal (Plantae), sinon GBIF renvoie aussi insectes/champignons.
  const url=`https://api.gbif.org/v1/species/search?q=${encodeURIComponent(q)}`
    +`&rank=SPECIES&status=ACCEPTED&highertaxonKey=6&datasetKey=${GBIF_BACKBONE}&limit=12`;
  const r=await fetch(url);
  if(!r.ok) throw new Error('GBIF HTTP '+r.status);
  const j=await r.json();
  const seen=new Set(),rows=[];
  (j.results||[]).forEach(x=>{
    if(!x.canonicalName||seen.has(x.canonicalName))return;seen.add(x.canonicalName);
    const fr=(x.vernacularNames||[]).find(v=>v.language==='fra');
    rows.push({sci:x.canonicalName, fr:fr?fr.vernacularName.split(',')[0].trim():null, family:x.family});
  });
  return rows.slice(0,8);
}

// Rendu d'une liste de lignes {name, sub, family} (ou {info}).
function _renderSearchRows(kind,box,rows){
  if(!rows.length){box.innerHTML='<div class="sr-info">Aucun résultat</div>';return;}
  box.innerHTML=rows.map(r=>{
    if(r.info)return `<div class="sr-info">${r.info}</div>`;
    const arg=r.name.replace(/'/g,"\\'");
    const fam=(r.family||'').replace(/'/g,"\\'");
    return `<div class="sr-item" onclick="pickSpecies('${kind}','${arg}','${fam}')">
      <span class="sr-name">${r.name}</span><span class="sr-sub">${r.sub||''}</span></div>`;
  }).join('');
}

let _searchTimer=null,_searchSeq=0;
function searchSpecies(kind,q){
  const box=document.getElementById(kind+'SearchResults');
  q=(q||'').trim();
  if(!box)return;
  if(q.length<2){box.innerHTML='';return;}
  // 1) correspondances locales (base curée) affichées immédiatement
  const table=kind==='tree'?TREE_DATA:HEDGE_DATA;
  const ql=q.toLowerCase();
  const local=Object.keys(table).filter(n=>n.toLowerCase().includes(ql)).slice(0,6)
    .map(n=>({name:n,sub:'déjà dans la base'}));
  _renderSearchRows(kind,box,local.length?local:[{info:'Recherche…'}]);
  if(q.length<3)return;                               // GBIF à partir de 3 caractères
  // 2) résultats GBIF ajoutés ensuite (dédupliqués des locaux)
  clearTimeout(_searchTimer);
  const seq=++_searchSeq;
  _searchTimer=setTimeout(async()=>{
    let gbif=[];
    try{ gbif=await gbifSearch(q); }catch(e){ if(seq===_searchSeq&&!local.length)box.innerHTML='<div class="sr-info">Recherche indisponible (réseau)</div>'; return; }
    if(seq!==_searchSeq)return;                       // résultat obsolète
    const have=new Set(local.map(l=>l.name.toLowerCase()));
    const merged=[...local];
    gbif.forEach(r=>{const label=r.fr||r.sci; if(!have.has(label.toLowerCase())){have.add(label.toLowerCase());merged.push({name:label,sub:r.fr?r.sci:(r.family||''),family:r.family});}});
    _renderSearchRows(kind,box,merged);
  },280);
}

function pickSpecies(kind,name,family){
  if(kind==='tree') registerCustomTree(name,family);
  else registerCustomHedge(name);
  renderPanel();
  const sel=document.getElementById(kind==='tree'?'tType':'hSpecies');
  if(sel){sel.value=name; if(kind==='tree')renderPanel();}
  toast('Espèce sélectionnée : '+name);
}
