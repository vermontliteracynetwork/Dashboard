// Wild Measures (Build Queue 369, her brief in docs/measure-wilds/BRIEF.md): a nature sandbox run by made-up creatures.
// The student only watches and predicts measurements; predictions never change what the creatures do.
// Phase 1 (her Build Notes): one habitat (Earth), one species, turf claiming with perimeter and area predictions,
// coins for accurate predictions. Everything here is plain data so new question kinds plug in as one more entry in
// EVENTS, and every value carries its unit so conversion questions can be made from it later.

export type LengthUnit = 'm' | 'ft' | 'yd';
export const UNIT_NAME: Record<LengthUnit, { one: string; many: string }> = {
  m: { one: 'meter', many: 'meters' }, ft: { one: 'foot', many: 'feet' }, yd: { one: 'yard', many: 'yards' },
};
// A measured value with its unit: "blocks" for counts on the grid, a length unit, or that unit squared.
export type Measure = { value: number; unit: 'blocks' | 'food' | LengthUnit | `sq ${LengthUnit}` };
export const unitWords = (u: Measure['unit']) => (u === 'blocks' ? 'blocks' : u === 'food' ? 'food' : u.startsWith('sq ') ? `square ${UNIT_NAME[u.slice(3) as LengthUnit].many}` : UNIT_NAME[u as LengthUnit].many);
export const unitShort = (u: Measure['unit']) => (u.startsWith('sq ') ? `${u.slice(3)}²` : u);

export const COLS = 16, ROWS = 10;
export type Cell = string; // "x,y"
const key = (x: number, y: number) => `${x},${y}`;
const xy = (c: Cell) => c.split(',').map(Number) as [number, number];

// The species of Phase 1: an invented burrowing creature with real adaptations for living on and under the ground.
export const SPECIES = {
  name: 'Burrowback', many: 'Burrowbacks',
  traits: ['Wide digging claws for loose soil', 'A thick tail that stores fat for winter', 'Small ears that keep out dirt'],
  eats: 3, // food each one eats a day
};
export const FOOD_PER_BLOCK = 2; // food one grass block grows each day
export const FENCE_IQ = 5; // intelligence points before they can build a fence

export interface Creature { id: string; name: string; size: number; power: number; smart: number; young?: boolean }
export interface World {
  turf: Cell[]; side: number; unit: LengthUnit; pack: Creature[]; iq: number; fenced: string | null;
  day: number; milestones: string[]; log: string[];
}
const NAMES = ['Pip', 'Moss', 'Tumble', 'Fern', 'Dusk', 'Clover', 'Burr', 'Rook', 'Sorrel', 'Wren', 'Thistle', 'Nib', 'Bramble', 'Hazel', 'Pebble', 'Sprout'];
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export function newWorld(): World {
  const turf: Cell[] = [];
  for (let x = 6; x < 9; x++) for (let y = 4; y < 6; y++) turf.push(key(x, y));
  const pack: Creature[] = NAMES.slice(0, 3).map((name, i) => ({ id: `c${i}`, name, size: [1.2, 1, 0.95][i], power: [9, 6, 5][i], smart: [5, 7, 4][i] }));
  return { turf, side: 1, unit: 'm', pack, iq: 0, fenced: null, day: 1, milestones: [], log: [] };
}
// The alpha leads the pack: the most powerful, with smarts breaking a tie (her brief: the alpha can change).
export const alphaOf = (w: World) => w.pack.reduce((a, c) => (c.power + c.smart * 0.5 > a.power + a.smart * 0.5 ? c : a), w.pack[0]);

