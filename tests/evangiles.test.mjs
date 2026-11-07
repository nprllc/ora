// L'Évangile du jour d'Ora (data/evangiles.json) : des passages complets et titrés, sans verset en double,
// et, hors temps ordinaire, jamais deux fois le même passage dans l'année.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, FETES, dates, lireJson } from './aide.mjs';

const E = lireJson('data/evangiles.json');
// Même choix que src/js/app.js, evangileOra() ; renvoie la référence (préfixée « ord: » pour le temps ordinaire).
function choix(j) {
  const f = j.celebration && E.fetes[j.celebration.id]; if (f) return f[0];
  const s = j.saison.id, k = j.date.slice(5), n = j.jourSaison, Ls = E[s];
  if (s === 'avent') return (k >= '12-17' ? E.aventFin[Math.min(+k.slice(3) - 17, E.aventFin.length - 1)] : E.avent[n % E.avent.length])[0];
  if (Ls && n != null && s !== 'ordinaire') return Ls[Math.min(n, Ls.length - 1)][0];
  const js = new Date(j.date + 'T12:00:00Z').getUTCDay();
  return 'ord:' + E.ordinaire[(((j.semaine || 1) - 1) * 7 + js) % E.ordinaire.length][0];
}

test('évangiles : chaque passage a un titre, et aucun verset ne figure dans deux passages', () => {
  const tous = [...Object.values(E.fetes), ...Object.values(E).filter(Array.isArray).flat()];
  assert.ok(tous.length >= 320, `${tous.length} passages`);
  const vus = new Map();
  for (const [ref, titre] of tous) {
    assert.ok(titre && titre.length >= 3 && titre.length <= 60, `${ref} : titre`);
    const m = ref.match(/^(\w+) (\d+), (\d+)(?:-(\d+))?$/);
    assert.ok(m, ref);
    for (let v = +m[3]; v <= +(m[4] || m[3]); v++) {
      const k = `${m[1]} ${m[2]}, ${v}`;
      assert.ok(!vus.has(k), `${k} : dans ${ref} et ${vus.get(k)}`);
      vus.set(k, ref);
    }
  }
});

test("évangiles : chaque jour a son passage ; hors temps ordinaire, jamais deux fois le même dans l'année (2026-2032)", () => {
  for (let y = 2026; y <= 2032; y++) {
    const vus = new Map();
    for (const d of dates([y, 0, 1], [y, 11, 31])) { // du 1er janvier au 31 décembre (mois comptés de 0)
      const r = choix(L.jour(d, FETES));
      assert.ok(r, `${d} : aucun passage`);
      if (r.startsWith('ord:')) continue; // le temps ordinaire, plus long que sa liste, peut revenir à un passage
      assert.ok(!vus.has(r), `${d} : ${r} déjà donné le ${vus.get(r)}`);
      vus.set(r, d);
    }
  }
});
