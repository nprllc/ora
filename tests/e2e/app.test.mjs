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
async function ouvrir(date, langue, { region = null, marques = null, url = serveur.url } = {}) {
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: langue, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const erreurs = [], requetes = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('request', (r) => requetes.push(r.url()));
  await page.clock.setFixedTime(new Date(date + 'T12:00:00'));
  await page.addInitScript(([l, r, m]) => {
    localStorage.setItem('ora.reglages', JSON.stringify({ langue: l, region: r, mode: 'jour' }));
    if (m) localStorage.setItem('ora.marques', JSON.stringify(m));
  }, [langue, region, marques]);
  await page.goto(url);
  await page.waitForFunction(() => document.querySelector('.section-jour') && !document.querySelector('.charge'), null, { timeout: 15000 });
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

test('2027-11-05, sans contenu éditorial : l\'accueil n\'est pas réduit à l\'idée du jour, « En famille » n\'est pas vide', async () => {
  const { ctx, page } = await ouvrir('2027-11-05', 'fr');
  const etiquettes = await texte(page, '.section-jour .etiquette');
  assert.ok(etiquettes.length >= 4, String(etiquettes));
  assert.ok(etiquettes.some((e) => /ÉVANGILE/i.test(e)) && etiquettes.some((e) => /PRIÈRE/i.test(e)) && etiquettes.some((e) => /TEMPS|FÊTE/i.test(e)), String(etiquettes));
  await page.click('.barre [data-id=famille]');
  await page.waitForTimeout(800);
  assert.ok((await page.$$('.section-jour')).length >= 2, 'En famille : prière et Évangile');
  await ctx.close();
});

test('régions : l\'Épiphanie le 6 janvier 2027 en Espagne (Mt 2, 1-12), le 3 janvier en France', async () => {
  let o = await ouvrir('2027-01-06', 'es', { region: 'es' });
  assert.match(await page(o).textContent('h1'), /Epifan/);
  assert.ok((await texte(o.page, '.section-jour .s-ref')).some((t) => /Mt 2, 1-12/.test(t)));
  await o.ctx.close();
  o = await ouvrir('2027-01-03', 'fr', { region: 'fr' });
  assert.match(await o.page.textContent('h1'), /Épiphanie/);
  await o.ctx.close();
  o = await ouvrir('2027-01-06', 'fr', { region: 'fr' });
  assert.doesNotMatch(await o.page.textContent('h1'), /Épiphanie/);
  await o.ctx.close();
});
function page(o) { return o.page; }

test('favoris : un favori qui ne désigne aucun verset est retiré du stockage', async () => {
  const { ctx, page } = await ouvrir('2026-11-03', 'en', { marques: [{ o: 'Matt', c: 99, v: 1 }, { o: 'Matt', c: 5, v: 3 }] });
  await page.click('[data-action=aller][data-id=menu]');
  await page.click('[data-action=aller][data-id=favoris]');
  await page.waitForSelector('.favori');
  const lignes = await texte(page, '.favori b');
  assert.deepEqual(lignes, ['Matthew 5:3']);
  assert.deepEqual(JSON.parse(await page.evaluate(() => localStorage.getItem('ora.marques'))), [{ o: 'Matt', c: 5, v: 3 }]);
  await ctx.close();
});

test('Pentecôte 2027 : un Évangile sur deux chapitres (Jn 15, 26-27 ; 16, 12-15) est surligné dans les deux chapitres', async () => {
  const { ctx, page } = await ouvrir('2027-05-16', 'fr');
  await page.click('[data-action=lecture][data-id=evangile] >> nth=0');
  await page.click('.lecture [data-action=passage-evangile]');
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

test('hors ligne : après une première visite, l\'app s\'ouvre sans réseau, même servie depuis un autre chemin', async () => {
  const autre = await servir(DIST, 0, '/un-autre-chemin/');
  const ctx = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: 'fr' });
  const p = await ctx.newPage();
  await p.goto(autre.url);
  await p.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
  await p.reload();
  await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  await p.waitForTimeout(1500); // la Bible de la langue en cours est mise en cache à la demande
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForSelector('.section-jour', { timeout: 15000 });
  assert.ok((await p.textContent('h1')).trim().length > 2);
  const caches = await p.evaluate(async () => { const k = await caches.keys(); const c = await caches.open(k[0]); return (await c.keys()).map((r) => new URL(r.url).pathname); });
  assert.equal(caches.filter((u) => /bible-/.test(u)).length, 1, 'une seule Bible en cache : ' + caches.join(', '));
  await ctx.close(); autre.fermer();
});
