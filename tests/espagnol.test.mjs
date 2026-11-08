// L'espagnol d'Ora est neutre : compris en Espagne et en Amérique latine (« ustedes », pas « vosotros » ;
// pas de mots propres à l'Espagne comme « móvil », « coche », « ordenador »). Les prières traditionnelles gardent leur texte,
// et les citations aussi : leur texte est celui de la traduction publiée (vatican.va), mot pour mot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const lire = (f) => JSON.parse(readFileSync(new URL('../data/' + f, import.meta.url)));
const INTERDIT = /\b(vosotr[oa]s|vuestr[oa]s?|sois|[a-záéíóúñ]+(?:áis|éis)|móvil(?:es)?|coches?|ordenador(?:es)?|cole)\b/i;
const PERMIS = /^(veintiséis|dieciséis|seis)$/i;
function* textes(o, es) {
  if (Array.isArray(o)) for (const v of o) yield* textes(v, es);
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) yield* textes(v, es || k === 'es');
  else if (typeof o === 'string' && es) yield o;
}
for (const f of ['jours.json', 'temps.json', 'bibliotheque.json', 'famille-personnages.json', 'famille-mots.json', 'evangiles-titres.json', 'evangiles-enfants.json', 'i18n/ui.json']) {
  test(`espagnol neutre : ${f}`, () => {
    const donnees = lire(f);
    if (f === 'bibliotheque.json') for (const c of donnees.citations) if (c.es) delete c.es.texte;
    for (const s of textes(donnees, false)) {
      const m = s.replace(/Vuestra Majestad/g, '').match(INTERDIT);
      if (m && !PERMIS.test(m[0])) assert.fail(`${f} : « ${m[0]} » dans « ${s.slice(0, 80)} »`);
    }
  });
}
