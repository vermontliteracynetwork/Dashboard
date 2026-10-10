import { useStore } from '../../store/store';
import type { GroundBounds, WorldObject, WorldObjectRole } from '../../types';
import { resolveDraftRows, groundBoundsMaxExtent } from './townLayout';
import { measureModel, WORLD_SIZE_OWNER, type WorldSizeRow } from './townSize';
import { townSizeFactor } from './WorldObjectRenderer';
import { TERRAIN_OWNER, decodeTerrain, encodeTerrain, makeTerrain, setTerrain } from './terrain';
import { REGIONS_OWNER, saveRegions, type RegionsRow } from './regions';
import { HOMES_OWNER, removeHomes, saveHomes, type HomesRow } from './homeLots';
import { PATHS_OWNER, savePaths, type GroundPath } from './GroundPaths';

// The new Town Square and the Enchanted Forest (teacher 2026-10-10: "turn both mockups into
// reality for the town square and forrest, replacing all current design"). The two mockups
// (docs/mockups-town-and-forest.pdf) are built for real: every shared Town Square object, ground
// patch, region and terrain shape of the old design is replaced by the 50 x 50 Town Square, with
// the 30 x 30 Enchanted Forest joined to its west street. Every place students could go in the
// old town keeps a home in the new one (each building's job, its "role", is on a matching new
// building). The whole old design is saved first (the `town-backup` row) so Build Mode can bring
// it back in one tap. Runs once, from Build Mode, and publishes when done.

export const REMAKE_OWNER = 'town-remake';
export const BACKUP_OWNER = 'town-backup';
export interface RemakeRow { state?: 'built' | 'restored'; at?: string; bannerClosed?: boolean }
interface BackupRow {
  objects: Omit<WorldObject, 'id' | 'createdAt'>[];
  patches: { x: number; z: number; radius: number; texturePath: string }[];
  terrain: unknown; regions: unknown; homes: unknown; paths: unknown;
  bounds: GroundBounds; groundTexture: string | null; at: string;
}

const PI = Math.PI;
const M = (p: string) => `/world/models/${p}`;
const BRICK = '/world/textures/handpainted/Brick_01_512.png';
const PAVING = '/world/textures/wests/paving%205.png';
const DIRT = '/world/textures/handpainted/Dirt_01_512.png';
const FOREST_FLOOR = '/world/textures/handpainted/Grass_02_512.png';

// One placed thing: a model, where, its turn, and a target height (h) and/or widest side (w) in
// world units (1 unit is about a player's height). `onPrev` stacks it on top of the thing before it.
interface Item { m: string; x: number; z: number; r?: number; h?: number; w?: number; role?: WorldObjectRole; name?: string; solid?: boolean; onPrev?: boolean }

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function distSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az; const L = dx * dx + dz * dz;
  const u = L ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L)) : 0;
  return Math.hypot(px - (ax + u * dx), pz - (az + u * dz));
}
function distLine(px: number, pz: number, pts: [number, number][]) {
  let d = 1e9; for (let k = 0; k < pts.length - 1; k++) d = Math.min(d, distSeg(px, pz, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1])); return d;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ───────────── Town Square, 50 x 50, centered on the origin (north is -z) ─────────────
