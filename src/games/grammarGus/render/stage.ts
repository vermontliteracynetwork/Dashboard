import { FB, W, H } from './fb';
import { C, SEPIA_OF, SEPIA_DARKER } from './palette';
import { drawText, drawTextCentered, textWidth } from './font';
import { spriteFor, drawProp } from './rigs';
import type { Beat, Scene, SceneScript } from '../director/director';
import type { CastMember } from '../director/cast';
import { nounByWord } from '../data/wordbank';

// The Pixel Cinema player (plan 3.17, 5.5, 6). Reads a scene script and
// draws one frame for a moment in time. Stepped at 12 frames per second,
// every position snapped to the pixel grid, red pixel curtains first.

export const FPS = 12;
export const GROUND = 72;
export interface RenderOpts { calm?: boolean }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

interface ActorState {
  x: number; y: number; facing: 1 | -1; visible: boolean; frame: number; squash: 0 | 1 | 2; sprout: boolean; behind: boolean; ghost: boolean; moving: boolean;
  word?: string; tags: string[]; fx: string[]; sparkle: boolean; poof: boolean;
  act?: string; actQ: number; // the action playing right now and how far into it (0 to 1)
  react?: string; reactQ: number; // what is being done to this actor
  water: boolean; bush: boolean; ladderX?: number; dizzy: boolean; sink: number; broken: boolean;
}

// Approach clips walk over for the first 40% of the beat, then act.
const APPROACH = 0.4;
const actPart = (b: Beat, p: number) => ((b.x0 ?? 0) === (b.x1 ?? 0) ? p : p < APPROACH ? -1 : (p - APPROACH) / (1 - APPROACH));
const ANIMATE_RIGS = new Set(['biped', 'quadruped', 'critter', 'bird', 'serpent']);

function actorAt(scene: Scene, id: string, t: number, propXs: number[], m: CastMember): ActorState {
  const st = scene.start[id] ?? { x: 80, facing: 1 as const };
  const s: ActorState = { x: st.x, y: 0, facing: st.facing, visible: true, frame: 0, squash: 0, sprout: false, behind: false, ghost: false, moving: false, tags: [], fx: [], sparkle: false, poof: false, actQ: 0, reactQ: 0, water: false, bush: false, dizzy: false, sink: 0, broken: false };
  const enter = scene.beats.find((b) => b.do === 'enter');
  if (enter && enter.who.includes(id)) { s.visible = t >= enter.t; s.sparkle = t >= enter.t && t < enter.t + Math.min(0.35, enter.dur); }
  const firstAct = scene.beats.find((b) => b.do !== 'enter' && b.do !== 'shout' && b.do !== 'settle' && (b.who.includes(id) || b.target === id));
  s.ghost = scene.tense === 'future' && (!firstAct || t < firstAct.t);
  for (const b of scene.beats) {
    if (t < b.t) break;
    const p = clamp01((t - b.t) / b.dur);
    const active = p < 1;
    if (b.who.includes(id)) moveBy(s, b, p, active, t, propXs);
    else if (b.target === id) reactTo(s, b, p, active, st.x, t, m);
  }
  return s;
}

function walkTo(s: ActorState, x0: number, x1: number, p: number, active: boolean) {
  s.x = lerp(x0, x1, p);
  if (x1 !== x0) s.facing = x1 > x0 ? 1 : -1;
  s.moving = active && x0 !== x1;
  s.frame = Math.floor(Math.abs(s.x - x0) / 3);
  if (s.moving) s.y = -(s.frame % 2);
}

