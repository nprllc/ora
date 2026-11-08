"""
Ora — prières du jour et du soir, pour les adultes et pour les enfants.
Règle absolue : aucune prière n'est inventée. Deux sources seulement :
  1. des prières de la Bible (psaumes, cantiques, paroles adressées à Dieu), dont le texte est lu
     dans la Bible de chaque langue (Crampon, Straubinger, Douay-Rheims) ;
  2. des prières de la tradition de l'Église, dans leurs versions en usage en France, en Espagne
     et aux États-Unis.
Dans les prières, le nom divin « Yahweh / Yahvé » est remplacé par « le Seigneur / el Señor »,
comme le demande la Congrégation pour le culte divin (lettre du 29 juin 2008).
"""
import json, re

import os
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
BIBLES = {l: {b['osis']: b for b in json.load(open(f'{DATA}/{f}'))['livres']} for l, f in (('fr', 'bible.json'), ('es', 'bible-es.json'), ('en', 'bible-en.json'))}

# Les prières de la tradition (« traditionnelles ») et les notes qui expliquent le choix d'une prière (« notes ») sont
# écrites dans data/prieres-jour.json, qui fait foi : ce script ne contient aucun texte destiné à l'utilisateur.
# Il les relit, puis refabrique les listes (« pools »), les prières de fête et celles des réflexions.
_SOURCE = json.load(open(f'{DATA}/prieres-jour.json'))
TRAD = _SOURCE['traditionnelles']

