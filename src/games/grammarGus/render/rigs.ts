import { Painter, type Sprite } from './fb';
import { C, COLOR_SWATCH } from './palette';
import type { Look } from '../director/director';
import type { CastMember } from '../director/cast';
import { drawText, textWidth } from './font';
import { FB } from './fb';

// Procedural pixel rigs (plan 6.2): quadruped and biped templates cover
// the four-legged animals and people; a feature kit (ears, tail, stripes,
// hair, hats) tells them apart. Birds, critters, the snake, vehicles,
// things, rain and scenery each have their own small rig (milestone 7).
// Anything unknown draws as a friendly blob (plan 6.8: never a blank screen).

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
function blob(m: CastMember, look: Look): Sprite {
  const s = look.scale;
  const p = new Painter(Math.ceil(18 * s), Math.ceil(20 * s));
  const [base, shade] = look.color && COLOR_SWATCH[look.color] ? COLOR_SWATCH[look.color] : [BLOB_COLORS[nameHash(m.noun) % BLOB_COLORS.length], C.darkGray];
  p.shade.set(base, shade);
  p.ellipse(0, -7 * s, 8 * s, 7 * s, base);
  const spr = p.finish();
  const ey = Math.round(-9 * s) + spr.ay;
  setPx(spr, Math.round(2 * s) + spr.ax, ey, C.outline); setPx(spr, Math.round(-1 * s) + spr.ax, ey, C.outline);
  return spr;
}

// Shared helpers for the content pass rigs (plan 6.2, milestone 7).
const squashXY = (look: Look, pose: Pose, wideK = 1.25) => ({
  s: look.scale,
  sx: (look.wide ? wideK : 1) * (pose.squash === 1 ? 1.15 : pose.squash === 2 ? 0.9 : 1),
  sy: pose.squash === 1 ? 0.8 : pose.squash === 2 ? 1.15 : 1,
});
const eye = (spr: Sprite, x: number, y: number, c: number = C.outline) => setPx(spr, Math.round(x) + spr.ax, Math.round(y) + spr.ay, c);

// Birds and bats: body, head, beak, a wing that flaps on every frame.
const BIRD_COLORS: Record<string, [number, number]> = {
  bird: [C.blue, C.teal], bat: [C.darkGray, C.black], chicken: [C.white, C.lightGray], goose: [C.white, C.lightGray], owl: [C.brown, C.sepia3],
};
function bird(m: CastMember, look: Look, pose: Pose): Sprite {
  const { s, sx, sy } = squashXY(look, pose);
  const p = new Painter(Math.ceil(26 * s * sx), Math.ceil(28 * s * sy));
  const X = (v: number) => v * s * sx; const Y = (v: number) => v * s * sy;
  const [base, shade] = colorsFor(m, look, BIRD_COLORS[m.noun] ?? [C.blue, C.teal]);
  p.shade.set(base, shade);
  const up = pose.frame % 2 === 1;
  const bat = m.noun === 'bat';
  if (!bat) { p.line(X(-2), Y(-4), X(-2 + (pose.frame % 4 === 1 ? 1 : 0)), 0, C.orange); p.line(X(1), Y(-4), X(1 - (pose.frame % 4 === 3 ? 1 : 0)), 0, C.orange); }
  if (bat) {
    // Membrane wings, up or down.
    const wy = up ? -17 : -6;
    p.tri(X(-1), Y(-9), X(-12), Y(wy), X(-6), Y(-6), shade);
    p.tri(X(1), Y(-9), X(12), Y(wy), X(6), Y(-6), shade);
  }
  p.tri(X(-5), Y(-9), X(-10), Y(-13), X(-9), Y(-7), m.noun === 'chicken' ? C.lightGray : shade);
  p.ellipse(0, Y(-8), X(6), Y(4.5), base);
  const goose = m.noun === 'goose', owl = m.noun === 'owl';
  const hx = owl ? X(1) : goose ? X(6) : X(4), hy = owl ? Y(-13) : goose ? Y(-20) : Y(-13);
  if (goose) p.line(X(3), Y(-10), hx - X(0.5), hy + Y(2), base, Math.max(2.5, 3 * s));
  p.ellipse(hx, hy, owl ? X(4.5) : X(3), owl ? Y(4) : Y(3), base);
  if (bat) { p.tri(hx - X(2.5), hy - Y(2), hx - X(2), hy - Y(6), hx - X(0.5), hy - Y(2.5), base); p.tri(hx + X(0.5), hy - Y(2.5), hx + X(2), hy - Y(6), hx + X(2.5), hy - Y(2), base); }
  if (owl) { p.tri(hx - X(4), hy - Y(2), hx - X(3.5), hy - Y(6), hx - X(1.5), hy - Y(3), base); p.tri(hx + X(1.5), hy - Y(3), hx + X(3.5), hy - Y(6), hx + X(4), hy - Y(2), base); p.ellipse(hx - X(1.6), hy, X(1.5), Y(1.5), C.white); p.ellipse(hx + X(1.6), hy, X(1.5), Y(1.5), C.white); }
  if (!bat) p.tri(hx + X(owl ? -0.6 : 2.5), hy - Y(owl ? -1 : 1), hx + X(owl ? 0.6 : 5.5), hy + Y(owl ? 2.5 : 0), hx + X(owl ? 0 : 2.5), hy + Y(1), m.noun === 'chicken' ? C.yellow : C.orange);
  if (m.noun === 'chicken') { p.dot(hx - X(1), hy - Y(3.5), C.red); p.dot(hx, hy - Y(4), C.red); p.dot(hx + X(1), hy - Y(3.5), C.red); p.dot(hx + X(2.5), hy + Y(2), C.red); }
  if (!bat) {
    if (up) p.tri(X(-3), Y(-9), X(-7), Y(-18), X(2), Y(-11), shade);
    else p.ellipse(X(-1), Y(-7.5), X(4), Y(2.4), shade);
  }
  const spr = p.finish();
  if (owl) { eye(spr, hx - X(1.6), hy); eye(spr, hx + X(1.6), hy); }
  else eye(spr, hx + X(1), hy - Y(1), bat ? C.red : C.outline);
  return spr;
}

