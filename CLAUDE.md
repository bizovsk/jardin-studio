# Guide pour Claude Code — Jardin Studio

Ce fichier oriente le travail sur ce dépôt. Lis-le avant de modifier le code.

## Vue d'ensemble

Application monopage de modélisation de jardin. Pas de framework, pas de build :
HTML + CSS + JavaScript « vanilla », Three.js via CDN. Le rendu 2D est sur `<canvas>`,
la 3D via Three.js (r128).

## Démarrer

```bash
python3 -m http.server 8000   # puis http://localhost:8000
```

## Contraintes d'architecture à respecter

- Les fichiers `js/*.js` sont des **scripts classiques** partageant la portée globale.
  L'ordre dans `index.html` est significatif. Si tu ajoutes un fichier, insère sa balise
  `<script>` au bon endroit (après ses dépendances exécutées au chargement).
- L'état applicatif global est l'objet **`S`** (dans `js/data.js`). Toute donnée persistée
  passe par `serialize()` / `applyData()` dans `js/persistence.js` : si tu ajoutes un champ
  à sauvegarder, mets ces deux fonctions à jour.
- Le rendu 2D part de `draw()` (canvas2d.js). Les deux moteurs 3D sont `init3d()` (léger)
  et `initRealistic3d()` (réaliste) ; `setView()` bascule entre 2D / 3D / 3D+.
- Performance : le moteur « basic » évite ombres et antialiasing volontairement. Garder
  cette distinction ; ne pas alourdir la vue rapide.

## Conventions

- Langue de l'UI et des commentaires : français.
- Unités : mètres. Coordonnées monde = mètres ; conversion écran via `w2s()` / `s2w()`.
- Les éléments du jardin sont des objets `{id, type, name, x, y, w, d, h, rot, ...}`.
  Les arbres ont `spread` (frondaison) ; les allées ont `path` (liste de points) et `width`.

## Améliorations suggérées (par ordre de valeur)

1. **Tests** : il n'y en a aucun. Ajouter des tests unitaires (Vitest/Jest) sur la logique
   pure : `gatherTasks()`, `shiftMonth()`, `waterEstimate()`, `hitTest()`, `getRectCorners()`.
2. **Passage en modules ES** : convertir `js/*.js` en `import`/`export` pour supprimer la
   dépendance à l'ordre global et clarifier les frontières. Étape préalable à un bundler.
3. **Bundler léger** (Vite) : hot-reload, build minifié, import de Three.js en dépendance
   plutôt que CDN.
4. ~~**Import cadastral par adresse**~~ ✅ *Fait* — voir `js/cadastre.js` (BAN + cadastre IGN +
   BD TOPO IGN). La parcelle ET les bâtiments (emprise au sol + `hauteur` réelle, couche WFS
   `BDTOPO_V3:batiment` sur `data.geopf.fr`) sont projetés en mètres avec **la même origine**
   (`projectLonLat`/offset commun) pour rester alignés. Parcelle → `setGardenPolygon()` ;
   bâtiments → éléments `{type:'house', poly, h, src:'cadastre'}` extrudés en 3D.
5. ~~**Terrain non rectangulaire**~~ ✅ *Fait* — `S.garden.poly` (helpers dans `canvas2d.js` :
   `gardenPoly`, `setGardenPolygon`, `polyArea`…). Reste à faire : édition du polygone point
   par point à la souris (actuellement il provient du cadastre uniquement).
6. **Accessibilité & mobile** : tactile *fait* (pan/pincement 2D + orbite 3D dans
   `interactions.js` / `three-basic.js`, responsive dans `styles.css`). Reste : contrastes,
   navigation clavier.
7. **Robustesse persistance** : versionner le schéma de sauvegarde (`version` dans serialize)
   pour gérer les migrations futures. `S.garden.poly` est déjà sérialisé (objet `garden` entier).

