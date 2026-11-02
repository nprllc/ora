/*
 * Ora — le latin en italique (règle typographique : un mot ou une locution latine non francisée est en italique).
 * Deux sortes de latin dans les textes d'Ora :
 *   1. des locutions et des titres latins, reconnus partout (« Memento mori », « Angele Dei », « De profundis »…) ;
 *   2. des mots cités pour leur étymologie (« caro », « ordo », « laus »…), mis en italique seulement près
 *      du mot « latin » (latín, Latin), pour ne pas toucher un mot espagnol ou anglais identique (« caro »).
 * Les mots latins passés dans la langue restent droits : Credo, Gloria, Magnificat, Alléluia, Amen, Angélus.
 * Le texte reçu est du HTML : on ne touche qu'au texte, jamais aux balises ni aux attributs.
 * Utilisé par src/js/app.js et par les tests (tests/latin.test.mjs).
 */
(function (global) {
  'use strict';
  var LOCUTIONS = ['Memento mori', 'Angele Dei', 'Benedic, Domine', 'Requiem æternam', 'Requiem aeternam', 'De profundis',
    'Regina Caeli', 'Regina Coeli', 'Salve Regina', 'Sub tuum praesidium', 'Te Deum', 'Veni Creator', 'Veni Sancte Spiritus',
    'Nunc dimittis', 'Deus caritas est', 'Lumen gentium', 'Lumen Gentium', 'Spe salvi', 'Laudato si’', 'Evangelii gaudium',
    'mortem cotidie ante oculos suspectam habere', 'Verbum caro factum est', 'Ora et labora', 'Corpus Christi'];
  var CITES = ['adventus', 'caro', 'laus', 'ordo', 'vesper', 'cor', 'misericordia', 'credo', 'hostia', 'sacramentum', 'ecclesia'];
  var echappe = function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
  var reLoc = new RegExp('(^|[^\\p{L}])(' + LOCUTIONS.sort(function (a, b) { return b.length - a.length; }).map(echappe).join('|') + ')(?![\\p{L}])', 'gu');
  var reCite = new RegExp('(^|[^\\p{L}])(' + CITES.join('|') + ')(?![\\p{L}])', 'gu');
  var reLatin = /\blat[ií]n[ae]?\b/i;

  function texte(t) {
    t = t.replace(reLoc, '$1<i lang="la">$2</i>');
    if (!reLatin.test(t)) return t;
    // Les mots cités : seulement à moins de 60 signes d'une mention du latin, et hors d'une locution déjà marquée.
    var out = '', dernier = 0, m;
    reCite.lastIndex = 0;
    while ((m = reCite.exec(t))) {
      var debut = m.index + m[1].length, avant = t.slice(Math.max(0, debut - 60), debut), apres = t.slice(debut, debut + 60 + m[2].length);
      var dansI = t.lastIndexOf('<i', debut) > t.lastIndexOf('</i>', debut);
      if (dansI || !(reLatin.test(avant) || reLatin.test(apres))) continue;
      out += t.slice(dernier, debut) + '<i lang="la">' + m[2] + '</i>'; dernier = debut + m[2].length;
    }
    return out + t.slice(dernier);
  }

  // Applique la règle au texte d'un fragment HTML, en laissant les balises intactes.
  function italiques(html) {
    return String(html).split(/(<[^>]*>)/).map(function (bout, i) { return i % 2 ? bout : texte(bout); }).join('');
  }

  var api = { italiques: italiques };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.OraLatin = api;
})(this);
