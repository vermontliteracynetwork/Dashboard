// World Box, version 2 (Build Queue 391 and 392). Her words: "the borrow back animals should change to domesticated and
// wild animals. questions should support learning (area, perimiter, volume) though students should be able to make
// creatures, domestication, etc. explore the biomes in one map view, grid style top down" and "lets have a top down map
// (mountains,) think minecraft biomes (creatues can leave their standard) -- the main difference between supernature and
// world box is the supernautre has a more fantastical feel and world box is more animals on a turf. in world box, walls
// and builsings can be created like fences (volume per fence, perimiter of area or biome, expanding biomes, area of barns,
// area of zoo enclosures) ratio of creatures per section, etc. -- world box is math driven".
//
// The world is a top-down grid of blocky biomes. Real wild animals roam it and can wander out of their home biome. The
// student builds fences, barns, coops, zoo pens and stone walls, explores more map, brings in farm animals and tames
// wild ones. Every build and every change in the world is one measurement question: perimeter, area, volume, a missing
// side, or a ratio of animals per section. Everything is plain data so new question kinds plug in as one more function.

export type LengthUnit = 'm' | 'ft' | 'yd';
export const UNIT_NAME: Record<LengthUnit, { one: string; many: string }> = {
  m: { one: 'meter', many: 'meters' }, ft: { one: 'foot', many: 'feet' }, yd: { one: 'yard', many: 'yards' },
};
export type Unit = 'blocks' | 'cubes' | 'animals' | LengthUnit | `sq ${LengthUnit}` | `cu ${LengthUnit}`;
export type Measure = { value: number; unit: Unit };
export const unitWords = (u: Unit) => (u === 'blocks' ? 'blocks' : u === 'cubes' ? 'cubic blocks' : u === 'animals' ? 'animals'
  : u.startsWith('sq ') ? `square ${UNIT_NAME[u.slice(3) as LengthUnit].many}` : u.startsWith('cu ') ? `cubic ${UNIT_NAME[u.slice(3) as LengthUnit].many}` : UNIT_NAME[u as LengthUnit].many);
export const unitShort = (u: Unit) => (u.startsWith('sq ') ? `${u.slice(3)}²` : u.startsWith('cu ') ? `${u.slice(3)}³` : u === 'cubes' ? 'cubic blocks' : u);

export type Rect = { x0: number; y0: number; x1: number; y1: number };
export type Cell = string; // "x,y"
export const key = (x: number, y: number) => `${x},${y}`;
export const xy = (c: Cell) => c.split(',').map(Number) as [number, number];
export const rectW = (r: Rect) => r.x1 - r.x0 + 1, rectH = (r: Rect) => r.y1 - r.y0 + 1;
export const rectCells = (r: Rect): Cell[] => { const o: Cell[] = []; for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) o.push(key(x, y)); return o; };
const overlap = (a: Rect, b: Rect) => a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1;
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

