"""Fabrique les icônes et les images de partage d'Ora à partir de src/icons/icon.svg et des aquarelles.

Lancer : python3 outils/icones.py (demande rsvg-convert, Pillow et fontTools).
Produit, dans src/icons/ : favicon.svg (version simplifiée pour les petites tailles), favicon.ico (16, 32, 48),
icon-32.png, icon-180.png (iPhone), icon-192.png, icon-512.png, icon-maskable-512.png (Android) ;
(les aperçus de lien sont faits par outils/og.mjs).
"""
import io, os, subprocess, tempfile
from PIL import Image

ICI = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ICI, '..', 'src')
ICONS = os.path.join(SRC, 'icons')

IVOIRE = (255, 251, 245)

# Favicon : le même O de lumière, sans l'aura et avec des traits plus épais, lisible à 16 px.
FAVICON = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#FFFBF5"/>
  <circle cx="32" cy="32" r="25" fill="none" stroke="#D4AE6A" stroke-width="2.5"/>
  <circle cx="32" cy="32" r="18.5" fill="none" stroke="#2F2924" stroke-width="4"/>
  <circle cx="32" cy="32" r="8" fill="#E2C48A"/>
</svg>
'''


def rendre(svg_txt, taille):
    with tempfile.NamedTemporaryFile('w', suffix='.svg', delete=False) as f:
        f.write(svg_txt)
    png = subprocess.run(['rsvg-convert', '-w', str(taille), '-h', str(taille), f.name], check=True, capture_output=True).stdout
    os.unlink(f.name)
    return Image.open(io.BytesIO(png)).convert('RGBA')


def enregistrer(im, nom):
    im.save(os.path.join(ICONS, nom), optimize=True)


svg = open(os.path.join(ICONS, 'icon.svg')).read()
open(os.path.join(ICONS, 'favicon.svg'), 'w').write(FAVICON)

for t in (180, 192, 512):
    enregistrer(rendre(svg, t).convert('RGB'), f'icon-{t}.png')
enregistrer(rendre(FAVICON, 32), 'icon-32.png')

# Android découpe l'icône « maskable » en cercle ou en goutte : on réduit le logo à 80 % sur le fond ivoire.
m = Image.new('RGB', (512, 512), IVOIRE)
logo = rendre(svg, 410)
m.paste(logo, (51, 51), logo)
enregistrer(m, 'icon-maskable-512.png')

ico = [rendre(FAVICON, t) for t in (48, 32, 16)]
ico[0].save(os.path.join(ICONS, 'favicon.ico'), sizes=[(48, 48), (32, 32), (16, 16)], append_images=ico[1:])

print('icônes prêtes')
