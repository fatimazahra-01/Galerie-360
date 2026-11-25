# Galerie 360

Musée virtuel en 3D (Three.js) : une salle navigable, des objets éclairés par des spots, des gags animés (une momie qui dit bonjour…) et une vue « artefact » en écran partagé avec storytelling et narration audio.

## Lancer le projet
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # version de production dans dist/
```
Prérequis : Node.js 20 ou plus.

## Contrôles
| Action | Commande |
|---|---|
| Entrer dans le musée | Bouton « Entrer » |
| Se déplacer | ZQSD ou WASD ou flèches (Maj pour courir) |
| Regarder | Souris |
| Examiner un objet | Viser (le viseur devient doré) puis clic |
| Quitter la fiche | Bouton ✕ ou Échap |
| Couper le son | Bouton en haut à droite ou touche M |
| Pause / reprendre | Échap / clic dans la scène |
| Easter egg | Fiche de la momie : 3 clics rapides sur elle |

## Structure
```
public/artifacts.json   contrat partagé (objets, textes, sons)
public/models/          modèles GLB (membre B)
public/audio/           sons et narrations
src/scene/              salle, lumières, navigation, caméra (membre A)
src/objects/            gags et animations (membre B)
src/viewer/             vue artefact 3D (membre B)
src/ui/                 interface et audio (membre C)
```

## Ajouter un objet
1. Déposer le `.glb` dans `public/models/`.
2. Ajouter une entrée dans `public/artifacts.json` (id, model, position, textes, audio).
3. Déposer la narration dans `public/audio/`.

## Événements (window)
`museum:enter` · `artifact:select` (detail = artefact) · `artifact:close` · `mummy:wave` · `mummy:dance`

## Crédits
Voir [CREDITS.md](CREDITS.md).