// ---- the map ----
export const START_MAP: Rect = { x0: -16, y0: -10, x1: 15, y1: 9 };
export const MAX_W = 96, MAX_H = 64, GROW = 6;
export type BiomeId = 'meadow' | 'forest' | 'desert' | 'wetland' | 'snow' | 'hills' | 'mountain' | 'lake';
export const BIOMES: Record<BiomeId, { name: string; word: string; color: [number, number, number]; walk: boolean }> = {
  meadow: { name: 'Meadow', word: 'meadow', color: [124, 189, 79], walk: true },
  forest: { name: 'Forest', word: 'forest', color: [62, 132, 52], walk: true },
  desert: { name: 'Desert', word: 'desert', color: [232, 207, 140], walk: true },
  wetland: { name: 'Wetland', word: 'wetland', color: [96, 160, 120], walk: true },
  snow: { name: 'Snowfield', word: 'snowfield', color: [236, 242, 247], walk: true },
  hills: { name: 'Rocky Hills', word: 'hills', color: [150, 158, 112], walk: true },
  mountain: { name: 'Mountains', word: 'mountains', color: [128, 128, 134], walk: false },
  lake: { name: 'Lake', word: 'lake', color: [70, 132, 214], walk: false },
};
export const h3 = (x: number, y: number, s: number) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function noise(x: number, y: number, s: number) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = h3(xi, yi, s), b = h3(xi + 1, yi, s), c = h3(xi, yi + 1, s), d = h3(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Height of the land (0 to 1): high ground makes mountains, low ground fills with lakes.
export const heightAt = (seed: number, x: number, y: number) => noise(x / 9, y / 9, seed + 7) * 0.7 + noise(x / 3.5, y / 3.5, seed + 11) * 0.3;
const cache = new Map<string, BiomeId>();
// Biomes flow like Minecraft: meadow around the start, desert to the east, snow to the north, forest to the west,
// wetland to the south, hills between, mountains on high ground and lakes in low ground.
export function natureAt(seed: number, x: number, y: number): BiomeId {
  const k = `${seed}:${x},${y}`; const hit = cache.get(k); if (hit) return hit;
  const near = x * x + y * y * 1.6 < 40, e = heightAt(seed, x, y);
  let out: BiomeId = 'meadow';
  if (!near && e > 0.74) out = 'mountain';
  else if (!near && e < 0.2) out = 'lake';
  else if (!near) {
    const n = (i: number) => noise(x / 7, y / 7, seed + i * 101);
    const scores: [BiomeId, number][] = [['meadow', 0.62], ['desert', x * 0.04 + n(1)], ['forest', -x * 0.04 + n(2)], ['snow', -y * 0.06 + n(3)], ['wetland', y * 0.06 + n(4)], ['hills', n(5) * 0.9 - 0.05]];
    out = scores.reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  }
  cache.set(k, out);
  return out;
}

// ---- animals ----
export type Home = 'barn' | 'coop' | 'pasture' | 'zoo';
export interface Species { id: string; name: string; many: string; icon: string; wild: boolean; home: BiomeId[]; space: number; lives: Home; price: number; swims?: boolean; climbs?: boolean; fact: string }
// space: square blocks one animal needs in its building (for the ratio questions).
export const SPECIES: Species[] = [
  { id: 'rabbit', name: 'Rabbit', many: 'Rabbits', icon: '🐇', wild: true, home: ['meadow', 'hills'], space: 1, lives: 'zoo', price: 0, fact: 'Rabbits dig burrows to stay safe.' },
  { id: 'deer', name: 'Deer', many: 'Deer', icon: '🦌', wild: true, home: ['forest', 'meadow'], space: 4, lives: 'zoo', price: 0, fact: 'Deer eat leaves, grass and acorns.' },
  { id: 'fox', name: 'Fox', many: 'Foxes', icon: '🦊', wild: true, home: ['forest', 'snow'], space: 3, lives: 'zoo', price: 0, fact: 'Foxes hear tiny animals under the snow.' },
  { id: 'wolf', name: 'Wolf', many: 'Wolves', icon: '🐺', wild: true, home: ['forest', 'snow'], space: 4, lives: 'zoo', price: 0, fact: 'Wolves live and travel in packs.' },
  { id: 'bear', name: 'Bear', many: 'Bears', icon: '🐻', wild: true, home: ['forest', 'hills'], space: 6, lives: 'zoo', price: 0, fact: 'Bears sleep through much of the winter.' },
  { id: 'camel', name: 'Camel', many: 'Camels', icon: '🐫', wild: true, home: ['desert'], space: 6, lives: 'zoo', price: 0, fact: 'Camels store fat in their humps for long trips.' },
  { id: 'lizard', name: 'Lizard', many: 'Lizards', icon: '🦎', wild: true, home: ['desert'], space: 1, lives: 'zoo', price: 0, fact: 'Lizards warm up in the sun.' },
  { id: 'duck', name: 'Duck', many: 'Ducks', icon: '🦆', wild: true, home: ['wetland', 'lake'], space: 1, lives: 'zoo', price: 0, swims: true, fact: 'Ducks have oily feathers that keep them dry.' },
  { id: 'frog', name: 'Frog', many: 'Frogs', icon: '🐸', wild: true, home: ['wetland'], space: 1, lives: 'zoo', price: 0, fact: 'Frogs start life as tadpoles in the water.' },
  { id: 'penguin', name: 'Penguin', many: 'Penguins', icon: '🐧', wild: true, home: ['snow'], space: 2, lives: 'zoo', price: 0, swims: true, fact: 'Penguins huddle together to stay warm.' },
  { id: 'goat', name: 'Mountain goat', many: 'Mountain goats', icon: '🐐', wild: true, home: ['mountain', 'hills'], space: 2, lives: 'zoo', price: 0, climbs: true, fact: 'Mountain goats climb steep rocks with grippy hooves.' },
  { id: 'cow', name: 'Cow', many: 'Cows', icon: '🐄', wild: false, home: ['meadow'], space: 4, lives: 'barn', price: 6, fact: 'Cows chew their food twice.' },
  { id: 'horse', name: 'Horse', many: 'Horses', icon: '🐎', wild: false, home: ['meadow'], space: 6, lives: 'barn', price: 8, fact: 'Horses can sleep standing up.' },
  { id: 'pig', name: 'Pig', many: 'Pigs', icon: '🐖', wild: false, home: ['meadow'], space: 2, lives: 'barn', price: 4, fact: 'Pigs roll in mud to stay cool.' },
  { id: 'sheep', name: 'Sheep', many: 'Sheep', icon: '🐑', wild: false, home: ['meadow'], space: 2, lives: 'pasture', price: 4, fact: 'A sheep grows a new wool coat every year.' },
  { id: 'chicken', name: 'Chicken', many: 'Chickens', icon: '🐓', wild: false, home: ['meadow'], space: 1, lives: 'coop', price: 2, fact: 'Chickens can remember over 100 faces.' },
];
export const SP = (id: string) => SPECIES.find((s) => s.id === id)!;
export const NAMES = ['Pip', 'Moss', 'Fern', 'Dusk', 'Clover', 'Rook', 'Wren', 'Hazel', 'Pebble', 'Sprout', 'Maple', 'Juniper', 'Biscuit', 'Daisy', 'Pepper', 'Willow', 'Acorn', 'Blue', 'Sunny', 'Cocoa', 'Ziggy', 'Luna', 'Thistle', 'Nutmeg'];
export interface Animal { id: string; kind: string; name: string; x: number; y: number; tame?: boolean; at?: string; lv?: number }

// ---- buildings ----
export type BuildType = 'pasture' | 'barn' | 'coop' | 'zoo' | 'wall';
export const BUILD: Record<BuildType, { name: string; icon: string; holds: string; minW: number; maxW: number; minH: number; maxH: number }> = {
  pasture: { name: 'Fenced pasture', icon: '🪵', holds: 'sheep, cows and horses', minW: 2, maxW: 10, minH: 2, maxH: 8 },
  barn: { name: 'Barn', icon: '🏚️', holds: 'cows, horses and pigs', minW: 2, maxW: 8, minH: 2, maxH: 6 },
  coop: { name: 'Chicken coop', icon: '🐓', holds: 'chickens', minW: 1, maxW: 4, minH: 1, maxH: 3 },
  zoo: { name: 'Zoo enclosure', icon: '🦓', holds: 'tamed wild animals', minW: 2, maxW: 10, minH: 2, maxH: 8 },
  wall: { name: 'Stone wall', icon: '🧱', holds: 'nothing: it keeps wild animals out', minW: 2, maxW: 14, minH: 1, maxH: 4 },
};
// A wall is one block thick; its "h" is how many blocks high it is stacked, so it covers a single row of the map.
export interface Building { id: string; type: BuildType; r: Rect; high?: number; name: string }
export const holdsIn = (t: BuildType, s: Species) => (t === 'zoo' ? s.wild : t === 'pasture' ? ['sheep', 'cow', 'horse'].includes(s.id) : t === 'barn' ? ['cow', 'horse', 'pig'].includes(s.id) : t === 'coop' ? s.id === 'chicken' : false);
export const areaOf = (b: Building) => rectW(b.r) * rectH(b.r);
export const usedSpace = (w: World, b: Building) => w.animals.filter((a) => a.at === b.id).reduce((n, a) => n + SP(a.kind).space, 0);

export interface World {
  v: 2; seed: number; map: Rect; day: number; side: number; unit: LengthUnit;
  animals: Animal[]; buildings: Building[]; paint: Record<Cell, BiomeId>; found: BiomeId[]; log: string[];
}
export const biomeAt = (w: Pick<World, 'seed' | 'paint'>, x: number, y: number): BiomeId => w.paint[key(x, y)] ?? natureAt(w.seed, x, y);
export const walkable = (w: World, x: number, y: number, s?: Species) => {
  const b = biomeAt(w, x, y);
  return x >= w.map.x0 && x <= w.map.x1 && y >= w.map.y0 && y <= w.map.y1 && (BIOMES[b].walk || (b === 'lake' && !!s?.swims) || (b === 'mountain' && !!s?.climbs));
};
const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
export const buildingAt = (w: World, x: number, y: number) => w.buildings.find((b) => inRect(b.r, x, y));

let nid = 0;
const id = (p: string) => `${p}${Date.now().toString(36)}${(nid++).toString(36)}`;
function cellsOf(w: World, ids: BiomeId[], r: Rect = w.map) {
  const out: [number, number][] = [];
  for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) if (ids.includes(biomeAt(w, x, y)) && !buildingAt(w, x, y)) out.push([x, y]);
  return out;
}
const unusedName = (w: World) => NAMES.find((n) => !w.animals.some((a) => a.name === n)) ?? `${pick(NAMES)} ${w.animals.length}`;
// Wild animals for every species whose home biome is on this part of the map.
function spawnWild(w: World, r: Rect): Animal[] {
  const out: Animal[] = [];
  for (const s of SPECIES.filter((x) => x.wild)) {
    const spots = cellsOf(w, s.home, r); if (spots.length < 4) continue;
    for (let i = 0; i < rnd(2, 3); i++) { const [x, y] = pick(spots); out.push({ id: id('a'), kind: s.id, name: '', x, y }); }
  }
  return out;
}
export function newWorld(): World {
  const w: World = { v: 2, seed: rnd(1, 9999), map: { ...START_MAP }, day: 1, side: 1, unit: 'm', animals: [], buildings: [], paint: {}, found: [], log: [] };
  w.animals = spawnWild(w, w.map);
  w.found = [...new Set(rectCells(w.map).map((c) => biomeAt(w, ...xy(c))))];
  return w;
}

