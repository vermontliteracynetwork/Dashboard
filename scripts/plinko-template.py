#!/usr/bin/env python3
"""Builds the printable, scannable Plinko theme template (Build Queue 297).

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
    d.text((band[0][0] + 30, 88), f'PLINKO THEME  ·  PAGE {n} OF 7  ·  {title}', font=f(BOLD, 44), fill=INK)
    d.text((band[0][0] + 30, 148), line, font=f(REG, 30), fill=MUTED)
    foot = 'Draw only inside the dashed lines. Keep the four corner squares clear and the whole page in the photo.'
    d.rounded_rectangle([(M + MS + 30, H - 150), (W - M - MS - 30, H - 80)], radius=20, fill=(255, 255, 255))
    d.text((M + MS + 60, H - 133), foot, font=f(REG, 30), fill=MUTED)
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
    # 1 Cover
    im, d = page(1, 'COVER', 'A square picture students see when they pick a theme.')
    area(d, 'cover', regions, 1, (W - 1120) // 2, 300, 1120, 1120, '')
    pages.append(im)
    # 2 Background
    im, d = page(2, 'BACKGROUND', 'The scene behind the whole game. The board and panels sit on top of it.')
    area(d, 'background', regions, 2, 300, 290, 1600, 1200, '')
    pages.append(im)
    # 3 Balls
    im, d = page(3, 'BALLS', 'One ball in each circle. Balls 1 to 5 are needed, 6 to 10 are extra.')
    for i in range(10):
        r, c = divmod(i, 5)
        area(d, f'ball{i + 1}', regions, 3, 250 + c * 360, 330 + r * 590, 300, 300, f'BALL {i + 1}' + (' (needed)' if i < 5 else ''), circle=True)
    pages.append(im)
    # 4 Title
    im, d = page(4, 'TITLE', 'The game name in your letters. The white around the letters turns see-through.')
    area(d, 'title', regions, 4, 200, 560, 1800, 540, '')
    pages.append(im)
    # 5 Board and side panel
    im, d = page(5, 'BOARD AND SIDE PANEL', 'The board sits behind the pegs. The side panel sits behind the scores and power-ups.')
    area(d, 'board', regions, 5, 300, 300, 900, 1120, 'BOARD')
    area(d, 'panel', regions, 5, 1420, 300, 560, 1120, 'SIDE PANEL')
    pages.append(im)
    # 6 Colors
    im, d = page(6, 'COLORS', 'Fill each square with one solid color. Leave a square white to keep the usual color.')
    top = ['primary', 'secondary', 'text', 'boardBorder', 'boardBg', 'peg', 'powerBg', 'powerBtn']
    names = ['PRIMARY', 'SECONDARY', 'TEXT', 'BORDER', 'BOARD', 'PEGS', 'POWER-UP', 'BUTTONS']
    for i, k in enumerate(top):
        area(d, k, regions, 6, 250 + i * 225, 400, 170, 170, names[i])
    for i in range(8):
        area(d, f'bucket{i + 1}', regions, 6, 250 + i * 225, 900, 170, 170, f'BUCKET {i + 1}')
    pages.append(im)
    # 7 Power-ups
    im, d = page(7, 'POWER-UPS', 'A picture for each power-up. It keeps the same action. Leave one white to keep its usual picture.')
    for i, (k, n) in enumerate([('power_magnet', 'MAGNET'), ('power_double', 'DOUBLE'), ('power_big', 'BIG BALL'), ('power_again', 'SECOND DROP')]):
        area(d, k, regions, 7, 250 + i * 450, 520, 360, 360, n)
    pages.append(im)
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
    data = {'width': W, 'height': H, 'markers': {k: [x + MS / 2, y + MS / 2] for k, (x, y) in MARKERS.items()}, 'regions': regions}
    for p in [os.path.join(KIT, 'regions.json'), os.path.join(ROOT, 'src', 'games', 'plinkoThemeRegions.json')]:
        with open(p, 'w') as fh:
            json.dump(data, fh, indent=1)
    print('pages', len(pages), 'regions', len(regions))

if __name__ == '__main__':
    main()
