// Tests de bout en bout (Playwright) sur dist/ : à lancer après « npm run build ».
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { chromium } from 'playwright';
import { servir } from './serveur.mjs';

const DIST = path.join(path.dirname(new URL(import.meta.url).pathname), '../../dist');
let navigateur, serveur;
before(async () => { navigateur = await chromium.launch(); serveur = await servir(DIST); });
after(async () => { await navigateur.close(); serveur.fermer(); });

// Ouvre l'app à une date et une heure données, dans une langue et (facultatif) une région.
async function ouvrir(date, langue, { region = null, marques = null, url = serveur.url, heure = '12:00', bienvenue = true } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: langue, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const erreurs = [], requetes = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('request', (r) => requetes.push(r.url()));
  await page.clock.setFixedTime(new Date(date + 'T' + heure + ':00'));
  await page.addInitScript(([l, r, m, b]) => {
    localStorage.setItem('ora.reglages', JSON.stringify({ langue: l, region: r, mode: 'jour', bienvenue: b }));
    if (m) localStorage.setItem('ora.marques', JSON.stringify(m));
  }, [langue, region, marques, bienvenue]);
  await page.goto(url);
  if (!bienvenue) await page.waitForSelector('#bienvenue', { timeout: 15000 });
  else await page.waitForFunction(() => document.querySelector('.section-jour') && !document.querySelector('.charge'), null, { timeout: 15000 });
  return { ctx, page, erreurs, requetes };
}
const texte = (page, sel) => page.$$eval(sel, (els) => els.map((e) => e.innerText.trim()));

const DATES = ['2026-11-01', '2026-12-25', '2027-03-28', '2027-05-16', '2027-11-05'];
for (const date of DATES) for (const langue of ['fr', 'es', 'en']) {
  test(`${date} en ${langue} : titre, prière et Évangile`, async () => {
    const { ctx, page, erreurs } = await ouvrir(date, langue);
    assert.ok((await page.textContent('h1')).trim().length > 2);
    const etiquettes = await texte(page, '.section-jour .etiquette');
    assert.ok(etiquettes.length >= 3, `au moins 3 sections, vu : ${etiquettes}`);
    assert.ok((await texte(page, '.s-priere')).every((t) => t.length > 10), 'prière');
    assert.ok((await texte(page, '.section-jour .versets')).some((v) => v.length > 40), 'Évangile');
    assert.equal((await page.$$('.section-jour .versets sup')).length, 0, 'pas de numéros de versets sur l\'accueil');
    assert.match(await page.textContent('.surtitre'), /20\d\d/, 'l\'année figure dans la date');
    assert.deepEqual(erreurs, []);
    await ctx.close();
  });
}

test('2027-11-05, jour ordinaire : l\'accueil puise dans la bibliothèque (citation, réflexion, histoire, portrait, « Le savais-tu ? »), « En famille » n\'est pas vide', async () => {
  const { ctx, page } = await ouvrir('2027-11-05', 'fr');
  const etiquettes = await texte(page, '.section-jour .etiquette');
  assert.ok(etiquettes.length >= 4, String(etiquettes));
  assert.ok(etiquettes.some((e) => /ÉVANGILE/i.test(e)) && etiquettes.some((e) => /PRIÈRE/i.test(e)) && ['CITATION', 'RÉFLEXION', 'HISTOIRE', 'PORTRAIT', 'SAVAIS'].every((m) => etiquettes.some((e) => e.toUpperCase().includes(m))), String(etiquettes));
  await page.click('.barre [data-id=famille]');
  await page.waitForTimeout(800);
  assert.ok((await page.$$('.section-jour')).length >= 2, 'En famille : prière et Évangile');
  await ctx.close();
});

test('régions : l\'Épiphanie le 6 janvier 2027 en Espagne (Mt 2, 1-12), le 3 janvier en France', async () => {
  let o = await ouvrir('2027-01-06', 'es', { region: 'es' });
  assert.match(await page(o).textContent('h1'), /Epifan/);
  assert.ok((await texte(o.page, '.section-jour .s-ref')).some((t) => /Mt 2, 1-12/.test(t))); // le passage d'Ora pour l'Épiphanie
  await o.ctx.close();
  o = await ouvrir('2027-01-03', 'fr', { region: 'fr' });
  assert.match(await o.page.textContent('h1'), /Épiphanie/);
  await o.ctx.close();
  o = await ouvrir('2027-01-06', 'fr', { region: 'fr' });
  assert.doesNotMatch(await o.page.textContent('h1'), /Épiphanie/);
  await o.ctx.close();
});
function page(o) { return o.page; }

test('le jour d\'Ora commence à 5 h : à 2 h du matin, c\'est encore le contenu de la veille', async () => {
  let o = await ouvrir('2026-11-03', 'fr', { heure: '02:00' });
  assert.match(await o.page.textContent('.surtitre'), /2 novembre 2026/);
  await o.ctx.close();
  o = await ouvrir('2026-11-03', 'fr', { heure: '05:01' });
  assert.match(await o.page.textContent('.surtitre'), /3 novembre 2026/);
  await o.ctx.close();
});