# Prières bibliques : (identifiant, livre OSIS, chapitre, versets). Numérotation de la Bible française
# (hébraïque pour les psaumes) ; pour les autres langues, la correspondance est donnée à part si elle diffère.
MATIN = [
    ('ps70-2', 'Ps', 70, [2]), ('ps51-17', 'Ps', 51, [17]), ('ps5-4', 'Ps', 5, [4]), ('ps63-2', 'Ps', 63, [2]), ('ps25-4', 'Ps', 25, [4, 5]),
    ('ps51-12', 'Ps', 51, [12]), ('ps86-11', 'Ps', 86, [11]), ('ps90-14', 'Ps', 90, [14]), ('ps143-8', 'Ps', 143, [8]), ('ps119-105', 'Ps', 119, [105]),
    ('ps16-11', 'Ps', 16, [11]), ('ps27-1', 'Ps', 27, [1]), ('ps19-15', 'Ps', 19, [15]), ('ps139-23', 'Ps', 139, [23, 24]), ('ps145-1', 'Ps', 145, [1, 2]),
    ('ps92-2', 'Ps', 92, [2, 3]), ('ps59-17', 'Ps', 59, [17]), ('ps18-2', 'Ps', 18, [2, 3]), ('ps23-1', 'Ps', 23, [1]), ('ps62-2', 'Ps', 62, [2, 3]),
    ('ps73-25', 'Ps', 73, [25, 26]), ('ps84-2', 'Ps', 84, [2, 3]), ('ps103-1', 'Ps', 103, [1, 2]), ('ps104-1', 'Ps', 104, [1]), ('ps113-1', 'Ps', 113, [1, 2, 3]),
    ('ps117', 'Ps', 117, [1, 2]), ('ps146-2', 'Ps', 146, [2]), ('ps150-6', 'Ps', 150, [6]), ('ps8-2', 'Ps', 8, [2]),
    ('ps33-22', 'Ps', 33, [22]), ('ps34-2', 'Ps', 34, [2]), ('ps36-6', 'Ps', 36, [6]), ('ps42-2', 'Ps', 42, [2, 3]), ('ps61-2', 'Ps', 61, [2, 3]),
    ('ps67-2', 'Ps', 67, [2]), ('ps85-8', 'Ps', 85, [8]), ('ps89-2', 'Ps', 89, [2]), ('ps95-1', 'Ps', 95, [1]), ('ps100-1', 'Ps', 100, [1, 2]),
    ('ps116-1', 'Ps', 116, [1, 2]), ('ps119-18', 'Ps', 119, [18]), ('ps121-1', 'Ps', 121, [1, 2]), ('ps122-1', 'Ps', 122, [1]), ('ps131-1', 'Ps', 131, [1, 2]),
    ('ps139-1', 'Ps', 139, [1, 2, 3]), ('ps141-3', 'Ps', 141, [3]), ('ps148-1', 'Ps', 148, [1]), ('ps57-8', 'Ps', 57, [8, 9]), ('ps31-4', 'Ps', 31, [4]),
    ('lc1-46', 'Luke', 1, [46, 47]), ('1s3-10', '1Sam', 3, [10]), ('mc9-24', 'Mark', 9, [24]), ('lc17-5', 'Luke', 17, [5]), ('jn6-68', 'John', 6, [68, 69]),
    ('jn20-28', 'John', 20, [28]), ('lc11-1', 'Luke', 11, [1]), ('is6-8', 'Isa', 6, [8]), ('jr17-14', 'Jer', 17, [14]), ('lc1-38', 'Luke', 1, [38]),
    ('ps40-9', 'Ps', 40, [9]), ('ps71-1', 'Ps', 71, [1]), ('ps86-5', 'Ps', 86, [5]), ('ps108-2', 'Ps', 108, [2]), ('ps136-1', 'Ps', 136, [1]),
]
SOIR = [
    ('ps4-9', 'Ps', 4, [9]), ('ps141-2', 'Ps', 141, [2]), ('ps31-6', 'Ps', 31, [6]), ('ps91-1', 'Ps', 91, [1, 2]), ('ps16-1', 'Ps', 16, [1]),
    ('ps17-8', 'Ps', 17, [8]), ('ps63-7', 'Ps', 63, [7, 8]), ('ps119-55', 'Ps', 119, [55]), ('ps121-7', 'Ps', 121, [7, 8]), ('ps134', 'Ps', 134, [1, 2]),
    ('ps3-6', 'Ps', 3, [6]), ('ps51-3', 'Ps', 51, [3, 4]),
    ('ps86-1', 'Ps', 86, [1, 2]), ('ps88-2', 'Ps', 88, [2, 3]), ('ps103-13', 'Ps', 103, [13]), ('ps116-7', 'Ps', 116, [7]), ('ps130-1', 'Ps', 130, [1, 2]),
    ('ps130-5', 'Ps', 130, [5, 6]), ('ps131-2', 'Ps', 131, [2]), ('ps143-1', 'Ps', 143, [1]), ('ps143-10', 'Ps', 143, [10]), ('ps145-18', 'Ps', 145, [18]),
    ('ps147-3', 'Ps', 147, [3]), ('lc2-29', 'Luke', 2, [29, 30, 31, 32]), ('lc23-46', 'Luke', 23, [46]), ('lc24-29', 'Luke', 24, [29]), ('lc23-42', 'Luke', 23, [42]),
    ('lc18-13', 'Luke', 18, [13]), ('jn21-17', 'John', 21, [17]), ('ps25-6', 'Ps', 25, [6, 7]), ('ps32-5', 'Ps', 32, [5]), ('ps34-19', 'Ps', 34, [19]),
    ('ps38-22', 'Ps', 38, [22, 23]), ('ps40-18', 'Ps', 40, [18]), ('ps57-2', 'Ps', 57, [2]), ('ps61-5', 'Ps', 61, [5]), ('ps62-6', 'Ps', 62, [6]),
    ('ps119-76', 'Ps', 119, [76]), ('ps119-148', 'Ps', 119, [148]), ('ps6-3', 'Ps', 6, [3]), ('ps13-4', 'Ps', 13, [4]),
    ('ps25-16', 'Ps', 25, [16]), ('ps28-7', 'Ps', 28, [7]), ('ps31-15', 'Ps', 31, [15, 16]), ('ps37-5', 'Ps', 37, [5]), ('ps55-23', 'Ps', 55, [23]),
    ('ps56-4', 'Ps', 56, [4]), ('ps94-19', 'Ps', 94, [19]), ('ps123-1', 'Ps', 123, [1]), ('ps138-8', 'Ps', 138, [8]), ('ps23-4', 'Ps', 23, [4]),
    ('ps27-13', 'Ps', 27, [13, 14]), ('ps130-3', 'Ps', 130, [3, 4]), ('ps102-2', 'Ps', 102, [2]), ('ps39-5', 'Ps', 39, [5]), ('ps142-6', 'Ps', 142, [6]),
]
# Pour les enfants, Dieu est toujours tutoyé : pas de versets que la Crampon met au « vous » (1 S 3, 10 ; Jn 21, 17).
ENFANT_MATIN = [('signe-de-croix',), ('ps119-105', 'Ps', 119, [105]), ('ps118-24', 'Ps', 118, [24]), ('ps136-1', 'Ps', 136, [1]), ('ps139-14', 'Ps', 139, [14]),
                ('gloire-au-pere',), ('ps150-6', 'Ps', 150, [6]), ('ps23-1', 'Ps', 23, [1]), ('ps121-2', 'Ps', 121, [2]), ('ps5-4', 'Ps', 5, [4]),
                ('ps8-2', 'Ps', 8, [2]), ('ps100-2', 'Ps', 100, [2]), ('je-vous-salue-marie',), ('ps34-2', 'Ps', 34, [2])]