// Animals wander one block at a time. Wild ones mostly stay in their home biome but sometimes wander out (her words:
// "creatues can leave their standard"); walls and buildings stop them. Animals in a building stay inside it.
export function wander(w: World): Animal[] {
  return w.animals.map((a) => {
    if (Math.random() < 0.45) return a;
    const s = SP(a.kind), b = a.at ? w.buildings.find((x) => x.id === a.at) : null;
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [a.x + dx, a.y + dy] as [number, number]).filter(([x, y]) => (b ? inRect(b.r, x, y) : walkable(w, x, y, s) && !buildingAt(w, x, y)));
    if (!opts.length) return a;
    const home = opts.filter(([x, y]) => s.home.includes(biomeAt(w, x, y)));
    const [x, y] = !b && home.length && Math.random() < 0.8 ? pick(home) : pick(opts);
    return { ...a, x, y };
  });
}

// ---- questions ----
export interface Question {
  kind: string; story: string; ask: string; answer: Measure; hint: string; after: string;
  apply: (w: World) => World; // the outcome, the same whatever the student answered
  mark?: Rect | Cell[]; // the part of the map the question is about, outlined while they answer
  shape?: { w: number; h: number; d?: number }; // a small diagram on the card
}
const L = (w: World) => UNIT_NAME[w.unit].many;
const sideText = (w: World) => `${w.side} ${w.side === 1 ? UNIT_NAME[w.unit].one : L(w)}`;

