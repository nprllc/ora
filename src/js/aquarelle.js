/*
 * Ora — aquarelle générative.
 * Des dizaines de voiles presque transparents, déformés au hasard, se superposent sur un grain de papier.
 *
 * Le ciel est peint en couches séparées pour pouvoir, après l'animation d'entrée, les animer doucement :
 *  - « fond »    : le papier (immobile) ;
 *  - « nuage »   : un calque par nuage du ciel (flottement lent, en CSS) ;
 *  - « mer »     : un calque par bande de la mer de nuages, peint en motif raccordable
 *                  sur deux largeurs d'écran pour défiler sans couture (en CSS) ;
 *  - « dessus »  : le reflet du soleil et la ligne d'horizon (immobiles).
 * L'animation d'entrée (le ciel qui se peint) précède le mouvement lent des nuages (classe « vivant ») :
 * seules les classes CSS ajoutées à la fin décident du mouvement ensuite.
 */
(function (global) {
  'use strict';
  var MARGE = 16; // marge des calques de nuages, pour qu'un léger flottement ne découvre jamais un bord

  var CIELS = {
    jour: {
      fond: '#FFFBF5', grain: [175, 70, 14], horizon: { y: 255, couleur: 'rgba(120,108,96,0.22)', mode: 'multiply' },
      nuages: [
        { e: [70, 40, 230, 120], c: [214, 228, 241], a: 0.03, n: 36, v: 0.22, m: 'multiply' },
        { e: [280, 90, 250, 120], c: [252, 226, 208], a: 0.028, n: 40, v: 0.2, m: 'multiply' },
        { e: [120, 150, 170, 70], c: [247, 224, 228], a: 0.022, n: 30, v: 0.22, m: 'multiply' },
        { e: [276, 168, 120, 100], c: [244, 208, 150], a: 0.036, n: 38, v: 0.22, m: 'multiply' }
      ],
      mer: [
        { b: [248, 300], c: [214, 225, 236], a: 0.03, n: 36, v: 0.12, m: 'multiply', haut: 226, h: 110 },
        { b: [300, 420], c: [196, 211, 226], a: 0.022, n: 30, v: 0.14, m: 'multiply', haut: 270, h: 200 }
      ],
      reflet: { b: [150, 262, 340, 274], c: [252, 230, 190], a: 0.04, n: 16, v: 0.18, m: 'multiply' }
    },
    nuit: {
      fond: '#161E35', grainClair: true, horizon: { y: 318, couleur: 'rgba(160,172,204,0.35)', mode: 'source-over' },
      nuages: [
        { e: [160, 40, 300, 150], c: [10, 14, 30], a: 0.05, n: 40, v: 0.2, m: 'source-over' },
        { e: [300, 170, 200, 120], c: [62, 76, 122], a: 0.035, n: 36, v: 0.22, m: 'screen' },
        { e: [276, 154, 110, 96], c: [214, 182, 128], a: 0.02, n: 34, v: 0.24, m: 'screen' }
      ],
      mer: [
        { b: [286, 344], c: [92, 110, 152], a: 0.03, n: 38, v: 0.13, m: 'screen', haut: 262, h: 110 },
        { b: [330, 440], c: [12, 18, 36], a: 0.04, n: 34, v: 0.14, m: 'source-over', haut: 300, h: 170 }
      ],
      reflet: null
    },
    // La mer de nuages qui borde le bas de chaque page (fond transparent : la page apparaît dessous).
    'bas-jour': {
      sansFond: true, nuages: [],
      mer: [
        { b: [70, 120], c: [214, 225, 236], a: 0.03, n: 34, v: 0.12, m: 'multiply' },
        { b: [112, 240], c: [196, 211, 226], a: 0.024, n: 30, v: 0.13, m: 'multiply' }
      ]
    },
    'bas-nuit': {
      sansFond: true, nuages: [],
      mer: [
        { b: [70, 122], c: [92, 110, 152], a: 0.03, n: 34, v: 0.13, m: 'screen' },
        { b: [112, 240], c: [10, 15, 30], a: 0.045, n: 32, v: 0.13, m: 'source-over' }
      ]
    }
  };

  var MELANGE = { multiply: 'multiply', screen: 'screen', 'source-over': 'normal' };

  function peindre(conteneur, mode, anime, fin) {
    if (conteneur._raf) cancelAnimationFrame(conteneur._raf);
    var cfg = CIELS[mode] || CIELS.jour;
    var W = conteneur.clientWidth || 390, H = conteneur.clientHeight || 470;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var dx = (W - 390) / 2; // la composition est pensée pour 390 px : on la recentre sur les écrans plus larges
    conteneur.innerHTML = '';

    var s = mode === 'nuit' ? 2207 : mode === 'jour' ? 1031 : 4421;
    function r() { s |= 0; s = (s + 0x6D2B79F5) | 0; var t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
    function gs() { return Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r()); }

    function calque(classe, x, y, w, h, melange) {
      var div = document.createElement('div');
      div.className = 'couche ' + classe;
      div.style.cssText = 'left:' + x + 'px;top:' + y + 'px;width:' + w + 'px;height:' + h + 'px;mix-blend-mode:' + (melange || 'normal');
      var cv = document.createElement('canvas');
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      div.appendChild(cv); conteneur.appendChild(div);
      var g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr); // on dessine en coordonnées du ciel
      return { div: div, g: g };
    }

    function ell(cx, cy, rx, ry, n) { var p = []; for (var i = 0; i < n; i++) { var a = i / n * Math.PI * 2; p.push({ x: dx + cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry }); } return p; }
    function deform(pts, depth, v, ferme) {
      for (var d = 0; d < depth; d++) {
        var o = [], nb = ferme ? pts.length : pts.length - 1;
        for (var i = 0; i < nb; i++) {
          var a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b.x - a.x, b.y - a.y);
          o.push(a); o.push({ x: (a.x + b.x) / 2 + gs() * len * v, y: (a.y + b.y) / 2 + gs() * len * v });
        }
        if (!ferme) o.push(pts[pts.length - 1]);
        pts = o;
      }
      return pts;
    }
    function remplir(g, pts, col, m, decalage) {
      g.globalCompositeOperation = m; g.fillStyle = col; g.beginPath();
      g.moveTo(pts[0].x + decalage, pts[0].y);
      for (var i = 1; i < pts.length; i++) g.lineTo(pts[i].x + decalage, pts[i].y);
      g.closePath(); g.fill();
    }
    function couleur(w) { return 'rgba(' + w.c.join(',') + ',' + w.a + ')'; }

    // 1. Le papier.
    if (!cfg.sansFond) {
    var fond = calque('fond', 0, 0, W, H);
    fond.g.globalCompositeOperation = 'source-over';
    fond.g.fillStyle = cfg.fond; fond.g.fillRect(0, 0, W, H);
    var gc = document.createElement('canvas'); gc.width = 180; gc.height = 180;
    var gx = gc.getContext('2d'), id = gx.createImageData(180, 180);
    for (var i = 0; i < id.data.length; i += 4) {
      if (cfg.grainClair) { id.data[i] = 235; id.data[i + 1] = 228; id.data[i + 2] = 214; id.data[i + 3] = r() * 9; }
      else { var v = cfg.grain[0] + r() * cfg.grain[1]; id.data[i] = v; id.data[i + 1] = v * 0.96; id.data[i + 2] = v * 0.9; id.data[i + 3] = r() * cfg.grain[2]; }
    }
    gx.putImageData(id, 0, 0);
    fond.g.fillStyle = fond.g.createPattern(gc, 'repeat'); fond.g.fillRect(0, 0, W, H);

    }

    var ops = [];

    // 2. Les nuages du ciel : un calque chacun.
    // Le calque de chaque nuage est taillé sur ses voiles réels (plus une marge) : aucun bord net possible.
    function bornes(polys) {
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      polys.forEach(function (p) { p.forEach(function (q) { if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x; if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y; }); });
      return { x: Math.floor(x0 - MARGE), y: Math.floor(y0 - MARGE), w: Math.ceil(x1 - x0 + 2 * MARGE), h: Math.ceil(y1 - y0 + 2 * MARGE) };
    }
    cfg.nuages.forEach(function (w, k) {
      var base = deform(ell(w.e[0], w.e[1], w.e[2], w.e[3], 10), 2, w.v, true), col = couleur(w), polys = [];
      for (var j = 0; j < w.n; j++) polys.push(deform(base, 3, w.v * 0.9, true));
      var b = bornes(polys), c = calque('nuage n' + k, b.x, b.y, b.w, b.h, MELANGE[w.m]);
      polys.forEach(function (p) { ops.push(function () { remplir(c.g, p, col, w.m, 0); }); });
    });

    // 3. La mer de nuages : des bandes raccordables, peintes sur deux largeurs d'écran.
    //    Seuls les bords haut et bas sont déformés ; les extrémités tombent pile sur 0 et W, donc les copies se raccordent sans couture.
    cfg.mer.forEach(function (w, k) {
      var pas = 8, haut = [], bas = [];
      for (var q = 0; q <= pas; q++) { haut.push({ x: W * q / pas, y: w.b[0] }); bas.push({ x: W * q / pas, y: w.b[1] }); }
      var bh = deform(haut, 2, w.v, false), bb = deform(bas, 2, w.v, false), col = couleur(w), polys = [];
      // Chaque voile est légèrement décalé en hauteur : les bords se fondent comme un lavis, sans arête nette.
      var fondu = w.fondu || 9;
      function decale(pts, dy) { return pts.map(function (p) { return { x: p.x, y: p.y + dy }; }); }
      for (var j = 0; j < w.n; j++) polys.push(decale(deform(bh, 3, w.v * 0.9, false), gs() * fondu).concat(decale(deform(bb, 3, w.v * 0.9, false), gs() * fondu).reverse()));
      var b = bornes(polys), c = calque('mer m' + k, 0, b.y, 2 * W, b.h, MELANGE[w.m]);
      polys.forEach(function (poly) { ops.push(function () { for (var t = -1; t <= 2; t++) remplir(c.g, poly, col, w.m, t * W); }); });
    });

    if (!cfg.sansFond) {
    // 4. Le reflet du soleil et la ligne d'horizon : immobiles.
    var dessus = calque('dessus', 0, 0, W, H, cfg.reflet ? 'multiply' : 'normal');
    if (cfg.reflet) {
      var rf = cfg.reflet, bandeReflet = [];
      for (var q = 0; q <= 4; q++) bandeReflet.push({ x: dx + rf.b[0] + (rf.b[2] - rf.b[0]) * q / 4, y: rf.b[1] });
      for (q = 4; q >= 0; q--) bandeReflet.push({ x: dx + rf.b[0] + (rf.b[2] - rf.b[0]) * q / 4, y: rf.b[3] });
      var baseR = deform(bandeReflet, 2, rf.v, true);
      for (var j2 = 0; j2 < rf.n; j2++) { (function (p) { ops.push(function () { remplir(dessus.g, p, couleur(rf), rf.m, 0); }); })(deform(baseR, 3, rf.v * 0.9, true)); }
    }
    ops.push(function () {
      var g = dessus.g;
      g.globalCompositeOperation = 'source-over'; g.strokeStyle = cfg.horizon.couleur; g.lineWidth = 0.6; g.beginPath();
      g.moveTo(-10, cfg.horizon.y); g.lineTo(W + 10, cfg.horizon.y); // la ligne d'horizon : parfaitement droite
      g.stroke();
    });

    }

    var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!anime || reduit) { ops.forEach(function (f) { f(); }); if (fin) fin(); return; }
    var j3 = 0;
    (function etape() {
      for (var k = 0; k < 2 && j3 < ops.length; k++, j3++) ops[j3]();
      if (j3 < ops.length) conteneur._raf = requestAnimationFrame(etape); else if (fin) fin();
    })();
  }

  global.OraAquarelle = { peindre: peindre };
})(this);
