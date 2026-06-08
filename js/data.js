// ============================================================
// data.js
// Donnees du domaine : especes d'arbres/haies, calendrier d'entretien, etat global S, regions, fiches plantes, constantes d'etapes.
// ============================================================

// ════════════════════════════════════════════════════════════
// DATA
// ════════════════════════════════════════════════════════════
const TREE_DATA = {
  'Chêne':     {spread:7, form:'round',   color:'#2d5a27', trunk:'#4a2e14'},
  'Hêtre':     {spread:6, form:'oval',    color:'#3a7035', trunk:'#5a3a1a'},
  'Érable':    {spread:6, form:'round',   color:'#4a8a35', trunk:'#4a2e14'},
  'Tilleul':   {spread:5, form:'oval',    color:'#3d7a30', trunk:'#5a3a1a'},
  'Frêne':     {spread:5, form:'oval',    color:'#3a6a30', trunk:'#5a3a1a'},
  'Bouleau':   {spread:3, form:'narrow',  color:'#4a8c3f', trunk:'#d0cfc0'},
  'Pin':       {spread:4, form:'cone',    color:'#1e4a1e', trunk:'#6a4020'},
  'Sapin':     {spread:3, form:'cone',    color:'#1a3a1a', trunk:'#4a2e14'},
  'Cèdre':     {spread:5, form:'cone',    color:'#1a3a18', trunk:'#5a3a1a'},
  'Épicéa':    {spread:3, form:'cone',    color:'#163016', trunk:'#4a2e14'},
  'Cyprès':    {spread:2, form:'column',  color:'#1a3a1a', trunk:'#4a2e14'},
  'Thuya':     {spread:2, form:'column',  color:'#1e3a1e', trunk:'#4a2e14'},
  'Pommier':   {spread:4, form:'round',   color:'#5a8a35', trunk:'#5a3a1a'},
  'Poirier':   {spread:3, form:'oval',    color:'#5a8040', trunk:'#5a3a1a'},
  'Cerisier':  {spread:4, form:'round',   color:'#6a9040', trunk:'#5a3a1a'},
  'Prunier':   {spread:3, form:'round',   color:'#5a8535', trunk:'#5a3a1a'},
  'Noisetier': {spread:3, form:'round',   color:'#6a9040', trunk:'#4a3010'},
  'Olivier':   {spread:4, form:'round',   color:'#7a9860', trunk:'#8a7050'},
  'Magnolia':  {spread:4, form:'oval',    color:'#7a9840', trunk:'#5a3a1a'},
  'Palmier':   {spread:3, form:'palm',    color:'#5a9040', trunk:'#8a6a2a'},
  'Bambou':    {spread:1.5,form:'column', color:'#5a8840', trunk:'#5a8840'},
  'Laurier':   {spread:3, form:'round',   color:'#3a6a35', trunk:'#4a3010'},
  // — Arbres d'ornement & d'alignement —
  'Charme':       {spread:5, form:'oval',   color:'#3a6a30', trunk:'#5a3a1a'},
  'Platane':      {spread:9, form:'round',  color:'#4a7a3a', trunk:'#8a7a5a'},
  'Marronnier':   {spread:8, form:'round',  color:'#2e5a26', trunk:'#5a3a1a'},
  'Saule pleureur':{spread:7,form:'weeping',color:'#7aa84a', trunk:'#6a5a2a'},
  'Robinier':     {spread:5, form:'round',  color:'#5a8a45', trunk:'#6a4a2a'},
  'Catalpa':      {spread:6, form:'round',  color:'#4a8040', trunk:'#6a4a2a'},
  'Ginkgo':       {spread:4, form:'oval',   color:'#7a9a3a', trunk:'#6a5a3a'},
  'Liquidambar':  {spread:5, form:'oval',   color:'#4a7a38', trunk:'#5a3a1a'},
  'Albizia':      {spread:5, form:'round',  color:'#5a8a50', trunk:'#7a5a3a'},
  'Sorbier':      {spread:4, form:'oval',   color:'#4a7a3a', trunk:'#5a3a1a'},
  'Eucalyptus':   {spread:5, form:'narrow', color:'#6a8a6a', trunk:'#b0a89a'},
  'Mimosa':       {spread:4, form:'round',  color:'#7aa84a', trunk:'#6a5a3a'},
  'Érable du Japon':{spread:2.5,form:'round',color:'#9a4a30', trunk:'#5a3a1a'},
  'Houx':         {spread:2.5,form:'oval',  color:'#1e4a22', trunk:'#5a3a1a'},
  'Mélèze':       {spread:4, form:'cone',   color:'#4a7a3a', trunk:'#6a4a2a'},
  // — Arbres fruitiers —
  'Figuier':      {spread:5, form:'round',  color:'#5a7a40', trunk:'#8a7a60'},
  'Abricotier':   {spread:4, form:'round',  color:'#5a8540', trunk:'#5a3a1a'},
  'Pêcher':       {spread:3.5,form:'round', color:'#6a9045', trunk:'#5a3a1a'},
  'Amandier':     {spread:4, form:'round',  color:'#6a8a48', trunk:'#5a3a1a'},
  'Cognassier':   {spread:3, form:'round',  color:'#5a8040', trunk:'#5a3a1a'},
  'Néflier':      {spread:3, form:'round',  color:'#4a7a38', trunk:'#5a3a1a'},
  'Citronnier':   {spread:2.5,form:'round', color:'#4a7a35', trunk:'#7a6a4a'},
  'Arbousier':    {spread:3, form:'round',  color:'#3a6a32', trunk:'#7a4a3a'},
};

