// The Plant Maker (Build Queue 157, her words 2026-10-14: "similar to creature maker, lets add an abiklity
// to create plants that exsist within the biomes"). A plant is built from real plant parts, and the parts
// decide where it can live, with the real reason (a thick stem stores water for the desert, needle leaves
// shed snow, a hollow reed stem breathes in swamp mud, a holdfast and air bladders keep kelp in the sea).
// Drawn as a 32x32 pixel sprite like the other Habitat plants. Pure data and drawing: no React.
import type { PlantKind, PlantPlace } from './supernaturePlants';

export type Root = 'tap' | 'bulb' | 'creeping' | 'anchor' | 'air';
export type Stem = 'woody' | 'vine' | 'succulent' | 'reed' | 'none';
export type Leaf = 'broad' | 'needle' | 'spine' | 'waxy' | 'pad' | 'frond' | 'blade';
export type Bloom = 'none' | 'bell' | 'star' | 'berry' | 'pod' | 'glow' | 'trap';
export interface PlantSpec { root: Root; stem: Stem; leaf: Leaf; bloom: Bloom; main: string; accent: string }
export interface MadePlant { id: string; name: string; spec: PlantSpec; kind: PlantKind; sentence?: string; at: string }

export const ROOTS: { id: Root; label: string; does: string }[] = [
  { id: 'tap', label: 'Long taproot', does: 'reaches deep water underground' },
  { id: 'bulb', label: 'Bulb', does: 'stores food to wait out winter or dry times' },
  { id: 'creeping', label: 'Creeping roots', does: 'spreads sideways and grows back after fire or grazing' },
  { id: 'anchor', label: 'Holdfast', does: 'grips rocks so waves cannot wash it away' },
  { id: 'air', label: 'Air bladders', does: 'little air balloons float its leaves up to the sunlight' },
];
export const STEMS: { id: Stem; label: string; does: string }[] = [
  { id: 'woody', label: 'Woody trunk', does: 'stands tall and strong for years' },
  { id: 'vine', label: 'Climbing vine', does: 'climbs up trees to reach the light' },
  { id: 'succulent', label: 'Thick stem', does: 'stores water like a cactus' },
  { id: 'reed', label: 'Hollow reed', does: 'hollow tubes carry air down to roots in wet mud' },
  { id: 'none', label: 'No stem', does: 'grows low to the ground, out of the wind' },
];
export const LEAVES: { id: Leaf; label: string; does: string }[] = [
  { id: 'broad', label: 'Big flat leaves', does: 'catch lots of light in a shady forest' },
  { id: 'needle', label: 'Needles', does: 'thin and tough, they shed snow and keep water in' },
  { id: 'spine', label: 'Spines', does: 'lose very little water, and nothing wants to eat them' },
  { id: 'waxy', label: 'Waxy leaves', does: 'a wax coat keeps water in and cold out' },
  { id: 'pad', label: 'Floating pads', does: 'float flat on the water to catch the sun' },
  { id: 'frond', label: 'Fronds', does: 'long soft leaves that sway in water or shade' },
  { id: 'blade', label: 'Grass blades', does: 'grow from the bottom, so grazing does not stop them' },
];
export const BLOOMS: { id: Bloom; label: string; does: string }[] = [
  { id: 'none', label: 'None', does: 'no flowers' },
  { id: 'bell', label: 'Bell flowers', does: 'hang down to keep pollen dry' },
  { id: 'star', label: 'Star flowers', does: 'open wide for bees and butterflies' },
  { id: 'berry', label: 'Berries', does: 'animals eat them and spread the seeds' },
  { id: 'pod', label: 'Seed pods', does: 'pop open to fling seeds far away' },
  { id: 'glow', label: 'Glowing bulbs', does: 'glow in the dark (bioluminescence) to call night insects' },
  { id: 'trap', label: 'Snapping trap', does: 'catches bugs for food, like a Venus flytrap' },
];
export const PLANT_COLORS = ['#3f8f4a', '#6cbf5a', '#2fa89a', '#9fd34e', '#c98b5a', '#8c5ad1', '#e0457a', '#e0452f', '#f2783a', '#f2c14e', '#f6f1ff', '#3a6fd1', '#9fe3ff', '#2d2a3a'];
export const DEFAULT_PLANT: PlantSpec = { root: 'tap', stem: 'woody', leaf: 'broad', bloom: 'star', main: '#3f8f4a', accent: '#e0457a' };
export const KIND_CHOICES: { id: PlantKind; label: string; alchemy: string }[] = [
  { id: 'healing', label: '💚 Healing', alchemy: 'Heals: a plant medicine for potions.' },
  { id: 'food', label: '🍽️ Food', alchemy: 'Feeds: plant eaters love it, and it makes a good potion base.' },
  { id: 'magic', label: '✨ Magic', alchemy: 'Magic: a rare plant for spell potions.' },
  { id: 'harmful', label: '⚠️ Harmful', alchemy: 'Harmful: admire it, but never eat it or put it in a potion.' },
];
export const PLANT_WORD_PARTS: { part: string; means: string }[] = [
  { part: 'phyto', means: 'plant' }, { part: 'phyll', means: 'leaf' }, { part: 'flor', means: 'flower' }, { part: 'rhiz', means: 'root' },
  { part: 'dendr', means: 'tree' }, { part: 'xero', means: 'dry' }, { part: 'cryo', means: 'cold' }, { part: 'hydro', means: 'water' },
  { part: 'thalass', means: 'sea' }, { part: 'lumin', means: 'light' }, { part: 'carn', means: 'meat' }, { part: 'spin', means: 'thorn' },
  { part: 'chloro', means: 'green' }, { part: 'helio', means: 'sun' }, { part: 'noct', means: 'night' }, { part: 'macro', means: 'big' },
];

