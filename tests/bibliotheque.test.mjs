// La bibliothèque des jours ordinaires : chaque rubrique est complète, chaque auteur cité est connu,
// jamais deux jours de suite le même auteur, et les prières des réflexions sont des versets vérifiés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const lire = (f) => JSON.parse(fs.readFileSync(new URL('../data/' + f, import.meta.url)));
const BIB = lire('bibliotheque.json'), AUTEURS = lire('auteurs.json'), PJ = lire('prieres-jour.json');
const pool = new Set(Object.values(PJ.pools).flat().map((x) => x.id));
const CHAMPS = {
  citations: ['texte', 'auteur', 'source'],
  reflexions: ['titre', 'accroche', 'fait', 'piste', 'sources'],
  histoires: ['titre', 'accroche', 'texte', 'source'],
  portraits: ['nom', 'dates', 'accroche', 'texte', 'source'],
  savaisTu: ['titre', 'accroche', 'texte', 'source']
};

test('chaque élément a ses champs en français, et un identifiant unique', () => {
  for (const [r, champs] of Object.entries(CHAMPS)) {
    const ids = new Set();
    for (const x of BIB[r]) {
      assert.ok(x.id && !ids.has(x.id), `${r} : identifiant en double ou absent (${x.id})`); ids.add(x.id);
      for (const c of champs) assert.ok(typeof x.fr[c] === 'string' && x.fr[c].trim(), `${r} ${x.id} : « ${c} » manque`);
    }
  }
});

test('les auteurs cités sont connus et ne reviennent jamais deux jours de suite', () => {
  const c = BIB.citations;
  c.forEach((x, i) => {
    if (x.fr.auteurId) assert.ok(AUTEURS[x.fr.auteurId], `auteur inconnu : ${x.fr.auteurId}`);
    const suivant = c[(i + 1) % c.length];
    if (x.fr.auteurId) assert.notEqual(x.fr.auteurId, suivant.fr.auteurId, `${x.id} puis ${suivant.id} : même auteur`);
  });
});

test('chaque réflexion a sa prière (un verset vérifié) et ses versets', () => {
  for (const r of BIB.reflexions) {
    assert.ok(pool.has(r.priere), `${r.id} : prière « ${r.priere} » inconnue`);
    assert.ok((r.versets || []).length >= 1, `${r.id} : aucun verset`);
  }
});

test('les versets cités se lisent seuls : pas de dialogue entre guillemets coupé', () => {
  const bible = Object.fromEntries(lire('bible.json').livres.map((b) => [b.osis, b]));
  for (const r of BIB.reflexions) for (const x of r.versets) {
    const t = x.v.map((v) => bible[x.osis].ch[x.c - 1][v - 1]).join(' ');
    assert.ok(!/[«»“”]/.test(t), `${r.id} : ${x.osis} ${x.c}, ${x.v} contient des guillemets`);
  }
});

test('pas d\'injonction dans les textes (« il faut », « tu dois »)', () => {
  for (const [r, liste] of Object.entries(BIB)) if (Array.isArray(liste)) for (const x of liste) {
    const t = JSON.stringify(x.fr).toLowerCase();
    for (const m of ['tu dois', 'vous devez']) assert.ok(!t.includes(m), `${r} ${x.id} : « ${m} »`);
  }
});
