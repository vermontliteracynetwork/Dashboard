from kit import *
C = 23.5
SK = '#f2c7a0'; SK2 = '#c98b5a'; SK3 = '#a8693f'
GOLD = '#f2c14e'; WHITE = '#f4efe2'

def artemis(a):
    T(a, [(9, 8), (6, 22), (9, 36)], 2, '#8a5a2e', edge=False)              # bow
    D(a, [(9, y) for y in range(9, 36)], '#e9e2d0')                          # string
    P(a, [(13, 6), (34, 6), (36, 26), (11, 26)], '#b5552b')                 # long hair behind
    chibi(a, SK, '#f4efe2', '#f4efe2', '#8a5a2e', sleeve='#f4efe2')
    R(a, 15, 27, 32, 29, '#4f9a5b', edge=False)                              # green sash
    P(a, [(13, 12), (16, 5), (31, 5), (34, 12), (30, 9), (17, 9)], '#b5552b')  # fringe
    E(a, 23.5, 3, 4, 2, '#dfe8f5')                                           # moon tiara
    E(a, 25.5, 2, 3, 2, '#b5552b', edge=False)
    eyes(a); D(a, [(23, 19), (24, 19)], '#a8584a')

def ra(a):
    E(a, 23.5, 5, 7, 5, '#f2783a')                                           # sun disk
    chibi(a, SK3, WHITE, SK3, '#d9a636', head=False)
    R(a, 15, 22, 32, 25, GOLD, edge=False); D(a, [(x, 25) for x in range(15, 33, 2)], '#3a6fd1')
    E(a, 23.5, 15, 9, 8, '#8a5a2e')                                          # falcon head
    E(a, 23.5, 17, 6, 5, '#efe2c4')                                          # pale face
    P(a, [(20, 15), (27, 15), (27, 19), (23.5, 23), (22, 19)], '#f2c14e')    # hooked beak
    D(a, [(23, 22), (24, 22)], '#8a5a2e')
    eye1(a, 18, 13); eye1(a, 28, 13)
    D(a, [(17, 15), (17, 16), (18, 17), (30, 15), (30, 16), (29, 17)], '#241f45')   # falcon eye marks

def anubis(a):
    chibi(a, '#5b3a2a', WHITE, '#5b3a2a', '#d9a636', head=False)
    R(a, 15, 22, 32, 25, GOLD, edge=False); D(a, [(x, 24) for x in range(16, 32, 3)], '#3a6fd1')
    P(a, [(16, 11), (14, -1), (21, 7)], '#2d2a3a'); P(a, [(31, 11), (33, -1), (26, 7)], '#2d2a3a')
    D(a, [(16, 4), (16, 5), (17, 6), (31, 4), (31, 5), (30, 6)], '#d9a636')
    E(a, 23.5, 11, 8, 6, '#2d2a3a')
    E(a, 23.5, 18, 4, 5, '#2d2a3a')                                          # long snout
    R(a, 22, 21, 25, 22, '#120f1c', False, False)
    eye1(a, 19, 10, '#f2c14e'); eye1(a, 27, 10, '#f2c14e')

def isis(a):
    for s in (-1, 1):                                                        # winged arms
        P(a, [(C + s * 8, 25), (C + s * 23, 18), (C + s * 23, 26), (C + s * 9, 32)], '#3a6fd1')
        P(a, [(C + s * 9, 28), (C + s * 23, 26), (C + s * 21, 31), (C + s * 9, 32)], '#4f9a5b')
        P(a, [(C + s * 10, 31), (C + s * 21, 31), (C + s * 18, 35), (C + s * 10, 34)], '#c8443a')
    P(a, [(14, 8), (33, 8), (34, 26), (13, 26)], '#1e1a2e')                  # straight black hair
    chibi(a, '#b5764a', '#c8443a', '#c8443a', '#d9a636')
    R(a, 15, 22, 32, 24, GOLD, edge=False)
    P(a, [(14, 13), (17, 5), (30, 5), (33, 13), (30, 10), (17, 10)], '#1e1a2e')
    R(a, 19, 0, 28, 4, GOLD); R(a, 19, 0, 22, 2, '#f2c14e', edge=False)      # throne shape
    eyes(a); D(a, [(18, 14), (17, 14), (30, 14), (31, 14)], '#1e1a2e'); D(a, [(23, 19), (24, 19)], '#7a3a2a')