// Building something: one question about the thing being built.
export function buildQuestion(w: World, type: BuildType, r: Rect, high = 1): Question {
  const bw = rectW(r), bh = rectH(r), s = w.side, u = L(w), info = BUILD[type];
  const b: Building = { id: id('b'), type, r, high: type === 'wall' ? high : undefined, name: `${info.name} ${w.buildings.filter((x) => x.type === type).length + 1}` };
  const apply = (x: World): World => ({ ...x, buildings: [...x.buildings, b], animals: x.animals.map((a) => (!a.at && inRect(r, a.x, a.y) ? { ...a, ...nudge(x, a, r) } : a)), log: [...x.log, `Day ${x.day}: built a ${info.name.toLowerCase()} ${bw} by ${bh}.`] });
  const per = 2 * (bw + bh), area = bw * bh;
  if (type === 'wall') {
    const len = Math.max(bw, bh), v = len * high;
    return { kind: 'volume', mark: r, shape: { w: len, h: high, d: 1 }, story: `You are building a stone wall ${len} blocks long, ${high} ${high === 1 ? 'block' : 'blocks'} high and 1 block thick. Each stone is one cubic block.`,
      ask: 'How many stone cubes does the wall need?', answer: { value: v, unit: 'cubes' }, hint: `Volume = length × height × thickness: ${len} × ${high} × 1 = ${v}.`, apply, after: `The wall is up: ${v} stone cubes. Wild animals walk around it.` };
  }
  if (type === 'pasture') return { kind: 'perimeter', mark: r, shape: { w: bw, h: bh }, story: `You are fencing a pasture ${bw} blocks long and ${bh} blocks wide. Each fence piece covers one block edge.`,
    ask: 'How many fence pieces go all the way around?', answer: { value: per, unit: 'blocks' }, hint: `${bw} + ${bh} + ${bw} + ${bh} = ${per}.`, apply, after: `The pasture has ${per} fence pieces. Sheep, cows and horses can graze in it.` };
  if (type === 'zoo') return { kind: 'perimeter', mark: r, shape: { w: bw, h: bh }, story: `You are building a zoo enclosure ${bw} blocks long and ${bh} blocks wide. Each block side is ${sideText(w)}.`,
    ask: `How many ${u} of zoo fence go all the way around?`, answer: { value: per * s, unit: w.unit }, hint: s === 1 ? `${bw} + ${bh} + ${bw} + ${bh} = ${per} ${u}.` : `${per} block edges × ${s} ${u} = ${per * s}.`, apply, after: `The zoo enclosure is ready. Tap a wild animal to tame it and bring it here.` };
  return { kind: 'area', mark: r, shape: { w: bw, h: bh }, story: `You are building a ${info.name.toLowerCase()} ${bw} blocks long and ${bh} blocks wide. Each block is ${sideText(w)} on each side.`,
    ask: `What is the floor area of the ${info.name.toLowerCase()}?`, answer: { value: area * s * s, unit: `sq ${w.unit}` },
    hint: s === 1 ? `${bw} × ${bh} = ${area} square ${u}.` : `${bw} × ${bh} = ${area} blocks, each ${s * s} square ${u}: ${area} × ${s * s} = ${area * s * s}.`, apply, after: `The ${info.name.toLowerCase()} is built: ${area * s * s} square ${u} of floor.` };
}
// Move a wild animal out of a spot that is now built on.
function nudge(w: World, a: Animal, r: Rect) {
  for (let d = 1; d < 12; d++) for (const [x, y] of [[r.x0 - d, a.y], [r.x1 + d, a.y], [a.x, r.y0 - d], [a.x, r.y1 + d]]) if (walkable(w, x, y, SP(a.kind)) && !buildingAt(w, x, y)) return { x, y };
  return { x: a.x, y: a.y };
}
export function canPlace(w: World, r: Rect): string | null {
  const m = w.map;
  if (r.x0 < m.x0 || r.y0 < m.y0 || r.x1 > m.x1 || r.y1 > m.y1) return 'That runs off the edge of the map.';
  if (w.buildings.some((b) => overlap(b.r, r))) return 'Something is already built there.';
  if (rectCells(r).some((c) => !BIOMES[biomeAt(w, ...xy(c))].walk)) return 'You cannot build on a lake or a mountain.';
  return null;
}

