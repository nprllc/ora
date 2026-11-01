// Moteur du calendrier liturgique : Pâques, reports, cycles, régions, robustesse.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, FETES, dates } from './aide.mjs';

const jour = (d, region = 'fr') => { L.region(region); return L.jour(d, FETES); };
const fete = (d, region) => { const j = jour(d, region); return j.celebration && j.celebration.id; };

test('Pâques de 2024 à 2040 (dates publiées)', () => {
  // Dates de Pâques (calendrier grégorien), d'après les tables de l'Observatoire naval des États-Unis.
  const attendu = { 2024: '03-31', 2025: '04-20', 2026: '04-05', 2027: '03-28', 2028: '04-16', 2029: '04-01', 2030: '04-21', 2031: '04-13', 2032: '03-28',
    2033: '04-17', 2034: '04-09', 2035: '03-25', 2036: '04-13', 2037: '04-05', 2038: '04-25', 2039: '04-10', 2040: '04-01' };
  for (const [y, md] of Object.entries(attendu)) assert.equal(L.paques(+y), `${y}-${md}`, `Pâques ${y}`);
});

test('Immaculée Conception : reportée au lundi quand le 8 décembre est un dimanche', () => {
  assert.notEqual(fete('2024-12-08'), 'immaculee-conception');
  assert.equal(fete('2024-12-09'), 'immaculee-conception');
  assert.equal(fete('2030-12-09'), 'immaculee-conception');
  assert.equal(fete('2025-12-08'), 'immaculee-conception');
});

test('Annonciation : reportée au lundi après le 2e dimanche de Pâques si elle tombe dans la Semaine sainte ou l\'octave', () => {
  assert.equal(fete('2024-04-08'), 'annonciation'); // 25 mars 2024 = lundi saint
  assert.equal(fete('2027-04-05'), 'annonciation'); // 25 mars 2027 = jeudi saint
  assert.equal(fete('2026-03-25'), 'annonciation');
  assert.notEqual(fete('2024-03-25'), 'annonciation');
});

test('Saint Joseph : lundi si le 19 mars est un dimanche de Carême, samedi avant les Rameaux s\'il tombe dans la Semaine sainte', () => {
  assert.equal(fete('2028-03-20'), 'joseph'); // 19 mars 2028 = 4e dimanche de Carême
  assert.equal(fete('2035-03-17'), 'joseph'); // 19 mars 2035 = lundi saint
  assert.equal(fete('2027-03-19'), 'joseph');
});

test('Saint Jean-Baptiste : la veille quand le 24 juin est le Sacré-Cœur', () => {
  assert.equal(fete('2022-06-24'), 'sacre-coeur');
  assert.equal(fete('2022-06-23'), 'nativite-jean-baptiste');
  assert.equal(fete('2033-06-23'), 'nativite-jean-baptiste');
  assert.equal(fete('2026-06-24'), 'nativite-jean-baptiste');
});

test('Cycles dominicaux A/B/C et années I/II', () => {
  assert.equal(jour('2025-11-30').anneeDominicale, 'A');
  assert.equal(jour('2026-11-29').anneeDominicale, 'B');
  assert.equal(jour('2027-11-28').anneeDominicale, 'C');
  assert.equal(jour('2026-11-28').anneeDominicale, 'A'); // veille de l'Avent
  assert.equal(jour('2026-06-15').anneeFeriale, 'II');
  assert.equal(jour('2027-06-15').anneeFeriale, 'I');
});

test('Régions : Épiphanie, Ascension, fêtes propres', () => {
  assert.equal(fete('2027-01-03', 'fr'), 'epiphanie');
  assert.equal(fete('2027-01-06', 'es'), 'epiphanie');
  assert.notEqual(fete('2027-01-06', 'fr'), 'epiphanie');
  assert.equal(fete('2027-01-03', 'us'), 'epiphanie');
  assert.equal(fete('2027-05-06', 'fr'), 'ascension');
  assert.equal(fete('2027-05-09', 'es'), 'ascension');
  assert.equal(fete('2027-05-09', 'us'), 'ascension');
  assert.notEqual(fete('2027-05-06', 'us'), 'ascension');
  assert.equal(fete('2027-05-30', 'fr'), 'saint-sacrement');
  assert.equal(fete('2027-05-30', 'es'), 'saint-sacrement');
  assert.equal(fete('2027-07-25', 'es'), 'santiago');
  assert.equal(fete('2026-10-12', 'es'), 'pilar');
  assert.equal(fete('2026-12-12', 'us'), 'guadalupe');
  assert.notEqual(fete('2026-12-12', 'fr'), 'guadalupe');
  assert.equal(fete('2027-01-10', 'es'), 'bapteme');  // dimanche après le 6 janvier
  assert.equal(fete('2029-01-08', 'fr'), 'bapteme');  // Épiphanie le 7 : Baptême le lundi
});

test('Aucune exception de 1900 à 2199, dans toutes les régions', () => {
  for (const r of L.regions) {
    L.region(r);
    for (const d of dates([1900, 0, 1], [2199, 11, 31])) {
      const j = L.jour(d, FETES);
      assert.ok(j.cles.length >= 3 && j.saison && j.titre, `${r} ${d}`);
    }
  }
});
