// Shape Dash (teacher 2026-10-06, "a geometry dash inspired native game. a
// question interupts students after 30 seconds or if they die/loose a
// life"; "Build the shape dash game" 2026-10-07). The player's shape runs
// on its own; one tap jumps. Pure game logic here (no drawing), so it can
// be tested: levels made of short obstacle patterns, simple physics, and
// what the player hit.

export const U = 48; // one block
export const GROUND_Y = 432; // top of the ground, in level pixels
export const VIEW_W = 960;
export const VIEW_H = 540;
export const PLAYER_X = 260; // where the player sits on screen
export const GRAVITY = 2500;
export const JUMP_V = 880; // jump height about 3 blocks, airtime about 0.7 s
export const PAD_V = 1180;

export type ThingKind = 'spike' | 'block' | 'gap' | 'coin' | 'pad' | 'checkpoint' | 'finish';
export interface Thing { kind: ThingKind; x: number; y: number; w: number; h: number; id: number; taken?: boolean }
export interface Level { n: number; speed: number; length: number; things: Thing[]; hue: number }

// A small seeded random, so a level is the same when it is replayed.
export function rngFrom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; };
}

// Each pattern is placed at x (its left edge). It returns its things and how wide it is.
type Pattern = (x: number, add: (t: Omit<Thing, 'id'>) => void, coin: boolean, speed: number) => number;
const spikeAt = (x: number, y = GROUND_Y): Omit<Thing, 'id'> => ({ kind: 'spike', x, y: y - U, w: U, h: U });
const blockAt = (x: number, rows: number, cols = 1): Omit<Thing, 'id'> => ({ kind: 'block', x, y: GROUND_Y - rows * U, w: cols * U, h: rows * U });
const coinAt = (x: number, y: number): Omit<Thing, 'id'> => ({ kind: 'coin', x, y, w: U * 0.7, h: U * 0.7 });
const PATTERNS: { min: number; make: Pattern }[] = [
  // One spike: jump it.
  { min: 1, make: (x, add, c) => { add(spikeAt(x)); if (c) add(coinAt(x + U * 0.15, GROUND_Y - U * 3)); return U; } },
  // A block to hop onto and run across.
  { min: 1, make: (x, add, c) => { add(blockAt(x, 1, 3)); if (c) add(coinAt(x + U * 1.15, GROUND_Y - U * 2.4)); return U * 3; } },
  // A small gap in the ground.
  { min: 1, make: (x, add) => { add({ kind: 'gap', x, y: GROUND_Y, w: U * 2, h: U * 3 }); return U * 2; } },
  // Two spikes side by side: jump a little early.
  { min: 2, make: (x, add, c) => { add(spikeAt(x)); add(spikeAt(x + U)); if (c) add(coinAt(x + U * 0.65, GROUND_Y - U * 3.2)); return U * 2; } },
  // Stairs: one block, then two blocks high.
  { min: 2, make: (x, add) => { add(blockAt(x, 1, 2)); add(blockAt(x + U * 2, 2, 2)); return U * 4; } },
  // A jump pad that throws you high over a wall of spikes.
  { min: 3, make: (x, add, c) => { add({ kind: 'pad', x, y: GROUND_Y - U * 0.3, w: U, h: U * 0.3 }); add(spikeAt(x + U * 2)); add(spikeAt(x + U * 3)); add(spikeAt(x + U * 4)); if (c) add(coinAt(x + U * 3.15, GROUND_Y - U * 5)); return U * 5; } },
  // A block with a spike on top of the far end.
  // The spike sits past where a jump onto the block lands, so there is time to jump again.
  { min: 3, make: (x, add, _c, speed) => { const air = Math.ceil((speed * 0.75) / U); add(blockAt(x, 1, air + 3)); add(spikeAt(x + U * (air + 1), GROUND_Y - U)); return U * (air + 3); } },
  // A wider gap.
  { min: 4, make: (x, add, c) => { add({ kind: 'gap', x, y: GROUND_Y, w: U * 3, h: U * 3 }); if (c) add(coinAt(x + U * 1.15, GROUND_Y - U * 3.3)); return U * 3; } },
  // Three spikes.
  { min: 5, make: (x, add) => { add(spikeAt(x)); add(spikeAt(x + U)); add(spikeAt(x + U * 2)); return U * 3; } },
];

