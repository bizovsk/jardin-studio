# Jardin Studio 🌿

Application web de modélisation de jardin (2D / 3D) avec calendrier d'entretien.
100 % côté client, sans dépendance serveur. Une seule librairie externe : Three.js (chargée via CDN).

## Lancer le projet

Aucune compilation n'est nécessaire. Comme le code est découpé en plusieurs fichiers
chargés par `<script src>`, il faut le servir via un petit serveur local (ouvrir le
fichier directement en `file://` peut bloquer le chargement des modules selon le navigateur).

```bash
# Au choix :
python3 -m http.server 8000
#   puis ouvrir http://localhost:8000

# ou avec Node :
npx serve .
```

Sur **Windows sans Python ni Node**, un mini-serveur PowerShell est fourni (aucun
droit administrateur requis) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .claude\serve.ps1 -Port 8000
#   puis ouvrir http://127.0.0.1:8000
```

> La version « tout-en-un » historique reste disponible : `../jardin3d.html`
> (un seul fichier, ouvrable directement par double-clic, sans serveur).

## Fonctionnalités

- **Modélisation guidée** en 6 étapes : terrain → bâti → allées → haies → arbres → gazon.
- **Import cadastral par adresse** (France) : le contour réel de la parcelle devient la
  forme du terrain, **et les bâtiments présents sont modélisés** (emprise au sol + hauteur
  réelle, extrudés en 3D). Géocodage Base Adresse Nationale + cadastre IGN + BD TOPO IGN
  (Géoplateforme), gratuit et sans compte.
- **Terrain non rectangulaire** : le plan 2D et la 3D épousent un polygone de terrain.
- **Orientation du plan 2D** : maintenir le **bouton du milieu** de la souris fait pivoter le
  plan autour de la parcelle ; une boussole N/E/S/O suit l'orientation (clic dessus = nord en haut).
- **Tracé direct sur le plan 2D** : zones rectangulaires au clic-glisser, allées à main levée.
- **Édition** : sélection, déplacement, redimensionnement par poignées, rotation.
- **Aimant** : alignement sur une grille au mètre.
- **Base d'espèces** : ~45 arbres et ~28 haies/arbustes courants (port, frondaison, couleurs,
  entretien). La frondaison des arbres est déduite de l'espèce et de la hauteur.
- **Recherche de n'importe quelle plante** (GBIF, gratuit sans clé) : un champ d'auto-complétion
  trouve toute espèce par nom commun ou scientifique. Les espèces de la base curée sont proposées
  en tête ; une espèce inconnue est ajoutée avec une forme 3D déduite de sa famille botanique et
  un entretien générique (et mémorisée dans le projet).
- **3D performante** et **3D+ réaliste** (ombres, ciel, matériaux PBR).
- **Tactile / mobile** : panoramique et pincer-zoom au doigt (2D et orbite 3D),
  mise en page adaptée aux petits écrans.
- **Ensoleillement** : curseurs heure/mois qui déplacent le soleil dans la vue réaliste.
- **Projection de croissance** : curseur années qui fait grandir les arbres.
- **Calendrier d'entretien** : périodes de taille/arrosage/traitement par espèce,
  décalage selon la région climatique, estimation d'arrosage, fiches plantes, export `.ics`.
- **Persistance** : auto-sauvegarde + projets nommés (localStorage), import/export `.json`,
  export du plan en `.png`.

## Structure

```
jardin-studio/
├── index.html            # Structure de la page + ordre de chargement des scripts
├── css/
│   └── styles.css        # Toute la mise en forme
└── js/                   # Scripts classiques partageant la portée globale (ordre important)
    ├── data.js           # Données : espèces, entretien, état global S, régions, fiches
    ├── canvas2d.js       # Rendu 2D + helpers (snap, croissance, rotation)
    ├── three-basic.js    # Vue 3D performante
    ├── three-realistic.js# Vue 3D+ réaliste + setView()
    ├── interactions.js   # Souris : sélection, déplacement, redimensionnement, tracés
    ├── calendar.js       # Calendrier, .ics, arrosage
    ├── ui.js             # Panneau latéral, étapes, éditeur
    ├── elements.js       # Navigation + ajout d'éléments
    ├── sun.js            # Contrôle d'ensoleillement
    ├── persistence.js    # Sauvegarde / projets / export
    ├── cadastre.js       # Import parcelle + bâtiments par adresse (BAN + IGN cadastre/BD TOPO)
    ├── species-search.js # Recherche de plantes via GBIF + espèces personnalisées
    └── main.js           # Initialisation
```

## Note d'architecture

Les fichiers `js/*.js` sont des **scripts classiques** (pas des modules ES). Ils partagent
le même espace global : une fonction ou constante déclarée dans un fichier est visible dans
les autres. **L'ordre de chargement défini dans `index.html` doit être respecté** (les
déclarations exécutées au chargement, comme `const cv = ...` dans `canvas2d.js`, doivent
précéder leur première utilisation). Voir `CLAUDE.md` pour les pistes d'amélioration
(passage en modules ES, build, tests).

## Limites connues

- Données d'entretien et croissance = moyennes pour climat tempéré (France métropolitaine).
- L'import cadastral dépend de la disponibilité des API publiques (BAN + API Carto IGN) et
  de l'accès réseau ; en cas d'échec, on garde la saisie manuelle des dimensions.
- Le polygone de terrain n'est pas (encore) éditable point par point à la souris : il provient
  du cadastre, sinon le terrain reste un rectangle.