function moveBy(s: ActorState, b: Beat, p: number, active: boolean, t: number, propXs: number[]) {
  const x0 = b.x0 ?? s.x, x1 = b.x1 ?? s.x;
  s.fx = active ? b.fx : []; s.tags = active ? b.tags : [];
  s.act = active ? b.do : undefined;
  s.actQ = 0;
  const near = () => propXs.find((q) => Math.abs(q - s.x) < 12);
  // Walk over first, then act (q < 0 while still walking).
  const approach = () => {
    const q = actPart(b, p);
    walkTo(s, x0, x1, q < 0 ? p / APPROACH : 1, active && q < 0);
    if (q >= 0) s.y = 0;
    s.actQ = Math.max(0, q);
    if (q < 0) s.act = undefined;
    return q;
  };
  switch (b.do) {
    case 'run': case 'walk': case 'chase': case 'slide': case 'swim': case 'fly': {
      walkTo(s, x0, x1, p, active);
      if (b.do === 'walk') s.frame = Math.floor(Math.abs(s.x - x0) / 4);
      if (b.do === 'slide') { s.frame = 0; s.y = 0; }
      if (b.do === 'fly') { s.frame = Math.floor(t * 8); s.y = active ? -Math.round(Math.sin(Math.PI * p) * 22) - (s.frame % 2) : 0; }
      if (b.do === 'swim') { s.water = active; s.frame = Math.floor(t * 6); s.y = active ? 3 - (Math.floor(t * 4) % 2) : 0; }
      const px = propXs.find((q) => Math.abs(q - s.x) < 12);
      if (px !== undefined && active && b.do !== 'fly') {
        if (b.path === 'over') s.y -= Math.round(Math.cos(((s.x - px) / 12) * (Math.PI / 2)) * 16);
        if (b.path === 'under' || b.path === 'through' || b.path === 'behind' || b.path === 'around') s.behind = true;
      }
      if (!active && (b.path === 'behind')) s.behind = true;
      s.actQ = p;
      break;
    }
    case 'jump': case 'pounce': {
      s.x = lerp(x0, x1, p); if (x1 !== x0) s.facing = x1 > x0 ? 1 : -1;
      const h = b.do === 'pounce' ? 12 : b.path === 'over' ? 26 : 18;
      s.y = active ? -Math.round(Math.sin(Math.PI * p) * h) : 0;
      s.squash = !active ? 0 : p < 0.12 || p > 0.88 ? 1 : 2;
      s.moving = active;
      break;
    }
    case 'fall': {
      // Whoops: a little hop, a plop, then dizzy stars.
      const q = approach(); if (q < 0) break;
      s.y = q < 0.2 ? -Math.round((q / 0.2) * 6) : q < 0.55 ? -Math.round(6 * (1 - ((q - 0.2) / 0.35) ** 2)) : 0;
      s.squash = q >= 0.55 ? 1 : q < 0.2 ? 2 : 0;
      s.dizzy = q >= 0.55;
      if (near() !== undefined && (b.path === 'through' || b.path === 'under')) s.behind = q >= 0.3;
      break;
    }
    case 'climb': {
      const q = approach(); if (q < 0) break;
      s.y = -Math.round(q * 20); s.frame = Math.floor(q * 12);
      if (near() === undefined) s.ladderX = s.x + s.facing * 3;
      break;
    }
    case 'spin': {
      const q = approach(); if (q < 0) break;
      if (active) { s.facing = Math.floor(t * 10) % 2 ? 1 : -1; s.frame = Math.floor(t * 8); s.y = -Math.round(Math.abs(Math.sin(q * Math.PI)) * 6); }
      break;
    }
    case 'hide': {
      const q = approach(); if (q < 0) break;
      if (q > 0.3) { if (near() !== undefined) s.behind = true; else s.bush = true; }
      break;
    }
    case 'melt': {
      const q = approach(); if (q < 0) break;
      s.sink = q; s.squash = q > 0.15 ? 1 : 0;
      break;
    }
    case 'kick': case 'hug': case 'chop': case 'mix': case 'eat': case 'drink': case 'clean': case 'break': case 'miss': case 'sing': case 'talk': {
      const q = approach(); if (q < 0 || !active) break;
      if (b.do === 'kick') s.squash = q > 0.3 && q < 0.5 ? 2 : 0;
      if (b.do === 'hug') s.squash = Math.floor(t * 4) % 2 ? 1 : 0;
      if (b.do === 'eat' || b.do === 'drink' || b.do === 'talk') s.squash = Math.floor(t * 6) % 2 ? 1 : 0;
      if (b.do === 'clean') s.x += Math.floor(t * 8) % 2 ? 1 : -1;
      if (b.do === 'chop' || b.do === 'break') s.squash = Math.floor(t * 4) % 2 ? 1 : 2;
      if (b.do === 'miss') { if (q > 0.3) s.x += Math.round(Math.min(1, (q - 0.3) / 0.3) * 8) * s.facing; s.squash = q > 0.6 ? 1 : 0; }
      if (b.do === 'sing') s.y = -(Math.floor(t * 4) % 2);
      break;
    }
    case 'wiggle': {
      if (active) { s.x += Math.floor(t * 6) % 2 ? 1 : -1; s.word = b.word; s.sprout = !!b.sprout; s.frame = Math.floor(t * 6); }
      break;
    }
    default: break;
  }
  if (active && s.moving && b.fx.includes('zigzag')) s.y -= (Math.floor(t * 12) % 2) * 3;
  if (active && b.sprout) { s.sprout = true; s.frame = Math.floor(t * 8); }
}

