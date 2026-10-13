from kit import *
import math
C = 23.5; SK = '#f2c7a0'; GOLD = '#f2c14e'
def water(a, y=40, col='#3a6fd1'):
    R(a, 0, y, 47, 47, col, edge=False, shade=False)
    for x in range(0, 48, 6): D(a, [(x, y), (x + 1, y), (x + 2, y - 1), (x + 3, y - 1)], '#8fd3f0')

def raven(a):
    T(a, [(18, 38), (16, 45)], 2, '#3a3450', edge=False); T(a, [(24, 38), (25, 45)], 2, '#3a3450', edge=False)
    P(a, [(6, 30), (14, 24), (12, 34)], '#1f1b30')                            # tail
    E(a, 21, 30, 11, 9, '#2a2540')
    P(a, [(12, 26), (26, 24), (30, 33), (16, 36)], '#3a3463')                 # wing with sheen
    E(a, 31, 18, 7, 7, '#2a2540')
    P(a, [(36, 15), (44, 18), (36, 21)], '#4a4458')                           # beak
    E(a, 45, 18, 2, 2, '#ffd970'); D(a, [(45, 17)], '#ffffff')               # the light it carried
    for (x, y) in ((42, 13), (47, 14), (46, 22)): D(a, [(x, y)], '#ffd970')
    eye1(a, 32, 16, '#120f1c'); D(a, [(33, 16)], '#c8c2ff')

def thunderbird(a):
    E(a, 23.5, 6, 18, 5, '#5b6a8a', edge=False, shade=False)                  # storm cloud
    E(a, 12, 6, 8, 4, '#6f7fa0', edge=False, shade=False); E(a, 34, 5, 9, 4, '#6f7fa0', edge=False, shade=False)
    for s in (-1, 1):
        P(a, [(C + s * 4, 20), (C + s * 23, 12), (C + s * 21, 18), (C + s * 23, 21), (C + s * 19, 25), (C + s * 20, 28), (C + s * 5, 30)], '#2f3a5c')
        for k in range(3): D(a, [(int(C + s * (12 + k * 3)), 22 - k), (int(C + s * (12 + k * 3)), 23 - k)], '#8fd3f0')
    E(a, 23.5, 27, 6, 10, '#3d4a70')
    P(a, [(19, 36), (28, 36), (31, 44), (16, 44)], '#2f3a5c')
    E(a, 23.5, 15, 5, 5, '#3d4a70')
    P(a, [(21, 17), (26, 17), (23.5, 22)], GOLD)
    eye1(a, 20, 13, '#ffd970'); eye1(a, 26, 13, '#ffd970')
    P(a, [(6, 30), (3, 37), (6, 37), (2, 45), (9, 34), (6, 34), (9, 30)], '#f2d24e')
    P(a, [(41, 30), (38, 37), (41, 37), (37, 45), (44, 34), (41, 34), (44, 30)], '#f2d24e')

def siren(a):
    P(a, [(4, 40), (12, 34), (36, 34), (44, 40), (44, 47), (4, 47)], '#8f8aa8')   # rock
    T(a, [(19, 32), (18, 37)], 2, '#c9873a', edge=False); T(a, [(28, 32), (29, 37)], 2, '#c9873a', edge=False)
    P(a, [(10, 30), (6, 36), (14, 33)], '#7a5a3a')                            # tail feathers
    E(a, 23.5, 26, 11, 8, '#a8794a')
    P(a, [(13, 22), (27, 20), (31, 29), (16, 31)], '#7a5a3a')                 # wing
    P(a, [(15, 6), (32, 6), (34, 22), (13, 22)], '#3d2a20')                   # hair
    E(a, 23.5, 12, 8, 7, SK)
    P(a, [(15, 10), (18, 4), (29, 4), (32, 10), (28, 7), (19, 7)], '#3d2a20')
    eyes(a, cy=11, dx=3, h=2); D(a, [(23, 16), (24, 16)], '#d9707a')
    for (x, y) in ((38, 10), (41, 6), (36, 4)):                                # music notes
        D(a, [(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1), (x + 1, y - 1), (x + 1, y - 2), (x + 1, y - 3), (x + 2, y - 3)], '#f6f1ff')

