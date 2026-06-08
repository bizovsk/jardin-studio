// ============================================================
// ar-webxr.js — Mode AR WebXR (Android / Chrome immersive-ar)
// ─────────────────────────────────────────────────────────────
// Flow :
//   0. Vérification HTTPS + API WebXR sur l'appareil
//   1. Session XR + couche WebGL minimal + hit-test source
//   2. Calibration 2 points de référence (coins maison ou terrain)
//      → transform de similarité  AR-coords → plan-coords (mètres)
//   3. Tap sur le sol (bouton 📍) → menu Arbre / Arbuste
//        a. Photo PlantNet  (identifyPhoto depuis plantnet.js)
//        b. Ou recherche GBIF + base curée (gbifSearch)
//      → _arFinish → S.elements.push → draw() + quickSave()
// ============================================================
'use strict';

// ─── État session ─────────────────────────────────────────────
let _arSession  = null;
let _arGL       = null;
let _arRefSpace = null;
let _arHitSrc   = null;
let _arHitPose  = null;    // dernier hit-test valide (ou null)
let _arHitValid = false;   // évite les mises à jour DOM inutiles

// ─── État calibration ─────────────────────────────────────────
let _arCalib   = 0;   // 0=hors-session  1=attente pt1  2=attente pt2  3=calé
let _arRefAR   = [];  // [{x,z}] coordonnées AR des 2 pts de référence
let _arXform   = null; // {scale, cos, sin, tx, ty}

// ─── État placement ───────────────────────────────────────────
let _arPendPos  = null;  // {x,y} en mètres dans le plan
let _arPendKind = null;  // 'tree' | 'hedge'

// ─── Points de référence dans le plan (mètres) ───────────────
function _arPlanRefPts() {
  // Priorité : coins A et C de la première maison importée
  const house = S.elements.find(e => e.type === 'house' && e.poly && e.poly.length >= 4);
  if (house) return [
    {x: house.poly[0][0], y: house.poly[0][1], label: 'Coin A de la maison'},
    {x: house.poly[2][0], y: house.poly[2][1], label: 'Coin C de la maison'}
  ];
  // Sinon coins 0 et ~N/2 du polygone terrain
  if (S.garden.poly && S.garden.poly.length >= 3) {
    const p = S.garden.poly, n = p.length;
    return [
      {x: p[0][0],               y: p[0][1],               label: 'Coin A du terrain'},
      {x: p[Math.floor(n / 2)][0], y: p[Math.floor(n / 2)][1], label: 'Coin B du terrain'}
    ];
  }
  // Terrain rectangulaire : coins NW et SE
  const W = S.garden.w || 10, H = S.garden.h || 10;
  return [
    {x: 0, y: 0, label: 'Coin NW du terrain (0,0)'},
    {x: W, y: H, label: `Coin SE du terrain (${W},${H})`}
  ];
}

// ─── Disponibilité (HTTPS requis pour WebXR en production) ────
function arAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.xr
      && (location.protocol === 'https:' || location.hostname === 'localhost'
          || location.hostname === '127.0.0.1');
}

// Affiche/cache le bouton AR dans le viewSwitch selon le support réel
async function arInitBtn() {
  const btn = document.getElementById('vsAR');
  if (!btn) return;
  if (!arAvailable()) { btn.style.display = 'none'; return; }
  try {
    const ok = await navigator.xr.isSessionSupported('immersive-ar');
    btn.style.display = ok ? '' : 'none';
  } catch {
    btn.style.display = 'none';
  }
}