function reactTo(s: ActorState, b: Beat, p: number, active: boolean, startX: number, t: number, m: CastMember) {
  const animate = ANIMATE_RIGS.has(m.rig);
  if (b.do === 'chase') { s.x = startX + p * 26; s.facing = 1; s.moving = p < 1; s.frame = Math.floor(p * 26 / 3); s.y = s.moving ? -(s.frame % 2) : 0; return; }
  if (b.do === 'pounce') { if (p > 0.7) { const q = (p - 0.7) / 0.3; s.x = startX + q * 12; s.y = -Math.round(Math.sin(Math.PI * Math.min(1, q)) * 6); s.poof = p < 1; } return; }
  const q = actPart(b, p);
  if (q < 0) return;
  s.react = active ? b.do : undefined; s.reactQ = q;
  switch (b.do) {
    case 'kick': {
      if (q < 0.45) break;
      const k = (q - 0.45) / 0.55;
      if (animate) { s.x = startX + Math.round(k * 10); s.y = active ? -Math.round(Math.sin(Math.PI * k) * 6) : 0; s.poof = active && k < 0.3; }
      else { s.x = startX + k * 70; s.y = -Math.round(Math.sin(Math.PI * k) * 24); s.poof = active && k < 0.2; s.frame = Math.floor(k * 12); s.visible = s.x < W + 12; }
      break;
    }
    case 'hug': if (active) s.squash = Math.floor(t * 4) % 2 ? 1 : 0; break;
    case 'eat': case 'drink': {
      // Food disappears bite by bite; an animal just hops away, surprised.
      if (animate) { if (q > 0.5) { const k = (q - 0.5) / 0.5; s.x = startX + Math.round(k * 22); s.y = -Math.round(Math.sin(Math.PI * k) * 8); s.facing = 1; } }
      else { s.ghost = q > 0.35; s.visible = q < 0.9; }
      break;
    }
    case 'break': {
      if (active && q > 0.2 && q < 0.7) s.x = startX + (Math.floor(t * 12) % 2 ? 1 : -1);
      if (!animate) s.broken = q >= 0.7;
      break;
    }
    case 'chop': if (active) s.squash = Math.floor(t * 4) % 2 ? 1 : 0; break;
    case 'miss': {
      if (q > 0.25 && q < 0.75) { const k = (q - 0.25) / 0.5; s.y = -Math.round(Math.sin(Math.PI * k) * 14); s.squash = 2; }
      break;
    }
    default: break;
  }
}

function drawBackdrop(fb: FB) {
  for (let y = 0; y < GROUND; y++) fb.rect(0, y, W, 1, y < 26 ? C.skyLight : C.sky);
  fb.ellipse(136, 22, 6, 6, C.yellow);
  for (const [cx, cy] of [[30, 24], [96, 18]]) { fb.ellipse(cx, cy, 9, 3.5, C.white); fb.ellipse(cx + 6, cy - 2, 5, 3, C.white); }
  fb.rect(0, GROUND, W, H - GROUND, C.grass);
  fb.rect(0, GROUND, W, 2, C.grassDark);
  for (let x = 3; x < W; x += 11) fb.set(x, GROUND + 6 + (x % 3), C.grassDark);
}

function drawStar(fb: FB, cx: number, cy: number, c: number) {
  const rows = ['....#....', '...###...', '#########', '.#######.', '..#####..', '.###.###.', '.##...##.'];
  rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') fb.set(cx - 4 + i, cy - 3 + j, c); }));
}
function drawHeart(fb: FB, cx: number, cy: number, c: number) {
  ['.#.#.', '#####', '#####', '.###.', '..#..'].forEach((r, j) => [...r].forEach((ch, i) => { if (ch === '#') fb.set(cx - 2 + i, cy - 2 + j, c); }));
}
function drawNote(fb: FB, x: number, y: number, c: number) {
  fb.rect(x, y + 3, 2, 2, c); fb.rect(x + 2, y - 2, 1, 6, c); fb.rect(x + 2, y - 2, 2, 1, c);
}
const wave = (t: number, k: number) => ((t * 1.2 + k / 3) % 1 + 1) % 1;