const PLACES: PlantPlace[] = ['grassland', 'forest', 'desert', 'snow', 'swamp', 'ocean'];
// Each part scores the lands it is really built for. 2 points or more means it can live there.
const SCORE: Record<string, Partial<Record<PlantPlace, number>>> = {
  'root:tap': { desert: 1, grassland: 1 }, 'root:bulb': { snow: 1, desert: 1, grassland: 1 }, 'root:creeping': { grassland: 1, swamp: 1, forest: 1 },
  'root:anchor': { ocean: 2 }, 'root:air': { ocean: 1, swamp: 1 },
  'stem:woody': { forest: 2, snow: 1 }, 'stem:vine': { forest: 2 }, 'stem:succulent': { desert: 2 }, 'stem:reed': { swamp: 2 }, 'stem:none': { snow: 1, grassland: 1, ocean: 1 },
  'leaf:broad': { forest: 1, swamp: 1 }, 'leaf:needle': { snow: 2, forest: 1 }, 'leaf:spine': { desert: 2 }, 'leaf:waxy': { desert: 1, snow: 1 },
  'leaf:pad': { swamp: 2 }, 'leaf:frond': { ocean: 1, forest: 1, swamp: 1 }, 'leaf:blade': { grassland: 2 },
};
const NO: Partial<Record<PlantPlace, string[]>> = { ocean: ['stem:woody', 'stem:succulent', 'leaf:spine', 'leaf:needle'], desert: ['leaf:pad', 'root:anchor'], snow: ['leaf:pad', 'stem:succulent'] };
export function whereItLives(s: PlantSpec): { where: PlantPlace[]; why: Partial<Record<PlantPlace, string[]>> } {
  const parts = [`root:${s.root}`, `stem:${s.stem}`, `leaf:${s.leaf}`];
  const label = (p: string) => { const [k, v] = p.split(':'); const list = k === 'root' ? ROOTS : k === 'stem' ? STEMS : LEAVES; const x = (list as { id: string; label: string; does: string }[]).find((y) => y.id === v)!; return `${x.label.toLowerCase()} ${x.does}`; };
  const where: PlantPlace[] = []; const why: Partial<Record<PlantPlace, string[]>> = {};
  for (const pl of PLACES) {
    if (parts.some((p) => NO[pl]?.includes(p))) continue;
    const helps = parts.filter((p) => (SCORE[p]?.[pl] ?? 0) > 0);
    if (helps.reduce((n, p) => n + (SCORE[p]![pl] ?? 0), 0) >= 2) { where.push(pl); why[pl] = helps.map(label); }
  }
  return { where, why };
}