// Small crawly and swimmy animals (plan 6.2: critters).
function critter(m: CastMember, look: Look, pose: Pose): Sprite {
  const { s, sx, sy } = squashXY(look, pose);
  const p = new Painter(Math.ceil(26 * s * sx), Math.ceil(18 * s * sy));
  const X = (v: number) => v * s * sx; const Y = (v: number) => v * s * sy;
  const step = pose.frame % 2;
  const n = m.noun;
  let eyeAt: [number, number] = [X(5), Y(-5)];
  if (n === 'snail') {
    const [b, sh] = colorsFor(m, look, [C.orange, C.brown]);
    p.shade.set(b, sh);
    p.rect(X(-5), Y(-2), X(7 + step * 0.5), 0, C.tan);
    p.line(X(5), Y(-2), X(6), Y(-7), C.tan); p.line(X(7), Y(-2), X(8), Y(-7), C.tan);
    p.ellipse(X(-0.5), Y(-6), X(4.5), Y(4.5), b);
    p.ring(X(-0.5), Y(-6), 2.2 * s, sh);
    eyeAt = [X(6), Y(-7)];
  } else if (n === 'clam') {
    const [b, sh] = colorsFor(m, look, [C.tan, C.brown]);
    p.shade.set(b, sh);
    p.ellipse(0, Y(-2.5), X(6), Y(2.5), b);
    p.ellipse(0, Y(-4.5 - step * 1.5), X(6), Y(2.5), sh);
    if (step) p.rect(X(-3), Y(-3.5), X(3), Y(-3), C.pink);
    eyeAt = [X(2), Y(-6 - step * 1.5)];
  } else if (n === 'frog') {
    const [b, sh] = colorsFor(m, look, [C.green, C.grassDark]);
    p.shade.set(b, sh);
    p.ellipse(X(-4), Y(-2), X(3), Y(2), sh);
    p.ellipse(0, Y(-4.5), X(6), Y(4), b);
    p.ellipse(X(2), Y(-8.5), X(1.8), Y(1.8), b); p.ellipse(X(-1.5), Y(-8.5), X(1.8), Y(1.8), b);
    p.rect(X(2), Y(-3), X(5), Y(-2.5), C.red);
    eyeAt = [X(2.3), Y(-9)];
  } else if (n === 'fish' || n === 'dolphin') {
    const big = n === 'dolphin';
    const [b, sh] = colorsFor(m, look, big ? [C.gray, C.teal] : [C.orange, C.brown]);
    p.shade.set(b, sh);
    const L = big ? 9 : 6;
    p.tri(X(-L + 1), Y(-5), X(-L - 4), Y(-9 + step * 2), X(-L - 4), Y(-1 - step * 2), sh);
    p.tri(X(-2), Y(-7), X(1), Y(-11), X(3), Y(-7), sh);
    p.ellipse(0, Y(-5), X(L), Y(big ? 3.5 : 3), b);
    if (big) p.ellipse(X(L), Y(-4.5), X(2), Y(1), b);
    eyeAt = [X(L - 3), Y(-6)];
  } else if (n === 'bug') {
    const [b, sh] = colorsFor(m, look, [C.red, C.curtainDark]);
    p.shade.set(b, sh);
    for (const lx of [-2, 0.5, 3]) p.line(X(lx), Y(-2), X(lx + (step ? 1 : -1)), 0, C.outline);
    p.ellipse(X(4.5), Y(-3), X(2), Y(2), C.black);
    p.ellipse(0, Y(-3.5), X(4.5), Y(3.2), b);
    p.line(0, Y(-6.5), 0, Y(-0.5), C.outline);
    for (const [a, c] of [[-2.5, -4], [2, -3], [-1.5, -2]] as const) p.dot(X(a), Y(c), C.outline);
    eyeAt = [X(5.5), Y(-3.5)];
  } else if (n === 'turtle') {
    const [b, sh] = colorsFor(m, look, [C.green, C.grassDark]);
    p.shade.set(b, sh);
    for (const lx of [-4, 3]) p.ellipse(X(lx + (step ? 0.8 : -0.8)), Y(-1), X(1.4), Y(1.4), C.grass);
    p.ellipse(X(6.5), Y(-4), X(2.3), Y(2), C.grass);
    p.ellipse(0, Y(-5), X(6), Y(4), b);
    for (const [a, c] of [[-2.5, -5.5], [2, -6], [0, -3.5]] as const) p.ellipse(X(a), Y(c), X(1.2), Y(1), sh);
    eyeAt = [X(7.2), Y(-4.6)];
  } else {
    // Rat, mice and anything small with a tail.
    const [b, sh] = colorsFor(m, look, [C.gray, C.darkGray]);
    p.shade.set(b, sh);
    p.line(X(-5), Y(-3), X(-10), Y(-4 - step), C.pink);
    p.dot(X(-3 + step), 0, C.pink); p.dot(X(3 - step), 0, C.pink);
    p.ellipse(0, Y(-3.5), X(5.5), Y(3.2), b);
    p.ellipse(X(5), Y(-4.5), X(2.8), Y(2.4), b);
    p.ellipse(X(4), Y(-7.5), X(1.6), Y(1.6), C.pink);
    p.dot(X(8), Y(-4.5), C.pink);
    eyeAt = [X(5.8), Y(-5.2)];
  }
  const spr = p.finish();
  eye(spr, eyeAt[0], eyeAt[1]);
  if (n === 'frog') eye(spr, X(-1.2), Y(-9));
  return spr;
}