// Adverb effects (plan 6.4): drawn while the action plays.
function drawFx(fb: FB, a: ActorState, top: number, t: number) {
  const back = a.facing === 1 ? -1 : 1;
  const midY = Math.round((top + GROUND + a.y) / 2);
  if (a.moving && a.fx.includes('speedLines')) for (const [dy, len] of [[-6, 6], [-11, 8], [-16, 5]]) fb.rect(Math.min(a.x + back * 12, a.x + back * (12 + len)), GROUND + a.y + dy, len, 1, C.white);
  if (a.moving && a.fx.includes('dust') && a.frame % 2 === 0) { fb.ellipse(a.x + back * 10, GROUND - 1, 2, 1.5, C.lightGray); fb.ellipse(a.x + back * 14, GROUND - 2, 1.5, 1.2, C.lightGray); }
  if (a.moving && a.fx.includes('effort')) { const k = a.frame % 2; fb.rect(a.x - 3 + k, top - 4, 1, 2, C.outline); fb.rect(a.x + 2 - k, top - 5, 1, 2, C.outline); }
  if (a.moving && a.fx.includes('snail')) { const sx = a.x + back * 16; fb.ellipse(sx, GROUND - 2, 2, 2, C.tan); fb.rect(sx - 3, GROUND - 1, 6, 1, C.lightGray); }
  if (a.fx.includes('stars')) drawStar(fb, a.x + 6, top - 4 - (Math.floor(t * 6) % 2), C.yellow);
  if (a.fx.includes('sound')) {
    const n = (Math.floor(t * 6) % 3) + 1;
    for (let k = 1; k <= n; k++) { const cx = a.x - back * (6 + k * 3); for (let dy = -k - 1; dy <= k + 1; dy++) fb.set(cx - back * (Math.abs(dy) > k ? -1 : 0), midY + dy, C.white); }
  }
  if (a.fx.includes('shh')) drawTextCentered(fb, 'shh', a.x, top - 10 - (Math.floor(t * 3) % 2), C.lightGray);
  if (a.fx.includes('feather')) {
    const ph = wave(t * 0.6, 0); const fx = Math.round(a.x + back * 8 + Math.sin(ph * 8) * 3); const fy = Math.round(top - 6 + ph * 22);
    fb.rect(fx - 2, fy, 5, 1, C.white); fb.rect(fx - 1, fy - 1, 3, 1, C.white); fb.set(fx + 3, fy + 1, C.tan);
  }
  if (a.fx.includes('hearts')) for (let k = 0; k < 2; k++) { const ph = wave(t, k * 1.5); drawHeart(fb, a.x - 5 + k * 10, Math.round(top - 3 - ph * 12), C.pink); }
  if (a.fx.includes('glow')) {
    const ry = (GROUND + a.y - top) / 2 + 3;
    for (let k = 0; k < 14; k++) if ((k + Math.floor(t * 6)) % 2) { const ang = (k / 14) * Math.PI * 2; fb.set(a.x + Math.cos(ang) * 13, midY + Math.sin(ang) * ry, C.yellow); }
  }
  if (a.fx.includes('splat')) {
    const cols = [C.red, C.purple, C.yellow, C.blue];
    for (let k = 0; k < 4; k++) { const sx = a.x + back * (10 + k * 9); fb.ellipse(sx, GROUND + 3, 2.5, 1.2, cols[k]); fb.set(sx + 3, GROUND + 1, cols[k]); fb.set(sx - 3, GROUND + 4, cols[k]); }
  }
  if (a.fx.includes('zigzag') && a.moving) { let zx = a.x + back * 10; for (let k = 0; k < 4; k++) { fb.rect(zx, top + 2 + k * 3, 2, 1, C.yellow); zx += back * 2; fb.rect(zx, top + 3 + k * 3, 1, 2, C.yellow); } }
  if (a.fx.includes('halo')) for (let k = 0; k < 12; k++) { const ang = (k / 12) * Math.PI * 2; fb.set(a.x + Math.cos(ang) * 5, top - 3 + Math.sin(ang) * 1.6, C.gold); }
}

