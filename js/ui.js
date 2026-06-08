// ============================================================
// ui.js
// Interface laterale : etapes du parcours, panneau d'edition, listes d'elements, stats, toasts.
// ============================================================

// ════════════════════════════════════════════════════════════
// STATS
// ════════════════════════════════════════════════════════════
function updateStats(){
  if(S.step<ST.FINAL){document.getElementById('statsChips').style.display='none';return;}
  const lawn=S.elements.filter(e=>e.type==='lawn').reduce((a,e)=>a+(e.poly?polyArea(e.poly):(e.w||0)*(e.d||0)),0);
  const trees=S.elements.filter(e=>e.type==='tree').length;
  const hedges=S.elements.filter(e=>e.type==='hedge').length;
  const areaTot=Math.round(gardenArea());
  const dim=gardenHasPoly()?`Terrain <strong>${areaTot}m²</strong>`:`<strong>${S.garden.w}×${S.garden.h}m</strong> — ${areaTot}m²`;
  document.getElementById('statsChips').style.display='flex';
  document.getElementById('statsChips').innerHTML=`
    <div class="chip">${dim}</div>
    <div class="chip">Pelouse <strong>${Math.round(lawn)}m²</strong></div>
    <div class="chip"><strong>${trees}</strong> arbre(s) · <strong>${hedges}</strong> haie(s)</div>
  `;
}

// ════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════
let toastTimer;
function toast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2000);
}

// Bloc « identifier par photo » (Pl@ntNet) — partagé Arbres / Haies. Les candidats s'affichent
// dans le conteneur de résultats de la recherche (#${kind}SearchResults).
function photoBlock(kind){
  const k=getPlantNetKey();
  return `<div class="field">
    <label>📷 Ou identifier par photo (Pl@ntNet)</label>
    <input type="file" id="${kind}Photo" accept="image/*" capture="environment" style="display:none" onchange="runPhotoId('${kind}',this.files[0]);this.value=''">
    <button class="btn btn-ghost" style="width:100%" onclick="document.getElementById('${kind}Photo').click()">📷 Prendre / choisir une photo</button>
    <details style="margin-top:6px"><summary style="font-size:10.5px;color:rgba(255,255,255,.4);cursor:pointer">⚙ Clé API Pl@ntNet ${k?'✓':'(requise)'}</summary>
      <input type="password" placeholder="colle ta clé Pl@ntNet" value="${k}" oninput="setPlantNetKey(this.value)" style="margin-top:6px">
      <div style="font-size:10px;color:rgba(255,255,255,.35);margin-top:4px;line-height:1.5">Compte gratuit sur my.plantnet.org. Clé stockée uniquement sur cet appareil.</div>
    </details>
  </div>`;
}