def bastet(a):
    chibi(a, '#2d2a3a', WHITE, WHITE, '#d9a636', head=False, hand='#2d2a3a')
    R(a, 15, 22, 32, 25, '#3a6fd1', edge=False); D(a, [(x, 25) for x in range(16, 32, 2)], GOLD)
    P(a, [(14, 11), (15, 1), (21, 7)], '#2d2a3a'); P(a, [(33, 11), (32, 1), (26, 7)], '#2d2a3a')
    D(a, [(16, 5), (16, 6), (31, 5), (31, 6)], '#c27a9a')
    E(a, 23.5, 14, 10, 8, '#2d2a3a')
    eye1(a, 18, 13, '#7fe07a'); eye1(a, 28, 13, '#7fe07a')
    D(a, [(23, 17), (24, 17)], '#c27a9a'); D(a, [(22, 18), (25, 18)], '#8f8aa8')
    D(a, [(14, 17), (13, 17), (33, 17), (34, 17)], '#8f8aa8')                 # whiskers
    E(a, 13, 16, 1, 2, GOLD)                                                 # earring

def jupiter(a):
    P(a, [(39, 14), (35, 22), (38, 22), (34, 31), (41, 20), (38, 20), (42, 14)], '#f2d24e')  # thunderbolt
    chibi(a, SK, WHITE, WHITE, '#8a5a2e')
    P(a, [(16, 22), (24, 22), (32, 37), (22, 37)], '#8c2f4b')                 # toga
    P(a, [(14, 14), (33, 14), (31, 26), (23.5, 29), (16, 26)], '#e8e4ee')     # beard
    E(a, 23.5, 12, 8, 6, SK, edge=False)
    P(a, [(13, 10), (17, 4), (30, 4), (34, 10), (30, 8), (17, 8)], '#e8e4ee')  # hair
    for x in range(14, 34, 3): D(a, [(x, 6), (x + 1, 5)], '#4f9a5b')          # laurel
    eyes(a, cy=11, h=2); D(a, [(22, 17), (25, 17)], '#b8b4c8')

def mars(a):
    P(a, [(14, 22), (33, 22), (36, 40), (11, 40)], '#c8443a')                 # cape
    chibi(a, SK, '#c9873a', SK, '#8a5a2e', sleeve='#c8443a')
    R(a, 16, 30, 31, 36, '#8a5a2e')                                          # skirt straps
    for x in range(17, 31, 3): D(a, [(x, y) for y in range(31, 36)], '#5b3a2a')
    E(a, 9, 31, 6, 6, '#d9a636'); E(a, 9, 31, 2, 2, '#c8443a')               # round shield
    P(a, [(13, 14), (14, 5), (23.5, 2), (33, 5), (34, 14), (29, 14), (29, 10), (18, 10), (18, 14)], '#d9a636')  # helmet
    P(a, [(17, 1), (23.5, -3), (30, 1), (30, 4), (17, 4)], '#c8443a')         # crest
    eyes(a, cy=13); D(a, [(23, 19), (24, 19)], '#a8584a')

def janus(a):
    chibi(a, SK, '#3a6fd1', '#3a6fd1', '#8a5a2e', head=False)
    for s in (-1, 1):
        hx_ = 23.5 + s * 8
        E(a, hx_, 13, 7, 7, SK)
        P(a, [(hx_ - s * 6, 6), (hx_ + s * 1, 5), (hx_ + s * 3, 8), (hx_ - s * 3, 9), (hx_ - s * 7, 14)], '#9a8f84')   # hair at the back
        P(a, [(hx_ + s * 1, 17), (hx_ + s * 7, 15), (hx_ + s * 5, 23), (hx_ - s * 1, 22)], '#9a8f84')                    # beard in front
        D(a, [(int(hx_ + s * 7.5), 12), (int(hx_ + s * 8.5), 13), (int(hx_ + s * 7.5), 14)], SK)                          # nose points out
        eye1(a, int(hx_ + s * 3) - (1 if s < 0 else 0), 11)
    T(a, [(35, 30), (40, 38)], 2, GOLD, edge=False); E(a, 34.5, 29.5, 2, 2, GOLD)
    D(a, [(40, 37), (41, 37), (41, 36)], GOLD)