// Action props and particles (plan 6.3): the axe, the bowl, notes, bubbles.
function drawAction(fb: FB, a: ActorState, top: number, t: number, sprColor: number) {
  const front = a.x + a.facing * 9;
  const mouthY = Math.round(top + (GROUND + a.y - top) * 0.3);
  const q = a.actQ;
  switch (a.act) {
    case 'chop': {
      const up = Math.floor(t * 8) % 2 === 0;
      const hx = front, hy = up ? top - 6 : mouthY + 2;
      fb.rect(a.x + a.facing * 3, Math.min(hy, mouthY), 1, Math.abs(mouthY - hy) + 1, C.brown);
      fb.rect(hx - 1, hy - 1, 3, 3, C.lightGray); fb.set(hx + a.facing * 2, hy, C.white);
      if (!up) for (let k = 0; k < 3; k++) fb.set(front + a.facing * (3 + k * 2), GROUND - 3 - ((k + Math.floor(t * 12)) % 4), C.tan);
      break;
    }
    case 'mix': {
      fb.ellipse(front, GROUND - 3, 6, 3, C.outline); fb.ellipse(front, GROUND - 3, 5, 2.4, C.white); fb.rect(front - 4, GROUND - 5, 9, 1, C.tan);
      const ang = t * 9;
      const sx = Math.round(front + Math.cos(ang) * 3);
      fb.rect(sx, GROUND - 12, 1, 8, C.brown);
      for (let k = 0; k < 3; k++) fb.set(front - 2 + k * 2 + Math.round(Math.sin(ang + k) * 1), GROUND - 5, [C.red, C.yellow, C.green][k]);
      break;
    }
    case 'eat': {
      for (let k = 0; k < 3; k++) { const ph = wave(t * 1.5, k); fb.set(front + (k - 1) * 2, Math.round(mouthY + ph * (GROUND - mouthY)), C.tan); }
      break;
    }
    case 'drink': {
      fb.rect(front - 2, mouthY, 4, 6, C.outline); fb.rect(front - 1, mouthY + 1, 2, 5, C.white); fb.rect(front - 1, mouthY + 3, 2, 3, C.blue);
      fb.rect(front, mouthY - 3, 1, 3, C.red);
      for (let k = 0; k < 2; k++) { const ph = wave(t * 2, k); fb.set(front + k, Math.round(mouthY + 3 - ph * 8), C.skyLight); }
      break;
    }
    case 'sing': for (let k = 0; k < 3; k++) { const ph = wave(t, k); drawNote(fb, Math.round(a.x + a.facing * 4 + (k - 1) * 5 + Math.sin(ph * 6) * 2), Math.round(top - 4 - ph * 16), [C.yellow, C.pink, C.white][k]); } break;
    case 'talk': {
      const bx = a.x + a.facing * 12, by = top - 8;
      fb.ellipse(bx, by, 9, 5, C.outline); fb.ellipse(bx, by, 8, 4, C.white); fb.set(bx - a.facing * 5, by + 5, C.white); fb.set(bx - a.facing * 6, by + 6, C.outline);
      const dots = Math.floor(t * 4) % 4;
      for (let k = 0; k < dots; k++) fb.rect(bx - 4 + k * 3, by, 2, 2, C.darkGray);
      break;
    }
    case 'clean': for (let k = 0; k < 5; k++) { const ph = wave(t, k * 0.6); const bx = Math.round(front + Math.sin(ph * 7 + k) * 6), by = Math.round(GROUND - 4 - ph * 18); if (k % 2) fb.set(bx, by, C.yellow); else { fb.set(bx, by - 1, C.white); fb.set(bx - 1, by, C.white); fb.set(bx + 1, by, C.white); fb.set(bx, by + 1, C.white); } } break;
    case 'spin': for (let k = 0; k < 3; k++) { const ang = t * 12 + (k * Math.PI * 2) / 3; fb.set(a.x + Math.cos(ang) * 11, Math.round((top + GROUND) / 2 + Math.sin(ang) * 3), C.white); } break;
    case 'miss': if (q > 0.6) { fb.ellipse(front + a.facing * 2, GROUND - 3, 3, 2, C.lightGray); drawTextCentered(fb, '?', a.x, top - 10, C.yellow); } break;
    case 'break': if (q > 0.6 && q < 0.85) for (let k = 0; k < 4; k++) fb.rect(front + a.facing * (4 + k * 3), GROUND - 6 - ((k * 5 + Math.floor(t * 12)) % 8), 2, 2, k % 2 ? C.gray : C.tan); break;
    default: break;
  }
  if (a.dizzy) for (let k = 0; k < 3; k++) { const ang = t * 6 + (k * Math.PI * 2) / 3; fb.set(a.x + Math.cos(ang) * 5, top - 3 + Math.sin(ang) * 1.5, C.yellow); }
  if (a.sink > 0) fb.ellipse(a.x, GROUND - 1, 4 + 9 * a.sink, 1.5 + a.sink, sprColor);
}

// Pixel cracks across something that broke.
function drawCracks(fb: FB, x: number, top: number) {
  let cx = x;
  for (let y = top + 1; y < GROUND - 1; y += 2) { fb.set(cx, y, C.outline); fb.set(cx, y + 1, C.outline); cx += (y / 2) % 2 ? 1 : -1; }
  fb.rect(x - 7, GROUND - 2, 3, 2, C.gray); fb.rect(x + 6, GROUND - 2, 2, 2, C.gray);
}

function drawLadder(fb: FB, x: number) {
  fb.rect(x - 4, GROUND - 30, 1, 30, C.brown); fb.rect(x + 4, GROUND - 30, 1, 30, C.brown);
  for (let y = GROUND - 28; y < GROUND; y += 5) fb.rect(x - 3, y, 7, 1, C.sepia2);
}