// Level n: a little faster and a little longer each time. Level 1 starts
// slow on purpose (high support needs, Claudia's defaults).
export const speedFor = (n: number) => Math.min(420, 270 + (n - 1) * 22);
export function makeLevel(n: number, seed = n * 7919): Level {
  const rand = rngFrom(seed);
  const speed = speedFor(n);
  const things: Thing[] = [];
  let id = 1;
  const add = (t: Omit<Thing, 'id'>) => things.push({ ...t, id: id++ });
  const pool = PATTERNS.filter((p) => p.min <= n);
  const count = 9 + n * 3;
  let x = VIEW_W; // a calm runway first
  for (let i = 0; i < count; i++) {
    if (i > 0 && i % 4 === 0) add({ kind: 'checkpoint', x: x - U * 1.5, y: GROUND_Y - U * 2, w: U, h: U * 2 });
    const p = pool[Math.floor(rand() * pool.length)];
    x += p.make(x, add, rand() < 0.55, speed);
    // Room to land and get ready again: at least a second of running.
    x += speed * (1.05 + rand() * 0.6);
  }
  add({ kind: 'finish', x: x + U * 2, y: GROUND_Y - U * 4, w: U, h: U * 4 });
  return { n, speed, length: x + U * 6, things, hue: (n * 47) % 360 };
}

export interface Runner {
  x: number; y: number; vy: number; grounded: boolean; rot: number;
  checkpointX: number; invulnerable: number; holding: boolean; coyote: number; buffer: number;
}
export const newRunner = (x = PLAYER_X): Runner => ({ x, y: GROUND_Y - U, vy: 0, grounded: true, rot: 0, checkpointX: x, invulnerable: 0, holding: false, coyote: 0, buffer: 0 });

export type StepEvent = { kind: 'jump' | 'land' | 'coin' | 'checkpoint' | 'pad' | 'finish' | 'crash' | 'saved'; thing?: Thing; why?: 'spike' | 'block' | 'gap' };

// A shield (from a right answer after a crash) saves you once, then a
// moment of safety to get clear.
const useShield = (r: Runner, ev: StepEvent[]) => { if (r.invulnerable > 50) { r.invulnerable = 0.8; ev.push({ kind: 'saved' }); } };
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const inGap = (lv: Level, x0: number, x1: number) => lv.things.some((t) => t.kind === 'gap' && x0 >= t.x && x1 <= t.x + t.w);

