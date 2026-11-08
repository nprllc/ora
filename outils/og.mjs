// Fabrique les aperçus de lien d'Ora (Open Graph, 1200 x 630) dans src/racine/og-<langue>.jpg, avec la vraie police
// Sora et l'aquarelle du village, rendus par Chromium (Playwright). Lancer : node outils/og.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(ICI, '..', 'src');
const SORTIE = path.join(SRC, 'racine');
fs.mkdirSync(SORTIE, { recursive: true });

const b64 = (f) => fs.readFileSync(path.join(SRC, f)).toString('base64');
const POLICE = b64('fonts/sora-latin.woff2');
const POLICE_EXT = b64('fonts/sora-latin-ext.woff2');
const VILLAGE = b64('img/village-jour.webp');

const ACCROCHES = {
  fr: ['Les premiers pas vers Dieu', 'La fête du jour, une prière, l’Évangile. Gratuit, sans compte, hors ligne.'],
  es: ['Los primeros pasos hacia Dios', 'La fiesta del día, una oración, el Evangelio. Gratis, sin cuenta, sin conexión.'],
  en: ['First steps toward God', 'Today’s feast, a prayer, the Gospel. Free, no account, works offline.'],
};

// Le logo d'Ora (le O de lumière et « ra »), tel qu'il est dans l'en-tête de l'app.
const LOGO = `<svg viewBox="-2 -2 88 36" fill="none" stroke="#2F2924" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
<defs><radialGradient id="a"><stop offset="0" stop-color="#E8BE78" stop-opacity=".55"/><stop offset="1" stop-color="#E8BE78" stop-opacity="0"/></radialGradient></defs>
<circle cx="16" cy="16" r="11" fill="url(#a)" stroke="none"/>
<circle cx="16" cy="16" r="15.5" stroke="#D4AE6A" stroke-width="1.1"/><circle cx="16" cy="16" r="12.5"/>
<circle cx="15.3" cy="16.6" r="4.2" fill="#D6AA68" fill-opacity=".6" stroke="none"/><circle cx="16" cy="16" r="4.2" fill="#F2E5C6" stroke="none"/>
<path d="M37 29V14.5M37 20c0-4.6 3.2-7 8.2-6.6"/><circle cx="57.5" cy="21.5" r="7.5"/><path d="M65 14v15"/></svg>`;

const page = (lang, [titre, sous]) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
@font-face { font-family: Sora; font-weight: 200 600; src: url(data:font/woff2;base64,${POLICE}) format('woff2'); }
@font-face { font-family: Sora; font-weight: 200 600; src: url(data:font/woff2;base64,${POLICE_EXT}) format('woff2'); unicode-range: U+0100-024F, U+1E00-1EFF; }
html, body { margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; position: relative; font-family: Sora, sans-serif; color: #2F2924;
  background: radial-gradient(ellipse 70% 60% at 50% 0%, #FBE6D2 0%, rgba(251,230,210,0) 70%), linear-gradient(#FFF4E9, #FFFBF5 60%); }
.village { position: absolute; left: 60px; bottom: -6px; width: 1080px; mix-blend-mode: multiply; -webkit-mask-image: linear-gradient(transparent, #000 35%), linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); -webkit-mask-composite: source-in; mask-image: linear-gradient(transparent, #000 35%), linear-gradient(90deg, transparent, #000 10%, #000 90%, transparent); mask-composite: intersect; }
.bloc { position: absolute; top: 54px; left: 0; right: 0; text-align: center; }
.logo { width: 270px; display: block; margin: 0 auto 26px; }
h1 { font-weight: 300; font-size: 48px; letter-spacing: -.01em; margin: 0 0 14px; }
p { font-weight: 300; font-size: 24px; color: #6E6258; margin: 0; }
</style></head><body>
<img class="village" src="data:image/webp;base64,${VILLAGE}">
<div class="bloc"><div class="logo">${LOGO}</div><h1>${titre}</h1><p>${sous}</p></div>
</body></html>`;

const nav = await chromium.launch();
const p = await nav.newPage({ viewport: { width: 1200, height: 630 } });
for (const [lang, a] of Object.entries(ACCROCHES)) {
  await p.setContent(page(lang, a));
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(SORTIE, `og-${lang}.jpg`), type: 'jpeg', quality: 88 });
}
await nav.close();
console.log('aperçus de lien prêts : ' + Object.keys(ACCROCHES).map((l) => `og-${l}.jpg`).join(', '));