ENFANT_SOIR = [('ange-de-dieu',), ('ps4-9', 'Ps', 4, [9]), ('ps3-6', 'Ps', 3, [6]), ('ps17-8', 'Ps', 17, [8]), ('notre-pere',), ('ps121-8', 'Ps', 121, [8]),
               ('ps56-4', 'Ps', 56, [4]), ('lc24-29', 'Luke', 24, [29]), ('je-vous-salue-marie',), ('ps91-11', 'Ps', 91, [11])]

# Célébrations : prières choisies pour la fête, rangées par clé liturgique (celles que calcule OraLiturgie.jour()).
CELEBRATIONS = {
    'toussaint': {'jour': ('litanie-saints',), 'soir': ('ps16-11', 'Ps', 16, [11]),
                  'enfantJour': ('litanie-saints',), 'enfantSoir': ('mt5-8', 'Matt', 5, [8])},
    'defunts': {'jour': ('requiem',), 'soir': ('ps130-1', 'Ps', 130, [1, 2]),
                'enfantJour': ('requiem',), 'enfantSoir': ('jn11-25', 'John', 11, [25])},
    'avent-dim-1': {'jour': ('ap22-20', 'Rev', 22, [20])},          # 1er dimanche de l'Avent : Viens, Seigneur Jésus
    'immaculee-conception': {'jour': ('lc1-28', 'Luke', 1, [28])},
    'avent-1224': {'soir': ('lc2-14', 'Luke', 2, [14])},            # veille de Noël
    'noel': {'jour': ('lc2-14', 'Luke', 2, [14]), 'soir': ('lc2-29', 'Luke', 2, [29, 30, 31, 32])},
}

# Pourquoi cette prière ce jour-là, quand ce n'est pas évident : data/prieres-jour.json, « notes ».
NOTES = _SOURCE['notes']

