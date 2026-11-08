/*
 * Ora — application.
 * Aucune dépendance, aucun compte, aucun serveur : réglages et passages favoris restent sur le téléphone.
 * Trois langues : français, espagnol, anglais. La langue suit celle du téléphone, sauf si on la change dans les Réglages.
 */
(function () {
  'use strict';

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  var BRUT = null;          // toutes les données, trois langues
  var D = null;             // les données de la langue en cours
  var BIBLE = null, bibleLangue = null, bibleEnCours = null;
  var etat = { vue: 'accueil', pile: [], guide: null, etape: 0, premiereOuverture: true, filtre: '', cherche: '', bible: null, livreOuvert: null };
  var R = lireReglages();
  var LANG = langueChoisie();
  var derniereVue = null;
  var LANGUES = [['fr', 'Français'], ['es', 'Español'], ['en', 'English']];
  var COULEURS = { blanc: '#FFFFFF', rouge: '#B8473B', vert: '#5E8A63', violet: '#6E4F8A', rose: '#E3A3B5', noir: '#222222' };
  var NOM_COULEUR = {
    fr: { blanc: 'blanche', rouge: 'rouge', vert: 'verte', violet: 'violette', rose: 'rose', noir: 'noire' },
    es: { blanc: 'blanco', rouge: 'rojo', vert: 'verde', violet: 'morado', rose: 'rosa', noir: 'negro' },
    en: { blanc: 'white', rouge: 'red', vert: 'green', violet: 'violet', rose: 'rose', noir: 'black' }
  };
  // Les anciens favoris étaient notés avec les abréviations françaises.
  var ABR_FR = { Gn: 'Gen', Ex: 'Exod', Lv: 'Lev', Nb: 'Num', Dt: 'Deut', Ps: 'Ps', Mt: 'Matt', Mc: 'Mark', Lc: 'Luke', Jn: 'John', Ac: 'Acts', Rm: 'Rom', Is: 'Isa', Jr: 'Jer', Ap: 'Rev' };

  // ---------- Réglages (gardés sur le téléphone) ----------
  function lireReglages() {
    var def = { mode: 'auto', taille: 'normal', langue: null };
    try {
      var x = JSON.parse(localStorage.getItem('ora.reglages') || 'null');
      var r = x ? Object.assign(def, x) : def;
      delete r.niveau; delete r.ciel; delete r.region; // réglages d'anciennes versions
      return r;
    } catch (e) { return def; }
  }
  function ecrireReglages() { try { localStorage.setItem('ora.reglages', JSON.stringify(R)); } catch (e) { /* stockage indisponible */ } }
  function langueChoisie() {
    if (R.langue) return R.langue;
    var l = ((navigator.languages && navigator.languages[0]) || navigator.language || 'fr').slice(0, 2).toLowerCase();
    return l === 'es' || l === 'ca' || l === 'gl' || l === 'eu' ? 'es' : l === 'en' ? 'en' : 'fr';
  }
  // Région liturgique : pas un réglage ; elle suit la langue.
  var REGION_PAR_LANGUE = { fr: 'fr', es: 'es', en: 'us' };
  function regionChoisie() { return REGION_PAR_LANGUE[LANG] || 'fr'; }
  function lireMarques() {
    try {
      var m = JSON.parse(localStorage.getItem('ora.marques') || '[]');
      return m.map(function (x) { return x.o ? x : { o: ABR_FR[x.l] || x.l, c: x.c, v: x.v }; });
    } catch (e) { return []; }
  }
  // Au chargement de la Bible, les favoris qui ne désignent aucun verset existant sont retirés du stockage.
  function nettoyerMarques() {
    if (!BIBLE) return;
    var m = lireMarques(), bons = m.filter(function (x) { var L = livreOsis(x.o); return L && L.ch[x.c - 1] && L.ch[x.c - 1][x.v - 1]; });
    if (bons.length !== m.length || m.some(function (x, i) { return x !== bons[i]; })) ecrireMarques(bons.map(function (x) { return { o: x.o, c: x.c, v: x.v }; }));
  }
  function ecrireMarques(m) { try { localStorage.setItem('ora.marques', JSON.stringify(m)); } catch (e) { /* idem */ } }

  // ---------- Outils ----------
  function T(cle, n) { var s = (D && D.ui[cle]) || cle; return n == null ? s : s.replace('{n}', n).replace(/\((s|es)\)/g, n > 1 ? '$1' : '').replace(/\(s\)/g, n > 1 ? 's' : ''); }
  function esc(s) {
    s = String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]; });
    return LANG === 'fr' ? s.replace(/« /g, '«\u00a0').replace(/ ([»:;?!])/g, '\u00a0$1') : s;
  }
  // Le soir commence au coucher du soleil, là où se trouve l'utilisateur ; le jour commence à 5 h pour tous.
  // La position est déduite du fuseau horaire de l'appareil (aucune demande d'autorisation, rien n'est envoyé).
  var VILLES = { 'Europe/Madrid': [40.42, -3.70], 'Europe/Paris': [48.86, 2.35], 'Europe/Brussels': [50.85, 4.35], 'Europe/Luxembourg': [49.61, 6.13],
    'Europe/Zurich': [46.95, 7.45], 'Europe/Monaco': [43.73, 7.42], 'Europe/Andorra': [42.51, 1.52], 'Europe/Lisbon': [38.72, -9.14], 'Europe/London': [51.51, -0.13],
    'Europe/Dublin': [53.35, -6.26], 'Europe/Rome': [41.90, 12.50], 'Europe/Vatican': [41.90, 12.45], 'Europe/Berlin': [52.52, 13.40], 'Europe/Warsaw': [52.23, 21.01],
    'Europe/Vienna': [48.21, 16.37], 'Europe/Amsterdam': [52.37, 4.90], 'Atlantic/Canary': [28.12, -15.43], 'Africa/Ceuta': [35.89, -5.32],
    'America/New_York': [40.71, -74.01], 'America/Chicago': [41.88, -87.63], 'America/Denver': [39.74, -104.99], 'America/Los_Angeles': [34.05, -118.24],
    'America/Phoenix': [33.45, -112.07], 'America/Anchorage': [61.22, -149.90], 'Pacific/Honolulu': [21.31, -157.86], 'America/Toronto': [43.65, -79.38],
    'America/Montreal': [45.50, -73.57], 'America/Vancouver': [49.28, -123.12], 'America/Mexico_City': [19.43, -99.13], 'America/Monterrey': [25.69, -100.32],
    'America/Tijuana': [32.51, -117.04], 'America/Cancun': [21.16, -86.85], 'America/Guatemala': [14.63, -90.51], 'America/El_Salvador': [13.69, -89.22],
    'America/Tegucigalpa': [14.07, -87.19], 'America/Managua': [12.11, -86.24], 'America/Costa_Rica': [9.93, -84.08], 'America/Panama': [8.98, -79.52],
    'America/Havana': [23.11, -82.37], 'America/Santo_Domingo': [18.49, -69.93], 'America/Puerto_Rico': [18.47, -66.11], 'America/Bogota': [4.71, -74.07],
    'America/Caracas': [10.49, -66.88], 'America/Guayaquil': [-2.17, -79.92], 'America/Lima': [-12.05, -77.04], 'America/La_Paz': [-16.50, -68.15],
    'America/Santiago': [-33.45, -70.67], 'America/Argentina/Buenos_Aires': [-34.60, -58.38], 'America/Buenos_Aires': [-34.60, -58.38], 'America/Montevideo': [-34.90, -56.16],
    'America/Asuncion': [-25.26, -57.58], 'America/Sao_Paulo': [-23.55, -46.63], 'America/Martinique': [14.60, -61.07], 'America/Guadeloupe': [16.24, -61.53],
    'America/Cayenne': [4.92, -52.31], 'Indian/Reunion': [-20.88, 55.45], 'Pacific/Noumea': [-22.28, 166.46], 'Pacific/Tahiti': [-17.54, -149.57],
    'Africa/Casablanca': [33.57, -7.59], 'Africa/Algiers': [36.75, 3.06], 'Africa/Tunis': [36.81, 10.18], 'Africa/Dakar': [14.72, -17.47], 'Africa/Abidjan': [5.36, -4.01],
    'Africa/Douala': [4.05, 9.77], 'Africa/Kinshasa': [-4.44, 15.27], 'Africa/Lagos': [6.52, 3.38], 'Africa/Nairobi': [-1.29, 36.82], 'Africa/Johannesburg': [-26.20, 28.05],
    'Asia/Manila': [14.60, 120.98], 'Asia/Beirut': [33.89, 35.50], 'Asia/Jerusalem': [31.77, 35.21], 'Asia/Kolkata': [19.08, 72.88], 'Asia/Tokyo': [35.68, 139.69],
    'Australia/Sydney': [-33.87, 151.21], 'Australia/Melbourne': [-37.81, 144.96], 'Australia/Perth': [-31.95, 115.86], 'Pacific/Auckland': [-36.85, 174.76] };
  function position() {
    var z = ''; try { z = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* fuseau inconnu */ }
    if (VILLES[z]) return VILLES[z];
    var lon = -new Date(2026, 0, 1).getTimezoneOffset() / 4; // 1 h = 15°
    var lat = /^Australia|^Pacific\/Auck|^America\/(Argentina|Santiago|Sao|Montevideo|Lima|La_Paz|Asuncion)|^Africa\/Johannesburg/.test(z) ? -30 : 42;
    return [lat, lon];
  }
  // Heure du coucher du soleil (algorithme de la NOAA), en heures décimales, heure locale de l'appareil.
  function coucherDuSoleil(dt) {
    var p = position(), lat = p[0], lon = p[1], rad = Math.PI / 180;
    var n = Math.floor((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(dt.getFullYear(), 0, 0)) / 86400000);
    var g = 2 * Math.PI / 365 * (n - 1 + 0.5);
    var eqt = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    var decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    var c = (Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl))) - Math.tan(lat * rad) * Math.tan(decl);
    if (c < -1) return 24; if (c > 1) return 12; // jour polaire ou nuit polaire
    var ha = Math.acos(c) / rad;
    var minutesUTC = 720 - 4 * (lon - ha) - eqt;
    return (minutesUTC - dt.getTimezoneOffset()) / 60;
  }
  function estNuit() {
    if (R.mode === 'jour') return false; if (R.mode === 'nuit') return true;
    var dt = new Date(), h = dt.getHours() + dt.getMinutes() / 60;
    return h < HEURE_DU_JOUR || h >= coucherDuSoleil(dt);
  }
  function guillemets(t) { return LANG === 'en' ? '\u201c' + t + '\u201d' : LANG === 'es' ? '\u00ab' + t + '\u00bb' : '\u00ab\u00a0' + t + '\u00a0\u00bb'; }

  // Rend cliquables les mots du lexique (une seule fois chacun par bloc de texte).
  // Mots du lexique qu'on ne souligne pas : ce sont des mots courants, pas propres à la foi catholique
  // (les mots ajoutés depuis portent « souligne »: false dans data/lexique.json).
  var EXCLUS = { saint: 1, 'vierge-marie': 1, croix: 1, grace: 1, bible: 1, mystere: 1 };
  function lexique(texte) {
    var html = esc(texte), vus = {};
    if (!D) return html;
    var formes = [];
    D.lexique.mots.forEach(function (m) { if (!EXCLUS[m.id] && D.souligne[m.id] !== false) m.formes.forEach(function (f) { formes.push({ f: f, id: m.id }); }); });
    formes.sort(function (a, b) { return b.f.length - a.f.length; });
    var morceaux = refsBible(html);
    formes.forEach(function (fo) {
      if (vus[fo.id]) return;
      var re = new RegExp('(^|[^\\p{L}])(' + fo.f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, '&#39;') + ')(?![\\p{L}])', 'u');
      for (var i = 0; i < morceaux.length; i++) {
        var mo = morceaux[i]; if (mo.lie) continue;
        var m = re.exec(mo.t); if (!m) continue;
        var debut = m.index + m[1].length, fin = debut + m[2].length;
        morceaux.splice(i, 1,
          { t: mo.t.slice(0, debut), lie: false },
          { t: '<button class="lex" data-action="mot" data-id="' + fo.id + '">' + mo.t.slice(debut, fin) + '</button>', lie: true },
          { t: mo.t.slice(fin), lie: false });
        vus[fo.id] = true; break;
      }
    });
    return morceaux.map(function (m) { return m.t; }).join('');
  }

  // Les références bibliques entre parenthèses deviennent des liens vers le passage : (Lc 2, 29-32), (Jn 11:35)…
  // (le repérage lui-même est dans src/js/references.js, partagé avec les tests)
  function refsBible(html) {
    if (!D || !D.abr) return [{ t: html, lie: false }];
    var out = [], dernier = 0;
    OraReferences.trouver(html, D.abr, LANG).forEach(function (r) {
      out.push({ t: html.slice(dernier, r.debut), lie: false });
      var id = r.v1 ? r.osis + '|' + r.c + '|' + r.v1 + '|' + r.v2 + (r.c2 ? '|' + r.c2 : '') : r.osis + '|' + r.c + '|0|0';
      out.push({ t: '<button class="ref" data-action="passage" data-id="' + id + '">' + html.slice(r.debut, r.fin) + '</button>', lie: true });
      dernier = r.fin;
    });
    out.push({ t: html.slice(dernier), lie: false });
    return out;
  }
  function refsSeules(texte) { return refsBible(esc(texte)).map(function (m) { return m.t; }).join(''); }

  // Guillemets équilibrés : un verset isolé peut fermer une parole ouverte plus tôt (ou l'inverse).
  function bords(t) {
    var pre = '', post = '', nb = LANG === 'fr' ? '\u00a0' : '';
    [['«', '»'], ['“', '”']].forEach(function (g) {
      var o = t.split(g[0]).length - 1, f = t.split(g[1]).length - 1;
      if (f > o) pre += g[0] + (g[0] === '«' ? nb : '');
      else if (o > f) post += (g[1] === '»' ? nb : '') + g[1];
    });
    return [pre, post];
  }
  function equilibre(t) { var b = bords(t); return b[0] + t.replace(/\s+$/, '') + b[1]; }

  // Nom de l'auteur d'une citation : un toucher ouvre sa courte présentation.
  function auteur(cit) {
    var a = cit.auteurId && D.auteurs[cit.auteurId];
    if (!a) return esc(cit.auteur);
    // Seul le nom de la personne est souligné ; la précision qui suit (« mère de saint Augustin… ») reste en texte simple.
    var nom = (a[LANG] || a.fr).nom, texte = cit.auteur, suite = '';
    if (texte.indexOf(nom) === 0) { suite = texte.slice(nom.length); texte = nom; }
    return '<button class="auteur-lien" data-action="auteur" data-id="' + esc(cit.auteurId) + '">' + esc(texte) + '</button>' + esc(suite);
  }

  // Versets numérotés ; « […] » quand on saute des versets.
  // sansNumeros : extrait de l'Évangile sur Aujourd'hui et En famille, lu comme un texte suivi.
  function versets(liste, sansNumeros) {
    var h = '', prec = null;
    liste.forEach(function (x) {
      if (prec !== null && x.v !== prec + 1 && !(x.c && prec === 'fin')) h += '<span class="saut"> […] </span>';
      h += (sansNumeros ? '<span class="vx"></span>' : '<sup>' + x.v + '</sup>') + esc(x.t).replace(/\n/g, ' ') + ' ';
      prec = x.v;
    });
    var bo = bords(liste.map(function (x) { return x.t; }).join(' '));
    if (bo[0]) h = h.replace(/(<sup>\d+<\/sup>|<span class="vx"><\/span>)/, '$1' + bo[0]);
    if (bo[1]) h = h.replace(/\s+$/, '') + bo[1];
    // Un extrait ne finit pas sur le tiret qui annonce la réplique suivante.
    if (sansNumeros) h = h.replace(/\s*—\s*$/, '');
    // Un extrait qui commence au milieu d'une phrase (« et leur dit ») prend une majuscule.
    if (sansNumeros) h = h.replace(/^(<span class="vx"><\/span>[«“"\s]*)(\p{Ll})/u, function (m, a, b) { return a + b.toUpperCase(); });
    return '<p class="versets">' + h + '</p>';
  }

  // ---------- Données de la langue en cours ----------
  function preparer() {
    var b = BRUT, tr = b.i18n[LANG] || {}, fr = b.fr;
    var prieres = JSON.parse(JSON.stringify(fr.prieres));
    prieres.traditionnelles = prieres.traditionnelles.map(function (p) {
      var t = (tr.prieres || {})[p.id];
      if (!t) return p;
      // Les textes viennent tous de la langue choisie : rien du français (une « autre version » française ne doit pas apparaître en espagnol).
      var base = { id: p.id }; if (p.bible) base.bible = p.bible;
      return Object.assign(base, t);
    });
    D = {
      ui: Object.assign({}, b.ui.fr, b.ui[LANG] || {}),
      explications: tr.explications || fr.explications,
      prieres: prieres,
      lexique: tr.lexique || fr.lexique,
      souligne: fr.lexique.mots.reduce(function (o, m) { if (m.souligne === false) o[m.id] = false; return o; }, {}),
      conseils: { conseils: tr.conseils || fr.conseils.conseils },
      guideFamille: tr['guide-famille'] || b.guideFamilleFr,
      messe: b.messe ? (b.messe[LANG] || b.messe.fr) : null,
      fetes: fr.fetes, auteurs: b.auteurs || {}, abr: (b.abreviations || {})[LANG] || {},
      lect: b.lectionnaire.cles, coeurs: b.coeurs || {}, biblio: b.bibliotheque || {}, evangiles: b.evangiles || null, jours: b.jours || {}, temps: b.temps || {}, personnages: b.personnages || [], motsEnfants: b.motsEnfants || [], evEnfants: b.evangilesEnfants || null, pj: b.prieresJour, contenus: b.contenus
    };
    OraLiturgie.langue(LANG);
    OraLiturgie.region(regionChoisie());
    document.documentElement.lang = LANG;
  }

  // Cherche la première clé liturgique du jour présente dans un dictionnaire (célébration, puis jour férial).
  function chercher(dico, cles) { for (var i = 0; i < cles.length; i++) { if (dico && dico[cles[i]]) return dico[cles[i]]; } return null; }

  // Le jour d'Ora commence à 5 h, avec le retour du Jour : entre minuit et 5 h, c'est encore la nuit
  // de la veille (même date, même Évangile, même prière du soir). Le contenu du lendemain arrive à 5 h.
  var HEURE_DU_JOUR = 5;
  function dateDuJour() { var dt = new Date(); if (dt.getHours() < HEURE_DU_JOUR) dt.setDate(dt.getDate() - 1); return dt; }
  function aujourdhui(dt) {
    dt = dt || dateDuJour();
    var j = OraLiturgie.jour(dt, D.fetes);
    var cid = j.celebration && j.celebration.id;
    var expl = (cid && D.explications.fetes[cid]) || null;
    var conseil = expl ? expl.idee : D.conseils.conseils[j.indexAnnee % D.conseils.conseils.length];
    var contenu = chercher(D.contenus, j.cles);
    var messe = chercher(D.lect, j.cles);
    // Un jour avec contenu éditorial garde l'Évangile de la messe, que sa méditation commente.
    return { j: j, c: contenu ? contenu[LANG] : bibliotheque(dt, j), contenu: contenu, expl: expl, explSaison: D.explications.saisons[j.saison.id], conseil: conseil, lect: (!contenu && evangileOra(j)) || messe, messe: messe };
  }
  // L'Évangile du jour d'Ora (data/evangiles.json) : un passage court parmi les plus aimés, sans répétition dans l'année.
  // La fête a le sien ; les temps forts suivent le rang du jour dans le temps (Avent : du 17 au 24 décembre, les jours
  // qui précèdent Noël) ; le temps ordinaire suit ses semaines, du dimanche au samedi.
  function evangileOra(j) {
    var E = D.evangiles; if (!E || !E.ordinaire) return null;
    var f = j.celebration && E.fetes[j.celebration.id]; if (f) return f;
    var s = j.saison.id, k = j.date.slice(5), n = j.jourSaison, L = E[s];
    if (s === 'avent') return k >= '12-17' ? E.aventFin[Math.min(+k.slice(3) - 17, E.aventFin.length - 1)] : E.avent[n % E.avent.length];
    if (L && n != null && s !== 'ordinaire') return L[Math.min(n, L.length - 1)];
    var js = new Date(j.date + 'T12:00:00Z').getUTCDay();
    return E.ordinaire[(((j.semaine || 1) - 1) * 7 + js) % E.ordinaire.length];
  }
  // Les jours sans contenu propre (la plupart des jours ordinaires), chaque rubrique puise dans la bibliothèque :
  // un élément par jour, dans l'ordre, et la liste recommence quand elle est finie. Les rubriques n'ont pas de lien
  // entre elles ; chacune vaut pour elle-même. Un élément pas encore traduit ne s'affiche pas dans cette langue.
  var RUBRIQUES = { citation: 'citations', reflexion: 'reflexions', histoire: 'histoires', portrait: 'portraits', savaisTu: 'savaisTu' };
  // Un élément lié à une date (« date » : MM-JJ) ne sort que ce jour-là ; un élément lié à un temps liturgique
  // (« temps » : avent, noel, careme, triduum, paques) sort pendant ce temps, un par jour depuis son début.
  // Les autres tournent le reste de l'année, dans l'ordre de la liste (qui respecte l'alternance des saints).
  function bibliotheque(dt, j) {
    var n = Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 864e5), c = null;
    var k = j ? j.date.slice(5) : '', s = j ? j.saison.id : '', js = j ? j.jourSaison : null;
    Object.keys(RUBRIQUES).forEach(function (r) {
      var liste = (D.biblio[RUBRIQUES[r]] || []).filter(function (x) { return x[LANG]; });
      var date = liste.filter(function (x) { return x.date === k; })[0];
      var temps = liste.filter(function (x) { return x.temps && x.temps.indexOf(s) >= 0; });
      var libres = liste.filter(function (x) { return !x.date && !x.temps; });
      var x = date || (js != null && temps[js]) || (libres.length ? libres[n % libres.length] : null);
      if (x) { c = c || {}; c[r] = x[LANG]; if (x.enfant && x.enfant[LANG]) c[r + 'Enfant'] = x.enfant[LANG]; }
    });
    return c;
  }
  // La prière change entre le jour et le soir : c'est le seul contenu qui change.
  // Une célébration peut avoir ses prières ; sinon, une rotation fixe sur l'année liturgique.
  function priereDuMoment(a, enfant) {
    var nuit = estNuit(), moment = enfant ? (nuit ? 'enfantSoir' : 'enfantJour') : (nuit ? 'soir' : 'jour');
    var cel = chercher(D.pj.celebrations, a.j.cles), pool = D.pj.pools[moment];
    var p = (cel && cel[moment]) || pool[a.j.indexAnnee % pool.length];
    var source = p.src[LANG] + (p.note ? ' · ' + p.note[LANG] : '');
    return { etiquette: T(nuit ? 'priere-soir' : 'priere-jour'), texte: p[LANG], source: source };
  }
  function blocPriere(p) { return '<p class="s-priere">' + esc(p.texte).replace(/\n/g, '<br>') + '</p>' + (p.source ? '<p class="s-ref">' + refsSeules(p.source) + '</p>' : ''); }

  // L'Évangile du jour, lu dans la Bible de la langue choisie.
  function evangile(a) {
    if (!a.lect) return null;
    if (!BIBLE || bibleLangue !== LANG) { chargerBible().then(function () { if (etat.vue === 'accueil' || etat.vue.indexOf('lecture:') === 0 || etat.vue === 'famille') rendreEnPlace(); }).catch(function () {}); return { attente: true }; }
    var L = livreOsis(a.lect.osis), vv = (a.lect.vl && a.lect.vl[LANG]) || a.lect.v;
    var liste = vv.map(function (x) { return { c: x[0], v: x[1], t: (L.ch[x[0] - 1] || [])[x[1] - 1] || '' }; }).filter(function (x) { return x.t; });
    var debut = vv[0], fin = vv[vv.length - 1];
    // Un passage peut couvrir deux chapitres (Jn 15, 26-27 ; 16, 12-15) : on garde le début et la fin exacts.
    // Le cœur du passage : les versets choisis un à un qui portent sa leçon (data/coeur-evangile.json) ;
    // un passage court est montré en entier.
    var co = !a.lect.ora && D.coeurs[a.lect.ref], coeur = liste;
    if (co) { var i = Math.min(co[0], liste.length - 1), j = Math.min(co[1], liste.length); coeur = liste.slice(i, Math.max(j, i + 1)); }
    return { liste: liste, coeur: coeur, refCoeur: coeur === liste ? refLocale(a.lect) : refVersets(L, coeur), ref: refLocale(a.lect), osis: a.lect.osis, c: debut[0], du: debut[1], au: fin[1], c2: fin[0], id: passageId(a.lect.osis, debut, fin) };
  }
  // « Lc 14, 21-23 », ou « Mt 9, 36 – 10, 1 » quand l'extrait change de chapitre.
  function refVersets(L, vv) {
    var sep = LANG === 'en' ? ':' : ', ', a = vv[0], b = vv[vv.length - 1];
    if (a.c !== b.c) return L.abr + ' ' + a.c + sep + a.v + ' – ' + b.c + sep + b.v;
    return L.abr + ' ' + a.c + sep + a.v + (b.v !== a.v ? '-' + b.v : '');
  }
  function passageId(osis, debut, fin) { return osis + '|' + debut[0] + '|' + debut[1] + '|' + fin[1] + (fin[0] !== debut[0] ? '|' + fin[0] : ''); }
  function refLocale(lect) {
    var L = livreOsis(lect.osis), sep = LANG === 'en' ? ':' : ', ';
    if (!L) return lect.ref;
    return lect.ref.replace(/^\S+\s+/, L.abr + ' ').replace(/,\s*/g, sep);
  }

  // ---------- Vues ----------
  function rubrique(corps, opts) {
    opts = opts || {};
    var tag = opts.action ? 'button' : 'div';
    var attr = opts.action ? ' data-action="' + opts.action + '"' + (opts.id ? ' data-id="' + esc(opts.id) + '"' : '') : '';
    var droite = opts.action ? '<span class="fleche" aria-hidden="true">' + icone('fleche') + '</span>' : '';
    return '<' + tag + ' class="rubrique"' + attr + '><span class="corps">' + corps + '</span>' + droite + '</' + tag + '>';
  }
  // lecture : l'identifiant d'une page de lecture, ou { action, id } pour une autre destination (le Lexique).
  function section(etiquette, corps, lecture, action) {
    var ac = 'lecture', id = lecture;
    if (lecture && typeof lecture === 'object') { ac = lecture.action; id = lecture.id; }
    return '<section class="section-jour' + (lecture ? ' ouvrable" data-action="' + ac + '" data-id="' + id : '') + '"><h2 class="etiquette">' + esc(etiquette) + '</h2>' + corps +
      (lecture ? '<button class="lire" data-action="' + ac + '" data-id="' + id + '">' + esc(action) + icone('fleche') + '</button>' : '') + '</section>';
  }

  // Mot du jour : un mot du lexique, qui change chaque jour. On avance d'un pas fixe premier avec le nombre de mots :
  // deux jours de suite ne donnent jamais le même mot, et tous les mots passent avant qu'un mot revienne.
  function motDuJour(dt) {
    var mots = D.lexique.mots.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; }), n = mots.length;
    if (!n) return null;
    var pgcd = function (a, b) { return b ? pgcd(b, a % b) : a; }, pas = Math.max(1, Math.round(n * 0.382));
    while (n > 1 && pgcd(pas, n) !== 1) pas++;
    var jourN = Math.floor(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) / 864e5);
    return mots[((jourN * pas) % n + n) % n];
  }

  // Le titre du jour : la fête du calendrier ; un jour de premier rang garde son nom liturgique (« Lundi saint ») ;
  // pendant les temps forts, le sens du temps ; sinon le titre daté de data/jours.json (saint du jour, personnage de la Bible, anniversaire), et à défaut le temps.
  function titreDuJour(j) {
    if (j.celebration && j.celebration.rang !== 'memoire') return { titre: j.celebration.nom };
    if (j.premierRang) return { titre: j.titre || j.libelleDuJour };
    var k = j.date.slice(5), x = (D.jours[LANG] || {})[k], ex = x && x[2];
    // Pendant les temps forts, chaque jour parle du temps lui-même (data/temps.json), sauf à partir du 17 décembre ;
    // hors Carême et Triduum, un grand saint du calendrier (« fort ») garde sa place.
    var tp = (D.temps[LANG] || {})[j.saison.id];
    var fort = ex && ex.fort && j.saison.id !== 'careme' && j.saison.id !== 'triduum';
    if (!fort && tp && j.jourSaison != null && tp[j.jourSaison] && !(j.saison.id === 'avent' && k >= '12-17')) return { titre: tp[j.jourSaison][0], phrase: tp[j.jourSaison][1] };
    if (x) return { titre: x[0], phrase: x[1], ex: ex };
    return { titre: j.celebration ? j.celebration.nom : j.saison.nom };
  }
  function vueAccueil() {
    var a = aujourdhui(), j = a.j, c = a.c, nuit = estNuit();
    var t = titreDuJour(j), titre = t.titre;
    // Sous le titre, seulement qui l'on fête (ou ce qu'est la fête) : jamais « mardi de la 31e semaine du temps ordinaire ».
    var chapeau = a.expl ? a.expl.quoi : (t.phrase || '');
    var html = '<section class="vue accueil' + (etat.premiereOuverture ? ' anime' : '') + '">';
    html += '<p class="surtitre">' + esc(j.dateLongue) + '</p>';
    // Toucher le nom ouvre sa fiche (qui c'est, pourquoi ce jour, une idée à vivre).
    html += '<h1><button class="titre-jour" data-action="explication">' + esc(titre) + '</button></h1>';
    if (chapeau) html += '<p class="chapeau">' + lexique(chapeau) + '</p>';
    html += '<button class="couleur-lit" data-action="explication" aria-label="' + esc(T('en-savoir-plus') + '. ' + T('couleur') + ' ' + NOM_COULEUR[LANG][j.couleur]) + '"><i style="background:' + COULEURS[j.couleur] + '"></i>' + esc(T('en-savoir-plus')) + '</button>';

    html += '<div class="sections">';
    var p = priereDuMoment(a);
    if (p.texte) html += section(p.etiquette, blocPriere(p));
    var e = evangile(a);
    if (e && e.attente) html += section(T('evangile-jour'), '<p class="charge">…</p>');
    else if (e) html += section(T('evangile-jour'), (a.lect.titre && a.lect.titre[LANG] ? '<p class="ev-titre">' + esc(a.lect.titre[LANG]) + '</p>' : '') + versets(e.coeur, true) + '<p class="s-ref">' + refsSeules(e.refCoeur) + '</p>', 'evangile', e.coeur.length < e.liste.length || c ? T('mediter') : T('lire'));
    html += respiration();
    if (c) {
      var cit = c.citation;
      if (cit) html += section(T('citation-jour'), '<blockquote class="s-citation">' + guillemets(esc(cit.texte)) + '</blockquote><p class="s-ref">' + auteur(cit) + ' · ' + refsSeules(cit.source) + '</p>');
      if (c.reflexion) html += section(T('reflexion-jour'), '<p class="s-titre">' + esc(c.reflexion.titre) + '</p><p class="s-accroche">' + lexique(c.reflexion.accroche) + '</p>', 'reflexion', T('lire'));
      if (c.histoire) html += section(T('histoire-jour'), '<p class="s-titre">' + esc(c.histoire.titre) + '</p><p class="s-accroche">' + lexique(c.histoire.accroche) + '</p>', 'histoire', T('lire'));
      if (c.portrait) html += section(T('portrait-jour'), '<p class="s-titre">' + esc(c.portrait.nom) + ' <span class="s-dates">' + esc(c.portrait.dates) + '</span></p><p class="s-accroche">' + lexique(c.portrait.accroche) + '</p>', 'portrait', T('lire'));
      if (c.savaisTu) html += bougie();
      if (c.savaisTu) html += section(T('savais-tu'), '<p class="s-titre">' + esc(c.savaisTu.titre) + '</p><p class="s-accroche">' + lexique(c.savaisTu.accroche) + '</p>', 'savais-tu', T('lire'));
    } else {
      // Jour sans contenu éditorial : l'explication de la fête ou du temps liturgique, puis l'idée du jour.
      var ex = a.expl || a.explSaison;
      if (ex) html += section(a.expl ? T('la-fete') : T('le-temps'), '<p class="s-titre">' + esc(a.expl ? a.j.celebration.nom : a.j.saison.nom) + '</p><p class="s-accroche">' + lexique(ex.pourquoi || ex.quoi) + '</p>');
      html += bougie();
      html += section(T('idee-jour'), '<p class="s-accroche">' + lexique(a.conseil) + '</p>');
    }
    var mot = motDuJour(dateDuJour());
    if (mot) html += section(T('mot-jour'), '<p class="s-titre">' + esc(mot.mot) + '</p><p class="s-accroche">' + refsSeules(mot.def) + '</p>', { action: 'aller', id: 'lexique' }, T('acceder-lexique'));
    return html + '</div></section>';
  }

  // Respiration : une pause visuelle après l'Évangile, un village sur sa colline peint à l'aquarelle,
  // fondu dans le fond de la page. De jour, des oiseaux passent et les arbres bougent dans la brise ;
  // le soir, les fenêtres luisent doucement et quelques étoiles scintillent.
  // Arbres qui ondulent : [centre x, haut, bas, demi-largeur, ampleur] en pixels de l'image d'origine (2048 × 618).
  var ARBRES = [[632, 195, 362, 26, 1], [678, 205, 352, 22, 1], [857, 265, 432, 24, 1], [826, 324, 430, 20, 1], [1305, 186, 272, 18, 1],
    [1658, 355, 484, 22, 1], [1828, 297, 404, 20, 1], [1860, 313, 414, 20, 1], [354, 317, 392, 16, 1],
    [180, 362, 438, 50, .5], [298, 330, 408, 50, .5], [700, 365, 468, 64, .5], [1235, 342, 462, 62, .5], [1940, 388, 468, 52, .5], [1030, 280, 378, 64, .5]];
  var ETOILES_VILLAGE = [[15, 24], [37, 12], [63, 8], [81, 18], [90, 6]];
  // Un morceau d'une image (rectangle x0,y0 → x1,y1 en pixels de l'image d'origine), posé exactement à sa place,
  // pour l'animer seul (un arbre qui ondule, une flamme qui vacille).
  function morceau(src, IW, IH, x0, y0, x1, y1, cls, style) {
    var x = x0 / IW, y = y0 / IH, w = (x1 - x0) / IW, h = (y1 - y0) / IH;
    return '<span class="' + cls + '" style="background-image:url(' + src + ');left:' + (x * 100).toFixed(2) + '%;top:' + (y * 100).toFixed(2) + '%;width:' + (w * 100).toFixed(2) + '%;height:' + (h * 100).toFixed(2) +
      '%;background-size:' + (100 / w).toFixed(1) + '% ' + (100 / h).toFixed(1) + '%;background-position:' + (x / (1 - w) * 100).toFixed(2) + '% ' + (y / (1 - h) * 100).toFixed(2) + '%;' + (style || '') + '"></span>';
  }
  // Seconde respiration, avant « Le savais-tu ? » : des mains qui protègent une bougie ; la flamme vacille et sa lumière respire.
  function bougie() {
    var nuit = estNuit(), m = nuit ? 'nuit' : 'jour';
    // La flamme est détourée à part (le fond de l'image a été comblé dessous) : elle se balance depuis la mèche et frémit,
    // et sa lumière respire au même rythme.
    var f = nuit ? { l: 48.64, t: 18.29, w: 8.0, h: 19.02, oy: 91 } : { l: 49.05, t: 11.1, w: 6.6, h: 22.07, oy: 95.6 };
    return '<div class="respiration bougie ' + m + '" aria-hidden="true"><img src="img/bougie-' + m + '.webp" alt="" decoding="async">' +
      '<span class="b-halo" style="left:' + (f.l + f.w / 2).toFixed(2) + '%;top:' + (f.t + f.h * .55).toFixed(2) + '%"></span>' +
      '<span class="b-flamme" style="left:' + f.l + '%;top:' + f.t + '%;width:' + f.w + '%;height:' + f.h + '%;transform-origin:50% ' + f.oy + '%">' +
      '<img src="img/bougie-' + m + '-flamme.webp" alt="" decoding="async" style="transform-origin:50% ' + f.oy + '%"></span></div>';
  }
  function respiration() {
    if (estNuit()) {
      return '<div class="respiration village nuit" aria-hidden="true"><img src="img/village-nuit.webp" alt="" decoding="async">' +
        [0, 1, 2].map(function (k) { return '<img class="v-lum l' + k + '" src="img/village-lumieres-' + k + '.webp" alt="" decoding="async">'; }).join('') +
        ETOILES_VILLAGE.map(function (p, k) { return '<span class="v-etoile" style="left:' + p[0] + '%;top:' + p[1] + '%;animation-duration:' + (5 + k % 4 * 1.7) + 's;animation-delay:-' + (k * 1.3) + 's"></span>'; }).join('') + '</div>';
    }
    var arbres = ARBRES.map(function (a, k) {
      return morceau('img/village-jour.webp', 2048, 618, a[0] - a[3], a[1], a[0] + a[3], a[2], 'v-arbre' + (a[4] < 1 ? ' rond' : ''), 'animation-delay:-' + (k * 0.9).toFixed(1) + 's');
    }).join('');
    // Deux moineaux peints à l'aquarelle (planche de 7 images : 5 de vol, 2 posés). L'un quitte son olivier et passe
    // derrière le clocher (un calque du clocher et de l'église est posé par-dessus lui) ; l'autre traverse et se pose.
    var moineau = '<b><i class="vol"></i></b><i class="pose"></i>';
    var oiseaux = '<span class="v-oiseau oa">' + moineau + '</span>' +
      '<img class="v-clocher" src="img/village-jour-clocher.webp" alt="" decoding="async" style="left:51.79%;top:8.78%;width:11.28%;height:39.66%">' +
      '<span class="v-oiseau ob">' + moineau + '</span>';
    return '<div class="respiration village jour" aria-hidden="true"><img src="img/village-jour.webp" alt="" decoding="async">' + arbres + oiseaux + '</div>';
  }

  function paragraphes(t) { return String(t).split('\n\n').map(function (p) { return '<p>' + lexique(p) + '</p>'; }).join(''); }
  function plusLoin(t) { return t ? '<details class="bloc plus-loin"><summary>' + esc(T('aller-plus-loin')) + '</summary><p>' + lexique(t) + '</p></details>' : ''; }
  function sources(s) { return s ? '<p class="source">' + esc(T('sources')) + ' : ' + refsSeules(s) + '</p>' : ''; }

  // « Pour méditer » : une phrase à garder, ce que dit le texte, ce que l'Église en comprend, trois pistes, une fin qui ouvre sur la prière.
  function meditation(m) {
    var h = '<div class="meditation"><h3 class="med-titre">' + esc(T('pour-mediter')) + '</h3>';
    if (m.verset && BIBLE && bibleLangue === LANG) {
      var L = livreOsis(m.verset.o), t = m.verset.v.map(function (v) { return (L.ch[m.verset.c - 1] || [])[v - 1] || ''; }).join(' ');
      var ref = L.abr + ' ' + m.verset.c + (LANG === 'en' ? ':' : ', ') + m.verset.v[0] + (m.verset.v.length > 1 ? '-' + m.verset.v[m.verset.v.length - 1] : '');
      if (t) h += '<p class="med-etiquette">' + esc(T('phrase-garder')) + '</p><blockquote class="s-citation">' + guillemets(esc(equilibre(t.replace(/\s+/g, ' ').replace(/^[«“]\s*/, '').replace(/\s*[»”]$/, '').replace(/[\s\u202f\u00a0;:,]+$/, '').replace(/([^.!?])$/, '$1.')))) + '</blockquote><p class="s-ref">' + refsSeules(ref) + '</p>';
    }
    if (m.contexte) h += '<p class="med-etiquette">' + esc(T('ce-que-dit')) + '</p><p>' + lexique(m.contexte) + '</p>';
    if (m.eclairage) h += '<p class="med-etiquette">' + esc(T('eclairage')) + '</p><p>' + lexique(m.eclairage) + '</p>';
    if (m.pistes) h += '<p class="med-etiquette">' + esc(T('pour-toi')) + '</p><ol class="pistes">' + m.pistes.map(function (p) { return '<li>' + lexique(p) + '</li>'; }).join('') + '</ol>';
    if (m.conclusion) h += '<p class="med-etiquette">' + esc(T('pour-finir')) + '</p><p class="med-fin">' + lexique(m.conclusion) + '</p>';
    return h + '</div>';
  }

  function vueLecture(type) {
    var a = aujourdhui(), c = a.c, h = '<section class="vue page lecture">' + boutonRetour();
    if (type === 'evangile') {
      var e = evangile(a);
      if (!e || e.attente) return h + '<p class="charge">' + esc(T('ouverture-bible')) + '</p></section>';
      h += '<p class="surtitre">' + esc(T('evangile-jour')) + '</p><h2>' + esc(e.ref) + '</h2>' + versets(e.liste);
      if (c && c.meditation) h += meditation(c.meditation);
      h += '<div class="bloc"><button class="lire" data-action="passage-evangile" data-id="' + esc(e.id) + '">' + esc(T('lire-chapitre')) + icone('fleche') + '</button></div>';
      // L'Évangile lu à la messe ce jour-là reste à portée de main.
      var m = a.messe;
      if (m && a.lect !== m) { var mv = (m.vl && m.vl[LANG]) || m.v; h += '<div class="bloc"><button class="lire" data-action="passage-messe" data-id="' + esc(passageId(m.osis, mv[0], mv[mv.length - 1])) + '">' + esc(T('evangile-messe')) + ' · ' + esc(refLocale(m)) + icone('fleche') + '</button></div>'; }
      return h + '</section>';
    }
    if (!c) return vueAccueil();
    if (type === 'reflexion') {
      var r = c.reflexion;
      h += '<p class="surtitre">' + esc(T('reflexion-jour')) + '</p><h2>' + esc(r.titre) + '</h2><div class="texte-lecture">' + paragraphes(r.fait) + '</div>';
      (r.citations || []).forEach(function (q) { h += '<blockquote class="s-citation">' + guillemets(esc(q.texte)) + '</blockquote><p class="s-ref">' + refsSeules(q.source) + '</p>'; });
      h += '<div class="bloc"><h3>' + esc(T('pour-reflechir')) + '</h3><p>' + lexique(r.piste) + '</p></div>';
      var rp = r.priere ? { src: {}, x: r.priere } : chercher(D.pj.reflexions, a.j.cles);
      if (rp) h += '<div class="bloc"><h3>' + esc(T('une-priere')) + '</h3><p class="s-priere">' + esc(rp.x ? rp.x.texte : rp[LANG]) + '</p><p class="s-ref">' + refsSeules(rp.x ? rp.x.source : rp.src[LANG]) + '</p></div>';
      h += sources(r.sources);
    } else if (type === 'histoire') {
      var hi = c.histoire;
      h += '<p class="surtitre">' + esc(T('histoire-jour')) + '</p><h2>' + esc(hi.titre) + '</h2><div class="texte-lecture">' + paragraphes(hi.texte) + '</div>' + plusLoin(hi.plusLoin) + sources(hi.source);
    } else if (type === 'portrait') {
      var po = c.portrait;
      h += '<p class="surtitre">' + esc(T('portrait-jour')) + '</p><h2>' + esc(po.nom) + '</h2><p class="s-dates">' + esc(po.dates) + '</p><div class="texte-lecture">' + paragraphes(po.texte) + '</div>' + plusLoin(po.plusLoin) + sources(po.source);
    } else if (type === 'savais-tu') {
      var s = c.savaisTu;
      h += '<p class="surtitre">' + esc(T('savais-tu')) + '</p><h2>' + esc(s.titre) + '</h2><div class="texte-lecture">' + paragraphes(s.texte) + '</div>' + plusLoin(s.plusLoin) + sources(s.source);
    }
    return h + '</section>';
  }

  function vuePrier() {
    var p = priereDuMoment(aujourdhui());
    var h = '<section class="vue page"><p class="surtitre">' + esc(T('prier')) + '</p><h2>' + esc(T('les-prieres')) + '</h2>';
    if (p.texte) h += '<section class="section-jour" style="margin-top:22px"><h3 class="etiquette">' + esc(p.etiquette) + '</h3>' + blocPriere(p) + '</section>';
    h += '<p class="groupe">' + esc(T('prieres-toujours')) + '</p><div class="rubriques">';
    D.prieres.traditionnelles.forEach(function (x) { h += rubrique('<span class="titre-r">' + esc(x.titre) + '</span>', { action: 'priere', id: x.id }); });
    h += '</div><p class="groupe espace">' + esc(T('mots-foi')) + '</p><div class="rubriques">' + rubrique('<span class="titre-r">' + esc(T('lexique')) + '</span><span class="texte-r">' + esc(T('lexique-desc')) + '</span>', { action: 'aller', id: 'lexique' }) + '</div>';
    if (D.messe) h += '<p class="groupe espace">' + esc(T('la-messe')) + '</p><div class="rubriques">' + rubrique('<span class="titre-r">' + esc(D.messe.titre) + '</span><span class="texte-r">' + esc(D.messe.desc) + '</span>', { action: 'aller', id: 'messe' }) + '</div>';
    h += '</section>';
    return h;
  }

  // La messe pas à pas : cinq temps, et pour chaque étape ce qui se passe, ce que l'on fait, ce que l'on répond.
  function vueMesse() {
    var m = D.messe; if (!m) return vuePrier();
    var h = '<section class="vue page lecture">' + boutonRetour() + '<p class="surtitre">' + esc(T('la-messe')) + '</p><h2>' + esc(m.titre) + '</h2><p class="chapeau">' + lexique(m.intro) + '</p>';
    m.parties.forEach(function (p) {
      h += '<h3 class="messe-partie">' + esc(p.titre) + '</h3><ol class="messe-etapes">';
      p.etapes.forEach(function (e) {
        h += '<li><p class="messe-nom">' + esc(e.nom) + '</p><p>' + lexique(e.quoi) + '</p>' +
          (e.posture ? '<p class="messe-posture"><span>' + esc(m.posture) + '</span> ' + esc(e.posture) + '</p>' : '') +
          (e.reponse ? '<p class="messe-reponse"><span>' + esc(m.reponse) + '</span> ' + guillemets(esc(e.reponse)) + '</p>' : '') + '</li>';
      });
      h += '</ol>';
    });
    return h + '</section>';
  }

  function vuePriere(id) {
    var p = D.prieres.traditionnelles.filter(function (x) { return x.id === id; })[0];
    if (!p) return vuePrier();
    var texte = p.texte;
    if (!texte && p.bible && BIBLE && bibleLangue === LANG) { var L = livreOsis(p.bible.osis); texte = p.bible.v.map(function (v) { return L.ch[p.bible.c - 1][v - 1]; }).join('\n'); }
    if (!texte && p.bible) { chargerBible().then(rendreEnPlace).catch(function () {}); texte = '…'; }
    var h = '<section class="vue page">' + boutonRetour() + '<h2>' + esc(p.titre) + '</h2>';
    h += '<p class="texte-priere">' + lexique(texte) + '</p>';
    if (p.geste) h += '<div class="bloc"><h3>' + esc(T('le-geste')) + '</h3><p>' + lexique(p.geste) + '</p></div>';
    h += '<div class="bloc"><h3>' + esc(T('quand-dire')) + '</h3><p>' + lexique(p.quand) + '</p></div>';
    h += '<div class="bloc"><h3>' + esc(T('pourquoi')) + '</h3><p>' + lexique(p.pourquoi) + '</p>' + (p.source ? '<p class="source">' + refsSeules(p.source) + '</p>' : '') + '</div>';
    if (p.variante) h += '<div class="bloc"><h3>' + esc(T('autre-version')) + '</h3><p class="texte-priere variante">' + esc(p.variante) + '</p></div>';
    return h + '</section>';
  }

  function vueGuide() {
    var g = D.guideFamille; if (!g) return vueFamille();
    var e = etat.etape, total = g.etapes.length, h = '<section class="vue page">' + boutonRetour();
    var points = '<div class="points" aria-hidden="true">' + g.etapes.map(function (_, i) { return '<i class="' + (i <= e - 1 ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    if (e === 0) {
      h += '<div class="guide" aria-live="polite"><p class="surtitre">' + esc(g.duree) + '</p><p class="etape-mot">' + esc(g.titre) + '</p><p class="etape-texte">' + lexique(g.intro) + '</p>' +
        '<div class="points"></div><div class="actions"><button class="bouton" data-action="etape" data-id="1">' + esc(T('commencer')) + '</button></div></div>';
    } else if (e <= total) {
      var et = g.etapes[e - 1];
      h += '<div class="guide" aria-live="polite"><p class="etape-mot">' + esc(et.mot) + '</p><p class="etape-texte">' + lexique(et.invitation) + '</p>' + points +
        '<div class="actions">' + (e > 1 ? '<button class="bouton leger" data-action="etape" data-id="' + (e - 1) + '">' + esc(T('precedent')) + '</button>' : '') +
        '<button class="bouton" data-action="etape" data-id="' + (e + 1) + '">' + esc(e === total ? T('terminer') : T('suivant')) + '</button></div></div>';
    } else {
      h += '<div class="guide" aria-live="polite"><p class="etape-mot">' + esc(T('amen')) + '</p><p class="etape-texte">' + lexique(g.fin || '') + '</p><div class="points"></div><div class="actions"><button class="bouton" data-action="retour">' + esc(T('revenir')) + '</button></div></div>';
    }
    return h + '</section>';
  }

  function vueLexique() {
    var f = etat.filtre.toLowerCase();
    var h = '<section class="vue page">' + boutonRetour() + '<h2>' + esc(T('lexique')) + '</h2><p class="chapeau">' + esc(T('lexique-chapeau')) + '</p>';
    h += '<label class="surtitre" for="cherche" style="display:block;margin-top:20px">' + esc(T('chercher-mot')) + '</label><input id="cherche" class="recherche" type="search" autocomplete="off" value="' + esc(etat.filtre) + '" placeholder="' + esc(T('ex-mot')) + '">';
    h += '<div id="liste-mots">' + listeMots(filtrerMots(f)) + '</div></section>';
    return h;
  }
  function filtrerMots(f) { return D.lexique.mots.filter(function (m) { return !f || m.mot.toLowerCase().indexOf(f) >= 0 || m.def.toLowerCase().indexOf(f) >= 0; }).sort(function (a, b) { return a.mot.localeCompare(b.mot, LANG); }); }
  function listeMots(mots) {
    if (!mots.length) return '<p class="note">' + esc(T('aucun-mot')) + '</p>';
    return mots.map(function (m) { return '<div class="mot-def"><b>' + esc(m.mot) + '</b><span>' + refsSeules(m.def) + '</span></div>'; }).join('');
  }

  // ---------- Bible ----------
  function urlBible() { return (window.ORA_BIBLES || { fr: 'bible-fr.json', es: 'bible-es.json', en: 'bible-en.json' })[LANG]; }
  function chargerBible() {
    if (BIBLE && bibleLangue === LANG) return Promise.resolve(BIBLE);
    if (bibleEnCours && bibleEnCours.langue === LANG) return bibleEnCours.p;
    var l = LANG;
    var p = fetch(urlBible()).then(function (r) { return r.json(); }).then(function (b) { if (l === LANG) { BIBLE = b; bibleLangue = l; } return b; })
      .catch(function (e) { bibleEnCours = null; throw e; });
    bibleEnCours = { langue: l, p: p };
    return p;
  }
  function livreOsis(o) { return BIBLE && BIBLE.livres.filter(function (b) { return b.osis === o; })[0]; }
  function attendreBible() {
    chargerBible().then(rendreEnPlace).catch(function () { var z = document.getElementById('charge'); if (z) z.textContent = T('bible-erreur'); });
    return '<p class="charge" id="charge">' + esc(T('ouverture-bible')) + '</p>';
  }

  function vueBible() {
    var a = aujourdhui();
    var h = '<section class="vue page"><p class="surtitre">' + esc(T('lire-bible')) + '</p><h2>' + esc(T('onglet.bible')) + '</h2><p class="chapeau">' + esc(T('bible-chapeau')) + '</p>';
    if (!BIBLE || bibleLangue !== LANG) return h + attendreBible() + '</section>';
    var nb = lireMarques().length;
    h += '<div class="rubriques">' + rubrique('<span class="titre-r">' + esc(T('favoris')) + '</span><span class="texte-r">' + esc(nb ? T('favoris-nb', nb) : T('favoris-vide')) + '</span>', { action: 'aller', id: 'favoris' }) + '</div>';
    h += '<label class="surtitre" for="cherche-bible" style="display:block;margin-top:24px">' + esc(T('chercher-bible')) + '</label><input id="cherche-bible" class="recherche" type="search" autocomplete="off" value="' + esc(etat.cherche) + '" placeholder="' + esc(T('ex-bible')) + '">';
    h += '<div id="resultats">' + resultats(etat.cherche) + '</div>';
    [['NT', T('nouveau-testament')], ['AT', T('ancien-testament')]].forEach(function (t) {
      h += '<p class="groupe">' + esc(t[1]) + '</p><div class="livres">';
      BIBLE.livres.filter(function (b) { return b.t === t[0]; }).forEach(function (b) {
        var ouvert = etat.livreOuvert === b.osis;
        h += '<div class="livre' + (ouvert ? ' ouvert' : '') + '"><button class="livre-tete" data-action="livre" data-id="' + esc(b.osis) + '" aria-expanded="' + ouvert + '"><span class="livre-nom">' + esc(b.court) + '</span><span class="livre-abr">' + esc(b.abr) + '</span><span class="livre-signe" aria-hidden="true"></span></button>';
        if (ouvert) {
          h += '<div class="livre-corps"><p class="livre-res">' + lexique(b.res || '') + '</p>';
          h += '<p class="livre-info">' + b.ch.length + ' ' + esc(b.osis === 'Ps' ? T('psaumes') : T('chapitres')) + '</p><div class="chapitres">';
          b.ch.forEach(function (_, i) { h += '<button data-action="passage" data-id="' + esc(b.osis + '|' + (i + 1) + '|0|0') + '" aria-label="' + esc((b.osis === 'Ps' ? T('psaume') : T('chapitre')) + ' ' + (i + 1)) + '">' + (i + 1) + '</button>'; });
          h += '</div></div>';
        }
        h += '</div>';
      });
      h += '</div>';
    });
    return h + '</section>';
  }

  function resultats(q) {
    q = (q || '').trim();
    if (q.length < 3 || !BIBLE) return '';
    var norm = function (s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, '\'').replace(/\s+/g, ' '); };
    var nq = norm(q), out = [], total = 0;
    BIBLE.livres.forEach(function (b) {
      b.ch.forEach(function (chap, ci) {
        chap.forEach(function (v, vi) {
          if (v && norm(v).indexOf(nq) >= 0) { total++; if (out.length < 60) out.push({ b: b, c: ci + 1, v: vi + 1, t: v.replace(/\s+/g, ' ') }); }
        });
      });
    });
    if (!total) return '<p class="note">' + esc(T('aucun-verset')) + '</p>';
    var sep = LANG === 'en' ? ':' : ', ';
    var h = '<p class="note">' + esc(T('versets-trouves', total)) + (total > 60 ? esc(T('premiers-60')) : '') + '</p>';
    out.forEach(function (r) {
      var i = norm(r.t).indexOf(nq), t = r.t;
      var extrait = esc(t.slice(Math.max(0, i - 60), i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length, i + q.length + 80));
      h += '<button class="resultat" data-action="passage" data-id="' + esc(r.b.osis + '|' + r.c + '|' + r.v + '|' + r.v) + '"><b>' + esc(r.b.abr + ' ' + r.c + sep + r.v) + '</b><span>' + (i > 60 ? '…' : '') + extrait + '…</span></button>';
    });
    return h;
  }

  // Le passage surligné peut commencer dans un chapitre et finir dans le suivant.
  function estSurligne(p, c, v) {
    if (p.liste) return p.liste.some(function (x) { return x[0] === c && x[1] === v; });
    if (!p.du) return false;
    var c2 = p.c2 || p.c;
    if (c < p.c || c > c2) return false;
    if (c === p.c && v < p.du) return false;
    if (c === c2 && v > p.au) return false;
    return true;
  }
  function vueChapitre(p) {
    var h = '<section class="vue page">' + boutonRetour();
    if (!BIBLE || bibleLangue !== LANG) return h + attendreBible() + '</section>';
    var L = livreOsis(p.o), c = p.ch || p.c, chap = L.ch[c - 1] || [], marques = lireMarques();
    h += '<p class="surtitre">' + esc(L.nom) + '</p><h2>' + esc((L.osis === 'Ps' ? T('psaume') : T('chapitre')) + ' ' + c) + '</h2><div class="texte-bible">';
    var debuts = {}, lignes = {}, depuis = 0, ouvert = false;
    ((L.p && L.p[c - 1]) || [1]).forEach(function (n) { debuts[n] = 1; });
    ((L.l && L.l[c - 1]) || []).forEach(function (n) { lignes[n] = 1; });
    chap.forEach(function (t, i) {
      if (!t) return;
      var v = i + 1, sur = estSurligne(p, c, v), mq = marques.some(function (m) { return m.o === L.osis && m.c === c && m.v === v; });
      var prec = chap[i - 1] || '';
      if (!debuts[v] && depuis >= 3 && /[.!?»”]\s*$/.test(prec) && !lignes[v]) debuts[v] = 1;
      if (debuts[v] || !ouvert) { h += (ouvert ? '</p>' : '') + '<p>'; ouvert = true; depuis = 0; }
      else if (lignes[v]) h += '<br>';
      depuis++;
      h += '<span class="v' + (sur ? ' surligne' : '') + (mq ? ' marque' : '') + '" id="v' + v + '" data-action="verset" data-id="' + v + '" role="button" tabindex="0" aria-pressed="' + mq + '"><sup>' + v + '</sup>' + esc(t).replace(/\n/g, '<br>') + '</span> ';
    });
    if (ouvert) h += '</p>';
    h += '</div><p class="note">' + esc(T('toucher-favori')) + '</p><div class="nav-chap">';
    // Dans un passage sur deux chapitres, le chapitre voisin garde le surlignage.
    var dans = function (n) { return p.liste ? p.liste.some(function (x) { return x[0] === n; }) : p.du && n >= p.c && n <= (p.c2 || p.c); };
    var vers = function (n, contenu) { return dans(n) ? '<button class="bouton leger" data-action="chapitre" data-id="' + n + '">' + contenu + '</button>' : '<button class="bouton leger" data-action="passage" data-id="' + esc(L.osis + '|' + n + '|0|0') + '">' + contenu + '</button>'; };
    h += c > 1 ? vers(c - 1, icone('retour') + ' ' + (c - 1)) : '<span></span>';
    h += c < L.ch.length ? vers(c + 1, (c + 1) + ' ' + icone('fleche')) : '';
    return h + '</div></section>';
  }

  // ---------- En famille ----------
  function vueFamille() {
    var a = aujourdhui(), k = a.c && a.c.enfant, nuit = estNuit();
    var h = '<section class="vue page enfant"><p class="surtitre">' + esc(T('onglet.famille')) + '</p><h2>' + esc(T('famille-titre')) + '</h2><p class="chapeau">' + esc(T('famille-chapeau')) + '</p><div class="sections">';
    var p = priereDuMoment(a, true);
    if (p.texte) h += section(p.etiquette, blocPriere(p));
    // L'Évangile des enfants : un passage court choisi pour eux, jamais celui des adultes du même jour.
    var le = evangileEnfant(a), e = le && evangile({ lect: le });
    if (e && !e.attente) h += section(T('evangile-jour'), '<p class="ev-titre">' + esc(le.titre[LANG] || le.titre.fr) + '</p>' + versets(e.coeur, true) + '<p class="s-ref">' + refsSeules(e.refCoeur) + '</p>');
    h += respiration();
    // Le rituel du coucher, bien en vue.
    var g = D.guideFamille;
    if (g) h += '<div class="vedette">' + section(T('rituel-coucher'), '<p class="s-titre">' + esc(g.titre) + '</p><p class="s-accroche">' + esc(g.intro) + '</p><ol class="etapes-rituel">' +
      g.etapes.map(function (x) { return '<li>' + esc(x.mot) + '</li>'; }).join('') + '</ol>' + (g.duree ? '<p class="s-ref">' + esc(g.duree) + '</p>' : ''), { action: 'guide', id: 'famille-soir' }, T('commencer')) + '</div>';
    var pj = personnageDuJour(a.j);
    if (pj) h += section(T('personnage-jour'), '<p class="s-titre">' + esc(pj.nom) + '</p><p class="s-accroche">' + lexique(pj.histoire) + '</p>' + (pj.idee ? '<p class="question">' + esc(pj.idee) + '</p>' : ''));
    var rf = (k && k.reflexion) || (a.c && a.c.reflexionEnfant);
    if (rf) h += section(T('reflexion-jour'), '<p class="s-titre">' + esc(rf.titre) + '</p><p class="s-accroche">' + lexique(rf.texte) + '</p>' + (rf.question ? '<p class="question">' + esc(rf.question) + '</p>' : ''));
    if (k) {
      if (k.citation) h += section(T('citation-jour'), '<blockquote class="s-citation">' + guillemets(esc(k.citation.texte)) + '</blockquote><p class="s-ref">' + auteur(k.citation) + '</p>');
      if (k.histoire) h += section(T('histoire-jour'), '<p class="s-titre">' + esc(k.histoire.titre) + '</p><p class="s-accroche">' + lexique(k.histoire.texte) + '</p>');
      if (k.portrait) h += section(T('portrait-jour'), '<p class="s-titre">' + esc(k.portrait.nom) + '</p><p class="s-accroche">' + lexique(k.portrait.texte) + '</p>' + (k.portrait.idee ? '<p class="question">' + esc(k.portrait.idee) + '</p>' : ''));
    }
    h += bougie();
    var m = motEnfant(a.j);
    if (m) h += section(T('mot-jour'), '<p class="s-titre">' + esc(m.mot) + '</p><p class="s-accroche">' + esc(m.def) + '</p>');
    return h + '</div></section>';
  }
  // L'Évangile des enfants : par temps liturgique (le Triduum prend le Carême), au fil des jours ;
  // s'il tombe sur le passage des adultes du jour, on prend le suivant.
  function evangileEnfant(a) {
    var E = D.evEnfants, j = a.j; if (!E || !j) return null;
    var s = j.saison.id === 'triduum' ? 'careme' : j.saison.id, pool = E[s] && E[s].length ? E[s] : E.ordinaire;
    var n = (pool === E[s] && s !== 'ordinaire' && j.jourSaison != null) ? j.jourSaison : numeroJour(j);
    var x = pool[n % pool.length];
    if (a.lect && x.ref === a.lect.ref) x = pool[(n + 1) % pool.length];
    return x;
  }
  // Personnage du jour : pendant l'Avent, Noël, le Carême et le temps pascal, les personnages de ce temps ;
  // le reste de l'année, les autres, l'un après l'autre (deux jours de suite ne donnent jamais le même).
  function personnageDuJour(j) {
    var tous = D.personnages || []; if (!tous.length || !j) return null;
    var s = j.saison.id === 'triduum' ? 'careme' : j.saison.id;
    var du = tous.filter(function (x) { return x.temps && x.temps.indexOf(s) >= 0; }), n;
    if (du.length) n = j.jourSaison || 0;
    else { du = tous.filter(function (x) { return !x.temps; }); n = numeroJour(j); }
    var x = du[n % du.length]; return x && (x[LANG] || x.fr);
  }
  function numeroJour(j) { var d = new Date(j.date + 'T12:00:00'); return Math.round((d - new Date(d.getFullYear(), 0, 1, 12)) / 864e5); }
  function motEnfant(j) {
    var mots = D.motsEnfants; if (!mots.length || !j) return null;
    var x = mots[(numeroJour(j) * 7) % mots.length]; return x[LANG] || x.fr;
  }
  function titrePriere(id) { var p = D.prieres.traditionnelles.filter(function (x) { return x.id === id; })[0]; return p ? p.titre : id; }

  // ---------- Réglages ----------
  function vueMenu() {
    var h = '<section class="vue page">' + boutonRetour();
    h += '<h2>' + esc(T('menu')) + '</h2>';
    h += '<p class="groupe">' + esc(T('langue')) + '</p><div class="segments">' + LANGUES.map(function (l) { return '<button class="' + (LANG === l[0] ? 'on' : '') + '" aria-pressed="' + (LANG === l[0]) + '" data-action="langue" data-id="' + l[0] + '" lang="' + l[0] + '">' + l[1] + '</button>'; }).join('') + '</div>';
    h += '<p class="note">' + esc(T('langue-note')) + '</p>';
    h += '<p class="groupe">' + esc(T('ambiance')) + '</p><div class="segments">' + seg('mode', 'auto', T('selon-heure')) + seg('mode', 'jour', T('jour')) + seg('mode', 'nuit', T('soir')) + '</div>';
    h += '<p class="note">' + esc(T('ambiance-note')) + '</p>';
    h += '<p class="groupe">' + esc(T('taille')) + '</p><div class="segments">' + seg('taille', 'normal', T('normale')) + seg('taille', 'grand', T('grande')) + seg('taille', 'tres-grand', T('tres-grande')) + '</div>';
    h += '<div class="a-propos"><p class="groupe">' + esc(T('a-propos')) + '</p><p class="presentation">' + T('presentation') + '</p></div>';
    h += '<div class="mentions"><p class="note">' + esc(T('donnees')) + '</p><p class="note">' + esc(T('traduction-bible')) + '</p></div>';
    return h + '</section>';
  }

  function vueFavoris() {
    var h = '<section class="vue page">' + boutonRetour() + '<p class="surtitre">' + esc(T('onglet.bible')) + '</p><h2>' + esc(T('favoris')) + '</h2>';
    var m = lireMarques();
    if (!m.length) return h + '<p class="chapeau">' + esc(T('favoris-aucun')) + '</p></section>';
    if (!BIBLE || bibleLangue !== LANG) return h + attendreBible() + '</section>';
    var sep = LANG === 'en' ? ':' : ', ';
    h += '<p class="chapeau">' + esc(T('favoris-chapeau')) + '</p><div class="rubriques">';
    m.slice().reverse().forEach(function (x) {
      var L = livreOsis(x.o); if (!L) return;
      h += '<button class="favori" data-action="passage" data-id="' + esc(L.osis + '|' + x.c + '|' + x.v + '|' + x.v) + '"><b>' + esc(L.court + ' ' + x.c + sep + x.v) + '</b><span>' + esc(equilibre(((L.ch[x.c - 1] || [])[x.v - 1] || '').replace(/\n/g, ' '))) + '</span></button>';
    });
    return h + '</div></section>';
  }
  function seg(cle, val, lib) { return '<button class="' + (R[cle] === val ? 'on' : '') + '" aria-pressed="' + (R[cle] === val) + '" data-action="reglage" data-cle="' + cle + '" data-id="' + val + '">' + esc(lib) + '</button>'; }

  function boutonRetour() { return '<button class="retour" data-action="retour">' + icone('retour') + esc(T('retour')) + '</button>'; }

  function icone(nom) {
    var I = {
      jour: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3.5"></circle><circle cx="12" cy="12" r="7.5" opacity=".5"></circle></svg>',
      prier: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 3v18M7 8h10"></path></svg>',
      bible: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z"></path><path d="M12 6v13.5"></path></svg>',
      famille: '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="7" r="3"></circle><circle cx="17" cy="10" r="2.2"></circle><path d="M3 20c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5"></path><path d="M13.5 20c.3-2.3 1.7-4 3.5-4s3.2 1.7 3.5 4"></path></svg>',
      fleche: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>',
      retour: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"></path></svg>'
    };
    return I[nom] || '';
  }

  // L'icône du menu : trois traits ; celui du milieu passe par un petit halo doré, le O d'Ora (comme un grain de chapelet).
  // Réglages : le O du logo (même orbe, même halo, même trait, même taille), dont le cercle devient une roue à 8 dents.
  var ICONE_MENU = '<svg class="menu-icone" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" fill="none">' +
    '<defs><radialGradient id="reglages-aura"><stop offset="0" stop-color="#E8BE78" stop-opacity=".55"></stop><stop offset="1" stop-color="#E8BE78" stop-opacity="0"></stop></radialGradient></defs>' +
    '<circle cx="16" cy="16" r="11" fill="url(#reglages-aura)"></circle>' +
    '<path d="M13.61 3.73L14.15 0.91A15.2 15.2 0 0 1 17.85 0.91L18.39 3.73A12.5 12.5 0 0 1 22.99 5.64L25.36 4.02A15.2 15.2 0 0 1 27.98 6.64L26.36 9.01A12.5 12.5 0 0 1 28.27 13.61L31.09 14.15A15.2 15.2 0 0 1 31.09 17.85L28.27 18.39A12.5 12.5 0 0 1 26.36 22.99L27.98 25.36A15.2 15.2 0 0 1 25.36 27.98L22.99 26.36A12.5 12.5 0 0 1 18.39 28.27L17.85 31.09A15.2 15.2 0 0 1 14.15 31.09L13.61 28.27A12.5 12.5 0 0 1 9.01 26.36L6.64 27.98A15.2 15.2 0 0 1 4.02 25.36L5.64 22.99A12.5 12.5 0 0 1 3.73 18.39L0.91 17.85A15.2 15.2 0 0 1 0.91 14.15L3.73 13.61A12.5 12.5 0 0 1 5.64 9.01L4.02 6.64A15.2 15.2 0 0 1 6.64 4.02L9.01 5.64A12.5 12.5 0 0 1 13.61 3.73Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>' +
    '<circle cx="15.3" cy="16.6" r="4.2" fill="var(--logo-ombre)"></circle><circle cx="16" cy="16" r="4.2" fill="#F2E5C6"></circle></svg>';

  var LOGO = '<svg width="68" height="27" viewBox="0 0 84 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<defs><radialGradient id="logo-aura"><stop offset="0" stop-color="#E8BE78" stop-opacity=".55"></stop><stop offset="1" stop-color="#E8BE78" stop-opacity="0"></stop></radialGradient></defs>' +
    '<circle cx="16" cy="16" r="11" fill="url(#logo-aura)" stroke="none"></circle>' +
    '<circle class="aureole" cx="16" cy="16" r="15.5" stroke="var(--logo-anneau)" stroke-width="1.1"></circle><circle cx="16" cy="16" r="12.5"></circle>' +
    '<circle cx="15.3" cy="16.6" r="4.2" fill="var(--logo-ombre)" stroke="none"></circle><circle cx="16" cy="16" r="4.2" fill="#F2E5C6" stroke="none"></circle>' +
    '<g class="logo-ra"><path d="M37 29V14.5M37 20c0-4.6 3.2-7 8.2-6.6"></path><circle cx="57.5" cy="21.5" r="7.5"></circle><path d="M65 14v15"></path></g></svg>';

  // ---------- Rendu ----------
  var dernierCiel = null, cielPret = false;
  function majVivant() { document.documentElement.classList.toggle('vivant', cielPret); }
  function majDefile() { document.documentElement.classList.toggle('defile', window.scrollY > 40); }
  function rendreEnPlace() { var y = window.scrollY; rendre(); window.scrollTo(0, y); }

  // ---------- Écran de bienvenue (une seule fois, à la toute première ouverture) ----------
  // On est très haut dans le ciel (au soleil le jour, parmi les étoiles le soir). À « Commencer », un grand nuage
  // d'aquarelle passe devant, et l'on descend jusqu'au ciel d'Aujourd'hui, à son niveau habituel.
  var ETOILES_HAUT = [[40, 90, 6, 0], [120, 40, 8, 1.4], [300, 70, 7, 3], [350, 160, 9, 2], [70, 230, 7.5, 4.5], [210, 120, 10, 5.2], [280, 260, 6.5, 0.8],
    [20, 400, 8, 3.6], [360, 420, 7, 1.9], [160, 330, 9, 6]];
  // [profondeur, décalage horizontal (px depuis le centre), haut (px), largeur, graine, retard (s)]
  // Seuls les grands nuages du premier plan (les petits nuages qui montaient d'abord ont été retirés, à la demande de Nico).
  var BALAI = [['pres', -360, 220, 600, 6511, 0.1], ['pres', -120, 330, 580, 6613, 0.22]];
  var BALAI_TEINTES = {
    jour: { loin: { corps: [240, 233, 246], ombre: [214, 206, 228], lumiere: [252, 250, 255], a: 0.07 },
      milieu: { corps: [253, 238, 228], ombre: [228, 210, 214], lumiere: [255, 252, 246], a: 0.085 },
      pres: { corps: [255, 249, 241], ombre: [230, 218, 220], lumiere: [255, 255, 255], a: 0.11 } },
    nuit: { loin: { corps: [50, 60, 96], ombre: [28, 34, 64], lumiere: [96, 110, 150], a: 0.08 },
      milieu: { corps: [62, 74, 114], ombre: [32, 40, 72], lumiere: [120, 136, 176], a: 0.09 },
      pres: { corps: [78, 92, 134], ombre: [38, 46, 80], lumiere: [150, 164, 200], a: 0.11 } }
  };
  function ecranBienvenue() {
    if (document.getElementById('bienvenue')) return;
    var cle = estNuit() ? 'nuit' : 'jour';
    document.documentElement.classList.toggle('nuit', cle === 'nuit');
    var e = document.createElement('div');
    e.id = 'bienvenue'; e.className = 'bienvenue-ecran'; e.setAttribute('role', 'dialog'); e.setAttribute('aria-modal', 'true'); e.setAttribute('aria-label', T('menu-titre'));
    e.innerHTML = '<div class="be-scene" id="be-scene">' +
        '<div class="be-nuages" id="be-nuages" aria-hidden="true"></div><div class="be-nuages be-nuages-2" id="be-nuages-2" aria-hidden="true"></div>' +
        (cle === 'nuit' ? '<div class="be-etoiles" aria-hidden="true">' + ETOILES_HAUT.map(function (p) { return '<span class="etoile" style="left:calc(50% - 195px + ' + p[0] + 'px);top:' + p[1] + 'px;--d:' + p[2] + 's;--r:-' + p[3] + 's"></span>'; }).join('') + '</div>' : '') +
        '<div class="be-mer be-mer-loin" id="be-mer-loin" aria-hidden="true"></div><div class="be-mer" id="be-mer" aria-hidden="true"></div><div class="be-lumiere" aria-hidden="true"></div>' +
        '<div class="be-contenu"><div class="be-o" aria-hidden="true">' + LOGO.replace('width="68" height="27" viewBox="0 0 84 32"', 'width="134" height="65" viewBox="0 0 66 32"') + '</div>' +
        '<h1 class="be-titre">' + esc(T('menu-titre')) + '</h1><p class="be-texte">' + T('presentation') + '</p>' +
        '<button class="be-commencer" data-action="bienvenue">' + esc(T('commencer')) + '</button></div>' +
        '<div class="be-balai" aria-hidden="true">' + BALAI.map(function (n, k) { return '<div class="bb bb-' + n[0] + '" id="bb-' + k + '" style="left:calc(50% + ' + n[1] + 'px);top:' + n[2] + 'px;--bb-d:' + n[5] + 's"></div>'; }).join('') + '</div>' +
      '</div>' +
      '<div class="be-voile" id="be-voile" aria-hidden="true"><div class="be-voile-a" id="be-voile-a"></div><div class="be-voile-b" id="be-voile-b"></div><div class="be-voile-c" id="be-voile-c"></div></div>';
    document.body.appendChild(e);
    document.getElementById('app').innerHTML = ''; document.getElementById('barre').hidden = true;
    OraAquarelle.peindre(document.getElementById('be-nuages'), cle, false); // peints d'un coup : là dès le départ
    OraAquarelle.peindre(document.getElementById('be-mer-loin'), 'bas-' + cle, false);
    OraAquarelle.peindre(document.getElementById('be-mer'), 'bas-' + cle, false);
    OraAquarelle.peindre(document.getElementById('be-nuages-2'), cle, false);
    ['a', 'b'].forEach(function (k) { OraAquarelle.peindre(document.getElementById('be-voile-' + k), k === 'b' ? 'bas-' + cle : cle, false); });
    // Le dernier nuage qui passe est un nuage à lui seul (et non une seconde copie du ciel : on croyait voir le même nuage revenir).
    var tv = cle === 'nuit' ? { corps: [92, 106, 148], ombre: [40, 50, 86], lumiere: [176, 186, 216] } : { corps: [250, 226, 220], ombre: [222, 204, 216], lumiere: [255, 250, 244] };
    OraAquarelle.nuage(document.getElementById('be-voile-c'), { w: 640, h: 400, seed: 7207, corps: tv.corps, ombre: tv.ombre, lumiere: tv.lumiere, aCorps: 0.1, n: 30 });
    // Les nuages qui balaient le texte quand il monte : trois profondeurs, chacune sa teinte, sa densité et sa vitesse.
    BALAI.forEach(function (n, k) {
      var t = BALAI_TEINTES[cle][n[0]];
      OraAquarelle.nuage(document.getElementById('bb-' + k), { w: n[3], h: Math.round(n[3] * 0.62), seed: n[4], corps: t.corps, ombre: t.ombre, lumiere: t.lumiere, aCorps: t.a, aOmbre: t.a * 0.6, aLumiere: t.a * 1.2, n: 30 });
    });
    document.documentElement.classList.add('vivant'); // le fond de l'écran vit comme le ciel d'Aujourd'hui
  }
  function quitterBienvenue() {
    var e = document.getElementById('bienvenue'); if (!e || e.classList.contains('descend')) return;
    var lent = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    R.bienvenue = true; ecrireReglages();
    // Aujourd'hui est posé dessous, plus bas : en descendant, il monte vers nous jusqu'à sa place.
    etat.premiereOuverture = true; dernierCiel = null; etat.vue = 'accueil'; rendre(); window.scrollTo(0, 0);
    if (lent) { e.remove(); return; }
    document.documentElement.classList.add('arrivee');
    void e.offsetWidth; // le navigateur prend la position de départ avant l'animation
    e.classList.add('descend');
    setTimeout(function () { document.documentElement.classList.remove('arrivee'); e.remove(); }, 3900);
  }

  function rendre() {
    if (!R.bienvenue) { ecranBienvenue(); return; }
    var nuit = estNuit();
    document.documentElement.classList.toggle('nuit', nuit);
    document.documentElement.style.fontSize = { normal: '16px', grand: '18px', 'tres-grand': '20px' }[R.taille] || '16px';
    var meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', nuit ? '#161E35' : '#FFFBF5');

    var v = etat.vue, contenu;
    if (v === 'accueil') contenu = vueAccueil();
    else if (v === 'prier') contenu = vuePrier();
    else if (v.indexOf('priere:') === 0) contenu = vuePriere(v.slice(7));
    else if (v === 'guide') contenu = vueGuide();
    else if (v.indexOf('lecture:') === 0) contenu = vueLecture(v.slice(8));
    else if (v === 'lexique') contenu = vueLexique();
    else if (v === 'messe') contenu = vueMesse();
    else if (v === 'bible') contenu = vueBible();
    else if (v === 'bible-chapitre') contenu = vueChapitre(etat.bible);
    else if (v === 'famille') contenu = vueFamille();
    else if (v === 'favoris') contenu = vueFavoris();
    else contenu = vueMenu();

    var onglet = (v === 'accueil' || v.indexOf('lecture:') === 0) ? 'accueil' : (v.indexOf('bible') === 0 ? 'bible' : (v === 'famille' || v === 'guide') ? 'famille' : v === 'favoris' ? 'bible' : v === 'menu' ? '' : 'prier');
    var ciel = document.getElementById('ciel');
    ciel.className = 'ciel' + (v === 'accueil' ? '' : ' discret');
    var cleCiel = nuit ? 'nuit' : 'jour';
    if (dernierCiel !== cleCiel) {
      dernierCiel = cleCiel;
      document.getElementById('astre-zone').innerHTML = '<div class="astre"><div class="aura"></div><div class="halo"></div><div class="disque"></div></div>' +
        (nuit ? [[62, 96, 7, 0], [132, 58, 9, 2.5], [176, 150, 6, 4], [350, 70, 8, 1.2], [34, 196, 10, 5.5], [250, 36, 7.5, 3.2], [318, 40, 9.5, 6.4]].map(function (p) { return '<span class="etoile" style="left:calc(50% - 195px + ' + p[0] + 'px);top:' + p[1] + 'px;--d:' + p[2] + 's;--r:-' + p[3] + 's"></span>'; }).join('') : '');
      cielPret = false; document.documentElement.classList.remove('vivant');
      OraAquarelle.peindre(document.getElementById('couches'), cleCiel, true, function () { cielPret = true; majVivant(); });
    }

    var nouvelleVue = v !== derniereVue || v === 'guide';
    document.getElementById('app').innerHTML =
      '<header class="entete"><button class="logo" data-action="haut" aria-label="' + esc(T('haut')) + '">' + LOGO + '</button>' +
      '<button class="bouton-menu" data-action="reglages" aria-label="' + esc(T('menu')) + '"><span class="menu-mot">' + esc(T('menu')) + '</span>' + ICONE_MENU + '</button></header>' +
      '<main>' + OraLatin.italiques(contenu) + '</main><div class="mer-bas" id="mer-bas" aria-hidden="true"></div>';
    if (nouvelleVue) { var vu = document.querySelector('.vue'); if (vu) vu.classList.add('entre'); }
    derniereVue = v;
    peindreMerBas(cleCiel);

    majBarre(onglet);
    largeurMenu();

    var champ = document.getElementById('cherche');
    if (champ) champ.addEventListener('input', function () { etat.filtre = champ.value; document.getElementById('liste-mots').innerHTML = OraLatin.italiques(listeMots(filtrerMots(champ.value.toLowerCase()))); });
    var cb = document.getElementById('cherche-bible'), tempoC;
    if (cb) cb.addEventListener('input', function () {
      etat.cherche = cb.value; clearTimeout(tempoC);
      tempoC = setTimeout(function () { document.getElementById('resultats').innerHTML = resultats(etat.cherche); }, 250);
    });
    etat.premiereOuverture = false;
    ajusterTitres();
    majDefile();
  }

  // Garde-fou : si un mot d'un titre est plus large que l'écran, on réduit la police jusqu'à ce qu'il tienne.
  function ajusterTitres() {
    document.querySelectorAll('#app h1, #app h2').forEach(function (t) {
      t.style.fontSize = '';
      var taille = parseFloat(getComputedStyle(t).fontSize), n = 0;
      while (t.scrollWidth > t.clientWidth + 1 && taille > 16 && n++ < 30) { taille -= 1; t.style.fontSize = taille + 'px'; }
      // Un mot très long (« Commémoration ») ne doit pas occuper toute la ligne : on vise 88 % de la largeur au plus.
      var mots = (t.textContent || '').split(/\s+/), plusLong = mots.reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
      if (plusLong.length > 9) {
        var m = document.createElement('span'); m.textContent = plusLong; m.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit;letter-spacing:inherit';
        t.appendChild(m);
        while (m.offsetWidth > t.clientWidth * .88 && taille > 16 && n++ < 40) { taille -= 1; t.style.fontSize = taille + 'px'; }
        m.remove();
      }
    });
  }

  // La barre de navigation reste en place : la pastille glisse d'un onglet à l'autre
  // pendant que les libellés se déploient (la barre s'élargit ou rétrécit en douceur).
  var pastilleAnim = null;
  function majBarre(onglet) {
    var barre = document.getElementById('barre');
    barre.hidden = false;
    if (barre.getAttribute('data-langue') !== LANG) {
      barre.setAttribute('data-langue', LANG);
      barre.innerHTML = '<span class="pastille" aria-hidden="true"></span>' + [['accueil', 'jour'], ['prier', 'prier'], ['bible', 'bible'], ['famille', 'famille']].map(function (b) {
        var lib = T('onglet.' + b[0]);
        return '<button data-action="onglet" data-id="' + b[0] + '" aria-label="' + esc(lib) + '">' + icone(b[1]) + '<span class="lib">' + esc(lib) + '</span></button>';
      }).join('');
      barre.removeAttribute('data-onglet');
    }
    var past = barre.querySelector('.pastille'), avant = barre.getAttribute('data-onglet');
    if (avant === onglet) return;
    var depart = { x: parseFloat(past.style.left) || 0, l: parseFloat(past.style.width) || 0, o: avant ? 1 : 0 };
    barre.setAttribute('data-onglet', onglet);
    Array.prototype.forEach.call(barre.querySelectorAll('button'), function (b) {
      var on = b.getAttribute('data-id') === onglet;
      b.classList.toggle('on', on);
      var lib = b.querySelector('.lib');
      if (lib) {
        // On part toujours d'une largeur en pixels pour que l'animation ait lieu dans les deux sens.
        if (lib.style.maxWidth === 'none') { lib.style.maxWidth = lib.offsetWidth + 'px'; void lib.offsetWidth; }
        lib.style.maxWidth = on ? lib.scrollWidth + 'px' : '0px';
      }
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var cible = function () { var b = barre.querySelector('button.on'); return b ? { x: b.offsetLeft, l: b.offsetWidth, o: 1 } : { x: depart.x, l: depart.l, o: 0 }; };
    if (pastilleAnim) cancelAnimationFrame(pastilleAnim);
    var lent = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var t0 = performance.now(), duree = lent || !avant ? 0 : 520;
    // À la fin, le libellé actif reprend sa largeur naturelle (la police peut avoir fini de charger entre-temps).
    var caler = function () { var lb = barre.querySelector('button.on .lib'); if (lb) lb.style.maxWidth = 'none'; pose(cible()); };
    var pose = function (p) { past.style.left = p.x + 'px'; past.style.width = (p.o ? p.l : 0) + 'px'; past.style.opacity = p.o; };
    var pas = function (t) {
      var k = duree ? Math.min(1, (t - t0) / duree) : 1, e = 1 - Math.pow(1 - k, 3), c = cible();
      if (!depart.o) depart = { x: c.x, l: c.l, o: 0 };
      pose({ x: depart.x + (c.x - depart.x) * e, l: depart.l + (c.l - depart.l) * e, o: depart.o + (c.o - depart.o) * e });
      if (k < 1) pastilleAnim = requestAnimationFrame(pas); else { pastilleAnim = null; setTimeout(caler, 80); }
    };
    pastilleAnim = requestAnimationFrame(pas);
  }

  // Le bouton Réglages prend la largeur exacte de son mot (« Réglages », « Ajustes », « Settings ») : une largeur
  // en pixels, pour que le passage au petit rond reste une animation fluide.
  function largeurMenu() {
    var bm = document.querySelector('.bouton-menu'), mot = bm && bm.querySelector('.menu-mot');
    if (mot) bm.style.setProperty('--larg-menu', Math.ceil(mot.getBoundingClientRect().width) + 32 + 'px');
  }
  function recalerBarre() {
    largeurMenu();
    ajusterTitres();
    var barre = document.getElementById('barre'), b = barre && barre.querySelector('button.on'), past = barre && barre.querySelector('.pastille');
    if (!b || !past || pastilleAnim) return;
    var lb = b.querySelector('.lib'); if (lb) lb.style.maxWidth = 'none';
    past.style.left = b.offsetLeft + 'px'; past.style.width = b.offsetWidth + 'px';
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalerBarre);
  window.addEventListener('load', recalerBarre);
  window.addEventListener('resize', recalerBarre);

  // La mer de nuages du bas est peinte une fois par ambiance, puis recopiée à chaque page.
  var merBasCache = {};
  function peindreMerBas(cle) {
    var z = document.getElementById('mer-bas'); if (!z) return;
    var cache = merBasCache[cle];
    if (cache && cache.largeur === z.clientWidth) { cache.calques.forEach(function (n) { z.appendChild(n); }); return; }
    var tmp = document.createElement('div'); tmp.style.cssText = 'position:absolute;inset:0';
    z.appendChild(tmp);
    OraAquarelle.peindre(tmp, 'bas-' + cle, false);
    var calques = Array.prototype.slice.call(tmp.children);
    calques.forEach(function (n) { z.appendChild(n); });
    tmp.remove();
    merBasCache[cle] = { largeur: z.clientWidth, calques: calques };
  }

  function empiler() { etat.pile.push({ vue: etat.vue, guide: etat.guide, etape: etat.etape, bible: etat.bible, y: window.scrollY }); }
  // Revenir à la page précédente, au même endroit (les réglages changés entre-temps sont déjà appliqués).
  function revenir() {
    var p = etat.pile.pop() || { vue: 'accueil', y: 0 };
    etat.vue = p.vue; etat.guide = p.guide; etat.bible = p.bible; etat.etape = p.etape || 0; rendre();
    window.scrollTo(0, p.y || 0);
  }
  function aller(vue) { empiler(); etat.vue = vue; rendre(); window.scrollTo(0, 0); }

  function feuille(titre, corpsHtml) {
    fermerFeuille();
    var voile = document.createElement('div'); voile.className = 'voile'; voile.setAttribute('data-action', 'fermer');
    var f = document.createElement('div'); f.className = 'feuille'; f.setAttribute('role', 'dialog'); f.setAttribute('aria-modal', 'true'); f.setAttribute('aria-label', titre);
    f.innerHTML = '<div class="poignee"></div><h2>' + OraLatin.italiques(esc(titre)) + '</h2>' + OraLatin.italiques(corpsHtml) + '<div class="actions" style="margin-top:20px"><button class="bouton leger" data-action="fermer">' + esc(T('fermer')) + '</button></div>';
    document.body.appendChild(voile); document.body.appendChild(f);
    var b = f.querySelector('button'); if (b) b.focus();
  }
  function fermerFeuille() { document.querySelectorAll('.voile,.feuille').forEach(function (n) { n.remove(); }); }

  // Ouvre un passage ; « liste » (facultative) donne les versets exacts à surligner, sur un ou plusieurs chapitres.
  function ouvrirPassage(id, liste) {
    var p = id.split('|');
    var cible = { o: p[0], c: +p[1], du: +p[2], au: +p[3], c2: p[4] ? +p[4] : null, ch: p[5] ? +p[5] : null, liste: liste || null };
    empiler();
    etat.vue = 'bible-chapitre'; etat.bible = cible; rendre();
    var aller_ = function () { var el = cible.du && (!cible.ch || cible.ch === cible.c) && document.getElementById('v' + (cible.liste ? cible.liste[0][1] : cible.du)); window.scrollTo(0, el ? Math.max(0, el.getBoundingClientRect().top + window.scrollY - 140) : 0); };
    setTimeout(aller_, 30);
    if (!BIBLE || bibleLangue !== LANG) chargerBible().then(function () { setTimeout(aller_, 60); });
  }

  // Les éléments « role=button » (versets) se déclenchent aussi au clavier, avec Entrée ou Espace.
  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var el = ev.target.closest && ev.target.closest('[role="button"][data-action]');
    if (!el || el.tagName === 'BUTTON') return;
    ev.preventDefault(); el.click();
  });

  document.addEventListener('click', function (ev) {
    var el = ev.target.closest('[data-action]'); if (!el) return;
    var act = el.getAttribute('data-action'), id = el.getAttribute('data-id');
    if (act === 'mot') {
      var m = D.lexique.mots.filter(function (x) { return x.id === id; })[0];
      if (m) feuille(m.mot, '<p>' + refsSeules(m.def) + '</p>');
    } else if (act === 'auteur') {
      var au = D.auteurs[id] && (D.auteurs[id][LANG] || D.auteurs[id].fr);
      if (au) feuille(au.nom, '<p>' + refsSeules(au.bio) + '</p>');
    } else if (act === 'fermer') fermerFeuille();
    else if (act === 'haut') window.scrollTo({ top: 0, behavior: 'smooth' });
    else if (act === 'onglet') { etat.pile = []; etat.vue = id; fermerFeuille(); rendre(); window.scrollTo(0, 0); }
    else if (act === 'aller') aller(id);
    else if (act === 'priere') aller('priere:' + id);
    else if (act === 'lecture') aller('lecture:' + id);
    else if (act === 'livre') { etat.livreOuvert = etat.livreOuvert === id ? null : id; rendreEnPlace(); }
    else if (act === 'passage') { fermerFeuille(); ouvrirPassage(id); }
    else if (act === 'passage-messe') { var am = aujourdhui().messe; ouvrirPassage(id, am ? ((am.vl && am.vl[LANG]) || am.v) : null); }
    else if (act === 'passage-evangile') { var ev = evangile(aujourdhui()); ouvrirPassage(id, ev && ev.liste ? ev.liste.map(function (x) { return [x.c, x.v]; }) : null); }
    else if (act === 'chapitre') { etat.bible = Object.assign({}, etat.bible, { ch: +id }); rendre(); window.scrollTo(0, 0); }
    else if (act === 'verset') {
      var b = etat.bible, v = +id, ms = lireMarques(), i = -1;
      ms.forEach(function (x, k) { if (x.o === b.o && x.c === b.c && x.v === v) i = k; });
      if (i >= 0) ms.splice(i, 1); else ms.push({ o: b.o, c: b.c, v: v });
      ecrireMarques(ms); el.classList.toggle('marque', i < 0); el.setAttribute('aria-pressed', String(i < 0));
    }
    else if (act === 'guide') { empiler(); etat.vue = 'guide'; etat.guide = id; etat.etape = 0; rendre(); window.scrollTo(0, 0); }
    else if (act === 'etape') { etat.etape = +id; rendre(); }
    else if (act === 'retour') revenir();
    else if (act === 'bienvenue') quitterBienvenue();
    else if (act === 'reglages') { if (etat.vue === 'menu') revenir(); else aller('menu'); }
    else if (act === 'langue') {
      // Les contenus de l'autre langue sont dans leur propre fichier (déjà en cache pour le hors-ligne) : on le lit, puis on redessine.
      chargerLangue(id).then(function () {
        R.langue = id; LANG = id; ecrireReglages(); preparer(); BIBLE = null; bibleLangue = null; chargerBible().then(nettoyerMarques).catch(function () {}); rendreEnPlace();
      }).catch(function (e) { if (window.console) console.error(e); });
    }
    else if (act === 'reglage') { R[el.getAttribute('data-cle')] = id; ecrireReglages(); rendreEnPlace(); majVivant(); }
    else if (act === 'explication') {
      var a = aujourdhui(), e = a.expl || a.explSaison, nom = a.expl ? a.j.celebration.nom : a.j.saison.nom;
      // Le saint ou le sens du jour : qui l'on fête, d'où vient ce jour et ce qu'il signifie, une idée à vivre ;
      // puis, plus bas, le temps liturgique.
      var tj = !a.expl && titreDuJour(a.j), sj = '';
      if (tj && tj.ex) sj = '<div class="bloc" style="border:0;margin-top:8px;padding:0"><h3>' + esc(T('qui-est-ce')) + '</h3><p>' + lexique(tj.ex.qui) + '</p></div><div class="bloc"><h3>' + esc(T('pourquoi-ce-jour')) + '</h3><p>' + lexique(tj.ex.sens) + '</p></div><div class="bloc"><h3>' + esc(T('idee-vivre')) + '</h3><p>' + lexique(tj.ex.vivre) + '</p></div>' + (a.j.saison.id !== 'ordinaire' ? '<div class="bloc"><h3>' + esc(nom) + '</h3><p>' + lexique(e.quoi) + '</p></div>' : '');
      if (sj) feuille(tj.titre, sj); else feuille(nom, '<div class="bloc" style="border:0;margin-top:8px;padding:0"><h3>' + esc(T('ce-que-cest')) + '</h3><p>' + lexique(e.quoi) + '</p></div><div class="bloc"><h3>' + esc(T('pourquoi-important')) + '</h3><p>' + lexique(e.pourquoi) + '</p></div><div class="bloc"><h3>' + esc(T('idee-vivre')) + '</h3><p>' + lexique(e.idee) + '</p></div>');
    }
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') fermerFeuille(); });
  window.addEventListener('scroll', majDefile, { passive: true });

  // Passe au soir au coucher du soleil, et au jour suivant à 5 h, sans recharger.
  var jourAffiche = dateDuJour().toDateString();
  setInterval(function () {
    if (!D || document.querySelector('.feuille')) return;
    var change = (estNuit() ? 'nuit' : 'jour') !== dernierCiel || dateDuJour().toDateString() !== jourAffiche;
    if (change) { jourAffiche = dateDuJour().toDateString(); rendreEnPlace(); }
  }, 30000);
  // Sur iPhone, la barre de Safari se replie au défilement : la hauteur change, pas la largeur.
  // On ne repeint le ciel que si la largeur change, sinon les nuages repartiraient en arrière.
  var tempo, largeurCiel = window.innerWidth; window.addEventListener('resize', function () {
    if (window.innerWidth === largeurCiel) return;
    largeurCiel = window.innerWidth;
    clearTimeout(tempo);
    tempo = setTimeout(function () { merBasCache = {}; OraAquarelle.peindre(document.getElementById('couches'), dernierCiel, false, function () { cielPret = true; majVivant(); }); var z = document.getElementById('mer-bas'); if (z) { z.innerHTML = ''; peindreMerBas(dernierCiel); } }, 250);
  });

  // Message d'erreur affiché si les données ne se chargent pas (les textes de l'interface ne sont alors pas disponibles).
  var ERREUR = {
    fr: ['Ora n\'a pas pu s\'ouvrir', 'Les contenus ne se sont pas chargés. Vérifie ta connexion, puis ferme et rouvre l\'app.'],
    es: ['Ora no ha podido abrirse', 'Los contenidos no se han cargado. Comprueba tu conexión y vuelve a abrir la app.'],
    en: ['Ora could not open', 'The content did not load. Check your connection, then close and reopen the app.']
  };

  // ---------- Chargement des données ----------
  // Le build (outils/build.mjs) intègre à la page le noyau des données (ORA_DATA) ; les contenus de chaque langue sont
  // dans un fichier à part (ORA_DONNEES : donnees-fr.json…), lu au démarrage et mis en cache par le service worker.
  // Aucune donnée n'est écrite à la main dans index.html.
  var LANGUES_LUES = {};
  function chargerLangue(l) {
    if (LANGUES_LUES[l]) return Promise.resolve();
    var url = (window.ORA_DONNEES || {})[l];
    if (!url) return Promise.reject(new Error('ORA_DONNEES : ' + l + ' absent : lancer « npm run build »'));
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + ' : ' + r.status); return r.json(); }).then(function (d) {
      // Chaque fichier porte tous les contenus d'une langue : il remplace ceux de la langue précédente.
      Object.keys(d).forEach(function (k) { BRUT[k] = d[k]; });
      LANGUES_LUES = {}; LANGUES_LUES[l] = true;
    });
  }
  function charger() {
    if (!window.ORA_DATA) return Promise.reject(new Error('ORA_DATA absent : lancer « npm run build »'));
    BRUT = window.ORA_DATA;
    return chargerLangue(LANG);
  }
  charger().then(function () {
    preparer(); rendre();
    chargerBible().then(function () { nettoyerMarques(); if (etat.vue === 'accueil' || etat.vue === 'favoris') rendreEnPlace(); }).catch(function () {});
  }).catch(function (e) {
    if (window.console) console.error(e);
    var m = ERREUR[LANG] || ERREUR.fr;
    document.getElementById('app').innerHTML = '<section class="vue page" style="padding-top:120px"><h2>' + esc(m[0]) + '</h2><p class="chapeau">' + esc(m[1]) + '</p></section>';
  });

  // Service worker : pour toute origine HTTPS (et en local pour les tests), quel que soit l'hébergeur.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne indisponible ici */ });
  }
})();