// How many animals fit: a ratio question before bringing animals into a building.
export function fitQuestion(w: World, b: Building, s: Species): Question {
  const area = areaOf(b), fits = Math.floor(area / s.space), here = w.animals.filter((a) => a.at === b.id).length;
  return { kind: 'ratio', mark: b.r, shape: { w: rectW(b.r), h: rectH(b.r) }, story: `The ${b.name.toLowerCase()} is ${rectW(b.r)} by ${rectH(b.r)} blocks. Each ${s.name.toLowerCase()} needs ${s.space} square ${s.space === 1 ? 'block' : 'blocks'} of space.`,
    ask: `How many ${s.many.toLowerCase()} fit in it?`, answer: { value: fits, unit: 'animals' },
    hint: `Area ${rectW(b.r)} × ${rectH(b.r)} = ${area}. ${area} ÷ ${s.space} = ${fits}${area % s.space ? ` (with ${area % s.space} left over)` : ''}.`,
    apply: (x) => x, after: `${fits} ${fits === 1 ? s.name.toLowerCase() : s.many.toLowerCase()} fit${here ? `, and ${here} ${here === 1 ? 'animal is' : 'animals are'} already in it` : ''}.` };
}
export const roomFor = (w: World, b: Building, s: Species) => holdsIn(b.type, s) && areaOf(b) - usedSpace(w, b) >= s.space;
export function addAnimal(w: World, s: Species, b: Building | null, name: string, from?: Animal): World {
  const r = b?.r;
  const a: Animal = from ? { ...from, tame: true, at: b?.id, name: name || from.name || unusedName(w), x: r ? rnd(r.x0, r.x1) : from.x, y: r ? rnd(r.y0, r.y1) : from.y }
    : { id: id('a'), kind: s.id, name: name || unusedName(w), tame: !s.wild || !!b, at: b?.id, x: r ? rnd(r.x0, r.x1) : 0, y: r ? rnd(r.y0, r.y1) : 0 };
  if (!r && !from) { const spots = cellsOf(w, s.home); const [x, y] = spots.length ? pick(spots) : [0, 0]; a.x = x; a.y = y; }
  return { ...w, animals: from ? w.animals.map((x) => (x.id === from.id ? a : x)) : [...w.animals, a], log: [...w.log, `Day ${w.day}: ${a.name} the ${s.name.toLowerCase()} ${from ? 'was tamed' : 'joined the world'}.`] };
}