// ─── Démarrage de la session ──────────────────────────────────
async function startAR() {
  if (!navigator.xr) { toast('WebXR non disponible sur cet appareil.'); return; }
  const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  if (!supported) { toast('AR non supportée — Android + Chrome requis.'); return; }

  let session;
  try {
    session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['local-floor', 'dom-overlay'],
      domOverlay: {root: document.getElementById('arOverlay')}
    });
  } catch (err) {
    toast('Erreur AR : ' + (err.message || err)); return;
  }

  _arSession = session;
  document.getElementById('arOverlay').style.display = 'flex';
  _arCalib = 1; _arRefAR = []; _arXform = null;
  _arPendPos = null; _arPendKind = null;
  _arHitPose = null; _arHitValid = false;

  // Canvas WebGL minimal — exigé par l'API même sans rendu visible
  const cv = document.createElement('canvas');
  _arGL = cv.getContext('webgl', {xrCompatible: true});
  try { await _arGL.makeXRCompatible(); } catch (_) {}
  session.updateRenderState({baseLayer: new XRWebGLLayer(session, _arGL)});

  // Référentiel sol (fallback vers 'local' si non disponible)
  try {
    _arRefSpace = await session.requestReferenceSpace('local-floor');
  } catch {
    _arRefSpace = await session.requestReferenceSpace('local');
  }

  // Source hit-test (rayon depuis l'axe optique de la caméra)
  try {
    const viewerSpace = await session.requestReferenceSpace('viewer');
    _arHitSrc = await session.requestHitTestSource({space: viewerSpace});
  } catch {
    _arHitSrc = null; // hit-test indisponible → placement manuel
    toast('Hit-test non disponible : utilise la saisie manuelle.');
  }

  session.addEventListener('end', _arOnEnd);
  session.requestAnimationFrame(_arLoop);
  _arUpdateUI();
  _arDrawMap(0);
}

function stopAR() {
  if (_arSession) _arSession.end();
  else _arOnEnd();
}

function _arOnEnd() {
  document.getElementById('arOverlay').style.display = 'none';
  if (_arHitSrc) { try { _arHitSrc.cancel(); } catch (_) {} _arHitSrc = null; }
  _arSession = null; _arGL = null; _arRefSpace = null;
  _arHitPose = null; _arHitValid = false; _arCalib = 0;
}

// ─── Boucle de rendu (RAF WebXR) ──────────────────────────────
function _arLoop(t, frame) {
  if (!_arSession) return;
  _arSession.requestAnimationFrame(_arLoop);

  // Efface le framebuffer WebXR (obligatoire pour valider la frame)
  const baseLayer = frame.session.renderState.baseLayer;
  _arGL.bindFramebuffer(_arGL.FRAMEBUFFER, baseLayer.framebuffer);
  _arGL.clear(_arGL.COLOR_BUFFER_BIT | _arGL.DEPTH_BUFFER_BIT);

  if (!_arHitSrc || !_arRefSpace) return;

  const hits  = frame.getHitTestResults(_arHitSrc);
  const valid = hits.length > 0;

  if (valid) {
    _arHitPose = hits[0].getPose(_arRefSpace);
    // Affiche la position projetée en coordonnées plan (uniquement si calé)
    if (_arXform) {
      const pos = _arHitPose.transform.position;
      const p   = _arToPlan(pos.x, pos.z);
      const lbl = document.getElementById('arHitPos');
      if (lbl && p) lbl.textContent = `${p.x.toFixed(2)} m · ${p.y.toFixed(2)} m`;
    }
  } else {
    _arHitPose = null;
  }

  // Mise à jour visuelle uniquement lors d'un changement d'état
  if (valid !== _arHitValid) {
    _arHitValid = valid;
    const r   = document.getElementById('arReticle');
    const btn = document.getElementById('arConfirmBtn');
    if (r)   r.className = 'ar-reticle' + (valid ? ' ar-reticle-on' : '');
    if (btn) btn.disabled = !valid;
    if (!valid) {
      const lbl = document.getElementById('arHitPos');
      if (lbl) lbl.textContent = '';
    }
  }
}