export const TOWN_BOUNDS: GroundBounds = { north: 25, south: 25, east: 25, west: 55 };
const POND = { x: 14, z: 17.5, rx: 7, rz: 5.5 };
function townHeight(x: number, z: number) {
  let h = 0;
  const r = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
  if (r < 1) h -= 1.5 * (1 - r * r);
  if (z < -21) h += 0.9 * smooth(-21, -25, z) * (Math.abs(x) > 3 ? 1 : 0.2);
  return h;
}
function townItems(): Item[] {
  const t: Item[] = [];
  const T = (m: string, x: number, z: number, o: Partial<Item> = {}) => { t.push({ m: M(m), x, z, ...o }); };
  // Shops along the north side, facing the square
  T('buildings/bakery.glb', -19, -15, { w: 7, h: 6, role: 'bakery', name: 'Bakery', solid: true });
  T('buildings/post-office.glb', -10, -15, { w: 6.5, h: 8.5, role: 'post-office', name: 'Post Office', solid: true });
  T('quaternius-buildings/2Story_Columns.glb', 10, -15, { w: 7.5, h: 7, role: 'bank', name: 'Bank', solid: true });
  T('quaternius-buildings/2Story_Sign.glb', 19, -15, { w: 7, h: 7, role: 'store', name: 'Store', solid: true });
  // East side
  T('buildings/seamstress-shop.glb', 17.5, -6.5, { w: 6.5, h: 7.5, r: -PI / 2, role: 'seamstress', name: 'Seamstress', solid: true });
  T('buildings/cinema.glb', 17.5, 6.5, { w: 8, r: -PI / 2, role: 'cinema', name: 'Cinema', solid: true });
  T('buildings/grammar-machine-factory.glb', 11.5, -7.6, { w: 4.6, h: 5, r: -PI / 2, role: 'grammar-machine', name: 'Grammar Gus Factory', solid: true });
  // Market street (west): a stall for each game booth
  T('market/stall-red.glb', -12, -4.6, { w: 3.6, role: 'farmers-market', name: "Farmers' Market", solid: true });
  T('market/stall-green.glb', -18, -4.6, { w: 3.6, role: 'arcade', name: 'Arcade', solid: true });
  T('market/stall.glb', -12, 4.6, { w: 3.6, r: PI, role: 'bubble-shooter', name: 'Bubble Shooter', solid: true });
  T('market/stall-red.glb', -18, 4.6, { w: 3.6, r: PI, name: 'Market Stall', solid: true });
  T('space/space-bowling-billboard.glb', -22.6, 6.2, { w: 3.4, r: PI / 2, role: 'space-bowling', name: 'Space Bowling', solid: true });
  T('fantasy/Barrel_A.glb', -15, -5.5, { h: 0.9 });
  T('pirate/crate.glb', -15, 5.6, { h: 0.8 });
  T('farm/Egg_Basket.glb', -21, 5.4, { h: 0.5 });
  // The square
  T('props/doggi-statue.glb', 0, 0, { h: 2.6, solid: true });
  for (const [x, z, r] of [[0, -4.6, 0], [0, 4.6, PI], [-4.6, 0, PI / 2], [4.6, 0, -PI / 2]] as const) T('props/park/park-bench.glb', x, z, { w: 2.2, r: r + PI });
  for (const [x, z, r] of [[-7, -5, PI / 2], [-7, 5, PI / 2], [7, -5, PI / 2], [7, 5, PI / 2], [-5, -7, 0], [5, -7, 0], [-5, 7, 0], [5, 7, 0]] as const) T('nature/hedge-long.glb', x, z, { w: 3.6, h: 1.1, r });
  for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7]] as const) {
    T('structures/modular-streetlamp.glb', x, z, { h: 3.3 });
    T('nature/painted-flower-1.glb', x + Math.sign(-x) * 1.2, z, { h: 0.5 });
    T('nature/painted-flower-3.glb', x, z + Math.sign(-z) * 1.2, { h: 0.5 });
  }
  for (const [x, z] of [[-5.2, -5.2], [5.2, -5.2], [-5.2, 5.2], [5.2, 5.2]] as const) {
    T('nature/shaped-tree-round.glb', x, z, { h: 3.6, r: x, solid: true });
    for (let k = 0; k < 5; k++) T(`nature/painted-flower-${1 + (k % 4)}.glb`, x + Math.cos(k * 1.3) * 1.3, z + Math.sin(k * 1.3) * 1.3, { h: 0.45, r: k });
  }
  // My Tasks: the computer desk at the north edge of the square
  T('props/desk.glb', -2.2, -6.6, { w: 1.6, r: 0, role: 'computer-desk', name: 'My Tasks' });
  T('props/computer-screen.glb', -2.2, -6.75, { h: 0.55, r: 0, onPrev: true });
  for (const [x, z] of [[2.7, -13], [-2.7, -21], [2.7, 13], [-2.7, 21], [13, 2.7], [22, -2.7], [-22, 2.7]] as const) T('structures/modular-streetlamp.glb', x, z, { h: 3.3 });
  T('props/mailbox.glb', -6.2, -11.6, { h: 1.2, role: 'post-office', name: 'Mailbox' });
  T('props/sandwich-board.glb', -15.5, -11.3, { h: 1 });
  T('city/fireHydrant.glb', 2.8, -9.5, { h: 0.7 });
  T('city/garbageBin.glb', -2.8, 9.6, { h: 0.9 });
  // Park (south-west)
  T('structures/gazebo.glb', -14, 16, { w: 6, role: 'game-dashboard', name: 'Game Gazebo', solid: true });
  T('props/park/park-slide.glb', -6.5, 14.5, { w: 3, role: 'shape-dash', name: 'Shape Dash Slide', solid: true });
  T('props/park/park-swings.glb', -20, 12.5, { w: 4, solid: true });
  T('props/park/park-carousel.glb', -19.5, 21, { w: 4, solid: true });
  T('props/park/park-picnic-table.glb', -8, 21.5, { w: 2.4, solid: true });
  T('interior/chess-set.glb', -8, 21.5, { w: 0.9, role: 'chess', name: 'Slime Chess', onPrev: true });
  T('props/park/park-picnic-table.glb', -12.5, 22.5, { w: 2.4, r: 0.4, solid: true });
  T('props/park-info-board.glb', -3.4, 10, { h: 1.8, r: PI / 2, role: 'welcome-center', name: 'Welcome Center' });
  T('pets/animal-dog.glb', -9, 12.5, { h: 0.6, r: 0.8 });
  T('pets/animal-cat.glb', -15.6, 19.4, { h: 0.45, r: -2 });
  // Pond (south-east): dock to the island, a rowboat, ducks on the shore
  T('camping/Fishing_Dock_A.glb', 8.6, 16.5, { w: 4.5, r: PI / 2, role: 'island-dock', name: 'Island Dock' });
  T('pirate/boat-row-small.glb', 15, 16.5, { w: 2.6, r: 0.6 });
  T('pets/animal-duck.glb', 8.4, 22.6, { h: 0.45, r: 1 });
  T('pets/animal-duck.glb', 20.6, 21.4, { h: 0.45, r: -0.5 });
  T('water/Anchor_A.glb', 7.4, 19, { h: 0.8, r: 0.4 });
  T('water/Bait_Box_A.glb', 7.2, 14.2, { h: 0.5 });
  T('city/bench2.glb', 11.2, 24.2, { w: 2, r: PI });
  T('buildings/house.glb', 21.8, 12.6, { w: 4.6, r: -PI / 2, role: 'home', name: 'My Home', solid: true });
  T('farm/small-barn.glb', 6.4, 22.3, { w: 4.4, r: PI, role: 'pet-shelter', name: 'Pet Shelter', solid: true });
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * 2 * PI + 0.2;
    const x = POND.x + Math.cos(a) * POND.rx * 1.08, z = POND.z + Math.sin(a) * POND.rz * 1.1;
    if (x < 10 && Math.abs(z - 16.5) < 2.2) continue;
    if (x > 19 && z < 15) continue;
    T(k % 3 === 0 ? 'nature/fern.glb' : k % 3 === 1 ? 'nature/tropical-plant.glb' : 'nature/fern-plant.glb', x, z, { h: k % 3 === 1 ? 1.1 : 0.8, r: a });
  }
  // Trees around the edge (a gap for every street)
  const rnd = rng(7);
  const kinds = ['nature/painted-pine-big-1.glb', 'nature/shaped-tree-round.glb', 'nature/painted-pine-big-3.glb', 'nature/shaped-tree-oval.glb', 'nature/shaped-tree-conical.glb'];
  const put = (x: number, z: number) => { const k = Math.floor(rnd() * kinds.length); T(kinds[k], x, z, { h: 4.5 + rnd() * 2.5, r: rnd() * 6.28, solid: true }); };
  for (let x = -23; x <= 23; x += 3.8) if (Math.abs(x) > 3.5) put(x + (rnd() - 0.5), -23.2 + (rnd() - 0.5));
  for (let z = -19; z <= 23; z += 4) if (Math.abs(z) > 3.5 && !(z > -10 && z < -2) && !(z > 2 && z < 10)) put(-23.5, z);
  for (let z = -19; z <= 23; z += 4) if (Math.abs(z) > 3.5 && z < 9) put(23.5, z);
  for (let x = -23; x <= 23; x += 4) if (Math.abs(x) > 3.5 && x < 2) put(x, 24);
  put(-11, 9.6); put(-24, 24); put(23.8, 24);
  return t;
}

