# Tiny pixel-art kit: shapes on a 48x48 grid, each part outlined, then simple light/shade.
from PIL import Image, ImageDraw
S = 48
OUT = (40, 26, 52)
def hx(h):
    if isinstance(h, tuple): return h
    h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def mix(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))

class A:
    def __init__(s):
        s.c = [[None] * S for _ in range(S)]; s.r = [[0] * S for _ in range(S)]; s.n = 0; s.flat = set(); s.size = {}
    def put(s, pts, col, edge=True, shade=True):
        s.n += 1; rid = s.n
        if not shade: s.flat.add(rid)
        col = hx(col); pts = {(x, y) for (x, y) in pts if 0 <= x < S and 0 <= y < S}
        s.size[rid] = len(pts)
        for (x, y) in pts:
            if edge and any((x + dx, y + dy) not in pts for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                s.c[y][x] = OUT; s.r[y][x] = -1
            else:
                s.c[y][x] = col; s.r[y][x] = rid
    def render(s):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0)); p = im.load()
        def same(x, y, rid): return 0 <= x < S and 0 <= y < S and s.r[y][x] == rid
        for y in range(S):
            for x in range(S):
                col = s.c[y][x]
                if col is None: continue
                rid = s.r[y][x]
                if rid > 0 and rid not in s.flat:
                    if not same(x, y + 1, rid) or not same(x + 1, y, rid): col = mix(col, (34, 20, 64), 0.27)
                    elif s.size[rid] > 40 and (not same(x, y + 2, rid) or not same(x + 2, y, rid)): col = mix(col, (34, 20, 64), 0.12)
                    elif not same(x, y - 1, rid) or not same(x - 1, y, rid): col = mix(col, (255, 250, 240), 0.22)
                p[x, y] = col + (255,)
        add = []
        for y in range(S):
            for x in range(S):
                if s.c[y][x] is not None: continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < S and 0 <= yy < S and s.c[yy][xx] is not None and s.r[yy][xx] != -1:
                        add.append((x, y)); break
        for (x, y) in add: p[x, y] = OUT + (255,)
        return im

def E(a, cx, cy, rx, ry, col, edge=True, shade=True):
    a.put([(x, y) for y in range(S) for x in range(S) if ((x - cx) / (rx + 0.5)) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1], col, edge, shade)
def R(a, x0, y0, x1, y1, col, edge=True, shade=True):
    a.put([(x, y) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)], col, edge, shade)
def P(a, pts, col, edge=True, shade=True):
    im = Image.new('L', (S, S), 0); ImageDraw.Draw(im).polygon(pts, fill=1, outline=1)
    a.put([(x, y) for y in range(S) for x in range(S) if im.getpixel((x, y))], col, edge, shade)
def T(a, pts, w, col, edge=True, shade=True):
    m = set(); r = w / 2
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(max(abs(x1 - x0), abs(y1 - y0), 1) * 3)
        for i in range(n + 1):
            cx = x0 + (x1 - x0) * i / n; cy = y0 + (y1 - y0) * i / n
            for y in range(int(cy - r) - 1, int(cy + r) + 2):
                for x in range(int(cx - r) - 1, int(cx + r) + 2):
                    if (x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3: m.add((x, y))
    a.put(list(m), col, edge, shade)
def D(a, pts, col): a.put(pts, col, False, False)
def eyes(a, cx=23.5, cy=14, dx=4, h=3, col='#241f45'):
    for ex in (int(cx - dx), int(cx + dx)):
        R(a, ex, cy, ex + 1, cy + h - 1, col, False, False); D(a, [(ex, cy)], '#ffffff')
def eye1(a, x, y, col='#241f45'):
    R(a, x, y, x + 1, y + 1, col, False, False); D(a, [(x, y)], '#ffffff')
def chibi(a, skin, top, bottom, shoe, cx=23.5, hy=14, hrx=10, hry=9, sleeve=None, hand=None, legs=True, head=True):
    if legs:
        R(a, int(cx - 5.5), 35, int(cx - 1.5), 42, bottom); R(a, int(cx + 1.5), 35, int(cx + 5.5), 42, bottom)
        R(a, int(cx - 6.5), 41, int(cx - 1.5), 45, shoe); R(a, int(cx + 1.5), 41, int(cx + 6.5), 45, shoe)
    P(a, [(cx - 7, 22), (cx + 7, 22), (cx + 9, 37), (cx - 9, 37)], top)
    T(a, [(cx - 8, 25), (cx - 11, 32)], 5, sleeve or top); E(a, cx - 11.5, 34, 2, 2, hand or skin)
    T(a, [(cx + 8, 25), (cx + 11, 32)], 5, sleeve or top); E(a, cx + 11.5, 34, 2, 2, hand or skin)
    if head: E(a, cx, hy, hrx, hry, skin)