// Common hedge species — colors for 2D/3D + maintenance/pruning periods
const HEDGE_DATA = {
  'Thuya':            {color:'#1e3a1e', tasks:[{months:[4,5],type:'taille',text:'Taille début printemps'},{months:[8,9],type:'taille',text:'Taille fin été'}]},
  'Cyprès de Leyland':{color:'#1a3a1a', tasks:[{months:[4],type:'taille',text:'1ère taille printemps'},{months:[6],type:'taille',text:'2e taille'},{months:[9],type:'taille',text:'Taille fin été'}]},
  'Laurier-palme':    {color:'#244a22', tasks:[{months:[5],type:'taille',text:'Taille au sécateur (printemps)'},{months:[9],type:'taille',text:'Taille d\'automne'},{months:[6,7,8],type:'arrosage',text:'Arrosage si sécheresse'}]},
  'Laurier-tin':      {color:'#2a5226', tasks:[{months:[6,7],type:'taille',text:'Taille après floraison'},{months:[3],type:'traitement',text:'Surveillance oïdium'}]},
  'Troène':           {color:'#2d5a27', tasks:[{months:[5,6],type:'taille',text:'1ère taille'},{months:[8,9],type:'taille',text:'2e taille'}]},
  'Charmille (Charme)':{color:'#3a6a30',tasks:[{months:[6],type:'taille',text:'Taille de juin'},{months:[9],type:'taille',text:'Taille de septembre'}]},
  'Hêtre':            {color:'#3a7035', tasks:[{months:[6,7],type:'taille',text:'Taille estivale'},{months:[2],type:'taille',text:'Taille hiver possible'}]},
  'Buis':             {color:'#2e5a28', tasks:[{months:[5,6],type:'taille',text:'Taille printemps'},{months:[9],type:'taille',text:'Taille automne'},{months:[4],type:'traitement',text:'Surveillance pyrale du buis'}]},
  'If':               {color:'#1e3a1c', tasks:[{months:[6],type:'taille',text:'Taille estivale'},{months:[9],type:'taille',text:'Taille automne (tolère taille sévère)'}]},
  'Photinia':         {color:'#3a5a2e', tasks:[{months:[3,4],type:'taille',text:'Taille printemps (pousses rouges)'},{months:[7,8],type:'taille',text:'Taille estivale'}]},
  'Éléagnus':         {color:'#4a6a3a', tasks:[{months:[5,6],type:'taille',text:'Taille printemps'},{months:[9],type:'taille',text:'Taille automne'}]},
  'Pittosporum':      {color:'#3a6234', tasks:[{months:[5,6],type:'taille',text:'Taille après floraison'},{months:[9],type:'taille',text:'Taille légère automne'}]},
  'Cotoneaster':      {color:'#34602c', tasks:[{months:[6,7],type:'taille',text:'Taille après floraison'},{months:[2,3],type:'taille',text:'Taille hiver'}]},
  'Bambou':           {color:'#5a8840', tasks:[{months:[4,5],type:'taille',text:'Coupe vieilles tiges'},{months:[3,4,5,6,7,8],type:'arrosage',text:'Arrosage abondant'},{months:[4],type:'traitement',text:'Barrière anti-rhizome si invasif'}]},
  'Aucuba':           {color:'#2e5a2c', tasks:[{months:[4],type:'taille',text:'Taille printemps'},{months:[9],type:'taille',text:'Taille légère automne'}]},
  'Berberis':         {color:'#4a5a2a', tasks:[{months:[6],type:'taille',text:'Taille après floraison'},{months:[9],type:'taille',text:'Taille automne'}]},
  'Escallonia':       {color:'#2e5a28', tasks:[{months:[7,8],type:'taille',text:'Taille après floraison'},{months:[3],type:'taille',text:'Nettoyage printemps'}]},
  'Forsythia':        {color:'#3a6a2e', tasks:[{months:[4,5],type:'taille',text:'Taille juste après floraison'}]},
  'Fusain (Euonymus)':{color:'#2e5a2a', tasks:[{months:[3,4],type:'taille',text:'Taille printemps'},{months:[7,8],type:'taille',text:'Taille estivale'}]},
  'Abélia':           {color:'#34602c', tasks:[{months:[3],type:'taille',text:'Taille fin hiver'},{months:[8],type:'taille',text:'Taille légère après floraison'}]},
  'Weigela':          {color:'#3a5a2e', tasks:[{months:[6,7],type:'taille',text:'Taille après floraison'}]},
  'Cornouiller':      {color:'#4a6a3a', tasks:[{months:[2,3],type:'taille',text:'Taille sévère (bois coloré)'}]},
  'Griselinia':       {color:'#3a6a34', tasks:[{months:[5,6],type:'taille',text:'Taille printemps'},{months:[9],type:'taille',text:'Taille fin été'}]},
  'Spirée':           {color:'#3a6a30', tasks:[{months:[6,7],type:'taille',text:'Taille après floraison'},{months:[2,3],type:'taille',text:'Taille variétés estivales'}]},
  'Lavande':          {color:'#6a7a5a', tasks:[{months:[8,9],type:'taille',text:'Taille après floraison'},{months:[3],type:'taille',text:'Taille légère printemps'}]},
  'Cyprès de Provence':{color:'#2a4a2a',tasks:[{months:[4],type:'taille',text:'Taille printemps'},{months:[9],type:'taille',text:'Taille fin été'}]},
  'Osmanthe':         {color:'#2a5226', tasks:[{months:[6],type:'taille',text:'Taille après floraison'},{months:[9],type:'taille',text:'Taille légère automne'}]},
  'Haie libre / autre':{color:'#1e4a1e', tasks:[{months:[3,4],type:'taille',text:'Taille de printemps'},{months:[6,7],type:'taille',text:'Taille estivale'},{months:[9,10],type:'taille',text:'Taille d\'automne'}]},
};