// One physics step. jumpPressed is true for the frame a tap lands;
// holding keeps jumping on every landing (like Geometry Dash).
export function step(r: Runner, lv: Level, dt: number, jumpPressed: boolean): StepEvent[] {
  const ev: StepEvent[] = [];
  if (jumpPressed) r.buffer = 0.14; // a tap a moment early still counts
  r.buffer = Math.max(0, r.buffer - dt);
  r.invulnerable = Math.max(0, r.invulnerable - dt);
  const prevBottom = r.y + U;
  r.x += lv.speed * dt;
  r.vy += GRAVITY * dt;
  r.y += r.vy * dt;
  // Ground (unless over a gap) and block tops hold the player up.
  let support: number | null = null;
  if (!inGap(lv, r.x + U * 0.3, r.x + U * 0.7) && r.y + U >= GROUND_Y && prevBottom <= GROUND_Y + 14) support = GROUND_Y;
  const me = { x: r.x + 4, y: r.y, w: U - 8, h: U };
  for (const t of lv.things) {
    if (t.x > r.x + U * 2 || t.x + t.w < r.x - U) continue;
    if (t.kind === 'block') {
      if (!overlap(me, t)) continue;
      // Landing on top: we were above its top a moment ago.
      if (prevBottom <= t.y + 12 && r.vy >= 0) { support = Math.min(support ?? Infinity, t.y); continue; }
      if (r.invulnerable > 0) { useShield(r, ev); r.y = t.y - U; r.vy = 0; support = t.y; continue; }
      ev.push({ kind: 'crash', thing: t, why: 'block' });
      return ev;
    }
    if (t.kind === 'spike') {
      // A forgiving spike: only its middle hurts.
      const hurt = { x: t.x + t.w * 0.3, y: t.y + t.h * 0.35, w: t.w * 0.4, h: t.h * 0.65 };
      if (overlap({ x: r.x + 6, y: r.y + 6, w: U - 12, h: U - 10 }, hurt)) { if (r.invulnerable > 0) useShield(r, ev); else { ev.push({ kind: 'crash', thing: t, why: 'spike' }); return ev; } }
    }
    if (t.kind === 'coin' && !t.taken && overlap(me, t)) { t.taken = true; ev.push({ kind: 'coin', thing: t }); }
    if (t.kind === 'pad' && overlap(me, { ...t, y: t.y - 6, h: t.h + 6 }) && r.vy >= 0) { r.vy = -PAD_V; r.grounded = false; r.y = t.y - U - 1; ev.push({ kind: 'pad', thing: t }); }
    if (t.kind === 'checkpoint' && !t.taken && r.x >= t.x) { t.taken = true; r.checkpointX = t.x + U; ev.push({ kind: 'checkpoint', thing: t }); }
    if (t.kind === 'finish' && r.x >= t.x) { ev.push({ kind: 'finish', thing: t }); return ev; }
  }
  const wasGrounded = r.grounded;
  if (support !== null && r.vy >= 0) {
    r.y = support - U; r.vy = 0; r.grounded = true; r.coyote = 0.08;
    if (!wasGrounded) { r.rot = Math.round(r.rot / 90) * 90; ev.push({ kind: 'land' }); }
  } else { r.grounded = false; r.coyote = Math.max(0, r.coyote - dt); }
  if ((r.buffer > 0 || r.holding) && (r.grounded || r.coyote > 0) && r.vy >= 0) {
    r.vy = -JUMP_V; r.grounded = false; r.coyote = 0; r.buffer = 0; ev.push({ kind: 'jump' });
  }
  if (!r.grounded) r.rot += 400 * dt; // a quarter turn per jump, like Geometry Dash
  // Fell into a gap.
  if (r.y > GROUND_Y + U * 2.5) {
    if (r.invulnerable > 0) { // a shield carries you across the gap
      useShield(r, ev);
      const gap = lv.things.find((t) => t.kind === 'gap' && r.x + U > t.x && r.x < t.x + t.w + U);
      r.x = gap ? gap.x + gap.w + 4 : r.x; r.y = GROUND_Y - U; r.vy = 0; r.grounded = true;
    } else ev.push({ kind: 'crash', why: 'gap' });
  }
  return ev;
}

// Back at the last checkpoint, safe for a moment.
export function respawn(r: Runner, lv: Level, shielded: boolean): void {
  r.x = r.checkpointX; r.y = GROUND_Y - U; r.vy = 0; r.grounded = true; r.rot = 0; r.holding = false; r.buffer = 0;
  // Never respawn on a hazard.
  for (const t of lv.things) if ((t.kind === 'gap' || t.kind === 'spike' || t.kind === 'block') && r.x + U > t.x - U && r.x < t.x + t.w + U) r.x = t.x - U * 3;
  r.invulnerable = shielded ? 999 : 1.4; // the shield lasts until it saves you once
}

// Is the way ahead clear enough for a question break (the standard's
// "land between actions" pattern): on the ground, nothing close ahead.
export function safeForBreak(r: Runner, lv: Level): boolean {
  if (!r.grounded) return false;
  return !lv.things.some((t) => (t.kind === 'spike' || t.kind === 'block' || t.kind === 'gap' || t.kind === 'pad') && t.x > r.x && t.x < r.x + lv.speed * 1.1);
}

export const progressOf = (r: Runner, lv: Level) => Math.max(0, Math.min(1, (r.x - PLAYER_X) / (lv.length - PLAYER_X - U * 6)));
export const blocksRun = (r: Runner) => Math.max(0, Math.round((r.x - PLAYER_X) / U));
