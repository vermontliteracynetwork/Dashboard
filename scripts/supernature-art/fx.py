"""Cut her three effects packs (Build Queue 141) into horizontal strips for the Supernature FX player.

Usage: python3 -I scripts/supernature-art/fx.py <dir with a/ b/ c/ extracted packs> <out dir>
  a = Pixel Explosion Effects Pack 01 (Sentient Dream Studio), b = Pixel Effect RPG Part 19 Free,
  c = Effects Pack 12. Every strip is frames side by side; the frame count is printed for supernatureFx.
"""
import glob, os, sys
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
A = glob.glob(os.path.join(src, 'a', '*'))[0]

def sheet(name):  # explosion pack spritesheets are already one row
    return Image.open(os.path.join(A, name, 'Spritesheet', f'{name}_spritesheet.png')).convert('RGBA')

def rpg(num, row):  # RPG sheets: 14 frames of 64x64, one colour per row
    im = Image.open(os.path.join(src, 'b', 'Free', f'{num}.png')).convert('RGBA')
    return im.crop((0, row * 64, 896, row * 64 + 64))

def orb(n):  # Effects Pack 12: 30 single 32x32 frames
    s = Image.new('RGBA', (32 * 30, 32))
    for k in range(1, 31):
        s.alpha_composite(Image.open(os.path.join(src, 'c', str(n), f'{k}.png')).convert('RGBA'), ((k - 1) * 32, 0))
    return s

def trim_empty(strip, fw):  # drop fully blank trailing frames
    n = strip.width // fw
    while n > 1 and strip.crop(((n - 1) * fw, 0, n * fw, strip.height)).getbbox() is None:
        n -= 1
    return strip.crop((0, 0, n * fw, strip.height))

ORANGE, PURPLE, BLUE, GREEN, TAN, WHITE, PINK, RED, VIOLET = range(9)
FX = {
    # battle hits, one per affinity
    'hit_fire': (sheet('SimpleExplosionC'), 64),
    'hit_water': (rpg(1656, BLUE), 64),
    'hit_storm': (sheet('SpaceExplosion'), 128),
    'hit_earth': (sheet('DustExplosion'), 64),
    'hit_nature': (rpg(1655, GREEN), 64),
    'hit_ice': (sheet('BlueExplosionB'), 64),
    'hit_light': (rpg(1676, ORANGE), 64),
    'hit_shadow': (rpg(1657, VIOLET), 64),
    'hit_mind': (rpg(1675, PURPLE), 64),
    'hit_wind': (rpg(1658, WHITE), 64),
    'hit_tackle': (rpg(1677, WHITE), 64),
    'miss': (sheet('SimpleExplosionB'), 64),
    # flying orbs
    'orb_fire': (rpg(1667, ORANGE), 64),
    'orb_water': (rpg(1667, BLUE), 64),
    'orb_earth': (rpg(1667, TAN), 64),
    'orb_ice': (rpg(1668, WHITE), 64),
    'orb_light': (rpg(1668, ORANGE), 64),
    'orb_wind': (rpg(1668, WHITE), 64),
    'orb_mind': (orb(1), 32),
    'orb_shadow': (orb(2), 32),
    'orb_storm': (orb(3), 32),
    # calm, potions, poof
    'breath': (rpg(1666, BLUE), 64),
    'heal': (rpg(1675, GREEN), 64),
    'potion': (rpg(1675, ORANGE), 64),
    'poof': (rpg(1656, WHITE), 64),
    # disasters
    'flame': (sheet('LargeExplosionB'), 64),
    'blast': (sheet('LargeExplosionA'), 64),
    'quake': (sheet('DustExplosion'), 64),
    'twister': (rpg(1665, WHITE), 64),
    'frost': (sheet('BlueExplosionA'), 64),
    'splash': (rpg(1656, BLUE), 64),
    'dust': (rpg(1666, TAN), 64),
}
for k, (im, fw) in FX.items():
    s = trim_empty(im, fw)
    s.save(os.path.join(out, f'{k}.png'), optimize=True)
    print(f"  {k}: {{ n: {s.width // fw}, w: {fw}, h: {s.height} }},")