function drawBush(fb: FB, x: number, t: number) {
  fb.ellipse(x, GROUND - 7, 12, 9, C.outline); fb.ellipse(x, GROUND - 7, 11, 8, C.grass); fb.ellipse(x - 5, GROUND - 9, 5, 4, C.green); fb.ellipse(x + 5, GROUND - 4, 5, 3, C.grassDark);
  if (Math.floor(t * 2) % 3 !== 0) { fb.set(x - 2, GROUND - 14, C.white); fb.set(x + 2, GROUND - 14, C.white); fb.set(x - 2, GROUND - 13, C.outline); fb.set(x + 2, GROUND - 13, C.outline); }
}

function drawCurtains(fb: FB, open: number) {
  const half = (left: boolean, w: number) => {
    const bw = Math.max(2, Math.round(6 * (w / 80)));
    const cols = [C.curtain, C.curtainLight, C.curtain, C.curtainDark];
    for (let i = 0; i < w; i++) {
      const x = left ? i : W - 1 - i;
      const band = Math.floor((left ? i : i) / bw) % 4;
      fb.rect(x, 0, 1, H, cols[band]);
    }
    const edge = left ? w - 1 : W - w;
    fb.rect(edge, 0, 1, H, C.curtainDark);
  };
  const w = Math.round(80 - 70 * open);
  half(true, w); half(false, w);
  // Gold valance with a scalloped edge and two tassels (never moves).
  fb.rect(0, 0, W, 8, C.gold);
  fb.rect(0, 0, W, 1, C.goldDark);
  for (let x = 5; x < W; x += 10) fb.ellipse(x, 8, 5, 3, C.gold);
  for (let x = 0; x < W; x += 10) fb.set(x, 9, C.goldDark);
  for (const tx of [8, 151]) { fb.rect(tx, 10, 2, 6, C.gold); fb.rect(tx - 1, 16, 4, 2, C.goldDark); }
}

const curtainOpenAt = (p: number, calm: boolean) => (calm ? (p < 1 / 3 ? 0 : p < 2 / 3 ? 0.5 : 1) : Math.floor(clamp01(p) * 11) / 11);

// Blueprint title cards (plan 11.8): gold words on a dark card.
function drawTitleCard(fb: FB, text: string) {
  fb.clear(C.black);
  for (let x = 6; x < W; x += 12) { fb.set(x, 22, C.goldDark); fb.set(x, 70, C.goldDark); }
  const words = text.split(' '); const lines: string[] = [];
  for (const w of words) { const last = lines[lines.length - 1]; if (last && textWidth(`${last} ${w}`) <= 120) lines[lines.length - 1] = `${last} ${w}`; else lines.push(w); }
  const y0 = Math.round(46 - (lines.length * 11) / 2);
  lines.forEach((l, i) => drawTextCentered(fb, l, W / 2, y0 + i * 11, C.gold));
}

function drawBubble(fb: FB, text: string, cx: number, y: number) {
  const w = textWidth(text) + 6;
  const x = Math.max(12, Math.min(W - 12 - w, Math.round(cx - w / 2)));
  fb.rect(x - 1, y - 1, w + 2, 13, C.outline); fb.rect(x, y, w, 11, C.white);
  const tx = Math.max(x + 3, Math.min(x + w - 4, cx));
  fb.rect(tx, y + 11, 2, 2, C.white); fb.set(tx - 1, y + 12, C.outline); fb.set(tx + 2, y + 12, C.outline); fb.set(tx, y + 13, C.outline); fb.set(tx + 1, y + 13, C.outline);
  drawText(fb, text, x + 3, y + 2, C.outline, null);
}

