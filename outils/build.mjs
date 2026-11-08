// Ora — build : fabrique dist/ à partir de src/ et data/.
// - dist/index.html : la page, avec le CSS, le JS et le « noyau » des données (ce qui sert à calculer le jour) ;
// - dist/donnees-fr.<empreinte>.json (et es, en) : les contenus d'une langue (titres des jours,
//   bibliothèque, En famille, messe, traductions…), lus au démarrage et mis en cache pour le hors-ligne ;
// - dist/bible-fr.json, bible-es.json, bible-en.json : les trois Bibles, chargées à la demande ;
// - dist/sw.js : le service worker, avec une VERSION calculée d'après le contenu des fichiers (empreinte) ;
// - dist/img/ : les images, dont le nom porte l'empreinte du contenu (table ORA_IMG) ;
// - dist/manifest.webmanifest, dist/icons/, dist/fonts/.
// Aucune dépendance : node outils/build.mjs (ou npm run build).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { versets as lireRef } from './references.mjs';
import VERSIF from './sources/versification.mjs';

const RACINE = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(RACINE, 'src'), DATA = path.join(RACINE, 'data'), DIST = path.join(RACINE, 'dist');
const lire = (f) => fs.readFileSync(f, 'utf8');
const json = (f) => JSON.parse(lire(path.join(DATA, f)));

fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'icons'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'img'), { recursive: true });

// 1. Les données lues par l'app (src/js/app.js, charger()).
const donnees = {
  fr: { fetes: json('fetes.json'), explications: json('explications.json'), prieres: json('prieres.json'), lexique: json('lexique.json'), conseils: json('conseils.json') },
  contenus: json('contenus.json'),
  lectionnaire: json('lectionnaire.json'),
  coeurs: json('coeur-evangile.json').coeurs,
  jours: (({ _note, ...l }) => l)(json('jours.json')),
  temps: (({ _note, ...l }) => l)(json('temps.json')),
  prieresJour: json('prieres-jour.json'),
  ui: json('i18n/ui.json'),
  i18n: { es: json('i18n/es.json'), en: json('i18n/en.json') },
  guideFamilleFr: json('guide-famille.json'),
  personnages: json('famille-personnages.json').personnages,
  motsEnfants: json('famille-mots.json').mots,
  messe: json('messe.json'),
  auteurs: json('auteurs.json'),
  abreviations: json('abreviations.json')
};

// 1 bis. La bibliothèque des jours ordinaires (data/bibliotheque.json) : une citation, une réflexion, une histoire,
// un personnage et un « Le savais-tu ? » qui tournent chaque jour sans contenu propre. Les versets de la Bible
// cités par les réflexions sont désignés par leur référence : le build en lit le texte dans la Bible de chaque langue ;
// la prière de la réflexion est un verset déjà vérifié des prières du jour (prieres-jour.json, par son id).
{
  const bib = json('bibliotheque.json');
  const livres = Object.fromEntries(Object.entries({ fr: 'bible.json', es: 'bible-es.json', en: 'bible-en.json' }).map(([l, f]) => [l, Object.fromEntries(json(f).livres.map((b) => [b.osis, b]))]));
  const pool = {};
  for (const liste of Object.values(donnees.prieresJour.pools)) for (const x of liste) pool[x.id] = x;
  const verset = (l, r) => {
    const b = livres[l][r.osis]; if (!b) throw new Error(`bibliothèque : livre ${r.osis} absent (${l})`);
    const t = r.v.map((v) => (b.ch[r.c - 1] || [])[v - 1]); if (t.some((x) => !x)) throw new Error(`bibliothèque : ${r.osis} ${r.c}, ${r.v} absent (${l})`);
    const sep = l === 'en' ? ':' : ', ', v = r.v.length > 1 ? r.v[0] + '-' + r.v[r.v.length - 1] : r.v[0];
    return { texte: t.join(' ').replace(/\s+/g, ' ').trim(), source: b.abr + ' ' + r.c + sep + v };
  };
  for (const r of bib.reflexions) for (const l of ['fr', 'es', 'en']) {
    if (!r[l]) continue;
    r[l].citations = (r.versets || []).map((x) => verset(l, x)).concat(r[l].citations || []);
    const p = pool[r.priere]; if (!p) throw new Error(`bibliothèque : prière ${r.priere} inconnue`);
    r[l].priere = { texte: p[l], source: p.src[l] };
  }
  donnees.bibliotheque = bib;
}

