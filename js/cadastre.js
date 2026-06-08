// ============================================================
// cadastre.js
// Import du contour de parcelle ET des emprises de bâtiments (France) par adresse,
// via des API publiques gratuites, sans clé :
//   - Géocodage : Base Adresse Nationale (api-adresse.data.gouv.fr).
//   - Parcelle  : API Carto module cadastre de l'IGN (apicarto.ign.fr).
//   - Bâtiments : WFS Géoplateforme IGN (data.geopf.fr), couche BD TOPO « batiment »
//     — fournit l'emprise au sol ET la hauteur réelle du bâtiment.
// Parcelle + bâtiments sont projetés en mètres avec la MÊME origine pour rester alignés,
// puis posés via setGardenPolygon() (terrain) et des éléments `house` à contour (`poly`).
// ============================================================

const BAN_URL='https://api-adresse.data.gouv.fr/search/';
const APICARTO_PARCELLE='https://apicarto.ign.fr/api/cadastre/parcelle';
const GEOPF_WFS='https://data.geopf.fr/wfs/ows';

function cadStatus(msg,kind){
  const el=document.getElementById('cadStatus');
  if(!el)return;
  const col=kind==='err'?'#e0a0a0':kind==='ok'?'#a8d8a0':'rgba(255,255,255,.5)';
  el.style.color=col;el.innerHTML=msg;
}

// Géocodage adresse → {lon,lat,label}
async function geocodeAddress(q){
  const r=await fetch(`${BAN_URL}?q=${encodeURIComponent(q)}&limit=1`);
  if(!r.ok) throw new Error('geocodage HTTP '+r.status);
  const j=await r.json();
  if(!j.features||!j.features.length) throw new Error('adresse introuvable');
  const f=j.features[0];
  return {lon:f.geometry.coordinates[0], lat:f.geometry.coordinates[1], label:f.properties.label};
}

// Parcelle cadastrale au point (lon,lat) → anneau extérieur [{lon,lat}, ...]
async function fetchParcelRing(lon,lat){
  const geom=encodeURIComponent(JSON.stringify({type:'Point',coordinates:[lon,lat]}));
  const r=await fetch(`${APICARTO_PARCELLE}?geom=${geom}`);
  if(!r.ok) throw new Error('cadastre HTTP '+r.status);
  const j=await r.json();
  if(!j.features||!j.features.length) throw new Error('aucune parcelle à cette adresse');
  let g=j.features[0].geometry;
  let coords=g.type==='MultiPolygon'?g.coordinates[0][0]:g.coordinates[0]; // anneau extérieur
  return coords.map(c=>({lon:c[0],lat:c[1]}));
}

// Bâtiments BD TOPO dans l'emprise (lon/lat) de la parcelle → [{ring:[{lon,lat}], hauteur, usage}]
async function fetchBuildings(parcelRing){
  let minLon=Infinity,minLat=Infinity,maxLon=-Infinity,maxLat=-Infinity;
  parcelRing.forEach(p=>{minLon=Math.min(minLon,p.lon);maxLon=Math.max(maxLon,p.lon);minLat=Math.min(minLat,p.lat);maxLat=Math.max(maxLat,p.lat);});
  const bbox=`${minLat},${minLon},${maxLat},${maxLon}`; // WFS EPSG:4326 → ordre lat,lon
  const url=`${GEOPF_WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&outputFormat=application/json`
    +`&srsName=EPSG:4326&count=60&typeNames=${encodeURIComponent('BDTOPO_V3:batiment')}&bbox=${encodeURIComponent(bbox)}`;
  const r=await fetch(url);
  if(!r.ok) throw new Error('bâtiments HTTP '+r.status);
  const j=await r.json();
  const out=[];
  (j.features||[]).forEach(f=>{
    const g=f.geometry; if(!g) return;
    const polys=g.type==='MultiPolygon'?g.coordinates:(g.type==='Polygon'?[g.coordinates]:[]);
    polys.forEach(poly=>{
      const ring=poly[0].map(c=>({lon:c[0],lat:c[1]})); // ignore l'éventuelle altitude c[2]
      out.push({ring, hauteur:f.properties.hauteur, usage:f.properties.usage_1});
    });
  });
  return out;
}

// Projection équirectangulaire lon/lat → mètres locaux (x est, y sud) autour d'une origine commune.
function projectLonLat(ring,lon0,lat0){
  const mPerLat=110540, mPerLon=111320*Math.cos(lat0*Math.PI/180);
  return ring.map(p=>({x:(p.lon-lon0)*mPerLon, y:(lat0-p.lat)*mPerLat}));
}
// Retire le point de fermeture et les points trop rapprochés (< minD m).
function dedupeRing(pts,minD){
  if(pts.length>1){const a=pts[0],b=pts[pts.length-1];if(Math.hypot(a.x-b.x,a.y-b.y)<0.01)pts=pts.slice(0,-1);}
  const out=[];for(const p of pts){const l=out[out.length-1];if(!l||Math.hypot(p.x-l.x,p.y-l.y)>minD)out.push(p);}
  return out;
}