function drawScene(fb: FB, script: SceneScript, scene: Scene, t: number, opts: RenderOpts) {
  if (scene.title !== undefined) { drawTitleCard(fb, scene.title); return; }
  const castById = new Map(script.cast.map((m) => [m.id, m]));
  drawBackdrop(fb);
  const propXs = scene.props.map((p) => p.x);
  const actorIds = Object.keys(scene.start);
  const states = actorIds.map((id) => ({ id, m: castById.get(id)!, s: null as unknown as ActorState })).filter((a) => a.m);
  for (const a of states) a.s = actorAt(scene, a.id, t, propXs, a.m);
  const drawActor = (a: { id: string; m: CastMember; s: ActorState }) => {
    if (!a.s.visible) return;
    const look = script.looks[a.id] ?? { scale: 1, wide: false, extras: [] };
    const count = Math.min(a.m.count, 5);
    if (a.s.ladderX !== undefined) drawLadder(fb, a.s.ladderX);
    let top = GROUND;
    let sprColor: number = C.tan;
    // Things without legs sprout two little legs to walk (plan 6.8).
    const legs = a.s.sprout && a.m.rig !== 'biped' && a.m.rig !== 'quadruped' ? 4 : 0;
    for (let k = count - 1; k >= 0; k--) {
      const spr = spriteFor(a.m, look, { frame: a.s.frame + k, squash: a.s.squash, sprout: a.s.sprout });
      const x = a.s.x - k * 7 * a.s.facing, y = GROUND + a.s.y - (k % 2) - legs;
      if (legs) { const sw = a.s.frame % 2 ? 1 : -1; fb.rect(x - 3 + sw, y, 2, legs, C.darkGray); fb.rect(x + 1 - sw, y, 2, legs, C.darkGray); }
      const sinkPx = Math.round(a.s.sink * spr.h * 0.85);
      fb.blit(spr, x, y + sinkPx, a.s.facing === -1, a.s.ghost, sinkPx ? GROUND - 1 : H);
      top = Math.min(top, y + sinkPx - spr.ay);
      sprColor = spr.px[Math.floor(spr.h / 2) * spr.w + spr.ax] ?? C.tan;
      if (sprColor === 255 || sprColor === C.outline) sprColor = C.tan;
    }
    if (a.s.broken) drawCracks(fb, a.s.x, top);
    if (a.s.water) { fb.rect(a.s.x - 18, GROUND - 5, 36, 6, C.blue); for (let x = -18; x < 18; x += 4) fb.set(a.s.x + x + (Math.floor(t * 6) % 2) * 2, GROUND - 6, C.skyLight); }
    if (a.s.bush) drawBush(fb, a.s.x, t);
    if (!opts.calm) { drawFx(fb, a.s, top, t); drawAction(fb, a.s, top, t, sprColor); }
    else if (a.s.act === 'talk' || a.s.act === 'sing' || a.s.act === 'mix' || a.s.act === 'drink') drawAction(fb, a.s, top, t, sprColor);
    if (a.s.sparkle && !opts.calm) { fb.set(a.s.x - 8, top - 2, C.yellow); fb.set(a.s.x + 8, top, C.yellow); fb.set(a.s.x, top - 5, C.white); }
    if (a.s.poof && !opts.calm) { fb.ellipse(a.s.x - 4, GROUND - 10, 4, 3, C.white); drawStar(fb, a.s.x + 2, top - 6, C.yellow); }
    if (a.s.word) drawTextCentered(fb, a.s.word, a.s.x, Math.max(14, top - 11), C.yellow);
    else if (a.s.tags.length) drawTextCentered(fb, a.s.tags[0], a.s.x, Math.max(14, top - 11), C.white);
    else if (nounByWord.get(a.m.noun)?.proper) drawTextCentered(fb, a.m.noun.charAt(0).toUpperCase() + a.m.noun.slice(1), a.s.x, Math.max(14, top - 11), C.yellow); // a name: Mia, Vermont
    else if (nounByWord.get(a.m.noun)?.pack === 'custom') drawTextCentered(fb, a.m.noun, a.s.x, Math.max(14, top - 11), C.white); // a dictionary word: its name shows
  };
  for (const a of states) if (a.s.behind) drawActor(a);
  for (const p of scene.props) { const m = castById.get(p.castId); drawProp(fb, m, m ? script.looks[m.id] : undefined, p.x, GROUND); }
  for (const a of states) if (!a.s.behind) drawActor(a);
  const shout = scene.beats.find((b) => b.do === 'shout');
  if (shout && t >= shout.t && t < shout.t + shout.dur + 0.6 && shout.word) {
    const w = textWidth(shout.word) + 10;
    fb.ellipse(W / 2, 30, w / 2 + 3, 9, C.outline); fb.ellipse(W / 2, 30, w / 2 + 2, 8, C.orange);
    for (const [dx, dy] of [[-w / 2 - 4, -6], [w / 2 + 4, -6], [-w / 2 - 2, 8], [w / 2 + 2, 8]]) fb.set(W / 2 + dx, 30 + dy, C.orange);
    drawTextCentered(fb, shout.word, W / 2, 27, C.white);
  }
  if (scene.joinIcon && t > scene.duration / 2) drawTextCentered(fb, scene.joinIcon, W / 2, 44, C.white);
  for (const k of scene.knocks ?? []) if (t >= k && t < k + 0.25) for (const dy of [-22, -16, -10]) fb.rect(scene.props[0] ? scene.props[0].x - 11 : 100, GROUND + dy, 3, 1, C.white);
  const bubble = (scene.bubbles ?? []).find((b) => t >= b.t && t < b.t + b.dur);
  if (bubble) drawBubble(fb, bubble.text, bubble.x, 22);
  if (scene.bubbles) return; // dialogue scenes happen "now", with no time tag
  // Time on screen (plan 5.4).
  if (scene.tense === 'past') {
    for (let i = 0; i < fb.px.length; i++) fb.px[i] = SEPIA_OF[fb.px[i]];
    for (let y = 1; y < H; y += 2) for (let x = 0; x < W; x++) fb.px[y * W + x] = SEPIA_DARKER[fb.px[y * W + x]] ?? fb.px[y * W + x];
  }
  if (scene.tense !== 'present' && t < 0.7) {
    const flip = Math.floor(t * FPS) % 3;
    fb.rect(140, 14, 14, 13, C.outline); fb.rect(141, 15, 12, 11, C.white); fb.rect(141, 15, 12, 3, C.red);
    if (flip === 1) fb.rect(141, 18, 12, 4, C.lightGray);
  }
  const tag = scene.tense === 'past' ? 'Past' : scene.tense === 'future' ? 'Future' : 'Present';
  drawText(fb, tag, 15, 13, scene.tense === 'past' ? C.sepia0 : C.white);
  if (scene.tense === 'present') fb.ellipse(11, 16, 2, 2, C.red);
}

