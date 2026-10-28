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
export const SP = (id: string) => SPECIES.find((s) => s.id === id) ?? SPECIES[0];
// Build Queue 407 (Phase E): animals the student designs join the species list for this world.
export const addCustomSpecies = (list: Species[] = []) => { for (const c of list) if (!SPECIES.some((s) => s.id === c.id)) SPECIES.push(c); };
export const NAMES = ['Pip', 'Moss', 'Fern', 'Dusk', 'Clover', 'Rook', 'Wren', 'Hazel', 'Pebble', 'Sprout', 'Maple', 'Juniper', 'Biscuit', 'Daisy', 'Pepper', 'Willow', 'Acorn', 'Blue', 'Sunny', 'Cocoa', 'Ziggy', 'Luna', 'Thistle', 'Nutmeg'];
export interface Animal { id: string; kind: string; name: string; x: number; y: number; tame?: boolean; at?: string; lv?: number; power?: number; dir?: number }

// ---- buildings ----
export type BuildType = 'pasture' | 'barn' | 'coop' | 'zoo' | 'wall' | 'den';
export const BUILD: Record<BuildType, { name: string; icon: string; holds: string; minW: number; maxW: number; minH: number; maxH: number }> = {
  pasture: { name: 'Fenced pasture', icon: '🪵', holds: 'sheep, cows and horses', minW: 2, maxW: 10, minH: 2, maxH: 8 },
  barn: { name: 'Barn', icon: '🏚️', holds: 'cows, horses and pigs', minW: 2, maxW: 8, minH: 2, maxH: 6 },
  coop: { name: 'Chicken coop', icon: '🐓', holds: 'chickens', minW: 1, maxW: 4, minH: 1, maxH: 3 },
  zoo: { name: 'Zoo enclosure', icon: '🦓', holds: 'tamed wild animals', minW: 2, maxW: 10, minH: 2, maxH: 8 },
  wall: { name: 'Stone wall', icon: '🧱', holds: 'nothing: it keeps wild animals out', minW: 2, maxW: 14, minH: 1, maxH: 4 },
  // Build Queue 407 (Phase B): a den dug into the ground, measured in volume; wild animals shelter in it in storms.
  den: { name: 'Den', icon: '🕳️', holds: 'wild animals sheltering from storms', minW: 1, maxW: 5, minH: 1, maxH: 4 },
};
// A wall is one block thick; its "h" is how many blocks high it is stacked, so it covers a single row of the map.
export interface Building { id: string; type: BuildType; r: Rect; high?: number; name: string; depth?: number; gaps?: number; wild?: string }
export const holdsIn = (t: BuildType, s: Species) => (t === 'zoo' ? s.wild : t === 'pasture' ? ['sheep', 'cow', 'horse'].includes(s.id) : t === 'barn' ? ['cow', 'horse', 'pig'].includes(s.id) : t === 'coop' ? s.id === 'chicken' : false);
export const areaOf = (b: Building) => rectW(b.r) * rectH(b.r);
export const usedSpace = (w: World, b: Building) => w.animals.filter((a) => a.at === b.id).reduce((n, a) => n + SP(a.kind).space, 0);

export interface World {
  v: 2; seed: number; map: Rect; day: number; side: number; unit: LengthUnit;
  animals: Animal[]; buildings: Building[]; paint: Record<Cell, BiomeId>; found: BiomeId[]; log: string[];
  // Build Queue 407: packs (intelligence, skills), evolved traits, designed animals, the goal reached so far.
  packs?: Record<string, { iq: number; skills: string[]; milestones: string[] }>; evolved?: Record<string, string[]>; custom?: Species[]; goal?: number;
}
// Seasons: five days each (Phase C).
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;
export type Season = typeof SEASONS[number];
export const seasonOf = (day: number): Season => SEASONS[Math.floor((day - 1) / 5) % 4];
export const SEASON_ICON: Record<Season, string> = { Spring: '🌷', Summer: '☀️', Fall: '🍂', Winter: '❄️' };
export const biomeAt = (w: Pick<World, 'seed' | 'paint'>, x: number, y: number): BiomeId => w.paint[key(x, y)] ?? natureAt(w.seed, x, y);
export const walkable = (w: World, x: number, y: number, s?: Species) => {
  const b = biomeAt(w, x, y);
  return x >= w.map.x0 && x <= w.map.x1 && y >= w.map.y0 && y <= w.map.y1 && (BIOMES[b].walk || (b === 'lake' && (!!s?.swims || seasonOf(w.day) === 'Winter')) || (b === 'mountain' && !!s?.climbs));
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
    for (let i = 0; i < rnd(2, 3); i++) { const [x, y] = pick(spots); out.push({ id: id('a'), kind: s.id, name: '', x, y, power: rnd(2, 9) }); }
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
    return { ...a, x, y, dir: x > a.x ? 1 : x < a.x ? -1 : a.dir };
  });
}