// ─── Transform de similarité AR → plan ───────────────────────
function _arComputeXform() {
  const pts = _arPlanRefPts();
  const a1 = _arRefAR[0], a2 = _arRefAR[1];
  const p1 = pts[0],      p2 = pts[1];
  const dax = a2.x - a1.x, daz = a2.z - a1.z;
  const dpx = p2.x - p1.x, dpy = p2.y - p1.y;
  const dAR = Math.hypot(dax, daz);
  const dPL = Math.hypot(dpx, dpy);
  if (dAR < 0.1) {
    toast('⚠ Points trop proches — recommence.'); _arCalib = 1; _arRefAR = []; _arUpdateUI(); return;
  }
  const scale = dPL / dAR;
  const rot   = Math.atan2(dpy, dpx) - Math.atan2(daz, dax);
  const cos   = Math.cos(rot), sin = Math.sin(rot);
  _arXform = {
    scale, cos, sin,
    tx: p1.x - scale * (cos * a1.x - sin * a1.z),
    ty: p1.y - scale * (sin * a1.x + cos * a1.z)
  };
}

function _arToPlan(arX, arZ) {
  if (!_arXform) return null;
  const {scale, cos, sin, tx, ty} = _arXform;
  return {
    x: scale * (cos * arX - sin * arZ) + tx,
    y: scale * (sin * arX + cos * arZ) + ty
  };
}

// ─── Bouton principal (Marquer / Placer) ──────────────────────
function _arConfirm() {
  if (!_arHitPose) {
    // Pas de surface → placement manuel si calé
    if (_arCalib === 3) _arPlaceManual();
    return;
  }
  const pos = _arHitPose.transform.position;

  if (_arCalib === 1) {
    _arRefAR[0] = {x: pos.x, z: pos.z};
    _arCalib = 2; _arUpdateUI(); _arDrawMap(1);
    toast('Point 1 enregistré ✓');

  } else if (_arCalib === 2) {
    _arRefAR[1] = {x: pos.x, z: pos.z};
    _arComputeXform();
    if (_arXform) { _arCalib = 3; _arUpdateUI(); _arDrawMap(-1); toast('✅ Calibration OK !'); }

  } else if (_arCalib === 3) {
    const plan = _arToPlan(pos.x, pos.z);
    if (!plan) return;
    _arPendPos = plan;
    _arShowPlaceMenu();
  }
}

// ─── Saisie manuelle (si pas de surface détectée) ─────────────
function _arPlaceManual() {
  document.getElementById('arActions').innerHTML = `
    <div class="ar-card">
      <div class="ar-card-title">📍 Position manuelle</div>
      <div class="ar-card-sub">Aucune surface détectée. Saisis les coordonnées en mètres.</div>
      <div class="ar-row">
        <div class="ar-field"><label>X (m)</label>
          <input class="ar-input" id="arManX" type="number" step="0.1" value="0"></div>
        <div class="ar-field"><label>Y (m)</label>
          <input class="ar-input" id="arManY" type="number" step="0.1" value="0"></div>
      </div>
      <button class="ar-btn" onclick="_arConfirmManual()">✓ Valider</button>
      <button class="ar-btn-ghost" onclick="document.getElementById('arActions').innerHTML=''">Annuler</button>
    </div>`;
}

function _arConfirmManual() {
  const x = parseFloat(document.getElementById('arManX')?.value) || 0;
  const y = parseFloat(document.getElementById('arManY')?.value) || 0;
  _arPendPos = {x, y};
  _arShowPlaceMenu();
}

// ─── Menus de placement ───────────────────────────────────────
function _arShowPlaceMenu() {
  const {x, y} = _arPendPos;
  document.getElementById('arActions').innerHTML = `
    <div class="ar-card">
      <div class="ar-card-title">📍 Placer un élément</div>
      <div class="ar-card-sub">${x.toFixed(2)} m · ${y.toFixed(2)} m</div>
      <div class="ar-row">
        <button class="ar-btn" onclick="_arChooseKind('tree')">🌳 Arbre</button>
        <button class="ar-btn" onclick="_arChooseKind('hedge')">🌿 Arbuste</button>
      </div>
      <button class="ar-btn-ghost" onclick="document.getElementById('arActions').innerHTML=''">✕ Annuler</button>
    </div>`;
}

