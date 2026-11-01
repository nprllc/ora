// Ora — lecture des références bibliques à la française : « Mt 9, 35 – 10, 1.5a.6-8 », « Jn 15, 26-27 ; 16, 12-15 ».
// Renvoie le livre OSIS et la liste des versets [chapitre, verset], tronquée à la longueur réelle des chapitres.

export const LIVRES_EVANGILES = { Mt: 'Matt', Mc: 'Mark', Lc: 'Luke', Jn: 'John', Jean: 'John', Matthieu: 'Matt', Marc: 'Mark', Luc: 'Luke' };

const nombre = (s) => parseInt(String(s).replace(/[a-z]/g, ''), 10);

// moderne = true : on ne tronque pas selon la longueur des chapitres de la Bible française (numérotation du Lectionnaire).
export function versets(ref, livres, moderne) {
  const propre = ref.replace(/ /g, ' ').replace(/[–—]/g, '-').trim();
  const m = propre.match(/^(\S+)\s+(.*)$/);
  if (!m || !LIVRES_EVANGILES[m[1]]) throw new Error('Référence illisible : ' + ref);
  const osis = LIVRES_EVANGILES[m[1]];
  const reste = m[2].replace(/\s+/g, '');
  const brut = [];
  let chap = null;
  for (let seg of reste.split(/[.;]/)) {
    if (!seg) continue;
    if (seg.split('-')[0].includes(',')) { const i = seg.indexOf(','); chap = nombre(seg.slice(0, i)); seg = seg.slice(i + 1); }
    const [a, b] = seg.split('-');
    if (b !== undefined) {
      if (b.includes(',')) { // d'un chapitre à l'autre : 9,35-10,1
        const [c2, v2] = b.split(',');
        for (let v = nombre(a); v <= 200; v++) brut.push([chap, v]);
        chap = nombre(c2);
        for (let v = 1; v <= nombre(v2); v++) brut.push([chap, v]);
      } else for (let v = nombre(a); v <= nombre(b); v++) brut.push([chap, v]);
    } else brut.push([chap, nombre(a)]);
  }
  const livre = livres && livres[osis];
  const longueur = moderne ? { Matt: { 17: 27 }, Mark: { 8: 38, 9: 50 } } : {};
  const liste = livre ? brut.filter(([c, v]) => v <= ((longueur[osis] || {})[c] || 999)).filter(([c, v]) => livre.ch[c - 1] && v <= livre.ch[c - 1].length) : brut;
  return { osis, liste };
}
