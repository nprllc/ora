"""
Ora — prépare les Bibles anglaise et espagnole au même format que la Bible française.
  - anglais : Douay-Rheims, révision Challoner (édition américaine de 1899), domaine public
              source : dépôt ecclesia-dev/drb (drb.tsv)
  - espagnol : Biblia Platense de Mons. Juan Straubinger, domaine public (module CrossWire SpaPlatense)
              source : dépôt OmarGonD/biblia-elim (modulos/sqlite/SpaPlatense.sqlite)
Les deux suivent la numérotation de la Vulgate pour les Psaumes : on la ramène à la numérotation hébraïque,
celle de la Bible française et de la liturgie actuelle.
Chaque livre reçoit un identifiant OSIS commun aux trois langues.
"""
import csv, json, re, sqlite3, sys, collections

import os
# Sources (hors dépôt, plus de 150 Mo) : voir README, « Les Bibles ». Dossier en variable d'environnement ORA_SOURCES.
SRC = os.environ.get('ORA_SOURCES', 'sources')
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
# Ce script ne réécrit jamais data/ : il écrit dans outils/sortie/ ; on compare, puis on reporte à la main ce qui doit l'être.
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sortie')
os.makedirs(OUT, exist_ok=True)

# Ordre catholique (celui de la Bible française) et identifiants OSIS
OSIS = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh',
        'Tob', 'Jdt', 'Esth', '1Macc', '2Macc', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Wis', 'Sir', 'Isa', 'Jer', 'Lam', 'Bar', 'Ezek', 'Dan',
        'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
        'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim',
        'Titus', 'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev']

# Noms des livres (nom court, nom complet, abréviation) : lus dans data/, qui fait foi (aucun texte n'est écrit ici).
def noms(fichier):
    return {b['osis']: (b['court'], b['nom'], b['abr']) for b in json.load(open(f'{DATA}/{fichier}'))['livres']}
EN = noms('bible-en.json')
ES = noms('bible-es.json')

DRB = {'Gn': 'Gen', 'Ex': 'Exod', 'Lv': 'Lev', 'Nm': 'Num', 'Dt': 'Deut', 'Jos': 'Josh', 'Jgs': 'Judg', 'Ru': 'Ruth', '1Sm': '1Sam', '2Sm': '2Sam',
       '1Kgs': '1Kgs', '2Kgs': '2Kgs', '1Chr': '1Chr', '2Chr': '2Chr', 'Ezr': 'Ezra', 'Neh': 'Neh', 'Tb': 'Tob', 'Jdt': 'Jdt', 'Est': 'Esth', 'Jb': 'Job',
       'Ps': 'Ps', 'Prv': 'Prov', 'Eccl': 'Eccl', 'Sg': 'Song', 'Wis': 'Wis', 'Sir': 'Sir', 'Is': 'Isa', 'Jer': 'Jer', 'Lam': 'Lam', 'Bar': 'Bar', 'Ez': 'Ezek',
       'Dn': 'Dan', 'Hos': 'Hos', 'Jl': 'Joel', 'Am': 'Amos', 'Ob': 'Obad', 'Jon': 'Jonah', 'Mi': 'Mic', 'Na': 'Nah', 'Hb': 'Hab', 'Zep': 'Zeph', 'Hg': 'Hag',
       'Zec': 'Zech', 'Mal': 'Mal', '1Mc': '1Macc', '2Mc': '2Macc', 'Mt': 'Matt', 'Mk': 'Mark', 'Lk': 'Luke', 'Jn': 'John', 'Acts': 'Acts', 'Rom': 'Rom',
       '1Cor': '1Cor', '2Cor': '2Cor', 'Gal': 'Gal', 'Eph': 'Eph', 'Phil': 'Phil', 'Col': 'Col', '1Thes': '1Thess', '2Thes': '2Thess', '1Tm': '1Tim',
       '2Tm': '2Tim', 'Ti': 'Titus', 'Phlm': 'Phlm', 'Heb': 'Heb', 'Jas': 'Jas', '1Pt': '1Pet', '2Pt': '2Pet', '1Jn': '1John', '2Jn': '2John', '3Jn': '3John',
       'Jude': 'Jude', 'Apc': 'Rev'}