function _arChooseKind(kind) {
  _arPendKind = kind;
  document.getElementById('arActions').innerHTML = `
    <div class="ar-card">
      <div class="ar-card-title">${kind === 'tree' ? '🌳 Identifier l\'arbre' : '🌿 Identifier l\'arbuste'}</div>
      <div class="ar-row">
        <label class="ar-btn" for="arPhoto">📷 Photo PlantNet</label>
        <input type="file" id="arPhoto" accept="image/*" capture="environment"
          style="display:none" onchange="_arDoPhoto(this.files[0])">
        <button class="ar-btn" onclick="_arSearchUI()">🔍 Chercher</button>
      </div>
      <button class="ar-btn-ghost" onclick="_arShowPlaceMenu()">← Retour</button>
    </div>`;
}

// ─── Photo → PlantNet ─────────────────────────────────────────
async function _arDoPhoto(file) {
  if (!file) return;
  const key = getPlantNetKey();
  if (!key) {
    document.getElementById('arActions').innerHTML = `
      <div class="ar-card">
        <div class="ar-card-title">⚙ Clé PlantNet manquante</div>
        <div class="ar-card-sub">Saisis ta clé dans le panneau principal (étape Arbres), puis reviens.</div>
        <button class="ar-btn-ghost" onclick="_arChooseKind(_arPendKind)">← Retour</button>
      </div>`; return;
  }
  document.getElementById('arActions').innerHTML =
    '<div class="ar-card"><div class="ar-card-title">📷 Identification Pl@ntNet…</div></div>';
  try {
    const res = await identifyPhoto(file, key);
    if (!res.length) {
      document.getElementById('arActions').innerHTML =
        '<div class="ar-card"><div class="ar-card-title">Aucune espèce reconnue</div>'
        + '<button class="ar-btn-ghost" onclick="_arChooseKind(_arPendKind)">← Retour</button></div>'; return;
    }
    _arShowCandidates(res);
  } catch (e) {
    document.getElementById('arActions').innerHTML = `
      <div class="ar-card">
        <div class="ar-card-title">⚠ Erreur PlantNet</div>
        <div class="ar-card-sub">${e.message || e}</div>
        <button class="ar-btn-ghost" onclick="_arChooseKind(_arPendKind)">← Retour</button>
      </div>`;
  }
}

function _arShowCandidates(results) {
  let html = '<div class="ar-card"><div class="ar-card-title">Choisir l\'espèce</div>'
           + '<div class="ar-candidates">';
  results.slice(0, 5).forEach(r => {
    const name = r.fr || r.sci;
    const sub  = (r.fr ? r.sci : (r.family || '')) + ' · ' + Math.round((r.score || 0) * 100) + '%';
    html += `<button class="ar-candidate"
      onclick="_arFinish(${JSON.stringify(name)},${JSON.stringify(r.family || '')})">
      <span class="ar-cname">${name}</span><span class="ar-csub">${sub}</span></button>`;
  });
  html += '</div><button class="ar-btn-ghost" onclick="_arChooseKind(_arPendKind)">← Retour</button></div>';
  document.getElementById('arActions').innerHTML = html;
}

// ─── Recherche texte (base curée + GBIF) ─────────────────────
function _arSearchUI() {
  document.getElementById('arActions').innerHTML = `
    <div class="ar-card">
      <div class="ar-card-title">🔍 Recherche d'espèce</div>
      <input class="ar-input" id="arSrch" type="text" placeholder="Nom commun ou latin…"
        oninput="_arDoSearch(this.value)" autocomplete="off" autocorrect="off">
      <div id="arSrchRes" class="ar-candidates"></div>
      <button class="ar-btn-ghost" onclick="_arChooseKind(_arPendKind)">← Retour</button>
    </div>`;
  setTimeout(() => { const el = document.getElementById('arSrch'); if (el) el.focus(); }, 120);
}