// ───────────── Enchanted Forest, 30 x 30, west of the town ─────────────
// Laid out in its own space (path entering from local +z), then turned so the path meets the
// town's west street: world x = FX + local z, world z = FZ - local x.
const FX = -40, FZ = 0;
export const FOREST_RECT = { x1: -55, x2: -25, z1: -15, z2: 15 };
const toWorld = (lx: number, lz: number): [number, number] => [FX + lz, FZ - lx];
const STREAM: [number, number][] = [[-16, -8], [-10, -4.5], [-4, 0.5], [2, 2.2], [8, 1.2], [16, 4]];
const PATH: [number, number][] = [[0.5, 15], [1.5, 10.5], [-0.6, 6], [-0.3, 1.4], [-1.6, -2.5], [-3.5, -5.5], [0.5, -9], [6, -11.5], [9.5, -15]];
const CLEAR = { x: -4, z: -6.5, r: 4.6 };
const RING = { x: 7.5, z: 8, r: 2.3 };
function forestLocalHeight(x: number, z: number) {
  let h = 0.35 * Math.sin(x * 0.33 + 1) * Math.cos(z * 0.27) + 0.25 * Math.sin(z * 0.5 + x * 0.12);
  h += 1.6 * smooth(6, 0, Math.hypot(x + 11, z + 11)) + 1.2 * smooth(5, 0, Math.hypot(x - 11, z - 11));
  const dc = Math.hypot(x - CLEAR.x, z - CLEAR.z);
  h = h * smooth(CLEAR.r - 1, CLEAR.r + 2, dc) + 0.1 * (1 - smooth(CLEAR.r - 1, CLEAR.r + 2, dc));
  const ds = distLine(x, z, STREAM);
  if (ds < 2.6) { const f = 1 - (ds / 2.6) ** 2; h = h * (1 - f) + -1.1 * f; }
  // Settle to flat ground at the forest's edges so it meets the town smoothly.
  return h * smooth(15, 12.5, Math.max(Math.abs(x), Math.abs(z)));
}
function worldHeight(x: number, z: number) {
  if (x >= FOREST_RECT.x2) return townHeight(x, z);
  const lx = FZ - z, lz = x - FX;
  if (Math.abs(lx) > 15 || Math.abs(lz) > 15) return 0;
  return forestLocalHeight(lx, lz);
}
function forestItems(): Item[] {
  const f: Item[] = [];
  const F = (m: string, lx: number, lz: number, o: Partial<Item> = {}) => {
    const [x, z] = toWorld(lx, lz);
    f.push({ m: M(m), x, z, ...o, r: (o.r ?? 0) + PI / 2 });
  };
  // The alchemist's clearing
  F('fantasy/Cauldron_A.glb', -4, -6.6, { h: 0.9 });
  F('creatures/blob-wizard.glb', -5.6, -5.2, { h: 1.1, r: 2.2 });
  F('fantasy/Brazier_A.glb', -1.6, -8.4, { h: 1.3 });
  F('fantasy/Alchemy_Bench_A.glb', -7.6, -5.4, { w: 2.4, r: PI / 2, solid: true });
  F('fantasy/Armillary_Sphere.glb', -2.2, -3.6, { h: 1.6 });
  F('fantasy/Bookcase_A.glb', -7.8, -8.4, { h: 1.9, r: PI / 3, solid: true });
  F('fantasy/Barrel_A.glb', -6.4, -9.4, { h: 0.9 });
  F('fantasy/Armor_Stand_A.glb', -0.6, -6, { h: 1.7, r: -PI / 2 });
  // The great tree, with the Tree Library's door at its roots
  F('nature/huge-tree.glb', -9.5, -11, { h: 11, solid: true });
  F('fantasy/Arched_Door_A.glb', -8.2, -9.4, { h: 2.3, r: 0.75, role: 'library', name: 'Tree Library' });
  // Crystals
  for (const [x, z, h] of [[-6.6, -9.8, 1.3], [3.2, -11.6, 1.9], [-12, 3.5, 1.4], [10.5, 9.8, 1.7], [5.8, 4.6, 1.0], [-12.5, -2.5, 1.2], [12.5, -6, 1.5]] as const) F('fantasy/Crystal_Cluster_A.glb', x, z, { h, r: x });
  // Fairy ring with the Mushroom King
  for (let k = 0; k < 11; k++) { const a = (k / 11) * 2 * PI; F(k % 2 ? 'nature/blocky-mushroom-01.glb' : 'nature/blocky-mushroom-02.glb', RING.x + Math.cos(a) * RING.r, RING.z + Math.sin(a) * RING.r, { h: 0.55 + (k % 3) * 0.15, r: a }); }
  F('creatures/big-MushroomKing.gltf', RING.x, RING.z, { h: 1.5, r: -2.4 });
  F('props/mushroom.glb', 11.5, 12.5, { h: 3.2, r: 1, solid: true });
  F('props/mushroom.glb', -12.4, 11.5, { h: 2.6, r: 2, solid: true });
  F('props/mushroom.glb', 3.5, 12.6, { h: 1.8, r: 0.2 });
  // The cabin at the end of the path: Castle Defense
  F('buildings/log-cabin.glb', 10, -6.2, { w: 6.5, r: -PI / 2, role: 'castle', name: 'Castle Defense Cabin', solid: true });
  // Bridge over the stream, lanterns along the path
  F('props/bridge.glb', -0.3, 1.4, { w: 6, r: PI / 2 + 0.25 });
  for (const [x, z] of [[2.6, 12], [-2.2, 7.5], [1.6, -1.8], [-1, -10.4], [5.6, -9.6], [8.4, -13.6]] as const) F('halloween/post_lantern.gltf', x, z, { h: 2.3, r: x });
  // Animals
  F('pets/animal-deer.glb', 9.5, 4.3, { h: 1.3, r: -2.6 });
  F('pets/animal-fox.glb', -10.5, 6.5, { h: 0.6, r: 0.6 });
  F('pets/animal-bunny.glb', 4.5, 9.5, { h: 0.35, r: 2 });
  F('creatures/blob-mushnub.glb', 9.6, 6.6, { h: 0.6, r: -1.5 });
  // The woods
  const rnd = rng(42);
  const blocked = (x: number, z: number, pad: number) =>
    distLine(x, z, PATH) < 1.7 + pad || distLine(x, z, STREAM) < 2.5 + pad * 0.5 ||
    Math.hypot(x - CLEAR.x, z - CLEAR.z) < CLEAR.r + 0.8 + pad || Math.hypot(x - RING.x, z - RING.z) < RING.r + 1 + pad ||
    (x > 6 && x < 14 && z > -10 && z < -2.5) || Math.hypot(x + 9.5, z + 11) < 2.8;
  const TREES: [string, number, number][] = [
    ['nature/strange-tree.glb', 5, 7.5], ['nature/strange-tree-young.glb', 3, 4.5], ['nature/painted-pine-big-1.glb', 6, 8.5], ['nature/painted-pine-big-2.glb', 6, 8.5],
    ['nature/painted-pine-big-4.glb', 6, 8.5], ['nature/pine-tree.glb', 6, 8], ['nature/strange-tree.glb', 5.5, 8], ['nature/huge-tree.glb', 7, 9], ['nature/tropical-plant-big.glb', 2.2, 3],
  ];
  const placed: [number, number][] = [];
  for (let tries = 0; tries < 4000 && placed.length < 64; tries++) {
    const x = (rnd() * 2 - 1) * 14.4, z = (rnd() * 2 - 1) * 14.4;
    if (blocked(x, z, 0.4) || placed.some(([px, pz]) => Math.hypot(px - x, pz - z) < 2.5)) continue;
    placed.push([x, z]);
    const [m, lo, hi] = TREES[Math.floor(rnd() * TREES.length)];
    F(m, x, z, { h: lo + rnd() * (hi - lo), r: rnd() * 6.28, solid: true });
  }
  const UNDER: [string, number, number][] = [
    ['nature/fern.glb', 0.6, 1], ['nature/fern-plant.glb', 0.7, 1.1], ['nature/tropical-plant.glb', 0.9, 1.4], ['nature/vegetation-bush01.glb', 0.9, 1.4],
    ['nature/vegetation-bush02.glb', 0.9, 1.4], ['nature/strange-tree-bush-foliage.glb', 1, 1.6], ['nature/strange-vegetation.glb', 0.8, 1.3], ['nature/painted-bush-011.glb', 0.8, 1.2],
    ['nature/painted-bush-031.glb', 0.8, 1.2], ['nature/rock-cluster.glb', 0.5, 1.0], ['nature/painted-weed-021.glb', 0.4, 0.7], ['nature/painted-flower-2.glb', 0.4, 0.6],
    ['nature/painted-flower-4.glb', 0.4, 0.6], ['nature/painted-grass-002.glb', 0.3, 0.5], ['nature/blocky-mushroom-01.glb', 0.3, 0.5],
  ];
  const under: [number, number][] = [];
  for (let tries = 0; tries < 6000 && under.length < 140; tries++) {
    const x = (rnd() * 2 - 1) * 14.6, z = (rnd() * 2 - 1) * 14.6;
    if (distLine(x, z, PATH) < 1.3 || distLine(x, z, STREAM) < 1.9 || Math.hypot(x - CLEAR.x, z - CLEAR.z) < CLEAR.r - 0.6 || Math.hypot(x - RING.x, z - RING.z) < RING.r + 0.4) continue;
    if ((x > 6.5 && x < 13.5 && z > -9.5 && z < -3) || under.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1.0)) continue;
    under.push([x, z]);
    const [m, lo, hi] = UNDER[Math.floor(rnd() * UNDER.length)];
    F(m, x, z, { h: lo + rnd() * (hi - lo), r: rnd() * 6.28 });
  }
  for (let k = 0; k < 16; k++) {
    const s = rnd() * (STREAM.length - 1); const i = Math.floor(s), u = s - i;
    const [ax, az] = STREAM[i], [bx, bz] = STREAM[i + 1];
    const x0 = ax + (bx - ax) * u, z0 = az + (bz - az) * u; const L = Math.hypot(bx - ax, bz - az);
    const side = rnd() < 0.5 ? -1 : 1, off = 1.9 + rnd() * 0.5;
    const x = x0 - ((bz - az) / L) * off * side, z = z0 + ((bx - ax) / L) * off * side;
    if (Math.abs(x) > 14.5 || Math.abs(z) > 14.5 || distLine(x, z, PATH) < 1.8) continue;
    F(k % 2 ? `nature/blocky-stone-0${1 + (k % 4)}.glb` : 'nature/painted-grass-003.glb', x, z, { h: k % 2 ? 0.35 + rnd() * 0.3 : 0.6, r: rnd() * 6.28 });
  }
  // The corners of the west land beside the forest: a few pines
  const rnd2 = rng(11);
  for (const zs of [-1, 1]) for (let x = -53; x <= -27; x += 4.2) for (const z of [zs * 18.5, zs * 22.5]) {
    if (rnd2() < 0.25) continue;
    f.push({ m: M(rnd2() < 0.5 ? 'nature/painted-pine-big-2.glb' : 'nature/pine-tree.glb'), x: x + (rnd2() - 0.5) * 1.5, z: z + (rnd2() - 0.5) * 1.5, h: 5 + rnd2() * 2.5, r: rnd2() * 6.28, solid: true });
  }
  return f;
}

