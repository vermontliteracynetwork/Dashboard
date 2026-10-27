// World Box (Build Queue 369, named in 371; her brief in docs/measure-wilds/BRIEF.md): a nature sandbox run by made-up creatures.
// The student only watches and predicts measurements; predictions never change what the creatures do.
// Phase 1 (her Build Notes): one habitat (Earth), one species, turf claiming with perimeter and area predictions,
// coins for accurate predictions. Everything here is plain data so new question kinds plug in as one more entry in
// EVENTS, and every value carries its unit so conversion questions can be made from it later.

export type LengthUnit = 'm' | 'ft' | 'yd';
export const UNIT_NAME: Record<LengthUnit, { one: string; many: string }> = {
  m: { one: 'meter', many: 'meters' }, ft: { one: 'foot', many: 'feet' }, yd: { one: 'yard', many: 'yards' },
};
// A measured value with its unit: "blocks" for counts on the grid, a length unit, or that unit squared.
export type Measure = { value: number; unit: 'blocks' | 'cubes' | 'food' | LengthUnit | `sq ${LengthUnit}` | `cu ${LengthUnit}` };
export const unitWords = (u: Measure['unit']) => (u === 'blocks' ? 'blocks' : u === 'cubes' ? 'cubic blocks' : u === 'food' ? 'food' : u.startsWith('sq ') ? `square ${UNIT_NAME[u.slice(3) as LengthUnit].many}` : u.startsWith('cu ') ? `cubic ${UNIT_NAME[u.slice(3) as LengthUnit].many}` : UNIT_NAME[u as LengthUnit].many);
export const unitShort = (u: Measure['unit']) => (u.startsWith('sq ') ? `${u.slice(3)}²` : u.startsWith('cu ') ? `${u.slice(3)}³` : u === 'cubes' ? 'cubic blocks' : u);

// Build Queue 378 ("make space (grid expandable and bigger in size)"): the land is no longer a fixed 16 by 10 box.
// It starts 24 by 16 and grows by 6 blocks on a side whenever the pack's turf comes near that edge, up to 72 by 48.
// Cells can go below 0 as the land grows north and west.
export const COLS = 16, ROWS = 10; // the smallest close-up view
export const START_MAP = { x0: -4, y0: -3, x1: 19, y1: 12 };
export const MAX_W = 72, MAX_H = 48, GROW = 6, NEAR = 3;
export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Cell = string; // "x,y"
const key = (x: number, y: number) => `${x},${y}`;
export const xy = (c: Cell) => c.split(',').map(Number) as [number, number];