// Exploring: the map grows on one side, and new biomes and wild animals appear there.
export type Dir = 'east' | 'west' | 'north' | 'south';
export function exploreQuestion(w: World, dir: Dir): Question | null {
  const m = w.map, mw = rectW(m), mh = rectH(m);
  const wide = dir === 'east' || dir === 'west';
  if (wide ? mw + GROW > MAX_W : mh + GROW > MAX_H) return null;
  const nm: Rect = dir === 'east' ? { ...m, x1: m.x1 + GROW } : dir === 'west' ? { ...m, x0: m.x0 - GROW } : dir === 'north' ? { ...m, y0: m.y0 - GROW } : { ...m, y1: m.y1 + GROW };
  const strip: Rect = dir === 'east' ? { ...m, x0: m.x1 + 1, x1: m.x1 + GROW } : dir === 'west' ? { ...m, x0: m.x0 - GROW, x1: m.x0 - 1 } : dir === 'north' ? { ...m, y0: m.y0 - GROW, y1: m.y0 - 1 } : { ...m, y0: m.y1 + 1, y1: m.y1 + GROW };
  const add = rectW(strip) * rectH(strip), total = rectW(nm) * rectH(nm);
  return { kind: 'area', shape: { w: rectW(nm), h: rectH(nm) }, story: `Explorers set out ${dir}. The map is ${mw} blocks wide and ${mh} blocks tall. They will map ${GROW} more ${wide ? 'columns' : 'rows'} of land to the ${dir}.`,
    ask: `How many blocks will the whole map have?`, answer: { value: total, unit: 'blocks' },
    hint: wide ? `The new map is ${mw} + ${GROW} = ${rectW(nm)} wide and ${mh} tall: ${rectW(nm)} × ${mh} = ${total}.` : `The new map is ${mw} wide and ${mh} + ${GROW} = ${rectH(nm)} tall: ${mw} × ${rectH(nm)} = ${total}.`,
    apply: (x) => {
      const nx = { ...x, map: nm };
      const fresh = [...new Set(rectCells(strip).map((c) => biomeAt(nx, ...xy(c))))].filter((b) => !x.found.includes(b));
      return { ...nx, animals: [...x.animals, ...spawnWild(nx, strip)], found: [...x.found, ...fresh], log: [...x.log, `Day ${x.day}: explored ${add} new blocks to the ${dir}.${fresh.length ? ` Found: ${fresh.map((b) => BIOMES[b].name).join(', ')}.` : ''}`] };
    },
    after: `The map now has ${total} blocks. Look ${dir} for new land and new animals!` };
}