def psaumes_hebreux(vulg):
    """vulg : dict {psaume (Vulgate) : [versets]} -> liste des 150 psaumes en numérotation hébraïque."""
    h = {}
    for n in range(1, 9): h[n] = vulg[n]
    h[9] = vulg[9][:21]; h[10] = vulg[9][21:]
    for n in range(11, 114): h[n] = vulg[n - 1]
    h[114] = vulg[113][:8]; h[115] = vulg[113][8:]
    h[116] = vulg[114] + vulg[115]
    for n in range(117, 147): h[n] = vulg[n - 1]
    h[147] = vulg[146] + vulg[147]
    for n in range(148, 151): h[n] = vulg[n]
    return [h[n] for n in range(1, 151)]


def nettoie(t, langue):
    t = re.sub(r'\s+', ' ', t).strip()
    t = t.replace('{}', '').replace('{', '').replace('}', '')
    return t


def ecrire(livres_txt, noms, nom_fichier, source):
    out = []
    for i, osis in enumerate(OSIS):
        court, nom, abr = noms[osis]
        ch = livres_txt[osis]
        out.append({'osis': osis, 'id': abr.replace(' ', ''), 'abr': abr, 'nom': nom, 'court': court, 't': 'NT' if i >= 46 else 'AT',
                    'ch': ch, 'p': [[1] for _ in ch], 'l': [[] for _ in ch]})  # « res » et « src » : ajoutés au build depuis data/livres-resumes.json
    json.dump({'source': source, 'livres': out}, open(f'{OUT}/{nom_fichier}', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(nom_fichier, sum(len(c) for b in out for c in b['ch']), 'versets', sum(1 for b in out for c in b['ch'] for v in c if not v), 'vides')



# --- Anglais : Douay-Rheims
txt = collections.defaultdict(lambda: collections.defaultdict(dict))
for r in csv.reader(open(f'{SRC}/drb/drb.tsv'), delimiter='\t'):
    txt[DRB[r[1]]][int(r[3])][int(r[4])] = nettoie(r[5], 'en')
livres = {}
for osis in OSIS:
    chap = {c: [v[k] if k in v else '' for k in range(1, max(v) + 1)] for c, v in txt[osis].items()}
    livres[osis] = psaumes_hebreux(chap) if osis == 'Ps' else [chap[c] for c in sorted(chap)]
ecrire(livres, EN, 'bible-en.json', 'Douay-Rheims Bible, Challoner revision (1899 American edition), public domain')

# --- Espagnol : Biblia Platense (Straubinger)
c = sqlite3.connect(f'{SRC}/biblia-elim/modulos/sqlite/SpaPlatense.sqlite')
txt = collections.defaultdict(lambda: collections.defaultdict(dict))
for osis, chap, v, t in c.execute('select b.osis, chapter, verse, text from verses join books b using(book_id)'):
    txt[osis][chap][v] = nettoie(t, 'es')
livres = {}
for osis in OSIS:
    chap = {k: [v[n] if n in v else '' for n in range(1, max(v) + 1)] for k, v in txt[osis].items()}
    livres[osis] = psaumes_hebreux(chap) if osis == 'Ps' else [chap[k] for k in sorted(chap)]
ecrire(livres, ES, 'bible-es.json', 'Biblia Platense, traducción de Mons. Juan Straubinger (1948-1951), dominio público')

# --- Français : on ajoute l'identifiant OSIS à la Bible Crampon
fr = json.load(open(f'{DATA}/bible.json'))
for i, b in enumerate(fr['livres']):
    b['osis'] = OSIS[i]
json.dump(fr, open(f'{OUT}/bible.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('bible.json : identifiants OSIS ajoutés')
