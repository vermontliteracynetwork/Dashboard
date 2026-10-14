"""Pixel plants for the Habitat and the Cauldron (Build Queue 135, 136). 24x24 sprites with a dark
outline, drawn from a few plant shapes and palettes. Run: python3 -I scripts/supernature-art/plants.py"""
import math, os
from PIL import Image
OUT = 'public/games/supernature/plants/'
os.makedirs(OUT, exist_ok=True)
INK = (40, 26, 52, 255)
def hx(h): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)
class C:
  def __init__(s): s.im = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); s.p = s.im.load()
  def px(s, x, y, c):
    if 0 <= x < 24 and 0 <= y < 24: s.p[x, y] = hx(c) if isinstance(c, str) else c
  def disc(s, cx, cy, r, c):
    for y in range(24):
      for x in range(24):
        if (x - cx) ** 2 + (y - cy) ** 2 <= r * r: s.px(x, y, c)
  def line(s, x0, y0, x1, y1, c):
    n = max(abs(x1 - x0), abs(y1 - y0)) or 1
    for i in range(n + 1): s.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)
  def outline(s):
    a = [[s.p[x, y][3] > 0 for x in range(24)] for y in range(24)]
    for y in range(24):
      for x in range(24):
        if a[y][x]: continue
        if any(0 <= x + dx < 24 and 0 <= y + dy < 24 and a[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): s.p[x, y] = INK
  def save(s, name): s.outline(); s.im.save(OUT + name + '.png')

def flower(name, petal, center, leaf='#4f9a5b', heads=((12, 7),), r=3):
  c = C()
  for hx_, hy in heads: c.line(hx_, hy, 12, 21, leaf)
  c.line(12, 16, 8, 13, leaf); c.line(12, 18, 16, 15, leaf); c.px(8, 12, leaf); c.px(16, 14, leaf)
  for hx_, hy in heads:
    for a in range(6):
      ang = a * math.pi / 3
      c.disc(hx_ + round(math.cos(ang) * (r - 1)), hy + round(math.sin(ang) * (r - 1)), 1.6, petal)
    c.disc(hx_, hy, 1.2, center)
  c.save(name)
def spike(name, flower_c, leaf='#5f8a5b'):  # lavender / sneezeweed spikes
  c = C()
  for x in (8, 12, 16):
    c.line(x, 21, x + (x - 12) // 4, 8, leaf)
    for y in range(5, 12, 2): c.px(x + (x - 12) // 4, y, flower_c); c.px(x + (x - 12) // 4 + 1, y + 1, flower_c)
  c.save(name)
def bush(name, leaf, dark, berry=None):
  c = C()
  for cx, cy, r in ((8, 15, 5), (15, 14, 6), (12, 10, 5)): c.disc(cx, cy, r, leaf)
  for x, y in ((9, 12), (14, 9), (16, 16), (7, 17)): c.px(x, y, dark); c.px(x + 1, y, dark)
  if berry:
    for x, y in ((10, 9), (16, 12), (8, 16), (13, 17)): c.px(x, y, berry)
  c.save(name)
def cactus(name, body, flower_c):
  c = C()
  for y in range(6, 22): [c.px(x, y, body) for x in range(10, 15)]
  for y in range(11, 16): [c.px(x, y, body) for x in range(5, 9)]
  for y in range(8, 11): [c.px(x, y, body) for x in range(5, 8)]
  for y in range(9, 14): [c.px(x, y, body) for x in range(16, 20)]
  for y in range(6, 9): [c.px(x, y, body) for x in range(17, 20)]
  for y in range(8, 21, 3): c.px(12, y, '#2f6a3a')
  c.disc(12, 5, 1.6, flower_c); c.disc(18, 5, 1.2, flower_c)
  c.save(name)
def aloe(name):
  c = C()
  for ang in (-60, -35, -12, 12, 35, 60):
    a = math.radians(ang - 90)
    for t in range(13): w = 1 if t > 8 else 2; [c.px(round(12 + math.cos(a) * t) + d, round(21 + math.sin(a) * t), '#6fb38a') for d in range(w)]
  for x, y in ((9, 13), (15, 12), (12, 10)): c.px(x, y, '#d6f0e0')
  c.save(name)
def mushroom(name, cap, spots, stem='#efe6d0', glow=False):
  c = C()
  if glow: c.disc(12, 10, 9, (150, 255, 220, 70))
  for y in range(12, 21): [c.px(x, y, stem) for x in range(10, 14)]
  for y in range(5, 13):
    w = int(math.sqrt(max(0, 49 - (12 - y) ** 2 * 1.4)))
    for x in range(12 - w, 12 + w): c.px(x, y, cap)
  for x, y in ((9, 8), (14, 7), (12, 10), (16, 10)): c.px(x, y, spots)
  c.save(name)
def fern(name, leaf):
  c = C()
  for side in (-1, 1):
    for i, ang in enumerate((70, 50, 30)):
      a = math.radians(ang); x0, y0 = 12, 21
      for t in range(14 - i * 2):
        x = round(x0 + side * math.cos(a) * t * 0.7); y = round(y0 - math.sin(a) * t * 1.1)
        c.px(x, y, leaf)
        if t % 2 == 0: c.px(x + side, y - 1, leaf)
  c.line(12, 21, 12, 4, leaf)
  c.save(name)
def reed(name, head='#7a4a2e'):
  c = C()
  for x, top in ((8, 6), (12, 3), (16, 7)):
    c.line(x, 22, x, top + 5, '#6f9a4b')
    for y in range(top, top + 5): c.px(x, y, head); c.px(x + 1, y, head)
  c.line(10, 22, 6, 12, '#8fbf6a'); c.line(14, 22, 19, 13, '#8fbf6a')
  c.save(name)
def lily(name, petal):
  c = C()
  for y in range(14, 21):
    for x in range(3, 21):
      if ((x - 12) / 9) ** 2 + ((y - 17) / 3.4) ** 2 <= 1 and not (x > 11 and y < 17 and x - 12 < (17 - y) * 1.2): c.px(x, y, '#4f9a5b')
  for a in range(5):
    ang = math.radians(-90 + (a - 2) * 32)
    c.line(12, 14, round(12 + math.cos(ang) * 5), round(14 + math.sin(ang) * 6), petal)
  c.disc(12, 13, 1.2, '#f2c14e')
  c.save(name)
def moss(name, a, b):
  c = C()
  for x in range(3, 21):
    h = 4 + int(2 * math.sin(x / 2.0))
    for y in range(22 - h, 22): c.px(x, y, a if (x + y) % 3 else b)
  c.save(name)
def kelp(name):
  c = C()
  for x0, top in ((8, 2), (14, 5)):
    for y in range(top, 23):
      x = x0 + round(1.5 * math.sin(y / 3))
      c.px(x, y, '#5a7a2e'); c.px(x + 1, y, '#7a9a3a')
      if y % 5 == 0: c.px(x + 2, y, '#7a9a3a'); c.px(x + 3, y - 1, '#7a9a3a')
  c.save(name)
def coral(name, col, dark):
  c = C()
  for bx, top in ((7, 6), (12, 3), (17, 7)):
    for y in range(top, 21): c.px(bx, y, col); c.px(bx + 1, y, col)
    c.line(bx, top + 5, bx - 3, top + 1, col); c.line(bx + 1, top + 7, bx + 4, top + 3, col)
  for x in range(4, 21): c.px(x, 21, dark)
  c.save(name)
def anemone(name, col):
  c = C()
  c.disc(12, 18, 4, '#c95a6a')
  for a in range(9):
    ang = math.radians(-160 + a * 17.5)
    c.line(12, 15, round(12 + math.cos(ang) * 8), round(15 + math.sin(ang) * 9), col)
  c.save(name)
def nettle(name):
  c = C()
  c.line(12, 22, 12, 3, '#3f7a3a')
  for y, side in ((6, -1), (9, 1), (12, -1), (15, 1), (18, -1)):
    for t in range(5): c.px(12 + side * (t + 1), y - t // 2, '#4f9a4b'); c.px(12 + side * (t + 1), y - t // 2 + 1, '#3f7a3a')
    c.px(12 + side * 6, y - 3, '#d6f0e0')
  c.save(name)
def sundew(name):
  c = C()
  for ang in range(-70, 71, 28):
    a = math.radians(ang - 90); x1 = round(12 + math.cos(a) * 8); y1 = round(21 + math.sin(a) * 10)
    c.line(12, 21, x1, y1, '#a8453a'); c.disc(x1, y1, 1.6, '#e05a4a'); c.px(x1, y1 - 2, '#ffe9f0')
  c.save(name)
def seedling(name):
  c = C()
  for y in range(18, 23):
    for x in range(4, 21):
      if ((x - 12) / 8) ** 2 + ((y - 22) / 4) ** 2 <= 1: c.px(x, y, '#7a4a2e')
  c.line(12, 18, 12, 13, '#4f9a5b'); c.disc(10, 12, 2, '#6fbf6a'); c.disc(14, 12, 2, '#6fbf6a')
  c.save(name)
def mound(name):
  c = C()
  for y in range(17, 23):
    for x in range(3, 22):
      if ((x - 12) / 9) ** 2 + ((y - 22) / 5) ** 2 <= 1: c.px(x, y, '#8a5a3a' if (x + y) % 4 else '#6e4628')
  for x in (8, 12, 16): c.px(x, 19, '#f2dca6')
  c.save(name)

flower('chamomile', '#ffffff', '#f2c14e')
spike('lavender', '#9b7ad6')
flower('clover', '#f6f1ff', '#e0457a', heads=((9, 9), (15, 8)), r=2)
spike('sneezeweed', '#f2c14e', leaf='#6f8a3b')
flower('peppermint', '#c9e9b6', '#5fae6a', heads=((10, 8), (14, 10)), r=2)
flower('echinacea', '#e07ac0', '#a85a2e')
fern('fern', '#4f9a4b')
flower('foxglove', '#c46ad6', '#ffffff', heads=((12, 5), (12, 9)), r=2)
mushroom('glowcap', '#5ad6c8', '#e6fffa', glow=True)
bush('willow', '#8fbf6a', '#5f8a4b')
reed('cattail')
sundew('sundew')
lily('waterlily', '#f6c1d6')
nettle('nettle')
moss('arcticmoss', '#a8c88a', '#d6e8c8')
flower('snowlotus', '#e6f0ff', '#b8c8f0', leaf='#7aa0a0', r=4)
aloe('aloe')
cactus('pricklypear', '#4f9a5b', '#e0457a')
bush('sagebrush', '#a8b89a', '#7a8a6a')
kelp('kelp')
coral('coral', '#f27a8a', '#c95a6a')
anemone('anemone', '#f2a33a')
seedling('sprout')
mound('mound')
print('ok')
