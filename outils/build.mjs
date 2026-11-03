// Ora — build : fabrique dist/ à partir de src/ et data/.
// - dist/index.html : la page, avec le CSS, le JS et les données (data/*.json) intégrés ;
// - dist/bible-fr.json, bible-es.json, bible-en.json : les trois Bibles, chargées à la demande ;
// - dist/sw.js : le service worker, avec une VERSION calculée d'après le contenu des fichiers (empreinte) ;
// - dist/manifest.webmanifest, dist/icons/, dist/fonts/.
// Aucune dépendance : node outils/build.mjs (ou npm run build).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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
  prieresJour: json('prieres-jour.json'),
  ui: json('i18n/ui.json'),
  i18n: { es: json('i18n/es.json'), en: json('i18n/en.json') },
  guideFamilleFr: json('guide-famille.json'),
  messe: json('messe.json'),
  auteurs: json('auteurs.json'),
  abreviations: json('abreviations.json')
};

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
