/*
 * Ora — repérage des références bibliques dans un texte, pour les rendre cliquables.
 * Formes reconnues (abréviations et noms de livres de la langue, data/abreviations.json) :
 *   « Mt 9, 9 », « Lc 2, 29-32 », « Jn 6:35 » (anglais), « Mi 6, 8a »,
 *   les suites dans le même livre : « Os 1, 1 ; 7, 14 », « Mt 5, 3.8 »,
 *   les chapitres seuls : « Mt 5-7 », « Ps 23 » (seulement suivis d'une ponctuation ou d'une parenthèse fermante).
 * Chaque référence trouvée donne { debut, fin, osis, c, v1, v2 } (v1 = 0 : chapitre entier).
 * Utilisé par src/js/app.js et par les tests (tests/references.test.mjs).
 */
(function (global) {
  'use strict';
  var caches = {};
  // Livres d'un seul chapitre : « Phm 16 » désigne le verset 16.
  var UN_CHAPITRE = { Obad: 1, Phlm: 1, '2John': 1, '3John': 1, Jude: 1 };

  function motif(abr) {
    var noms = Object.keys(abr).sort(function (a, b) { return b.length - a.length; })
      .map(function (n) { return n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    return new RegExp('(^|[^\\p{L}\\d])(' + noms.join('|') + ')\\.?\\s+(\\d+)(?:\\s*(?:,|:)\\s*(\\d+)[a-e]?(?:\\s*[-–]\\s*(\\d+)[a-e]?)?|\\s*[-–]\\s*(\\d+)(?=\\s*[),;.]|$)|(?=\\s*[),;.]|$))', 'gu');
  }

  function trouver(texte, abr, cle) {
    if (!abr) return [];
    var re = caches[cle] || (caches[cle] = motif(abr));
    var out = [], m;
    re.lastIndex = 0;
    while ((m = re.exec(texte))) {
      var osis = abr[m[2]], debut = m.index + m[1].length, fin = re.lastIndex;
      if (m[4]) out.push({ debut: debut, fin: fin, osis: osis, c: +m[3], v1: +m[4], v2: m[5] ? +m[5] : +m[4] });
      else if (UN_CHAPITRE[osis]) out.push({ debut: debut, fin: fin, osis: osis, c: 1, v1: +m[3], v2: m[6] ? +m[6] : +m[3] });
      else out.push({ debut: debut, fin: fin, osis: osis, c: +m[3], v1: 0, v2: 0, c2: m[6] ? +m[6] : null });
      if (!m[4]) continue;
      // Suites dans le même livre : « ; 7, 14 » ou « . 8 » (verset du même chapitre).
      var reste = texte.slice(fin), suite, chap = +m[3], decale = fin;
      var reSuite = /^(\s*;\s*(\d+)\s*(?:,|:)\s*(\d+)[a-e]?(?:\s*[-–]\s*(\d+)[a-e]?)?|\.(\d+)[a-e]?(?:\s*[-–]\s*(\d+)[a-e]?)?)/;
      while ((suite = reSuite.exec(reste))) {
        var tout = suite[0], blanc = (tout.match(/^\s*;\s*/) || [''])[0];
        if (!suite[2]) { out[out.length - 1].fin = decale + tout.length; } // « Mt 5, 3.8 » : un seul lien, qui ouvre au premier verset
        else {
          var c = +suite[2], v1 = +suite[3], v2 = suite[4] ? +suite[4] : v1;
          out.push({ debut: decale + blanc.length, fin: decale + tout.length, osis: osis, c: c, v1: v1, v2: v2 });
        }
        chap = suite[2] ? +suite[2] : chap; decale += tout.length; reste = reste.slice(tout.length);
      }
      re.lastIndex = decale;
    }
    return out;
  }

  var api = { trouver: trouver };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.OraReferences = api;
})(this);