export function newPaths(): GroundPath[] {
  const fp = PATH.map(([x, z]) => toWorld(x, z));
  return [
    { id: 'forest-floor', name: 'Forest floor', pts: [[FOREST_RECT.x1, 0], [FOREST_RECT.x2, 0]], width: 30, tex: FOREST_FLOOR, lift: 0.02, overWater: false },
    { id: 'square', name: 'The square', pts: [[-8, 0], [8, 0]], width: 16, tex: PAVING, lift: 0.045, overWater: true },
    { id: 'north-street', name: 'North street', pts: [[0, -8], [0, -25]], width: 4, tex: BRICK, overWater: true },
    { id: 'south-street', name: 'South street', pts: [[0, 8], [0, 25]], width: 4, tex: BRICK, overWater: true },
    { id: 'east-street', name: 'East street', pts: [[8, 0], [25, 0]], width: 4, tex: BRICK, overWater: true },
    { id: 'west-street', name: 'West street', pts: [[-8, 0], [-25, 0]], width: 4, tex: BRICK, overWater: true },
    { id: 'pond-path', name: 'Pond path', pts: [[2, 12.5], [5.5, 15.5], [7, 16.5]], width: 1.8, tex: DIRT, overWater: false },
    { id: 'park-path', name: 'Park path', pts: [[-2, 12], [-6, 17], [-10.5, 16.5]], width: 1.8, tex: DIRT, overWater: false },
    { id: 'picnic-path', name: 'Picnic path', pts: [[-6, 17], [-8, 20]], width: 1.6, tex: DIRT, overWater: false },
    { id: 'forest-path', name: 'Forest path', pts: fp, width: 2.1, tex: DIRT, lift: 0.05, overWater: false },
  ];
}

