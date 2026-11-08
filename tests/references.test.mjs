// Références bibliques : chaque référence écrite dans un texte d'Ora (entre parenthèses ou en source)
// doit être reconnue, donc cliquable, dans les trois langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { RACINE, lireJson } from './aide.mjs';

const require = createRequire(import.meta.url);
const R = require(path.join(RACINE, 'src/js/references.js'));
const ABR = lireJson('data/abreviations.json');
const LIVRES = { fr: lireJson('data/bible.json'), es: lireJson('data/bible-es.json'), en: lireJson('data/bible-en.json') };

test('formes reconnues', () => {
  const vu = (t, l = 'fr') => R.trouver(t, ABR[l], l).map((r) => t.slice(r.debut, r.fin));
  assert.deepEqual(vu('(Mt 9, 9)'), ['Mt 9, 9']);
  assert.deepEqual(vu('le Notre Père (Mt 5-7).'), ['Mt 5-7']);
  assert.deepEqual(vu('(Os 1, 1 ; 7, 14)'), ['Os 1, 1', '7, 14']);
  assert.deepEqual(vu('(Mt 5, 3.8)'), ['Mt 5, 3.8']);
  assert.deepEqual(vu('(Mi 6, 8a)'), ['Mi 6, 8a']);
  assert.deepEqual(R.trouver('(Mt 9, 35 – 10, 1)', ABR.fr, 'fr').map((r) => [r.c, r.v1, r.c2, r.v2]), [[9, 35, 10, 1]]); // sur deux chapitres
  assert.deepEqual(R.trouver('(Lc 2, 29-32)', ABR.fr, 'fr').map((r) => [r.c, r.v1, r.c2, r.v2]), [[2, 29, undefined, 32]]);
  assert.deepEqual(vu('(Lk 2:29-32)', 'en'), ['Lk 2:29-32']);
  assert.deepEqual(vu('(Sal 130, 1-2)', 'es'), ['Sal 130, 1-2']);
  assert.deepEqual(vu('Catéchisme, n° 1032'), []);
  assert.deepEqual(R.trouver('(Phm 16)', ABR.fr, 'fr').map((r) => [r.c, r.v1]), [[1, 16]]);
});

// Un « candidat » : dans une parenthèse ou une source, un nom de livre suivi d'un chiffre (« Jn 11, 35 », « Mt 5-7 »).
const CANDIDAT = /(?:^|[(;\s])((?:[1-3]\s?)?[A-ZÉ][a-zéèëôûï]{0,14}\.?)\s+(\d+)(?:\s*[,:]\s*\d+|\s*[-–]\s*\d+|(?=\s*[);.]))/gu;
const PAS_DES_LIVRES = new Set(['Lumen', 'Benoît', 'Jean-Paul', 'Pie', 'Léon', 'Paul', 'Grégoire', 'Boniface', 'Louis', 'Sermon', 'Homélie', 'Homily', 'Homilía', 'Confessions', 'Confesiones', 'Book', 'Livre', 'Libro', 'Chapitre', 'Chapter', 'Capítulo', 'Capitulo', 'Vers', 'Hacia', 'Around', 'Since', 'Depuis', 'Desde', 'Avant', 'After', 'Après', 'Before', 'Antes', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);

function textes(objet, chemin, sortie) {
  if (typeof objet === 'string') sortie.push([chemin, objet]);
  else if (objet && typeof objet === 'object') for (const [k, v] of Object.entries(objet)) textes(v, chemin + '.' + k, sortie);
  return sortie;
}

test('toutes les références des textes d\'Ora sont cliquables, dans les trois langues', () => {
  const fichiers = ['data/contenus.json', 'data/explications.json', 'data/lexique.json', 'data/conseils.json', 'data/prieres.json', 'data/livres-resumes.json',
    'data/auteurs.json', 'data/guide-famille.json', 'data/i18n/es.json', 'data/i18n/en.json', 'data/i18n/ui.json', 'data/prieres-jour.json'];
  const oublis = [];
  for (const f of fichiers) {
    for (const [chemin, t] of textes(lireJson(f), f, [])) {
      const l = /(^|\.)(es)(\.|$)/.test(chemin) || f.endsWith('/es.json') ? 'es' : /(^|\.)(en)(\.|$)/.test(chemin) || f.endsWith('/en.json') ? 'en' : 'fr';
      const trouves = R.trouver(t, ABR[l], l);
      let m; CANDIDAT.lastIndex = 0;
      while ((m = CANDIDAT.exec(t))) {
        const livre = m[1].replace(/\.$/, '');
        if (PAS_DES_LIVRES.has(livre) && !ABR[l][livre]) continue;
        const pos = m.index + m[0].indexOf(m[1]);
        if (!trouves.some((r) => r.debut <= pos && pos < r.fin)) oublis.push(`${chemin} [${l}] : « ${t.slice(pos, pos + 16)} »`);
      }
      for (const r of trouves) {
        const b = LIVRES[l].livres.find((x) => x.osis === r.osis);
        if (!b || !b.ch[r.c - 1] || (r.v1 && !b.ch[r.c - 1][r.v1 - 1]) || (r.v2 && !b.ch[r.c - 1][r.v2 - 1]) || (r.c2 && !b.ch[r.c2 - 1])) oublis.push(`${chemin} [${l}] : référence vers un passage absent « ${t.slice(r.debut, r.fin)} »`);
      }
    }
  }
  assert.deepEqual(oublis, []);
});