// The snake: a wavy chain of segments that slithers with the frame.
function serpent(m: CastMember, look: Look, pose: Pose): Sprite {
  const { s, sx, sy } = squashXY(look, pose);
  const p = new Painter(Math.ceil(32 * s * sx), Math.ceil(12 * s * sy));
  const X = (v: number) => v * s * sx; const Y = (v: number) => v * s * sy;
  const [b, sh] = colorsFor(m, look, [C.green, C.grassDark]);
  p.shade.set(b, sh);
  for (let i = 0; i < 12; i++) {
    const x = -13 + i * 2.1, y = -3 - Math.sin(i * 0.8 + pose.frame * 1.5) * 1.8;
    p.ellipse(X(x), Y(y), X(1.4 + i * 0.07), Y(1.6 + i * 0.07), b);
    if (look.pattern === 'striped' && i % 3 === 0) p.line(X(x), Y(y - 1.5), X(x), Y(y + 1.5), sh);
  }
  const hy = -3 - Math.sin(12 * 0.8 + pose.frame * 1.5) * 1.8;
  p.ellipse(X(12), Y(hy - 1), X(3), Y(2.4), b);
  if (pose.frame % 2) p.line(X(15), Y(hy - 0.5), X(17), Y(hy - 0.5), C.red);
  const spr = p.finish();
  eye(spr, X(13), Y(hy - 2));
  return spr;
}