const isTown = (o: WorldObject) => !o.studentId;
const strip = (o: WorldObject): Omit<WorldObject, 'id' | 'createdAt'> => {
  const { id: _i, createdAt: _c, status: _s, pendingDelete: _p, publishedSnapshot: _ps, ...rest } = o; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
};
const look = (owner: string) => useStore.getState().styleLooks.find((r) => r.ownerId === owner)?.look ?? null;

function setBounds(target: GroundBounds) {
  const st = useStore.getState();
  for (const edge of ['north', 'south', 'east', 'west'] as const) {
    const d = target[edge] - st.groundBounds[edge];
    if (d) useStore.getState().expandGroundBounds(edge, d);
  }
}
function setTerrainFrom(fn: (x: number, z: number) => number, ext: number) {
  const t = makeTerrain(ext);
  for (let j = 0; j < t.n; j++) for (let i = 0; i < t.n; i++) t.h[j * t.n + i] = fn(-t.ext + i * t.cell, -t.ext + j * t.cell);
  setTerrain(t);
  useStore.getState().mergeStyleRow(TERRAIN_OWNER, encodeTerrain(t) as unknown as Record<string, unknown>);
}

// Build the new town. `onProgress` gets 0..1.
export async function buildNewTown(onProgress: (f: number) => void): Promise<void> {
  const st = useStore.getState();
  // 1. Save everything the old design had.
  const published = resolveDraftRows(st.worldObjects.filter(isTown), false);
  const backup: BackupRow = {
    objects: published.map(strip),
    patches: st.groundPatches.map((p) => ({ x: p.x, z: p.z, radius: p.radius, texturePath: p.texturePath })),
    terrain: look(TERRAIN_OWNER), regions: look(REGIONS_OWNER), homes: look(HOMES_OWNER), paths: look(PATHS_OWNER),
    bounds: { ...st.groundBounds }, groundTexture: st.groundTexture, at: new Date().toISOString(),
  };
  st.mergeStyleRow(BACKUP_OWNER, backup as unknown as Record<string, unknown>);
  onProgress(0.05);
  // 2. Size every model to its real height.
  const items = [...townItems(), ...forestItems()];
  const rule = !!(look(WORLD_SIZE_OWNER) as WorldSizeRow | null)?.on;
  const paths = [...new Set(items.map((i) => i.m))];
  const raw = new Map<string, { x: number; y: number; z: number }>();
  for (let k = 0; k < paths.length; k += 8) {
    const batch = paths.slice(k, k + 8);
    const sizes = await Promise.all(batch.map((p) => measureModel(p)));
    batch.forEach((p, i) => { const s = sizes[i]; if (s && s.y > 0) raw.set(p, { x: s.x, y: s.y, z: s.z }); });
    onProgress(0.05 + 0.45 * Math.min(1, (k + 8) / paths.length));
  }
  // 3. Clear the old design.
  for (const o of useStore.getState().worldObjects.filter(isTown)) useStore.getState().deleteWorldObject(o.id);
  for (const p of [...useStore.getState().groundPatches]) useStore.getState().deleteGroundPatch(p.id);
  if ((look(HOMES_OWNER) as { side?: string } | null)?.side === 'north' || (look(HOMES_OWNER) as { side?: string } | null)?.side === 'south') removeHomes();
  // 4. The land: size, shape, regions, paths, ground.
  setBounds(TOWN_BOUNDS);
  setTerrainFrom(worldHeight, groundBoundsMaxExtent(TOWN_BOUNDS));
  const base = (look(REGIONS_OWNER) as Partial<RegionsRow> | null)?.base;
  saveRegions({ base: base?.trim() || 'Yoglandia Town Square', list: [{ id: 'rg_enchanted_forest', name: 'Enchanted Forest', side: 'west', ...FOREST_RECT }] });
  savePaths(newPaths());
  useStore.getState().setGroundTexture(null);
  onProgress(0.6);
  // 5. Place everything.
  let prevTop = 0;
  items.forEach((it, n) => {
    const s = raw.get(it.m);
    if (!s) return;
    const k = rule ? townSizeFactor(s) : 1;
    let scale = Infinity;
    if (it.h) scale = Math.min(scale, it.h / (s.y * k));
    if (it.w) scale = Math.min(scale, it.w / (Math.max(s.x, s.z) * k));
    if (!isFinite(scale)) scale = 1;
    const y = it.onPrev ? prevTop : 0;
    prevTop = s.y * k * scale;
    useStore.getState().addWorldObject({
      modelPath: it.m, label: it.name ?? it.m.split('/').pop()!.replace(/\.(glb|gltf)$/, '').replace(/[-_]/g, ' '),
      customName: it.name, role: it.role, position: [Math.round(it.x * 1000) / 1000, Math.round(y * 1000) / 1000, Math.round(it.z * 1000) / 1000],
      rotationY: Math.round(((it.r ?? 0) % (2 * PI)) * 10000) / 10000, scale: Math.round(scale * 100000) / 100000, collides: !!it.solid,
    });
    if (n % 25 === 0) onProgress(0.6 + 0.35 * (n / items.length));
  });
  // 6. Students see it right away.
  useStore.getState().publishWorldDraft();
  useStore.getState().mergeStyleRow(REMAKE_OWNER, { state: 'built', at: new Date().toISOString(), bannerClosed: false });
  onProgress(1);
}

