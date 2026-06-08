// ============================================================
// ar-webxr.js — Mode AR WebXR (Android / Chrome immersive-ar)
// ─────────────────────────────────────────────────────────────
// Flow :
//   1. Calibration 2 points de référence (coins maison/terrain)
//      → transform de similarité AR-coords → plan-coords (mètres)
//   2. Tap → placer arbre/arbuste :
//      a. Espèce pré-sélectionnée depuis le panneau latéral
//      b. Recherche GBIF depuis l'overlay AR
//      c. Photo PlantNet : session AR suspendue → panel #arIdPanel
//         → identification → re-entrée AR sans recalibrage
// ============================================================
'use strict';

// ─── État de la session courante ─────────────────────────────
let _arSession  = null;
let _arGL       = null;
let _arRefSpace = null;
let _arHitSrc   = null;
let _arHitPose  = null;
let _arHitValid = false;

// ─── État de calibration ──────────────────────────────────────
let _arCalib  = 0;    // 0=hors-session 1=pt1 2=pt2 3=calé
let _arRefAR  = [];   // [{x,z}] coordonnées AR des 2 points de référence

// ─── Persistants entre sessions (survivent à un end/restart) ─
let _arSavedXform = null;  // transform calé : réutilisé au redémarrage
let _arSavedPos   = null;  // position plan en attente lors d'une photo
let _arSavedKind  = null;  // 'tree'|'hedge' en attente lors d'une photo

// ─── État de la session courante (placement) ──────────────────
let _arXform   = null;    // {scale, cos, sin, tx, ty}
let _arPendPos = null;    // {x,y} en mètres dans le plan
let _arPendKind = null;   // 'tree'|'hedge'

// ─── Espèce pré-sélectionnée (depuis le panneau latéral) ─────
let _arPreselectedName   = null;
let _arPreselectedFamily = '';

// ─── Points de référence dans le plan (mètres) ───────────────
function _arPlanRefPts() {
  const house = S.elements.find(e => e.type === 'house' && e.poly && e.poly.length >= 4);
  if (house) return [
    {x: house.poly[0][0], y: house.poly[0][1], label: 'Coin A de la maison'},
    {x: house.poly[2][0], y: house.poly[2][1], label: 'Coin C de la maison'}
  ];
  if (S.garden.poly && S.garden.poly.length >= 3) {
    const p = S.garden.poly, n = p.length;
    return [
      {x: p[0][0],               y: p[0][1],               label: 'Coin A du terrain'},
      {x: p[Math.floor(n / 2)][0], y: p[Math.floor(n / 2)][1], label: 'Coin B du terrain'}
    ];
  }
  const W = S.garden.w || 10, H = S.garden.h || 10;
  return [
    {x: 0, y: 0, label: `Coin NW (0, 0)`},
    {x: W, y: H, label: `Coin SE (${W}, ${H})`}
  ];
}

// ─── Marqueurs A / B sur le plan 2D ──────────────────────────
// Appelé par draw() dans canvas2d.js (hook optionnel).
// Visible à partir de l'étape Haies pour que l'utilisateur sache
// où se rendre avant d'entrer en mode AR.
function drawARRefMarkers() {
  if (!arAvailable()) return;
  if (typeof S === 'undefined' || !S.garden.w) return;
  if (typeof ST === 'undefined' || S.step < ST.HAIE) return;

  const pts = _arPlanRefPts();
  pts.forEach((rp, i) => {
    const p = w2s(rp.x, rp.y);
    const done   = _arCalib === 3 || _arCalib > i + 1;
    const active = !done && _arCalib === i + 1;
    ctx.save();
    // Cercle de fond
    ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = done   ? 'rgba(50,200,70,.88)'
                 : active ? 'rgba(255,210,0,.92)'
                 :          'rgba(255,255,255,.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    // Lettre A / B
    ctx.fillStyle = '#111'; ctx.font = 'bold 11px Outfit';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(i === 0 ? 'A' : 'B', p.x, p.y);
    // Libellé "AR 1" / "AR 2" sous le cercle
    ctx.font = '9px Outfit';
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillText('AR ' + (i + 1), p.x, p.y + 18);
    ctx.restore();
  });
}