> Note : la base d'espèces (`TREE_DATA`, `HEDGE_DATA`, `MAINTENANCE`, `PLANT_INFO` dans
> `js/data.js`) compte ~45 arbres et ~28 haies. La forme `'weeping'` (saule pleureur) est gérée
> dans les deux moteurs 3D ; une nouvelle `form` d'arbre doit être ajoutée à `addTree3d()` et
> `addTreeRealistic()` (sinon rendu arrondi par défaut).
>
> Recherche libre d'espèces : `js/species-search.js` interroge GBIF (`species/search`,
> `highertaxonKey=6` = Plantae, référentiel backbone) — gratuit, sans clé, CORS ouvert. Une
> espèce choisie hors base est **injectée** dans `TREE_DATA`/`HEDGE_DATA` (forme déduite de la
> famille via `guessTreeDef`, entretien générique) ET mémorisée dans `S.customSpecies`, qui est
> sérialisé et **réinjecté au chargement** (`reinjectCustomSpecies()` appelé dans `applyData`).
> Les recherches affichent d'abord les correspondances de la base curée, puis les résultats GBIF.

## Pièges à éviter

- Ne pas appeler `renderPanel()` à chaque `input` d'un curseur situé DANS le panneau latéral :
  cela reconstruit le DOM et casse le glissement. Voir le traitement de `rot` dans `editEl()`
  (mise à jour du seul label) comme modèle.
- `localStorage` peut être indisponible (mode privé, certains contextes `file://`). Le code
  dégrade déjà vers l'export `.json` ; conserver ce repli.
- Certains éléments reçoivent un `style.display` **inline** en JS (ex. `updateStats()` met
  `statsChips.style.display='flex'`). Pour les masquer en CSS (responsive), il faut `!important`,
  sinon le style inline gagne.
- Sol 3D polygonal (`shapeGeomFromPoly` dans `three-basic.js`) et bâtiments à contour
  (`extrudeGeomFromPoly`) : le `THREE.Shape` est construit avec `-y`, puis `geometry.rotateX(-π/2)`,
  pour que le `y` du polygone (mètres, axe écran) se retrouve en `+z` monde, normale vers le haut
  (et l'extrusion `+z` devienne la hauteur `+y`, base au sol). Ne pas « simplifier » ce signe.
- Les éléments à `poly` (gazon de fond, bâtiments cadastraux) ont un chemin de rendu/hit-test
  dédié (polygone), distinct du rectangle `x,y,w,d`. `hitTest` teste `pointInPoly` ; pas de
  poignées de redimensionnement ni de rotation ; le déplacement translate tout l'anneau.
- Alignement grille/terrain : à l'import cadastral, la géométrie (parcelle + bâtiments) est
  **pré-tournée** de `-θ` autour du centroïde (`polyDominantAngle`) pour que le bord dominant soit
  parallèle aux axes de la grille (placement aligné). Le vrai cap nord est stocké dans
  `S.garden.north = -θ` (sérialisé) et la boussole `#compass2d` ajoute ce décalage
  (`rotate(CAM.rot + S.garden.north)`). Terrain rectangulaire manuel → `north=0` (nord en haut).
- Rotation du plan 2D : `CAM.rot` (rad) + `CAM.pivot` (centre du terrain). **Toute** la
  conversion passe par `w2s`/`s2w` (rotation autour du pivot), donc rendu, hit-test, drag et
  placement suivent automatiquement. Deux exceptions à garder synchronisées manuellement : le
  rectangle de `drawEl` tourne via `ctx.rotate((el.rot||0)+CAM.rot)`, et `drawZonePreview` dessine
  un quadrilatère (4 coins `w2s`) et non un `fillRect`. `zoomAt` utilise la coord. « monde tournée »
  `(ox-CAM.x)/scale` (pas `s2w`) pour rester ancré sous le curseur. Bouton du milieu = pivoter
  (`interactions.js`), boussole `#compass2d` (rose tournée de `CAM.rot`).
- Sur cette machine **Python et Node sont absents** : servir l'app avec `.claude/serve.ps1`
  (serveur statique PowerShell) plutôt que `python3 -m http.server`.
