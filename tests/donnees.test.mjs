// Données : schéma, versets présents dans les trois Bibles, prières bibliques fidèles à leur verset,
// identifiants référencés existants, couverture de 2026 à 2040 sans aucune date civile dans les données.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { L, FETES, lireJson, dates, chercher } from './aide.mjs';
import VERSIF from '../outils/sources/versification.mjs';

const BIBLES = { fr: lireJson('data/bible.json'), es: lireJson('data/bible-es.json'), en: lireJson('data/bible-en.json') };
const LIVRES = Object.fromEntries(Object.entries(BIBLES).map(([l, b]) => [l, Object.fromEntries(b.livres.map((x) => [x.osis, x]))]));
const LECT = lireJson('data/lectionnaire.json');
const PJ = lireJson('data/prieres-jour.json');
const CONTENUS = lireJson('data/contenus.json');
const AUTEURS = lireJson('data/auteurs.json');
const PRIERES = lireJson('data/prieres.json');
const UI = lireJson('data/i18n/ui.json');
const LANGUES = ['fr', 'es', 'en'];
const verset = (l, o, c, v) => { const b = LIVRES[l][o]; return b && b.ch[c - 1] && b.ch[c - 1][v - 1]; };
const DATE_CIVILE = /\d{4}-\d{2}-\d{2}/;

// --- Schéma (validation à la main, sans dépendance) ---
function exige(obj, champs, ou) { for (const [c, type] of Object.entries(champs)) assert.equal(typeof obj[c] === 'object' && type === 'array' ? Array.isArray(obj[c]) && 'array' : typeof obj[c], type, `${ou} : champ « ${c} » attendu (${type})`); }

test('schéma : fêtes', () => {
  for (const f of FETES.fixes) {
    exige(f, { date: 'string', id: 'string', nom: 'string', rang: 'string', couleur: 'string' }, 'fetes.json ' + f.id);
    assert.match(f.date, /^\d{2}-\d{2}$/);
    assert.ok(['solennite', 'fete-seigneur', 'fete', 'commemoration'].includes(f.rang), f.id);
    if (f.regions) for (const r of f.regions) assert.ok(L.regions.includes(r), `${f.id} : région ${r}`);
  }
});

test('schéma : lectionnaire', () => {
  for (const [k, e] of Object.entries(LECT.cles)) {
    exige(e, { ref: 'string', osis: 'string', v: 'array' }, 'lectionnaire ' + k);
    assert.ok(e.v.length > 0, k);
    for (const x of e.v) assert.ok(Number.isInteger(x[0]) && Number.isInteger(x[1]), k);
  }
});

test('schéma : prières du jour', () => {
  const p = (x, ou) => { exige(x, { id: 'string', fr: 'string', es: 'string', en: 'string', src: 'object' }, ou); for (const l of LANGUES) assert.ok(x[l].trim() && x.src[l], `${ou} ${l}`); };
  for (const [m, liste] of Object.entries(PJ.pools)) { assert.ok(liste.length > 0, m); liste.forEach((x, i) => p(x, `pools.${m}[${i}]`)); }
  for (const [k, c] of Object.entries(PJ.celebrations)) for (const [m, x] of Object.entries(c)) p(x, `celebrations.${k}.${m}`);
  for (const [k, x] of Object.entries(PJ.reflexions)) p(x, `reflexions.${k}`);
});

test('schéma : contenus éditoriaux', () => {
  for (const [k, c] of Object.entries(CONTENUS)) {
    if (k.startsWith('_')) continue;
    for (const l of LANGUES) {
      const x = c[l];
      assert.ok(x, `${k} : langue ${l}`);
      exige(x, { citation: 'object', reflexion: 'object', histoire: 'object', portrait: 'object', savaisTu: 'object', meditation: 'object', enfant: 'object' }, `contenus ${k} ${l}`);
      exige(x.citation, { texte: 'string', auteur: 'string', source: 'string', auteurId: 'string' }, `${k} ${l} citation`);
      exige(x.meditation, { contexte: 'string', eclairage: 'string', pistes: 'array', conclusion: 'string' }, `${k} ${l} méditation`);
    }
  }
});

test('schéma : l\'interface a les mêmes textes dans les trois langues', () => {
  for (const l of ['es', 'en']) for (const k of Object.keys(UI.fr)) assert.ok(UI[l][k] != null, `ui.${l} : « ${k} » manque`);
});

// --- Versets ---
test('chaque verset du lectionnaire existe dans les trois Bibles', () => {
  const manque = [];
  for (const [k, e] of Object.entries(LECT.cles)) for (const l of LANGUES) for (const [c, v] of (e.vl && e.vl[l]) || e.v) if (!verset(l, e.osis, c, v)) manque.push(`${k} ${l} ${e.osis} ${c}:${v}`);
  assert.deepEqual(manque, []);
});

