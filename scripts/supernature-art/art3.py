from kit import *
SKIN = '#b9c47e'
def frankie(a):
    R(a, 17, 35, 22, 42, '#2f3138'); R(a, 25, 35, 30, 42, '#2f3138')
    R(a, 15, 41, 22, 45, '#3d2a20'); R(a, 25, 41, 32, 45, '#3d2a20')        # big boots
    P(a, [(14, 22), (33, 22), (35, 37), (12, 37)], '#3b3e48')                 # dark jacket
    P(a, [(20, 22), (27, 22), (26, 36), (21, 36)], '#5a5e66')                 # gray shirt
    T(a, [(14, 24), (11, 34)], 5, '#3b3e48'); T(a, [(33, 24), (36, 34)], 5, '#3b3e48')
    E(a, 10.5, 36, 2, 2, SKIN); E(a, 36.5, 36, 2, 2, SKIN)
    R(a, 20, 19, 27, 23, SKIN)                                                # neck
    R(a, 13, 19, 15, 21, '#8f8aa8'); R(a, 32, 19, 34, 21, '#8f8aa8')          # neck bolts
    R(a, 15, 5, 32, 20, SKIN)                                                 # tall square head
    R(a, 14, 2, 33, 8, '#1e1d24')                                             # flat-top hair
    D(a, [(15, 9), (16, 9), (31, 9), (32, 9), (15, 10), (32, 10)], '#1e1d24')
    D(a, [(x, 9) for x in range(19, 26)], '#6a7a4a'); D(a, [(20, 8), (22, 8), (24, 8), (20, 10), (22, 10), (24, 10)], '#6a7a4a')  # stitches
    R(a, 17, 12, 22, 12, '#2a2a30', False, False); R(a, 25, 12, 30, 12, '#2a2a30', False, False)   # heavy brows
    eye1(a, 19, 13, '#1e1d24'); eye1(a, 27, 13, '#1e1d24')
    D(a, [(x, 18) for x in range(20, 28)], '#4a5a34')
ART3 = dict(frankie=frankie)
