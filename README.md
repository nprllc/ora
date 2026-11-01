# Ora

Ora est une web-app catholique gratuite, l'app des premiers pas vers Dieu : chaque jour, une prière, l'Évangile de la messe et le sens de la fête ou du temps liturgique, et certains jours une citation, une réflexion, une histoire, un portrait et une découverte. En français, en espagnol et en anglais.

Ora n'a ni compte, ni serveur, ni publicité, ni pistage. Elle n'appelle aucune intelligence artificielle. Elle fonctionne hors ligne, et s'installe sur un téléphone depuis le navigateur (sur iPhone : Safari, Partager, « Sur l'écran d'accueil »).

Adresse : https://nprllc.github.io/ora/

## Architecture

```
src/            le code de l'app
  index.html    la page (modèle : le build y intègre le CSS, le JS et les données)
  css/app.css   le design (Aube le jour, Veille le soir)
  js/liturgie.js  le moteur du calendrier liturgique (Pâques, temps, fêtes, régions, clés liturgiques)
  js/aquarelle.js le ciel peint à l'aquarelle générative
  js/app.js     les écrans, la navigation, les réglages
  sw.js         le service worker (modèle : le build y met la VERSION et la liste des fichiers)
  fonts/        la police Sora (licence OFL), servie avec l'app
  icons/, manifest.webmanifest
data/           les contenus, séparés du code (réutilisables par une future version native)
  fetes.json          solennités et fêtes à date fixe, et fêtes propres des régions
  lectionnaire.json   l'Évangile de la messe, rangé par clé liturgique (fabriqué par outils/lectionnaire.mjs)
  prieres-jour.json   prières du jour et du soir (fabriqué par outils/prieres_jour.py)
  contenus.json       contenus éditoriaux, rangés par célébration
  prieres.json, lexique.json, conseils.json, explications.json, guide-famille.json, auteurs.json, abreviations.json
  i18n/               l'interface (ui.json) et les traductions espagnole et anglaise (es.json, en.json)
  bible.json, bible-es.json, bible-en.json   les trois Bibles (domaine public)
  livres-resumes.json les présentations des livres de la Bible (sources : introductions de l'USCCB)
outils/         les scripts qui produisent les données et le site
  build.mjs           fabrique dist/
  lectionnaire.mjs    fabrique data/lectionnaire.json
  prieres_jour.py     fabrique data/prieres-jour.json
  bible.py, bibles.py fabriquent les Bibles (à partir de sources hors dépôt, voir plus bas)
  references.mjs      lecture des références bibliques (« Jn 15, 26-27 ; 16, 12-15 »)
  sources/            les données d'origine : références AELF, compléments du Lectionnaire, numérotation des versets
tests/          les tests (node --test) ; tests/e2e/ : tests de bout en bout dans Chromium (Playwright)
```

### Le principe : des clés liturgiques, jamais de dates

Le moteur (`src/js/liturgie.js`) calcule pour chaque jour sa liste de **clés liturgiques**, de la plus précise à la plus générale : la célébration (`toussaint`, `paques`, `epiphanie`…), puis le jour férial (`to-31-2` = mardi de la 31e semaine du temps ordinaire, `avent-dim-1`, `careme-3-5`, `paques-6-4`, `noel-0103`, `noel-apres-epiphanie-2`…). Chaque clé est essayée avec le cycle dominical (`-A`, `-B`, `-C`) et l'année paire ou impaire (`-I`, `-II`), puis seule.

Le lectionnaire, les contenus éditoriaux et les prières de fête sont rangés par ces clés. Les prières ordinaires tournent selon le jour de l'année liturgique (`indexAnnee`). Il n'y a aucune date civile dans les données : l'app fonctionne pour n'importe quelle année (les tests vont de 2026 à 2040, et le moteur de 1900 à 2199).

### Les régions

La région liturgique est un réglage distinct de la langue (Menu, « Région liturgique » ; par défaut : France pour le français, Espagne pour l'espagnol, États-Unis pour l'anglais).

| Région | Épiphanie | Ascension | Saint-Sacrement | Fêtes propres |
|---|---|---|---|---|
| France (`fr`) | dimanche entre le 2 et le 8 janvier | jeudi | dimanche | — |
| Espagne (`es`) | 6 janvier | 7e dimanche de Pâques | dimanche | Santiago (25 juillet, solennité), Pilar (12 octobre) |
| États-Unis (`us`) | dimanche entre le 2 et le 8 janvier | 7e dimanche de Pâques (majorité des provinces) | dimanche | Guadalupe (12 décembre) |

### Les Bibles

Trois traductions catholiques du domaine public : Crampon (1923) en français, Douay-Rheims (révision Challoner) en anglais, Biblia Platense (Mgr Straubinger) en espagnol. Les Psaumes sont dans la numérotation hébraïque, comme dans la liturgie.

**Numérotation des versets.** Le Lectionnaire suit la numérotation moderne ; la Crampon et la Douay-Rheims gardent par endroits celle de la Vulgate, et la Platense réunit parfois deux versets. Les correspondances connues sont dans `outils/sources/versification.mjs` (Mt 17, Mc 8-9, Lc 3, Jn 6, Jn 11) ; le lectionnaire en tire, pour chaque passage concerné, la liste des versets propre à chaque Bible (champ `vl`). Un test vérifie que chaque verset cité existe dans les trois Bibles.

Les sources des Bibles (plus de 150 Mo) ne sont pas dans le dépôt : texte Crampon extrait de Wikisource ; Douay-Rheims, dépôt `ecclesia-dev/drb` ; Platense, module CrossWire `SpaPlatense` (dépôt `OmarGonD/biblia-elim`). `outils/bible.py` et `outils/bibles.py` les transforment en `data/bible*.json`.

## Lancer en local

Il faut Node.js 20 ou plus récent (et Python 3 pour régénérer les prières).

```
npm ci                 # installe Playwright (pour les tests de bout en bout seulement)
npm test               # moteur liturgique et données
npm run build          # fabrique dist/
npm run serve          # sert dist/ sur http://localhost:8080/
npx playwright install chromium   # une seule fois
npm run test:e2e       # tests de bout en bout sur dist/
```

## Ajouter un contenu

Voir `CONTRIBUTING.md` : ajouter une fête, un Évangile, une prière de fête, un contenu éditorial, un mot du lexique.

## Publier

Il n'y a rien à téléverser à la main. Toute modification poussée sur la branche `main` déclenche l'intégration continue (`.github/workflows/ci.yml`) : tests, build, tests de bout en bout, puis publication de `dist/` sur GitHub Pages. Si un test échoue, rien n'est publié.

Réglage à faire une fois dans GitHub : Settings, puis Pages, puis Source : « GitHub Actions ».

## Règles éditoriales

- Aucune prière n'est inventée : seulement des prières de la Bible ou de la tradition de l'Église. Un test vérifie que chaque prière tirée de la Bible est le texte même de son verset (au nom divin près : « Yahweh » devient « le Seigneur », selon la lettre de la Congrégation pour le culte divin du 29 juin 2008).
- Chaque citation est vérifiée à sa source et citée dans sa traduction publiée. Jamais la même personne citée deux jours de suite (vérifié par les tests).
- Les textes du Lectionnaire de l'AELF sont protégés : Ora ne garde que les références et lit le passage dans sa propre Bible.
- Doctrine : le Catéchisme de l'Église catholique.

## Licences

Voir `LICENSE` : le code est sous licence MIT ; les textes rédigés pour Ora sont sous licence CC BY-SA 4.0 ; les Bibles et les prières traditionnelles sont du domaine public ; la police Sora est sous licence SIL Open Font License 1.1.