// ---- drawing: 32x32 pixels, outlined like the other Habitat sprites ----
const N = 32;
const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const shade = (h: string, k: number) => `#${hex(h).map((v) => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0')).join('')}`;
export function drawPlant(s: PlantSpec, withRoots = false): ImageData {
  const g: (string | null)[] = Array(N * N).fill(null);
  const px = (x: number, y: number, c: string) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) g[y * N + x] = c; };
  const rect = (x: number, y: number, w: number, h: number, c: string) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
  const blob = (cx: number, cy: number, rx: number, ry: number, c: string) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) if ((x * x) / (rx * rx + 0.1) + (y * y) / (ry * ry + 0.1) <= 1) px(cx + x, cy + y, c); };
  const base = withRoots ? 25 : 30;
  const leafC = s.main, leafD = shade(s.main, 0.72), stemC = s.stem === 'woody' ? '#7a4a2e' : shade(s.main, 0.8);
  if (withRoots) {
    rect(0, base + 1, N, N - base - 1, '#6b4a2f');
    const rc = '#e8c27a';
    if (s.root === 'tap') for (let y = base + 1; y < N; y++) px(16, y, rc);
    if (s.root === 'bulb') blob(16, base + 3, 3, 2, '#f6f1ff');
    if (s.root === 'creeping') for (let x = 6; x < 26; x++) px(x, base + 2 + (x % 3 === 0 ? 1 : 0), rc);
    if (s.root === 'anchor') { rect(12, base + 1, 9, 2, '#8f8aa8'); for (let x = 12; x < 21; x += 2) px(x, base + 3, rc); }
    if (s.root === 'air') { blob(12, base - 6, 1, 1, '#9fe3ff'); blob(20, base - 9, 1, 1, '#9fe3ff'); }
  }
  // stem, and the points where leaves grow
  const at: [number, number][] = [];
  let top = base - 18;
  if (s.stem === 'woody') { rect(15, base - 16, 3, 17, stemC); top = base - 18; at.push([16, base - 18], [12, base - 13], [20, base - 11], [11, base - 7], [21, base - 5]); }
  else if (s.stem === 'vine') { for (let y = base; y > base - 22; y--) px(16 + Math.round(Math.sin(y / 2.5) * 3), y, stemC); top = base - 22; for (let y = base - 3; y > base - 22; y -= 4) at.push([16 + Math.round(Math.sin(y / 2.5) * 3) + (y % 8 ? 3 : -3), y]); }
  else if (s.stem === 'succulent') { blob(16, base - 9, 4, 10, leafC); rect(9, base - 12, 3, 6, leafC); rect(9, base - 7, 4, 2, leafC); rect(21, base - 16, 3, 7, leafC); rect(19, base - 10, 4, 2, leafC); for (let y = base - 17; y < base; y += 3) px(16, y, leafD); top = base - 19; at.push([16, base - 19], [10, base - 12], [22, base - 16]); }
  else if (s.stem === 'reed') { for (const x of [12, 16, 20]) for (let y = base; y > base - (x === 16 ? 24 : 18); y--) px(x, y, stemC); top = base - 24; at.push([16, base - 24], [12, base - 18], [20, base - 18]); }
  else { top = base - 6; at.push([10, base - 3], [16, base - 6], [22, base - 3]); }
  // leaves
  for (const [x, y] of at) {
    if (s.leaf === 'broad') { blob(x, y, 4, 2, leafC); px(x - 2, y, leafD); px(x, y, leafD); px(x + 2, y, leafD); }
    if (s.leaf === 'waxy') { blob(x, y, 3, 2, leafC); px(x - 1, y - 1, '#f6f1ff'); }
    if (s.leaf === 'needle') for (let k = -3; k <= 3; k++) { px(x + k, y - Math.abs(k) / 2, leafC); px(x + k, y + 1 - Math.abs(k) / 2, leafD); }
    if (s.leaf === 'spine') { for (const [dx, dy] of [[-2, -1], [2, -1], [-3, 1], [3, 1], [0, -2]]) px(x + dx, y + dy, '#f6f1ff'); if (s.stem !== 'succulent') blob(x, y, 2, 1, leafC); }
    if (s.leaf === 'frond') for (let k = 0; k < 8; k++) { px(x - k, y - Math.round(Math.sin(k / 3) * 3), leafC); px(x + k, y - Math.round(Math.sin(k / 3) * 3), leafD); }
    if (s.leaf === 'blade') for (let k = 0; k < 6; k++) { px(x - 2 + k / 3, y - k, leafC); px(x + 2 - k / 3, y - k, leafD); }
  }
  if (s.leaf === 'pad') { blob(9, base, 5, 1, leafC); blob(23, base, 5, 1, leafD); px(9, base, shade(leafC, 0.6)); }
  if (s.leaf === 'blade') for (let k = 0; k < 9; k++) { px(6 + k * 2.4, base - (k % 2 ? 7 : 10), leafC); for (let y = base; y > base - (k % 2 ? 7 : 10); y--) px(6 + k * 2.4, y, k % 2 ? leafD : leafC); }
  // flowers and fruit near the top
  const tops: [number, number][] = [[16, Math.max(2, top - 1)], ...(at.length > 2 ? [at[1], at[2]] : [])];
  for (const [x, y] of tops) {
    const a = s.accent, aD = shade(s.accent, 0.7);
    if (s.bloom === 'bell') { rect(x - 1, y, 3, 2, a); px(x - 1, y + 2, aD); px(x + 1, y + 2, aD); }
    if (s.bloom === 'star') { px(x, y, '#f2c14e'); for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [0, -2], [0, 2], [-2, 0], [2, 0]]) px(x + dx, y + dy, dx && dy ? aD : a); }
    if (s.bloom === 'berry') { px(x - 1, y, a); px(x + 1, y + 1, a); px(x, y + 2, aD); }
    if (s.bloom === 'pod') rect(x - 1, y - 1, 2, 4, aD);
    if (s.bloom === 'glow') { blob(x, y, 2, 2, a); px(x, y, '#ffffff'); }
    if (s.bloom === 'trap') { rect(x - 3, y - 1, 7, 1, a); rect(x - 3, y + 2, 7, 1, a); for (let k = -3; k <= 3; k += 2) { px(x + k, y, '#f6f1ff'); px(x + k, y + 1, '#f6f1ff'); } }
  }
  // outline
  const out = g.slice();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (g[y * N + x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => g[(y + dy) * N + (x + dx)] && x + dx >= 0 && x + dx < N && y + dy >= 0 && y + dy < N)) out[y * N + x] = '#241f45';
  }
  const img = new ImageData(N, N);
  out.forEach((c, i) => { if (!c) return; const [r, gg, b] = hex(c); img.data.set([r, gg, b, 255], i * 4); });
  return img;
}
const cache = new Map<string, string>();
export function plantUrl(s: PlantSpec, withRoots = false): string {
  const key = JSON.stringify(s) + withRoots;
  const hit = cache.get(key); if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas'); cv.width = N; cv.height = N;
  cv.getContext('2d')!.putImageData(drawPlant(s, withRoots), 0, 0);
  const url = cv.toDataURL('image/png'); cache.set(key, url); return url;
}