// Vehicles: a body plus wheels whose spokes turn with the frame.
function vehicle(m: CastMember, look: Look, pose: Pose): Sprite {
  const { s, sx, sy } = squashXY(look, pose, 1.15);
  const n = m.noun;
  const wide = n === 'bus' ? 38 : n === 'plane' ? 34 : n === 'wheel' ? 16 : 28;
  const p = new Painter(Math.ceil(wide * s * sx), Math.ceil(22 * s * sy));
  const X = (v: number) => v * s * sx; const Y = (v: number) => v * s * sy;
  const defaults: Record<string, [number, number]> = { car: [C.red, C.curtainDark], van: [C.white, C.lightGray], bus: [C.yellow, C.gold], tank: [C.gray, C.darkGray], bike: [C.blue, C.teal], plane: [C.white, C.lightGray], wheel: [C.darkGray, C.black] };
  const [b, sh] = colorsFor(m, look, defaults[n] ?? [C.red, C.curtainDark]);
  p.shade.set(b, sh);
  const wheel = (cx: number, r: number) => {
    p.ellipse(X(cx), Y(-r), X(r), Y(r), C.black);
    p.ellipse(X(cx), Y(-r), X(r * 0.45), Y(r * 0.45), C.lightGray);
    const a = (pose.frame % 4) * (Math.PI / 4);
    p.dot(X(cx) + Math.cos(a) * r * 0.75 * s, Y(-r) + Math.sin(a) * r * 0.75 * s, C.gray);
  };
  if (n === 'bike') {
    p.ring(X(-6), Y(-4), 3.8 * s, C.black); p.ring(X(6), Y(-4), 3.8 * s, C.black);
    const a = (pose.frame % 4) * (Math.PI / 4);
    for (const cx of [-6, 6]) p.line(X(cx), Y(-4), X(cx) + Math.cos(a) * 3 * s, Y(-4) + Math.sin(a) * 3 * s, C.gray);
    p.line(X(-6), Y(-4), X(-1), Y(-10), b, 1.5); p.line(X(-1), Y(-10), X(5), Y(-10), b, 1.5); p.line(X(5), Y(-10), X(6), Y(-4), b, 1.5); p.line(X(-1), Y(-10), X(1), Y(-4), b, 1.5);
    p.rect(X(-3), Y(-12), X(0), Y(-11), C.black); p.line(X(5), Y(-10), X(4), Y(-14), C.gray); p.rect(X(3), Y(-14), X(6), Y(-14), C.black);
  } else if (n === 'wheel') {
    p.ring(0, Y(-7), 6.5 * s, C.black, 2);
    const a = (pose.frame % 4) * (Math.PI / 4);
    for (let k = 0; k < 4; k++) { const ang = a + (k * Math.PI) / 2; p.line(0, Y(-7), Math.cos(ang) * 5 * s, Y(-7) + Math.sin(ang) * 5 * s, C.gray); }
    p.ellipse(0, Y(-7), X(1.2), Y(1.2), C.lightGray);
  } else if (n === 'plane') {
    p.ellipse(X(-8), Y(-1.5), X(1.5), Y(1.5), C.black); p.ellipse(X(6), Y(-1.5), X(1.5), Y(1.5), C.black);
    p.tri(X(-14), Y(-9), X(-16), Y(-17), X(-10), Y(-9), sh);
    p.ellipse(0, Y(-7), X(15), Y(4), b);
    p.tri(X(-4), Y(-7), X(4), Y(-7), X(-2), Y(-1), sh);
    for (const wx of [-6, -2, 2, 6]) p.dot(X(wx), Y(-8), C.skyLight);
    p.rect(X(15), Y(-11 + (pose.frame % 2) * 4), X(16), Y(-7 + (pose.frame % 2) * 4), C.gray);
  } else if (n === 'tank') {
    // A big rolling water tank on a cart (the word list's tank, drawn like its 🛢️ picture).
    wheel(-8, 2.5); wheel(8, 2.5);
    p.rect(X(-12), Y(-6), X(12), Y(-4), C.brown);
    p.ellipse(0, Y(-12), X(11), Y(6.5), b);
    p.line(X(-9), Y(-12), X(9), Y(-12), sh); p.line(X(-8), Y(-15), X(8), Y(-15), sh);
    p.rect(X(-1), Y(-20), X(1), Y(-18), C.darkGray);
  } else {
    const bus = n === 'bus', van = n === 'van';
    const half = bus ? 17 : van ? 12 : 12;
    const top = bus || van ? -16 : -10;
    p.rect(X(-half), Y(top), X(half), Y(-4), b);
    if (!bus && !van) { p.rect(X(-6), Y(-14), X(5), Y(-10), b); p.rect(X(-4), Y(-13), X(-1), Y(-10), C.skyLight); p.rect(X(1), Y(-13), X(4), Y(-10), C.skyLight); }
    else { for (let wx = -half + 3; wx < half - 4; wx += bus ? 5 : 6) p.rect(X(wx), Y(top + 2), X(wx + 3), Y(top + 5), C.skyLight); p.rect(X(half - 3), Y(top + 2), X(half - 1), Y(top + 6), C.skyLight); }
    p.dot(X(half), Y(-6), C.yellow);
    wheel(-half + 5, 3); wheel(half - 5, 3);
  }
  return p.finish();
}