// Une prière tirée de la Bible doit être le texte même de son verset : on compare les mots, en tenant compte
// seulement du nom divin (« Yahweh » devient « le Seigneur ») et des coupes en début ou en fin de verset.
// Les lettres hébraïques de tête des psaumes alphabétiques (« ALEPH. ») ne font pas partie de la prière.
const ACROSTICHE = /\b(ALEPH|BETH|GHIMEL|DALETH|HÉ|VAV|ZAÏN|HETH|TETH|YOD|CAPH|LAMED|MEM|NUN|SAMECH|AÏN|PHÉ|TSADÉ|QOPH|RESCH|SCHIN|THAV|HET)\./g;
const mots = (t) => t.replace(ACROSTICHE, ' ').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/hallelu\s*yah/g, ' aleluya ').replace(/yahweh|yahve|jehovah|\byah\b/g, ' seigneur ').replace(/[^a-z0-9]+/g, ' ')
  .split(' ').filter((m) => m && !['le', 'la', 'l', 'el', 'du', 'de', 'al', 'a', 'del', 'au', 'dans', 'en', 'o', 'oh', 'the', 'seigneur', 'senor', 'lord'].includes(m));
function fidele(priere, texteBible) {
  const p = mots(priere).join(' '), b = mots(texteBible).join(' ');
  return b.includes(p);
}
test('chaque prière biblique est le texte de son verset, dans chaque langue', () => {
  const ecarts = [];
  const verifie = (x, ou) => {
    if (!x.bible) return;
    for (const l of LANGUES) {
      const s = x.bible[l], t = s.v.map((v) => verset(l, s.osis, s.c, v) || '').join(' ');
      if (!t) ecarts.push(`${ou} ${l} : verset absent`);
      else if (!fidele(x[l], t)) ecarts.push(`${ou} ${l} : « ${x[l].slice(0, 50)} » ≠ ${s.osis} ${s.c}:${s.v}`);
    }
  };
  for (const [m, liste] of Object.entries(PJ.pools)) liste.forEach((x) => verifie(x, `${m}/${x.id}`));
  for (const [k, c] of Object.entries(PJ.celebrations)) for (const [m, x] of Object.entries(c)) verifie(x, `${k}/${m}`);
  for (const [k, x] of Object.entries(PJ.reflexions)) verifie(x, `réflexion ${k}`);
  assert.deepEqual(ecarts, []);
});

// Une prière tirée d'un Évangile désigne le bon verset dans chaque Bible : l'identifiant (« mc9-24 ») donne la
// numérotation moderne, que la table des correspondances traduit pour la Crampon, la Platense et la Douay-Rheims.
test('chaque prière d\'Évangile désigne le même verset dans les trois Bibles', () => {
  const LIVRE = { mt: 'Matt', mc: 'Mark', lc: 'Luke', jn: 'John' }, ecarts = [];
  const verifie = (x, ou) => {
    const m = /^(mt|mc|lc|jn)(\d+)-(\d+)$/.exec(x.id || '');
    if (!m || !x.bible) return;
    const osis = LIVRE[m[1]], c = +m[2], v = +m[3];
    for (const l of LANGUES) {
      const att = (VERSIF[l][`${osis}.${c}.${v}`] || [[c, v]])[0], s = x.bible[l];
      if (s.c !== att[0] || s.v[0] !== att[1]) ecarts.push(`${ou} ${l} : ${s.c}:${s.v[0]} au lieu de ${att[0]}:${att[1]}`);
    }
  };
  for (const [m, liste] of Object.entries(PJ.pools)) liste.forEach((x) => verifie(x, `${m}/${x.id}`));
  for (const [k, c] of Object.entries(PJ.celebrations)) for (const [m, x] of Object.entries(c)) verifie(x, `${k}/${m}`);
  assert.deepEqual(ecarts, []);
});

// Une prière affichée : guillemets refermés, sans les parenthèses du traducteur, sans nom divin.
test('les prières du jour sont propres : guillemets équilibrés, ni parenthèses ni nom divin', () => {
  const defauts = [];
  const verifie = (x, ou) => { for (const l of LANGUES) {
    const t = x[l];
    if (t.split('«').length !== t.split('»').length || t.split('“').length !== t.split('”').length) defauts.push(`${ou} ${l} : guillemet seul`);
    if (/[()]/.test(t)) defauts.push(`${ou} ${l} : parenthèse`);
    if (/\b(Yahweh|Yahvé|Yah|Hallelú)\b/.test(t)) defauts.push(`${ou} ${l} : nom divin`);
  } };
  for (const [m, liste] of Object.entries(PJ.pools)) liste.forEach((x) => verifie(x, `${m}/${x.id}`));
  for (const [k, c] of Object.entries(PJ.celebrations)) for (const [m, x] of Object.entries(c)) verifie(x, `${k}/${m}`);
  // Pour les enfants, Dieu est tutoyé (les prières à Marie et à l'ange gardien gardent leur texte traditionnel).
  for (const m of ['enfantJour', 'enfantSoir']) for (const x of PJ.pools[m]) if (!['je-vous-salue-marie', 'ange-de-dieu'].includes(x.id) && /\b(vous|votre|vos)\b/i.test(x.fr)) defauts.push(`${m}/${x.id} fr : « vous »`);
  assert.deepEqual(defauts, []);
});