// Build Queue 379 ("add different biomes that connect (such as desert)"): every block of land belongs to a biome.
// The biomes flow into each other (smooth noise, so the borders wiggle and blend): meadow around the den, desert to
// the east, snow to the north, forest to the west, wetland to the south, with rocky hills scattered between.
// Each biome grows a different amount of food a block, so the food questions become multiply and add.
export type BiomeId = 'meadow' | 'forest' | 'desert' | 'wetland' | 'snow' | 'hills';
export const BIOMES: Record<BiomeId, { name: string; word: string; food: number; ground: [number, number, number] }> = {
  meadow: { name: 'Meadow', word: 'meadow grass', food: 2, ground: [181, 211, 138] },
  forest: { name: 'Forest', word: 'forest floor', food: 3, ground: [122, 170, 92] },
  desert: { name: 'Desert', word: 'desert sand', food: 1, ground: [234, 208, 146] },
  wetland: { name: 'Wetland', word: 'wetland mud', food: 3, ground: [134, 192, 170] },
  snow: { name: 'Snowfield', word: 'snow', food: 1, ground: [236, 242, 246] },
  hills: { name: 'Rocky Hills', word: 'rocky ground', food: 1, ground: [184, 178, 150] },
};
const h3 = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function noise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h3(xi, yi, s), b = h3(xi + 1, yi, s), c = h3(xi, yi + 1, s), d = h3(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const biomeCache = new Map<string, BiomeId>();
export function biomeAt(seed: number, x: number, y: number): BiomeId {
  const k = `${seed}:${x},${y}`;
  const hit = biomeCache.get(k); if (hit) return hit;
  const dx = x - 7, dy = y - 4.5;
  let out: BiomeId = 'meadow';
  if (dx * dx + dy * dy * 1.6 > 34) {
    const n = (i: number) => noise(x / 6, y / 6, seed + i * 101);
    const scores: [BiomeId, number][] = [
      ['meadow', 0.62], ['desert', dx * 0.045 + n(1)], ['forest', -dx * 0.045 + n(2)],
      ['snow', -dy * 0.07 + n(3)], ['wetland', dy * 0.07 + n(4)], ['hills', n(5) * 0.95 - 0.08],
    ];
    out = scores.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
  biomeCache.set(k, out);
  return out;
}

// The species of Phase 1: an invented burrowing creature with real adaptations for living on and under the ground.
export const SPECIES = {
  name: 'Burrowback', many: 'Burrowbacks',
  traits: ['Wide digging claws for loose soil', 'A thick tail that stores fat for winter', 'Small ears that keep out dirt'],
  eats: 3, // food each one eats a day
};
export const FENCE_IQ = 5; // intelligence points before they can build a fence

// Build Queue 380 (domestication): a creature the student has tamed, and how far each of its traits is upgraded.
export type Trait = 'speed' | 'strength' | 'smarts';
// Build Queue 385 ("make the domestication similar to in habitation such as zoos"): a tame creature lives in its own
// fenced zoo pen on the land, beside the wild pack's turf.
export interface Creature { id: string; name: string; size: number; power: number; smart: number; young?: boolean; tame?: boolean; lv?: Partial<Record<Trait, number>>; pen?: Rect }
export interface World {
  turf: Cell[]; side: number; unit: LengthUnit; pack: Creature[]; iq: number; fenced: string | null;
  day: number; milestones: string[]; log: string[];
  seed: number; map: Rect; biomes: BiomeId[]; dens?: number; water?: number;
}
const NAMES = ['Pip', 'Moss', 'Tumble', 'Fern', 'Dusk', 'Clover', 'Burr', 'Rook', 'Sorrel', 'Wren', 'Thistle', 'Nib', 'Bramble', 'Hazel', 'Pebble', 'Sprout'];
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

export function newWorld(): World {
  const turf: Cell[] = [];
  for (let x = 6; x < 9; x++) for (let y = 4; y < 6; y++) turf.push(key(x, y));
  const pack: Creature[] = NAMES.slice(0, 3).map((name, i) => ({ id: `c${i}`, name, size: [1.2, 1, 0.95][i], power: [9, 6, 5][i], smart: [5, 7, 4][i] }));
  return { turf, side: 1, unit: 'm', pack, iq: 0, fenced: null, day: 1, milestones: [], log: [], seed: rnd(1, 9999), map: { ...START_MAP }, biomes: ['meadow'] };
}
// Worlds saved before Build Queue 378 get the bigger land and biomes; their turf sits inside it unchanged.
export const migrate = (w: World): World => ({ ...w, seed: w.seed ?? 7, map: w.map ?? { ...START_MAP }, biomes: w.biomes ?? ['meadow'] });

// The land grows by GROW blocks on any side the turf comes within NEAR blocks of, up to MAX_W by MAX_H.
export function grow(map: Rect, turf: Cell[]): Rect {
  const b = bounds(turf), m = { ...map };
  if (b.x1 > m.x1 - NEAR && m.x1 - m.x0 + 1 + GROW <= MAX_W) m.x1 += GROW;
  if (b.x0 < m.x0 + NEAR && m.x1 - m.x0 + 1 + GROW <= MAX_W) m.x0 -= GROW;
  if (b.y1 > m.y1 - NEAR && m.y1 - m.y0 + 1 + GROW <= MAX_H) m.y1 += GROW;
  if (b.y0 < m.y0 + NEAR && m.y1 - m.y0 + 1 + GROW <= MAX_H) m.y0 -= GROW;
  return m;
}
// How many blocks of each biome a set of cells covers, biggest first.
export function biomeCount(w: World, cells: Cell[]): [BiomeId, number][] {
  const n = new Map<BiomeId, number>();
  for (const c of cells) { const [x, y] = xy(c); const b = biomeAt(w.seed, x, y); n.set(b, (n.get(b) ?? 0) + 1); }
  return [...n.entries()].sort((a, b) => b[1] - a[1]);
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
export const foodPerDay = (w: World) => biomeCount(w, w.turf).reduce((n, [b, k]) => n + k * BIOMES[b].food, 0);
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
  const b = bounds(w.turf), s = new Set([...w.turf, ...penCells(w)]), m = w.map;
  const opts: { cells: Cell[]; dir: string }[] = [];
  const depth = rnd(1, 2);
  const span = (a: number, z: number) => { const len = z - a + 1; const take = Math.random() < 0.6 ? len : rnd(Math.max(1, Math.ceil(len / 2)), len); const start = a + rnd(0, len - take); return [start, start + take - 1]; };
  if (b.x1 + depth <= m.x1) { const [y0, y1] = span(b.y0, b.y1); const c: Cell[] = []; for (let x = b.x1 + 1; x <= b.x1 + depth; x++) for (let y = y0; y <= y1; y++) c.push(key(x, y)); opts.push({ cells: c, dir: 'east' }); }
  if (b.x0 - depth >= m.x0) { const [y0, y1] = span(b.y0, b.y1); const c: Cell[] = []; for (let x = b.x0 - depth; x < b.x0; x++) for (let y = y0; y <= y1; y++) c.push(key(x, y)); opts.push({ cells: c, dir: 'west' }); }
  if (b.y1 + depth <= m.y1) { const [x0, x1] = span(b.x0, b.x1); const c: Cell[] = []; for (let y = b.y1 + 1; y <= b.y1 + depth; y++) for (let x = x0; x <= x1; x++) c.push(key(x, y)); opts.push({ cells: c, dir: 'south' }); }
  if (b.y0 - depth >= m.y0) { const [x0, x1] = span(b.x0, b.x1); const c: Cell[] = []; for (let y = b.y0 - depth; y < b.y0; y++) for (let x = x0; x <= x1; x++) c.push(key(x, y)); opts.push({ cells: c, dir: 'north' }); }
  const ok = opts.map((o) => ({ ...o, cells: o.cells.filter((c) => !s.has(c)) })).filter((o) => o.cells.length);
  return ok.length ? pick(ok) : null;
}

const L = (w: World) => UNIT_NAME[w.unit].many;
const sideText = (w: World) => `${w.side} ${w.side === 1 ? UNIT_NAME[w.unit].one : L(w)}`;

const expandQ = (w: World): Question | null => {
  const s = strip(w); if (!s) return null;
  const next = [...w.turf, ...s.cells];
  const a = alphaOf(w);
  const mix = biomeCount(w, s.cells);
  const fresh = mix.map(([b]) => b).filter((b) => !w.biomes.includes(b));
  const what = mix.length === 1 ? `${s.cells.length} more blocks of ${BIOMES[mix[0][0]].word}` : `${s.cells.length} more blocks: ${mix.map(([b, k]) => `${k} of ${BIOMES[b].word}`).join(' and ')}`;
  const story = `${a.name}, the alpha, leads the ${SPECIES.many} ${s.dir}. They are claiming ${what}.`;
  const found = fresh.length ? ` They reached the ${fresh.map((b) => `${BIOMES[b].name} (${BIOMES[b].food} food a block)`).join(' and the ')} for the first time!` : '';
  const apply = (x: World): World => ({ ...x, turf: next, map: grow(x.map, next), biomes: [...x.biomes, ...fresh.filter((b) => !x.biomes.includes(b))],
    log: [...x.log, `Day ${x.day}: the pack claimed land to the ${s.dir}.${found}`] });
  if (Math.random() < 0.5) {
    const ab = areaBlocks(next);
    return { kind: 'area', story, ask: `Each block is ${sideText(w)} on each side. What will the area of the new turf be?`, answer: { value: ab * w.side * w.side, unit: `sq ${w.unit}` }, ghost: s.cells,
      hint: w.side === 1 ? `Count the blocks: ${ab} blocks, each 1 square ${UNIT_NAME[w.unit].one}.` : `${ab} blocks, each ${w.side} × ${w.side} = ${w.side * w.side} square ${L(w)}. ${ab} × ${w.side * w.side} = ${ab * w.side * w.side}.`,
      apply, after: `The new turf covers ${ab * w.side * w.side} square ${L(w)}.${found}` };
  }
  const pb = perimeterBlocks(next);
  return { kind: 'perimeter', story, ask: `Each block side is ${sideText(w)}. How far is it all the way around the new turf?`, answer: { value: pb * w.side, unit: w.unit }, ghost: s.cells,
    hint: w.side === 1 ? `Count every outside edge: ${pb} edges of 1 ${UNIT_NAME[w.unit].one}.` : `${pb} outside edges, each ${w.side} ${L(w)}: ${pb} × ${w.side} = ${pb * w.side}.`,
    apply, after: `It is ${pb * w.side} ${L(w)} all the way around.${found}` };
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
  const mix = biomeCount(w, w.turf), total = foodPerDay(w);
  const parts = mix.map(([b, k]) => `${k} blocks of ${BIOMES[b].word} (${BIOMES[b].food} food each)`);
  const sums = mix.map(([b, k]) => `${k} × ${BIOMES[b].food} = ${k * BIOMES[b].food}`);
  return { kind: 'food', story: `The ${SPECIES.many} graze their turf. Each biome grows a different amount of food a day.`,
    ask: `The turf has ${parts.join(' and ')}. How much food grows in one day?`, answer: { value: total, unit: 'food' },
    hint: mix.length === 1 ? `${sums[0]}.` : `${sums.join(', ')}. Add them: ${mix.map(([b, k]) => k * BIOMES[b].food).join(' + ')} = ${total}.`,
    apply: (x) => x, after: `${total} food grows each day, and the pack eats ${foodNeed(w)}.` };
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

// ---- Build Queue 388: volume, and area and perimeter worked backward ----
// Her words: "world box is used to teach area, perimeter, volume ... make sure questions are changed in the world box game".
const denQ = (w: World): Question => {
  const l = rnd(2, 4), d = rnd(2, 3), h = rnd(1, 3), v = l * d * h;
  const cubic = w.side === 1;
  return { kind: 'volume', story: `The pack digs a new den under the ground. It is ${l} blocks long, ${d} blocks wide and ${h} ${h === 1 ? 'block' : 'blocks'} deep.`,
    ask: `How much dirt do they dig out?${cubic ? ' Each block is 1 cubic meter.' : ''}`, answer: { value: v, unit: cubic ? `cu ${w.unit}` : 'cubes' },
    hint: `Volume = length × width × depth: ${l} × ${d} × ${h} = ${v}.`,
    apply: (x) => ({ ...x, dens: (x.dens ?? 0) + 1, log: [...x.log, `Day ${x.day}: the pack dug a den of ${v} cubic blocks.`] }),
    after: `They dug out ${v} ${cubic ? `cubic ${L(w)}` : 'cubic blocks'} of dirt. The den is ready for winter.` };
};
const troughQ = (w: World): Question => {
  const l = rnd(2, 5), d = rnd(1, 2), h = rnd(1, 2), v = l * d * h;
  return { kind: 'volume', story: `It is hot and dry. ${alphaOf(w).name} digs a water hole ${l} meters long, ${d} ${d === 1 ? 'meter' : 'meters'} wide and ${h} ${h === 1 ? 'meter' : 'meters'} deep, and rain fills it to the top.`,
    ask: 'How many cubic meters of water does the water hole hold?', answer: { value: v, unit: 'cu m' },
    hint: `${l} × ${d} × ${h} = ${v} cubic meters.`,
    apply: (x) => ({ ...x, water: (x.water ?? 0) + v, log: [...x.log, `Day ${x.day}: the pack filled a water hole with ${v} cubic meters of water.`] }),
    after: `The water hole holds ${v} cubic meters of water. Everyone gets a drink.` };
};
const sideQ = (w: World): Question => {
  const l = rnd(3, 8), d = rnd(2, 6), a = l * d;
  return { kind: 'side', story: `The pack wants a sunny napping patch shaped like a rectangle. It must cover ${a} square ${L(w)}, and one side is ${l} ${L(w)} long.`,
    ask: 'How long is the other side?', answer: { value: d, unit: w.unit },
    hint: `Area = length × width, so width = area ÷ length: ${a} ÷ ${l} = ${d}.`,
    apply: (x) => x, after: `The napping patch is ${l} by ${d}. Everyone fits for a nap in the sun.` };
};
const lapQ = (w: World): Question => {
  const l = rnd(3, 9), d = rnd(2, 6), p = 2 * (l + d);
  return { kind: 'side', story: `The young ones race around a rectangle of grass. One lap is ${p} ${L(w)}, and the long side is ${l} ${L(w)}.`,
    ask: 'How long is the short side?', answer: { value: d, unit: w.unit },
    hint: `Two long sides are ${l} + ${l} = ${2 * l}. ${p} - ${2 * l} = ${p - 2 * l}, and half of that is ${d}.`,
    apply: (x) => x, after: `The short side is ${d} ${L(w)}. What a race!` };
};

let lastKind = '';
// The creatures choose what happens next: hungry packs scout for land, fed packs grow, smart packs fence.
// Build Queue 388: the same kind of question never comes twice in a row, and volume and working-backward
// questions are in the mix.
export function nextQuestion(w: World): Question {
  for (let i = 0; i < 6; i++) { const q = chooseQuestion(w); if (q.kind !== lastKind || i === 5) { lastKind = q.kind; return q; } }
  return foodQ(w);
}
function chooseQuestion(w: World): Question {
  if (areaBlocks(w.turf) < 10) return expandQ(w) ?? foodQ(w); // a new pack claims land first
  const f = fenceQ(w); if (f && Math.random() < 0.6) return f;
  if (stressed(w)) return expandQ(w) ?? foodQ(w);
  const r = Math.random();
  if (r < 0.22) return birthQ(w) ?? expandQ(w) ?? foodQ(w);
  if (r < 0.48) return expandQ(w) ?? foodQ(w);
  if (r < 0.62) return denQ(w);
  if (r < 0.72) return troughQ(w);
  if (r < 0.8) return sideQ(w);
  if (r < 0.88) return lapQ(w);
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

// ---- Build Queue 385: zoo pens ----
export const rectCells = (r: Rect): Cell[] => { const out: Cell[] = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) out.push(key(x, y)); return out; };
export const penCells = (w: World, skip?: string) => w.pack.filter((c) => c.pen && c.id !== skip).flatMap((c) => rectCells(c.pen!));
export const penSize = (r: Rect) => ({ w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 });
// A free spot for a pen pw by ph: outside the turf (with a gap of one block), away from other pens, inside the land.
export function findPen(w: World, pw: number, ph: number, skip?: string, near?: Rect): Rect | null {
  const turf = new Set(w.turf), taken = new Set(penCells(w, skip)), m = w.map, b = near ?? bounds(w.turf);
  const ok = (r: Rect) => r.x0 >= m.x0 && r.y0 >= m.y0 && r.x1 <= m.x1 && r.y1 <= m.y1 && rectCells({ x0: r.x0 - 1, y0: r.y0 - 1, x1: r.x1 + 1, y1: r.y1 + 1 }).every((c) => !turf.has(c) && !taken.has(c));
  for (let ring = 0; ring < 30; ring++) {
    const spots: Rect[] = [];
    for (let x = b.x0 - ring - pw; x <= b.x1 + ring + 1; x++) for (const y of [b.y0 - ring - ph, b.y1 + ring + 1]) spots.push({ x0: x, y0: y, x1: x + pw - 1, y1: y + ph - 1 });
    for (let y = b.y0 - ring - ph; y <= b.y1 + ring + 1; y++) for (const x of [b.x0 - ring - pw, b.x1 + ring + 1]) spots.push({ x0: x, y0: y, x1: x + pw - 1, y1: y + ph - 1 });
    const good = spots.filter(ok);
    if (good.length) return near ? good[0] : pick(good);
  }
  return null;
}
// Zoo visitors come each day to see the tame creatures: 1 coin for each one, plus 1 for each upgrade level.
export const zooCoins = (w: World) => w.pack.filter((c) => c.tame).reduce((n, c) => n + 1 + TRAIT_LIST.reduce((k, t) => k + lvOf(c, t), 0), 0);

// ---- Build Queue 380: domestication ----
// Her words: "add domestication (upgrading animals by answering questions)". The student tames a creature by building
// it a pen, then upgrades its Speed, Strength and Smarts up to 3 levels each. Every step is one measurement question
// about a rectangle the creature uses, and only an exact answer upgrades it (a miss shows how, then a new question).
export const MAX_LV = 3;
export const TRAITS: Record<Trait, { name: string; icon: string; does: string }> = {
  speed: { name: 'Speed', icon: '💨', does: 'runs faster around the turf' },
  strength: { name: 'Strength', icon: '💪', does: 'grows bigger and gets 2 more power' },
  smarts: { name: 'Smarts', icon: '💡', does: 'gets 2 more smarts and gives the pack 1 intelligence point' },
};
export const lvOf = (c: Creature, t: Trait) => c.lv?.[t] ?? 0;
const TRAIT_LIST: Trait[] = ['speed', 'strength', 'smarts'];
// The pen or track the question is about, drawn as a small grid on the card.
export interface TameQuestion extends Question { pen: { w: number; h: number } }

export function upgrade(w: World, id: string, trait: Trait | null, pen?: Rect | null): World {
  return { ...w, iq: w.iq + (trait === 'smarts' ? 1 : 0), pack: w.pack.map((c) => {
    if (c.id !== id) return c;
    if (!trait) return { ...c, tame: true, pen: pen ?? c.pen };
    if (trait === 'strength' && pen) c = { ...c, pen };
    const lv = { ...c.lv, [trait]: lvOf(c, trait) + 1 };
    return { ...c, lv, power: c.power + (trait === 'strength' ? 2 : 0), smart: c.smart + (trait === 'smarts' ? 2 : 0) };
  }), log: [...w.log, `Day ${w.day}: ${w.pack.find((c) => c.id === id)?.name} ${trait ? `went up a level in ${TRAITS[trait].name}` : 'was tamed'}.`] };
}

// A bigger pen for a Strength upgrade: one block longer if there is room, or one block wider.
function biggerPen(w: World, c: Creature): Rect | null {
  const p = c.pen; if (!p) return null;
  const { w: pw, h: ph } = penSize(p);
  for (const r of [{ ...p, x1: p.x1 + 1 }, { ...p, x0: p.x0 - 1 }, { ...p, y1: p.y1 + 1 }, { ...p, y0: p.y0 - 1 }]) {
    const turf = new Set(w.turf), taken = new Set(penCells(w, c.id)), m = w.map;
    if (r.x0 >= m.x0 && r.y0 >= m.y0 && r.x1 <= m.x1 && r.y1 <= m.y1 && rectCells(r).every((x) => !turf.has(x) && !taken.has(x))) return r;
  }
  return findPen(w, pw + 1, ph, c.id, p);
}

export function tameQuestion(w: World, c: Creature, trait: Trait | null): TameQuestion {
  const lv = trait ? lvOf(c, trait) : 0, s = w.side, u = L(w);
  let pen: Rect | null = c.pen ?? null;
  if (!trait) pen = findPen(w, rnd(3, 4), rnd(2, 3));
  if (trait === 'strength') pen = biggerPen(w, c) ?? pen;
  const { w: pw, h: ph } = pen ? penSize(pen) : { w: rnd(3, 4), h: rnd(2, 3) };
  const apply = (x: World) => upgrade(x, c.id, trait, pen);
  const per = 2 * (pw + ph);
  if (!trait) return { kind: 'tame', pen: { w: pw, h: ph }, story: `${c.name} is ready to move into your zoo. You are building ${c.name} a pen ${pw} blocks long and ${ph} blocks wide, next to the pack.`,
    ask: 'One fence block covers one block edge. How many fence blocks go all the way around the pen?', answer: { value: per, unit: 'blocks' },
    hint: `${pw} + ${ph} + ${pw} + ${ph} = ${per}.`, apply, after: `${c.name} moved into the zoo. ${c.name} is tamed! Zoo visitors will come to see ${c.name} every day.` };
  if (trait === 'speed') return { kind: 'tame', pen: { w: pw, h: ph }, story: `${c.name} trains by running laps along the fence of the zoo pen, ${pw} blocks long and ${ph} blocks wide. Each block side is ${sideText(w)}.`,
    ask: 'How far is one lap all the way around the pen?', answer: { value: per * s, unit: w.unit },
    hint: s === 1 ? `${pw} + ${ph} + ${pw} + ${ph} = ${per} ${u}.` : `${per} block edges, each ${s} ${u}: ${per} × ${s} = ${per * s}.`, apply, after: `${c.name} ran the lap. Speed is now level ${lv + 1}!` };
  if (trait === 'strength') return { kind: 'tame', pen: { w: pw, h: ph }, story: `${c.name} is getting bigger, so the zoo pen grows to ${pw} blocks long and ${ph} blocks wide. Each block is ${sideText(w)} on each side.`,
    ask: 'What is the area of the new pen?', answer: { value: pw * ph * s * s, unit: `sq ${w.unit}` },
    hint: s === 1 ? `${pw} × ${ph} = ${pw * ph} square ${u}.` : `${pw} × ${ph} = ${pw * ph} blocks, each ${s * s} square ${u}: ${pw * ph} × ${s * s} = ${pw * ph * s * s}.`, apply, after: `${c.name} has a bigger pen. Strength is now level ${lv + 1}!` };
  return { kind: 'tame', pen: { w: pw, h: ph }, story: `${c.name} is learning to plan. ${c.name} hides one treat on every block of the zoo pen, ${pw} blocks long and ${ph} blocks wide.`,
    ask: 'How many treats does it take to cover the pen?', answer: { value: pw * ph, unit: 'blocks' },
    hint: `${pw} rows of ${ph}: ${pw} × ${ph} = ${pw * ph}.`, apply, after: `${c.name} found every treat. Smarts is now level ${lv + 1}!` };
}