let _arSrchTimer = null;
function _arDoSearch(q) {
  clearTimeout(_arSrchTimer);
  const box = document.getElementById('arSrchRes');
  if (!box || q.length < 2) { if (box) box.innerHTML = ''; return; }
  _arSrchTimer = setTimeout(async () => {
    const kind = _arPendKind || 'tree';
    const db   = kind === 'tree' ? TREE_DATA : HEDGE_DATA;
    const lq   = q.toLowerCase();
    // Base curée d'abord (résultats immédiats)
    let html = Object.keys(db)
      .filter(k => k.toLowerCase().includes(lq)).slice(0, 4)
      .map(name => `<button class="ar-candidate"
        onclick="_arFinish(${JSON.stringify(name)},'')">
        <span class="ar-cname">${name}</span></button>`).join('');
    if (box) box.innerHTML = html || '<div class="ar-card-sub">Recherche en cours…</div>';
    // GBIF
    try {
      const rows = await gbifSearch(q);
      html += rows.slice(0, 5).map(r =>
        `<button class="ar-candidate"
          onclick="_arFinish(${JSON.stringify(r.name)},${JSON.stringify(r.family || '')})">
          <span class="ar-cname">${r.name}</span>
          <span class="ar-csub">${r.sub || ''}</span></button>`).join('');
      const b2 = document.getElementById('arSrchRes');
      if (b2) b2.innerHTML = html;
    } catch (_) {}
  }, 280);
}

// ─── Finalisation — ajout au plan ─────────────────────────────
function _arFinish(name, family) {
  if (!_arPendPos || !_arPendKind) return;
  const kind = _arPendKind;
  // Enregistre l'espèce si hors base curée
  if (kind === 'tree') registerCustomTree(name, family);
  else               registerCustomHedge(name, family);
  const def = (kind === 'tree' ? TREE_DATA : HEDGE_DATA)[name] || {};
  S.elements.push({
    id:       Date.now(),
    type:     kind === 'tree' ? 'tree' : 'hedge',
    name,
    x:        _arPendPos.x,
    y:        _arPendPos.y,
    w:        def.spread  || (kind === 'tree' ? 4 : 1),
    d:        def.spread  || (kind === 'tree' ? 4 : 1),
    h:        def.h       || (kind === 'tree' ? 6 : 1.5),
    rot:      0,
    spread:   def.spread  || 4,
    maturity: def.maturity || 20
  });
  draw(); quickSave();
  toast(`✅ ${name} placé (${_arPendPos.x.toFixed(1)} m, ${_arPendPos.y.toFixed(1)} m)`);
  document.getElementById('arActions').innerHTML = '';
  _arPendPos = null; _arPendKind = null;
}

