import { Painter, type Sprite } from './fb';
import { C, COLOR_SWATCH } from './palette';
import type { Look } from '../director/director';
import type { CastMember } from '../director/cast';
import { drawText, textWidth } from './font';
import { FB } from './fb';

// Procedural pixel rigs (plan 6.2): one quadruped and one biped template
// cover every animal and person noun; a feature kit (ears, tail, stripes,
// hair, hats) tells them apart. Everything else draws as a friendly blob
// with its name until its own rig is made (plan 6.8: never a blank screen).

export interface Pose { frame: number; squash: 0 | 1 | 2; sprout?: boolean } // squash 0 normal, 1 squashed, 2 stretched

const NOUN_COLORS: Record<string, [number, number]> = {
  cat: [C.orange, C.brown], kitten: [C.lightGray, C.gray], dog: [C.tan, C.brown], pet: [C.tan, C.brown], animal: [C.tan, C.brown],
  cow: [C.white, C.lightGray], pig: [C.pink, C.curtainLight], horse: [C.brown, C.sepia3], deer: [C.tan, C.brown],
  zebra: [C.white, C.lightGray], tiger: [C.orange, C.brown], rabbit: [C.lightGray, C.gray], hare: [C.tan, C.brown],
};
const SKIN: [number, number][] = [[C.skin, C.skinMid], [C.skinMid, C.skinDeep], [C.skinDeep, C.sepia3]];
const SHIRTS: [number, number][] = [[C.blue, C.teal], [C.green, C.grassDark], [C.red, C.curtainDark], [C.purple, C.teal], [C.yellow, C.gold], [C.orange, C.brown]];
const setPx = (spr: Sprite, x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < spr.w && y < spr.h) spr.px[y * spr.w + x] = c; };
const nameHash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

function colorsFor(m: CastMember, look: Look, fallback: [number, number]): [number, number] {
  if (look.color && COLOR_SWATCH[look.color]) return COLOR_SWATCH[look.color];
  return NOUN_COLORS[m.noun] ?? fallback;
}

