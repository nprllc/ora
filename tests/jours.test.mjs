// Le titre du jour (data/jours.json) : un titre pour chacun des 366 jours, en français, espagnol et anglais,
// court, sans injonction ; les jours des temps forts (data/temps.json) dans les trois langues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const TOUS = JSON.parse(readFileSync(new URL('../data/jours.json', import.meta.url)));
const TEMPS = JSON.parse(readFileSync(new URL('../data/temps.json', import.meta.url)));
const INJ = {
  fr: /\b(tu dois|vous devez|il faut)\b/i,
  es: /\b(debes|tienes que|hay que|debéis)\b/i,
  en: /\b(you must|you have to|you should)\b/i
};
const sansCitation = (s) => s.replace(/«[^»]*»/g, '').replace(/“[^”]*”/g, '');

for (const l of ['fr', 'es', 'en']) {
  const jours = TOUS[l];
  test(`jours (${l}) : un titre et une phrase pour chacun des 366 jours`, () => {
    assert.ok(jours, `${l} absent`);
    for (let t = Date.UTC(2024, 0, 1); t < Date.UTC(2025, 0, 1); t += 864e5) {
      const k = new Date(t).toISOString().slice(5, 10), x = jours[k], f = TOUS.fr[k];
      assert.ok(Array.isArray(x) && (x.length === 2 || x.length === 3), `jour ${k} absent`);
      assert.equal(x.length, f.length, `${l} ${k} : pas la même forme qu'en français`);
      if (x[2]) {
        for (const c of ['qui', 'sens', 'vivre']) { assert.ok(typeof x[2][c] === 'string' && x[2][c].length > 20, `${l} ${k} : « ${c} » manque`); assert.doesNotMatch(sansCitation(x[2][c]), INJ[l], `${l} ${k}`); }
        assert.equal(!!x[2].fort, !!f[2].fort, `${l} ${k} : « fort » différent`);
      }
      assert.ok(x[0].length > 2 && x[0].length <= 55, `titre trop long : ${l} ${k}`);
      assert.ok(x[1].length > 10 && x[1].length <= 150, `phrase trop longue : ${l} ${k}`);
      assert.match(x[1], /[.!?»)”]$/, `phrase sans point final : ${l} ${k}`);
      assert.doesNotMatch(sansCitation(x[1]), INJ[l], `${l} ${k}`);
    }
    assert.equal(Object.keys(jours).length, 366);
  });

  // Le titre porte le nom court du saint (« Saint Jean ») : il peut revenir ; la phrase dessous, qui donne
  // le nom complet (« Saint Jean Bosco : … »), ne revient jamais (règle de Nico, 8 novembre 2026).
  test(`jours (${l}) : jamais deux fois la même phrase ; un titre court est précisé dans la phrase`, () => {
    const vus = new Set(), fautes = [];
    for (const [k, [t, ph]] of Object.entries(jours)) {
      if (vus.has(ph)) fautes.push(`doublon « ${ph} » (${k})`); vus.add(ph);
      const nom = t.replace(/^(Saint|Sainte|Saints|Saintes|Bienheureux|Bienheureuse|San|Santa|Santo|Santos|Santas|Beato|Beata|Blessed)\s+/, '');
      const autres = Object.entries(jours).filter(([k2, [t2]]) => k2 !== k && t2 === t);
      if (autres.length && !(ph.startsWith(t + ' ') || ph.startsWith(t + ',') || (ph.includes(nom) && ph.indexOf(nom) < 40))) fautes.push(`${k} : « ${t} » revient ailleurs, la phrase doit donner le nom complet`);
    }
    assert.deepEqual(fautes, []);
  });

  test(`temps forts (${l}) : un titre pour chaque jour possible de chaque temps`, () => {
    const temps = TEMPS[l], min = { avent: 20, noel: 20, careme: 43, paques: 50 };
    assert.ok(temps, `${l} absent`);
    for (const [s, n] of Object.entries(min)) {
      assert.equal(temps[s].length, TEMPS.fr[s].length, `${l} ${s}`);
      assert.ok(temps[s].length >= n, `${s} : ${temps[s].length} < ${n}`);
      for (const x of temps[s]) { assert.equal(x.length, 2); assert.doesNotMatch(sansCitation(x[1]), INJ[l]); }
    }
  });
}
