// Fabrique les aperçus de lien d'Ora (Open Graph, 1200 x 630) dans src/racine/og-<langue>.jpg : c'est l'écran
// de bienvenue lui-même (le logo, « Bienvenue dans Ora », le petit texte, le ciel et ses nuages), photographié dans
// chaque langue, sans le bouton. Il faut d'abord fabriquer le site : npm run build, puis node outils/og.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { servir } from '../tests/e2e/serveur.mjs';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const SORTIE = path.join(ICI, '..', 'src', 'racine');
const serveur = await servir(path.join(ICI, '..', 'dist'));
const nav = await chromium.launch();
for (const lang of ['fr', 'es', 'en']) {
  const ctx = await nav.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: lang, serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(new Date('2026-06-21T11:00:00')); // un jour clair : l'écran de bienvenue de jour
  await p.goto(serveur.url + '?lang=' + lang);
  await p.waitForSelector('#bienvenue');
  await p.addStyleTag({ content: '.be-commencer { visibility: hidden; }' });
  await p.waitForTimeout(4500); // le ciel peint, le texte apparu
  await p.screenshot({ path: path.join(SORTIE, `og-${lang}.jpg`), type: 'jpeg', quality: 88 });
  await ctx.close();
}
await nav.close();
serveur.fermer();
console.log('aperçus de lien prêts : og-fr.jpg, og-es.jpg, og-en.jpg');