def cerberus(a):
    for x in (12, 30): R(a, x, 34, x + 4, 45, '#3d3346')
    E(a, 21, 32, 14, 8, '#4a3f58')                                           # body
    T(a, [(7, 30), (3, 22), (5, 18)], 3, '#4a3f58')                          # tail
    for x in (8, 26): R(a, x, 36, x + 4, 45, '#4a3f58')
    for (hx_, hy_) in ((11, 19), (36, 19), (23.5, 12)):
        E(a, hx_, hy_, 6, 6, '#4a3f58')
        E(a, hx_ - 6, hy_ - 1, 2, 4, '#2f2838'); E(a, hx_ + 6, hy_ - 1, 2, 4, '#2f2838')
        E(a, hx_, hy_ + 3, 3, 2, '#b4a6c6')
        R(a, int(hx_) - 1, int(hy_ + 2), int(hx_) + 1, int(hy_ + 3), '#120f1c', False, False)
        eye1(a, int(hx_ - 3), int(hy_ - 1), '#f2c14e'); eye1(a, int(hx_ + 2), int(hy_ - 1), '#f2c14e')
        R(a, int(hx_ - 4), int(hy_ + 7), int(hx_ + 4), int(hy_ + 8), '#c8443a', edge=False)

def cyclops(a):
    R(a, 15, 34, 21, 45, '#9fb07e'); R(a, 26, 34, 32, 45, '#9fb07e')
    E(a, 23.5, 30, 13, 9, '#9fb07e')                                          # big belly body
    R(a, 12, 33, 35, 38, '#7a5a3a'); D(a, [(x, 35) for x in range(13, 35, 4)], '#5b3a2a')
    T(a, [(11, 25), (6, 36)], 6, '#9fb07e'); T(a, [(36, 25), (41, 36)], 6, '#9fb07e')
    E(a, 41, 38, 4, 3, '#8f8aa8')                                            # a rock
    E(a, 23.5, 13, 11, 10, '#9fb07e')
    E(a, 23.5, 11, 5, 4, '#ffffff'); E(a, 23.5, 11, 3, 3, '#3a6fd1', edge=False); R(a, 23, 10, 24, 12, '#120f1c', False, False)
    D(a, [(22, 9)], '#ffffff')
    R(a, 17, 5, 30, 5, '#5b3a2a', edge=False)                                # one big brow
    D(a, [(x, 19) for x in range(20, 28)], '#5b3a2a'); D(a, [(20, 18), (27, 18)], '#5b3a2a')
    E(a, 23.5, 3, 3, 1, '#5b3a2a', edge=False)

def ogre(a):
    R(a, 14, 35, 21, 45, '#5b3a2a'); R(a, 26, 35, 33, 45, '#5b3a2a')
    E(a, 23.5, 30, 14, 10, '#7aa04a')
    P(a, [(11, 24), (19, 22), (19, 38), (12, 38)], '#8a5a2e'); P(a, [(36, 24), (28, 22), (28, 38), (35, 38)], '#8a5a2e')  # vest
    R(a, 10, 36, 37, 38, '#c9873a')                                          # rope belt
    E(a, 7, 33, 3, 4, '#7aa04a'); E(a, 40, 33, 3, 4, '#7aa04a')
    E(a, 9, 12, 3, 4, '#7aa04a'); E(a, 38, 12, 3, 4, '#7aa04a')               # ears
    E(a, 23.5, 13, 12, 10, '#7aa04a')
    E(a, 23.5, 15, 3, 2, '#6a8f3e')                                           # nose
    eye1(a, 18, 10); eye1(a, 28, 10); D(a, [(17, 8), (18, 8), (19, 8), (28, 8), (29, 8), (30, 8)], '#3d5a24')
    D(a, [(x, 19) for x in range(18, 30)], '#3d5a24')
    D(a, [(19, 18), (19, 17), (28, 18), (28, 17)], '#ffffff')                 # little tusks