def pegasus(a):
    for x in (12, 28): R(a, x, 33, x + 3, 44, '#d9d2e8')
    T(a, [(9, 27), (4, 32), (5, 40)], 4, '#e8e4ee')
    P(a, [(14, 24), (6, 6), (14, 10), (16, 4), (22, 11), (26, 6), (28, 24)], '#ffffff')  # wing up
    for (x0, y0) in ((9, 9), (15, 8), (21, 11)): T(a, [(x0, y0), (x0 + 4, y0 + 10)], 1, '#c9d6f0', edge=False)
    E(a, 20, 28, 12, 7, '#f6f1ff')
    for x in (9, 25): R(a, x, 33, x + 3, 44, '#f6f1ff')
    for x in (9, 12, 25, 28): R(a, x, 43, x + 3, 45, '#8f8aa8', edge=False)
    P(a, [(27, 26), (31, 14), (37, 16), (34, 28)], '#f6f1ff')
    E(a, 37, 15, 6, 5, '#f6f1ff'); E(a, 41, 18, 4, 3, '#f6f1ff')
    P(a, [(29, 13), (33, 9), (31, 20), (28, 26), (26, 22)], '#bfe8ff')
    P(a, [(34, 11), (35, 7), (37, 10)], '#f6f1ff')
    eye1(a, 38, 14); D(a, [(43, 19)], '#8f8aa8')

def phoenix(a):
    for i, col in enumerate(('#c8443a', '#f2783a', '#f2c14e')):
        T(a, [(18, 32), (12 - i * 2, 40), (6 + i * 3, 46)], 4 - i, col)
        T(a, [(22, 34), (22 + i * 4, 42), (28 + i * 5, 46)], 4 - i, col)
    for s in (-1, 1):
        P(a, [(C + s * 3, 22), (C + s * 20, 4), (C + s * 21, 12), (C + s * 17, 16), (C + s * 18, 22), (C + s * 6, 30)], '#f2783a')
        P(a, [(C + s * 5, 24), (C + s * 15, 14), (C + s * 15, 20), (C + s * 7, 28)], '#f2c14e')
    E(a, 23.5, 25, 6, 9, '#c8443a')
    E(a, 23.5, 13, 5, 5, '#c8443a')
    P(a, [(21, 15), (26, 15), (23.5, 20)], GOLD)
    eye1(a, 20, 11, '#241f45'); eye1(a, 26, 11, '#241f45')
    P(a, [(21, 8), (23.5, 0), (26, 8)], '#f2c14e')                           # crest flame

def hydra(a):
    water(a, 38)
    E(a, 23.5, 38, 15, 6, '#3f8f5a')
    necks = [(6, 14), (14, 6), (23.5, 3), (33, 6), (41, 14)]
    for (x, y) in necks:
        T(a, [(23.5 + (x - 23.5) * 0.4, 36), ((x + 23.5) / 2, (y + 36) / 2 + 2), (x, y + 3)], 4, '#3f8f5a')
    for (x, y) in necks:
        E(a, x, y + 2, 4, 3, '#4fa86a'); eye1(a, int(x) - 2, y + 1, '#f2c14e'); D(a, [(int(x) + 2, y + 4)], '#2a5a3a')
    for x in range(12, 36, 5): D(a, [(x, 36), (x + 1, 35)], '#2a5a3a')

