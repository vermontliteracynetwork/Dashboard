import { FB, W, H } from './fb';
import { C, SEPIA_OF, SEPIA_DARKER } from './palette';
import { drawText, drawTextCentered, textWidth } from './font';
import { spriteFor, drawProp } from './rigs';
import type { Beat, Scene, SceneScript } from '../director/director';
import type { CastMember } from '../director/cast';

// The Pixel Cinema player (plan 3.17, 5.5, 6). Reads a scene script and
// draws one frame for a moment in time. Stepped at 12 frames per second,
// every position snapped to the pixel grid, red pixel curtains first.

export const FPS = 12;
export const GROUND = 72;
export interface RenderOpts { calm?: boolean }

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

interface ActorState { x: number; y: number; facing: 1 | -1; visible: boolean; frame: number; squash: 0 | 1 | 2; sprout: boolean; behind: boolean; ghost: boolean; moving: boolean; word?: string; tags: string[]; fx: string[]; sparkle: boolean; poof: boolean }

function actorAt(scene: Scene, id: string, t: number, propXs: number[]): ActorState {
  const st = scene.start[id] ?? { x: 80, facing: 1 as const };
  const s: ActorState = { x: st.x, y: 0, facing: st.facing, visible: true, frame: 0, squash: 0, sprout: false, behind: false, ghost: false, moving: false, tags: [], fx: [], sparkle: false, poof: false };
  const enter = scene.beats.find((b) => b.do === 'enter');
  if (enter && enter.who.includes(id)) { s.visible = t >= enter.t; s.sparkle = t >= enter.t && t < enter.t + Math.min(0.35, enter.dur); }
  const firstAct = scene.beats.find((b) => b.do !== 'enter' && b.do !== 'shout' && b.do !== 'settle' && (b.who.includes(id) || b.target === id));
  s.ghost = scene.tense === 'future' && (!firstAct || t < firstAct.t);
  for (const b of scene.beats) {
    if (t < b.t) break;
    const p = clamp01((t - b.t) / b.dur);
    const active = p < 1;
    if (b.who.includes(id)) moveBy(s, b, p, active, t, propXs);
    else if (b.target === id) reactTo(s, b, p, st.x);
  }
  return s;
}

