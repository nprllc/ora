"""Ora — fabrique data/bible.json (Bible Crampon 1923, domaine public) à partir du texte extrait de Wikisource.
Usage : python3 outils/bible.py chemin/crampon-paragraphes.json, puis python3 outils/bibles.py (présentations des livres, versions es et en).
Les deux scripts écrivent dans outils/sortie/, jamais dans data/ (qui fait foi et a été relu depuis)."""
import json, re, sys
import os, sys
# Source (hors dépôt, 5 Mo) : le texte Crampon extrait de Wikisource, avec ses paragraphes. Chemin en argument.
src = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'crampon-paragraphes.json'))
# Les noms et abréviations des livres sont lus dans data/bible.json, qui fait foi (aucun texte n'est écrit ici).
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
LIVRES = json.load(open(os.path.join(DATA, 'bible.json')))['livres']
# Ce script ne réécrit jamais data/ : il écrit dans outils/sortie/ ; on compare, puis on reporte à la main ce qui doit l'être.
SORTIE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sortie')
os.makedirs(SORTIE, exist_ok=True)
def propre(t):
    t = re.sub(r'\[[^\]]*\]', ' ', t)
    t = re.sub(r'([.:;])(?=[A-ZÀ-ÖØ-Þ«])', r'\1 ', t)
    t = re.sub(r'\s+', ' ', t).strip(' .—–-')
    return t
out = []
manq = []
coupes = []
for i, b in enumerate(src['livres']):
    nom, abr, court = LIVRES[i]['nom'], LIVRES[i]['abr'], LIVRES[i]['court']
    ch = []
    par = []
    lig = []
    for ci, c in enumerate(b['chapitres']):
        vs = []
        for idx, v in enumerate(c):
            if v is None:
                if len(vs) <= idx: vs.append(None)
                continue
            v = re.sub(r'[ \t\u00a0]+', ' ', v)
            v = re.sub(r'\s*_{3,}.*$', '', v)
            v = re.sub(r'\s+\d+(\s+\d+)?\.\s*Chap\..*$', '', v)
            v = re.sub(r'\s+(?:\d+\s+)?(?:\d+\.\s*)?(?:[A-Z]\.\s*—\s*)?(?:Chap[.,]|Ps\.\s+[ivxlc]+\b).*$', '', v)
            v = re.sub(r'\s+[A-H]\.\s+—\s+[A-ZÀ-Ü].*$', '', v)
            m_ = re.search(r'(?<=[.!?»;])\s+[A-ZÀ-Ü][^()]*\(\s?[ivxlc]*,?\s?\d+[a-d]?\s?(?:[-–—,]\s?\d+[a-d]?)?\s?\)', v)
            if m_:
                seg = v[m_.start():]
                mm = re.search(r'(?<=[.!?»])\s+\d+\s+(?=\S)', seg)
                cut = m_.start() + mm.start() if mm else m_.start()
                coupes.append(v[cut:][:90]); v = v[:cut]
            v = re.sub(r'\s+\d+$', '', v).strip()
            # versets collés : « 10Réduis-les… »
            parts = re.split(r'\s?(\d+)(?=[A-Za-zÀ-ÿ«](?<!\dre)(?<!\de)(?<!\der))', v)
            vs.append(parts[0].strip())
            for k in range(1, len(parts), 2):
                n = int(parts[k])
                if not (len(vs) < n <= len(vs) + 3):
                    vs[-1] = (vs[-1] + ' ' + parts[k] + parts[k + 1]).strip(); continue
                while len(vs) < n - 1: vs.append(None)
                if len(vs) == n - 1: vs.append(parts[k + 1].strip())
                else: vs[n - 1] = parts[k + 1].strip()
        # coupe les entrées parasites après un trou (notes de bas de page)
        for k in range(len(vs)):
            if vs[k] is None:
                reste = [x for x in vs[k:] if x]
                if len(reste) <= 2 and len(vs) - k >= 2 and all(x is None for x in vs[k:k+2]):
                    vs = vs[:k]; break
        while vs and vs[-1] is None: vs.pop()
        manq.extend((b['id'], ci + 1, k + 1) for k, x in enumerate(vs) if not x)
        ch.append([x or '' for x in vs])
        n = len(vs)
        pp = sorted(set(x for x in (b.get('p') or [[]] * 999)[ci] if x <= n)) if ci < len(b.get('p') or []) else [1]
        ll = sorted(set(x for x in (b.get('l') or [[]] * 999)[ci] if x <= n and x not in pp)) if ci < len(b.get('l') or []) else []
        if 1 not in pp: pp = [1] + pp
        par.append(pp); lig.append(ll)
    ti = {}
    for t in b.get('titres', []):
        p = propre(t['titre'])
        if p and len(p) < 140: ti[t['avant']] = p
    out.append({'id': abr.replace(' ', ''), 'abr': abr, 'nom': nom, 'court': court, 't': 'NT' if i >= 46 else 'AT', 'ch': ch, 'p': par, 'l': lig})
assert len(out) == 73 and out[46]['abr'] == 'Mt'
json.dump({'source': 'Bible Crampon 1923 (domaine public), texte établi d’après Wikisource', 'livres': out}, open(os.path.join(SORTIE, 'bible.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print('manquants', manq)
import re as _r
for b in out:
    for ci,c in enumerate(b['ch']):
        for vi,v in enumerate(c):
            if 'Chap.' in v or _r.search(r'\d[A-Za-zÀ-ÿ«]',v): print('?',b['abr'],ci+1,vi+1,v[:160])
print(sum(len(c) for b in out for c in b['ch']), 'versets')

print(len(coupes)); [print('  ', c) for c in coupes]