// One frame of the whole video at `time` seconds: curtains open, the
// scene, curtains close, the star stamp. 10.0 seconds at most.
// The scenes part of the timeline: one scene, or a whole story with a
// quick pixel dissolve between sentences (plan 5.5, 7.2).
const DISSOLVE = 0.3;
const scratch = new FB();
function drawBody(fb: FB, script: SceneScript, t: number, opts: RenderOpts) {
  let start = 0;
  for (let i = 0; i < script.scenes.length; i++) {
    const sc = script.scenes[i];
    const end = start + sc.duration;
    const last = i === script.scenes.length - 1;
    if (t < end || last) { drawScene(fb, script, sc, Math.min(Math.max(0, t - start), sc.duration), opts); return; }
    if (t < end + DISSOLVE) {
      // Pixel dissolve: the next scene appears dot by dot (calm: a cut).
      drawScene(fb, script, sc, sc.duration, opts);
      const next = script.scenes[i + 1];
      drawScene(scratch, script, next, 0, opts);
      const p = opts.calm ? 1 : (t - end) / DISSOLVE;
      for (let k = 0; k < fb.px.length; k++) if (((k * 2654435761) >>> 24) / 256 < p) fb.px[k] = scratch.px[k];
      return;
    }
    start = end + DISSOLVE;
  }
}
const bodyLength = (script: SceneScript) => script.scenes.reduce((a, sc) => a + sc.duration, 0) + DISSOLVE * (script.scenes.length - 1);

// One frame of the whole video at `time` seconds: curtains open, the
// scene (or every scene of a story), curtains close, the star stamp.
export function renderVideoFrame(fb: FB, script: SceneScript, time: number, opts: RenderOpts = {}) {
  const tq = Math.floor(time * FPS + 1e-6) / FPS;
  const { curtainsOpen, curtainsClose, stamp } = script.timing;
  const body = bodyLength(script);
  const sceneEnd = curtainsOpen + body;
  if (tq < curtainsOpen) { drawBody(fb, script, 0, opts); drawCurtains(fb, curtainOpenAt(tq / curtainsOpen, !!opts.calm)); return; }
  if (tq < sceneEnd) { drawBody(fb, script, tq - curtainsOpen, opts); drawCurtains(fb, 1); return; }
  if (tq < sceneEnd + curtainsClose) { drawBody(fb, script, body, opts); drawCurtains(fb, 1 - curtainOpenAt((tq - sceneEnd) / curtainsClose, !!opts.calm)); return; }
  drawCurtains(fb, 0);
  const k = clamp01((tq - sceneEnd - curtainsClose) / stamp);
  const shown = Math.max(1, Math.ceil(k * 3));
  [56, 80, 104].forEach((x, i) => { if (i < shown) drawStar(fb, x, 46, C.gold); });
}

export function videoLength(script: SceneScript) { return script.timing.total; }

// Closed curtains while waiting, with a pixel question mark when the
// machine needs a fix (plan 3.5).
export function renderWaiting(fb: FB, question: boolean) {
  fb.clear(C.outline);
  drawCurtains(fb, 0);
  if (question) { fb.ellipse(80, 47, 11, 11, C.gold); drawTextCentered(fb, '?', 80, 44, C.outline, null); }
}