def kraken(a):
    water(a, 34)
    P(a, [(36, 30), (38, 25), (44, 25), (46, 30)], '#8a5a2e'); T(a, [(41, 25), (41, 18)], 1, '#e9e2d0', edge=False)
    P(a, [(41, 18), (45, 23), (41, 23)], '#f6f1ff')                           # little boat
    for (x0, x1, y1) in ((10, 3, 22), (14, 8, 12), (32, 36, 14), (35, 44, 30)):
        T(a, [(x0, 36), ((x0 + x1) / 2, (36 + y1) / 2 + 3), (x1, y1)], 4, '#a83f6a')
        E(a, x1, y1, 2, 2, '#a83f6a')
    E(a, 23.5, 24, 11, 13, '#a83f6a')
    E(a, 18, 26, 3, 3, '#ffffff'); E(a, 29, 26, 3, 3, '#ffffff')
    R(a, 18, 26, 19, 28, '#120f1c', False, False); R(a, 29, 26, 30, 28, '#120f1c', False, False)
    for (x, y) in ((20, 15), (27, 13), (24, 19)): E(a, x, y, 1, 1, '#c45a86', edge=False)

def nessie(a):
    water(a, 34, '#2f4f7a')
    for (x, r) in ((12, 5), (24, 6)): E(a, x, 36, r, r, '#5f7a5a')
    T(a, [(32, 37), (35, 28), (34, 18), (38, 10)], 5, '#5f7a5a')               # long neck
    E(a, 40, 9, 5, 4, '#5f7a5a')
    eye1(a, 41, 7); D(a, [(44, 10)], '#3d4a3a')
    T(a, [(4, 37), (2, 34)], 3, '#5f7a5a')
    R(a, 0, 38, 47, 47, '#2f4f7a', edge=False, shade=False)
    for x in range(0, 48, 6): D(a, [(x, 38), (x + 1, 38), (x + 2, 37)], '#6f9fd0')

def champ(a):
    for (x0, y0, x1, h) in ((0, 30, 22, 6), (26, 32, 47, 4)):
        P(a, [(x0, y0 + 8), ((x0 + x1) / 2, y0 - h), (x1, y0 + 8)], '#5a7a6a', edge=False, shade=False)   # Green Mountains
    water(a, 36, '#2a5f86')
    for (x, r) in ((8, 4), (17, 5)): E(a, x, 37, r, r, '#4a3a2a')
    T(a, [(24, 38), (27, 30), (30, 22), (34, 17)], 5, '#4a3a2a')
    E(a, 36, 16, 6, 4, '#4a3a2a'); E(a, 41, 18, 4, 3, '#4a3a2a')              # horse-like head
    P(a, [(29, 18), (31, 12), (33, 22), (28, 30), (26, 26)], '#7a5a3a')       # little mane
    eye1(a, 37, 15, '#f2c14e'); D(a, [(43, 17)], '#2a1f18')
    R(a, 0, 40, 47, 47, '#2a5f86', edge=False, shade=False)
    for x in range(0, 48, 6): D(a, [(x, 40), (x + 1, 40), (x + 2, 39)], '#8fd3f0')

def kappa(a):
    E(a, 23.5, 29, 11, 9, '#8a6a3a')                                          # shell behind
    chibi(a, '#6fb05a', '#6fb05a', '#6fb05a', '#5a9a48', head=False)
    E(a, 23.5, 30, 6, 6, '#e8d98a')                                           # belly plate
    E(a, 23.5, 14, 10, 9, '#6fb05a')
    P(a, [(13, 9), (16, 5), (31, 5), (34, 9), (30, 8), (17, 8)], '#2a5a3a')   # hair fringe
    E(a, 23.5, 5, 6, 2, '#bfe8ff')                                            # water dish
    E(a, 23.5, 5, 4, 1, '#8fd3f0', edge=False, shade=False)
    P(a, [(20, 16), (27, 16), (23.5, 21)], GOLD)                             # beak
    eyes(a, cy=12, h=2)