// ════════════════════════════════════════════════════════════
// PANEL / SIDEBAR RENDERING
// ════════════════════════════════════════════════════════════
function renderPanel(){
  const pc=document.getElementById('panelContent');
  const pf=document.getElementById('panelFoot');
  const pb=document.getElementById('progBar');

  pb.innerHTML=STEP_NAMES.map((n,i)=>`<div class="prog-step ${i<S.step?'done':i===S.step?'active':''}" title="${n}" onclick="jumpStep(${i})"></div>`).join('');

  const els_bati=S.elements.filter(e=>['house','terrace'].includes(e.type));
  const els_alley=S.elements.filter(e=>e.type==='alley');
  const els_lawn=S.elements.filter(e=>e.type==='lawn');
  const els_hedge=S.elements.filter(e=>e.type==='hedge');
  const els_tree=S.elements.filter(e=>e.type==='tree');

  const next=S.step<ST.FINAL?`<button class="btn btn-sage" onclick="goNext()">Continuer →</button>`:'';
  const back=S.step>0?`<button class="btn btn-ghost" onclick="goPrev()">← Retour</button>`:'';

  if(S.step===ST.TERRAIN){
    const hasPoly=gardenHasPoly();
    pc.innerHTML=`
      <div class="step-label">Étape 1 sur 6</div>
      <div class="step-title">Votre terrain</div>
      <div class="step-sub">Entrez les dimensions en mètres, ou importez le contour réel de votre parcelle depuis une adresse.</div>
      <div class="form-card">
        <div class="form-card-head">Dimensions de la propriété</div>
        ${hasPoly?`
          <div class="spread-badge">🛰 Contour cadastral importé — ${Math.round(gardenArea())} m² (emprise ${S.garden.w}×${S.garden.h} m)</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="clearGardenPolygon();fitView();draw();renderPanel();toast('Terrain remis en rectangle')">↩ Revenir à un rectangle</button>
        `:`
          <div class="row2">
            <div class="field"><label>Longueur (m)</label><input type="number" id="gw" placeholder="ex : 20" min="1" max="500" value="${S.garden.w||''}" oninput="S.garden.w=+this.value||0;fitView();draw()"></div>
            <div class="field"><label>Largeur (m)</label><input type="number" id="gh" placeholder="ex : 15" min="1" max="500" value="${S.garden.h||''}" oninput="S.garden.h=+this.value||0;fitView();draw()"></div>
          </div>
          ${S.garden.w&&S.garden.h?`<div class="spread-badge">📐 Superficie : ${Math.round(gardenArea())} m²</div>`:''}
        `}
      </div>
      <div class="form-card">
        <div class="form-card-head">🛰 Importer ma parcelle (France)</div>
        <div class="field"><label>Adresse</label><input type="text" id="cadAddr" placeholder="ex : 12 rue des Lilas, 69100 Villeurbanne" onkeydown="if(event.key==='Enter')importCadastre()"></div>
        <button class="btn btn-ghost" id="cadBtn" onclick="importCadastre()" style="margin-top:4px">📍 Récupérer le contour cadastral</button>
        <div id="cadStatus" style="font-size:11px;color:rgba(255,255,255,.45);margin-top:8px;line-height:1.5"></div>
        <div style="font-size:10px;color:rgba(255,255,255,.3);margin-top:8px;line-height:1.5">Données : Base Adresse Nationale + cadastre IGN (gratuit, sans compte). Le contour réel sert de forme de terrain.</div>
      </div>
    `;
    pf.innerHTML=next;
  }

  else if(S.step===ST.BATI){
    pc.innerHTML=`
      <div class="step-label">Étape 2 sur 6</div>
      <div class="step-title">Maison & Terrasse</div>
      <div class="step-sub">Choisissez le type, puis tracez la zone directement sur le plan.</div>
      <div class="form-card">
        <div class="form-card-head">Nouvel élément</div>
        <div class="field"><label>Type</label>
          <select id="bType"><option value="house">🏠 Maison</option><option value="terrace">🪨 Terrasse</option></select>
        </div>
        <div class="field"><label>Hauteur (m) — optionnel</label><input type="number" id="bH" placeholder="auto" min=".1" step=".5"></div>
        <button class="btn btn-sage" onclick="addBati()" style="margin-top:4px">✏ Tracer sur le plan</button>
        <details style="margin-top:10px"><summary style="font-size:11px;color:rgba(255,255,255,.4);cursor:pointer">Saisir des dimensions exactes</summary>
          <div class="row2" style="margin-top:8px">
            <div class="field"><label>Long. (m)</label><input type="number" id="bW" placeholder="auto" min=".5" step=".5"></div>
            <div class="field"><label>Larg. (m)</label><input type="number" id="bD" placeholder="auto" min=".5" step=".5"></div>
          </div>
        </details>
      </div>
      ${els_bati.length?`<div class="items-section"><div class="items-title">${els_bati.length} élément(s)</div>${itemsList(els_bati)}</div>`:''}
    `;
    pf.innerHTML=back+next;
  }

  else if(S.step===ST.ALLEE){
    pc.innerHTML=`
      <div class="step-label">Étape 3 sur 6</div>
      <div class="step-title">Allées</div>
      <div class="step-sub">Maintenez le clic et déplacez la souris pour dessiner le tracé de l'allée à main levée.</div>
      <div class="form-card">
        <div class="form-card-head">Nouvelle allée</div>
        <div class="field"><label>Largeur de l'allée (m)</label><input type="number" id="aW" placeholder="1" min=".3" max="5" step=".1" value="1"></div>
        <button class="btn btn-sage" onclick="addAlley()" style="margin-top:4px">✏ Dessiner une allée</button>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:10px;line-height:1.6">Astuce : restez appuyé du début à la fin du chemin, puis relâchez pour terminer.</div>
      </div>
      ${els_alley.length?`<div class="items-section"><div class="items-title">${els_alley.length} allée(s)</div>${itemsList(els_alley)}</div>`:''}
    `;
    pf.innerHTML=back+next;
  }

  else if(S.step===ST.HAIE){
    const hSpecies=document.getElementById('hSpecies')?.value||Object.keys(HEDGE_DATA)[0];
    pc.innerHTML=`
      <div class="step-label">Étape 4 sur 6</div>
      <div class="step-title">Haies</div>
      <div class="step-sub">Choisissez l'espèce, puis tracez la haie sur le plan (un rectangle fin et long).</div>
      <div class="form-card">
        <div class="form-card-head">Nouvelle haie</div>
        <div class="field"><label>Espèce</label>
          <select id="hSpecies">${Object.keys(HEDGE_DATA).map(s=>`<option${s===hSpecies?' selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="field"><label>🔎 Ou rechercher une autre espèce (toutes plantes)</label>
          <input type="text" id="hedgeSearch" placeholder="ex : cornouiller sanguin, viorne…" autocomplete="off" oninput="searchSpecies('hedge',this.value)">
          <div id="hedgeSearchResults" class="search-results"></div>
        </div>
        ${photoBlock('hedge')}
        <div class="field"><label>Hauteur (m) — optionnel</label><input type="number" id="hH" placeholder="1.8" min=".3" step=".1"></div>
        <button class="btn btn-sage" onclick="addHedge()" style="margin-top:4px">✏ Tracer une haie</button>
        <button class="btn btn-ghost" id="btnARHedge" style="display:none;margin-top:4px" onclick="arPlaceSelected('hedge')">🌿 Placer en AR</button>
        <details style="margin-top:10px"><summary style="font-size:11px;color:rgba(255,255,255,.4);cursor:pointer">Saisir des dimensions exactes</summary>
          <div class="row2" style="margin-top:8px">
            <div class="field"><label>Long. (m)</label><input type="number" id="hW" placeholder="auto" min=".5" step=".5"></div>
            <div class="field"><label>Épais. (m)</label><input type="number" id="hD" placeholder="auto" min=".1" step=".1"></div>
          </div>
        </details>
      </div>
      ${els_hedge.length?`<div class="items-section"><div class="items-title">${els_hedge.length} haie(s)</div>${itemsList(els_hedge)}</div>`:''}
    `;
    pf.innerHTML=back+next;
    if(typeof arShowSidebarBtn==='function') arShowSidebarBtn('hedge');
  }

  else if(S.step===ST.ARBRE){
    const selType=document.getElementById('tType')?.value||Object.keys(TREE_DATA)[0];
    const baseSpread=TREE_DATA[selType]?.spread||4;
    const th=parseFloat(document.getElementById('tH')?.value)||5;
    const autoSpread=(baseSpread*Math.min(1.6,th/7)).toFixed(1);
    pc.innerHTML=`
      <div class="step-label">Étape 5 sur 6</div>
      <div class="step-title">Arbres & Arbustes</div>
      <div class="step-sub">Renseignez l'espèce et la hauteur. La frondaison est calculée automatiquement.</div>
      <div class="form-card">
        <div class="form-card-head">Nouvel arbre</div>
        <div class="field"><label>Espèce</label>
          <select id="tType" onchange="renderPanel()">
            ${Object.keys(TREE_DATA).map(t=>`<option${t===selType?' selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>🔎 Ou rechercher une autre espèce (toutes plantes)</label>
          <input type="text" id="treeSearch" placeholder="ex : séquoia, jacaranda, ginkgo…" autocomplete="off" oninput="searchSpecies('tree',this.value)">
          <div id="treeSearchResults" class="search-results"></div>
        </div>
        ${photoBlock('tree')}
        <div class="row2">
          <div class="field"><label>Hauteur (m)</label><input type="number" id="tH" placeholder="5" min=".5" step=".5" value="${th}" oninput="renderPanel()"></div>
          <div class="field"><label>Frondaison auto</label><input type="text" value="⌀ ${autoSpread}m" disabled style="opacity:.6"></div>
        </div>
        <div class="spread-badge">🌳 ${TREE_DATA[selType]?.form==='cone'?'Port conique':TREE_DATA[selType]?.form==='column'?'Port colonnaire':TREE_DATA[selType]?.form==='palm'?'Palmiforme':TREE_DATA[selType]?.form==='narrow'?'Port élancé':TREE_DATA[selType]?.form==='weeping'?'Port pleureur':'Port arrondi'}${TREE_DATA[selType]?.custom?' · espèce ajoutée (GBIF)':''}</div>
        <button class="btn btn-sage" onclick="addTree()" style="margin-top:10px">Ajouter et placer</button>
        <button class="btn btn-ghost" id="btnARTree" style="display:none;margin-top:4px" onclick="arPlaceSelected('tree')">🌿 Placer en AR</button>
      </div>
      ${els_tree.length?`<div class="items-section"><div class="items-title">${els_tree.length} arbre(s)</div>${itemsList(els_tree)}</div>`:''}
    `;
    pf.innerHTML=back+next;
    if(typeof arShowSidebarBtn==='function') arShowSidebarBtn('tree');
  }

  else if(S.step===ST.GAZON){
    const hasFill=S.elements.some(e=>e.type==='lawn'&&e.fill);
    pc.innerHTML=`
      <div class="step-label">Étape 6 sur 6</div>
      <div class="step-title">Gazon</div>
      <div class="step-sub">Le gazon se place en dernier et comble tout l'espace libre du terrain.</div>
      <div class="form-card">
        <div class="form-card-head">Remplissage</div>
        <button class="btn ${hasFill?'btn-ghost':'btn-sage'}" onclick="fillLawn()">${hasFill?'✓ Terrain rempli — recliquer pour régénérer':'🌿 Remplir tout l\'espace libre'}</button>
        <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:10px;line-height:1.6">Le gazon s'affiche sous tous les autres éléments : il habille automatiquement les zones non occupées.</div>
        <details style="margin-top:10px"><summary style="font-size:11px;color:rgba(255,255,255,.4);cursor:pointer">Tracer une zone précise à la place</summary>
          <button class="btn btn-sage" onclick="addLawn()" style="margin-top:8px">✏ Tracer une pelouse</button>
        </details>
      </div>
      ${els_lawn.length?`<div class="items-section"><div class="items-title">${els_lawn.length} zone(s) de gazon</div>${itemsList(els_lawn)}</div>`:''}
    `;
    pf.innerHTML=back+`<button class="btn btn-gold" onclick="goFinalize()">Voir le jardin 🌳</button>`;
  }

  else if(S.step===ST.FINAL){
    const allEls=S.elements;
    pc.innerHTML=`
      <div class="step-label">Jardin complet</div>
      <div class="step-title">Mon jardin</div>
      <div class="step-sub">Naviguez en 2D / 3D / 3D+ et consultez le calendrier d'entretien.</div>
      <div style="background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px;margin-bottom:16px;font-size:11px;color:rgba(255,255,255,.4);line-height:1.8">
        <div>🖱 Glisser · zoomer (molette)</div>
        <div>🖱 Cliquer un élément pour le modifier</div>
        <div>✥ Cliquer-glisser pour le déplacer</div>
        <div>3D · Cliquer-glisser pour orbiter</div>
      </div>
      <div class="items-section">
        <div class="items-title">${allEls.length} élément(s)</div>
        ${itemsList(allEls,true)}
      </div>
    `;
    pf.innerHTML=`<button class="btn btn-ghost" onclick="jumpStep(0)">↩ Modifier</button>`;
    document.getElementById('viewSwitch').style.display='flex';
    // Affiche le bouton AR si WebXR immersive-ar disponible (Android + HTTPS)
    arInitBtn().then(()=>{
      const btn=document.getElementById('vsAR');
      const div=document.getElementById('vsARDiv');
      if(btn&&div) div.style.display=btn.style.display;
    });
    updateStats();
  }

  // Editor panel if an element is selected
  if(S.selected!=null){
    const ed=editorHTML();
    if(ed) pc.innerHTML = ed + pc.innerHTML;
  }
}

function editorHTML(){
  const el=S.elements.find(e=>e.id===S.selected);
  if(!el) return '';
  let fields='';
  if(el.type==='tree'){
    fields=`
      <div class="field"><label>Espèce</label><select onchange="editEl(${el.id},'species',this.value)">${Object.keys(TREE_DATA).map(t=>`<option${t===el.name?' selected':''}>${t}</option>`).join('')}</select></div>
      <div class="row2">
        <div class="field"><label>Hauteur (m)</label><input type="number" value="${el.h}" min=".5" step=".5" oninput="editEl(${el.id},'h',this.value)"></div>
        <div class="field"><label>Frondaison</label><input type="text" id="edSpread" value="⌀ ${(el.spread*2).toFixed(1)}m" disabled style="opacity:.6"></div>
      </div>`;
  } else if(el.type==='hedge'){
    fields=`
      <div class="field"><label>Espèce</label><select onchange="editEl(${el.id},'species',this.value)">${Object.keys(HEDGE_DATA).map(s=>`<option${s===el.name?' selected':''}>${s}</option>`).join('')}</select></div>
      <div class="row3">
        <div class="field"><label>Long. (m)</label><input type="number" value="${el.w}" min=".5" step=".5" oninput="editEl(${el.id},'w',this.value)"></div>
        <div class="field"><label>Épais. (m)</label><input type="number" value="${el.d}" min=".1" step=".1" oninput="editEl(${el.id},'d',this.value)"></div>
        <div class="field"><label>Haut. (m)</label><input type="number" value="${el.h}" min=".3" step=".1" oninput="editEl(${el.id},'h',this.value)"></div>
      </div>`;
  } else if(el.type==='lawn'){
    fields=`<div class="row2">
        <div class="field"><label>Long. (m)</label><input type="number" value="${el.w}" min=".5" step=".5" oninput="editEl(${el.id},'w',this.value)"></div>
        <div class="field"><label>Larg. (m)</label><input type="number" value="${el.d}" min=".5" step=".5" oninput="editEl(${el.id},'d',this.value)"></div>
      </div>`;
  } else if(el.type==='alley'){
    fields=`<div class="field"><label>Largeur de l'allée (m)</label><input type="number" value="${el.width||1}" min=".3" max="5" step=".1" oninput="editEl(${el.id},'width',this.value)"></div>`;
  } else if(el.type==='house'&&el.poly){
    fields=`<div class="spread-badge">🏠 Emprise importée du cadastre — ~${Math.round(polyArea(el.poly))} m² au sol</div>
      <div class="field" style="margin-top:8px"><label>Hauteur du bâtiment (m)</label><input type="number" value="${el.h}" min=".5" step=".5" oninput="editEl(${el.id},'h',this.value)"></div>`;
  } else {
    const showH=true;
    fields=`<div class="row3">
        <div class="field"><label>Long. (m)</label><input type="number" value="${el.w}" min=".5" step=".5" oninput="editEl(${el.id},'w',this.value)"></div>
        <div class="field"><label>Larg. (m)</label><input type="number" value="${el.d}" min=".5" step=".5" oninput="editEl(${el.id},'d',this.value)"></div>
        <div class="field"><label>Haut. (m)</label><input type="number" value="${el.h}" min=".1" step=".5" oninput="editEl(${el.id},'h',this.value)"></div>
      </div>`;
  }
  const rotControl=(el.type!=='tree'&&!el.path&&!el.fill&&!el.poly)?
    `<div class="field" style="margin-top:10px"><label id="rotLbl">Rotation : ${Math.round((el.rot||0)*180/Math.PI)}°</label>
      <input type="range" min="0" max="360" step="5" value="${Math.round((el.rot||0)*180/Math.PI)}" oninput="editEl(${el.id},'rot',this.value)"></div>`:'';
  const icon={house:'🏠',terrace:'🪨',alley:'➡',lawn:'🌿',hedge:'🌳',tree:'🌲'}[el.type]||'●';
  return `<div class="form-card" style="border-color:var(--gold);background:rgba(200,168,75,.06);margin-bottom:18px">
    <div class="form-card-head" style="color:var(--gold);display:flex;justify-content:space-between;align-items:center">
      <span>✎ ${icon} ${el.name||el.type}</span>
      <span style="cursor:pointer;font-size:14px;color:rgba(255,255,255,.4)" onclick="S.selected=null;draw();renderPanel()" title="Fermer">✕</span>
    </div>
    ${fields}
    ${rotControl}
    <button class="btn btn-danger" onclick="deleteEl(${el.id})" style="margin-top:8px">🗑 Supprimer</button>
  </div>`;
}

function editEl(id,prop,val){
  const el=S.elements.find(e=>e.id===id);
  if(!el)return;
  if(prop==='species'){
    el.name=val;
    if(el.type==='tree'){
      const base=TREE_DATA[val]?.spread||4;
      el.spread=+(base*Math.min(1.6,el.h/7)).toFixed(1);
    }
    draw();renderPanel();autosave();return;
  }
  if(prop==='rot'){
    el.rot=(parseFloat(val)||0)*Math.PI/180;
    const lbl=document.getElementById('rotLbl');
    if(lbl)lbl.textContent='Rotation : '+Math.round(parseFloat(val)||0)+'°';
    draw();autosave();return;
  }
  const num=parseFloat(val)||0;
  if(prop==='w')el.w=num;
  else if(prop==='d')el.d=num;
  else if(prop==='width')el.width=num;
  else if(prop==='h'){
    el.h=num;
    if(el.type==='tree'){
      const base=TREE_DATA[el.name]?.spread||4;
      el.spread=+(base*Math.min(1.6,num/7)).toFixed(1);
      const sp=document.getElementById('edSpread');
      if(sp)sp.value='⌀ '+(el.spread*2).toFixed(1)+'m';
    }
  }
  draw();updateStats();autosave();
}

function itemsList(items,showSel=false){
  const colors={house:'#b09070',terrace:'#c8a870',alley:'#a09080',lawn:'#3a7a35',hedge:'#1e4a1e',tree:'#2d6a27'};
  return items.map(el=>`
    <div class="item-card${showSel&&el.id===S.selected?' selected':''}" onclick="S.selected=${el.id};draw();renderPanel()">
      <div class="item-dot" style="background:${el.type==='hedge'?(HEDGE_DATA[el.name]&&HEDGE_DATA[el.name].color||colors.hedge):(colors[el.type]||'#666')}"></div>
      <div class="item-info">
        <div class="item-name">${el.name||el.type}</div>
        <div class="item-meta">${getMetaStr(el)}</div>
      </div>
      <div class="item-del" onclick="event.stopPropagation();deleteEl(${el.id})">✕</div>
    </div>
  `).join('');
}

function getMetaStr(el){
  if(el.type==='tree')return `H: ${el.h}m · ⌀${(el.spread*2).toFixed(1)}m`;
  if(el.path){
    let len=0;for(let i=0;i<el.path.length-1;i++)len+=Math.hypot(el.path[i+1].x-el.path[i].x,el.path[i+1].y-el.path[i].y);
    return `Allée · ${len.toFixed(1)}m de long · larg. ${el.width||1}m`;
  }
  if(el.poly)return `Contour ~${Math.round(polyArea(el.poly))}m²${el.h?' · H:'+el.h+'m':''}`;
  return `${el.w||'?'}×${el.d||'?'}m${el.h?' · H:'+el.h+'m':''}`;
}

function deleteEl(id){
  S.elements=S.elements.filter(e=>e.id!==id);
  if(S.selected===id)S.selected=null;
  draw();updateStats();renderPanel();toast('Supprimé');autosave();
}

