// Documentation : chaque fichier de data/ décrit sa forme dans une « _note » et figure dans la carte des données
// du README (rôle, écran, qui l'écrit, comment ajouter un élément) ; CONTRIBUTING renvoie aux guides d'écriture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RACINE } from './aide.mjs';

const FICHIERS = [...fs.readdirSync(path.join(RACINE, 'data')).filter((f) => f.endsWith('.json')),
  ...fs.readdirSync(path.join(RACINE, 'data/i18n')).filter((f) => f.endsWith('.json')).map((f) => 'i18n/' + f)];
const README = fs.readFileSync(path.join(RACINE, 'README.md'), 'utf8');
const CARTE = README.slice(README.indexOf('## Les données'), README.indexOf('\n## ', README.indexOf('## Les données') + 5));

test('chaque fichier de data/ a une « _note »', () => {
  const sans = [];
  for (const f of FICHIERS) {
    const d = JSON.parse(fs.readFileSync(path.join(RACINE, 'data', f), 'utf8'));
    if (typeof d._note !== 'string' || d._note.trim().length < 40) sans.push(f);
  }
  assert.deepEqual(sans, []);
});

test('chaque fichier de data/ figure dans la carte des données du README', () => {
  assert.ok(CARTE.length > 1000, 'section « Les données » du README');
  const lignes = CARTE.split('\n').filter((l) => l.startsWith('| `'));
  const absents = FICHIERS.filter((f) => !lignes.some((l) => l.split('|')[1].includes('`' + f + '`')));
  assert.deepEqual(absents, []);
  // Chaque ligne a ses cinq colonnes remplies : fichier, rôle, écran, qui l'écrit, ajouter un élément.
  for (const l of lignes) assert.equal(l.split('|').length, 7, l.slice(0, 60));
  // Et le README ne cite pas de fichier de données qui n'existe plus.
  for (const l of lignes) for (const m of l.split('|')[1].matchAll(/`([^`]+\.json)`/g)) assert.ok(FICHIERS.includes(m[1]), `${m[1]} cité mais absent`);
});

test('CONTRIBUTING dit que data/ fait foi et renvoie au guide de la bibliothèque', () => {
  const c = fs.readFileSync(path.join(RACINE, 'CONTRIBUTING.md'), 'utf8');
  assert.match(c, /data\/` fait foi/);
  assert.match(c, /outils\/sources\/bibliotheque\/GUIDE\.md/);
  assert.ok(fs.existsSync(path.join(RACINE, 'outils/sources/bibliotheque/GUIDE.md')));
});
