// Toute référence biblique repérée dans un texte de data/ (par src/js/references.js, comme dans l'app) doit mener
// à des versets qui existent, verset par verset, dans la Bible de la langue du texte.
// Les fichiers sans langue (Évangiles du jour, lectionnaire, cœurs) donnent des références dans la numérotation
// moderne : elles sont lues dans les trois Bibles à travers outils/sources/versification.mjs, comme le fait le build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RACINE, lireJson } from './aide.mjs';
import VERSIF from '../outils/sources/versification.mjs';

const require = createRequire(import.meta.url);
const R = require(path.join(RACINE, 'src/js/references.js'));
const ABR = lireJson('data/abreviations.json');
const LIVRES = Object.fromEntries(Object.entries({ fr: 'bible.json', es: 'bible-es.json', en: 'bible-en.json' })
  .map(([l, f]) => [l, Object.fromEntries(lireJson('data/' + f).livres.map((b) => [b.osis, b]))]));
// Fichiers sans langue : leurs références sont écrites à la française, dans la numérotation moderne.
const NEUTRES = new Set(['evangiles.json', 'evangiles-enfants.json', 'coeur-evangile.json', 'lectionnaire.json']);
// Fichiers sans texte : les Bibles elles-mêmes, et la table des abréviations.
const SANS_TEXTE = new Set(['bible.json', 'bible-es.json', 'bible-en.json', 'abreviations.json']);

function textes(objet, chemin, sortie) {
  if (typeof objet === 'string') sortie.push([chemin, objet]);
  else if (objet && typeof objet === 'object') for (const [k, v] of Object.entries(objet)) textes(v, chemin + '.' + k, sortie);
  return sortie;
}
const langueDe = (f, chemin) => /\.es(\.|$)/.test(chemin) || f.endsWith('/es.json') ? 'es' : /\.en(\.|$)/.test(chemin) || f.endsWith('/en.json') ? 'en' : 'fr';

// Les versets désignés par une référence trouvée : [chapitre, verset] dans la numérotation écrite.
// Sur deux chapitres (« Mt 9, 35 – 10, 1 ») : du verset v1 à la fin du chapitre c, puis du début de c2 au verset v2.
function versetsDe(r, b) {
  const out = [];
  if (!r.v1) { for (let c = r.c; c <= (r.c2 || r.c); c++) out.push([c, 0]); return out; }
  if (r.c2 && r.c2 !== r.c) {
    out.push([r.c, r.v1]);
    for (let v = r.v1 + 1; v <= ((b.ch[r.c - 1] || []).length); v++) out.push([r.c, v]);
    for (let v = 1; v <= r.v2; v++) out.push([r.c2, v]);
    return out;
  }
  for (let v = r.v1; v <= r.v2; v++) out.push([r.c, v]); return out;
}
// Les problèmes d'un texte : liste vide si chaque verset existe.
export function problemes(t, l, neutre = false) {
  const out = [];
  for (const r of R.trouver(t, ABR[l], l)) {
    const vu = t.slice(r.debut, r.fin);
    for (const lb of neutre ? ['fr', 'es', 'en'] : [l]) {
      const b = LIVRES[lb][r.osis];
      if (!b) { out.push(`« ${vu} » : livre ${r.osis} absent (${lb})`); continue; }
      if (!(r.c2 > r.c) && r.v2 < r.v1) out.push(`« ${vu} » : intervalle à l'envers`);
      for (const [c, v] of versetsDe(r, b)) {
        const cibles = neutre ? (VERSIF[lb][`${r.osis}.${c}.${v}`] || [[c, v]]) : [[c, v]];
        for (const [cc, vv] of cibles) if (!b.ch[cc - 1] || (vv && !b.ch[cc - 1][vv - 1])) out.push(`« ${vu} » : ${r.osis} ${cc}, ${vv || '*'} absent (${lb})`);
      }
    }
  }
  return out;
}

test('chaque référence biblique des textes de data/ mène à des versets qui existent dans la Bible de sa langue', () => {
  const fichiers = [...fs.readdirSync(path.join(RACINE, 'data')).filter((f) => f.endsWith('.json')).map((f) => 'data/' + f),
    ...fs.readdirSync(path.join(RACINE, 'data/i18n')).filter((f) => f.endsWith('.json')).map((f) => 'data/i18n/' + f)];
  const erreurs = []; let n = 0;
  for (const f of fichiers) {
    if (SANS_TEXTE.has(path.basename(f))) continue;
    const neutre = NEUTRES.has(path.basename(f));
    for (const [chemin, t] of textes(lireJson(f), f, [])) {
      const l = langueDe(f, chemin);
      n += R.trouver(t, ABR[l], l).length;
      for (const p of problemes(t, l, neutre)) erreurs.push(`${chemin} [${l}] ${p}`);
    }
  }
  assert.ok(n > 500, `références repérées : ${n}`);
  assert.deepEqual(erreurs, []);
});

test('une référence volontairement fausse est refusée', () => {
  assert.deepEqual(problemes('(Mc 4, 37-40)', 'fr', true), []);
  assert.deepEqual(problemes('(Mc 4, 37-41)', 'fr', true), [], 'Mc 4, 41 est lu comme 4, 40 (versification.mjs)');
  assert.ok(problemes('(Mc 4, 37-41)', 'fr', false).length > 0, 'sans la correspondance, Mc 4, 41 n\'existe pas dans la Crampon');
  assert.ok(problemes('Comme dit Jésus (Jn 3, 99).', 'fr').length > 0);
  assert.ok(problemes('(Lc 25, 1)', 'fr').length > 0, 'chapitre absent');
  assert.ok(problemes('(Mt 5, 3-60)', 'fr').length > 0, 'fin d\'intervalle absente');
  assert.ok(problemes('(Jn 3:99)', 'en').length > 0);
  assert.ok(problemes('(Jn 3, 99)', 'es').length > 0);
  assert.deepEqual(problemes('Mt 9, 35 – 10, 1', 'fr', true), [], 'sur deux chapitres');
  assert.ok(problemes('Mt 9, 35 – 10, 99', 'fr', true).length > 0);
});