test('réglages : la roue dentée referme les réglages et ramène exactement là où l\'on était', async () => {
  const { ctx, page } = await ouvrir('2026-11-03', 'fr');
  await page.evaluate(() => window.scrollTo(0, 500));
  const y = await page.evaluate(() => window.scrollY);
  await page.$eval('.bouton-menu', (b) => b.click()); // comme un toucher, sans que Playwright fasse défiler la page
  await page.waitForSelector('[data-action=langue]');
  await page.$eval('[data-cle=taille][data-id=grand]', (b) => b.click());
  await page.$eval('.bouton-menu', (b) => b.click());
  await page.waitForSelector('.section-jour');
  assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - y) < 2, 'même position');
  assert.ok(!(await page.$('[data-action=langue]')), 'les réglages sont refermés');
  await ctx.close();
});

test('mot du jour : en bas d\'Aujourd\'hui, jamais le même deux jours de suite, et il mène au lexique', async () => {
  const mots = [];
  for (const d of ['2026-11-03', '2026-11-04', '2026-11-05']) {
    const { ctx, page } = await ouvrir(d, 'fr');
    const derniere = page.locator('.section-jour').last();
    assert.equal((await derniere.locator('.etiquette').textContent()).trim(), 'Mot du jour');
    assert.match(await derniere.locator('.lire').innerText(), /Accéder au lexique/);
    mots.push((await derniere.locator('.s-titre').innerText()).trim());
    if (d === '2026-11-05') { await derniere.locator('.s-accroche').click(); await page.waitForSelector('#liste-mots'); }
    await ctx.close();
  }
  assert.notEqual(mots[0], mots[1]); assert.notEqual(mots[1], mots[2]);
});

test('bienvenue : un écran à part, une seule fois ; les mots s\'envolent, puis Aujourd\'hui ; ensuite dans les Réglages', async () => {
  const { ctx, page } = await ouvrir('2026-11-03', 'fr', { bienvenue: false });
  assert.ok(await page.$('#bienvenue'), 'écran de bienvenue');
  assert.ok(!(await page.$('.section-jour')), 'rien d\'autre derrière');
  await page.click('.be-commencer');
  await page.waitForSelector('#bienvenue.descend');
  await page.waitForSelector('.section-jour', { timeout: 15000 });
  await page.waitForSelector('#bienvenue', { state: 'detached', timeout: 15000 });
  assert.ok(JSON.parse(await page.evaluate(() => localStorage.getItem('ora.reglages'))).bienvenue, 'gardé sur le téléphone');
  await page.$eval('.bouton-menu', (b) => b.click());
  assert.match(await page.textContent('.a-propos'), /À propos d'Ora/);
  await ctx.close();
});

test('Prier : la messe pas à pas, sous les mots de la foi', async () => {
  const { ctx, page } = await ouvrir('2026-11-03', 'fr');
  await page.click('[data-action=onglet][data-id=prier]');
  await page.$eval('[data-action=aller][data-id=messe]', (b) => b.click());
  await page.waitForSelector('.messe-etapes');
  assert.equal(await page.$$eval('.messe-partie', (x) => x.length), 5);
  await ctx.close();
});

test('favoris : un favori qui ne désigne aucun verset est retiré du stockage', async () => {
  const { ctx, page } = await ouvrir('2026-11-03', 'en', { marques: [{ o: 'Matt', c: 99, v: 1 }, { o: 'Matt', c: 5, v: 3 }] });
  await page.click('[data-action=onglet][data-id=bible]');
  await page.click('[data-action=aller][data-id=favoris]');
  await page.waitForSelector('.favori');
  const lignes = await texte(page, '.favori b');
  assert.deepEqual(lignes, ['Matthew 5:3']);
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('ora.marques'))), [{ o: 'Matt', c: 5, v: 3 }]);
  await ctx.close();
});

test('Pentecôte 2027 : l\'Évangile de la messe sur deux chapitres (Jn 15, 26-27 ; 16, 12-15) est surligné dans les deux chapitres', async () => {
  const { ctx, page } = await ouvrir('2027-05-16', 'fr');
  await page.click('[data-action=lecture][data-id=evangile] >> nth=0');
  await page.click('.lecture [data-action=passage-messe]'); // « L'Évangile de la messe aujourd'hui »
  await page.waitForSelector('.texte-bible');
  assert.deepEqual(await page.$$eval('.v.surligne', (v) => v.map((x) => x.id)), ['v26', 'v27']);
  await page.click('.nav-chap button:has-text("16")');
  await page.waitForSelector('.texte-bible');
  assert.deepEqual(await page.$$eval('.v.surligne', (v) => v.map((x) => x.id)), ['v12', 'v13', 'v14', 'v15']);
  await ctx.close();
});

