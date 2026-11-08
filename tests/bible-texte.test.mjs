// Le texte des trois Bibles intégrées : aucun titre de chapitre ou de section collé à la fin d'un verset
// (dans la Crampon, le titre du chapitre suivant se retrouvait parfois après « …\n21\n »).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lireJson } from './aide.mjs';

for (const f of ['bible.json', 'bible-es.json', 'bible-en.json']) {
  test(`${f} : pas de titre collé dans un verset`, () => {
    const fautes = [];
    for (const l of lireJson('data/' + f).livres) l.ch.forEach((ch, c) => ch.forEach((v, i) => {
      if (v && /\n\s*\d+\s*\n/.test(v)) fautes.push(`${l.osis} ${c + 1}, ${i + 1}`);
    }));
    assert.deepEqual(fautes, []);
  });
}