function moveBy(s: ActorState, b: Beat, p: number, active: boolean, t: number, propXs: number[]) {
  const x0 = b.x0 ?? s.x, x1 = b.x1 ?? s.x;
  if (active) { s.fx = b.fx; s.tags = b.tags; }
  switch (b.do) {
    case 'run': case 'walk': case 'chase': {
      s.x = lerp(x0, x1, p); s.moving = active && x0 !== x1;
      if (x1 !== x0) s.facing = x1 > x0 ? 1 : -1;
      s.frame = Math.floor(Math.abs(s.x - x0) / (b.do === 'walk' ? 4 : 3));
      if (s.moving) s.y = -(s.frame % 2);
      const px = propXs.find((q) => Math.abs(q - s.x) < 12);
      if (px !== undefined && active) {
        if (b.path === 'over') s.y -= Math.round(Math.cos(((s.x - px) / 12) * (Math.PI / 2)) * 16);
        if (b.path === 'under' || b.path === 'through' || b.path === 'behind' || b.path === 'around') s.behind = true;
      }
      if (!active && (b.path === 'behind')) s.behind = true;
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
    case 'wiggle': {
      if (active) { s.x += Math.floor(t * 6) % 2 ? 1 : -1; s.word = b.word; s.sprout = !!b.sprout; s.frame = Math.floor(t * 6); }
      break;
    }
    default: break;
  }
  if (active && b.sprout) { s.sprout = true; s.frame = Math.floor(t * 8); }
}

function reactTo(s: ActorState, b: Beat, p: number, startX: number) {
  if (b.do === 'chase') { s.x = startX + p * 26; s.facing = 1; s.moving = p < 1; s.frame = Math.floor(p * 26 / 3); s.y = s.moving ? -(s.frame % 2) : 0; }
  if (b.do === 'pounce' && p > 0.7) { const q = (p - 0.7) / 0.3; s.x = startX + q * 12; s.y = -Math.round(Math.sin(Math.PI * Math.min(1, q)) * 6); s.poof = p < 1; }
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

function drawFx(fb: FB, a: ActorState, top: number) {
  const back = a.facing === 1 ? -1 : 1;
  if (a.moving && a.fx.includes('speedLines')) for (const [dy, len] of [[-6, 6], [-11, 8], [-16, 5]]) fb.rect(Math.min(a.x + back * 12, a.x + back * (12 + len)), GROUND + a.y + dy, len, 1, C.white);
  if (a.moving && a.fx.includes('dust') && a.frame % 2 === 0) { fb.ellipse(a.x + back * 10, GROUND - 1, 2, 1.5, C.lightGray); fb.ellipse(a.x + back * 14, GROUND - 2, 1.5, 1.2, C.lightGray); }
  if (a.moving && a.fx.includes('effort')) { const k = a.frame % 2; fb.rect(a.x - 3 + k, top - 4, 1, 2, C.outline); fb.rect(a.x + 2 - k, top - 5, 1, 2, C.outline); }
  if (a.moving && a.fx.includes('snail')) { const sx = a.x + back * 16; fb.ellipse(sx, GROUND - 2, 2, 2, C.tan); fb.rect(sx - 3, GROUND - 1, 6, 1, C.lightGray); }
  if (a.fx.includes('stars') && a.moving) drawStar(fb, a.x + 6, top - 4, C.yellow);
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

function drawScene(fb: FB, script: SceneScript, scene: Scene, t: number, opts: RenderOpts) {
  const castById = new Map(script.cast.map((m) => [m.id, m]));
  drawBackdrop(fb);
  const propXs = scene.props.map((p) => p.x);
  const actorIds = Object.keys(scene.start);
  const states = actorIds.map((id) => ({ id, m: castById.get(id)!, s: actorAt(scene, id, t, propXs) })).filter((a) => a.m);
  const drawActor = (a: { id: string; m: CastMember; s: ActorState }) => {
    if (!a.s.visible) return;
    const look = script.looks[a.id] ?? { scale: 1, wide: false, extras: [] };
    const count = Math.min(a.m.count, 5);
    let top = GROUND;
    for (let k = count - 1; k >= 0; k--) {
      const spr = spriteFor(a.m, look, { frame: a.s.frame + k, squash: a.s.squash, sprout: a.s.sprout });
      const x = a.s.x - k * 7 * a.s.facing, y = GROUND + a.s.y - (k % 2);
      fb.blit(spr, x, y, a.s.facing === -1, a.s.ghost);
      top = Math.min(top, y - spr.ay);
    }
    if (!opts.calm) drawFx(fb, a.s, top);
    if (a.s.sparkle && !opts.calm) { fb.set(a.s.x - 8, top - 2, C.yellow); fb.set(a.s.x + 8, top, C.yellow); fb.set(a.s.x, top - 5, C.white); }
    if (a.s.poof && !opts.calm) { fb.ellipse(a.s.x - 4, GROUND - 10, 4, 3, C.white); drawStar(fb, a.s.x + 2, top - 6, C.yellow); }
    if (a.s.word) drawTextCentered(fb, a.s.word, a.s.x, Math.max(14, top - 11), C.yellow);
    else if (a.s.tags.length) drawTextCentered(fb, a.s.tags[0], a.s.x, Math.max(14, top - 11), C.white);
  };
  for (const a of states) if (a.s.behind) drawActor(a);
  for (const p of scene.props) drawProp(fb, castById.get(p.castId)?.noun ?? 'thing', p.x, GROUND);
  for (const a of states) if (!a.s.behind) drawActor(a);
  const shout = scene.beats.find((b) => b.do === 'shout');
  if (shout && t >= shout.t && t < shout.t + shout.dur + 0.6 && shout.word) {
    const w = textWidth(shout.word) + 10;
    fb.ellipse(W / 2, 30, w / 2 + 3, 9, C.outline); fb.ellipse(W / 2, 30, w / 2 + 2, 8, C.orange);
    for (const [dx, dy] of [[-w / 2 - 4, -6], [w / 2 + 4, -6], [-w / 2 - 2, 8], [w / 2 + 2, 8]]) fb.set(W / 2 + dx, 30 + dy, C.orange);
    drawTextCentered(fb, shout.word, W / 2, 27, C.white);
  }
  if (scene.joinIcon && t > scene.duration / 2) drawTextCentered(fb, scene.joinIcon, W / 2, 44, C.white);
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
  const tag = scene.tense === 'past' ? 'YESTERDAY' : scene.tense === 'future' ? 'TOMORROW' : 'NOW';
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