// ─── Disponibilité ────────────────────────────────────────────
function arAvailable() {
  return typeof navigator !== 'undefined' && !!navigator.xr
      && (location.protocol === 'https:' || location.hostname === 'localhost'
          || location.hostname === '127.0.0.1');
}

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

// Affiche le bouton "Placer en AR" dans les étapes du panneau
function arShowSidebarBtn(kind) {
  const id = kind === 'tree' ? 'btnARTree' : 'btnARHedge';
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.style.display = arAvailable() ? 'block' : 'none';
}

// ─── Entrée AR depuis le panneau latéral ──────────────────────
// Récupère l'espèce sélectionnée dans la liste déroulante et entre en AR.
function arPlaceSelected(kind) {
  const selId = kind === 'tree' ? 'tType' : 'hSpecies';
  const name  = document.getElementById(selId)?.value;
  if (!name) { toast('Sélectionne d\'abord une espèce.'); return; }
  _arPreselectedName   = name;
  _arPreselectedFamily = '';
  startAR();
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
  _arHitPose = null; _arHitValid = false;
  _arPendPos = null; _arPendKind = null;
  document.getElementById('arActions').innerHTML = '';

  // Restaure la calibration précédente si disponible (re-entrée après photo)
  if (_arSavedXform) {
    _arXform = _arSavedXform;
    _arCalib = 3;
    _arRefAR = [];
    // Restaure la position et espèce en attente si la session a été interrompue pour une photo
    if (_arSavedPos)  { _arPendPos = _arSavedPos;  _arSavedPos  = null; }
    if (_arSavedKind) { _arPendKind = _arSavedKind; _arSavedKind = null; }
  } else {
    _arXform = null;
    _arCalib = 1;
    _arRefAR = [];
  }

  const cv = document.createElement('canvas');
  _arGL = cv.getContext('webgl', {xrCompatible: true});
  try { await _arGL.makeXRCompatible(); } catch (_) {}
  session.updateRenderState({baseLayer: new XRWebGLLayer(session, _arGL)});

  try {
    _arRefSpace = await session.requestReferenceSpace('local-floor');
  } catch {
    _arRefSpace = await session.requestReferenceSpace('local');
  }
  try {
    const viewerSpace = await session.requestReferenceSpace('viewer');
    _arHitSrc = await session.requestHitTestSource({space: viewerSpace});
  } catch {
    _arHitSrc = null;
    toast('Hit-test indisponible : placement manuel uniquement.');
  }

  session.addEventListener('end', _arOnEnd);
  session.requestAnimationFrame(_arLoop);

  // Si une position est déjà en attente (retour de photo), aller directement au menu de placement
  if (_arCalib === 3 && _arPendPos) {
    _arShowPlaceMenu();
  } else {
    _arUpdateUI();
    _arDrawMap(_arCalib === 3 ? -1 : 0);
  }
}

function stopAR() {
  if (_arSession) _arSession.end();
  else _arOnEnd();
}

function _arOnEnd() {
  // Sauvegarde les données importantes avant de réinitialiser
  if (_arXform)    _arSavedXform = _arXform;
  if (_arPendPos)  _arSavedPos   = _arPendPos;
  if (_arPendKind) _arSavedKind  = _arPendKind;

  document.getElementById('arOverlay').style.display = 'none';
  if (_arHitSrc) { try { _arHitSrc.cancel(); } catch (_) {} _arHitSrc = null; }
  _arSession = null; _arGL = null; _arRefSpace = null;
  _arHitPose = null; _arHitValid = false; _arCalib = 0;
  _arXform = null; _arPendPos = null; _arPendKind = null;
}