def minotaur(a):
    chibi(a, '#7a4a2e', '#5b3a2a', '#7a4a2e', '#3d2a20', sleeve='#7a4a2e', head=False)
    T(a, [(16, 23), (31, 36)], 3, '#c9873a'); R(a, 15, 32, 32, 37, '#8a5a2e')
    T(a, [(14, 11), (8, 9), (6, 3)], 3, '#efe6d0'); T(a, [(33, 11), (39, 9), (41, 3)], 3, '#efe6d0')  # horns
    E(a, 10, 14, 3, 2, '#7a4a2e'); E(a, 37, 14, 3, 2, '#7a4a2e')
    E(a, 23.5, 13, 10, 9, '#7a4a2e')
    E(a, 23.5, 18, 6, 4, '#d2a679')                                           # muzzle
    D(a, [(21, 18), (26, 18)], '#3d2a20')
    T(a, [(21, 21), (23.5, 23), (26, 21)], 1, GOLD, edge=False)               # nose ring
    eye1(a, 18, 11); eye1(a, 28, 11)
    E(a, 23.5, 5, 4, 2, '#5b3a2a', edge=False)

def wisp(a):
    for x, h in ((6, 12), (10, 8), (38, 10), (42, 14)): T(a, [(x, 46), (x + 1, 46 - h)], 2, '#4f7a4a', edge=False)
    E(a, 23.5, 22, 15, 15, '#2c4a6a', edge=False, shade=False)
    E(a, 23.5, 22, 11, 11, '#3f7fa6', edge=False, shade=False)
    E(a, 23.5, 22, 7, 8, '#7fe3ff', edge=False, shade=False)
    P(a, [(17, 23), (23.5, 9), (30, 23), (23.5, 30)], '#bff6ff', edge=False, shade=False)
    E(a, 23.5, 23, 3, 4, '#ffffff', edge=False, shade=False)
    for (x, y) in ((9, 10), (38, 8), (36, 34), (11, 33)): D(a, [(x, y), (x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)], '#bff6ff')

def unicorn(a):
    for x in (12, 28): R(a, x, 33, x + 3, 44, '#d9d2e8')
    T(a, [(9, 27), (4, 32), (5, 40)], 4, '#c78be0')                          # tail
    E(a, 20, 28, 12, 7, '#f6f1ff')
    for x in (9, 25): R(a, x, 33, x + 3, 44, '#f6f1ff')
    for x in (9, 12, 25, 28): R(a, x, 43, x + 3, 45, '#c9b48a', edge=False)
    P(a, [(27, 26), (31, 14), (37, 16), (34, 28)], '#f6f1ff')                 # neck
    E(a, 37, 15, 6, 5, '#f6f1ff'); E(a, 41, 18, 4, 3, '#f6f1ff')              # head + muzzle
    P(a, [(29, 13), (33, 9), (31, 20), (28, 26), (26, 22)], '#c78be0')        # mane
    P(a, [(31, 18), (34, 13), (30, 24)], '#8fd3f0')
    P(a, [(38, 11), (44, 0), (40, 11)], GOLD)                                # horn
    D(a, [(41, 6), (42, 4), (40, 8)], '#fff3c4')
    P(a, [(34, 11), (35, 7), (37, 10)], '#f6f1ff')
    eye1(a, 38, 14); D(a, [(43, 19)], '#8f8aa8')

def longdragon(a):
    import math
    pts = [(4 + i * 1.6, 30 + 8 * math.sin(i / 3.2)) for i in range(18)]
    T(a, pts, 8, '#2f9e6f')
    T(a, [(x, y + 3) for (x, y) in pts], 2, GOLD, edge=False)                # gold belly line
    for (x, y) in pts[2:16:3]: D(a, [(int(x), int(y - 4)), (int(x) + 1, int(y - 5))], '#f2783a')  # mane spines
    for (x, y) in (pts[4], pts[11]):
        T(a, [(x, y + 3), (x - 2, y + 9)], 3, '#2f9e6f'); D(a, [(int(x - 3), int(y + 10)), (int(x - 1), int(y + 10))], GOLD)
    E(a, 37, 17, 7, 6, '#2f9e6f')                                            # head
    E(a, 42, 20, 4, 3, '#45b585')
    T(a, [(33, 12), (30, 5)], 2, '#c9873a', edge=False); T(a, [(31, 8), (28, 7)], 1, '#c9873a', edge=False)  # antlers
    T(a, [(37, 11), (37, 4)], 2, '#c9873a', edge=False)
    P(a, [(30, 14), (26, 10), (27, 20), (31, 22)], '#f2783a')                 # mane
    T(a, [(45, 21), (47, 28)], 1, '#f2c14e', edge=False); T(a, [(44, 22), (42, 30)], 1, '#f2c14e', edge=False)  # whiskers
    eye1(a, 38, 15, '#c8443a')
    E(a, 30, 41, 3, 3, '#e8f4ff'); D(a, [(29, 40)], '#ffffff')                # pearl