const MAINTENANCE = {
  lawn:{
    label:'Gazon',color:'#4a8c3f',
    tasks:[
      {months:[4,5,6,7,8,9,10],type:'taille',text:'Tonte régulière'},
      {months:[3,4],type:'traitement',text:'Scarification + engrais de printemps'},
      {months:[9,10],type:'traitement',text:'Engrais d\'automne + aération'},
      {months:[5,6,7,8,9],type:'arrosage',text:'Arrosage (si sec)'},
      {months:[9,10],type:'plantation',text:'Semis ou regarnissage'},
    ]
  },
  hedge:{
    label:'Haie',color:'#1e4a1e',
    tasks:[
      {months:[3,4],type:'taille',text:'Taille de printemps'},
      {months:[6,7],type:'taille',text:'Taille estivale'},
      {months:[9,10],type:'taille',text:'Taille d\'automne'},
      {months:[3],type:'traitement',text:'Traitement préventif fongique'},
    ]
  },
  'Chêne':    {tasks:[{months:[1,2,3],type:'taille',text:'Taille hivernale légère'},{months:[5],type:'traitement',text:'Traitement anti-oïdium'}]},
  'Hêtre':    {tasks:[{months:[2,3],type:'taille',text:'Élagage jeunes sujets'},{months:[10,11],type:'taille',text:'Taille légère automne'}]},
  'Érable':   {tasks:[{months:[6,7,8],type:'taille',text:'Taille estivale uniquement (pas en hiver)'},{months:[10],type:'traitement',text:'Ramassage feuilles (prévention'}]},
  'Bouleau':  {tasks:[{months:[6,7,8],type:'taille',text:'Taille en végétation'},{months:[4],type:'traitement',text:'Surveillance rouille foliaire'}]},
  'Tilleul':  {tasks:[{months:[12,1,2],type:'taille',text:'Taille hivernale'},{months:[7,8],type:'taille',text:'Taille légère en été'}]},
  'Frêne':    {tasks:[{months:[1,2],type:'taille',text:'Taille hivernale'},{months:[4,5],type:'traitement',text:'Surveillance chalarose'}]},
  'Pin':      {tasks:[{months:[5,6],type:'taille',text:'Suppression chandelles (croissance)'},{months:[3],type:'traitement',text:'Traitement chenilles processionnaires'}]},
  'Sapin':    {tasks:[{months:[4,5],type:'taille',text:'Taille légère printemps'},{months:[3],type:'traitement',text:'Traitement puceron lanigère'}]},
  'Cèdre':    {tasks:[{months:[4],type:'taille',text:'Taille légère printemps'},{months:[9],type:'taille',text:'Taille légère automne'}]},
  'Cyprès':   {tasks:[{months:[4],type:'taille',text:'Taille printemps'},{months:[8],type:'taille',text:'Taille fin été'}]},
  'Thuya':    {tasks:[{months:[4,5],type:'taille',text:'Taille début printemps'},{months:[8,9],type:'taille',text:'Taille fin été'}]},
  'Pommier':  {tasks:[{months:[1,2],type:'taille',text:'Taille de fructification'},{months:[3,4],type:'traitement',text:'Bouillie bordelaise'},{months:[7,8],type:'traitement',text:'Éclaircissage fruits'},{months:[10,11],type:'plantation',text:'Plantation possible'}]},
  'Cerisier': {tasks:[{months:[6,7,8,9],type:'taille',text:'Taille estivale UNIQUEMENT (risque chancre en hiver)'},{months:[3],type:'traitement',text:'Bouillie bordelaise'}]},
  'Poirier':  {tasks:[{months:[1,2],type:'taille',text:'Taille de fructification'},{months:[3,4],type:'traitement',text:'Traitement tavelure'},{months:[11,10],type:'plantation',text:'Plantation automne'}]},
  'Prunier':  {tasks:[{months:[6,7,8],type:'taille',text:'Taille estivale après récolte'},{months:[3],type:'traitement',text:'Bouillie bordelaise'}]},
  'Noisetier':{tasks:[{months:[1,2],type:'taille',text:'Suppression rejets basaux'},{months:[10,11],type:'plantation',text:'Plantation automne'}]},
  'Olivier':  {tasks:[{months:[3,4],type:'taille',text:'Taille printanière'},{months:[10,11],type:'traitement',text:'Traitement œil de paon (chancre)'}]},
  'Magnolia': {tasks:[{months:[6,7],type:'taille',text:'Taille légère après floraison'},{months:[4,5],type:'arrosage',text:'Arrosage pendant floraison'}]},
  'Palmier':  {tasks:[{months:[5,6],type:'taille',text:'Taille palmes sèches'},{months:[4,5,6,7,8,9],type:'arrosage',text:'Arrosage régulier'},{months:[5],type:'traitement',text:'Traitement charançon rouge (prévention)'}]},
  'Bambou':   {tasks:[{months:[4,5],type:'taille',text:'Suppression vieilles tiges'},{months:[3,4,5,6,7,8,9],type:'arrosage',text:'Arrosage abondant'},{months:[4],type:'traitement',text:'Limitation rhizomes si invasif'}]},
  'Laurier':  {tasks:[{months:[4,5],type:'taille',text:'Taille printemps'},{months:[8],type:'taille',text:'Taille estivale'},{months:[5,6,7,8],type:'arrosage',text:'Arrosage si chaleur'}]},
  'Épicéa':   {tasks:[{months:[4,5],type:'taille',text:'Taille légère début printemps'},{months:[3],type:'traitement',text:'Traitement pucerons'}]},
  'Charme':   {tasks:[{months:[6],type:'taille',text:'Taille de formation'},{months:[10,11],type:'taille',text:'Taille légère automne'}]},
  'Platane':  {tasks:[{months:[11,12,1,2],type:'taille',text:'Taille / plantation en têtard (hiver)'},{months:[5],type:'traitement',text:'Surveillance tigre du platane'}]},
  'Marronnier':{tasks:[{months:[11,12,1,2],type:'taille',text:'Taille hivernale'},{months:[6,7],type:'traitement',text:'Surveillance mineuse du marronnier'}]},
  'Saule pleureur':{tasks:[{months:[2,3],type:'taille',text:'Taille fin hiver (avant montée de sève)'},{months:[6],type:'taille',text:'Allègement estival léger'}]},
  'Robinier': {tasks:[{months:[12,1,2],type:'taille',text:'Taille hivernale (bois cassant)'}]},
  'Catalpa':  {tasks:[{months:[2,3],type:'taille',text:'Taille de fin hiver (tolère taille sévère)'}]},
  'Ginkgo':   {tasks:[{months:[11,12],type:'taille',text:'Taille légère hiver'}]},
  'Liquidambar':{tasks:[{months:[11,12,1],type:'taille',text:'Taille hivernale légère'}]},
  'Albizia':  {tasks:[{months:[3],type:'taille',text:'Taille fin hiver'},{months:[6,7,8],type:'arrosage',text:'Arrosage jeune sujet'}]},
  'Sorbier':  {tasks:[{months:[11,12,1],type:'taille',text:'Taille hivernale légère'}]},
  'Eucalyptus':{tasks:[{months:[3,4],type:'taille',text:'Taille / recépage printemps'},{months:[6,7,8],type:'arrosage',text:'Arrosage jeune sujet'}]},
  'Mimosa':   {tasks:[{months:[3,4],type:'taille',text:'Taille juste après floraison'}]},
  'Érable du Japon':{tasks:[{months:[7,8],type:'taille',text:'Taille estivale très légère (jamais en hiver)'},{months:[6,7,8],type:'arrosage',text:'Arrosage (craint la sécheresse)'}]},
  'Houx':     {tasks:[{months:[5,6],type:'taille',text:'Taille printemps'},{months:[8,9],type:'taille',text:'Taille fin été'}]},
  'Mélèze':   {tasks:[{months:[11,12,1],type:'taille',text:'Taille hivernale (conifère caduc)'}]},
  'Figuier':  {tasks:[{months:[3],type:'taille',text:'Taille fin hiver'},{months:[6],type:'taille',text:'Pincement des pousses'}]},
  'Abricotier':{tasks:[{months:[8,9],type:'taille',text:'Taille après récolte (éviter l\'hiver)'},{months:[3],type:'traitement',text:'Traitement contre la moniliose'}]},
  'Pêcher':   {tasks:[{months:[2,3],type:'taille',text:'Taille avant floraison'},{months:[2],type:'traitement',text:'Traitement contre la cloque'}]},
  'Amandier': {tasks:[{months:[7,8],type:'taille',text:'Taille après récolte'},{months:[2],type:'traitement',text:'Traitement préventif cloque'}]},
  'Cognassier':{tasks:[{months:[11,12,1,2],type:'taille',text:'Taille hivernale'},{months:[3],type:'traitement',text:'Surveillance entomosporiose'}]},
  'Néflier':  {tasks:[{months:[2,3],type:'taille',text:'Taille légère fin hiver'}]},
  'Citronnier':{tasks:[{months:[3,4],type:'taille',text:'Taille printemps'},{months:[5,6,7,8,9],type:'arrosage',text:'Arrosage régulier'},{months:[11],type:'traitement',text:'Hivernage si gel (< 0 °C)'}]},
  'Arbousier':{tasks:[{months:[3,4],type:'taille',text:'Taille légère printemps'}]},
  default:    {tasks:[{months:[1,2,3],type:'taille',text:'Taille hivernale'},{months:[5],type:'traitement',text:'Traitement préventif printemps'}]},
};
const MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const MONTHS_SHORT=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

