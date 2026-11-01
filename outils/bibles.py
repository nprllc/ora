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
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')

# Ordre catholique (celui de la Bible française) et identifiants OSIS
OSIS = ['Gen', 'Exod', 'Lev', 'Num', 'Deut', 'Josh', 'Judg', 'Ruth', '1Sam', '2Sam', '1Kgs', '2Kgs', '1Chr', '2Chr', 'Ezra', 'Neh',
        'Tob', 'Jdt', 'Esth', '1Macc', '2Macc', 'Job', 'Ps', 'Prov', 'Eccl', 'Song', 'Wis', 'Sir', 'Isa', 'Jer', 'Lam', 'Bar', 'Ezek', 'Dan',
        'Hos', 'Joel', 'Amos', 'Obad', 'Jonah', 'Mic', 'Nah', 'Hab', 'Zeph', 'Hag', 'Zech', 'Mal',
        'Matt', 'Mark', 'Luke', 'John', 'Acts', 'Rom', '1Cor', '2Cor', 'Gal', 'Eph', 'Phil', 'Col', '1Thess', '2Thess', '1Tim', '2Tim',
        'Titus', 'Phlm', 'Heb', 'Jas', '1Pet', '2Pet', '1John', '2John', '3John', 'Jude', 'Rev']

EN = {  # nom court, nom complet, abréviation (usage de la NABRE)
 'Gen': ('Genesis', 'Genesis', 'Gn'), 'Exod': ('Exodus', 'Exodus', 'Ex'), 'Lev': ('Leviticus', 'Leviticus', 'Lv'), 'Num': ('Numbers', 'Numbers', 'Nm'),
 'Deut': ('Deuteronomy', 'Deuteronomy', 'Dt'), 'Josh': ('Joshua', 'Joshua', 'Jos'), 'Judg': ('Judges', 'Judges', 'Jgs'), 'Ruth': ('Ruth', 'Ruth', 'Ru'),
 '1Sam': ('1 Samuel', '1 Samuel', '1 Sm'), '2Sam': ('2 Samuel', '2 Samuel', '2 Sm'), '1Kgs': ('1 Kings', '1 Kings', '1 Kgs'), '2Kgs': ('2 Kings', '2 Kings', '2 Kgs'),
 '1Chr': ('1 Chronicles', '1 Chronicles', '1 Chr'), '2Chr': ('2 Chronicles', '2 Chronicles', '2 Chr'), 'Ezra': ('Ezra', 'Ezra', 'Ezr'), 'Neh': ('Nehemiah', 'Nehemiah', 'Neh'),
 'Tob': ('Tobit', 'Tobit', 'Tb'), 'Jdt': ('Judith', 'Judith', 'Jdt'), 'Esth': ('Esther', 'Esther', 'Est'), '1Macc': ('1 Maccabees', '1 Maccabees', '1 Mc'),
 '2Macc': ('2 Maccabees', '2 Maccabees', '2 Mc'), 'Job': ('Job', 'Job', 'Jb'), 'Ps': ('Psalms', 'Psalms', 'Ps'), 'Prov': ('Proverbs', 'Proverbs', 'Prv'),
 'Eccl': ('Ecclesiastes', 'Ecclesiastes', 'Eccl'), 'Song': ('Song of Songs', 'Song of Songs', 'Sg'), 'Wis': ('Wisdom', 'Wisdom', 'Wis'), 'Sir': ('Sirach', 'Sirach', 'Sir'),
 'Isa': ('Isaiah', 'Isaiah', 'Is'), 'Jer': ('Jeremiah', 'Jeremiah', 'Jer'), 'Lam': ('Lamentations', 'Lamentations', 'Lam'), 'Bar': ('Baruch', 'Baruch', 'Bar'),
 'Ezek': ('Ezekiel', 'Ezekiel', 'Ez'), 'Dan': ('Daniel', 'Daniel', 'Dn'), 'Hos': ('Hosea', 'Hosea', 'Hos'), 'Joel': ('Joel', 'Joel', 'Jl'), 'Amos': ('Amos', 'Amos', 'Am'),
 'Obad': ('Obadiah', 'Obadiah', 'Ob'), 'Jonah': ('Jonah', 'Jonah', 'Jon'), 'Mic': ('Micah', 'Micah', 'Mi'), 'Nah': ('Nahum', 'Nahum', 'Na'), 'Hab': ('Habakkuk', 'Habakkuk', 'Hb'),
 'Zeph': ('Zephaniah', 'Zephaniah', 'Zep'), 'Hag': ('Haggai', 'Haggai', 'Hg'), 'Zech': ('Zechariah', 'Zechariah', 'Zec'), 'Mal': ('Malachi', 'Malachi', 'Mal'),
 'Matt': ('Matthew', 'The Gospel according to Matthew', 'Mt'), 'Mark': ('Mark', 'The Gospel according to Mark', 'Mk'), 'Luke': ('Luke', 'The Gospel according to Luke', 'Lk'),
 'John': ('John', 'The Gospel according to John', 'Jn'), 'Acts': ('Acts of the Apostles', 'The Acts of the Apostles', 'Acts'), 'Rom': ('Romans', 'The Letter to the Romans', 'Rom'),
 '1Cor': ('1 Corinthians', 'The First Letter to the Corinthians', '1 Cor'), '2Cor': ('2 Corinthians', 'The Second Letter to the Corinthians', '2 Cor'),
 'Gal': ('Galatians', 'The Letter to the Galatians', 'Gal'), 'Eph': ('Ephesians', 'The Letter to the Ephesians', 'Eph'), 'Phil': ('Philippians', 'The Letter to the Philippians', 'Phil'),
 'Col': ('Colossians', 'The Letter to the Colossians', 'Col'), '1Thess': ('1 Thessalonians', 'The First Letter to the Thessalonians', '1 Thes'),
 '2Thess': ('2 Thessalonians', 'The Second Letter to the Thessalonians', '2 Thes'), '1Tim': ('1 Timothy', 'The First Letter to Timothy', '1 Tm'),
 '2Tim': ('2 Timothy', 'The Second Letter to Timothy', '2 Tm'), 'Titus': ('Titus', 'The Letter to Titus', 'Ti'), 'Phlm': ('Philemon', 'The Letter to Philemon', 'Phlm'),
 'Heb': ('Hebrews', 'The Letter to the Hebrews', 'Heb'), 'Jas': ('James', 'The Letter of James', 'Jas'), '1Pet': ('1 Peter', 'The First Letter of Peter', '1 Pt'),
 '2Pet': ('2 Peter', 'The Second Letter of Peter', '2 Pt'), '1John': ('1 John', 'The First Letter of John', '1 Jn'), '2John': ('2 John', 'The Second Letter of John', '2 Jn'),
 '3John': ('3 John', 'The Third Letter of John', '3 Jn'), 'Jude': ('Jude', 'The Letter of Jude', 'Jude'), 'Rev': ('Revelation', 'The Book of Revelation', 'Rv')}

