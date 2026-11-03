// Le titre du jour (data/jours.json) : un titre pour chacun des 366 jours, court, sans injonction.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const jours = JSON.parse(readFileSync(new URL('../data/jours.json', import.meta.url))).fr;

test('jours : un titre et une phrase pour chacun des 366 jours', () => {
  for (let t = Date.UTC(2024, 0, 1); t < Date.UTC(2025, 0, 1); t += 864e5) {
    const k = new Date(t).toISOString().slice(5, 10), x = jours[k];
    assert.ok(Array.isArray(x) && x.length === 2, `jour ${k} absent`);
    assert.ok(x[0].length > 2 && x[0].length <= 50, `titre trop long : ${k}`);
    assert.ok(x[1].length > 10 && x[1].length <= 140, `phrase trop longue : ${k}`);
    assert.match(x[1], /[.!?»)]$/, `phrase sans point final : ${k}`);
    assert.doesNotMatch(x[1], /\b(tu dois|vous devez|il faut)\b/i, k);
  }
  assert.equal(Object.keys(jours).length, 366);
});

test('jours : jamais deux fois le même titre', () => {
  const vus = new Set();
  for (const [k, [t]] of Object.entries(jours)) { assert.ok(!vus.has(t), `doublon ${t} (${k})`); vus.add(t); }
});