# Ajustements par langue (versets décalés, titres de psaumes, paroles extraites d'un récit).
# Clé : (identifiant, langue) -> {'v': versets, 'de': début, 'a': fin (exclue)}
AJUST = {
    ('jn11-25', 'fr'): {'de': 'Je suis la résurrection'}, ('jn11-25', 'es'): {'de': 'Yo soy la resurrección'}, ('jn11-25', 'en'): {'de': 'I am the resurrection'},
    ('ps5-4', 'es'): {'de': 'Desde la mañana'}, ('ps5-4', 'en'): {'de': 'O Lord, in the morning'},
    ('ps25-4', 'en'): {'v': [4, 5], 'de': 'Shew'}, ('ps27-1', 'en'): {'de': 'The Lord is my light'},
    ('ps71-1', 'en'): {'de': 'In thee, O Lord'}, ('ps91-1', 'en'): {'de': 'He that dwelleth'},
    ('ps17-8', 'en'): {'de': 'keep me'}, ('ps150-6', 'en'): {'v': [5], 'de': 'let every spirit'},
    ('ps150-6', 'es'): {'v': [6]}, ('ps90-12', 'en'): {'de': 'So make'}, ('ps56-4', 'en'): {'v': [5], 'de': 'in God I have put'},
    ('ps39-5', 'en'): {'de': 'O Lord, make me know'}, ('ps131-2', 'en'): {'v': [1], 'de': 'Lord, my heart', 'a': ' Neither have'},
    ('mc9-24', 'fr'): {'v': [23]}, ('mc9-24', 'en'): {'v': [23], 'de': 'I do believe'}, ('jn6-68', 'en'): {'v': [69, 70], 'de': 'Lord, to whom'},
    ('lc1-38', 'en'): {'a': 'And the angel'}, ('lc23-46', 'en'): {'a': 'And saying'}, ('lc24-29', 'en'): {'a': 'And he went'},
    ('jn21-17', 'fr'): {'de': 'Seigneur, vous connaissez', 'a': 'Jésus lui dit'}, ('lc18-13', 'fr'): {'de': 'Ô Dieu'},
    ('lc2-29', 'en'): {'de': 'Now thou dost dismiss'}, ('jn21-17', 'es'): {'de': 'Señor, Tú lo sabes', 'a': '”. Díjole'},
    ('jn21-17', 'en'): {'de': 'Lord, thou knowest', 'a': 'He said'},
    ('lc2-14', 'en'): {'de': 'Glory to God'}, ('ps146-2', 'en'): {'a': ' Put not'}, ('ps130-3', 'en'): {'a': ' and by reason'},
    ('ps130-5', 'en'): {'v': [4, 5], 'de': 'My soul hath relied'}, ('ps61-2', 'en'): {'a': ' Thou hast conducted'}, ('ps40-9', 'en'): {'de': 'O my God'},
    ('ps131-1', 'en'): {'a': ' If I was not'}, ('ps18-2', 'fr'): {'de': 'Je t’aime'}, ('ps18-2', 'es'): {'de': 'Te amo'},
    # La Douay-Rheims dit « In peace in the self same I will sleep » (Ps 4, 9), incompréhensible seul :
    # en anglais, on prend le v. 7 du même psaume du soir.
    ('ps4-9', 'en'): {'v': [7], 'de': 'The light'},
    ('ap22-20', 'fr'): {'de': 'Venez'}, ('ap22-20', 'es'): {'de': 'ven, Señor'}, ('ap22-20', 'en'): {'de': 'Come, Lord'},
}
# Ponctuation et majuscules seulement (jamais les mots), corrigée avant le reste : une virgule de vocatif absente de la source,
# un point d'interrogation que la Douay-Rheims remplace par un point.
PONCT = {
    ('ps102-2', 'fr'): ('Yahweh écoute', 'Yahweh, écoute'), ('ps86-11', 'fr'): ('tes voies Yahweh', 'tes voies, Yahweh'),
    ('ps16-1', 'fr'): ('Garde-moi ô Dieu', 'Garde-moi, ô Dieu'), ('ps130-3', 'en'): ('who shall stand it.', 'who shall stand it?'),
    ('ps130-3', 'es'): ('Señor ¿quién', 'Señor, ¿quién'),
    ('mc9-24', 'fr'): ('Je crois (Seigneur)', 'Je crois, (Seigneur)'),
    # Majuscule de début de vers au milieu d'une phrase (vers poétiques de la Crampon mis bout à bout).
    ('ps113-1', 'fr'): ('nom de Yahweh, Que', 'nom de Yahweh, que'), ('lc2-14', 'fr'): ('hommes, Objet', 'hommes, objet'),
}

# Prières tirées d'un récit : on garde des paroles adressées à Dieu, ou des paroles bibliques que la tradition
# de l'Église prie déjà (salutation de l'ange dans le Je vous salue Marie, réponse de Marie dans l'Angélus,
# chant des anges dans le Gloria).
CITATION = {'1s3-10', 'mc9-24', 'lc17-5', 'jn6-68', 'jn20-28', 'lc11-1', 'is6-8', 'lc1-38', 'lc1-46', 'lc23-46', 'lc24-29', 'lc23-42', 'lc18-13', 'lc1-28', 'lc2-14', 'lc2-29'}