// A biome patch (a lake, a small desert...): the connected blocks of one biome around a cell.
function patch(w: World, x: number, y: number, max = 40): Cell[] {
  const b = biomeAt(w, x, y), seen = new Set<Cell>([key(x, y)]), q: [number, number][] = [[x, y]];
  while (q.length) {
    const [cx, cy] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (seen.has(k) || nx < w.map.x0 || ny < w.map.y0 || nx > w.map.x1 || ny > w.map.y1 || biomeAt(w, nx, ny) !== b) continue;
      seen.add(k); q.push([nx, ny]); if (seen.size > max) return [];
    }
  }
  return [...seen];
}
export function perimeterOf(cells: Cell[]) {
  const s = new Set(cells); let n = 0;
  for (const c of cells) { const [x, y] = xy(c); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!s.has(key(x + dx, y + dy))) n++; }
  return n;
}
// The world's own events, each paused for a question.
function patchQ(w: World): Question | null {
  for (let i = 0; i < 40; i++) {
    const x = rnd(w.map.x0, w.map.x1), y = rnd(w.map.y0, w.map.y1);
    const cells = patch(w, x, y, 28); if (cells.length < 4) continue;
    const b = BIOMES[biomeAt(w, x, y)], area = Math.random() < 0.5;
    const n = area ? cells.length : perimeterOf(cells);
    return { kind: area ? 'area' : 'perimeter', mark: cells, story: `Look at the ${b.word} outlined on the map. The animals want to know how big it is.`,
      ask: area ? `How many blocks of ${b.word} are in it?` : `How many block edges go all the way around the ${b.word}?`, answer: { value: n, unit: 'blocks' },
      hint: area ? `Count every block inside the outline: ${n}.` : `Walk around the outside and count each edge: ${n}.`, apply: (q) => q, after: area ? `That ${b.word} covers ${n} blocks.` : `It is ${n} block edges all the way around.` };
  }
  return null;
}
// A biome spreads: a strip of new forest, meadow or desert grows at its edge (her "expanding biomes").
function spreadQ(w: World): Question | null {
  const grow: BiomeId[] = ['forest', 'meadow', 'desert', 'wetland', 'snow'];
  for (let i = 0; i < 40; i++) {
    const x = rnd(w.map.x0 + 2, w.map.x1 - 6), y = rnd(w.map.y0 + 2, w.map.y1 - 4), b = biomeAt(w, x, y);
    if (!grow.includes(b)) continue;
    const sw = rnd(2, 5), sh = rnd(1, 3), r: Rect = { x0: x + 1, y0: y, x1: x + sw, y1: y + sh - 1 };
    const cells = rectCells(r).filter((c) => { const [cx, cy] = xy(c); const t = biomeAt(w, cx, cy); return t !== b && BIOMES[t].walk && !buildingAt(w, cx, cy); });
    if (cells.length !== sw * sh) continue;
    const word = b === 'forest' ? 'Trees spread' : b === 'meadow' ? 'Grass and flowers spread' : b === 'desert' ? 'Sand blows in and the desert spreads' : b === 'wetland' ? 'Rain soaks the ground and the wetland spreads' : 'Snow piles up and the snowfield spreads';
    return { kind: 'area', mark: r, shape: { w: sw, h: sh }, story: `${word} over a strip ${sw} blocks long and ${sh} ${sh === 1 ? 'block' : 'blocks'} wide.`,
      ask: `How many new blocks of ${BIOMES[b].word} grow?`, answer: { value: sw * sh, unit: 'blocks' }, hint: `${sw} × ${sh} = ${sw * sh}.`,
      apply: (q) => ({ ...q, paint: { ...q.paint, ...Object.fromEntries(cells.map((c) => [c, b])) }, log: [...q.log, `Day ${q.day}: the ${BIOMES[b].word} grew by ${sw * sh} blocks.`] }),
      after: `The ${BIOMES[b].word} grew by ${sw * sh} blocks.` };
  }
  return null;
}
// Ratio of animals per section: share a group evenly between buildings or biomes.
function shareQ(w: World): Question | null {
  const groups = SPECIES.map((s) => ({ s, n: w.animals.filter((a) => a.kind === s.id && !a.at).length })).filter((g) => g.n >= 4);
  if (!groups.length) return null;
  const g = pick(groups), parts = [2, 3, 4].filter((p) => g.n % p === 0);
  if (!parts.length) {
    const t = rnd(2, 4) * 2, per = t / 2;
    return { kind: 'ratio', story: `On the meadow there are ${t} rabbits for every 2 foxes nearby.`, ask: 'How many rabbits are there for each 1 fox?', answer: { value: per, unit: 'animals' }, hint: `${t} ÷ 2 = ${per}. The ratio is ${per} to 1.`, apply: (q) => q, after: `For every fox there are ${per} rabbits.` };
  }
  const p = pick(parts), each = g.n / p;
  return { kind: 'ratio', story: `There are ${g.n} wild ${g.s.many.toLowerCase()} ${g.s.icon} on the map. They split into ${p} equal groups to look for food.`,
    ask: `How many ${g.s.many.toLowerCase()} are in each group?`, answer: { value: each, unit: 'animals' }, hint: `${g.n} ÷ ${p} = ${each}.`, apply: (q) => q, after: `Each group has ${each} ${g.s.many.toLowerCase()}.` };
}
// Volume: a water trough or a hay loft for the farm.
function volumeQ(w: World): Question {
  const l = rnd(2, 5), d = rnd(1, 3), h = rnd(1, 3), v = l * d * h, barn = w.buildings.some((b) => b.type === 'barn') && Math.random() < 0.5;
  return { kind: 'volume', shape: { w: l, h: d, d: h }, story: barn ? `The farmers stack hay in the barn loft: ${l} bales long, ${d} wide and ${h} high. Each bale is one cubic block.` : `A water trough for the animals is ${l} blocks long, ${d} wide and ${h} deep, and rain fills it up.`,
    ask: barn ? 'How many bales of hay are in the loft?' : 'How many cubic blocks of water does the trough hold?', answer: { value: v, unit: 'cubes' },
    hint: `Volume = length × width × height: ${l} × ${d} × ${h} = ${v}.`, apply: (q) => q, after: barn ? `The loft holds ${v} bales of hay for the winter.` : `The trough holds ${v} cubic blocks of water.` };
}
// A missing side, worked backward from area or perimeter.
function sideQ(w: World): Question {
  const l = rnd(3, 8), d = rnd(2, 6);
  if (Math.random() < 0.5) return { kind: 'side', shape: { w: l, h: d }, story: `A farmer wants a garden that covers ${l * d} square ${L(w)}. One side is ${l} ${L(w)} long.`, ask: 'How long is the other side?', answer: { value: d, unit: w.unit },
    hint: `Area = length × width, so width = ${l * d} ÷ ${l} = ${d}.`, apply: (q) => q, after: `The garden is ${l} by ${d}.` };
  const p = 2 * (l + d);
  return { kind: 'side', shape: { w: l, h: d }, story: `Horses run laps around a rectangle field. One lap is ${p} ${L(w)}, and the long side is ${l} ${L(w)}.`, ask: 'How long is the short side?', answer: { value: d, unit: w.unit },
    hint: `Two long sides: ${l} + ${l} = ${2 * l}. ${p} - ${2 * l} = ${p - 2 * l}, and half of that is ${d}.`, apply: (q) => q, after: `The short side is ${d} ${L(w)}.` };
}
let lastKind = '';
export function eventQuestion(w: World): Question {
  for (let i = 0; i < 8; i++) {
    const r = Math.random();
    const q = r < 0.25 ? patchQ(w) : r < 0.45 ? spreadQ(w) : r < 0.62 ? shareQ(w) : r < 0.8 ? volumeQ(w) : sideQ(w);
    if (q && (q.kind !== lastKind || i === 7)) { lastKind = q.kind; return q; }
  }
  return volumeQ(w);
}
// Training a tame animal: a lap of its building's fence (perimeter with block sides).
export function trainQuestion(w: World, a: Animal): Question {
  const b = w.buildings.find((x) => x.id === a.at), s = SP(a.kind), bw = b ? rectW(b.r) : 4, bh = b ? rectH(b.r) : 3, per = 2 * (bw + bh), lv = a.lv ?? 0;
  return { kind: 'train', mark: b?.r, shape: { w: bw, h: bh }, story: `${a.name} the ${s.name.toLowerCase()} trains by running laps along the fence, ${bw} blocks long and ${bh} blocks wide. Each block side is ${sideText(w)}.`,
    ask: 'How far is one lap?', answer: { value: per * w.side, unit: w.unit }, hint: w.side === 1 ? `${bw} + ${bh} + ${bw} + ${bh} = ${per}.` : `${per} edges × ${w.side} = ${per * w.side}.`,
    apply: (x) => ({ ...x, animals: x.animals.map((y) => (y.id === a.id ? { ...y, lv: Math.min(3, lv + 1) } : y)) }), after: `${a.name} is now level ${Math.min(3, lv + 1)}!` };
}

