// Ora — fabrique data/lectionnaire.json : l'Évangile de la messe rangé par clé liturgique, jamais par date civile.
//
// Source : les références d'Évangile de l'AELF (api.aelf.org, zone « romain ») pour chaque jour de 2016 à 2027
// (outils/sources/aelf-evangiles.json), plus quelques jours que seule la zone « canada » donne (Ascension
// reportée au dimanche) et des compléments du Lectionnaire romain (outils/sources/lectionnaire-complements.json).
//
// Pour chaque date, le moteur (src/js/liturgie.js, région France, comme la zone « romain » de l'AELF) calcule
// la clé du jour (célébration, sinon jour férial). Si une clé reçoit toujours la même référence, on la garde ;
// si la référence change avec le cycle A/B/C ou avec l'année paire/impaire, on range une variante par cycle ou
// par parité. On ne garde que la référence (le texte liturgique de l'AELF est protégé) : l'app lit le passage
// dans la Bible de la langue choisie.
//
// Usage : node outils/lectionnaire.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { versets } from './references.mjs';
import VERSIF from './sources/versification.mjs';

const require = createRequire(import.meta.url);
const ICI = path.dirname(new URL(import.meta.url).pathname);
const RACINE = path.join(ICI, '..');
const L = require(path.join(RACINE, 'src/js/liturgie.js'));
const F = JSON.parse(fs.readFileSync(path.join(RACINE, 'data/fetes.json'), 'utf8'));
const SRC = JSON.parse(fs.readFileSync(path.join(ICI, 'sources/aelf-evangiles.json'), 'utf8'));
const COMPL = JSON.parse(fs.readFileSync(path.join(ICI, 'sources/lectionnaire-complements.json'), 'utf8'));

// L'Évangile principal : la messe « du jour » (Noël, Pâques) ou « de la Passion » (Rameaux), sinon la dernière
// messe qui a un Évangile ; on prend la forme longue, donnée en premier.
function evangile(x) {
  if (!x || typeof x === 'string' || !x.m) return null;
  const avecEv = x.m.filter((m) => m[1].length);
  if (!avecEv.length) return null;
  const messe = avecEv.find((m) => /jour|passion/i.test(m[0])) || avecEv[avecEv.length - 1];
  return messe[1][0].replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/\s*([,;])\s*/g, '$1 ').replace(/\s*–\s*/g, ' – ').replace(/\s*-\s*/g, '-').trim();
}

function agreger(source, region) {
  L.region(region);
  const parCle = {};
  for (const date of Object.keys(source).sort()) {
    const ref = evangile(source[date]);
    if (!ref) continue;
    const j = L.jour(date, F);
    const cle = j.celebration ? j.celebration.id : j.cles[j.cles.length - 1];
    (parCle[cle] = parCle[cle] || []).push({ date, cycle: j.anneeDominicale, parite: j.anneeFeriale, ref, nom: source[date].i && source[date].i[0] });
  }
  return parCle;
}

const sorties = {}, conflits = {};
function ranger(parCle) {
  for (const [cle, liste] of Object.entries(parCle)) {
    const refs = new Set(liste.map((e) => e.ref));
    if (refs.size === 1) { sorties[cle] = liste[0].ref; continue; }
    const par = (champ) => { const m = {}; for (const e of liste) (m[e[champ]] = m[e[champ]] || new Set()).add(e.ref); return m; };
    const pc = par('cycle');
    if (Object.values(pc).every((s) => s.size === 1)) { for (const [c, s] of Object.entries(pc)) sorties[cle + '-' + c] = [...s][0]; continue; }
    const pp = par('parite');
    if (Object.values(pp).every((s) => s.size === 1)) { for (const [p, s] of Object.entries(pp)) sorties[cle + '-' + p] = [...s][0]; continue; }
    // Sinon, une mémoire de saint (non calculée par le moteur) a parfois pris la place de l'Évangile férial :
    // on garde la référence majoritaire, qui est celle du jour férial, et on note les écarts.
    const compte = {};
    liste.forEach((e) => { compte[e.ref] = (compte[e.ref] || 0) + 1; });
    const meilleure = Object.entries(compte).sort((a, b) => b[1] - a[1])[0];
    sorties[cle] = meilleure[0];
    conflits[cle] = liste.filter((e) => e.ref !== meilleure[0]).map((e) => `${e.date} ${e.ref} (${e.nom})`);
  }
}

ranger(agreger(SRC.romain, 'fr'));
// Zone « canada » : seulement le jeudi de la 6e semaine de Pâques quand l'Ascension est reportée au dimanche.
const canada = agreger(SRC.canada, 'us');
for (const [cle, liste] of Object.entries(canada)) if (!(cle in sorties) && !Object.keys(sorties).some((k) => k.startsWith(cle + '-'))) ranger({ [cle]: liste });
for (const [cle, c] of Object.entries(COMPL)) if (!cle.startsWith('_')) sorties[cle] = c.ref;

const bibleFr = JSON.parse(fs.readFileSync(path.join(RACINE, 'data/bible.json'), 'utf8'));
const livres = Object.fromEntries(bibleFr.livres.map((b) => [b.osis, b]));
const cles = {};
for (const cle of Object.keys(sorties).sort()) {
  const ref = sorties[cle].replace(/ /g, ' ').replace(/^Jean /, 'Jn ');
  const { osis, liste } = versets(ref, livres, true);
  const entree = { ref, osis, v: liste };
  // Numérotation propre à chaque Bible, si elle diffère de la numérotation moderne du Lectionnaire.
  for (const l of ['fr', 'es', 'en']) {
    const vl = [];
    for (const [c, v] of liste) for (const x of VERSIF[l][`${osis}.${c}.${v}`] || [[c, v]]) if (!vl.some((y) => y[0] === x[0] && y[1] === x[1])) vl.push(x);
    if (JSON.stringify(vl) !== JSON.stringify(liste)) (entree.vl = entree.vl || {})[l] = vl;
  }
  cles[cle] = entree;
}

fs.writeFileSync(path.join(RACINE, 'data/lectionnaire.json'), JSON.stringify({
  _note: "Évangile de la messe, rangé par clé liturgique (voir src/js/liturgie.js, clesDuJour). Références d'après l'AELF (zone romain, 2016-2027) et le Lectionnaire romain ; « vl » donne, si besoin, les versets dans la numérotation d'une autre Bible. Fabriqué par outils/lectionnaire.mjs.",
  cles
}, null, 1));
fs.writeFileSync(path.join(ICI, 'sources/lectionnaire-ecarts.json'), JSON.stringify(conflits, null, 1));
console.log(Object.keys(cles).length, 'clés ;', Object.keys(conflits).length, 'clés avec des écarts (mémoires de saints), voir outils/sources/lectionnaire-ecarts.json');