ES = {  # nom court, nom complet, abréviation (usage de la Conférence épiscopale espagnole)
 'Gen': ('Génesis', 'Génesis', 'Gn'), 'Exod': ('Éxodo', 'Éxodo', 'Ex'), 'Lev': ('Levítico', 'Levítico', 'Lv'), 'Num': ('Números', 'Números', 'Nm'),
 'Deut': ('Deuteronomio', 'Deuteronomio', 'Dt'), 'Josh': ('Josué', 'Josué', 'Jos'), 'Judg': ('Jueces', 'Jueces', 'Jue'), 'Ruth': ('Rut', 'Rut', 'Rut'),
 '1Sam': ('1 Samuel', '1 Samuel', '1 Sam'), '2Sam': ('2 Samuel', '2 Samuel', '2 Sam'), '1Kgs': ('1 Reyes', '1 Reyes', '1 Re'), '2Kgs': ('2 Reyes', '2 Reyes', '2 Re'),
 '1Chr': ('1 Crónicas', '1 Crónicas', '1 Cr'), '2Chr': ('2 Crónicas', '2 Crónicas', '2 Cr'), 'Ezra': ('Esdras', 'Esdras', 'Esd'), 'Neh': ('Nehemías', 'Nehemías', 'Neh'),
 'Tob': ('Tobías', 'Tobías', 'Tob'), 'Jdt': ('Judit', 'Judit', 'Jdt'), 'Esth': ('Ester', 'Ester', 'Est'), '1Macc': ('1 Macabeos', '1 Macabeos', '1 Mac'),
 '2Macc': ('2 Macabeos', '2 Macabeos', '2 Mac'), 'Job': ('Job', 'Job', 'Job'), 'Ps': ('Salmos', 'Salmos', 'Sal'), 'Prov': ('Proverbios', 'Proverbios', 'Prov'),
 'Eccl': ('Eclesiastés', 'Eclesiastés (Qohélet)', 'Ecl'), 'Song': ('Cantar de los Cantares', 'Cantar de los Cantares', 'Cant'), 'Wis': ('Sabiduría', 'Sabiduría', 'Sab'),
 'Sir': ('Eclesiástico', 'Eclesiástico (Sirácida)', 'Eclo'), 'Isa': ('Isaías', 'Isaías', 'Is'), 'Jer': ('Jeremías', 'Jeremías', 'Jer'), 'Lam': ('Lamentaciones', 'Lamentaciones', 'Lam'),
 'Bar': ('Baruc', 'Baruc', 'Bar'), 'Ezek': ('Ezequiel', 'Ezequiel', 'Ez'), 'Dan': ('Daniel', 'Daniel', 'Dan'), 'Hos': ('Oseas', 'Oseas', 'Os'), 'Joel': ('Joel', 'Joel', 'Jl'),
 'Amos': ('Amós', 'Amós', 'Am'), 'Obad': ('Abdías', 'Abdías', 'Abd'), 'Jonah': ('Jonás', 'Jonás', 'Jon'), 'Mic': ('Miqueas', 'Miqueas', 'Miq'), 'Nah': ('Nahún', 'Nahún', 'Nah'),
 'Hab': ('Habacuc', 'Habacuc', 'Hab'), 'Zeph': ('Sofonías', 'Sofonías', 'Sof'), 'Hag': ('Ageo', 'Ageo', 'Ag'), 'Zech': ('Zacarías', 'Zacarías', 'Zac'), 'Mal': ('Malaquías', 'Malaquías', 'Mal'),
 'Matt': ('Mateo', 'Evangelio según san Mateo', 'Mt'), 'Mark': ('Marcos', 'Evangelio según san Marcos', 'Mc'), 'Luke': ('Lucas', 'Evangelio según san Lucas', 'Lc'),
 'John': ('Juan', 'Evangelio según san Juan', 'Jn'), 'Acts': ('Hechos de los Apóstoles', 'Hechos de los Apóstoles', 'Hch'), 'Rom': ('Romanos', 'Carta a los Romanos', 'Rom'),
 '1Cor': ('1 Corintios', 'Primera carta a los Corintios', '1 Cor'), '2Cor': ('2 Corintios', 'Segunda carta a los Corintios', '2 Cor'), 'Gal': ('Gálatas', 'Carta a los Gálatas', 'Gál'),
 'Eph': ('Efesios', 'Carta a los Efesios', 'Ef'), 'Phil': ('Filipenses', 'Carta a los Filipenses', 'Flp'), 'Col': ('Colosenses', 'Carta a los Colosenses', 'Col'),
 '1Thess': ('1 Tesalonicenses', 'Primera carta a los Tesalonicenses', '1 Tes'), '2Thess': ('2 Tesalonicenses', 'Segunda carta a los Tesalonicenses', '2 Tes'),
 '1Tim': ('1 Timoteo', 'Primera carta a Timoteo', '1 Tim'), '2Tim': ('2 Timoteo', 'Segunda carta a Timoteo', '2 Tim'), 'Titus': ('Tito', 'Carta a Tito', 'Tit'),
 'Phlm': ('Filemón', 'Carta a Filemón', 'Flm'), 'Heb': ('Hebreos', 'Carta a los Hebreos', 'Heb'), 'Jas': ('Santiago', 'Carta de Santiago', 'Sant'),
 '1Pet': ('1 Pedro', 'Primera carta de san Pedro', '1 Pe'), '2Pet': ('2 Pedro', 'Segunda carta de san Pedro', '2 Pe'), '1John': ('1 Juan', 'Primera carta de san Juan', '1 Jn'),
 '2John': ('2 Juan', 'Segunda carta de san Juan', '2 Jn'), '3John': ('3 Juan', 'Tercera carta de san Juan', '3 Jn'), 'Jude': ('Judas', 'Carta de san Judas', 'Jds'),
 'Rev': ('Apocalipsis', 'Apocalipsis', 'Ap')}