// Put the old design back exactly as it was saved.
export function restoreOldTown(): boolean {
  const b = look(BACKUP_OWNER) as BackupRow | null;
  if (!b || !Array.isArray(b.objects)) return false;
  const st = useStore.getState();
  for (const o of st.worldObjects.filter(isTown)) useStore.getState().deleteWorldObject(o.id);
  for (const p of [...useStore.getState().groundPatches]) useStore.getState().deleteGroundPatch(p.id);
  b.objects.forEach((o) => useStore.getState().addWorldObject(o));
  b.patches.forEach((p) => useStore.getState().addGroundPatch(p));
  setBounds(b.bounds);
  const t = decodeTerrain(b.terrain);
  if (t) { setTerrain(t); st.mergeStyleRow(TERRAIN_OWNER, encodeTerrain(t) as unknown as Record<string, unknown>); }
  else setTerrainFrom(() => 0, groundBoundsMaxExtent(b.bounds));
  const r = b.regions as Partial<RegionsRow> | null;
  saveRegions({ base: r?.base?.trim() || 'Yoglandia Town Square', list: Array.isArray(r?.list) ? r!.list : [] });
  const h = b.homes as Partial<HomesRow> | null;
  if (h && (h.side === 'north' || h.side === 'south')) saveHomes(h as HomesRow);
  savePaths(Array.isArray((b.paths as { list?: GroundPath[] } | null)?.list) ? (b.paths as { list: GroundPath[] }).list : []);
  useStore.getState().setGroundTexture(b.groundTexture ?? null);
  useStore.getState().publishWorldDraft();
  useStore.getState().mergeStyleRow(REMAKE_OWNER, { state: 'restored', at: new Date().toISOString(), bannerClosed: false });
  return true;
}
