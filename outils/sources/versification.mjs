// Correspondances de numérotation : le Lectionnaire (et les références écrites pour Ora) suivent la numérotation
// moderne (Nova Vulgata, Bible de Jérusalem) ; la Bible Crampon (fr) et la Douay-Rheims (en) gardent par endroits
// celle de la Vulgate, et la Biblia Platense (es) fusionne parfois deux versets. Chaque règle a été établie en
// lisant les trois Bibles verset par verset (voir README, « Numérotation des versets »).
// Format : pour une langue, « livre chapitre verset moderne » → liste de [chapitre, verset] dans cette Bible.
const R = { fr: {}, es: {}, en: {} };
const pose = (l, o, c, v, cible) => { R[l][`${o}.${c}.${v}`] = cible; };
const decale = (l, o, c, de, a, d, c2 = c) => { for (let v = de; v <= a; v++) pose(l, o, c, v, [[c2, v + d]]); };

// Mt 17 : en fr et en, les versets 14-15 sont réunis, puis tout est décalé d'un ; le v. 27 est coupé en deux en fr.
for (const l of ['fr', 'en']) { pose(l, 'Matt', 17, 15, [[17, 14]]); }
decale('fr', 'Matt', 17, 16, 26, -1); pose('fr', 'Matt', 17, 27, [[17, 26], [17, 27]]);
decale('en', 'Matt', 17, 16, 27, -1);
pose('es', 'Matt', 17, 27, [[17, 26]]);
// Mc 9 : en fr et en (Vulgate), le v. 9, 1 est le v. 8, 39 et le reste du chapitre est décalé d'un.
for (const l of ['fr', 'en']) { pose(l, 'Mark', 9, 1, [[8, 39]]); decale(l, 'Mark', 9, 2, 50, -1); }
pose('es', 'Mark', 9, 50, [[9, 49]]);
// Jn 6 : en en, le v. 51 est coupé en deux (51-52), puis tout est décalé d'un.
pose('en', 'John', 6, 51, [[6, 51], [6, 52]]); decale('en', 'John', 6, 52, 71, 1);
// Jn 11 : en en, les v. 56 et 57 sont réunis.
pose('en', 'John', 11, 57, [[11, 56]]);
// Lc 3 : en es, les v. 37 et 38 sont réunis.
pose('es', 'Luke', 3, 38, [[3, 37]]);

export default R;