// Une prière traduite se suffit à elle-même : l'app n'y mêle aucun texte français.
test('chaque prière traditionnelle traduite a tous ses textes dans sa langue', () => {
  const manque = [];
  for (const p of PRIERES.traditionnelles) for (const l of ['es', 'en']) {
    const t = lireJson(`data/i18n/${l}.json`).prieres[p.id] || {};
    for (const k of Object.keys(p)) if (!['id', 'bible', 'variante', 'source'].includes(k) && !t[k]) manque.push(`${l} ${p.id} : ${k}`);
  }
  assert.deepEqual(manque, []);
});

// --- Identifiants ---
test('chaque identifiant référencé existe', () => {
  const ids = new Set(PRIERES.traditionnelles.map((p) => p.id));
  for (const l of ['es', 'en']) for (const id of Object.keys(lireJson(`data/i18n/${l}.json`).prieres)) assert.ok(ids.has(id), `i18n/${l} : prière « ${id} » inconnue`);
  for (const [k, c] of Object.entries(CONTENUS)) {
    if (k.startsWith('_')) continue;
    for (const l of LANGUES) for (const cit of [c[l].citation, c[l].enfant && c[l].enfant.citation]) if (cit && cit.auteurId) assert.ok(AUTEURS[cit.auteurId], `${k} ${l} : auteur « ${cit.auteurId} » inconnu`);
  }
  const lex = new Set(lireJson('data/lexique.json').mots.map((m) => m.id));
  for (const l of ['es', 'en']) for (const m of lireJson(`data/i18n/${l}.json`).lexique.mots) assert.ok(lex.has(m.id), `lexique ${l} : « ${m.id} » inconnu`);
  // Les clés des contenus et des prières de fête doivent être des clés que le moteur produit.
  const connues = new Set();
  for (const r of L.regions) { L.region(r); for (const d of dates([2026, 0, 1], [2032, 11, 31])) L.jour(d, FETES).cles.forEach((k) => connues.add(k)); }
  for (const k of [...Object.keys(CONTENUS), ...Object.keys(PJ.celebrations), ...Object.keys(PJ.reflexions)]) if (!k.startsWith('_')) assert.ok(connues.has(k), `clé liturgique inconnue : ${k}`);
});

test('aucune date civile dans les clés des données', () => {
  for (const [nom, cles] of [['lectionnaire', Object.keys(LECT.cles)], ['contenus', Object.keys(CONTENUS)], ['prières de fête', Object.keys(PJ.celebrations)], ['réflexions', Object.keys(PJ.reflexions)]]) {
    for (const k of cles) assert.doesNotMatch(k, DATE_CIVILE, `${nom} : clé « ${k} »`);
  }
});

// --- Couverture ---
test('de 2026 à 2040, dans chaque région et chaque langue : un Évangile chaque jour (sauf le Samedi saint) et une prière chaque jour', () => {
  const sansEvangile = [], sansPriere = [];
  for (const r of L.regions) {
    L.region(r);
    for (const d of dates([2026, 0, 1], [2040, 11, 31])) {
      const j = L.jour(d, FETES);
      const e = chercher(LECT.cles, j.cles);
      if (j.celebration && j.celebration.id === 'samedi-saint') { assert.equal(e, null, `${d} : pas de messe le Samedi saint`); continue; }
      if (!e) sansEvangile.push(`${r} ${d}`);
      else for (const l of LANGUES) for (const [c, v] of (e.vl && e.vl[l]) || e.v) if (!verset(l, e.osis, c, v)) sansEvangile.push(`${r} ${l} ${d}`);
      for (const m of ['jour', 'soir', 'enfantJour', 'enfantSoir']) {
        const cel = chercher(PJ.celebrations, j.cles), p = (cel && cel[m]) || PJ.pools[m][j.indexAnnee % PJ.pools[m].length];
        for (const l of LANGUES) if (!p || !p[l]) sansPriere.push(`${r} ${l} ${d} ${m}`);
      }
    }
  }
  assert.deepEqual(sansEvangile, []);
  assert.deepEqual(sansPriere, []);
});

test('jamais la même personne citée deux jours de suite (adultes et enfants, 2026-2040)', () => {
  for (const r of L.regions) {
    L.region(r);
    let prec = null;
    for (const d of dates([2026, 0, 1], [2040, 11, 31])) {
      const c = chercher(CONTENUS, L.jour(d, FETES).cles);
      const ids = c ? [c.fr.citation.auteurId, c.fr.enfant && c.fr.enfant.citation && c.fr.enfant.citation.auteurId] : [null, null];
      if (prec) for (const i of [0, 1]) if (ids[i]) assert.notEqual(ids[i], prec[i], `${r} ${d} : même auteur que la veille (${ids[i]})`);
      prec = ids;
    }
  }
});

// La messe pas à pas : la même structure dans les trois langues.
test('la messe pas à pas a les mêmes étapes en français, espagnol et anglais', () => {
  const M = lireJson('data/messe.json');
  const forme = (l) => M[l].parties.map((p) => p.etapes.map((e) => (e.reponse ? 'r' : '-') + (e.posture ? 'p' : '-')).join(''));
  for (const l of ['es', 'en']) assert.deepEqual(forme(l), forme('fr'), l);
});