def fairy(a):
    for s in (-1, 1):
        E(a, C + s * 11, 22, 8, 10, '#bfe8ff', edge=True, shade=False)
        E(a, C + s * 10, 34, 5, 6, '#d9c4ff', edge=True, shade=False)
    P(a, [(17, 28), (30, 28), (34, 42), (13, 42)], '#f5a3c7')                 # petal dress
    R(a, 20, 42, 21, 45, SK, edge=False); R(a, 26, 42, 27, 45, SK, edge=False)
    P(a, [(19, 21), (28, 21), (30, 29), (17, 29)], '#f5a3c7')
    T(a, [(19, 23), (15, 30)], 3, SK); T(a, [(28, 23), (33, 18)], 3, SK)
    T(a, [(33, 18), (37, 10)], 1, '#e8e4ee', edge=False)
    D(a, [(37, 9), (36, 10), (38, 10), (37, 8), (37, 11)], '#fff3c4')
    E(a, 23.5, 13, 8, 7, SK)
    P(a, [(15, 12), (18, 4), (29, 4), (32, 12), (28, 9), (19, 9)], '#f2d24e')
    eyes(a, cy=12, dx=3, h=2); D(a, [(23, 17), (24, 17)], '#d9707a')
    for (x, y) in ((8, 8), (40, 30), (6, 40)): D(a, [(x, y)], '#fff3c4')

def pixie(a):
    chibi(a, SK, '#4f9a5b', '#3d7a48', '#5b3a2a', hy=17, hry=8)
    T(a, [(12, 15), (9, 11)], 2, SK); T(a, [(35, 15), (38, 11)], 2, SK)       # pointy ears
    P(a, [(13, 14), (34, 14), (29, 2), (36, -2), (23, 1), (16, 8)], '#c8443a')  # pointed red cap
    E(a, 36, 0, 2, 2, '#f2c14e')
    eyes(a, cy=16, h=2)
    D(a, [(20, 21), (21, 22), (22, 22), (23, 22), (24, 22), (25, 22), (26, 21)], '#7a3a2a')  # grin

def golem(a):
    R(a, 13, 34, 21, 45, '#9a6a3e'); R(a, 26, 34, 34, 45, '#9a6a3e')
    R(a, 9, 18, 38, 36, '#b0794a')
    R(a, 3, 19, 10, 34, '#9a6a3e'); R(a, 37, 19, 44, 34, '#9a6a3e')
    R(a, 15, 3, 32, 18, '#b0794a')
    for pts in ([(18, 22), (21, 26), (19, 30)], [(30, 24), (28, 28)], [(17, 6), (19, 8)], [(6, 25), (8, 28)]):
        T(a, pts, 1, '#7a4f2e', edge=False)
    R(a, 18, 9, 20, 11, '#ffd970', False, False); R(a, 27, 9, 29, 11, '#ffd970', False, False)  # glowing eyes
    D(a, [(x, 15) for x in range(20, 28)], '#7a4f2e')

def troll(a):
    T(a, [(34, 34), (41, 38), (43, 32)], 2, '#7d8f52'); E(a, 43, 31, 2, 2, '#5b4a3a')  # tail with tuft
    chibi(a, '#8a9a5b', '#7a5a3a', '#6a4a30', '#5b4a3a', hrx=11, hry=10)
    P(a, [(12, 12), (14, 2), (20, 6), (23.5, 0), (28, 6), (33, 2), (35, 12)], '#5b4a3a')  # shaggy hair
    E(a, 23.5, 16, 4, 5, '#7d8f52')                                           # big nose
    eye1(a, 17, 11); eye1(a, 29, 11)
    D(a, [(x, 21) for x in range(19, 29)], '#3d4a24')
    for x in range(15, 33, 4): D(a, [(x, 36), (x + 1, 37)], '#4a3a24')

ART1 = dict(artemis=artemis, ra=ra, anubis=anubis, isis=isis, bastet=bastet, jupiter=jupiter, mars=mars, janus=janus,
            cerberus=cerberus, cyclops=cyclops, ogre=ogre, minotaur=minotaur, wisp=wisp, unicorn=unicorn,
            longdragon=longdragon, fairy=fairy, pixie=pixie, golem=golem, troll=troll)