# Abréviations de la Douay-Rheims (drb.tsv) -> OSIS
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


def ecrire(livres_txt, noms, nom_fichier, source, resumes):
    out = []
    for i, osis in enumerate(OSIS):
        court, nom, abr = noms[osis]
        ch = livres_txt[osis]
        out.append({'osis': osis, 'id': abr.replace(' ', ''), 'abr': abr, 'nom': nom, 'court': court, 't': 'NT' if i >= 46 else 'AT',
                    'ch': ch, 'p': [[1] for _ in ch], 'l': [[] for _ in ch], 'res': resumes.get(osis, ''), 'src': 'https://bible.usccb.org/bible/' + RESUMES[osis]['slug'] + '/0'})
    json.dump({'source': source, 'livres': out}, open(f'{OUT}/{nom_fichier}', 'w'), ensure_ascii=False, separators=(',', ':'))
    print(nom_fichier, sum(len(c) for b in out for c in b['ch']), 'versets', sum(1 for b in out for c in b['ch'] for v in c if not v), 'vides')


RESUMES = json.load(open(f'{OUT}/livres-resumes.json'))['livres']
def charger_resumes(langue):
    return {o: r[langue] for o, r in RESUMES.items()}


# --- Anglais : Douay-Rheims
txt = collections.defaultdict(lambda: collections.defaultdict(dict))
for r in csv.reader(open(f'{SRC}/drb/drb.tsv'), delimiter='\t'):
    txt[DRB[r[1]]][int(r[3])][int(r[4])] = nettoie(r[5], 'en')
