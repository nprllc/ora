// Le latin en italique : locutions latines partout, mots cités pour leur étymologie près du mot « latin ».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { RACINE, lireJson } from './aide.mjs';

const require = createRequire(import.meta.url);
const { italiques } = require(path.join(RACINE, 'src/js/latin.js'));

test('formes reconnues', () => {
  assert.equal(italiques('Le mot vient du latin caro, « chair ».'), 'Le mot vient du latin <i lang="la">caro</i>, « chair ».');
  assert.equal(italiques('Un vino caro.'), 'Un vino caro.'); // « caro » espagnol, sans « latín » à côté
  assert.equal(italiques('<b>Memento mori</b>'), '<b><i lang="la">Memento mori</i></b>');
  assert.equal(italiques('<button data-id="caro latin">x</button>'), '<button data-id="caro latin">x</button>'); // les attributs ne bougent pas
  assert.equal(italiques('on dit le Credo et le Gloria'), 'on dit le Credo et le Gloria'); // mots francisés : droits
  assert.equal(italiques('In Latin, misericordia evokes a heart (cor).'), 'In Latin, <i lang="la">misericordia</i> evokes a heart (<i lang="la">cor</i>).');
});

// Garde-fou : tout mot qui suit « du latin », « del latín », « the Latin » dans les textes d'Ora doit être connu,
// sinon il resterait droit. (Le jour où un texte cite un nouveau mot latin, on l'ajoute à src/js/latin.js.)
test('chaque mot cité après « latin » est mis en italique', () => {
  const fichiers = ['data/lexique.json', 'data/explications.json', 'data/contenus.json', 'data/prieres.json', 'data/auteurs.json', 'data/conseils.json',
    'data/i18n/es.json', 'data/i18n/en.json', 'data/livres-resumes.json', 'data/guide-famille.json'];
  const oublis = [];
  const textes = (o, out) => { if (typeof o === 'string') out.push(o); else if (o && typeof o === 'object') Object.values(o).forEach((v) => textes(v, out)); return out; };
  for (const f of fichiers) for (const t of textes(lireJson(f), [])) {
    const re = /\b(?:du|del|the|from|en) lat[ií]n,? (?:[«“"]\s*)?([\p{L}]+)/giu; let m;
    while ((m = re.exec(t))) {
      const mot = m[1];
      if (/^(qui|que|which|un|une|a|an)$/i.test(mot)) continue;
      if (!italiques(t).includes('<i lang="la">' + mot)) oublis.push(`${f} : « ${mot} »`);
    }
  }
  assert.deepEqual(oublis, []);
});