// 1 ter. L'Évangile du jour d'Ora (data/evangiles.json) : des références dans la numérotation moderne, lues comme
// celles du lectionnaire (« vl » : les versets dans la numérotation de chaque Bible) ; chaque verset est vérifié.
{
  const ev = json('evangiles.json');
  const titres = json('evangiles-titres.json');
  const bibles = Object.fromEntries(Object.entries({ fr: 'bible.json', es: 'bible-es.json', en: 'bible-en.json' }).map(([l, f]) => [l, Object.fromEntries(json(f).livres.map((b) => [b.osis, b]))]));
  const lire = ([ref, titre]) => {
    const { osis, liste } = lireRef(ref, bibles.fr, true);
    if (!liste.length) throw new Error(`évangiles : ${ref} : aucun verset`);
    const t = typeof titre === 'object' ? titre : { fr: titre, es: titres.es[ref], en: titres.en[ref] };
    for (const l of ['fr', 'es', 'en']) if (!t[l]) throw new Error(`évangiles : ${ref} : titre ${l} manquant`);
    const e = { ref, titre: t, osis, v: liste, ora: 1 };
    for (const l of ['fr', 'es', 'en']) {
      const vl = [];
      for (const [c, v] of liste) for (const x of VERSIF[l][`${osis}.${c}.${v}`] || [[c, v]]) if (!vl.some((y) => y[0] === x[0] && y[1] === x[1])) vl.push(x);
      for (const [c, v] of vl) if (!(bibles[l][osis].ch[c - 1] || [])[v - 1]) throw new Error(`évangiles : ${ref} (${l}) : ${c}, ${v} absent`);
      if (JSON.stringify(vl) !== JSON.stringify(liste)) (e.vl = e.vl || {})[l] = vl;
    }
    return e;
  };
  const sortie = { fetes: {} };
  for (const [id, ref] of Object.entries(ev.fetes)) sortie.fetes[id] = lire(ref);
  for (const [k, v] of Object.entries(ev)) if (Array.isArray(v)) sortie[k] = v.map(lire);
  donnees.evangiles = sortie;
  // L'Évangile d'« En famille » : des passages choisis pour les 4-8 ans.
  const enf = json('evangiles-enfants.json'), se = {};
  for (const [k, v] of Object.entries(enf)) if (Array.isArray(v)) se[k] = v.map(lire);
  donnees.evangilesEnfants = se;
}

// 1 quater. Le partage : le noyau reste dans la page ; le reste part dans un fichier par langue, réduit à cette langue.
// « garder » retire d'un objet les blocs des autres langues (un objet qui a au moins deux des clés fr, es, en).
const LANGUES = ['fr', 'es', 'en'];
const PAR_LANGUE = ['jours', 'temps', 'messe', 'i18n', 'bibliotheque', 'personnages', 'motsEnfants', 'evangiles', 'evangilesEnfants', 'prieresJour', 'contenus'];
const REDUITS = ['jours', 'temps', 'messe', 'i18n', 'bibliotheque', 'personnages', 'motsEnfants', 'evangilesEnfants'];
function garder(x, l) {
  if (Array.isArray(x)) return x.map((y) => garder(y, l));
  if (!x || typeof x !== 'object') return x;
  const n = LANGUES.filter((k) => k in x).length, o = {};
  for (const [k, v] of Object.entries(x)) if (n < 2 || !LANGUES.includes(k) || k === l) o[k] = garder(v, l);
  return o;
}
const noyau = {};
for (const [k, v] of Object.entries(donnees)) if (!PAR_LANGUE.includes(k)) noyau[k] = v;
const fichiersLangue = {};
for (const l of LANGUES) {
  const d = {};
  for (const k of PAR_LANGUE) d[k] = k === 'i18n' ? (donnees.i18n[l] ? { [l]: donnees.i18n[l] } : {}) : REDUITS.includes(k) ? garder(donnees[k], l) : donnees[k];
  // Le nom porte l'empreinte du contenu, comme les images : une page ancienne ne lit jamais des données nouvelles.
  const texte = JSON.stringify(d);
  fichiersLangue[l] = `donnees-${l}.${crypto.createHash('sha256').update(texte).digest('hex').slice(0, 8)}.json`;
  fs.writeFileSync(path.join(DIST, fichiersLangue[l]), texte);
}

// 2. Les fichiers copiés tels quels.
const BIBLES = { fr: 'bible.json', es: 'bible-es.json', en: 'bible-en.json' };
// Chaque Bible reçoit, livre par livre, sa présentation (« res ») et son lien vers l'USCCB (« src ») depuis
// data/livres-resumes.json, qui fait foi : le texte n'est écrit qu'à un endroit.
{
  const resumes = json('livres-resumes.json').livres;
  for (const [l, f] of Object.entries(BIBLES)) {
    const b = json(f);
    for (const x of b.livres) {
      const r = resumes[x.osis]; if (!r || !r[l]) throw new Error(`livres-resumes.json : ${x.osis} (${l}) manquant`);
      x.res = r[l]; x.src = 'https://bible.usccb.org/bible/' + r.slug + '/0';
    }
    fs.writeFileSync(path.join(DIST, `bible-${l}.json`), JSON.stringify(b));
  }
}
for (const f of fs.readdirSync(path.join(SRC, 'icons'))) fs.copyFileSync(path.join(SRC, 'icons', f), path.join(DIST, 'icons', f));
for (const f of fs.readdirSync(path.join(SRC, 'fonts'))) fs.copyFileSync(path.join(SRC, 'fonts', f), path.join(DIST, 'fonts', f));
// Les images reçoivent l'empreinte de leur contenu dans leur nom (img/bougie-jour.3fa2c1d0.webp) : une page restée
// en cache garde ses propres images, sans mélange entre deux versions (positions de la flamme, découpes…).
const IMAGES = {};
for (const f of fs.readdirSync(path.join(SRC, 'img'))) {
  const b = fs.readFileSync(path.join(SRC, 'img', f)), e = path.extname(f);
  const nom = f.slice(0, -e.length) + '.' + crypto.createHash('sha256').update(b).digest('hex').slice(0, 8) + e;
  fs.writeFileSync(path.join(DIST, 'img', nom), b); IMAGES[f] = 'img/' + nom;
}
fs.copyFileSync(path.join(SRC, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));