test('versets utilisables au clavier (Entrée)', async () => {
  const { ctx, page } = await ouvrir('2026-11-03', 'fr');
  await page.click('.barre [data-id=bible]');
  await page.waitForSelector('[data-action=livre]');
  await page.click('[data-action=livre][data-id=Matt]');
  await page.click('.chapitres button >> nth=4');
  await page.waitForSelector('.v[role=button][tabindex="0"]');
  await page.focus('#v3');
  await page.keyboard.press('Enter');
  assert.equal(await page.getAttribute('#v3', 'aria-pressed'), 'true');
  await ctx.close();
});

test('aucune requête vers un autre domaine, et une seule Bible téléchargée à la première visite', async () => {
  const { ctx, page, requetes } = await ouvrir('2026-11-03', 'fr');
  await page.waitForTimeout(1500);
  const origine = new URL(serveur.url).origin;
  assert.deepEqual(requetes.filter((u) => !u.startsWith(origine) && !u.startsWith('data:') && !u.startsWith('blob:')), []);
  assert.deepEqual(requetes.filter((u) => /bible-/.test(u)).map((u) => u.replace(origine, '')), ['/bible-fr.json']);
  await ctx.close();
});

test('hors ligne : après une première visite, l\'app s\'ouvre sans réseau, même servie depuis un autre chemin, et change de langue', async () => {
  const autre = await servir(DIST, 0, '/un-autre-chemin/');
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr' });
  const p = await ctx.newPage();
  await p.addInitScript(() => localStorage.setItem('ora.reglages', JSON.stringify({ bienvenue: true })));
  await p.goto(autre.url);
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  await p.reload();
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  await p.waitForTimeout(1500); // la Bible de la langue en cours est mise en cache à la demande
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('.section-jour', { timeout: 15000 });
  assert.ok((await p.textContent('h1')).trim().length > 2);
  const caches = await p.evaluate(async () => { const out = []; for (const k of await caches.keys()) for (const r of await (await caches.open(k)).keys()) out.push(k + ':' + new URL(r.url).pathname); return out; });
  assert.equal(caches.filter((u) => /bible-/.test(u)).length, 1, 'une seule Bible en cache : ' + caches.join(', '));
  assert.ok(caches.some((u) => /^ora-bibles:.*bible-fr\.json$/.test(u)), 'la Bible est dans son propre cache, qui survit aux mises à jour');
  for (const l of ['fr', 'es', 'en']) assert.ok(caches.some((u) => new RegExp(`/donnees-${l}\\.[0-9a-f]{8}\\.json$`).test(u)), `donnees-${l} en cache : ` + caches.join(', '));
  // Toujours hors ligne : passer en espagnol lit donnees-es.json depuis le cache.
  await p.$eval('.bouton-menu', (b) => b.click());
  await p.$eval('[data-action=langue][data-id=es]', (b) => b.click());
  await p.waitForFunction(() => document.documentElement.lang === 'es', null, { timeout: 15000 });
  await p.$eval('.bouton-menu', (b) => b.click());
  await p.waitForSelector('.section-jour', { timeout: 15000 });
  assert.ok((await p.textContent('body')).includes('Evangelio del día'), 'contenus espagnols hors ligne');
  await ctx.close(); autre.fermer();
});

test('référencement : ?lang=es ouvre Ora en espagnol (titre, description, langue de la page, adresse de référence) et garde ce choix', async () => {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr-FR', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(serveur.url + '?lang=es');
  await page.waitForFunction(() => document.querySelector('#bienvenue') || document.querySelector('.section-jour'), null, { timeout: 15000 });
  assert.equal(await page.getAttribute('html', 'lang'), 'es');
  assert.match(await page.title(), /primeros pasos hacia Dios/);
  assert.match(await page.getAttribute('meta[name=description]', 'content'), /Evangelio/);
  assert.equal(await page.getAttribute('link[rel=canonical]', 'href'), 'https://ora-app.co/?lang=es');
  assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem('ora.reglages'))).langue, 'es');
  await ctx.close();
});

test('référencement : icônes, aperçus de lien, robots.txt, sitemap.xml et page 404 sont publiés', async () => {
  for (const f of ['favicon.ico', 'icons/favicon.svg', 'icons/icon-180.png', 'icons/icon-maskable-512.png', 'og-fr.jpg', 'og-es.jpg', 'og-en.jpg', 'robots.txt', 'sitemap.xml', '404.html']) {
    const r = await fetch(serveur.url + f);
    assert.equal(r.status, 200, f);
  }
  const html = await (await fetch(serveur.url)).text();
  for (const m of ['og:image', 'twitter:card', 'hreflang="es"', 'application/ld+json', 'apple-touch-icon']) assert.ok(html.includes(m), m);
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(ld['@type'], 'WebApplication');
  const manifeste = await (await fetch(serveur.url + 'manifest.webmanifest')).json();
  assert.ok(manifeste.icons.some((i) => i.purpose === 'maskable'));
});