livres = {}
for osis in OSIS:
    chap = {c: [v[k] if k in v else '' for k in range(1, max(v) + 1)] for c, v in txt[osis].items()}
    livres[osis] = psaumes_hebreux(chap) if osis == 'Ps' else [chap[c] for c in sorted(chap)]
ecrire(livres, EN, 'bible-en.json', 'Douay-Rheims Bible, Challoner revision (1899 American edition), public domain', charger_resumes('en'))

# --- Espagnol : Biblia Platense (Straubinger)
c = sqlite3.connect(f'{SRC}/biblia-elim/modulos/sqlite/SpaPlatense.sqlite')
txt = collections.defaultdict(lambda: collections.defaultdict(dict))
for osis, chap, v, t in c.execute('select b.osis, chapter, verse, text from verses join books b using(book_id)'):
    txt[osis][chap][v] = nettoie(t, 'es')
livres = {}
for osis in OSIS:
    chap = {k: [v[n] if n in v else '' for n in range(1, max(v) + 1)] for k, v in txt[osis].items()}
    livres[osis] = psaumes_hebreux(chap) if osis == 'Ps' else [chap[k] for k in sorted(chap)]
ecrire(livres, ES, 'bible-es.json', 'Biblia Platense, traducción de Mons. Juan Straubinger (1948-1951), dominio público', charger_resumes('es'))

# --- Français : on ajoute l'identifiant OSIS à la Bible Crampon
fr = json.load(open(f'{OUT}/bible.json'))
for i, b in enumerate(fr['livres']):
    b['osis'] = OSIS[i]; b['res'] = RESUMES[OSIS[i]]['fr']; b['src'] = 'https://bible.usccb.org/bible/' + RESUMES[OSIS[i]]['slug'] + '/0'
json.dump(fr, open(f'{OUT}/bible.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print('bible.json : identifiants OSIS ajoutés')
