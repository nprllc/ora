// Ora — build : fabrique dist/ à partir de src/ et data/.
// - dist/index.html : la page, avec le CSS, le JS et les données (data/*.json) intégrés ;
// - dist/bible-fr.json, bible-es.json, bible-en.json : les trois Bibles, chargées à la demande ;
// - dist/sw.js : le service worker, avec une VERSION calculée d'après le contenu des fichiers (empreinte) ;
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
  const bibles = Object.fromEntries(Object.entries({ fr: 'bible.json', es: 'bible-es.json', en: 'bible-en.json' }).map(([l, f]) => [l, Object.fromEntries(json(f).livres.map((b) => [b.osis, b]))]));
  const lire = ([ref, titre]) => {
    const { osis, liste } = lireRef(ref, bibles.fr, true);
    if (!liste.length) throw new Error(`évangiles : ${ref} : aucun verset`);
    const e = { ref, titre, osis, v: liste, ora: 1 };
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
}

// 2. Les fichiers copiés tels quels.
const BIBLES = { fr: 'bible.json', es: 'bible-es.json', en: 'bible-en.json' };
for (const [l, f] of Object.entries(BIBLES)) fs.copyFileSync(path.join(DATA, f), path.join(DIST, `bible-${l}.json`));
for (const f of fs.readdirSync(path.join(SRC, 'icons'))) fs.copyFileSync(path.join(SRC, 'icons', f), path.join(DIST, 'icons', f));
for (const f of fs.readdirSync(path.join(SRC, 'fonts'))) fs.copyFileSync(path.join(SRC, 'fonts', f), path.join(DIST, 'fonts', f));
for (const f of fs.readdirSync(path.join(SRC, 'img'))) fs.copyFileSync(path.join(SRC, 'img', f), path.join(DIST, 'img', f));
fs.copyFileSync(path.join(SRC, 'manifest.webmanifest'), path.join(DIST, 'manifest.webmanifest'));

// 3. La page : CSS et JS intégrés, données sérialisées sans « < » (pas de fin de balise script possible).
let html = lire(path.join(SRC, 'index.html'));
html = html.replace('<link rel="stylesheet" href="css/app.css">', () => '<style>\n' + lire(path.join(SRC, 'css/app.css')) + '\n</style>');
const js = ['liturgie.js', 'references.js', 'latin.js', 'aquarelle.js', 'app.js'].map((f) => lire(path.join(SRC, 'js', f))).join('\n');
const scripts = /<script src="js\/liturgie\.js"><\/script>\s*<script src="js\/references\.js"><\/script>\s*<script src="js\/latin\.js"><\/script>\s*<script src="js\/aquarelle\.js"><\/script>\s*<script src="js\/app\.js"><\/script>/;
if (!scripts.test(html)) throw new Error('src/index.html : balises script introuvables');
html = html.replace(scripts, () => '<script>\nwindow.ORA_BIBLES = ' + JSON.stringify(Object.fromEntries(Object.keys(BIBLES).map((l) => [l, `bible-${l}.json`]))) + ';\nwindow.ORA_DATA = ' +
  JSON.stringify(donnees).replace(/</g, '\\u003c') + ';\n' + js + '\n</script>');
fs.writeFileSync(path.join(DIST, 'index.html'), html);

// 4. Le service worker : l'app (page, polices, icônes) est mise en cache à l'installation ;
//    chaque Bible seulement quand elle est demandée (la langue en cours, puis une autre si l'on change de langue).
const coquille = ['index.html', 'manifest.webmanifest', ...fs.readdirSync(path.join(DIST, 'icons')).map((f) => 'icons/' + f), ...fs.readdirSync(path.join(DIST, 'img')).map((f) => 'img/' + f), ...fs.readdirSync(path.join(DIST, 'fonts')).filter((f) => f.endsWith('.woff2')).map((f) => 'fonts/' + f)];
const empreinte = crypto.createHash('sha256');
for (const f of [...coquille, ...Object.keys(BIBLES).map((l) => `bible-${l}.json`)].sort()) empreinte.update(f).update(fs.readFileSync(path.join(DIST, f)));
const VERSION = 'ora-' + empreinte.digest('hex').slice(0, 12);
const sw = lire(path.join(SRC, 'sw.js')).replace('__VERSION__', VERSION).replace('__COQUILLE__', JSON.stringify(['./', ...coquille]));
fs.writeFileSync(path.join(DIST, 'sw.js'), sw);

const taille = (f) => (fs.statSync(path.join(DIST, f)).size / 1024).toFixed(0) + ' Ko';
console.log(`dist/ prêt (${VERSION}) : index.html ${taille('index.html')}, ` + Object.keys(BIBLES).map((l) => `bible-${l}.json ${taille(`bible-${l}.json`)}`).join(', '));
