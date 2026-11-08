# Contribuer à Ora

Toute contribution passe par une branche et une pull request vers `main`. L'intégration continue lance les tests ; la fusion dans `main` publie le site. Avant de pousser :

```
npm test && npm run build && npm run test:e2e
```

## Où écrire : `data/` fait foi

Tout texte d'Ora (prière, explication, titre, histoire…) s'écrit **une seule fois, dans `data/`**. Les scripts d'`outils/` lisent `data/` et n'y recopient aucun texte : ils ne contiennent que des références, des identifiants et des règles (vérifié par `tests/source-unique.test.mjs`). Le README décrit chaque fichier de `data/` (« Les données ») ; chaque fichier commence par une `_note`.

Trois fichiers sont fabriqués par un script, à relancer après avoir modifié leurs sources : `lectionnaire.json` (`npm run lectionnaire`), `prieres-jour.json` (`npm run prieres`, sauf ses parties `traditionnelles` et `notes`, écrites à la main) et, une seule fois, les Bibles (`outils/bible.py`, `outils/bibles.py` : ils écrivent dans `outils/sortie/`, jamais dans `data/`).

## Ajouter une fête à date fixe

Exemple : une fête propre à l'Espagne, Notre-Dame du Pilier, le 12 octobre.

1. Dans `data/fetes.json`, ajouter une entrée à `fixes` :
   ```json
   { "date": "10-12", "id": "pilar", "nom": "Notre-Dame du Pilier", "nom_es": "Nuestra Señora del Pilar", "nom_en": "Our Lady of the Pillar",
     "rang": "fete", "couleur": "blanc", "regions": ["es"], "source": "Calendario litúrgico propio de España" }
   ```
   - `id` : un identifiant court, en minuscules, sans accent. Il devient la clé liturgique du jour.
   - `rang` : `solennite`, `fete-seigneur`, `fete` ou `commemoration`. Le moteur applique les règles de préséance (un dimanche de l'Avent, du Carême ou de Pâques l'emporte sur une fête, etc.).
   - `regions` (facultatif) : la fête n'existe que dans ces régions (`fr`, `es`, `us`).
2. Donner son Évangile : dans `outils/sources/lectionnaire-complements.json`, ajouter `"pilar": { "ref": "Lc 11, 27-28", "source": "…" }`, puis lancer `npm run lectionnaire`. La référence s'écrit à la française (`Lc 11, 27-28`, `Jn 15, 26-27 ; 16, 12-15`).
3. (Facultatif) Expliquer la fête : dans `data/explications.json` (`fetes.pilar` : `quoi`, `pourquoi`, `idee`), et ses traductions dans `data/i18n/es.json` et `data/i18n/en.json`.
4. Ajouter un test dans `tests/liturgie.test.mjs` (par exemple : `assert.equal(fete('2026-10-12', 'es'), 'pilar')`).
5. `npm test`, puis pousser. Après fusion dans `main`, le site est publié automatiquement.

Une fête mobile (liée à Pâques ou à Noël) se déclare dans `src/js/liturgie.js`, fonctions `reperes()` et `mobiles()`.

## Ajouter ou corriger un Évangile

Le lectionnaire (`data/lectionnaire.json`) est fabriqué par `outils/lectionnaire.mjs` à partir des références de l'AELF (`outils/sources/aelf-evangiles.json`) et des compléments (`outils/sources/lectionnaire-complements.json`). Ne pas le modifier à la main : corriger les sources, puis `npm run lectionnaire`. Si les versets ne sont pas numérotés de la même façon dans une Bible, ajouter la correspondance dans `outils/sources/versification.mjs`.

## Ajouter des prières de fête

Dans `outils/prieres_jour.py`, dictionnaire `CELEBRATIONS`, par clé liturgique (`'toussaint'`, `'avent-dim-1'`…) : une prière traditionnelle (son identifiant) ou un verset biblique (`('ps130-1', 'Ps', 130, [1, 2])`, numérotation française). Le texte d'une prière traditionnelle s'écrit dans `data/prieres-jour.json`, partie `traditionnelles` (`fr`, `es`, `en`, `src`) ; si le lien avec la fête n'est pas évident, une note dans la partie `notes`. Puis `npm run prieres`. Aucune prière ne doit être inventée.

## Écrire pour la bibliothèque des jours ordinaires

Citations, réflexions, histoires, portraits et « Le savais-tu ? » (`data/bibliotheque.json`) : suivre les règles de `outils/sources/bibliotheque/GUIDE.md` (sources, alternance des saints, périodes, trois langues, signature courte des citations).

## Ajouter un contenu éditorial

Dans `data/contenus.json`, une entrée par célébration (clé liturgique), avec `fr`, `es` et `en` : `meditation`, `citation` (avec `auteurId`, à déclarer dans `data/auteurs.json`), `reflexion`, `histoire`, `portrait`, `savaisTu`, `enfant`. La prière de la réflexion est un verset (`priereReflexion`), dont le texte est lu dans chaque Bible par `npm run prieres`. Les tests refusent un auteur inconnu, une clé que le moteur ne produit pas, ou la même personne citée deux jours de suite.

## Ajouter un mot au lexique

Dans `data/lexique.json` (`id`, `mot`, `formes`, `def`), et ses traductions dans `data/i18n/es.json` et `en.json` (même `id`). Ne souligner que les mots propres à la foi ou à la liturgie : les mots courants vont dans `EXCLUS` (`src/js/app.js`).

## Style

Proposer, jamais imposer ; pas de jargon sans explication ; « Lui » et « Toi » avec une majuscule quand il s'agit de Dieu (« Él », « Ti » en espagnol).
