// Outils communs aux tests : moteur liturgique, données et parcours de toutes les dates.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

export const RACINE = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const require = createRequire(import.meta.url);
export const L = require(path.join(RACINE, 'src/js/liturgie.js'));
export const lireJson = (f) => JSON.parse(fs.readFileSync(path.join(RACINE, f), 'utf8'));
export const FETES = lireJson('data/fetes.json');

export function* dates(de, a) {
  for (let t = Date.UTC(...de); t <= Date.UTC(...a); t += 86400000) yield new Date(t).toISOString().slice(0, 10);
}
export const chercher = (dico, cles) => { for (const k of cles) if (dico[k]) return dico[k]; return null; };