// ════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════
const S = {
  step:0,
  garden:{w:0,h:0,poly:null},   // poly = polygone de terrain (m) optionnel ; null = rectangle w×h
  elements:[],
  nextId:1,
  selected:null,
  tool:'move',
  pending:null,
  view:'2d',
  snap:false,
  growth:0,           // projection years for tree growth
  region:'Centre',    // climate region for maintenance offset
  sun:{hour:14,month:6},
  projectName:'Mon jardin',
  customSpecies:{trees:{},hedges:{}},  // espèces ajoutées via la recherche GBIF (persistées)
};

const REGIONS={
  'Nord':1, 'Centre':0, 'Ouest océanique':0, 'Sud / Méditerranée':-1, 'Montagne':2
};

// Short care tips per species
const PLANT_INFO={
  'Chêne':'Arbre majestueux à croissance lente, taille minimale.',
  'Hêtre':'Supporte bien la taille, idéal en sujet isolé ou haie haute.',
  'Érable':'Ne jamais tailler en hiver (montée de sève), préférer l\'été.',
  'Cerisier':'Tailler uniquement en été pour éviter chancre et gommose.',
  'Pommier':'Taille hivernale de fructification essentielle pour la récolte.',
  'Olivier':'Résistant à la sécheresse, taille en gobelet au printemps.',
  'Bambou':'Très gourmand en eau ; poser une barrière anti-rhizome.',
  'Palmier':'Surveiller le charançon rouge ; arrosage estival régulier.',
  'Thuya':'Croissance rapide, deux tailles par an pour rester dense.',
  'Cyprès de Leyland':'Pousse très vite : jusqu\'à 3 tailles/an nécessaires.',
  'Laurier-palme':'Tailler au sécateur (pas au taille-haie) pour les grandes feuilles.',
  'Buis':'Surveiller la pyrale du buis dès le printemps.',
  'If':'Tolère une taille sévère, très longévif.',
  'Platane':'Idéal en alignement ; conduite en têtard par tailles hivernales.',
  'Marronnier':'Surveiller la mineuse (feuilles brunes en été) ; ramasser les feuilles.',
  'Saule pleureur':'Aime les sols humides ; tailler en fin d\'hiver, jamais en sève.',
  'Érable du Japon':'Mi-ombre, sol frais ; ne pas tailler en hiver, redoute le vent sec.',
  'Ginkgo':'Très résistant (pollution, maladies) ; croissance lente, peu de taille.',
  'Catalpa':'Grandes feuilles, ombrage rapide ; supporte une taille sévère.',
  'Figuier':'Plein soleil ; taille légère en fin d\'hiver pour aérer.',
  'Pêcher':'Traiter contre la cloque dès la fin d\'hiver ; tailler avant floraison.',
  'Abricotier':'Tailler après la récolte, jamais en hiver (risque de gommose).',
  'Citronnier':'Gélif : rentrer ou protéger en dessous de 0 °C ; arrosage suivi.',
  'Eucalyptus':'Croissance très rapide ; recéper au printemps pour le contenir.',
  'Mimosa':'Floraison hivernale parfumée ; tailler juste après la floraison.',
  'Houx':'Pousse lente, supporte l\'ombre ; idéal en haie défensive persistante.',
  'Lavande':'Plein soleil, sol drainé ; taille après floraison sans toucher le vieux bois.',
  'Forsythia':'Tailler immédiatement après la floraison pour fleurir l\'an suivant.',
  'Cornouiller':'Recéper sévèrement en fin d\'hiver pour des bois colorés éclatants.',
  'Escallonia':'Persistant fleuri, supporte l\'air marin ; taille après floraison.',
};

const STEP_NAMES=['Terrain','Bâti','Allées','Haies','Arbres','Gazon','Jardin'];
const ST={TERRAIN:0,BATI:1,ALLEE:2,HAIE:3,ARBRE:4,GAZON:5,FINAL:6};