// Things: one small picture per word list noun; unknown things are a blob.
function object(m: CastMember, look: Look, pose: Pose): Sprite {
  const { s, sx, sy } = squashXY(look, pose, 1.2);
  const n = m.noun;
  const p = new Painter(Math.ceil(20 * s * sx), Math.ceil(30 * s * sy));
  const X = (v: number) => v * s * sx; const Y = (v: number) => v * s * sy;
  const col = (d: [number, number]) => { const c = colorsFor(m, look, d); p.shade.set(c[0], c[1]); return c; };
  const f = pose.frame;
  switch (n) {
    case 'ball': {
      const [b] = col([C.white, C.lightGray]);
      p.ellipse(0, Y(-4.5), X(4.5), Y(4.5), b);
      const a = (f % 4) * (Math.PI / 2);
      p.ellipse(X(Math.cos(a) * 2), Y(-4.5 + Math.sin(a) * 2), X(1.3), Y(1.3), C.black);
      p.ellipse(X(-Math.cos(a) * 2.5), Y(-4.5 - Math.sin(a) * 2.5), X(0.9), Y(0.9), C.black);
      break;
    }
    case 'kite': {
      const [b, sh] = col([C.red, C.curtainDark]);
      p.line(0, 0, X(-1), Y(-12), C.lightGray);
      p.tri(0, Y(-24), X(-5), Y(-18), X(5), Y(-18), b); p.tri(X(-5), Y(-18), X(5), Y(-18), 0, Y(-12), sh);
      p.line(0, Y(-12), X(f % 2 ? 2 : -2), Y(-9), C.yellow); p.dot(X(f % 2 ? 2 : -2), Y(-8), C.blue);
      break;
    }
    case 'apple': {
      const [b] = col([C.red, C.curtainDark]);
      p.ellipse(0, Y(-4), X(4), Y(4), b); p.line(0, Y(-8), X(0.5), Y(-10), C.brown); p.ellipse(X(2), Y(-9.5), X(1.5), Y(0.8), C.green);
      break;
    }
    case 'book': {
      const [b] = col([C.red, C.curtainDark]);
      p.rect(X(-5), Y(-10), X(4), 0, b); p.rect(X(4), Y(-9.5), X(5), Y(-0.5), C.white); p.rect(X(-3), Y(-8), X(2), Y(-7), C.gold);
      break;
    }
    case 'crayon': {
      const [b, sh] = col([C.purple, C.teal]);
      p.rect(X(-1.6), Y(-12), X(1.6), 0, b); p.tri(X(-1.6), Y(-12), X(1.6), Y(-12), 0, Y(-16), sh); p.rect(X(-1.6), Y(-4), X(1.6), Y(-3), C.white);
      break;
    }
    case 'dime': {
      col([C.lightGray, C.gray]);
      p.ellipse(0, Y(-3), X(3), Y(3), C.lightGray); p.ring(0, Y(-3), 2 * s, C.gray); if (f % 4 === 0) p.dot(X(-1), Y(-4), C.white);
      break;
    }
    case 'rose': {
      const [b, sh] = col([C.red, C.curtainDark]);
      p.line(0, 0, 0, Y(-10), C.grassDark); p.ellipse(X(1.5), Y(-5), X(1.6), Y(0.8), C.green);
      p.ellipse(0, Y(-12), X(3), Y(3), b); p.ellipse(X(-0.5), Y(-12.5), X(1.4), Y(1.4), sh);
      break;
    }
    case 'shoe': {
      const [b] = col([C.blue, C.teal]);
      p.rect(X(-6), Y(-1), X(6), 0, C.white); p.rect(X(-6), Y(-6), X(-1), Y(-1), b); p.ellipse(X(2), Y(-2.5), X(4), Y(2.5), b);
      p.dot(X(-2), Y(-4), C.white); p.dot(X(0), Y(-3.5), C.white);
      break;
    }
    case 'straw': {
      col([C.red, C.curtainDark]);
      for (let k = 0; k < 7; k++) p.rect(X(-1 + k * 0.4), Y(-k * 2 - 2), X(1 + k * 0.4), Y(-k * 2), k % 2 ? C.white : C.red);
      p.ellipse(0, Y(-1), X(4), Y(1.2), C.skyLight);
      break;
    }
    case 'swing': {
      col([C.red, C.curtainDark]);
      p.rect(X(-8), Y(-22), X(-7), 0, C.brown); p.rect(X(7), Y(-22), X(8), 0, C.brown); p.rect(X(-8), Y(-22), X(8), Y(-21), C.brown);
      const sw = f % 4 === 1 ? 2 : f % 4 === 3 ? -2 : 0;
      p.line(X(-3), Y(-21), X(-3 + sw), Y(-6), C.lightGray); p.line(X(3), Y(-21), X(3 + sw), Y(-6), C.lightGray);
      p.rect(X(-4 + sw), Y(-6), X(4 + sw), Y(-5), colorsFor(m, look, [C.red, C.curtainDark])[0]);
      break;
    }
    case 'balloon': {
      const [b] = col([C.red, C.curtainDark]);
      for (let k = 0; k < 6; k++) p.dot(X((k % 2 ? 1 : -1) * (f % 2 ? 1 : 0.4)), Y(-k * 2), C.lightGray);
      p.ellipse(0, Y(-17), X(4.5), Y(5.5), b); p.tri(X(-1), Y(-11.5), X(1), Y(-11.5), 0, Y(-12.5), b); p.dot(X(-2), Y(-19), C.white);
      break;
    }
    case 'popsicle': {
      const [b] = col([C.pink, C.curtainLight]);
      p.rect(X(-0.5), Y(-4), X(0.5), 0, C.tan); p.ellipse(0, Y(-10), X(2.6), Y(2.6), b); p.rect(X(-2.6), Y(-10), X(2.6), Y(-4), b); p.dot(X(-1), Y(-10), C.white);
      break;
    }
    case 'rock': {
      const [b] = col([C.gray, C.darkGray]);
      p.ellipse(0, Y(-3.5), X(5.5), Y(3.5), b); p.ellipse(X(-2), Y(-5), X(2), Y(1.4), b); p.dot(X(1.5), Y(-3), C.darkGray);
      break;
    }
    default: return blob(m, look);
  }
  return p.finish();
}

