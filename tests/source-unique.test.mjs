// Une seule source pour chaque texte : data/ fait foi. Aucun texte destiné à l'utilisateur (une chaîne de data/)
// ne doit se trouver aussi dans outils/ (scripts, sources, guides) : sinon, corriger l'un ferait oublier l'autre.
// Les scripts d'outils/ lisent les textes dans data/ ; ils ne contiennent que des références, des identifiants et des règles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RACINE } from './aide.mjs';

const BIBLES = new Set(['bible.json', 'bible-es.json', 'bible-en.json']);
const MIN = 20; // en dessous, ce sont des noms, des références ou des mots isolés
// Un texte : des mots séparés par des espaces ; ni un identifiant (« immaculee-conception »), ni une référence biblique.
const estTexte = (s) => s.length >= MIN && /\s/.test(s) && /\p{Ll}/u.test(s) && !/^[1-3]?\s?\p{Lu}\p{Ll}*\.?\s+\d+\s*[,:]/u.test(s);

function chaines(x, sortie, cle = '') {
  if (typeof x === 'string') { if (cle !== '_note' && estTexte(x)) sortie.push(x); }
  else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) chaines(v, sortie, k);
  return sortie;
}
// Les chaînes écrites dans un fichier d'outils/ : valeurs JSON, littéraux Python ou JavaScript, lignes d'un guide.
export function litteraux(fichier, texte) {
  const out = new Set();
  if (fichier.endsWith('.json')) {
    const j = JSON.parse(texte);
    // Relevé d'un tiers, gardé tel quel pour la traçabilité (clé « _source » : par exemple l'API de l'AELF) :
    // ses libellés ne sont pas des textes d'Ora, et rien n'en est affiché.
    if (j._source) return out;
    for (const s of chaines(j, [])) out.add(s); return out;
  }
  if (fichier.endsWith('.md')) { for (const l of texte.split('\n')) out.add(l.trim()); return out; }
  for (const m of texte.matchAll(/"((?:\\.|[^"\\\n])*)"|'((?:\\.|[^'\\\n])*)'|`((?:\\.|[^`\\])*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3]).replace(/\\n/g, '\n').replace(/\\(['"`\\])/g, '$1');
    out.add(s);
  }
  return out;
}
function fichiers(dossier) {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) return e.name === 'tmp' ? [] : fichiers(p);
    return /\.(py|mjs|js|json|md)$/.test(e.name) ? [p] : [];
  });
}
export function doublons(textesData, outils) {
  const out = [];
  for (const [f, set] of outils) for (const s of textesData) if (set.has(s)) out.push(`${path.relative(RACINE, f)} : « ${s.slice(0, 60)}… »`);
  return out;
}

const data = [...fs.readdirSync(path.join(RACINE, 'data')).filter((f) => f.endsWith('.json') && !BIBLES.has(f)).map((f) => path.join(RACINE, 'data', f)),
  ...fs.readdirSync(path.join(RACINE, 'data/i18n')).map((f) => path.join(RACINE, 'data/i18n', f))];
const TEXTES = [...new Set(data.flatMap((f) => chaines(JSON.parse(fs.readFileSync(f, 'utf8')), [])))];
const OUTILS = fichiers(path.join(RACINE, 'outils')).map((f) => [f, litteraux(f, fs.readFileSync(f, 'utf8'))]);

test('aucun texte de data/ ne se trouve aussi dans outils/', () => {
  assert.ok(TEXTES.length > 5000, `textes de data/ : ${TEXTES.length}`);
  assert.deepEqual(doublons(TEXTES, OUTILS), []);
});

test('un texte recopié dans un script est repéré', () => {
  const t = TEXTES.find((s) => s.length > 60 && !s.includes("'") && !s.includes('\n'));
  const faux = [[path.join(RACINE, 'outils/faux.py'), litteraux('faux.py', `X = {'fr': '${t}'}`)]];
  assert.equal(doublons(TEXTES, faux).length, 1);
});
