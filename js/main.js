// ============================================================
// main.js
// Point d'entree : initialisation, restauration de l'auto-sauvegarde.
// ============================================================

// ════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════
resize();
if(loadAutosave()&&S.garden.w){
  enterLoadedState();
  setTimeout(()=>toast('Jardin précédent restauré'),300);
}else{
  renderPanel();
}