def umibozu(a):
    water(a, 34, '#1f3a5c')
    E(a, 23.5, 28, 17, 18, '#22203a')
    E(a, 18, 15, 3, 2, '#3a3660', edge=False, shade=False)                    # shine
    E(a, 17, 25, 3, 3, '#f6f1ff'); E(a, 30, 25, 3, 3, '#f6f1ff')
    R(a, 17, 25, 18, 27, '#f2c14e', False, False); R(a, 30, 25, 31, 27, '#f2c14e', False, False)
    R(a, 0, 38, 47, 47, '#1f3a5c', edge=False, shade=False)
    for x in range(0, 48, 5): D(a, [(x, 38), (x + 1, 38), (x + 2, 37)], '#6f9fd0')

def mermaid(a):
    P(a, [(6, 42), (12, 37), (34, 37), (42, 42), (42, 47), (6, 47)], '#8f8aa8')
    T(a, [(23.5, 30), (28, 38), (36, 40)], 9, '#2fa89a')                      # tail
    P(a, [(35, 36), (44, 32), (41, 40), (44, 46), (35, 43)], '#57d3b8')       # fin
    P(a, [(14, 8), (33, 8), (36, 30), (11, 30)], '#c8443a')                   # long red hair
    P(a, [(17, 20), (30, 20), (32, 31), (15, 31)], SK)
    E(a, 20, 23, 3, 2, '#a86ad1'); E(a, 27, 23, 3, 2, '#a86ad1')              # shell top
    T(a, [(16, 22), (12, 29)], 3, SK); T(a, [(31, 22), (35, 29)], 3, SK)
    E(a, 23.5, 13, 8, 7, SK)
    P(a, [(15, 12), (18, 5), (29, 5), (32, 12), (28, 9), (19, 9)], '#c8443a')
    eyes(a, cy=12, dx=3, h=2); D(a, [(23, 17), (24, 17)], '#d9707a')

def bunyip(a):
    water(a, 38, '#3a5a4a')
    for x in (4, 8, 40, 44): T(a, [(x, 46), (x + 1, 30)], 2, '#7a8a4a', edge=False); D(a, [(x + 1, 29), (x + 1, 30), (x + 1, 31)], '#8a5a2e')
    E(a, 22, 34, 13, 8, '#5b4430')
    P(a, [(26, 38), (36, 40), (30, 44)], '#4a3624')                           # flipper
    E(a, 32, 25, 8, 7, '#5b4430')
    E(a, 37, 28, 4, 3, '#7a5e44')                                             # dog-like muzzle
    D(a, [(40, 27), (40, 28)], '#120f1c')
    E(a, 26, 20, 2, 3, '#4a3624')
    D(a, [(36, 31), (37, 32)], '#efe6d0')                                     # small tusk
    eye1(a, 32, 23, '#f2c14e')
    R(a, 0, 42, 47, 47, '#3a5a4a', edge=False, shade=False)

def sphinx(a):
    P(a, [(4, 44), (44, 44), (44, 47), (4, 47)], '#d9b26a', edge=False, shade=False)
    E(a, 18, 36, 14, 7, '#d9b26a')                                            # lying lion body
    T(a, [(5, 38), (2, 44)], 3, '#d9b26a')
    R(a, 28, 39, 44, 43, '#d9b26a')                                           # front paws
    P(a, [(22, 12), (38, 12), (41, 32), (19, 32)], '#3a6fd1')                 # nemes headdress
    for y in range(15, 32, 3): D(a, [(x, y) for x in range(21, 40)], GOLD)
    E(a, 30, 17, 7, 7, '#c9873a')
    P(a, [(22, 13), (30, 7), (38, 13), (36, 11), (24, 11)], '#3a6fd1')
    eye1(a, 26, 16); eye1(a, 33, 16); D(a, [(29, 21), (30, 21), (31, 21)], '#7a4a2e')
    R(a, 29, 24, 31, 27, '#3a6fd1', edge=False)                               # beard piece