// ─── Boucle de rendu ──────────────────────────────────────────
function _arLoop(t, frame) {
  if (!_arSession) return;
  _arSession.requestAnimationFrame(_arLoop);

  const baseLayer = frame.session.renderState.baseLayer;
  _arGL.bindFramebuffer(_arGL.FRAMEBUFFER, baseLayer.framebuffer);
  _arGL.clear(_arGL.COLOR_BUFFER_BIT | _arGL.DEPTH_BUFFER_BIT);

  if (!_arHitSrc || !_arRefSpace) return;

  const hits  = frame.getHitTestResults(_arHitSrc);
  const valid = hits.length > 0;

  if (valid) {
    _arHitPose = hits[0].getPose(_arRefSpace);
    if (_arXform) {
      const pos = _arHitPose.transform.position;
      const p   = _arToPlan(pos.x, pos.z);
      const lbl = document.getElementById('arHitPos');
      if (lbl && p) lbl.textContent = `${p.x.toFixed(2)} m · ${p.y.toFixed(2)} m`;
    }
  } else {
    _arHitPose = null;
  }

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

// ─── Transform AR → plan ──────────────────────────────────────
function _arComputeXform() {
  const pts = _arPlanRefPts();
  const a1 = _arRefAR[0], a2 = _arRefAR[1];
  const p1 = pts[0],      p2 = pts[1];
  const dax = a2.x - a1.x, daz = a2.z - a1.z;
  const dpx = p2.x - p1.x, dpy = p2.y - p1.y;
  const dAR = Math.hypot(dax, daz), dPL = Math.hypot(dpx, dpy);
  if (dAR < 0.1) {
    toast('⚠ Points trop proches — recommence.'); _arCalib = 1; _arRefAR = []; _arUpdateUI(); return;
  }
  const scale = dPL / dAR;
  const rot = Math.atan2(dpy, dpx) - Math.atan2(daz, dax);
  const cos = Math.cos(rot), sin = Math.sin(rot);
  _arXform = {
    scale, cos, sin,
    tx: p1.x - scale * (cos * a1.x - sin * a1.z),
    ty: p1.y - scale * (sin * a1.x + cos * a1.z)
  };
  _arSavedXform = _arXform; // persisté immédiatement
}

function _arToPlan(arX, arZ) {
  if (!_arXform) return null;
  const {scale, cos, sin, tx, ty} = _arXform;
  return {
    x: scale * (cos * arX - sin * arZ) + tx,
    y: scale * (sin * arX + cos * arZ) + ty
  };
}

// ─── Bouton de confirmation (Marquer / Placer) ────────────────
function _arConfirm() {
  if (!_arHitPose) {
    if (_arCalib === 3) _arPlaceManual();
    return;
  }
  const pos = _arHitPose.transform.position;

  if (_arCalib === 1) {
    _arRefAR[0] = {x: pos.x, z: pos.z};
    _arCalib = 2; _arUpdateUI(); _arDrawMap(1);
    toast('Point A enregistré ✓');

  } else if (_arCalib === 2) {
    _arRefAR[1] = {x: pos.x, z: pos.z};
    _arComputeXform();
    if (_arXform) { _arCalib = 3; _arUpdateUI(); _arDrawMap(-1); toast('✅ Calibré !'); }

  } else if (_arCalib === 3) {
    const plan = _arToPlan(pos.x, pos.z);
    if (!plan) return;
    _arPendPos = plan;

    // Si espèce pré-sélectionnée (venue du panneau latéral ou d'une photo), placer directement
    if (_arPreselectedName) {
      _arFinish(_arPreselectedName, _arPreselectedFamily);
      _arPreselectedName = null; _arPreselectedFamily = '';
    } else {
      _arShowPlaceMenu();
    }
  }
}

// ─── Placement manuel ─────────────────────────────────────────
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

// ─── Menu de placement ────────────────────────────────────────
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
        <button class="ar-btn" onclick="_arPhotoMode()">📷 Photo PlantNet</button>
        <button class="ar-btn" onclick="_arSearchUI()">🔍 Chercher</button>
      </div>
      <button class="ar-btn-ghost" onclick="_arShowPlaceMenu()">← Retour</button>
    </div>`;
}

// ─── Photo PlantNet — hors session AR pour éviter le conflit caméra ──────────
// La session AR est arrêtée, le panel #arIdPanel s'affiche par-dessus la vue 2D.
// Après identification l'utilisateur peut re-entrer en AR (calibration sauvegardée).
function _arPhotoMode() {
  // Sauvegarde la position et le type avant de fermer la session
  _arSavedPos  = _arPendPos;
  _arSavedKind = _arPendKind;
  // Fermer la session AR libère la caméra
  if (_arSession) {
    _arSession.end(); // déclenche _arOnEnd qui sauvegarde le reste
  }
  // Légère attente pour que la session soit bien terminée et la caméra libérée
  setTimeout(_arShowIdPanel, 350);
}

function _arShowIdPanel() {
  const panel = document.getElementById('arIdPanel');
  if (!panel) return;
  const kind = _arSavedKind || 'tree';
  const pos  = _arSavedPos;
  panel.style.display = 'flex';
  panel.innerHTML = `
    <div class="ar-id-card">
      <div class="ar-id-title">📷 Identifier la plante</div>
      ${pos ? `<div class="ar-id-sub">${kind === 'tree' ? 'Arbre' : 'Arbuste'} · ${pos.x.toFixed(1)} m · ${pos.y.toFixed(1)} m</div>` : ''}
      <div class="ar-id-row">
        <label class="ar-btn" for="arIdPhoto" style="text-align:center">📷 Prendre une photo</label>
        <input type="file" id="arIdPhoto" accept="image/*" capture="environment"
          style="display:none" onchange="_arIdPhoto(this.files[0])">
        <button class="ar-btn" onclick="_arIdSearchUI()">🔍 Chercher</button>
      </div>
      <div id="arIdResults" class="ar-candidates" style="margin-top:8px"></div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:12px">
        <button class="ar-btn-ghost" onclick="_arIdResume()">↩ Retour AR (sans identifier)</button>
        <button class="ar-btn-ghost" onclick="document.getElementById('arIdPanel').style.display='none';_arSavedPos=null;_arSavedKind=null">✕ Annuler</button>
      </div>
    </div>`;
}

async function _arIdPhoto(file) {
  if (!file) return;
  const box = document.getElementById('arIdResults');
  const key = getPlantNetKey();
  if (!key) {
    if (box) box.innerHTML = '<div class="ar-card-sub">⚙ Clé PlantNet manquante — configure-la dans l\'étape Arbres.</div>'; return;
  }
  if (box) box.innerHTML = '<div class="ar-card-sub">📷 Identification Pl@ntNet en cours…</div>';
  try {
    const res = await identifyPhoto(file, key);
    if (!res.length) {
      if (box) box.innerHTML = '<div class="ar-card-sub">Aucune espèce reconnue.</div>'; return;
    }
    _arIdShowCandidates(res);
  } catch (e) {
    if (box) box.innerHTML = `<div class="ar-card-sub">⚠ ${e.message || e}</div>`;
  }
}

function _arIdShowCandidates(results) {
  const box = document.getElementById('arIdResults');
  if (!box) return;
  let html = '';
  results.slice(0, 5).forEach(r => {
    const name = r.fr || r.sci;
    const sub  = (r.fr ? r.sci : (r.family || '')) + ' · ' + Math.round((r.score || 0) * 100) + '%';
    html += `<button class="ar-candidate"
      onclick="_arIdPick(${JSON.stringify(name)},${JSON.stringify(r.family || '')})">
      <span class="ar-cname">${name}</span><span class="ar-csub">${sub}</span></button>`;
  });
  box.innerHTML = html;
}

function _arIdSearchUI() {
  const box = document.getElementById('arIdResults');
  if (!box) return;
  box.innerHTML = `
    <input class="ar-input" id="arIdSrch" type="text" placeholder="Nom commun ou latin…"
      oninput="_arIdDoSearch(this.value)" autocomplete="off" autocorrect="off" style="margin-bottom:6px">
    <div id="arIdSrchRes" class="ar-candidates"></div>`;
  setTimeout(() => document.getElementById('arIdSrch')?.focus(), 100);
}

let _arIdSrchTimer = null;
function _arIdDoSearch(q) {
  clearTimeout(_arIdSrchTimer);
  const box = document.getElementById('arIdSrchRes');
  if (!box || q.length < 2) { if (box) box.innerHTML = ''; return; }
  _arIdSrchTimer = setTimeout(async () => {
    const kind = _arSavedKind || 'tree';
    const db   = kind === 'tree' ? TREE_DATA : HEDGE_DATA;
    const lq   = q.toLowerCase();
    let html = Object.keys(db).filter(k => k.toLowerCase().includes(lq)).slice(0, 4)
      .map(name => `<button class="ar-candidate" onclick="_arIdPick(${JSON.stringify(name)},'')">
        <span class="ar-cname">${name}</span></button>`).join('');
    if (box) box.innerHTML = html || '<div class="ar-card-sub">Recherche GBIF…</div>';
    try {
      const rows = await gbifSearch(q);
      html += rows.slice(0, 5).map(r =>
        `<button class="ar-candidate" onclick="_arIdPick(${JSON.stringify(r.name)},${JSON.stringify(r.family || '')})">
          <span class="ar-cname">${r.name}</span><span class="ar-csub">${r.sub || ''}</span></button>`
      ).join('');
      const b2 = document.getElementById('arIdSrchRes');
      if (b2) b2.innerHTML = html;
    } catch (_) {}
  }, 280);
}

function _arIdPick(name, family) {
  document.getElementById('arIdPanel').style.display = 'none';
  if (_arSavedPos) {
    // Position connue → placer directement dans le plan, pas besoin de reprendre l'AR
    const kind = _arSavedKind || 'tree';
    if (kind === 'tree') registerCustomTree(name, family);
    else               registerCustomHedge(name, family);
    const def = (kind === 'tree' ? TREE_DATA : HEDGE_DATA)[name] || {};
    S.elements.push({
      id: Date.now(), type: kind === 'tree' ? 'tree' : 'hedge', name,
      x: _arSavedPos.x, y: _arSavedPos.y,
      w: def.spread || (kind === 'tree' ? 4 : 1),
      d: def.spread || (kind === 'tree' ? 4 : 1),
      h: def.h      || (kind === 'tree' ? 6 : 1.5),
      rot: 0, spread: def.spread || 4, maturity: def.maturity || 20
    });
    draw(); quickSave();
    toast(`✅ ${name} placé (${_arSavedPos.x.toFixed(1)} m, ${_arSavedPos.y.toFixed(1)} m)`);
    _arSavedPos = null; _arSavedKind = null;
  } else {
    // Pas de position → pré-sélectionner et re-entrer en AR pour pointer
    _arPreselectedName   = name;
    _arPreselectedFamily = family;
    startAR();
  }
}

function _arIdResume() {
  // Retour en AR sans identifier d'espèce
  document.getElementById('arIdPanel').style.display = 'none';
  startAR();
}

// ─── Recherche texte dans l'overlay AR ───────────────────────
function _arSearchUI() {
  document.getElementById('arActions').innerHTML = `
    <div class="ar-card">
      <div class="ar-card-title">🔍 Recherche d'espèce</div>
      <input class="ar-input" id="arSrch" type="text" placeholder="Nom commun ou latin…"
        oninput="_arDoSearch(this.value)" autocomplete="off" autocorrect="off">
      <div id="arSrchRes" class="ar-candidates" style="margin-top:6px"></div>
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
    let html = Object.keys(db).filter(k => k.toLowerCase().includes(lq)).slice(0, 4)
      .map(name => `<button class="ar-candidate" onclick="_arFinish(${JSON.stringify(name)},'')">
        <span class="ar-cname">${name}</span></button>`).join('');
    if (box) box.innerHTML = html || '<div class="ar-card-sub">Recherche GBIF…</div>';
    try {
      const rows = await gbifSearch(q);
      html += rows.slice(0, 5).map(r =>
        `<button class="ar-candidate" onclick="_arFinish(${JSON.stringify(r.name)},${JSON.stringify(r.family || '')})">
          <span class="ar-cname">${r.name}</span><span class="ar-csub">${r.sub || ''}</span></button>`
      ).join('');
      const b2 = document.getElementById('arSrchRes');
      if (b2) b2.innerHTML = html;
    } catch (_) {}
  }, 280);
}