// 3. La page : CSS et JS intégrés, données sérialisées sans « < » (pas de fin de balise script possible).
let html = lire(path.join(SRC, 'index.html'));
const css = lire(path.join(SRC, 'css/app.css')).replace(/url\(img\/([^)]+)\)/g, (t, f) => { if (!IMAGES[f]) throw new Error('app.css : image ' + f + ' absente'); return 'url(' + IMAGES[f] + ')'; });
html = html.replace('<link rel="stylesheet" href="css/app.css">', () => '<style>\n' + css + '\n</style>');
const js = ['liturgie.js', 'references.js', 'latin.js', 'aquarelle.js', 'app.js'].map((f) => lire(path.join(SRC, 'js', f))).join('\n');
const scripts = /<script src="js\/liturgie\.js"><\/script>\s*<script src="js\/references\.js"><\/script>\s*<script src="js\/latin\.js"><\/script>\s*<script src="js\/aquarelle\.js"><\/script>\s*<script src="js\/app\.js"><\/script>/;
if (!scripts.test(html)) throw new Error('src/index.html : balises script introuvables');
html = html.replace(scripts, () => '<script>\nwindow.ORA_BIBLES = ' + JSON.stringify(Object.fromEntries(Object.keys(BIBLES).map((l) => [l, `bible-${l}.json`]))) + ';\nwindow.ORA_IMG = ' + JSON.stringify(IMAGES) + ';\nwindow.ORA_DONNEES = ' + JSON.stringify(fichiersLangue) + ';\nwindow.ORA_DATA = ' +
  JSON.stringify(noyau).replace(/</g, '\\u003c') + ';\n' + js + '\n</script>');
fs.writeFileSync(path.join(DIST, 'index.html'), html);

// 4. Le service worker : l'app (page, contenus des trois langues, polices, icônes) est mise en cache à l'installation ;
//    chaque Bible seulement quand elle est demandée (la langue en cours, puis une autre si l'on change de langue).
const coquille = ['index.html', 'manifest.webmanifest', ...Object.values(fichiersLangue), ...fs.readdirSync(path.join(DIST, 'icons')).map((f) => 'icons/' + f), ...fs.readdirSync(path.join(DIST, 'img')).map((f) => 'img/' + f), ...fs.readdirSync(path.join(DIST, 'fonts')).filter((f) => f.endsWith('.woff2')).map((f) => 'fonts/' + f)];
const empreinte = crypto.createHash('sha256');
for (const f of [...coquille, ...Object.keys(BIBLES).map((l) => `bible-${l}.json`)].sort()) empreinte.update(f).update(fs.readFileSync(path.join(DIST, f)));
const VERSION = 'ora-' + empreinte.digest('hex').slice(0, 12);
const sw = lire(path.join(SRC, 'sw.js')).replace('__VERSION__', VERSION).replace('__COQUILLE__', JSON.stringify(['./', ...coquille]));
fs.writeFileSync(path.join(DIST, 'sw.js'), sw);

// La page doit rester légère : au-delà de TAILLE_MAX, le build échoue (les contenus vont dans donnees-<langue>.json).
export const TAILLE_MAX = 500 * 1024;
const poids = fs.statSync(path.join(DIST, 'index.html')).size;
if (poids > TAILLE_MAX) throw new Error(`dist/index.html pèse ${(poids / 1024).toFixed(0)} Ko, plus que ${TAILLE_MAX / 1024} Ko : déplacer des données vers les fichiers par langue (PAR_LANGUE)`);
const taille = (f) => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + ' Ko';
console.log(`dist/ prêt (${VERSION}) : index.html ${taille('index.html')}, ` + Object.values(fichiersLangue).map((f) => `${f} ${taille(f)}`).join(', ') + ', ' + Object.keys(BIBLES).map((l) => `bible-${l}.json ${taille(`bible-${l}.json`)}`).join(', '));