def centaur(a):
    for x in (8, 24): R(a, x, 33, x + 3, 44, '#6a4a30')
    T(a, [(5, 27), (2, 34), (3, 41)], 4, '#3d2a20')
    E(a, 17, 29, 12, 7, '#8a5a3a')
    for x in (5, 21): R(a, x, 33, x + 3, 44, '#8a5a3a')
    for x in (5, 8, 21, 24): R(a, x, 43, x + 3, 45, '#3d2a20', edge=False)
    P(a, [(25, 14), (35, 14), (36, 28), (24, 28)], SK)                        # human torso
    T(a, [(25, 16), (36, 26)], 2, '#7a5a3a', edge=False)                      # strap
    T(a, [(35, 16), (40, 22), (43, 17)], 3, SK)                               # waving arm
    T(a, [(25, 16), (21, 24)], 3, SK)
    E(a, 30.5, 8, 6, 6, SK)
    P(a, [(24, 8), (26, 2), (35, 2), (37, 8), (34, 5), (27, 5)], '#c8443a')
    eye1(a, 28, 8); eye1(a, 33, 8)

def chimera(a):
    T(a, [(6, 30), (2, 22), (6, 16)], 3, '#4f9a5b')                           # snake tail
    E(a, 7, 15, 3, 2, '#4f9a5b'); D(a, [(6, 14)], '#120f1c')
    for x in (10, 26): R(a, x, 33, x + 3, 44, '#b8892e')
    E(a, 21, 29, 13, 7, '#d9a636')
    for x in (7, 23): R(a, x, 33, x + 3, 44, '#d9a636')
    T(a, [(19, 24), (17, 16)], 4, '#e8e4ee'); E(a, 17, 13, 4, 4, '#e8e4ee')   # goat head on its back
    T(a, [(15, 10), (11, 6)], 2, '#8f8aa8', edge=False); T(a, [(19, 10), (21, 5)], 2, '#8f8aa8', edge=False)
    eye1(a, 16, 12)
    E(a, 35, 22, 9, 9, '#b8582e')                                             # lion mane
    E(a, 37, 23, 6, 6, '#d9a636')
    eye1(a, 36, 20); eye1(a, 40, 20); D(a, [(38, 25), (39, 25)], '#7a3a2a')

def griffin(a):
    for x in (9, 25): R(a, x, 33, x + 3, 44, '#b8892e')
    T(a, [(6, 30), (2, 36), (4, 42)], 2, '#b8892e'); E(a, 4, 43, 2, 2, '#7a5a3a')
    P(a, [(14, 24), (4, 6), (12, 9), (14, 3), (20, 10), (24, 6), (27, 24)], '#8a5a3a')   # wing
    E(a, 19, 29, 12, 7, '#d9a636')
    R(a, 6, 33, 9, 44, '#d9a636')
    R(a, 26, 33, 29, 41, '#f6f1ff'); D(a, [(26, 42), (28, 42), (30, 42)], GOLD)   # eagle front leg
    E(a, 32, 22, 7, 8, '#f6f1ff')
    E(a, 35, 15, 6, 6, '#f6f1ff')
    P(a, [(39, 13), (45, 16), (42, 20), (39, 18)], GOLD)
    eye1(a, 36, 13)

def jackalope(a):
    E(a, 23, 33, 11, 9, '#a87a52')
    E(a, 14, 37, 4, 3, '#efe6d0')                                             # cottontail
    E(a, 31, 42, 5, 2, '#a87a52')
    E(a, 30, 22, 7, 6, '#a87a52')
    T(a, [(27, 17), (24, 4)], 4, '#a87a52'); T(a, [(31, 17), (32, 4)], 4, '#a87a52')   # long ears
    T(a, [(26, 16), (20, 9), (21, 3)], 2, '#5b3a2a', edge=False); T(a, [(22, 9), (17, 6)], 1, '#5b3a2a', edge=False)   # little antlers
    T(a, [(33, 16), (38, 9), (37, 3)], 2, '#5b3a2a', edge=False); T(a, [(37, 9), (42, 6)], 1, '#5b3a2a', edge=False)
    eye1(a, 32, 21); D(a, [(36, 24)], '#c27a9a')