TITRES = [r"^(?:Cantique (?:des|pour les) montées\.\s*)?(?:De David\.\s*)?", r"^Au maître de chant\.\s*", r"^(?:Psaume|Hymne|Prière|Chant de louange)[^.]*\.\s*(?:De David\.\s*)?",
          r"^(?:Cántico gradual\.\s*)?(?:De David\.\s*)?", r"^Al maestro de coro\.\s*", r"^(?:Salmo|Oración|Alabanza)[^.]*\.\s*(?:De David\.\s*)?",
          r"^(?:A gradual canticle[^.]*\.\s*)", r"^(?:Unto the end,? )?(?:a |A )?(?:psalm|prayer|canticle)[^.]*\.\s*", r"^(?:For David himself|Praise, for David himself)\.\s*",
          r"^The inscription of a title to David himself\.\s*", r"^(?:ALEPH|BETH|GHIMEL|DALETH|HÉ|VAV|ZAÏN|HETH|TETH|YOD|CAPH|LAMED|MEM|NUN|SAMECH|AÏN|PHÉ|TSADÉ|QOPH|RESCH|SCHIN|THAV)\.\s*"]
LETTRES = r"\b(?:ALEPH|BETH|GHIMEL|DALETH|HÉ|VAV|ZAÏN|HETH|TETH|YOD|CAPH|LAMED|MEM|NUN|SAMECH|AÏN|PHÉ|TSADÉ|QOPH|RESCH|SCHIN|THAV|HET)\.\s*"


def nettoie(t, l):
    """Nom divin : « Yahweh / Yahvé » devient « le Seigneur / el Señor » (lettre de la Congrégation pour le culte
    divin, 29 juin 2008). D'abord les tournures avec préposition (de, à, en), puis l'apostrophe (vocatif : en début
    de phrase ou après une ponctuation, et suivie d'une ponctuation), puis le reste."""
    t = re.sub(r'\s*\n\s*', ' ', t).strip()
    t = re.sub(LETTRES, '', t)
    if l == 'fr':
        t = re.sub(r'\s*— Séla\.?', '', t)
        t = re.sub(r'\ben Yahweh\b', 'dans le Seigneur', t)
        t = re.sub(r'\bde Yahweh\b', 'du Seigneur', t); t = re.sub(r'\bà Yahweh\b', 'au Seigneur', t)
        t = re.sub(r'(^|[.!?«:;,]\s*|\bô\s+|voies\s+)Yahweh(?=( des armées)?\s*[,!;?.»])', lambda m: m.group(1) + 'Seigneur', t)  # vocatif
        t = re.sub(r'(^|[.!?«:]\s*)Yahweh', lambda m: m.group(1) + 'Le Seigneur', t)
        t = t.replace('Yahweh', 'le Seigneur')
    if l == 'es':
        t = t.replace('[', '').replace(']', '')
        t = re.sub(r'Hallelú\s*Yah', 'Aleluya', t)                      # comme dans la liturgie
        t = re.sub(r'\b([oO]h) Yah, Señor\b', r'\1 Señor', t)            # « Yah » : forme courte du nom divin
        t = re.sub(r'\ba Yah\b', 'al Señor', t); t = re.sub(r'\bYah\b', 'el Señor', t)
        t = re.sub(r'\ben Yahvé\b', 'en el Señor', t)
        t = re.sub(r'\bde Yahvé\b', 'del Señor', t); t = re.sub(r'\ba Yahvé\b', 'al Señor', t)
        t = re.sub(r'(^|[.!?¡¿“:;,]\s*|\b[oO]h\s+)Yahvé(?=( de los ejércitos)?\s*[,!;?.”])', lambda m: m.group(1) + 'Señor', t)  # vocativo
        t = re.sub(r'(^|[.!?¡¿“:]\s*)Yahvé', lambda m: m.group(1) + 'El Señor', t)
        t = t.replace('Yahvé', 'el Señor')
    return t.strip()


def extrait(t, l, pid, aj):
    if aj.get('de') and aj['de'] in t: t = t[t.index(aj['de']):]
    elif pid in CITATION and not aj.get('de'):
        if l == 'en':
            if ': ' in t: t = t[t.rindex(': ') + 2:] if pid not in ('lc1-46', 'lc2-29', 'lc1-38', 'lc23-46', 'lc24-29', 'lc18-13', 'lc1-28') else t[t.index(': ') + 2:]
        else:
            o, f = ('«', '»') if l == 'fr' else ('“', '”')
            if o in t: t = t[t.rindex(o) + 1:] if pid != 'lc2-29' else t[t.index(o) + 1:]
            if f in t: t = t[:t.index(f)]
    if aj.get('a') and aj['a'] in t: t = t[:t.index(aj['a'])]
    t = t.strip(' «»“”"—–-').strip()
    if t and t[-1] in ',;:': t = t[:-1] + '.'
    if t and t[-1] not in '.!?…': t += '.'
    if l == 'es' and t.endswith('!') and '¡' not in t: t = '¡' + t
    if l == 'es' and t.endswith('?') and '¿' not in t: t = '¿' + t
    i = len(t) - len(t.lstrip('¡¿«“ '))
    return t[:i] + t[i:i + 1].upper() + t[i + 1:]