function quadruped(m: CastMember, look: Look, pose: Pose): Sprite {
  const s = look.scale; const sx = (look.wide ? 1.25 : 1) * (pose.squash === 1 ? 1.15 : pose.squash === 2 ? 0.9 : 1); const sy = pose.squash === 1 ? 0.8 : pose.squash === 2 ? 1.15 : 1;
  const p = new Painter(Math.ceil(34 * s * sx), Math.ceil(28 * s * sy));
  const [base, shade] = colorsFor(m, look, [C.tan, C.brown]);
  p.shade.set(base, shade);
  const X = (v: number) => v * s * sx; const Y = (v: number) => v * s * sy;
  const tall = m.noun === 'horse' || m.noun === 'deer' || m.noun === 'zebra';
  // Legs with a 4-frame stride.
  const swing = [0, 1.6, 0, -1.6][pose.frame % 4];
  for (const [lx, ph] of [[-7, 1], [-4, -1], [4, -1], [7, 1]] as const) p.rect(X(lx + swing * ph) - 1, Y(-8), X(lx + swing * ph) + 1, 0, shade);
  p.ellipse(0, Y(-11), X(10), Y(5.5), base);
  const hx = X(tall ? 12 : 10), hy = Y(tall ? -20 : -16);
  if (tall) p.line(X(8), Y(-13), hx - X(1), hy + Y(2), base, Math.max(3, 4 * s));
  p.ellipse(hx, hy, X(5), Y(4.5), base);
  if (m.noun === 'dog' || m.noun === 'pet' || m.noun === 'animal' || m.noun === 'horse' || m.noun === 'cow' || m.noun === 'pig') p.ellipse(hx + X(4), hy + Y(1.5), X(2.8), Y(2.2), m.noun === 'pig' ? C.pink : base);
  // Ears.
  if (m.noun === 'rabbit' || m.noun === 'hare') { p.ellipse(hx - X(1.5), hy - Y(7), X(1.2), Y(4), base); p.ellipse(hx + X(1), hy - Y(7), X(1.2), Y(4), base); }
  else if (m.noun === 'dog' || m.noun === 'pet' || m.noun === 'animal') p.ellipse(hx - X(2.5), hy - Y(0.5), X(1.8), Y(3.4), shade);
  else { p.tri(hx - X(4), hy - Y(2), hx - X(2.5), hy - Y(7.5), hx - X(0.5), hy - Y(3), base); p.tri(hx + X(0.5), hy - Y(3.5), hx + X(2.5), hy - Y(7.5), hx + X(3.5), hy - Y(2), base); }
  if (m.noun === 'cow') { p.dot(hx - X(2), hy - Y(5), C.white); p.dot(hx + X(2), hy - Y(5), C.white); }
  if (m.noun === 'deer') { p.line(hx - X(1), hy - Y(4), hx - X(3), hy - Y(10), C.brown, 1.2); p.line(hx + X(1), hy - Y(4), hx + X(3), hy - Y(10), C.brown, 1.2); }
  // Tail.
  if (m.noun === 'cat' || m.noun === 'kitten' || m.noun === 'tiger') { p.line(X(-9), Y(-12), X(-12), Y(-16), base, Math.max(2, 2.2 * s)); p.line(X(-12), Y(-16), X(-11), Y(-21), base, Math.max(2, 2.2 * s)); }
  else p.line(X(-9), Y(-12), X(-12), Y(-15 - (pose.frame % 2)), base, Math.max(2, 2 * s));
  // Stripes and spots.
  const striped = look.pattern === 'striped' || m.noun === 'zebra' || m.noun === 'tiger';
  const spotted = look.pattern === 'spotted' || m.noun === 'cow';
  if (striped) for (let k = -7; k <= 7; k += 3.5) p.line(X(k), Y(-15.5), X(k - 1), Y(-8), m.noun === 'tiger' || m.noun === 'zebra' ? C.black : shade, 1);
  if (spotted) for (const [a, b] of [[-5, -12], [2, -10], [6, -13]] as const) p.ellipse(X(a), Y(b), X(1.6), Y(1.3), C.black);
  const spr = p.finish();
  // Face on top of the outline pass so it stays crisp.
  const ex = Math.round(hx + X(2)) + spr.ax, ey = Math.round(hy - Y(1)) + spr.ay;
  setPx(spr, ex, ey, C.outline);
  if (look.mood === 'happy' || look.mood === 'silly') setPx(spr, ex + 1, ey + 2, C.outline);
  return spr;
}

function biped(m: CastMember, look: Look, pose: Pose): Sprite {
  const s = look.scale; const sx = (look.wide ? 1.3 : 1) * (pose.squash === 1 ? 1.15 : pose.squash === 2 ? 0.9 : 1); const sy = pose.squash === 1 ? 0.8 : pose.squash === 2 ? 1.15 : 1;
  const p = new Painter(Math.ceil(16 * s * sx), Math.ceil(28 * s * sy));
  const X = (v: number) => v * s * sx; const Y = (v: number) => v * s * sy;
  const h = nameHash(m.noun + m.id);
  const [skin, skinShade] = SKIN[h % SKIN.length];
  let [shirt, shirtShade] = m.noun === 'doctor' ? [C.white, C.lightGray] : m.noun === 'spy' ? [C.darkGray, C.black] : SHIRTS[h % SHIRTS.length];
  if (look.color && COLOR_SWATCH[look.color]) [shirt, shirtShade] = COLOR_SWATCH[look.color];
  p.shade.set(shirt, shirtShade); p.shade.set(skin, skinShade);
  const swing = [0, 1.8, 0, -1.8][pose.frame % 4];
  p.rect(X(-2.6 + swing), Y(-8), X(-0.8 + swing), 0, C.darkGray);
  p.rect(X(0.8 - swing), Y(-8), X(2.6 - swing), 0, C.darkGray);
  p.rect(X(-3.5), Y(-16), X(3.5), Y(-7.5), shirt);
  p.line(X(-3.5), Y(-15), X(-4.5 - swing), Y(-9.5), skin, 1.6);
  p.line(X(3.5), Y(-15), X(4.5 + swing), Y(-9.5), skin, 1.6);
  p.ellipse(0, Y(-20.5), X(4), Y(4), skin);
  const long = ['girl', 'woman', 'mom', 'aunt', 'sister', 'grandmother'].includes(m.noun);
  const hair = m.noun === 'grandmother' || m.adjectives.includes('old') ? C.lightGray : [C.brown, C.black, C.orange, C.sepia3][h % 4];
  if (!m.adjectives.includes('bald')) {
    p.ellipse(0, Y(-23), X(4.2), Y(2.2), hair);
    if (long) { p.rect(X(-4.3), Y(-23), X(-3), Y(-17), hair); p.rect(X(3), Y(-23), X(4.3), Y(-17), hair); }
  }
  if (m.noun === 'spy') { p.rect(X(-5.5), Y(-24.5), X(5.5), Y(-24), C.black); p.rect(X(-3.5), Y(-28), X(3.5), Y(-24.5), C.black); }
  if (m.noun === 'doctor') p.dot(X(1.5), Y(-13), C.teal);
  const spr = p.finish();
  const ex = Math.round(X(1.6)) + spr.ax, ey = Math.round(Y(-21)) + spr.ay;
  setPx(spr, ex, ey, m.noun === 'spy' ? C.black : C.outline);
  if (m.noun === 'spy') setPx(spr, ex - 2, ey, C.black);
  return spr;
}

