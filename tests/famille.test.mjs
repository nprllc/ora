// « En famille » : l'Évangile des enfants et le personnage du jour suivent le temps liturgique, un élément par jour.
// Dans les temps forts, rien ne revient dans l'année ; dans le temps ordinaire, le rang du jour (semaine et jour)
// choisit l'élément. Même choix que src/js/app.js (rangSaison, rangOrdinaire, evangileEnfant, personnageDuJour).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, FETES, dates, lireJson } from './aide.mjs';
import { versets as lireRef } from '../outils/references.mjs';

const E = lireJson('data/evangiles-enfants.json');
const BIB = Object.fromEntries(lireJson('data/bible.json').livres.map((b) => [b.osis, b]));
const rangSaison = (j) => {
  const s = j.saison.id, k = j.date.slice(5);
  if (s === 'avent' && k >= '12-17') return 20 + (+k.slice(3) - 17);
  return (s === 'triduum' ? 43 : 0) + (j.jourSaison || 0);
};
const annee = [...dates([2025, 0, 1], [2060, 11, 31])].map((d) => L.jour(d, FETES));

test('Évangile des enfants : un passage par jour des temps forts (Avent 28, Noël 20, Carême et Triduum 46, Pâques 50)', () => {
  assert.equal(E.avent.length, 28); assert.ok(E.noel.length >= 20); assert.equal(E.careme.length, 46); assert.ok(E.paques.length >= 50);
  assert.ok(E.ordinaire.length >= 150, `${E.ordinaire.length} passages pour le temps ordinaire`);
  for (const j of annee) {
    const s = j.saison.id;
    if (s === 'ordinaire') { assert.ok(j.jourOrdinaire >= 1 && j.jourOrdinaire <= 237, j.date); continue; }
    const pool = E[s === 'triduum' ? 'careme' : s], n = rangSaison(j);
    assert.ok(n < pool.length, `${j.date} (${s}) : rang ${n} au-delà de la liste`);
  }
});

test('Évangile des enfants : trois titres, et aucun verset dans deux passages', () => {
  const vus = new Map();
  for (const [k, v] of Object.entries(E)) if (Array.isArray(v)) for (const [ref, t] of v) {
    for (const l of ['fr', 'es', 'en']) assert.ok(t[l], `${ref} : titre ${l}`);
    const { osis, liste } = lireRef(ref, BIB, true);
    for (const [c, x] of liste) {
      const cle = `${osis} ${c}, ${x}`;
      assert.ok(!vus.has(cle), `${cle} : dans ${vus.get(cle)} et ${ref}`); vus.set(cle, ref);
    }
  }
});

test('Le temps ordinaire : chaque jour a son rang, jamais deux fois le même dans l\'année', () => {
  const parAn = new Map();
  for (const j of annee) if (j.saison.id === 'ordinaire') {
    const a = j.date.slice(0, 4), vu = parAn.get(a) || new Set();
    assert.ok(!vu.has(j.jourOrdinaire), `${j.date} : rang ${j.jourOrdinaire} déjà pris`); vu.add(j.jourOrdinaire); parAn.set(a, vu);
  }
});