def werewolf(a):
    E(a, 38, 6, 4, 4, '#f6f1ff', edge=False, shade=False); E(a, 40, 5, 3, 3, (0, 0, 0), edge=False, shade=False)
    chibi(a, '#7a6a5a', '#c8443a', '#3a5a8a', '#5b4a3a', hand='#7a6a5a')
    for x in range(16, 32, 4): D(a, [(x, y) for y in range(23, 37)], '#8a2f2a')   # plaid shirt
    D(a, [(x, 29) for x in range(16, 32)], '#8a2f2a')
    P(a, [(14, 11), (14, 0), (21, 6)], '#6a5a4a'); P(a, [(33, 11), (33, 0), (26, 6)], '#6a5a4a')
    E(a, 23.5, 13, 10, 8, '#7a6a5a')
    E(a, 23.5, 17, 5, 4, '#b8a894')                                           # snout
    R(a, 22, 15, 25, 16, '#120f1c', False, False)
    eye1(a, 18, 11, '#f2c14e'); eye1(a, 28, 11, '#f2c14e')
    D(a, [(13, 16), (12, 17), (34, 16), (35, 17)], '#7a6a5a')

def selkie(a):
    water(a, 40)
    P(a, [(2, 40), (8, 32), (30, 32), (40, 40)], '#8f8aa8')                   # rock
    E(a, 22, 30, 13, 6, '#8a9ab0')
    P(a, [(8, 30), (2, 26), (3, 34)], '#7a8aa0')
    E(a, 34, 24, 6, 6, '#8a9ab0')
    for (x, y) in ((14, 28), (20, 31), (26, 28), (17, 33)): D(a, [(x, y), (x + 1, y)], '#6a7a90')
    E(a, 30, 34, 3, 2, '#7a8aa0')
    eye1(a, 34, 22, '#120f1c'); D(a, [(38, 25), (39, 25)], '#3d3346')
    D(a, [(40, 26), (41, 25), (40, 24)], '#c8c2d6')

def curupira(a):
    chibi(a, '#c98b5a', '#4f9a5b', '#4f9a5b', '#c98b5a', legs=False)
    R(a, 18, 35, 22, 41, '#c98b5a'); R(a, 25, 35, 29, 41, '#c98b5a')
    E(a, 17, 43, 5, 2, '#c98b5a'); E(a, 24, 43, 5, 2, '#c98b5a')              # feet point backward
    for x in range(16, 32, 4): P(a, [(x, 34), (x + 2, 38), (x + 4, 34)], '#3d7a48')   # leaf hem
    P(a, [(12, 13), (10, 4), (15, 7), (17, -1), (21, 5), (24, -3), (27, 4), (31, -1), (32, 7), (38, 3), (36, 13)], '#e0452f')  # flame hair
    P(a, [(15, 9), (17, 3), (20, 8), (24, 1), (27, 8), (30, 3), (32, 9)], '#f2a03a')
    eyes(a); D(a, [(21, 19), (22, 20), (23, 20), (24, 20), (25, 20), (26, 19)], '#7a3a2a')

def kitsune(a):
    for (ex, ey) in ((5, 16), (3, 28), (8, 40)):
        T(a, [(18, 36), ((18 + ex) / 2 + 2, (36 + ey) / 2), (ex, ey)], 6, '#f2783a')
        E(a, ex, ey, 3, 3, '#f6f1ff')
    E(a, 24, 34, 9, 9, '#f2783a')
    E(a, 27, 37, 5, 6, '#f6f1ff')
    R(a, 22, 40, 25, 45, '#f2783a'); R(a, 28, 40, 31, 45, '#f2783a')
    E(a, 30, 20, 7, 6, '#f2783a')
    P(a, [(25, 17), (24, 7), (29, 14)], '#f2783a'); P(a, [(33, 15), (36, 6), (36, 16)], '#f2783a')
    E(a, 34, 23, 4, 3, '#f6f1ff')
    eye1(a, 29, 19); eye1(a, 34, 19); D(a, [(37, 24)], '#120f1c')
    E(a, 42, 8, 2, 3, '#7fbfff', edge=False, shade=False); D(a, [(42, 8)], '#ffffff')