const BLOB_COLORS = [C.yellow, C.pink, C.green, C.blue, C.purple, C.orange];
function blob(m: CastMember, look: Look, pose: Pose): Sprite {
  const s = look.scale;
  const p = new Painter(Math.ceil(18 * s), Math.ceil(20 * s));
  const [base, shade] = look.color && COLOR_SWATCH[look.color] ? COLOR_SWATCH[look.color] : [BLOB_COLORS[nameHash(m.noun) % BLOB_COLORS.length], C.darkGray];
  p.shade.set(base, shade);
  const lift = pose.sprout ? 4 * s : 0;
  if (pose.sprout) { const sw = pose.frame % 2 ? 1.2 : -1.2; p.rect(-3 * s + sw, -lift, -2 * s + sw, 0, C.darkGray); p.rect(2 * s - sw, -lift, 3 * s - sw, 0, C.darkGray); }
  p.ellipse(0, -7 * s - lift, 8 * s, (pose.squash === 1 ? 5.5 : 7) * s, base);
  const spr = p.finish();
  const ey = Math.round(-9 * s - lift) + spr.ay;
  setPx(spr, Math.round(2 * s) + spr.ax, ey, C.outline); setPx(spr, Math.round(-1 * s) + spr.ax, ey, C.outline);
  return spr;
}

const cache = new Map<string, Sprite>();
export function spriteFor(m: CastMember, look: Look, pose: Pose): Sprite {
  const key = `${m.id}|${m.noun}|${m.rig}|${JSON.stringify(look)}|${pose.frame % 4}|${pose.squash}|${pose.sprout ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    s = m.rig === 'quadruped' ? quadruped(m, look, pose) : m.rig === 'biped' ? biped(m, look, pose) : blob(m, look, pose);
    if (cache.size > 400) cache.clear();
    cache.set(key, s);
  }
  return s;
}

// Scenery props for where phrases (door, window, table); anything else is
// a labeled crate so the ground noun is still clear.
export function drawProp(fb: FB, noun: string, x: number, ground: number) {
  if (noun === 'door') { fb.rect(x - 7, ground - 30, 14, 30, C.outline); fb.rect(x - 6, ground - 29, 12, 29, C.brown); fb.set(x + 3, ground - 15, C.gold); return; }
  if (noun === 'window') { fb.rect(x - 9, ground - 34, 18, 16, C.outline); fb.rect(x - 8, ground - 33, 16, 14, C.skyLight); fb.rect(x - 1, ground - 33, 1, 14, C.outline); fb.rect(x - 8, ground - 27, 16, 1, C.outline); return; }
  if (noun === 'table') { fb.rect(x - 12, ground - 13, 24, 3, C.brown); fb.rect(x - 11, ground - 10, 2, 10, C.sepia3); fb.rect(x + 9, ground - 10, 2, 10, C.sepia3); return; }
  if (noun === 'floor') { fb.rect(x - 20, ground - 1, 40, 2, C.sepia2); return; }
  fb.rect(x - 8, ground - 14, 16, 14, C.outline); fb.rect(x - 7, ground - 13, 14, 12, C.tan);
  const w = textWidth(noun);
  drawText(fb, noun, Math.round(x - w / 2), ground - 24, C.white);
}
