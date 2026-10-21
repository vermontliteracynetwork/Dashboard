#!/usr/bin/env python3
"""Builds the printable, scannable Plinko theme template (Build Queue 297; since 300 one design item per page).

Letter landscape pages (11 x 8.5 in at 200 dpi = 2200 x 1700 px). Each design space is white with a thick dashed
outline; everything outside it is a light gray hatch marked "outside" so nobody colors there. Four black corner
markers let the app straighten a phone photo; the top-left marker has a white center so the app knows which way is
up. Writes docs/plinko-theme-kit/ (PDF, one flattened PNG per page, regions.json, HOW-TO.txt) and
src/games/plinkoThemeRegions.json. Run: python3 scripts/plinko-template.py
"""
import json
import os
from PIL import Image, ImageDraw, ImageFont

W, H = 2200, 1700
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, 'docs', 'plinko-theme-kit')
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
INK, MUTED, HATCH, PAPER = (40, 40, 48), (110, 110, 120), (205, 205, 212), (244, 244, 247)
M, MS = 60, 110  # marker offset from the page edge, marker size
NPAGES = 20
# Build Queue 300: each page prints its own number as five small squares (filled = 1) at the bottom right, so the
# app knows which page a photo is even when pages come in any order.
CODE = {'x': W - M - MS - 30 - 5 * 66 - 20, 'y': H - 141, 'size': 46, 'gap': 20, 'bits': 5}
MARKERS = {'tl': (M, M), 'tr': (W - M - MS, M), 'bl': (M, H - M - MS), 'br': (W - M - MS, H - M - MS)}

def f(path, size):
    return ImageFont.truetype(path, size)