export function passDay(w: World): { world: World; news: string | null } {
  let news: string | null = null;
  const x: World = { ...w, day: w.day + 1 };
  // Now and then wild animals have babies near each other (up to 6 of a kind).
  if (Math.random() < 0.35) {
    const s = pick(SPECIES.filter((sp) => sp.wild));
    const mine = x.animals.filter((a) => a.kind === s.id && !a.at);
    if (mine.length >= 2 && mine.length < 6) { const p = pick(mine); x.animals = [...x.animals, { id: id('a'), kind: s.id, name: '', x: p.x, y: p.y }]; news = `A baby ${s.name.toLowerCase()} ${s.icon} was born!`; }
  }
  return { world: x, news };
}
// Zoo visitors and farm sales: 1 coin a day for each tame animal, plus its level.
export const dailyCoins = (w: World) => w.animals.filter((a) => a.tame).reduce((n, a) => n + 1 + (a.lv ?? 0), 0);

export function score(guess: number, truth: number): { coins: number; label: 'exact' | 'close' | 'miss' } {
  if (guess === truth) return { coins: 3, label: 'exact' };
  if (Math.abs(guess - truth) <= Math.max(1, truth * 0.1)) return { coins: 1, label: 'close' };
  return { coins: 0, label: 'miss' };
}
// Bigger blocks once the student is ready, so multiplication joins counting.
export const sideFor = (exact: number) => (exact >= 16 ? 5 : exact >= 7 ? 2 : 1);
