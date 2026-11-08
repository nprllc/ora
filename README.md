# Ora

Ora est une web-app catholique gratuite, l'app des premiers pas vers Dieu : chaque jour, le saint ou le sens du jour, une prière, un passage de l'Évangile (choisi par Ora pour être lu seul ; les jours de fête qui ont leur propre contenu, l'Évangile de la messe), et selon les jours une citation, une réflexion, une histoire, un portrait et une découverte. L'Évangile de la messe du jour reste toujours à un toucher (bouton « Évangile de la messe »). Un espace « En famille » propose la même chose pour les 4-8 ans. En français, en espagnol et en anglais.

Ora n'a ni compte, ni serveur, ni publicité, ni pistage. Elle n'appelle aucune intelligence artificielle. Elle fonctionne hors ligne, et s'installe sur un téléphone depuis le navigateur (sur iPhone : Safari, Partager, « Sur l'écran d'accueil »).

Adresse : https://nprllc.github.io/ora/

## Architecture

```
src/            le code de l'app
  index.html    la page (modèle : le build y intègre le CSS, le JS et le noyau des données)
  css/app.css   le design (Aube le jour, Veille le soir)
  js/liturgie.js  le moteur du calendrier liturgique (Pâques, temps, fêtes, régions, clés liturgiques)
  js/aquarelle.js le ciel peint à l'aquarelle générative
  js/app.js     les écrans, la navigation, les réglages
  sw.js         le service worker (modèle : le build y met la VERSION et la liste des fichiers)
  fonts/        la police Sora (licence OFL), servie avec l'app
  icons/, manifest.webmanifest
data/           les contenus, séparés du code (réutilisables par une future version native) : voir « Les données » ci-dessous
outils/         les scripts qui produisent les données et le site
  build.mjs           fabrique dist/
  lectionnaire.mjs    fabrique data/lectionnaire.json
  prieres_jour.py     fabrique data/prieres-jour.json
  bible.py, bibles.py ont fabriqué les Bibles une fois (sources hors dépôt) ; ils écrivent dans outils/sortie/, jamais dans data/
  references.mjs      lecture des références bibliques (« Jn 15, 26-27 ; 16, 12-15 »)
  sources/            les données d'origine : références AELF, compléments du Lectionnaire, numérotation des versets ;
                      sources/bibliotheque/GUIDE.md : les règles d'écriture de la bibliothèque
tests/          les tests (node --test) ; tests/e2e/ : tests de bout en bout dans Chromium (Playwright)
```

### Le principe : des clés liturgiques, jamais de dates

Le moteur (`src/js/liturgie.js`) calcule pour chaque jour sa liste de **clés liturgiques**, de la plus précise à la plus générale : la célébration (`toussaint`, `paques`, `epiphanie`…), puis le jour férial (`to-31-2` = mardi de la 31e semaine du temps ordinaire, `avent-dim-1`, `careme-3-5`, `paques-6-4`, `noel-0103`, `noel-apres-epiphanie-2`…). Chaque clé est essayée avec le cycle dominical (`-A`, `-B`, `-C`) et l'année paire ou impaire (`-I`, `-II`), puis seule.

Le lectionnaire, les contenus éditoriaux et les prières de fête sont rangés par ces clés. Les prières ordinaires tournent selon le jour de l'année liturgique (`indexAnnee`). Le lectionnaire, les contenus de fête et les prières ne contiennent aucune date civile : l'app fonctionne pour n'importe quelle année (les tests vont de 2026 à 2040, et le moteur de 1900 à 2199). Seuls les titres des jours (`jours.json`) et les éléments datés de la bibliothèque (`date`) sont rangés par date civile `MM-JJ`, parce qu'ils suivent le calendrier des saints.

### Les régions

La région liturgique n'est pas un réglage : elle suit la langue (France pour le français, Espagne pour l'espagnol, États-Unis pour l'anglais).

| Région | Épiphanie | Ascension | Saint-Sacrement | Fêtes propres |
|---|---|---|---|---|
| France (`fr`) | dimanche entre le 2 et le 8 janvier | jeudi | dimanche | — |
| Espagne (`es`) | 6 janvier | 7e dimanche de Pâques | dimanche | Santiago (25 juillet, solennité), Pilar (12 octobre) |
| États-Unis (`us`) | dimanche entre le 2 et le 8 janvier | 7e dimanche de Pâques (majorité des provinces) | dimanche | Guadalupe (12 décembre) |

### Les Bibles

Trois traductions catholiques du domaine public : Crampon (1923) en français, Douay-Rheims (révision Challoner) en anglais, Biblia Platense (Mgr Straubinger) en espagnol. Les Psaumes sont dans la numérotation hébraïque, comme dans la liturgie.

**Numérotation des versets.** Le Lectionnaire suit la numérotation moderne ; la Crampon et la Douay-Rheims gardent par endroits celle de la Vulgate, et la Platense réunit parfois deux versets. Les correspondances connues sont dans `outils/sources/versification.mjs` (Mt 17, Mc 4, Mc 8-9, Lc 3, Jn 6, Jn 11) ; le lectionnaire en tire, pour chaque passage concerné, la liste des versets propre à chaque Bible (champ `vl`). Un test vérifie que chaque verset cité existe dans les trois Bibles.

Les sources des Bibles (plus de 150 Mo) ne sont pas dans le dépôt : texte Crampon extrait de Wikisource ; Douay-Rheims, dépôt `ecclesia-dev/drb` ; Platense, module CrossWire `SpaPlatense` (dépôt `OmarGonD/biblia-elim`). `outils/bible.py` et `outils/bibles.py` les transforment en `data/bible*.json`.

## Les données (`data/`)

`data/` fait foi : chaque texte d'Ora n'y est écrit qu'une fois (vérifié par `tests/source-unique.test.mjs`). Chaque fichier commence par une `_note` qui décrit sa forme (vérifié par `tests/documentation.test.mjs`, qui vérifie aussi que chacun figure dans ce tableau).

Au build, la page garde le **noyau** (ce qui sert à calculer le jour : fêtes, lectionnaire, lexique, interface…) ; les contenus propres à une langue partent dans `dist/donnees-<langue>.<empreinte>.json`, lu au démarrage et mis en cache pour le hors-ligne (`outils/build.mjs`, `PAR_LANGUE`). La page ne doit pas dépasser 500 Ko (le build échoue sinon).

| Fichier | Rôle | Écran | Écrit par | Ajouter un élément |
|---|---|---|---|---|
| `abreviations.json` | abréviations et noms des livres de la Bible, vers leur identifiant OSIS | toutes (références cliquables) | à la main | une clé dans la langue (`"Mt": "Matt"`) |
| `auteurs.json` | courte présentation des personnes citées | toucher le nom d'un auteur | à la main | une entrée par `id` (`fr`, `es`, `en` : `nom`, `bio`) ; l'`auteurId` d'une citation y renvoie |
| `bible.json`, `bible-es.json`, `bible-en.json` | les trois Bibles (Crampon, Platense, Douay-Rheims) | Bible, passages du jour | `outils/bible.py`, `outils/bibles.py` (une fois), corrigées depuis à la main | — (correction d'un verset : dans le fichier) |
| `bibliotheque.json` | citations, réflexions (et leur version enfant), histoires, portraits, « Le savais-tu ? » des jours sans contenu propre | Aujourd'hui, En famille | à la main | voir `outils/sources/bibliotheque/GUIDE.md` |
| `coeur-evangile.json` | le « cœur » de chaque Évangile de la messe : les versets montrés sur Aujourd'hui | Aujourd'hui | à la main | `"Mc 4, 35-41": [39, 40]` (référence telle qu'elle figure dans le lectionnaire) |
| `conseils.json` | petits conseils, quand la fête n'a pas d'idée à vivre propre | Aujourd'hui (En savoir plus) | à la main | une phrase dans `conseils` ; traductions dans `i18n/es.json`, `i18n/en.json` |
| `contenus.json` | contenus éditoriaux propres à une célébration (méditation, citation, réflexion…) | Aujourd'hui | à la main | voir `CONTRIBUTING.md` |
| `evangiles.json` | l'Évangile du jour d'Ora : des passages complets, rangés par temps, et ceux des fêtes | Aujourd'hui | à la main | `["Lc 15, 1-7", "Titre"]` dans la liste du temps ; titres es/en dans `evangiles-titres.json` |
| `evangiles-enfants.json` | l'Évangile d'« En famille », choisi pour les 4-8 ans | En famille | à la main | `["Mc 4, 37-41", {"fr", "es", "en"}]` dans la liste du temps |
| `evangiles-titres.json` | titres espagnols et anglais des passages de `evangiles.json` | Aujourd'hui | à la main | `es` et `en`, par référence (le build refuse un titre manquant) |
| `explications.json` | le sens des temps liturgiques et des grandes fêtes (quoi, pourquoi, idée) | Aujourd'hui (En savoir plus) | à la main | `fetes.<id>` ou `saisons.<id>` ; traductions dans `i18n/` |
| `famille-mots.json` | le mot du jour pour les enfants | En famille | à la main | `{ id, fr, es, en }` dans `mots` |
| `famille-personnages.json` | le personnage de la Bible du jour, raconté aux enfants | En famille | à la main | `{ id, temps?, fr, es, en }` dans `personnages` |
| `fetes.json` | solennités et fêtes à date fixe, fêtes propres des régions | toutes (calendrier) | à la main | voir `CONTRIBUTING.md` |
| `guide-famille.json` | le rituel du coucher (texte français) | En famille | à la main | une étape dans `etapes` ; traductions dans `i18n/`, clé `guide-famille` |
| `jours.json` | le titre de chaque jour (saint, personnage, anniversaire), par date `MM-JJ`, dans les trois langues | Aujourd'hui | à la main | `[titre, phrase, { qui, sens, vivre }]` à la même date dans `fr`, `es`, `en` |
| `lectionnaire.json` | l'Évangile de la messe, par clé liturgique | Aujourd'hui (bouton « Évangile de la messe ») | `outils/lectionnaire.mjs` (`npm run lectionnaire`) | ne pas modifier à la main : voir `CONTRIBUTING.md` |
| `lexique.json` | les mots de la foi, en deux ou trois phrases | Lexique, mots soulignés partout | à la main | voir `CONTRIBUTING.md` |
| `livres-resumes.json` | la présentation de chaque livre de la Bible | Bible | à la main | dans `livres`, par OSIS : `slug` (USCCB), `fr`, `es`, `en` ; le build les ajoute aux Bibles (`res`, `src`) |
| `messe.json` | la messe pas à pas | Prier | à la main | une étape dans `parties`, dans `fr`, `es` et `en` |
| `prieres-jour.json` | prières du jour et du soir (adultes, enfants, fêtes, réflexions) | Aujourd'hui, En famille | `traditionnelles` et `notes` à la main ; le reste par `outils/prieres_jour.py` (`npm run prieres`) | voir `CONTRIBUTING.md` |
| `prieres.json` | les prières traditionnelles, avec quand et pourquoi les dire | Prier | à la main | une entrée dans `traditionnelles` ; traductions dans `i18n/` |
| `temps.json` | pendant les temps forts, le titre de chaque jour sur le sens du temps | Aujourd'hui | à la main | une ligne `[titre, phrase]` par jour du temps, dans les trois langues |
| `i18n/ui.json` | les textes de l'interface | toutes | à la main | une clé dans `fr`, `es` et `en` |
| `i18n/es.json`, `i18n/en.json` | traductions des explications, conseils, prières, rituel, lexique | toutes | à la main | même `id` que le texte français |

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
