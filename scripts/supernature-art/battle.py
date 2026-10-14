"""Battle art (Build Queue 137): the weapon rack for the wall above the Habitat door (drawn to match her
picture: a wooden rack with a sword, a spear and a blue shield) and a stone battle platform.
Run: python3 -I scripts/supernature-art/battle.py"""
import math
from PIL import Image
OUT = 'public/games/supernature/battle/'
def hx(h, a=255): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), a)
INK = hx('#3a2a2a')
def outline(im):
  p = im.load(); W, H = im.size
  a = [[p[x, y][3] > 0 for x in range(W)] for y in range(H)]
  for y in range(H):
    for x in range(W):
      if not a[y][x] and any(0 <= x + dx < W and 0 <= y + dy < H and a[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): p[x, y] = INK

im = Image.new('RGBA', (48, 48), (0, 0, 0, 0)); p = im.load()
def rect(x0, y0, x1, y1, c):
  for y in range(y0, y1 + 1):
    for x in range(x0, x1 + 1): p[x, y] = c
wood, woodl, woodd = hx('#9a6a4a'), hx('#b8865e'), hx('#6e4a36')
rect(13, 6, 17, 36, wood); rect(30, 6, 34, 36, wood)            # posts
rect(13, 4, 16, 6, wood); rect(31, 4, 34, 6, wood)              # post tops
rect(13, 9, 34, 11, wood)                                       # top bar
rect(13, 26, 34, 29, wood); rect(14, 30, 33, 33, wood)          # lower board
for y in range(7, 36, 4): p[14, y] = woodl; p[31, y] = woodl
for x in range(15, 33, 3): p[x, 27] = woodd
rect(18, 12, 29, 25, (0, 0, 0, 0))                               # open window
# sword across the window
rect(18, 17, 22, 18, hx('#5a5a5a')); rect(23, 15, 23, 20, hx('#6e8fc8')); rect(24, 17, 31, 18, hx('#7aa6e0')); p[32, 17] = hx('#9fd0ff'); p[32, 18] = hx('#7aa6e0')
# spear across the lower board
rect(4, 25, 38, 25, hx('#7a7a6a')); rect(4, 26, 38, 26, hx('#5a5a50'))
rect(39, 23, 42, 28, hx('#6e8fc8')); p[43, 25] = hx('#9fd0ff'); p[43, 26] = hx('#7aa6e0'); rect(2, 24, 4, 27, hx('#5a6a8a'))
# blue shield
for y in range(30, 46):
  for x in range(7, 23):
    t = (y - 30) / 15; half = 8 * (1 - max(0, t - 0.45) * 1.6)
    if abs(x - 15) <= half: p[x, y] = hx('#3f8fd6') if x < 15 else hx('#2f6fb0')
for y in range(31, 45): p[15, y] = hx('#8fc0e8')
outline(im)
im.resize((192, 192), Image.NEAREST).save(OUT + 'rack.png')

# stone platform
pl = Image.new('RGBA', (64, 24), (0, 0, 0, 0)); q = pl.load()
for y in range(24):
  for x in range(64):
    top = ((x - 32) / 30) ** 2 + ((y - 9) / 7) ** 2 <= 1
    side = abs(x - 32) <= 30 * math.sqrt(max(0, 1 - ((min(y, 9) - 9) / 7) ** 2)) and 9 <= y <= 17 and ((x - 32) / 30) ** 2 + ((y - 17) / 6) ** 2 <= 1.05 or (9 <= y <= 17 and abs(x - 32) <= 29)
    if top: q[x, y] = hx('#b8b0a8') if (x * 7 + y * 3) % 11 else hx('#a09890')
    elif side: q[x, y] = hx('#8a827a') if (x + y) % 5 else hx('#77706a')
outline(pl)
pl.resize((256, 96), Image.NEAREST).save(OUT + 'platform.png')
print('ok')
