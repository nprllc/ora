// Le cœur de chaque Évangile : une référence connue du lectionnaire, un extrait non vide et court,
// et tout passage de plus de 5 versets a le sien.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lect = JSON.parse(fs.readFileSync(new URL('../data/lectionnaire.json', import.meta.url))).cles;
const { coeurs } = JSON.parse(fs.readFileSync(new URL('../data/coeur-evangile.json', import.meta.url)));
const parRef = {};
for (const e of Object.values(lect)) parRef[e.ref] = e;

test('chaque cœur désigne un passage du lectionnaire et un extrait de 1 à 7 versets', () => {
  for (const [ref, [i, j]] of Object.entries(coeurs)) {
    const e = parRef[ref];
    assert.ok(e, `référence inconnue : ${ref}`);
    const n = Math.max(e.v.length, ...Object.values(e.vl || {}).map((l) => l.length)); // l'app ramène l'extrait dans chaque langue
    assert.ok(i >= 0 && j > i && j <= n, `bornes hors du passage : ${ref}`);
    assert.ok(j - i <= 7, `extrait trop long : ${ref}`);
  }
});

test('tout passage de plus de 5 versets a son cœur', () => {
  for (const [ref, e] of Object.entries(parRef)) if (e.v.length > 5) assert.ok(coeurs[ref], `sans cœur : ${ref}`);
});
