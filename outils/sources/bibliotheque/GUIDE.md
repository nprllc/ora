# Bibliothèque des jours ordinaires — guide de production

Demande de Nico (3 novembre 2026) : **365 éléments par rubrique** (citations, réflexions, histoires,
portraits, « Le savais-tu ? »), en **français, espagnol et anglais**, **sans validation intermédiaire**.
Chaque jour sans contenu propre, chaque rubrique prend l'élément suivant de sa liste
(`src/js/app.js`, `bibliotheque()`) ; les rubriques n'ont aucun lien entre elles.

Fichier : `data/bibliotheque.json`. Tests : `tests/bibliotheque.test.mjs` (à faire passer avant chaque push).
Après chaque lot : `npm run build && npm test && npm run test:e2e`, commit, push sur `main`.

## Règles (non négociables)
- **Ton** : proposer, jamais imposer ; pas de « il faut », « tu dois », « vous devez » ; pas de culpabilisation ;
  doctrine fidèle au Catéchisme, dite simplement ; on tutoie le lecteur quand on s'adresse à lui.
- **Citations** : chaque citation est vérifiée **à sa source**, mot pour mot, dans sa **traduction publiée**
  (vatican.va pour les papes et le Catéchisme, dans chaque langue). Jamais d'approximation ni d'invention.
  Courtes (une ou deux phrases). Source précise : document, numéro, date. `auteurId` renvoie à `data/auteurs.json`
  (ajouter l'auteur s'il manque : nom + bio de 2-3 phrases, dans chaque langue disponible).
  **Jamais deux fois de suite le même auteur** (en tenant compte du retour au début de la liste).
  Uniquement des personnes sans faits graves retenus par l'histoire. Pour l'espagnol et l'anglais, reprendre le
  texte publié dans la langue (même document sur vatican.va), pas une traduction maison ; si introuvable,
  laisser la citation sans cette langue.
- **Réflexions** : un thème de la vie de tous les jours, présenté de façon neutre (`fait`, 2-3 phrases, pas de
  chiffres non sourcés), 1-2 versets du Nouveau Testament désignés par référence dans `versets`
  (le build lit le texte dans chaque Bible ; **pas de verset contenant un dialogue entre guillemets**),
  une `piste` douce et concrète, `sources`, et une `priere` = id d'un verset des prières du jour
  (`data/prieres-jour.json`, pools). Jamais partisan.
- **Histoires, portraits, « Le savais-tu ? »** : faits établis et sourcés (Britannica, vatican.va, sanctuaires,
  diocèses, dictionnaires) ; la tradition est dite comme tradition (« selon la tradition », « aurait »).
  Portraits : saints et figures chrétiennes sans faits graves ; dates ; accroche ; 3 paragraphes ; `plusLoin`.
- **« Le savais-tu ? » ne porte jamais sur un mot** (étymologie, sens d'un terme) : c'est le rôle du Mot du jour et du lexique (règle de Nico, 3 novembre 2026). Il porte sur un fait, un lieu, un usage, une découverte, une coutume.
- **Saints et saintes** (règles de Nico, 3 novembre 2026) : chaque citation et chaque portrait porte `"saint": true/false`
  (true pour un saint, une sainte ou un bienheureux ; false pour un vénérable, un serviteur de Dieu, un pape non canonisé,
  un laïc). **Citations : jamais plus de deux saints de suite. Portraits : jamais deux saints de suite.** Testé en boucle.
  Bons portraits non saints : vénérables (Lejeune, Delbrêl, Marthe Robin, Schuman, Gaudí), savants croyants (Pascal,
  Mendel, Lemaître), écrivains (Péguy). Écarter toute personne visée par des faits graves établis (par ex. Jean Vanier,
  l'abbé Pierre).
- **Périodes** (règle de Nico) : une histoire ou un fait lié à un temps ou à une date se raconte **à ce moment-là** :
  `"temps": ["avent"|"noel"|"careme"|"triduum"|"paques"]` (un par jour depuis le début du temps) ou `"date": "MM-JJ"`.
  Les éléments sans période tournent le reste de l'année. Pendant les temps forts, viser assez d'éléments de saison
  pour que **chaque jour du temps** en ait un (Carême : 43 jours, Avent : jusqu'à 28, Pâques : 50).
- **Histoires** : aussi des découvertes scientifiques ou archéologiques, des histoires méconnues, l'actualité
  (par ex. l'arche de Noé et le site de Durupınar) ; dire honnêtement ce qui est prouvé et ce qui ne l'est pas.
- **Aucune prière inventée.**
- Latin non francisé en italique dans l'affichage (géré par `OraLatin`), majuscule à Lui/Toi pour Dieu.

## Format d'un élément
Voir les éléments existants. Chaque élément : `{ "id": ..., "fr": {...}, "es": {...}, "en": {...} }`.
Les champs de langue sont ceux du français (traduits). Pour les réflexions, `versets` et `priere` sont hors langue.

## Sources pratiques pour les citations
Documents sur vatican.va (FR/ES/EN) : Evangelii gaudium, Laudato si', Gaudete et exsultate, Christus vivit,
Amoris laetitia, Fratelli tutti, Dilexit nos, Lumen fidei, Spe salvi, Deus caritas est, Novo millennio ineunte,
Salvifici doloris, Lettre aux enfants (1994), Dilexi te ; le Catéchisme (citations de saints) ;
les audiences générales de Benoît XVI sur les Pères et les saints (2007-2011), qui citent les saints dans
chaque langue. Pour ouvrir une page de vatican.va, la trouver d'abord par une recherche web.

## Avancement
Tenir à jour ici le nombre d'éléments par rubrique et par langue.
- 3 novembre 2026 : lot 1, 10 par rubrique, français seulement.
- 3 novembre 2026 : lot 2 — citations 17 (9 non saints : papes François et Benoît XVI), portraits 18 (9 non saints),
  histoires 11 (dont l'arche de Noé), périodes posées sur les histoires et « Le savais-tu ? » liés à une date ou un temps.