async function importCadastre(){
  const addr=(document.getElementById('cadAddr')?.value||'').trim();
  if(!addr){cadStatus('Saisissez une adresse.','err');return;}
  const btn=document.getElementById('cadBtn');
  if(btn)btn.disabled=true;
  cadStatus('🔎 Recherche de l\'adresse…');
  try{
    const geo=await geocodeAddress(addr);
    cadStatus(`📍 ${geo.label}<br>Recherche de la parcelle…`);
    const parcelRing=await fetchParcelRing(geo.lon,geo.lat);

    // Origine de projection commune = centroïde lon/lat de la parcelle
    const lon0=parcelRing.reduce((a,p)=>a+p.lon,0)/parcelRing.length;
    const lat0=parcelRing.reduce((a,p)=>a+p.lat,0)/parcelRing.length;
    let parcelRaw=dedupeRing(projectLonLat(parcelRing,lon0,lat0),0.3);
    if(parcelRaw.length<3) throw new Error('contour de parcelle invalide');

    // ALIGNEMENT GRILLE : on tourne la géométrie de -θ autour du centroïde pour que le bord
    // dominant de la parcelle soit parallèle aux axes de la grille (placement aligné au terrain).
    const C={x:parcelRaw.reduce((a,p)=>a+p.x,0)/parcelRaw.length, y:parcelRaw.reduce((a,p)=>a+p.y,0)/parcelRaw.length};
    const theta=polyDominantAngle(parcelRaw);
    const ct=Math.cos(theta), stt=Math.sin(theta);
    const align=p=>({x:C.x+(p.x-C.x)*ct+(p.y-C.y)*stt, y:C.y-(p.x-C.x)*stt+(p.y-C.y)*ct}); // R(-θ) autour de C

    const parcelAligned=parcelRaw.map(align);
    const bb=polyBBox(parcelAligned);
    const off={x:bb.minx,y:bb.miny};                 // décalage pour amener le coin à (0,0)
    const parcelM=parcelAligned.map(p=>({x:+(p.x-off.x).toFixed(2),y:+(p.y-off.y).toFixed(2)}));
    setGardenPolygon(parcelM);
    S.garden.north=-theta;     // cap du vrai nord pour la boussole (la vue est alignée grille)
    CAM.rot=0;                 // afficher la parcelle alignée sur la grille

    // Bâtiments (best-effort : ne bloque pas l'import si indisponible)
    let nB=0;
    try{
      cadStatus(`📍 ${geo.label}<br>Recherche des bâtiments…`);
      const builds=await fetchBuildings(parcelRing);
      S.elements=S.elements.filter(e=>e.src!=='cadastre');   // remplace un import précédent
      builds.forEach(b=>{
        let ring=dedupeRing(projectLonLat(b.ring,lon0,lat0).map(align).map(p=>({x:p.x-off.x,y:p.y-off.y})),0.2);
        if(ring.length<3) return;
        // ne garder que les bâtiments qui touchent la parcelle
        const c=polyCentroid(ring);
        const touches=pointInPoly(c,parcelM)||ring.some(p=>pointInPoly(p,parcelM))||parcelM.some(p=>pointInPoly(p,ring));
        if(!touches) return;
        const bbb=polyBBox(ring);
        if(bbb.w<1&&bbb.h<1) return;                         // ignore les micro-emprises
        const h=(typeof b.hauteur==='number'&&b.hauteur>0)?+b.hauteur.toFixed(1):3.5;
        const name=b.usage==='Résidentiel'?'Maison':'Bâtiment';
        S.elements.push({id:S.nextId++,type:'house',name,src:'cadastre',
          poly:ring.map(p=>({x:+p.x.toFixed(2),y:+p.y.toFixed(2)})),
          x:+bbb.minx.toFixed(2),y:+bbb.miny.toFixed(2),w:+bbb.w.toFixed(2),d:+bbb.h.toFixed(2),
          h,rot:0});
        nB++;
      });
    }catch(e){ /* bâtiments non bloquants */ }

    S.step=Math.max(S.step,ST.TERRAIN);
    fitView();draw();renderPanel();autosave();
    const aire=Math.round(polyArea(gardenPoly()));
    cadStatus(`✓ Parcelle importée — ${aire} m²`+(nB?` · ${nB} bâtiment(s)`:'')+` (≈ ${S.garden.w}×${S.garden.h} m)`,'ok');
    toast(nB?`Parcelle + ${nB} bâtiment(s) importés ✓`:'Parcelle cadastrale importée ✓');
  }catch(e){
    cadStatus(`⚠ ${e.message}.<br>Vérifiez l'adresse ou saisissez les dimensions manuellement.`,'err');
  }finally{
    if(btn)btn.disabled=false;
  }
}