def texte_biblique(pid, osis, c, vs):
    out = {}
    for l, B in BIBLES.items():
        aj = AJUST.get((pid, l), {})
        vv = aj.get('v', vs)
        ch = B[osis]['ch'][c - 1]
        brut = ' '.join(ch[v - 1] for v in vv)
        brut = re.sub(r'\s*\n\s*', ' ', brut)
        if (pid, l) in PONCT: brut = brut.replace(*PONCT[(pid, l)])
        if vv[0] == 1:
            for r_ in TITRES: brut = re.sub(r_, '', brut)
        out[l] = extrait(nettoie(brut, l), l, pid, aj)
        ab = B[osis]['abr']
        sep = ':' if l == 'en' else ', '
        out['ref_' + l] = f"{ab} {c}{sep}{vv[0]}" + (f"-{vv[-1]}" if len(vv) > 1 else '')
    return out


def finition(p):
    for l in ('fr', 'es', 'en'):
        t = re.sub(r'[\s\u202f\u00a0]+\.$', '.', p[l])
        t = re.sub(r'\(([^()]*)\)', r'\1', t)  # mots ajoutés par le traducteur : on garde le mot, sans les parenthèses
        # Une parole citée qui commence dans le verset et se ferme au verset suivant : on referme le guillemet.
        if t.count('«') > t.count('»'): t += '\u00a0»'
        if t.count('“') > t.count('”'): t += '”'
        p[l] = t
    return p


def priere(spec):
    if len(spec) == 1:
        t = TRAD[spec[0]]
        return finition({'id': spec[0], 'fr': t['fr'], 'es': t['es'], 'en': t['en'], 'src': t['src']})
    pid, osis, c, vs = spec
    t = texte_biblique(pid, osis, c, vs)
    bible = {l: {'osis': osis, 'c': c, 'v': AJUST.get((pid, l), {}).get('v', vs)} for l in ('fr', 'es', 'en')}
    return finition({'id': pid, 'fr': t['fr'], 'es': t['es'], 'en': t['en'], 'src': {'fr': t['ref_fr'], 'es': t['ref_es'], 'en': t['ref_en']}, 'bible': bible})


def main():
    """Écrit data/prieres-jour.json : des listes tournantes et des prières propres aux célébrations.
    L'app choisit la prière d'un jour par l'index du jour dans l'année liturgique (rotation déterministe,
    sans aucune date civile) ; une célébration listée ici a la priorité."""
    pools = {'jour': [priere(x) for x in MATIN], 'soir': [priere(x) for x in SOIR],
             'enfantJour': [priere(x) for x in ENFANT_MATIN], 'enfantSoir': [priere(x) for x in ENFANT_SOIR]}
    cel = {}
    for cle, moments in CELEBRATIONS.items():
        cel[cle] = {k: priere(v) for k, v in moments.items()}
        for k, note in NOTES.get(cle, {}).items():
            cel[cle][k]['note'] = note
    # La prière qui clôt la réflexion du jour : un verset désigné dans data/contenus.json, lu dans chaque Bible.
    contenus = json.load(open(f'{DATA}/contenus.json'))
    refl = {}
    for cle, c in contenus.items():
        if cle.startswith('_') or 'priereReflexion' not in c: continue
        x = c['priereReflexion']
        refl[cle] = priere((x['id'], x['osis'], x['c'], x['v']))
    json.dump({'_note': __doc__.strip(), 'traditionnelles': TRAD, 'notes': NOTES, 'pools': pools, 'celebrations': cel, 'reflexions': refl}, open(f'{DATA}/prieres-jour.json', 'w'), ensure_ascii=False, indent=1)
    print('prières :', {k: len(v) for k, v in pools.items()}, '; célébrations :', len(cel))


if __name__ == '__main__':
    main()
