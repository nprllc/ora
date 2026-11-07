import test from 'node:test';
import assert from 'node:assert/strict';
import { lireJson } from './aide.mjs';

const { personnages } = lireJson('data/famille-personnages.json');

test('Personnage du jour : chaque personnage est raconté en français, espagnol et anglais', () => {
  const ids = new Set();
  for (const p of personnages) {
    assert.ok(!ids.has(p.id), `doublon ${p.id}`); ids.add(p.id);
    for (const l of ['fr', 'es', 'en']) {
      const x = p[l]; assert.ok(x, `${p.id} : ${l} manquant`);
      assert.ok(x.nom && x.nom.length <= 40, `${p.id} ${l} : nom`);
      assert.ok(x.histoire.length > 150 && x.histoire.length < 520, `${p.id} ${l} : histoire de ${x.histoire.length} signes`);
      assert.ok(x.idee && x.idee.length > 20, `${p.id} ${l} : idée`);
      if (l === 'fr') assert.doesNotMatch((x.histoire + ' ' + x.idee).replace(/«[^»]*»/g, ''), /\bil faut\b|\btu dois\b/i, p.id);
    }
  }
});

test('Personnage du jour : chaque temps fort a ses personnages, et le reste de l\'année en a assez', () => {
  for (const t of ['avent', 'noel', 'careme', 'paques']) assert.ok(personnages.some((p) => (p.temps || []).includes(t)), t);
  assert.ok(personnages.filter((p) => !p.temps).length >= 25);
});