// Weather: a cloud with rain falling out of it.
function weather(m: CastMember, look: Look, pose: Pose): Sprite {
  const s = look.scale;
  const p = new Painter(Math.ceil(28 * s), Math.ceil(46 * s));
  for (let i = -9; i <= 9; i += 4.5) {
    const y = -34 + ((pose.frame * 5 + Math.abs(i) * 7) % 30);
    p.line(i * s, y * s, i * s, (y + 2) * s, colorsFor(m, look, [C.blue, C.teal])[0]);
  }
  p.shade.set(C.white, C.lightGray);
  p.ellipse(-6 * s, -38 * s, 6 * s, 4 * s, C.white); p.ellipse(3 * s, -41 * s, 7 * s, 5 * s, C.white); p.ellipse(9 * s, -37 * s, 5 * s, 3.5 * s, C.white);
  return p.finish();
}

// Scenery words as cast members ("the door fell"): small pictures.
function propSprite(m: CastMember, look: Look): Sprite {
  const s = look.scale;
  const p = new Painter(Math.ceil(26 * s), Math.ceil(34 * s));
  const n = m.noun;
  if (n === 'door') { p.rect(-6 * s, -29 * s, 6 * s, 0, colorsFor(m, look, [C.brown, C.sepia3])[0]); p.dot(3 * s, -15 * s, C.gold); }
  else if (n === 'window') { p.rect(-8 * s, -30 * s, 8 * s, -16 * s, C.skyLight); p.rect(-0.5, -30 * s, 0.5, -16 * s, C.outline); p.rect(-8 * s, -23 * s, 8 * s, -23 * s, C.outline); }
  else if (n === 'table') { p.rect(-11 * s, -13 * s, 11 * s, -11 * s, colorsFor(m, look, [C.brown, C.sepia3])[0]); p.rect(-10 * s, -10 * s, -9 * s, 0, C.sepia3); p.rect(9 * s, -10 * s, 10 * s, 0, C.sepia3); }
  else if (n === 'kitchen') { p.rect(-10 * s, -16 * s, 10 * s, 0, C.white); p.rect(-8 * s, -11 * s, 8 * s, -2 * s, C.lightGray); p.ellipse(-5 * s, -17 * s, 3 * s, 1, C.darkGray); p.ellipse(5 * s, -17 * s, 3 * s, 1, C.darkGray); }
  else { p.rect(-12 * s, -2 * s, 12 * s, 0, colorsFor(m, look, [C.sepia2, C.sepia3])[0]); }
  return p.finish();
}

