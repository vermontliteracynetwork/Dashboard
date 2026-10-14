"""Pixel art for the Cauldron (Build Queue 170/171).
1) Every element as a 32x32 pixel sprite, made from her element pictures (Keith Enevoldsen, CC BY-SA 4.0):
   downscaled, colors reduced, outlined in the Supernature ink color. -> public/games/supernature/alchemy/el/SYM.png
2) Pixel sprites for the cauldron's kitchen chemicals (water, salt, sugar, yeast, oil, chalk, vinegar, baking soda).
3) Fun-shaped potion bottles: an outline layer and a liquid mask layer per shape, tinted in CSS.
Usage: python3 -I scripts/supernature-art/alchemy.py
"""
import os
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'public/games/scienceLab/elements')
OUT = os.path.join(ROOT, 'public/games/supernature/alchemy')
os.makedirs(f'{OUT}/el', exist_ok=True); os.makedirs(f'{OUT}/bottles', exist_ok=True)
INK = (36, 31, 69, 255)
N = 32

def outline(im):
    px = im.load(); W, H = im.size; out = im.copy(); o = out.load()
    for y in range(H):
        for x in range(W):
            if px[x, y][3]: continue
            if any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                o[x, y] = INK
    return out

def pixelate(path, card):
    im = Image.open(path).convert('RGB')
    im = im.crop((5, 5, im.width - 5, im.height - 5))  # drop any cell border line at the edges
    W, H = im.size; px = im.load()
    from collections import Counter
    border = [px[x, y] for x in range(W) for y in (0, H - 1)] + [px[x, y] for y in range(H) for x in (0, W - 1)]
    bg = Counter((p[0] // 8, p[1] // 8, p[2] // 8) for p in border).most_common(1)[0][0]
    bg = tuple(v * 8 + 4 for v in bg)
    near = lambda p: abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2]) < 60
    alpha = Image.new('L', (W, H), 255); ap = alpha.load()
    stack = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    seen = set()
    while stack:
        x, y = stack.pop()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H): continue
        seen.add((x, y))
        if near(px[x, y]):
            ap[x, y] = 0; stack += [(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)]
    rgba = im.convert('RGBA'); rgba.putalpha(alpha)
    bb = alpha.getbbox()
    if bb: rgba = rgba.crop(bb)
    rgba.thumbnail((N - 2, N - 2), Image.LANCZOS)
    a = rgba.split()[3].point(lambda v: 255 if v > 110 else 0)
    q = rgba.convert('RGB').quantize(colors=12, method=Image.Quantize.MEDIANCUT).convert('RGBA'); q.putalpha(a)
    c = Image.new('RGBA', (N, N), (0, 0, 0, 0)); c.alpha_composite(q, ((N - q.width) // 2, (N - q.height) // 2))
    return outline(c)

syms = sorted({f.split('.')[0] for f in os.listdir(SRC) if f.endswith('.png') and '-card' not in f})
for s in syms: pixelate(f'{SRC}/{s}.png', f'{SRC}/{s}-card.png').save(f'{OUT}/el/{s}.png')
print('elements', len(syms))

def sprite(draw):
    im = Image.new('RGBA', (N, N), (0, 0, 0, 0)); px = im.load()
    def r(x, y, w, h, c):
        for j in range(h):
            for i in range(w):
                if 0 <= x + i < N and 0 <= y + j < N: px[x + i, y + j] = c
    draw(r)
    return outline(im)
W_, G_ = (255, 255, 255, 255), (200, 200, 210, 255)
def water(r):
    for i, w in enumerate([2, 4, 6, 8, 10, 12, 14, 14, 16, 16, 16, 16, 14, 12, 8]): r(16 - w // 2, 6 + i + (i > 1) * i // 2, w, 2, (95, 170, 255, 255))
    r(12, 16, 2, 4, (210, 235, 255, 255))
def salt(r):
    r(10, 10, 12, 16, (235, 238, 242, 255)); r(10, 6, 12, 4, (160, 165, 175, 255)); r(13, 7, 1, 1, INK); r(16, 7, 1, 1, INK); r(19, 7, 1, 1, INK); r(11, 20, 10, 5, (250, 250, 250, 255))
def sugar(r):
    r(7, 14, 9, 9, W_); r(16, 10, 9, 9, (245, 240, 230, 255)); r(11, 6, 8, 8, W_); r(8, 15, 2, 2, G_); r(18, 12, 2, 2, G_)
def yeast(r):
    r(6, 14, 20, 10, (214, 160, 92, 255)); r(8, 11, 16, 4, (230, 186, 120, 255)); r(10, 13, 2, 2, (176, 120, 60, 255)); r(16, 13, 2, 2, (176, 120, 60, 255)); r(21, 13, 2, 2, (176, 120, 60, 255))
def oil(r):
    r(12, 4, 8, 4, (60, 120, 60, 255)); r(13, 8, 6, 4, (255, 214, 74, 255)); r(9, 12, 14, 16, (255, 214, 74, 255)); r(11, 14, 2, 10, (255, 240, 160, 255))
def chalk(r):
    for i in range(14): r(8 + i, 20 - i, 5, 5, (248, 248, 248, 255))
    r(20, 7, 4, 3, (230, 230, 240, 255))
def vinegar(r):
    r(13, 3, 6, 5, (120, 80, 40, 255)); r(12, 8, 8, 4, (240, 236, 200, 255)); r(9, 12, 14, 16, (240, 236, 200, 255)); r(11, 16, 10, 6, (190, 70, 70, 255))
def soda(r):
    r(8, 8, 16, 20, (255, 140, 60, 255)); r(8, 8, 16, 5, (255, 255, 255, 255)); r(11, 16, 10, 6, (255, 255, 255, 255)); r(14, 18, 4, 2, (255, 140, 60, 255))
for name, fn in dict(water=water, salt=salt, sugar=sugar, yeast=yeast, oil=oil, chalk=chalk, vinegar=vinegar, bakingsoda=soda).items():
    sprite(fn).save(f'{OUT}/el/{name}.png')

# Fun-shaped bottles: outline + liquid mask (white where the liquid goes).
def shape(name, body, neck=(13, 3, 6, 6)):
    glass = Image.new('RGBA', (N, N)); gp = glass.load(); liq = Image.new('RGBA', (N, N)); lp = liq.load()
    pts = set()
    for y in range(N):
        for x in range(N):
            if body(x + 0.5, y + 0.5): pts.add((x, y))
    nx, ny, nw, nh = neck
    for y in range(ny, ny + nh):
        for x in range(nx, nx + nw): pts.add((x, y))
    top = min(y for _, y in pts if True)
    for (x, y) in pts:
        gp[x, y] = (230, 240, 255, 110)
        if y >= ny + nh + 3: lp[x, y] = (255, 255, 255, 255)
    for x in range(nx - 1, nx + nw + 1):
        for y in range(ny - 2, ny): gp[x, y] = (150, 100, 60, 255)
    out = outline(glass)
    op = out.load()
    for (x, y) in pts:
        if (x - 1, y - 1) not in pts and (x, y) in pts and x < 16: op[x, y] = (255, 255, 255, 200)
    out.save(f'{OUT}/bottles/{name}.png'); liq.save(f'{OUT}/bottles/{name}-liquid.png')
import math
shape('round', lambda x, y: (x - 16) ** 2 + (y - 20) ** 2 < 10 ** 2)
shape('heart', lambda x, y: ((x - 16) / 11) ** 2 + ((y - 19) / 9 - math.sqrt(abs((x - 16) / 11))) ** 2 < 1)
shape('star', lambda x, y: (lambda a, d: d < 7 + 4 * (math.cos(5 * a) + 1) / 2)(math.atan2(y - 20, x - 16) - math.pi / 2, math.hypot(x - 16, y - 20)), neck=(13, 3, 6, 7))
shape('tall', lambda x, y: 10 <= x < 22 and 10 <= y < 30, neck=(13, 3, 6, 7))
shape('diamond', lambda x, y: abs(x - 16) + abs(y - 20) < 11)
shape('gourd', lambda x, y: (x - 16) ** 2 + (y - 23) ** 2 < 8 ** 2 or (x - 16) ** 2 + (y - 13) ** 2 < 4.5 ** 2, neck=(14, 3, 4, 6))
print('bottles done')
