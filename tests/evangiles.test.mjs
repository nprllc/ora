// L'Évangile du jour d'Ora (data/evangiles.json) : un passage pour chaque jour, jamais deux fois le même dans l'année.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, FETES, dates, lireJson } from './aide.mjs';

const E = lireJson('data/evangiles.json');
// Même choix que src/js/app.js, evangileOra().
function choix(j) {
  const f = j.celebration && E.fetes[j.celebration.id]; if (f) return f;
  const s = j.saison.id, k = j.date.slice(5), n = j.jourSaison, Ls = E[s];
  if (s === 'avent') return k >= '12-17' ? E.aventFin[Math.min(+k.slice(3) - 17, E.aventFin.length - 1)] : E.avent[n % E.avent.length];
  if (Ls && n != null && s !== 'ordinaire') return Ls[Math.min(n, Ls.length - 1)];
  const js = new Date(j.date + 'T12:00:00Z').getUTCDay();
  return E.ordinaire[(((j.semaine || 1) - 1) * 7 + js) % E.ordinaire.length];
}

test('évangiles : au moins 365 passages, tous différents', () => {
  const tous = Object.values(E).filter(Array.isArray).flat();
  assert.ok(tous.length >= 365, `${tous.length} passages`);
  assert.equal(new Set(tous).size, tous.length, 'un passage figure deux fois');
});

test('évangiles : chaque jour a son passage, sans répétition dans une même année (2026-2032)', () => {
  for (let y = 2026; y <= 2032; y++) {
    const vus = new Map();
    for (const d of dates([y, 0, 1], [y, 11, 31])) { // du 1er janvier au 31 décembre (mois comptés de 0)
      const r = choix(L.jour(d, FETES));
      assert.ok(r, `${d} : aucun passage`);
      assert.ok(!vus.has(r), `${d} : ${r} déjà donné le ${vus.get(r)}`);
      vus.set(r, d);
    }
  }
});