// ─── Mini-carte du plan (calibration) ─────────────────────────
// activeIdx :  0=pt1 actif  1=pt2 actif  -1=tous faits
function _arDrawMap(activeIdx) {
  const cv = document.getElementById('arMapCv');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);

  // Contour du jardin
  let pts;
  if (S.garden.poly) {
    pts = S.garden.poly.map(p => ({x: p[0], y: p[1]}));
  } else {
    const w = S.garden.w || 10, h = S.garden.h || 10;
    pts = [{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
  }
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pw = maxX - minX || 1, ph = maxY - minY || 1;
  const pad = 8;
  const sc  = Math.min((W - 2*pad) / pw, (H - 2*pad) / ph);
  const ox  = pad + (W - 2*pad - pw*sc) / 2;
  const oy  = pad + (H - 2*pad - ph*sc) / 2;
  const tc  = (x, y) => [ox + (x - minX)*sc, oy + (y - minY)*sc];

  // Fond sombre semi-transparent
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, W, H);

  // Polygone jardin
  ctx.beginPath();
  pts.forEach((p, i) => { const [cx,cy] = tc(p.x, p.y); i===0 ? ctx.moveTo(cx,cy) : ctx.lineTo(cx,cy); });
  ctx.closePath();
  ctx.fillStyle = 'rgba(100,180,80,.2)'; ctx.fill();
  ctx.strokeStyle = 'rgba(100,180,80,.7)'; ctx.lineWidth = 1.2; ctx.stroke();

  // Maison(s)
  S.elements.filter(e => e.type === 'house' && e.poly).forEach(e => {
    ctx.beginPath();
    e.poly.forEach((p, i) => { const [cx,cy] = tc(p[0],p[1]); i===0 ? ctx.moveTo(cx,cy) : ctx.lineTo(cx,cy); });
    ctx.closePath();
    ctx.fillStyle = 'rgba(200,170,120,.45)'; ctx.fill();
  });

  // Arbres déjà placés
  S.elements.filter(e => e.type === 'tree' || e.type === 'hedge').forEach(e => {
    const [cx,cy] = tc(e.x, e.y);
    ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2);
    ctx.fillStyle = e.type==='tree' ? 'rgba(80,200,80,.8)' : 'rgba(140,200,100,.8)'; ctx.fill();
  });

  // Points de référence
  _arPlanRefPts().forEach((rp, i) => {
    const [cx, cy] = tc(rp.x, rp.y);
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2);
    const done   = (activeIdx === -1) || (i < activeIdx);
    const active = (i === activeIdx && activeIdx !== -1);
    ctx.fillStyle = done ? '#4f4' : active ? '#ff4' : 'rgba(255,255,255,.18)';
    ctx.fill();
    ctx.strokeStyle = done ? '#2a2' : '#fff'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = '#000'; ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(i === 0 ? 'A' : 'B', cx, cy);
  });
}

// ─── Mise à jour du panneau calibration ───────────────────────
function _arUpdateUI() {
  const status = document.getElementById('arStatus');
  if (!status) return;
  const refPts = _arPlanRefPts();

  if (_arCalib === 1) {
    status.innerHTML = `
      <div class="ar-step-lbl">Calibration — Étape 1 / 2</div>
      <p class="ar-instr">Rendez-vous au <strong>${refPts[0].label}</strong>.<br>
        Pointez votre téléphone vers le sol à vos pieds.</p>
      <button class="ar-btn" id="arConfirmBtn" onclick="_arConfirm()">📍 Marquer ce point</button>`;
  } else if (_arCalib === 2) {
    status.innerHTML = `
      <div class="ar-step-lbl">Calibration — Étape 2 / 2</div>
      <p class="ar-instr">Rendez-vous maintenant au <strong>${refPts[1].label}</strong>.<br>
        Pointez le sol et appuyez.</p>
      <button class="ar-btn" id="arConfirmBtn" onclick="_arConfirm()">📍 Marquer ce point</button>
      <button class="ar-btn-ghost" style="margin-top:4px"
        onclick="_arCalib=1;_arRefAR=[];_arUpdateUI();_arDrawMap(0)">↩ Refaire étape 1</button>`;
  } else if (_arCalib === 3) {
    status.innerHTML = `
      <div class="ar-step-lbl">✅ Calé — prêt à placer</div>
      <p class="ar-instr">Visez le sol à l'endroit souhaité et appuyez pour placer un arbre ou arbuste.</p>
      <button class="ar-btn" id="arConfirmBtn" onclick="_arConfirm()">📍 Placer ici</button>
      <button class="ar-btn-ghost" style="margin-top:4px"
        onclick="_arCalib=1;_arRefAR=[];_arXform=null;_arUpdateUI();_arDrawMap(0)">🔄 Recalibrer</button>`;
  }
}