def anansi(a):
    T(a, [(23.5, 0), (23.5, 18)], 1, '#e8e4ee', edge=False)
    for s in (-1, 1):
        for k, (dx, dy) in enumerate(((12, -6), (15, 0), (14, 6), (11, 12))):
            T(a, [(C + s * 5, 24 + k * 2), (C + s * dx, 24 + dy - 4), (C + s * (dx + 3), 26 + dy + 4)], 2, '#3d2a20')
    E(a, 23.5, 30, 8, 7, '#5b3a2a')
    D(a, [(x, 32) for x in range(19, 29, 2)], '#f2c14e'); D(a, [(x, 34) for x in range(20, 28, 2)], '#c8443a')
    E(a, 23.5, 21, 6, 5, '#5b3a2a')
    eye1(a, 20, 19); eye1(a, 26, 19)
    D(a, [(22, 23), (23, 24), (24, 24), (25, 23)], '#2a1a12')
    R(a, 19, 39, 28, 44, GOLD); R(a, 19, 39, 28, 40, '#c9873a', edge=False)   # the box of stories

def yeti(a):
    P(a, [(0, 44), (12, 41), (30, 43), (47, 41), (47, 47), (0, 47)], '#e8f4ff', edge=False, shade=False)
    R(a, 13, 35, 21, 44, '#e8eef7'); R(a, 26, 35, 34, 44, '#e8eef7')
    E(a, 17, 44, 5, 2, '#8fa8c8'); E(a, 30, 44, 5, 2, '#8fa8c8')
    E(a, 23.5, 28, 14, 11, '#f0f4fa')
    T(a, [(10, 22), (5, 35)], 7, '#f0f4fa'); T(a, [(37, 22), (42, 35)], 7, '#f0f4fa')
    E(a, 23.5, 12, 10, 9, '#f0f4fa')
    E(a, 23.5, 14, 6, 5, '#8fa8c8')                                           # blue-grey face
    eye1(a, 20, 12); eye1(a, 26, 12); D(a, [(x, 17) for x in range(21, 27)], '#3d4a6a')
    for (x, y) in ((14, 26), (30, 30), (20, 33)): D(a, [(x, y), (x + 1, y + 1)], '#c9d6e8')

def bigfoot(a):
    R(a, 14, 34, 20, 42, '#6a4a30'); R(a, 27, 34, 33, 42, '#6a4a30')
    E(a, 16, 44, 6, 2, '#4a3220'); E(a, 31, 44, 6, 2, '#4a3220')              # big feet
    E(a, 23.5, 26, 12, 11, '#7a5434')
    T(a, [(12, 20), (9, 34)], 6, '#7a5434'); T(a, [(35, 20), (39, 30), (37, 36)], 6, '#7a5434')
    E(a, 23.5, 10, 8, 8, '#7a5434')
    E(a, 23.5, 12, 5, 4, '#a07a58')
    R(a, 19, 9, 28, 9, '#4a3220', edge=False); eye1(a, 20, 10); eye1(a, 26, 10)
    for (x, y) in ((16, 22), (28, 28), (20, 32)): D(a, [(x, y), (x + 1, y + 1)], '#5e3f26')

ART2 = dict(raven=raven, thunderbird=thunderbird, siren=siren, pegasus=pegasus, phoenix=phoenix, hydra=hydra, kraken=kraken,
            nessie=nessie, champ=champ, kappa=kappa, umibozu=umibozu, mermaid=mermaid, bunyip=bunyip, sphinx=sphinx,
            centaur=centaur, chimera=chimera, griffin=griffin, jackalope=jackalope, werewolf=werewolf, selkie=selkie,
            curupira=curupira, kitsune=kitsune, anansi=anansi, yeti=yeti, bigfoot=bigfoot)