def page(n, title, line):
    im = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(im)
    for x in range(-H, W, 34):  # light diagonal hatch: the "outside" area
        d.line([(x, 0), (x + H, H)], fill=HATCH, width=3)
    for k, (x, y) in MARKERS.items():
        d.rectangle([x, y, x + MS, y + MS], fill=(0, 0, 0))
        if k == 'tl':  # the top-left marker has a white center: this way up
            d.rectangle([x + 32, y + 32, x + MS - 32, y + MS - 32], fill=(255, 255, 255))
    band = [(M + MS + 30, 70), (W - M - MS - 30, 200)]
    d.rounded_rectangle(band, radius=24, fill=(255, 255, 255), outline=MUTED, width=3)
    head, size = f'PLINKO THEME  ·  PAGE {n} OF {NPAGES}  ·  {title}', 44
    while size > 26 and d.textlength(head, font=f(BOLD, size)) > band[1][0] - band[0][0] - 60: size -= 2  # long titles shrink to fit
    d.text((band[0][0] + 30, 88 + (44 - size) // 2), head, font=f(BOLD, size), fill=INK)
    d.text((band[0][0] + 30, 148), line, font=f(REG, 30), fill=MUTED)
    foot = 'Draw only inside the outlined shape. Keep all four corner squares in the photo.'
    d.rounded_rectangle([(M + MS + 30, H - 150), (W - M - MS - 30, H - 80)], radius=20, fill=(255, 255, 255))
    d.text((M + MS + 60, H - 133), foot, font=f(REG, 30), fill=MUTED)
    for b in range(CODE['bits']):  # the page number, biggest bit first
        x0, y0, sz = CODE['x'] + b * (CODE['size'] + CODE['gap']), CODE['y'], CODE['size']
        on = (n >> (CODE['bits'] - 1 - b)) & 1
        d.rectangle([x0, y0, x0 + sz, y0 + sz], fill=(0, 0, 0) if on else (255, 255, 255), outline=MUTED, width=3)
    return im, d

def area(d, key, regions, n, x, y, w, h, label, circle=False):
    box = [x, y, x + w, y + h]
    if circle:
        d.ellipse(box, fill=(255, 255, 255), outline=INK, width=7)  # Build Queue 314: solid outlines
    else:
        d.rectangle(box, fill=(255, 255, 255), outline=INK, width=7)
    if label:
        fnt = f(BOLD, 30)
        tw = d.textlength(label, font=fnt)
        lx, ly = x + w / 2 - tw / 2, y + h + 18
        d.rounded_rectangle([lx - 14, ly - 6, lx + tw + 14, ly + 42], radius=12, fill=(255, 255, 255))
        d.text((lx, ly), label, font=fnt, fill=INK)
    regions[key] = {'page': n, 'x': x, 'y': y, 'w': w, 'h': h, 'circle': circle}

def build():
    regions, pages = {}, []
    TOP, BOT = 250, 1530  # the space between the header band and the footer
    def one(title, line, key, w, h, circle=False):
        n = len(pages) + 1
        im, d = page(n, title, line)
        area(d, key, regions, n, (W - w) // 2, TOP + (BOT - TOP - h) // 2, w, h, '', circle=circle)
        pages.append(im)
    # Build Queue 314: her names for every page; colors and fonts are picked in the theme builder, not on paper.
    one('THEME COVER IMAGE', 'A square picture students see when they pick a theme.', 'cover', 1180, 1180)
    one('BACKGROUND', 'The scene behind the whole game. The board and score board sit on top of it.', 'background', 1600, 1200)
    one('TITLE', 'The game name in your letters. The white around the letters turns see-through.', 'title', 1800, 600)
    one('GAME BOARD', 'The picture behind the pegs. Keep it calm so the pegs and ball stay easy to see.', 'board', 1500, 1160)  # Build Queue 344: wider, like the board on screen
    one('SCORE BOARD BACKGROUND', 'The picture behind the players and their scores. Keep the middle calm.', 'panel', 620, 1230)
    for i in range(10):
        one(f'BALL {i + 1}', 'One ball in the circle.' + (' Balls 1 to 5 are needed.' if i < 5 else ' Extra, leave it white to skip it.'), f'ball{i + 1}', 1150, 1150, circle=True)
    for k, nm, role in [('power_magnet', 'MAGNET', 'Magnet pulls the ball toward the bucket worth the most points.'),
                        ('power_double', 'DOUBLE', 'Double makes the bucket the ball lands in count twice.'),
                        ('power_big', 'BIG BALL', 'Big Ball is bigger and heavier, so it bounces less and is easier to aim.')]:
        one(f'POWER-UP COVER IMAGE: {nm}', role, k, 1180, 1180)
    # Double Ball Drop: its cover image and the two balls that drop, all on one page.
    n = len(pages) + 1
    im, d = page(n, 'POWER-UP COVER IMAGE: DOUBLE BALL DROP', 'Double Ball Drop drops two balls at once. Draw its cover image and both balls.')
    area(d, 'power_again', regions, n, 230, 330, 1000, 1000, 'COVER IMAGE')
    area(d, 'again_ball1', regions, n, 1380, 300, 520, 520, 'BALL 1', circle=True)
    area(d, 'again_ball2', regions, n, 1380, 900, 520, 520, 'BALL 2', circle=True)
    pages.append(im)
    # Build Queue 334: a blank page for a power-up of the theme's own. Copy it as many times as needed; each copy that is
    # scanned or uploaded adds one new power-up (its name and action are set in the theme builder).
    one('NEW POWER-UP COVER IMAGE', 'A power-up of your own. Draw its cover image. Make a copy of this page for each new power-up.', 'power_new', 1180, 1180)
    assert len(pages) == NPAGES
    return regions, pages

def build_zip():
    # Build Queue 319: docs/plinko-theme-kit.zip. One PDF for printing and for Canva (every page a single flat picture:
    # no text, shapes or layers to pull apart; Canva will not open a locked PDF, so the page is locked in Canva with
    # "Set image as background", see HOW-TO.pdf), the single pages as pictures, the how-to and the main theme reference.
    import zipfile
    out = os.path.join(ROOT, 'docs', 'plinko-theme-kit.zip')
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        z.write(os.path.join(KIT, 'plinko-theme-template.pdf'), 'Plinko-Theme-Kit/Plinko-Theme-Template.pdf')
        z.write(os.path.join(KIT, 'HOW-TO.pdf'), 'Plinko-Theme-Kit/HOW-TO.pdf')
        for i in range(1, NPAGES + 1):
            z.write(os.path.join(KIT, f'page-{i}.png'), f'Plinko-Theme-Kit/single-pages/page-{i}.png')
        ref = os.path.join(KIT, 'main-theme-reference')
        for fn in sorted(os.listdir(ref)):
            z.write(os.path.join(ref, fn), f'Plinko-Theme-Kit/main-theme-reference/{fn}')

def main():
    regions, pages = build()
    os.makedirs(KIT, exist_ok=True)
    for old in os.listdir(KIT):
        if old.startswith('page-') and old.endswith('.png'):
            os.remove(os.path.join(KIT, old))
    for i, im in enumerate(pages):
        im.save(os.path.join(KIT, f'page-{i + 1}.png'))
    # 200 dpi makes each page exactly 11 x 8.5 in; every page is one flattened picture.
    # The PDFs (the whole template, one per page for each builder card's Download button, the ball pages and the
    # power-up pages) are printed from these PNGs by Chromium, which keeps them small: scripts/plinko-template-pdf.cjs.
    balls = sorted({r['page'] for k, r in regions.items() if k.startswith('ball')})
    powers = sorted({r['page'] for k, r in regions.items() if k.startswith('power_')})
    import subprocess
    subprocess.run(['node', os.path.join(ROOT, 'scripts', 'plinko-template-pdf.cjs'), str(len(pages)), ','.join(map(str, balls)), ','.join(map(str, powers))], check=True)
    build_zip()
    data = {'width': W, 'height': H, 'pages': NPAGES, 'code': CODE, 'markers': {k: [x + MS / 2, y + MS / 2] for k, (x, y) in MARKERS.items()}, 'regions': regions}
    for p in [os.path.join(KIT, 'regions.json'), os.path.join(ROOT, 'src', 'games', 'plinkoThemeRegions.json')]:
        with open(p, 'w') as fh:
            json.dump(data, fh, indent=1)
    print('pages', len(pages), 'regions', len(regions))

if __name__ == '__main__':
    main()