const cache = new Map<string, Sprite>();
export function spriteFor(m: CastMember, look: Look, pose: Pose): Sprite {
  const key = `${m.id}|${m.noun}|${m.rig}|${JSON.stringify(look)}|${pose.frame % 4}|${pose.squash}|${pose.sprout ? 1 : 0}`;
  let s = cache.get(key);
  if (!s) {
    s = m.rig === 'quadruped' ? quadruped(m, look, pose) : m.rig === 'biped' ? biped(m, look, pose)
      : m.rig === 'bird' ? bird(m, look, pose) : m.rig === 'critter' ? critter(m, look, pose) : m.rig === 'serpent' ? serpent(m, look, pose)
      : m.rig === 'vehicle' ? vehicle(m, look, pose) : m.rig === 'weather' ? weather(m, look, pose) : m.rig === 'prop' ? propSprite(m, look)
      : object(m, look, pose);
    if (cache.size > 400) cache.clear();
    cache.set(key, s);
  }
  return s;
}

// Scenery props for where phrases (door, window, table, floor, kitchen).
// Any other ground noun ("over the car") draws its own picture, standing
// still, so the ground is always clear (plan 6.6).
export function drawProp(fb: FB, member: CastMember | undefined, look: Look | undefined, x: number, ground: number) {
  const noun = member?.noun ?? 'thing';
  if (noun === 'door') { fb.rect(x - 7, ground - 30, 14, 30, C.outline); fb.rect(x - 6, ground - 29, 12, 29, C.brown); fb.set(x + 3, ground - 15, C.gold); return; }
  if (noun === 'window') { fb.rect(x - 9, ground - 34, 18, 16, C.outline); fb.rect(x - 8, ground - 33, 16, 14, C.skyLight); fb.rect(x - 1, ground - 33, 1, 14, C.outline); fb.rect(x - 8, ground - 27, 16, 1, C.outline); return; }
  if (noun === 'table') { fb.rect(x - 12, ground - 13, 24, 3, C.brown); fb.rect(x - 11, ground - 10, 2, 10, C.sepia3); fb.rect(x + 9, ground - 10, 2, 10, C.sepia3); return; }
  if (noun === 'floor') { fb.rect(x - 20, ground - 1, 40, 2, C.sepia2); return; }
  if (noun === 'kitchen') {
    fb.rect(x - 13, ground - 18, 26, 18, C.outline); fb.rect(x - 12, ground - 17, 24, 17, C.white);
    fb.rect(x - 10, ground - 12, 20, 9, C.lightGray); fb.rect(x - 9, ground - 11, 18, 7, C.darkGray);
    fb.rect(x - 9, ground - 20, 6, 2, C.darkGray); fb.rect(x + 3, ground - 20, 6, 2, C.darkGray); fb.set(x + 9, ground - 15, C.red);
    return;
  }
  if (member && look) { fb.blit(spriteFor(member, look, { frame: 0, squash: 0 }), x, ground); return; }
  fb.rect(x - 8, ground - 14, 16, 14, C.outline); fb.rect(x - 7, ground - 13, 14, 12, C.tan);
  const w = textWidth(noun);
  drawText(fb, noun, Math.round(x - w / 2), ground - 24, C.white);
}