// ─── Finalisation — ajout au plan ─────────────────────────────
function _arFinish(name, family) {
  if (!_arPendPos || !_arPendKind) return;
  const kind = _arPendKind;
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

// ─── Mini-carte du plan ───────────────────────────────────────
function _arDrawMap(activeIdx) {
  const cv2 = document.getElementById('arMapCv');
  if (!cv2) return;
  const c = cv2.getContext('2d');
  const W = cv2.width, H = cv2.height;
  c.clearRect(0, 0, W, H);

  let pts;
  if (S.garden.poly) pts = S.garden.poly.map(p => ({x: p[0], y: p[1]}));
  else {
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

  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, W, H);
  c.beginPath();
  pts.forEach((p, i) => { const [cx,cy]=tc(p.x,p.y); i===0?c.moveTo(cx,cy):c.lineTo(cx,cy); });
  c.closePath();
  c.fillStyle='rgba(100,180,80,.2)'; c.fill();
  c.strokeStyle='rgba(100,180,80,.7)'; c.lineWidth=1.2; c.stroke();

  S.elements.filter(e => e.type==='house' && e.poly).forEach(e => {
    c.beginPath();
    e.poly.forEach((p,i)=>{ const [cx,cy]=tc(p[0],p[1]); i===0?c.moveTo(cx,cy):c.lineTo(cx,cy); });
    c.closePath(); c.fillStyle='rgba(200,170,120,.45)'; c.fill();
  });

  S.elements.filter(e=>e.type==='tree'||e.type==='hedge').forEach(e=>{
    const [cx,cy]=tc(e.x,e.y);
    c.beginPath(); c.arc(cx,cy,3,0,Math.PI*2);
    c.fillStyle=e.type==='tree'?'rgba(80,200,80,.8)':'rgba(140,200,100,.8)'; c.fill();
  });

  _arPlanRefPts().forEach((rp, i) => {
    const [cx, cy] = tc(rp.x, rp.y);
    c.beginPath(); c.arc(cx, cy, 5, 0, Math.PI*2);
    const done   = (activeIdx === -1) || (i < activeIdx);
    const active = i === activeIdx && activeIdx !== -1;
    c.fillStyle = done ? '#4f4' : active ? '#ff4' : 'rgba(255,255,255,.18)';
    c.fill(); c.strokeStyle = done?'#2a2':'#fff'; c.lineWidth=1; c.stroke();
    c.fillStyle='#000'; c.font='bold 7px sans-serif';
    c.textAlign='center'; c.textBaseline='middle';
    c.fillText(i===0?'A':'B', cx, cy);
  });
}

// ─── Mise à jour de l'UI de calibration ───────────────────────
function _arUpdateUI() {
  const status = document.getElementById('arStatus');
  if (!status) return;
  const refPts = _arPlanRefPts();

  if (_arCalib === 1) {
    status.innerHTML = `
      <div class="ar-step-lbl">Calibration — Étape 1 / 2</div>
      <p class="ar-instr">Rendez-vous au <strong>${refPts[0].label}</strong>
        (marqué <strong>A</strong> sur le plan 2D).<br>Pointez le sol à vos pieds.</p>
      <button class="ar-btn" id="arConfirmBtn" onclick="_arConfirm()">📍 Marquer point A</button>`;
  } else if (_arCalib === 2) {
    status.innerHTML = `
      <div class="ar-step-lbl">Calibration — Étape 2 / 2</div>
      <p class="ar-instr">Rendez-vous maintenant au <strong>${refPts[1].label}</strong>
        (marqué <strong>B</strong> sur le plan).<br>Pointez le sol et appuyez.</p>
      <button class="ar-btn" id="arConfirmBtn" onclick="_arConfirm()">📍 Marquer point B</button>
      <button class="ar-btn-ghost" style="margin-top:4px"
        onclick="_arCalib=1;_arRefAR=[];_arUpdateUI();_arDrawMap(0)">↩ Refaire point A</button>`;
  } else if (_arCalib === 3) {
    const hint = _arPreselectedName
      ? `Espèce pré-sélectionnée : <strong>${_arPreselectedName}</strong><br>Visez le sol et appuyez.`
      : 'Visez le sol à l\'endroit souhaité et appuyez.';
    status.innerHTML = `
      <div class="ar-step-lbl">✅ Calé — prêt à placer</div>
      <p class="ar-instr">${hint}</p>
      <button class="ar-btn" id="arConfirmBtn" onclick="_arConfirm()">📍 Placer ici</button>
      <button class="ar-btn-ghost" style="margin-top:4px"
        onclick="_arSavedXform=null;_arCalib=1;_arRefAR=[];_arXform=null;_arUpdateUI();_arDrawMap(0)">🔄 Recalibrer</button>`;
  }
}
