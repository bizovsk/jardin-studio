// ============================================================
// plantnet.js
// Identification d'une plante par PHOTO via l'API Pl@ntNet (my-api.plantnet.org).
// CORS ouvert → appel 100 % côté navigateur, sans proxy. Chaque utilisateur fournit sa
// PROPRE clé API (compte gratuit my.plantnet.org), stockée UNIQUEMENT en local (jamais commitée).
// Les candidats réutilisent le flux d'espèces de species-search.js (forme déduite de la famille
// + entretien générique via pickSpecies / registerCustomTree|Hedge).
// ============================================================

const PLANTNET_LS='jardinstudio:plantnetKey';
function getPlantNetKey(){ try{return localStorage.getItem(PLANTNET_LS)||'';}catch(e){return '';} }
function setPlantNetKey(k){ try{localStorage.setItem(PLANTNET_LS,(k||'').trim());}catch(e){} }

// Envoie l'image à Pl@ntNet → [{sci, fr, family, score}] (meilleurs candidats).
async function identifyPhoto(file,key){
  const fd=new FormData();
  fd.append('images',file);
  fd.append('organs','auto');     // Pl@ntNet détecte l'organe (feuille/fleur/fruit/écorce)
  const url=`https://my-api.plantnet.org/v2/identify/all`
    +`?api-key=${encodeURIComponent(key)}&lang=fr&nb-results=6&include-related-images=false`;
  const r=await fetch(url,{method:'POST',body:fd});
  if(r.status===401||r.status===403) throw new Error('clé API invalide ou quota dépassé');
  if(r.status===404) throw new Error('aucune espèce reconnue sur la photo');
  if(!r.ok) throw new Error('PlantNet HTTP '+r.status);
  const j=await r.json();
  return (j.results||[]).map(x=>{
    const sp=x.species||{};
    return {
      sci:sp.scientificNameWithoutAuthor,
      fr:(sp.commonNames&&sp.commonNames[0])||null,
      family:(sp.family&&sp.family.scientificNameWithoutAuthor)||'',
      score:x.score||0
    };
  }).filter(r=>r.sci);
}

// Déclenché par le champ fichier (étapes Arbres / Haies).
async function runPhotoId(kind,file){
  if(!file) return;
  const box=document.getElementById(kind+'SearchResults');
  const key=getPlantNetKey();
  if(!key){ if(box)box.innerHTML='<div class="sr-info">⚙ Renseigne d\'abord ta clé API Pl@ntNet (ci-dessous).</div>'; return; }
  if(box) box.innerHTML='<div class="sr-info">📷 Identification Pl@ntNet en cours…</div>';
  try{
    const res=await identifyPhoto(file,key);
    if(!res.length){ if(box)box.innerHTML='<div class="sr-info">Aucune espèce reconnue.</div>'; return; }
    const rows=res.map(r=>({
      name:r.fr||r.sci,
      sub:(r.fr?r.sci:r.family)+' · '+Math.round(r.score*100)+'%',
      family:r.family
    }));
    _renderSearchRows(kind,box,rows);   // mêmes lignes cliquables que la recherche GBIF
  }catch(e){
    if(box) box.innerHTML='<div class="sr-info">⚠ '+(e.message||e)+'</div>';
  }
}
