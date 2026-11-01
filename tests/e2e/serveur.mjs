// Petit serveur statique pour les tests de bout en bout (dist/), sans dépendance.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };
// prefixe : servir l'app sous un autre chemin (par exemple « /un-autre-chemin/ ») pour vérifier qu'elle ne dépend pas de son adresse.
export function servir(dossier, port = 0, prefixe = '/') {
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      const chemin = decodeURIComponent(new URL(q.url, 'http://x').pathname);
      if (!chemin.startsWith(prefixe)) { r.writeHead(404); return r.end(); }
      let f = path.join(dossier, chemin.slice(prefixe.length - 1));
      if (f.endsWith('/')) f += 'index.html';
      fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); r.end(d); });
    });
    s.listen(port, '127.0.0.1', () => ok({ url: `http://localhost:${s.address().port}${prefixe}`, fermer: () => s.close() }));
  });
}
