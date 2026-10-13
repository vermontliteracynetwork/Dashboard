"""Pixel textures for the Habitat (Build Queue 123, her words: "pixel water theme. lets make sure all
backgrounds and textures are pixel for design stuff"). Small images, scaled up with
image-rendering: pixelated. Run: python3 -I scripts/supernature-art/habitat_pixels.py"""
import math, os, random
from PIL import Image

OUT = 'public/games/supernature/habitat/px/'
os.makedirs(OUT, exist_ok=True)
random.seed(7)
def hexc(h, a=255): return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), a)
def img(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))

# sun and moon
def disc(name, body, rim, glow, crater=None):
  im = img(20, 20); p = im.load()
  for y in range(20):
    for x in range(20):
      d = math.hypot(x - 9.5, y - 9.5)
      if d <= 6.2: p[x, y] = hexc(body)
      elif d <= 7.3: p[x, y] = hexc(rim)
      elif d <= 9.4 and (x + y) % 2 == 0: p[x, y] = hexc(glow, 150)
  if crater:
    for cx, cy in [(7, 8), (11, 12), (12, 7)]: p[cx, cy] = hexc(crater); p[cx + 1, cy] = hexc(crater)
  else:
    for x, y in [(7, 6), (8, 6), (6, 7)]: p[x, y] = hexc('#fffbe0')
  im.save(OUT + name)
disc('sun.png', '#ffd970', '#f2a03a', '#ffe9a0')
disc('moon.png', '#e6eaf8', '#b8bfdc', '#c9d0e8', crater='#c3c9e2')

# clouds
def cloud(name, c1, c2):
  im = img(40, 14); p = im.load()
  blobs = [(10, 9, 6), (19, 6, 7), (29, 8, 6), (35, 10, 4), (5, 10, 4)]
  for y in range(14):
    for x in range(40):
      if any(math.hypot(x - bx, (y - by) * 1.2) <= r for bx, by, r in blobs) and y <= 12:
        p[x, y] = hexc(c2 if y >= 10 else c1)
  im.save(OUT + name)
cloud('cloud.png', '#ffffff', '#dfe8f6')
cloud('cloud-gray.png', '#d9dfeb', '#b5bdd0')

# water surface seen from below: a bright wavy band, tileable across 64 px
im = img(64, 16); p = im.load()
for x in range(64):
  top = 5 + round(2.5 * math.sin(2 * math.pi * x / 32) + 1.0 * math.sin(2 * math.pi * x / 16))
  for y in range(16):
    if y < top - 1: continue
    if y < top: p[x, y] = hexc('#ffffff')
    elif y < top + 2: p[x, y] = hexc('#bff1ff')
    elif y < top + 4: p[x, y] = hexc('#7fd6f2')
    else: p[x, y] = hexc('#4fb4e0')
im.save(OUT + 'water-surface.png')
im2 = im.copy(); p2 = im2.load()
for x in range(64):
  for y in range(16):
    r, g, b, a = p2[x, y]
    if a: p2[x, y] = (min(255, r + 60), min(255, g + 40), min(255, b + 20), a)
im2.save(OUT + 'water-surface-ice.png')

# little light flecks drifting in the water
im = img(32, 32); p = im.load()
for _ in range(7):
  x, y = random.randrange(32), random.randrange(32)
  p[x, y] = hexc('#bff1ff', 200)
  if random.random() < 0.5: p[(x + 1) % 32, y] = hexc('#bff1ff', 140)
im.save(OUT + 'water-fleck.png')

# sand floor tile
im = Image.new('RGBA', (32, 32), hexc('#e6c98a')); p = im.load()
for _ in range(70):
  x, y = random.randrange(32), random.randrange(32)
  p[x, y] = hexc(random.choice(['#d4b06a', '#f2dca6', '#c99a52']))
im.save(OUT + 'sand.png')

# seaweed and coral
def weed(name, col, dark, h):
  im = img(14, h); p = im.load()
  for y in range(h):
    x = 6 + round(2 * math.sin(y / 5))
    for dx in (-1, 0, 1):
      p[x + dx, y] = hexc(dark if dx == -1 else col)
    if y % 7 == 3: p[x + 2, y] = hexc(col); p[x + 3, y - 1] = hexc(col)
    if y % 7 == 0: p[x - 2, y] = hexc(col); p[x - 3, y - 1] = hexc(col)
  im.save(OUT + name)
weed('seaweed1.png', '#3fae6a', '#24704a', 40)
weed('seaweed2.png', '#5fc27a', '#2f8a52', 30)
im = img(24, 18); p = im.load()
for bx, top in [(5, 3), (11, 0), (17, 4)]:
  for y in range(top, 18):
    for dx in (-1, 0, 1): p[bx + dx, y] = hexc('#f27a8a' if dx else '#ff9aa8')
  for y in range(top + 3, 14, 4):
    p[bx - 2, y] = hexc('#f27a8a'); p[bx + 2, y + 1] = hexc('#f27a8a')
for x in range(2, 22): p[x, 17] = hexc('#c95a6a')
im.save(OUT + 'coral.png')
im = img(8, 8); p = im.load()
for y in range(8):
  for x in range(8):
    d = math.hypot(x - 3.5, y - 3.5)
    if 2.4 < d <= 3.5: p[x, y] = hexc('#dff6ff')
p[2, 2] = hexc('#ffffff'); im.save(OUT + 'bubble.png')

# snow cover, blossoms and fall leaves (tiles laid over the ground)
im = Image.new('RGBA', (32, 32), hexc('#f4f8ff', 215)); p = im.load()
for _ in range(40):
  x, y = random.randrange(32), random.randrange(32); p[x, y] = hexc(random.choice(['#dce6f6', '#ffffff', '#c9d6ee']), 230)
im.save(OUT + 'snow.png')
def scatter(name, cols, n, size=48):
  im = img(size, size); p = im.load()
  for _ in range(n):
    x, y = random.randrange(1, size - 2), random.randrange(1, size - 2); c = hexc(random.choice(cols))
    for dx, dy in [(0, 0), (1, 0), (0, 1), (-1, 0), (0, -1)]: p[x + dx, y + dy] = c
    p[x, y] = hexc('#fff6a8') if 'blossom' in name else hexc('#7a3a1a')
  im.save(OUT + name)
scatter('blossoms.png', ['#ffb6d5', '#f6f1ff', '#ff8fc0'], 7)
scatter('leaves.png', ['#d9682a', '#e8a33a', '#a8452a', '#c9502a'], 9)
print('ok')