// ---- measuring the turf ----
export const areaBlocks = (cells: Cell[]) => cells.length;
export function perimeterBlocks(cells: Cell[]) {
  const s = new Set(cells); let n = 0;
  for (const c of cells) { const [x, y] = xy(c); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!s.has(key(x + dx, y + dy))) n++; }
  return n;
}
export const bounds = (cells: Cell[]) => {
  const ps = cells.map(xy); const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
export const foodPerDay = (w: World) => areaBlocks(w.turf) * FOOD_PER_BLOCK;
export const foodNeed = (w: World) => w.pack.reduce((n, c) => n + (c.young ? 2 : SPECIES.eats), 0);
// Territory pressure (her brief): too little turf for the pack means stress, and stressed creatures stop breeding.
export const stressed = (w: World) => foodPerDay(w) < foodNeed(w);
export const fenceWhole = (w: World) => w.fenced === [...w.turf].sort().join('|');

// ---- the creatures' own choices, each paused for a prediction ----
export interface Question {
  kind: string;
  story: string; // what the creatures are doing (shown and read before the question)
  ask: string;
  answer: Measure;
  ghost?: Cell[]; // cells about to change, drawn dashed while the student predicts
  hint: string; // how to work it out, shown with the true answer
  apply: (w: World) => World; // the outcome, the same whatever the student predicted
  after: string; // what happened, shown on reveal
}

// A strip of new turf on one side: the creatures choose where to scout.
function strip(w: World): { cells: Cell[]; dir: string } | null {
  const b = bounds(w.turf), s = new Set(w.turf);
  const opts: { cells: Cell[]; dir: string }[] = [];
  const depth = rnd(1, 2);
  const span = (a: number, z: number) => { const len = z - a + 1; const take = Math.random() < 0.6 ? len : rnd(Math.max(1, Math.ceil(len / 2)), len); const start = a + rnd(0, len - take); return [start, start + take - 1]; };
  if (b.x1 + depth < COLS) { const [y0, y1] = span(b.y0, b.y1); const c: Cell[] = []; for (let x = b.x1 + 1; x <= b.x1 + depth; x++) for (let y = y0; y <= y1; y++) c.push(key(x, y)); opts.push({ cells: c, dir: 'east' }); }
  if (b.x0 - depth >= 0) { const [y0, y1] = span(b.y0, b.y1); const c: Cell[] = []; for (let x = b.x0 - depth; x < b.x0; x++) for (let y = y0; y <= y1; y++) c.push(key(x, y)); opts.push({ cells: c, dir: 'west' }); }
  if (b.y1 + depth < ROWS) { const [x0, x1] = span(b.x0, b.x1); const c: Cell[] = []; for (let y = b.y1 + 1; y <= b.y1 + depth; y++) for (let x = x0; x <= x1; x++) c.push(key(x, y)); opts.push({ cells: c, dir: 'south' }); }
  if (b.y0 - depth >= 0) { const [x0, x1] = span(b.x0, b.x1); const c: Cell[] = []; for (let y = b.y0 - depth; y < b.y0; y++) for (let x = x0; x <= x1; x++) c.push(key(x, y)); opts.push({ cells: c, dir: 'north' }); }
  const ok = opts.map((o) => ({ ...o, cells: o.cells.filter((c) => !s.has(c)) })).filter((o) => o.cells.length);
  return ok.length ? pick(ok) : null;
}

const L = (w: World) => UNIT_NAME[w.unit].many;
const sideText = (w: World) => `${w.side} ${w.side === 1 ? UNIT_NAME[w.unit].one : L(w)}`;

const expandQ = (w: World): Question | null => {
  const s = strip(w); if (!s) return null;
  const next = [...w.turf, ...s.cells];
  const a = alphaOf(w);
  const story = `${a.name}, the alpha, leads the ${SPECIES.many} ${s.dir}. They are claiming ${s.cells.length} more blocks of grass.`;
  const apply = (x: World): World => ({ ...x, turf: next, log: [...x.log, `Day ${x.day}: the pack claimed land to the ${s.dir}.`] });
  if (Math.random() < 0.5) {
    const ab = areaBlocks(next);
    return { kind: 'area', story, ask: `Each block is ${sideText(w)} on each side. What will the area of the new turf be?`, answer: { value: ab * w.side * w.side, unit: `sq ${w.unit}` }, ghost: s.cells,
      hint: w.side === 1 ? `Count the blocks: ${ab} blocks, each 1 square ${UNIT_NAME[w.unit].one}.` : `${ab} blocks, each ${w.side} × ${w.side} = ${w.side * w.side} square ${L(w)}. ${ab} × ${w.side * w.side} = ${ab * w.side * w.side}.`,
      apply, after: `The new turf covers ${ab * w.side * w.side} square ${L(w)}.` };
  }
  const pb = perimeterBlocks(next);
  return { kind: 'perimeter', story, ask: `Each block side is ${sideText(w)}. How far is it all the way around the new turf?`, answer: { value: pb * w.side, unit: w.unit }, ghost: s.cells,
    hint: w.side === 1 ? `Count every outside edge: ${pb} edges of 1 ${UNIT_NAME[w.unit].one}.` : `${pb} outside edges, each ${w.side} ${L(w)}: ${pb} × ${w.side} = ${pb * w.side}.`,
    apply, after: `It is ${pb * w.side} ${L(w)} all the way around.` };
};

const fenceQ = (w: World): Question | null => {
  if (w.iq < FENCE_IQ || fenceWhole(w)) return null;
  const pb = perimeterBlocks(w.turf);
  const fix = w.fenced !== null;
  return { kind: 'fence', story: fix ? `The turf grew, so the fence has gaps. The ${SPECIES.many} are rebuilding it all the way around.` : `The ${SPECIES.many} are smart enough to build now. They are putting a fence all the way around their turf.`,
    ask: 'One fence block covers one block edge. How many fence blocks will go all the way around?', answer: { value: pb, unit: 'blocks' },
    hint: `Walk around the outside and count each edge: ${pb}.`,
    apply: (x) => ({ ...x, fenced: [...x.turf].sort().join('|'), log: [...x.log, `Day ${x.day}: the pack fenced their turf with ${pb} fence blocks.`] }),
    after: `They used ${pb} fence blocks. The turf is closed in.` };
};

const foodQ = (w: World): Question => {
  const ab = areaBlocks(w.turf);
  return { kind: 'food', story: `The ${SPECIES.many} graze their turf. Every block of grass grows ${FOOD_PER_BLOCK} food a day.`,
    ask: `The turf has ${ab} blocks of grass. How much food grows in one day?`, answer: { value: ab * FOOD_PER_BLOCK, unit: 'food' },
    hint: `${ab} blocks × ${FOOD_PER_BLOCK} food = ${ab * FOOD_PER_BLOCK}.`,
    apply: (x) => x, after: `${ab * FOOD_PER_BLOCK} food grows each day, and the pack eats ${foodNeed(w)}.` };
};

// When the pack is calm and fed, a baby is born (stressed packs stop breeding).
const birthQ = (w: World): Question | null => {
  if (stressed(w) || w.pack.length >= NAMES.length) return null;
  const name = NAMES[w.pack.length];
  const need = foodNeed(w) + 2;
  return { kind: 'need', story: `A baby ${SPECIES.name} named ${name} is born. A baby eats 2 food a day; each grown ${SPECIES.name} eats ${SPECIES.eats}.`,
    ask: `The pack ate ${foodNeed(w)} food a day. How much food will they need each day now?`, answer: { value: need, unit: 'food' },
    hint: `${foodNeed(w)} + 2 = ${need}.`,
    apply: (x) => ({ ...x, pack: [...x.pack, { id: `c${x.pack.length}`, name, size: 0.65, power: rnd(3, 6), smart: rnd(3, 8), young: true }], log: [...x.log, `Day ${x.day}: ${name} was born.`] }),
    after: `${name} joined the pack. They need ${need} food a day now.` };
};

// The creatures choose what happens next: hungry packs scout for land, fed packs grow, smart packs fence.
export function nextQuestion(w: World): Question {
  if (areaBlocks(w.turf) < 10) return expandQ(w) ?? foodQ(w); // a new pack claims land first
  const f = fenceQ(w); if (f && Math.random() < 0.6) return f;
  if (stressed(w)) return expandQ(w) ?? foodQ(w);
  const r = Math.random();
  if (r < 0.4) return birthQ(w) ?? expandQ(w) ?? foodQ(w);
  if (r < 0.8) return expandQ(w) ?? foodQ(w);
  return foodQ(w);
}

// Things the pack does on its own between questions: a new day, milestones that earn intelligence, the young growing.
export function passDay(w: World): { world: World; news: string | null } {
  let news: string | null = null;
  const x: World = { ...w, day: w.day + 1, pack: w.pack.map((c) => (c.young && Math.random() < 0.25 ? { ...c, young: false, size: 0.9 } : c)) };
  if (!x.milestones.includes('fire') && x.day >= 3) { x.milestones = [...x.milestones, 'fire']; x.iq += 3; news = `${alphaOf(x).name} made fire! The ${SPECIES.many} earned 3 intelligence points.`; }
  else if (!x.milestones.includes('tools') && x.day >= 5) { x.milestones = [...x.milestones, 'tools']; x.iq += 2; news = `The ${SPECIES.many} built digging tools from sticks and stones. 2 more intelligence points!`; }
  if (news) x.log = [...x.log, `Day ${x.day}: ${news}`];
  return { world: x, news };
}

// Accuracy: exactly right earns 3 coins, within a tenth earns 1. The creatures never change because of it.
export function score(guess: number, truth: number): { coins: number; label: 'exact' | 'close' | 'miss' } {
  if (guess === truth) return { coins: 3, label: 'exact' };
  if (Math.abs(guess - truth) <= Math.max(1, truth * 0.1)) return { coins: 1, label: 'close' };
  return { coins: 0, label: 'miss' };
}
// Her tiers: 10 right predictions, then 15 more, then 20 more. The rewards are placeholders until she picks them.
export const TIERS = [
  { at: 10, name: 'Quick skill: Swift Paws', does: 'The pack runs faster across their turf.' },
  { at: 25, name: 'Skill: Night Eyes', does: 'The pack can scout in the dark.' },
  { at: 45, name: 'Cool reward: Glowing Den', does: 'Their den glows at night.' },
];
// Bigger blocks once the student is ready, so multiplication joins counting.
export const sideFor = (exact: number) => (exact >= 14 ? 5 : exact >= 6 ? 2 : 1);