// ---- questions ----
export interface Question {
  kind: string; story: string; ask: string; answer: Measure; hint: string; after: string;
  apply: (w: World) => World; // the outcome, the same whatever the student answered
  mark?: Rect | Cell[]; // the part of the map the question is about, outlined while they answer
  shape?: { w: number; h: number; d?: number; layers?: [number, number][] }; // a small diagram on the card
  choices?: string[]; // a choice question (the answer value is the right choice's number)
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
  if (type === 'den') {
    const d = Math.max(1, high), v = bw * bh * d, cubic = s === 1 ? 1 : s * s * s;
    b.depth = d;
    return { kind: 'volume', mark: r, shape: { w: bw, h: bh, d }, story: `You are digging a den ${bw} blocks long, ${bh} ${bh === 1 ? 'block' : 'blocks'} wide and ${d} ${d === 1 ? 'block' : 'blocks'} deep. Each block is ${sideText(w)} on each side.`,
      ask: s === 1 ? 'How many cubic meters of dirt come out?' : `How many cubic ${u} of dirt come out?`, answer: { value: v * cubic, unit: `cu ${w.unit}` },
      hint: s === 1 ? `Volume = length × width × depth: ${bw} × ${bh} × ${d} = ${v}.` : `${bw} × ${bh} × ${d} = ${v} blocks, each ${s} × ${s} × ${s} = ${cubic}: ${v} × ${cubic} = ${v * cubic}.`, apply,
      after: `The den holds ${v} cubic blocks. Wild animals will shelter in it when a storm comes.` };
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
      return { ...nx, animals: [...x.animals, ...(x.animals.filter((a) => !a.at).length < 80 ? spawnWild(nx, strip) : [])], found: [...x.found, ...fresh], log: [...x.log, `Day ${x.day}: explored ${add} new blocks to the ${dir}.${fresh.length ? ` Found: ${fresh.map((b) => BIOMES[b].name).join(', ')}.` : ''}`] };
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

// ---- Build Queue 407: everything from the plan's section 9 ----
const groupOf = (w: World, kind: string) => w.animals.filter((a) => a.kind === kind && !a.at);
const wildKinds = (w: World, n = 2) => SPECIES.filter((sp) => sp.wild && groupOf(w, sp.id).length >= n);
// Phase B: volume. A storm comes and animals shelter in a den: how many fit?
function denShelterQ(w: World): Question | null {
  const dens = w.buildings.filter((b) => b.type === 'den'); if (!dens.length) return null;
  const d = pick(dens), sp = pick(wildKinds(w, 1).length ? wildKinds(w, 1) : SPECIES.filter((x) => x.wild));
  const v = rectW(d.r) * rectH(d.r) * (d.depth ?? 1), fits = Math.floor(v / sp.space);
  return { kind: 'volume', mark: d.r, shape: { w: rectW(d.r), h: rectH(d.r), d: d.depth ?? 1 }, story: `A storm is coming! ${sp.many} ${sp.icon} hurry to ${d.name.toLowerCase()}, ${rectW(d.r)} by ${rectH(d.r)} by ${d.depth ?? 1} blocks deep. Each ${sp.name.toLowerCase()} needs ${sp.space} cubic ${sp.space === 1 ? 'block' : 'blocks'} of space.`,
    ask: `How many ${sp.many.toLowerCase()} can shelter in the den?`, answer: { value: fits, unit: 'animals' },
    hint: `Volume ${rectW(d.r)} × ${rectH(d.r)} × ${d.depth ?? 1} = ${v}. ${v} ÷ ${sp.space} = ${fits}${v % sp.space ? `, with ${v % sp.space} left over` : ''}.`, apply: (q) => q, after: `${fits} ${sp.many.toLowerCase()} stay safe and dry until the storm passes.` };
}
// Fall: a food store for winter must hold the right volume (hibernation).
function hibernateQ(w: World): Question {
  const sp = pick(SPECIES.filter((x) => x.id === 'bear' || x.id === 'rabbit' || x.id === 'fox' || x.id === 'goat'));
  const n = Math.max(2, Math.min(6, groupOf(w, sp.id).length || rnd(2, 5))), each = rnd(2, 4), l = rnd(2, 4), wd = rnd(1, 3);
  const need = n * each, area = l * wd, depth = Math.ceil(need / area);
  return { kind: 'volume', shape: { w: l, h: wd, d: depth }, story: `Fall is here. ${n} ${sp.many.toLowerCase()} ${sp.icon} each need ${each} cubic blocks of food stored for winter. Their store is ${l} blocks long and ${wd} ${wd === 1 ? 'block' : 'blocks'} wide.`,
    ask: 'How many blocks deep must the store be to hold all the food? (Round up.)', answer: { value: depth, unit: 'blocks' },
    hint: `Food needed: ${n} × ${each} = ${need}. Floor of the store: ${l} × ${wd} = ${area}. ${need} ÷ ${area} = ${(need / area).toFixed(2).replace(/\.00$/, '')}, round up to ${depth}.`,
    apply: (q) => q, after: `A store ${depth} ${depth === 1 ? 'block' : 'blocks'} deep holds ${area * depth} cubic blocks: enough for the winter.` };
}
// Stepped mountains: add the volume of each layer (rectangular prisms).
function mountainQ(): Question {
  const a = rnd(5, 8), b = rnd(4, 6), c = a - 2, d = b - 1, e = c - 2, f = Math.max(1, d - 2);
  const layers: [number, number][] = [[a, b], [c, d], [e, f]], v = a * b + c * d + e * f;
  return { kind: 'volume', shape: { w: a, h: 3, layers }, story: `Mountain goats 🐐 live on a stepped mountain. It has 3 layers, each 1 block tall: ${a} by ${b}, then ${c} by ${d}, then ${e} by ${f} on top.`,
    ask: 'What is the volume of the whole mountain in cubic blocks?', answer: { value: v, unit: 'cubes' },
    hint: `Add each layer: ${a} × ${b} = ${a * b}, ${c} × ${d} = ${c * d}, ${e} × ${f} = ${e * f}. ${a * b} + ${c * d} + ${e * f} = ${v}.`, apply: (q) => q, after: `The mountain is ${v} cubic blocks of rock for the goats to climb.` };
}
// Water depth zones and sky space.
function waterSkyQ(w: World): Question {
  if (Math.random() < 0.5) {
    const l = rnd(4, 9), wd = rnd(3, 6), top = 1, mid = rnd(2, 3), v = l * wd * mid;
    return { kind: 'volume', shape: { w: l, h: wd, d: mid }, story: `The lake has depth zones. Ducks 🦆 paddle in the top ${top} meter. Fish swim in the middle zone, ${mid} meters deep, under a surface ${l} meters by ${wd} meters.`,
      ask: 'How many cubic meters of water are in the fish zone?', answer: { value: v, unit: 'cu m' }, hint: `${l} × ${wd} × ${mid} = ${v}.`, apply: (q) => q, after: `The fish zone holds ${v} cubic meters of water.` };
  }
  const l = rnd(4, 10), wd = rnd(3, 8), h = rnd(2, 5), v = l * wd * h;
  return { kind: 'volume', shape: { w: l, h: wd, d: h }, story: `A flock of birds 🐦 claims a piece of sky over the ${pick(w.found.filter((b) => BIOMES[b].walk))} ${l} blocks long, ${wd} blocks wide and ${h} blocks high.`,
    ask: 'How much sky space (in cubic blocks) does the flock claim?', answer: { value: v, unit: 'cubes' }, hint: `Air volume = ${l} × ${wd} × ${h} = ${v}.`, apply: (q) => q, after: `The flock has ${v} cubic blocks of sky to swoop in.` };
}
// Phase C: migration across the scaled map (distance and time).
function migrationQ(w: World): Question | null {
  const kinds = wildKinds(w, 2); if (!kinds.length) return null;
  const sp = pick(kinds), herd = groupOf(w, sp.id);
  const dx = pick([-1, 1]) * rnd(6, 14), dy = rnd(-3, 3), blocks = Math.abs(dx) + Math.abs(dy);
  const sideM = Math.max(w.side, 5), dist = blocks * sideM, speed = pick([1, 2, 5]);
  const timeQ = Math.random() < 0.5 && dist % speed === 0;
  const dir = dx > 0 ? 'east' : 'west';
  const apply = (q: World): World => ({ ...q, animals: q.animals.map((a) => { if (!herd.some((h) => h.id === a.id)) return a; const nx = Math.max(q.map.x0, Math.min(q.map.x1, a.x + dx)), ny = Math.max(q.map.y0, Math.min(q.map.y1, a.y + dy)); return walkable(q, nx, ny, sp) ? { ...a, x: nx, y: ny, dir: dx > 0 ? 1 : -1 } : a; }), log: [...q.log, `Day ${q.day}: the ${sp.many.toLowerCase()} migrated ${dir}.`] });
  return timeQ
    ? { kind: 'migration', story: `The ${sp.many.toLowerCase()} ${sp.icon} are migrating ${dir} ${dist} meters to find food. They travel ${speed} ${speed === 1 ? 'meter' : 'meters'} every second.`, ask: 'How many seconds will the trip take?', answer: { value: dist / speed, unit: 'blocks' },
      hint: `Time = distance ÷ speed: ${dist} ÷ ${speed} = ${dist / speed} seconds.`, apply, after: `They arrive after ${dist / speed} seconds.` }
    : { kind: 'migration', story: `The ${sp.many.toLowerCase()} ${sp.icon} are migrating ${Math.abs(dx)} blocks ${dir}${dy ? ` and ${Math.abs(dy)} blocks ${dy > 0 ? 'south' : 'north'}` : ''}. On this map, each block is ${sideM} meters.`, ask: 'How many meters will they walk?', answer: { value: dist, unit: 'm' },
      hint: `${Math.abs(dx)}${dy ? ` + ${Math.abs(dy)}` : ''} = ${blocks} blocks. ${blocks} × ${sideM} = ${dist} meters.`, apply, after: `They walked ${dist} meters to their new home.` };
}
// Unit conversion: within a system first, then between metric and customary.
function convertQ(w: World): Question {
  const sp = pick(SPECIES.filter((x) => x.wild));
  const opts: (() => Question)[] = [
    () => { const m = rnd(2, 9) * (pick([1, 10]) as number); return { kind: 'convert', story: `The ${sp.name.toLowerCase()} ${sp.icon} trail is ${m} meters long.`, ask: 'How many centimeters is that?', answer: { value: m * 100, unit: 'blocks' }, hint: `1 meter = 100 centimeters. ${m} × 100 = ${m * 100}.`, apply: (q) => q, after: `${m} m = ${m * 100} cm.` }; },
    () => { const km = rnd(2, 9); return { kind: 'convert', story: `A herd walks ${km} kilometers in a day.`, ask: 'How many meters is that?', answer: { value: km * 1000, unit: 'm' }, hint: `1 kilometer = 1,000 meters. ${km} × 1,000 = ${km * 1000}.`, apply: (q) => q, after: `${km} km = ${km * 1000} m.` }; },
    () => { const m = rnd(3, 9) * 500; return { kind: 'convert', story: `The ducks flew ${m.toLocaleString('en-US')} meters to the lake.`, ask: 'How many kilometers is that? (Use a decimal point if you need one.)', answer: { value: m / 1000, unit: 'blocks' }, hint: `1,000 meters = 1 kilometer. ${m} ÷ 1,000 = ${m / 1000}.`, apply: (q) => q, after: `${m} m = ${m / 1000} km.` }; },
    () => { const ft = rnd(2, 9); return { kind: 'convert', story: `The fence is ${ft} feet tall.`, ask: 'How many inches is that?', answer: { value: ft * 12, unit: 'blocks' }, hint: `1 foot = 12 inches. ${ft} × 12 = ${ft * 12}.`, apply: (q) => q, after: `${ft} ft = ${ft * 12} in.` }; },
    () => { const yd = rnd(2, 12); return { kind: 'convert', story: `The pasture is ${yd} yards long.`, ask: 'How many feet is that?', answer: { value: yd * 3, unit: 'ft' }, hint: `1 yard = 3 feet. ${yd} × 3 = ${yd * 3}.`, apply: (q) => q, after: `${yd} yd = ${yd * 3} ft.` }; },
    () => { const inch = rnd(2, 10) * 5; const cm = Math.round(inch * 2.54); return { kind: 'convert', story: `A baby ${sp.name.toLowerCase()} ${sp.icon} is ${inch} inches long.`, ask: 'About how many centimeters is that? (1 inch is about 2.54 cm. Round to a whole number.)', answer: { value: cm, unit: 'blocks' }, hint: `${inch} × 2.54 = ${(inch * 2.54).toFixed(1)}, about ${cm}.`, apply: (q) => q, after: `${inch} in is about ${cm} cm.` }; },
    () => { const mi = rnd(2, 12) * 5; const km = mi * 1.6; return { kind: 'convert', story: `The geese migrate ${mi} miles south.`, ask: 'About how many kilometers is that? (1 mile is about 1.6 km.)', answer: { value: km, unit: 'blocks' }, hint: `${mi} × 1.6 = ${km}.`, apply: (q) => q, after: `${mi} mi is about ${km} km.` }; },
  ];
  void w;
  return pick(opts)();
}
// Phase D: packs, alphas, intelligence and rivals.
const SKILLS: [string, number][] = [['Teamwork', 5], ['Swift feet', 5], ['Keen nose', 3], ['Night vision', 2], ['Medic', 1], ['Fire trick', 1]];
const rollSkill = (have: string[]) => { const pool = SKILLS.filter(([n]) => !have.includes(n)); if (!pool.length) return null; const tot = pool.reduce((t, [, w]) => t + w, 0); let r = Math.random() * tot; for (const [n, wt] of pool) { r -= wt; if (r <= 0) return n; } return pool[0][0]; };
export const alphaOf = (w: World, kind: string) => groupOf(w, kind).reduce<Animal | null>((a, b) => (!a || (b.power ?? 0) > (a.power ?? 0) ? b : a), null);
function rivalQ(w: World): Question | null {
  const kinds = SPECIES.filter((sp) => sp.wild && groupOf(w, sp.id).length >= 2);
  if (kinds.length < 2) return null;
  const a = pick(kinds), b = pick(kinds.filter((k) => k.id !== a.id));
  const na = groupOf(w, a.id).length, nb = groupOf(w, b.id).length, sa = rnd(2, 5), sb = rnd(2, 5);
  const ta = na * sa + (w.packs?.[a.id]?.skills.length ?? 0) * 3, tb = nb * sb + (w.packs?.[b.id]?.skills.length ?? 0) * 3;
  const win = ta >= tb ? a : b, lose = win === a ? b : a;
  return { kind: 'rival', story: `A border dispute! ${na} ${a.many.toLowerCase()} ${a.icon} (strength ${sa} each) and ${nb} ${b.many.toLowerCase()} ${b.icon} (strength ${sb} each) both want the same patch of land. Pack skills add 3 each.`,
    ask: `What is the total strength of the ${a.many.toLowerCase()}?`, answer: { value: ta, unit: 'blocks' },
    hint: `${na} × ${sa} = ${na * sa}${w.packs?.[a.id]?.skills.length ? ` plus ${w.packs[a.id].skills.length} skills × 3` : ''} = ${ta}. The ${b.many.toLowerCase()} have ${tb}.`,
    apply: (q) => { const packs = { ...(q.packs ?? {}) }; const p = packs[win.id] ?? { iq: 0, skills: [], milestones: [] }; const sk = Math.random() < 0.6 ? rollSkill(p.skills) : null; packs[win.id] = { ...p, skills: sk ? [...p.skills, sk] : p.skills };
      return { ...q, packs, animals: q.animals.map((x) => (x.kind === lose.id && !x.at ? { ...x, ...nudgeAway(q, x) } : x)), log: [...q.log, `Day ${q.day}: the ${win.many.toLowerCase()} held the land${sk ? ` and learned ${sk}` : ''}.`] }; },
    after: `The ${win.many.toLowerCase()} held the land. The ${lose.many.toLowerCase()} trotted off to find somewhere else. Nobody was hurt.` };
}
function nudgeAway(w: World, a: Animal) { for (let d = 4; d < 14; d++) { const x = a.x + pick([-d, d]), y = a.y; if (walkable(w, x, y, SP(a.kind)) && !buildingAt(w, x, y)) return { x, y }; } return { x: a.x, y: a.y }; }
function iqQ(w: World): Question | null {
  const kinds = wildKinds(w, 2); if (!kinds.length) return null;
  const sp = pick(kinds), p = w.packs?.[sp.id] ?? { iq: 0, skills: [], milestones: [] };
  const steps: [string, string, number][] = [['tools', 'learned to dig with sticks and stones', 2], ['shelter', 'learned to build a shelter from branches', 2], ['fire', 'learned to keep warm by a fire (with help from a friendly ranger)', 3], ['fence', 'are smart enough to build a fence around their land', 0]];
  const next = steps.find(([k]) => !p.milestones.includes(k)); if (!next) return null;
  const alpha = alphaOf(w, sp.id);
  if (next[0] === 'fence') {
    if (p.iq < 5) return null;
    const bw = rnd(3, 6), bh = rnd(3, 5), per = 2 * (bw + bh);
    return { kind: 'perimeter', shape: { w: bw, h: bh }, story: `The ${sp.many.toLowerCase()} ${sp.icon} have ${p.iq} intelligence points: enough to fence their land, ${bw} by ${bh} blocks.${alpha ? ' Their alpha leads the way.' : ''}`,
      ask: 'How many fence pieces go all the way around their land?', answer: { value: per, unit: 'blocks' }, hint: `${bw} + ${bh} + ${bw} + ${bh} = ${per}.`,
      apply: (q) => ({ ...q, packs: { ...(q.packs ?? {}), [sp.id]: { ...p, milestones: [...p.milestones, 'fence'] } } }), after: `The ${sp.many.toLowerCase()} built a ${per} piece fence. A complete fence keeps rivals out.` };
  }
  const n = groupOf(w, sp.id).length, gain = next[2] * n;
  return { kind: 'iq', story: `The ${sp.many.toLowerCase()} ${sp.icon} ${next[1]}! Each of the ${n} in the pack earns ${next[2]} intelligence points.`, ask: 'How many intelligence points does the pack earn in all?', answer: { value: gain, unit: 'blocks' }, hint: `${n} × ${next[2]} = ${gain}.`,
    apply: (q) => ({ ...q, packs: { ...(q.packs ?? {}), [sp.id]: { ...p, iq: p.iq + next[2], milestones: [...p.milestones, next[0]] } } }), after: `The pack is smarter now: ${p.iq + next[2]} intelligence points for the species.` };
}
// A storm knocks pieces out of a fence: gaps let wild animals slip in until it is fixed.
function stormFenceQ(w: World): Question | null {
  const fenced = w.buildings.filter((b) => (b.type === 'pasture' || b.type === 'zoo') && !b.gaps); if (!fenced.length) return null;
  const b = pick(fenced), per = 2 * (rectW(b.r) + rectH(b.r)), k = rnd(1, Math.min(4, per - 1));
  return { kind: 'perimeter', mark: b.r, shape: { w: rectW(b.r), h: rectH(b.r) }, story: `A windstorm knocked ${k} ${k === 1 ? 'piece' : 'pieces'} out of the fence around ${b.name.toLowerCase()} (${rectW(b.r)} by ${rectH(b.r)} blocks). Gaps let wild animals slip in!`,
    ask: 'How many fence pieces are still standing?', answer: { value: per - k, unit: 'blocks' }, hint: `All the way around: ${rectW(b.r)} + ${rectH(b.r)} + ${rectW(b.r)} + ${rectH(b.r)} = ${per}. ${per} - ${k} = ${per - k}.`,
    apply: (q) => ({ ...q, buildings: q.buildings.map((x) => (x.id === b.id ? { ...x, gaps: k } : x)) }), after: `${per - k} pieces still stand. Tap the 🔧 Fix the fence button to close the ${k === 1 ? 'gap' : 'gaps'}.` };
}
export function repairQuestion(w: World, b: Building): Question {
  const per = 2 * (rectW(b.r) + rectH(b.r)), k = b.gaps ?? 0, s = w.side;
  return { kind: 'perimeter', mark: b.r, shape: { w: rectW(b.r), h: rectH(b.r) }, story: `${k} fence ${k === 1 ? 'piece is' : 'pieces are'} missing from ${b.name.toLowerCase()}. Each piece is ${s} ${s === 1 ? UNIT_NAME[w.unit].one : L(w)} long.`,
    ask: `How many ${L(w)} of new fence do you need?`, answer: { value: k * s, unit: w.unit }, hint: `${k} × ${s} = ${k * s}. (The whole fence is ${per * s} ${L(w)}.)`,
    apply: (q) => ({ ...q, buildings: q.buildings.map((x) => (x.id === b.id ? { ...x, gaps: 0 } : x)) }), after: 'The fence is whole again. Nothing can slip in.' };
}
// Phase E: evolution predictions (a choice question). The adaptation happens whatever the student picks.
const ADAPT: Partial<Record<BiomeId, [string, string[]]>> = {
  snow: ['Thicker, whiter fur', ['Bigger ears to stay cool', 'Webbed feet']],
  desert: ['Bigger ears to let out heat', ['Thicker fur', 'Webbed feet']],
  wetland: ['Webbed feet for swimming', ['Thicker fur', 'Longer neck']],
  lake: ['Waterproof feathers or fur', ['Bigger ears', 'Sharper claws']],
  forest: ['Sharper claws for climbing trees', ['Webbed feet', 'Lighter, sand-colored coat']],
  mountain: ['Grippy hooves for steep rocks', ['Webbed feet', 'Bigger ears']],
  hills: ['Stronger legs for hills', ['Webbed feet', 'Thicker fur']],
  meadow: ['A grass-colored coat to hide', ['Webbed feet', 'Thicker fur']],
};
function evolveQ(w: World): Question | null {
  const kinds = wildKinds(w, 2).filter((sp) => { const b = biomeAt(w, groupOf(w, sp.id)[0].x, groupOf(w, sp.id)[0].y); return !!ADAPT[b] && !(w.evolved?.[sp.id] ?? []).includes(ADAPT[b]![0]); });
  if (!kinds.length) return null;
  const sp = pick(kinds), g = groupOf(w, sp.id)[0], b = biomeAt(w, g.x, g.y), [right, wrong] = ADAPT[b]!;
  const choices = [right, ...wrong].sort(() => Math.random() - 0.5);
  return { kind: 'evolve', choices, story: `Many seasons pass. The ${sp.many.toLowerCase()} ${sp.icon} living in the ${BIOMES[b].word} slowly change to fit their home.`,
    ask: 'Predict: how will they adapt?', answer: { value: choices.indexOf(right), unit: 'blocks' }, hint: `In the ${BIOMES[b].word}, the helpful change is: ${right.toLowerCase()}.`,
    apply: (q) => ({ ...q, evolved: { ...(q.evolved ?? {}), [sp.id]: [...(q.evolved?.[sp.id] ?? []), right] }, log: [...q.log, `Day ${q.day}: the ${sp.many.toLowerCase()} adapted: ${right.toLowerCase()}.`] }),
    after: `Over many generations the ${sp.many.toLowerCase()} grew ${right.toLowerCase()}. Your prediction never speeds evolution up: it happens on its own.` };
}
// Phase E: designing a new animal. Trait amounts scale with size (ratios).
export const DESIGN_ICONS = ['🦔', '🦡', '🦦', '🦥', '🦘', '🦩', '🦚', '🦙', '🐊', '🦏', '🐘', '🦫', '🦨', '🦤'];
export function designQuestion(size: number, trait: 'courage' | 'wings' | 'energy', perSize: number): Question {
  const word = trait === 'courage' ? 'courage (lion units)' : trait === 'wings' ? 'wing strength (flamingo units)' : 'energy units';
  return { kind: 'design', story: `A size 1 animal needs ${perSize} ${word} to be as ${trait === 'courage' ? 'brave as a lion' : trait === 'wings' ? 'strong a flier as a flamingo' : 'lively as a rabbit'}. Your new animal is size ${size}, so it needs the same amount for every size step.`,
    ask: `How many ${word} does your size ${size} animal need?`, answer: { value: size * perSize, unit: 'blocks' }, hint: `${size} × ${perSize} = ${size * perSize}. The ratio stays ${perSize} to 1.`, apply: (q) => q, after: `Your animal has ${size * perSize} ${word}.` };
}
export function makeSpecies(name: string, icon: string, home: BiomeId, size: number): Species {
  const sid = `custom-${name.toLowerCase().replace(/[^a-z]/g, '')}-${Date.now().toString(36)}`;
  return { id: sid, name, many: `${name}s`, icon, wild: true, home: [home], space: size * 2, lives: 'zoo', price: 0, swims: home === 'lake' || home === 'wetland', climbs: home === 'mountain', fact: `A brand new animal designed by you, at home in the ${BIOMES[home].word}.` };
}
export function spawnDesigned(w: World, s: Species): World {
  const spots = cellsOf(w, s.home.includes('lake') ? ['wetland'] : s.home);
  const born = Array.from({ length: 3 }, () => { const [x, y] = spots.length ? pick(spots) : [0, 0]; return { id: id('a'), kind: s.id, name: '', x, y, power: rnd(3, 9) }; });
  return { ...w, custom: [...(w.custom ?? []), s], animals: [...w.animals, ...born], log: [...w.log, `Day ${w.day}: a new species, the ${s.name}, appeared.`] };
}

// Phase F: XP. Right answers earn XP; the three tiers (10, 25 and 45 right answers) give big XP bonuses.
export const XP_FOR = { exact: 10, close: 5 } as const;
export const XP_TIERS = [{ at: 10, xp: 50, title: 'Explorer' }, { at: 25, xp: 100, title: 'Ranger' }, { at: 45, xp: 200, title: 'World Builder' }];
export const levelOf = (xp: number) => 1 + Math.floor(xp / 100);

// Goals: always one next step on screen (Phase A).
export const GOALS: { text: string; done: (w: World, right: number) => boolean }[] = [
  { text: 'Build a fenced pasture', done: (w) => w.buildings.some((b) => b.type === 'pasture') },
  { text: 'Add 2 sheep to your pasture', done: (w) => w.animals.filter((a) => a.kind === 'sheep' && a.at).length >= 2 },
  { text: 'Explore the map in any direction', done: (w) => rectW(w.map) * rectH(w.map) > rectW(START_MAP) * rectH(START_MAP) },
  { text: 'Build a barn', done: (w) => w.buildings.some((b) => b.type === 'barn') },
  { text: 'Build a zoo enclosure and tame a wild animal', done: (w) => w.animals.some((a) => a.at && SP(a.kind).wild) },
  { text: 'Dig a den for storms', done: (w) => w.buildings.some((b) => b.type === 'den') },
  { text: 'Build a stone wall', done: (w) => w.buildings.some((b) => b.type === 'wall') },
  { text: 'Train an animal to level 1', done: (w) => w.animals.some((a) => (a.lv ?? 0) >= 1) },
  { text: 'Design your own animal', done: (w) => (w.custom ?? []).length > 0 },
  { text: 'Find all 8 biomes', done: (w) => w.found.length >= 8 },
  { text: 'Answer 45 questions right to become a World Builder', done: (_w, r) => r >= 45 },
];
let lastKind = '';
export function eventQuestion(w: World): Question {
  const season = seasonOf(w.day);
  for (let i = 0; i < 10; i++) {
    const r = Math.random();
    const q = season === 'Fall' && r < 0.12 ? hibernateQ(w)
      : r < 0.1 ? patchQ(w) : r < 0.18 ? spreadQ(w) : r < 0.25 ? shareQ(w) : r < 0.31 ? volumeQ(w) : r < 0.36 ? sideQ(w)
      : r < 0.43 ? denShelterQ(w) : r < 0.48 ? mountainQ() : r < 0.54 ? waterSkyQ(w) : r < 0.62 ? migrationQ(w) : r < 0.72 ? convertQ(w)
      : r < 0.78 ? rivalQ(w) : r < 0.84 ? iqQ(w) : r < 0.9 ? stormFenceQ(w) : evolveQ(w);
    if (q && (q.kind !== lastKind || i === 9)) { lastKind = q.kind; return q; }
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
  if (seasonOf(x.day) !== seasonOf(w.day)) news = `${SEASON_ICON[seasonOf(x.day)]} ${seasonOf(x.day)} is here!${seasonOf(x.day) === 'Winter' ? ' The lakes freeze over, so animals can walk across them.' : seasonOf(x.day) === 'Spring' ? ' Lots of babies are born in spring.' : seasonOf(x.day) === 'Fall' ? ' Animals get ready for winter.' : ''}`;
  const gap = x.buildings.find((b) => b.gaps); if (gap && !news && Math.random() < 0.5) news = `A wild animal slipped in through the gap in ${gap.name.toLowerCase()}! Fix the fence to keep it out.`;
  // Now and then wild animals have babies near each other (up to 6 of a kind).
  // Build Queue 409: at most 80 wild animals on the map, so iPads stay smooth.
  if (x.animals.filter((a) => !a.at).length < 80 && Math.random() < (seasonOf(x.day) === 'Spring' ? 0.6 : 0.3)) {
    const s = pick(SPECIES.filter((sp) => sp.wild));
    const mine = x.animals.filter((a) => a.kind === s.id && !a.at);
    if (mine.length >= 2 && mine.length < 6) { const p = pick(mine); x.animals = [...x.animals, { id: id('a'), kind: s.id, name: '', x: p.x, y: p.y, power: rnd(2, 10) }]; news = news ?? `A baby ${s.name.toLowerCase()} ${s.icon} was born!`; }
  }
  return { world: x, news };
}

// Exact, close (within a tenth) or a miss. Build Queue 407: no coins any more; XP and Class Cash instead.
export function score(guess: number, truth: number, choice = false): { label: 'exact' | 'close' | 'miss' } {
  if (Math.abs(guess - truth) < 1e-9) return { label: 'exact' };
  if (!choice && Math.abs(guess - truth) <= Math.max(1, Math.abs(truth) * 0.1)) return { label: 'close' };
  return { label: 'miss' };
}
// Bigger blocks once the student is ready, so multiplication joins counting.
// Upper elementary and middle grades (her answer): bigger blocks come sooner.
export const sideFor = (exact: number) => (exact >= 12 ? 5 : exact >= 4 ? 2 : 1);
