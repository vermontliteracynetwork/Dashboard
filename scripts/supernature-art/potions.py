"""Season potion bottles (Build Queue 121): her Witch's Cabinet bottles, recolored, each with a
small pixel emblem that shows what the potion is for. Run: python3 -I scripts/supernature-art/potions.py"""
import colorsys, os
from PIL import Image

SRC = 'public/games/supernature/cabinet/bottled-brews/'
OUT = 'public/games/supernature/potions/'
INK = (40, 26, 52, 255)
W_ = (255, 255, 255, 255)

# 9x9 emblems: '#' outline, 'o' fill color, 'w' white
EMB = {
  'flame':  ["....#....", "...#o#...", "..#oo#...", "..#ooo#..", ".#oowoo#.", ".#owwwo#.", ".#owwwo#.", "..#ooo#..", "...###..."],
  'sun':    ["#...#...#", ".#..#..#.", "...###...", "..#ooo#..", "###ooo###", "..#ooo#..", "...###...", ".#..#..#.", "#...#...#"],
  'drop':   ["....#....", "...#o#...", "...#o#...", "..#ooo#..", ".#ooooo#.", ".#owooo#.", ".#owooo#.", "..#ooo#..", "...###..."],
  'moon':   ["..####...", ".#oo#....", "#oo#.....", "#oo#..###", "#oo#...#.", "#ooo#.###", ".#ooo####", "..#oooo#.", "...####.."],
  'anchor': ["...###...", "...#.#...", "...###...", "#..#o#..#", "#..#o#..#", "##.#o#.##", ".#o#o#o#.", "..#ooo#..", "...###..."],
  'wind':   [".........", "#######..", "ooooooo#.", ".....#o#.", ".........", "########.", "oooooooo#", "......#o#", "........."],
  'umbrella':["...###...", ".##ooo##.", "#ooooooo#", "#########", "....#....", "....#....", "....#....", "..#.#....", "...#....."],
  'steady': [".........", "....#....", "...#o#...", "..#ooo#..", ".#ooooo#.", "#########", "#ooooooo#", "#########", "........."],
  'house':  ["....#....", "...#o#...", "..#ooo#..", ".#ooooo#.", "#########", ".#o###o#.", ".#o#w#o#.", ".#o#w#o#.", ".#######."],
  'egg':    ["...###...", "..#ooo#..", ".#owooo#.", ".#owooo#.", "#ooooooo#", "#ooooooo#", "#ooooooo#", ".#ooooo#.", "..#####.."],
  'star':   ["....#....", "...#o#...", "...#o#...", "####o####", "#ooowooo#", ".##ooo##.", "..#o#o#..", ".#o#.#o#.", ".##...##."],
}

# name: (base bottle, liquid hue 0..1, emblem, emblem color)
POTIONS = {
  'Thermo': ('healing_tincture', 0.06, 'flame', (255, 140, 40)),
  'Umbra':  ('mana_draught', 0.72, 'sun', (255, 215, 90)),
  'Hydro':  ('mana_draught', 0.53, 'drop', (110, 200, 255)),
  'Somnus': ('sleepy_draught', 0.70, 'moon', (230, 220, 255)),
  'Ancora': ('mystery_potion', 0.60, 'anchor', (190, 205, 225)),
  'Pneumo': ('liquid_luck', 0.40, 'wind', (220, 250, 240)),
  'Sicco':  ('preserved_fairy', 0.11, 'umbrella', (240, 90, 120)),
  'Stabil': ('transformation_serum', 0.08, 'steady', (190, 140, 90)),
  'Patria': ('friendship_philter', 0.30, 'house', (250, 190, 110)),
  'Nidus':  ('healing_tincture', 0.92, 'egg', (255, 235, 200)),
  'Redux':  ('ghost_essence', 0.14, 'star', (255, 230, 90)),
}

def recolor(im, hue):
  px = im.load()
  for y in range(im.height):
    for x in range(im.width):
      r, g, b, a = px[x, y]
      if a == 0: continue
      h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
      if s < 0.35 or (0.05 < h < 0.13 and v < 0.75 and s < 0.7):  # keep glass, metal and cork
        continue
      nr, ng, nb = colorsys.hsv_to_rgb(hue, min(1, s * 1.05), v)
      px[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
  return im

def stamp(im, emb, col, ox, oy, k=2):
  px = im.load()
  for j, row in enumerate(EMB[emb]):
    for i, ch in enumerate(row):
      c = INK if ch == '#' else (col + (255,)) if ch == 'o' else W_ if ch == 'w' else None
      if not c: continue
      for dy in range(k):
        for dx in range(k):
          px[ox + i * k + dx, oy + j * k + dy] = c

os.makedirs(OUT, exist_ok=True)
for name, (base, hue, emb, col) in POTIONS.items():
  im = Image.open(SRC + base + '.png').convert('RGBA')
  im = recolor(im, hue)
  # a round badge low on the bottle so the emblem reads at hotbar size
  badge = Image.new('RGBA', im.size, (0, 0, 0, 0)); bp = badge.load()
  cx, cy, rad = 32, 44, 12
  for y in range(64):
    for x in range(64):
      d = ((x - cx) ** 2 + (y - cy) ** 2) ** 0.5
      if d <= rad: bp[x, y] = INK if d > rad - 1.6 else (250, 244, 226, 255)
  im.alpha_composite(badge)
  stamp(im, emb, col, cx - 9, cy - 9)
  im.save(OUT + name.lower() + '.png')
print('ok', len(POTIONS))
