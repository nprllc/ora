// Le build : la page reste légère, et les contenus de chaque langue sont dans leur propre fichier, mis en cache
// par le service worker dès l'installation (pour que l'app s'ouvre hors ligne dans les trois langues).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const RACINE = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(RACINE, 'dist');
const SEUIL = 500 * 1024;

test('build : dist/index.html pèse moins de 500 Ko ; donnees-fr/es/en.json existent et sont dans le cache du service worker', () => {
  execFileSync('node', [path.join(RACINE, 'outils/build.mjs')], { stdio: 'pipe' });
  const poids = fs.statSync(path.join(DIST, 'index.html')).size;
  assert.ok(poids < SEUIL, `index.html : ${(poids / 1024).toFixed(0)} Ko`);
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(DIST, 'sw.js'), 'utf8');
  for (const l of ['fr', 'es', 'en']) {
    const f = `donnees-${l}.json`;
    const d = JSON.parse(fs.readFileSync(path.join(DIST, f), 'utf8'));
    assert.ok(d.jours[l] && Object.keys(d.jours).length === 1, `${f} : les titres des jours de la seule langue ${l}`);
    assert.ok(html.includes(`"${l}":"${f}"`), `${f} annoncé à la page (ORA_DONNEES)`);
    assert.ok(sw.includes(`"${f}"`), `${f} mis en cache à l'installation`);
  }
});

test('build : la limite de poids est vérifiée par le build lui-même', () => {
  const src = fs.readFileSync(path.join(RACINE, 'outils/build.mjs'), 'utf8');
  assert.match(src, /TAILLE_MAX = 500 \* 1024/);
  assert.match(src, /if \(poids > TAILLE_MAX\) throw/);
});
