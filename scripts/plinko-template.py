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
    d.text((band[0][0] + 30, 88), f'PLINKO THEME  ·  PAGE {n} OF {NPAGES}  ·  {title}', font=f(BOLD, 44), fill=INK)
    d.text((band[0][0] + 30, 148), line, font=f(REG, 30), fill=MUTED)
    foot = 'Draw only inside the dashed lines. Keep all four corner squares in the photo.'
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
        d.ellipse(box, fill=(255, 255, 255))
        dashed_ellipse(d, box)
    else:
        d.rectangle(box, fill=(255, 255, 255))
        dashed_rect(d, box)
    if label:
        fnt = f(BOLD, 30)
        tw = d.textlength(label, font=fnt)
        lx, ly = x + w / 2 - tw / 2, y + h + 18
        d.rounded_rectangle([lx - 14, ly - 6, lx + tw + 14, ly + 42], radius=12, fill=(255, 255, 255))
        d.text((lx, ly), label, font=fnt, fill=INK)
    regions[key] = {'page': n, 'x': x, 'y': y, 'w': w, 'h': h, 'circle': circle}

def dashed_rect(d, box, dash=28, gap=16, width=7):
    x0, y0, x1, y1 = box
    for a, b, fixed, horiz in [(x0, x1, y0, True), (x0, x1, y1, True), (y0, y1, x0, False), (y0, y1, x1, False)]:
        t = a
        while t < b:
            e = min(t + dash, b)
            d.line([(t, fixed), (e, fixed)] if horiz else [(fixed, t), (fixed, e)], fill=INK, width=width)
            t += dash + gap

def dashed_ellipse(d, box, width=7):
    for a in range(0, 360, 12):
        d.arc(box, a, a + 7, fill=INK, width=width)

def build():
    regions, pages = {}, []
    TOP, BOT = 250, 1530  # the space between the header band and the footer
    def one(title, line, key, w, h, circle=False):
        n = len(pages) + 1
        im, d = page(n, title, line)
        area(d, key, regions, n, (W - w) // 2, TOP + (BOT - TOP - h) // 2, w, h, '', circle=circle)
        pages.append(im)
    one('COVER', 'A square picture students see when they pick a theme.', 'cover', 1180, 1180)
    one('BACKGROUND', 'The scene behind the whole game. The board and panels sit on top of it.', 'background', 1600, 1200)
    one('TITLE', 'The game name in your letters. The white around the letters turns see-through.', 'title', 1800, 600)
    one('BOARD', 'The picture behind the pegs. Keep it calm so the pegs and ball stay easy to see.', 'board', 990, 1230)
    one('SIDE PANEL', 'The picture behind the scores and power-ups. Keep the middle calm.', 'panel', 620, 1230)
    for i in range(10):
        one(f'BALL {i + 1}', 'One ball in the circle.' + (' Balls 1 to 5 are needed.' if i < 5 else ' Extra, leave it white to skip it.'), f'ball{i + 1}', 1150, 1150, circle=True)
    for k, nm in [('power_magnet', 'MAGNET'), ('power_double', 'DOUBLE'), ('power_big', 'BIG BALL'), ('power_again', 'SECOND DROP')]:
        one(f'POWER-UP: {nm}', 'A picture for this power-up. It keeps the same action. Leave it white to keep the usual picture.', k, 1180, 1180)
    # Colors: one page for the palette (color squares are not drawings).
    n = len(pages) + 1
    im, d = page(n, 'COLORS', 'Fill each square with one solid color. Leave a square white to keep the usual color.')
    top = ['primary', 'secondary', 'text', 'boardBorder', 'boardBg', 'peg', 'powerBg', 'powerBtn']
    names = ['PRIMARY', 'SECONDARY', 'TEXT', 'BORDER', 'BOARD', 'PEGS', 'POWER-UP', 'BUTTONS']
    for i, k in enumerate(top):
        area(d, k, regions, n, 250 + i * 225, 400, 170, 170, names[i])
    for i in range(8):
        area(d, f'bucket{i + 1}', regions, n, 250 + i * 225, 900, 170, 170, f'BUCKET {i + 1}')
    pages.append(im)
    assert len(pages) == NPAGES
    return regions, pages

def main():
    regions, pages = build()
    os.makedirs(KIT, exist_ok=True)
    for old in os.listdir(KIT):
        if old.startswith('page-') and old.endswith('.png'):
            os.remove(os.path.join(KIT, old))
    for i, im in enumerate(pages):
        im.save(os.path.join(KIT, f'page-{i + 1}.png'))
    # 200 dpi makes each page exactly 11 x 8.5 in; every page is one flattened picture.
    pages[0].save(os.path.join(KIT, 'plinko-theme-template.pdf'), save_all=True, append_images=pages[1:], resolution=200)
    data = {'width': W, 'height': H, 'pages': NPAGES, 'code': CODE, 'markers': {k: [x + MS / 2, y + MS / 2] for k, (x, y) in MARKERS.items()}, 'regions': regions}
    for p in [os.path.join(KIT, 'regions.json'), os.path.join(ROOT, 'src', 'games', 'plinkoThemeRegions.json')]:
        with open(p, 'w') as fh:
            json.dump(data, fh, indent=1)
    print('pages', len(pages), 'regions', len(regions))

if __name__ == '__main__':
    main()
