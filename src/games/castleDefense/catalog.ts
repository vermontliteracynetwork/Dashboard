// Castle Defense catalog (teacher 2026-10-08: "lets use the new castle defense art with the old,
// expanding the catelog of options for the game"). The original three towers and four raiders
// stay; her CraftPix and Foozle packs add seven towers, fifteen animated attackers in two new
// attacker themes, the overgrown portal they pour out of, the Wisp builder and the townspeople.
// Tower pictures for the new towers are composed once from the packs (base plus weapon per level)
// into public/games/castle-defense/built/.

const CD = '/games/castle-defense';

export interface Sheet {
  src: string; imgW: number; imgH: number; cellW: number; cellH: number;
  row: number; frames: number; bbox: [number, number, number, number]; ms?: number;
}

export type TowerId = 'stone' | 'wood' | 'pink' | 'archer' | 'crossbow' | 'crystal' | 'orb' | 'bolt' | 'zap' | 'gemmine' | 'watchtower' | 'lookout' | 'weakness' | 'blessing';
export interface TowerDef {
  id: TowerId; label: string; blurb: string; cost: number[]; dps: number[];
  cooldownMs: number; sprite: (tier: 1 | 2 | 3) => string; isNew?: boolean;
  cleave?: number; cleaveMult?: number; splashAll?: boolean; slowTicks?: number; reach?: 1 | 2; gemsPerWave?: number[];
  // Fantasy Guard pack (smooth drawn art, not pixel art).
  smooth?: boolean; toughestFirst?: boolean; weakTicks?: number; blessNeighbors?: boolean;
  // An animated firing strip per tier (the Foozle weapon frames over the tower), played during a wave.
  fire?: (tier: 1 | 2 | 3) => { src: string; frames: number; h: number };
}
const built = (name: string) => (tier: 1 | 2 | 3) => `${CD}/built/${name}-${tier}.png`;
// Firing strips built from the Foozle packs (base + each weapon frame, 64 px wide per frame).
const FIRE: Record<string, { frames: number[]; h: number[] }> = {
  'foozle-01': { frames: [6, 6, 6], h: [119, 127, 135] }, 'foozle-06': { frames: [6, 6, 6], h: [112, 129, 137] },
  'foozle-07': { frames: [6, 7, 9], h: [104, 119, 127] }, 'foozle-08': { frames: [10, 10, 10], h: [118, 132, 146] },
};
const fire = (name: string) => (tier: 1 | 2 | 3) => ({ src: `${CD}/built/${name}-${tier}-fire.png`, frames: FIRE[name].frames[tier - 1], h: FIRE[name].h[tier - 1] });
const magic = (name: string) => (tier: 1 | 2 | 3) => `${CD}/craftpix/magic-towers/${name}-${tier}.png`;
export const TOWERS: Record<TowerId, TowerDef> = {
  stone: { id: 'stone', label: 'Stone Tower', blurb: 'Hits one attacker hard.', cost: [3, 3, 4], dps: [3, 5, 8], cooldownMs: 1000, sprite: (t) => `/castle-defense/tower-stone-${t}.png` },
  wood: { id: 'wood', label: 'Banner Tower', blurb: 'Also hits a second attacker nearby.', cost: [4, 4, 5], dps: [2, 4, 6], cooldownMs: 1000, cleave: 1, cleaveMult: 0.5, sprite: (t) => `/castle-defense/tower-wood-${t}.png` },
  pink: { id: 'pink', label: 'Mystic Tower', blurb: 'Slows down the attacker it hits.', cost: [4, 4, 5], dps: [2, 3, 5], cooldownMs: 1000, slowTicks: 3, sprite: (t) => `/castle-defense/tower-pink-${t}.png` },
  archer: { id: 'archer', label: 'Archer Tower', blurb: 'Fast arrows: shoots two times a second.', cost: [5, 5, 6], dps: [2, 3, 5], cooldownMs: 500, sprite: built('archer'), isNew: true },
  crossbow: { id: 'crossbow', label: 'Crossbow Tower', blurb: 'Long reach: also guards the next part of the road.', cost: [4, 4, 5], dps: [3, 4, 7], cooldownMs: 1000, reach: 2, sprite: built('foozle-01'), fire: fire('foozle-01'), isNew: true },
  crystal: { id: 'crystal', label: 'Crystal Tower', blurb: 'Hits every attacker near it at once.', cost: [5, 5, 6], dps: [1, 2, 4], cooldownMs: 1000, splashAll: true, sprite: built('foozle-02'), isNew: true },
  orb: { id: 'orb', label: 'Frost Orb Tower', blurb: 'Slows attackers for a long time.', cost: [4, 4, 5], dps: [1, 2, 3], cooldownMs: 1000, slowTicks: 7, sprite: built('foozle-05'), isNew: true },
  bolt: { id: 'bolt', label: 'Bolt Tower', blurb: 'Giant hits, but slow to reload.', cost: [4, 5, 6], dps: [7, 11, 16], cooldownMs: 2000, sprite: built('foozle-06'), fire: fire('foozle-06'), isNew: true },
  zap: { id: 'zap', label: 'Spark Lamp', blurb: 'Zaps one attacker, then jumps to 2 more.', cost: [5, 5, 6], dps: [2, 3, 5], cooldownMs: 1000, cleave: 2, cleaveMult: 0.5, sprite: built('foozle-07'), fire: fire('foozle-07'), isNew: true },
  watchtower: { id: 'watchtower', label: 'Brick Watchtower', blurb: 'Sharp eyes: always hits the toughest attacker near it.', cost: [4, 4, 5], dps: [3, 5, 8], cooldownMs: 1000, toughestFirst: true, smooth: true, sprite: magic('brick'), isNew: true },
  lookout: { id: 'lookout', label: 'Wooden Lookout', blurb: 'Cheap to build: only 2 gems.', cost: [2, 3, 4], dps: [2, 3, 5], cooldownMs: 1000, smooth: true, sprite: magic('wooden'), isNew: true },
  weakness: { id: 'weakness', label: 'Weakness Tower', blurb: 'Makes attackers weak, so every tower hits them harder.', cost: [4, 4, 5], dps: [1, 2, 3], cooldownMs: 1000, weakTicks: 7, smooth: true, sprite: magic('weakness'), isNew: true },
  blessing: { id: 'blessing', label: 'Blessing Tower', blurb: 'Helps the towers next to it shoot faster.', cost: [5, 5, 6], dps: [1, 1, 2], cooldownMs: 1000, blessNeighbors: true, smooth: true, sprite: magic('blessing'), isNew: true },
  gemmine: { id: 'gemmine', label: 'Gem Mine', blurb: 'Digs up bonus gems after every wave. Pokes attackers too.', cost: [5, 5, 6], dps: [1, 1, 2], cooldownMs: 1000, gemsPerWave: [1, 2, 3], sprite: built('foozle-08'), fire: fire('foozle-08'), isNew: true },
};
export const TOWER_IDS = Object.keys(TOWERS) as TowerId[];

export type ThemeId = 'classic' | 'field' | 'bugs' | 'mix';
export const ATTACKER_THEMES: { id: ThemeId; label: string; icon: string }[] = [
  { id: 'classic', label: 'Castle raiders', icon: '🗡️' },
  { id: 'field', label: 'Field monsters', icon: '🐺' },
  { id: 'bugs', label: 'Bug swarm', icon: '🐞' },
  { id: 'mix', label: 'Surprise mix', icon: '🎲' },
];

// death: plays once when the attacker is stopped. attack: plays once when it reaches the castle.
export interface EnemyDef { id: string; label: string; tier: 1 | 2 | 3 | 4; theme: Exclude<ThemeId, 'mix'>; flying?: boolean; img?: string; sheet?: Sheet; death?: Sheet; attack?: Sheet; size?: number; preview: string }
// Health by tier, the same as the original raiders (goblin 3, knight 5, rogue 4, wizard 6), so
// every theme is exactly as hard as the classic game.
export const TIER_HP: Record<1 | 2 | 3 | 4, number> = { 1: 3, 2: 5, 3: 4, 4: 6 };
const cp = (path: string, cell: number, bbox: Sheet['bbox']): Sheet => ({ src: `${CD}/craftpix/${path}`, imgW: cell * 6, imgH: cell, cellW: cell, cellH: cell, row: 0, frames: 6, bbox });
const fz = (path: string, imgW: number, imgH: number, cellW: number, cellH: number, frames: number, bbox: Sheet['bbox']): Sheet => ({ src: `${CD}/foozle/${path}`, imgW, imgH, cellW, cellH, row: 2, frames, bbox });
const pv = (id: string) => `${CD}/built/enemy-${id}.png`;
// The same CraftPix attacker's other strips (death, attack or special), same cell and crop.
const cpAlt = (walk: Sheet, file: string): Sheet => ({ ...walk, src: walk.src.replace(/s_(walk|run|fly)\.png$/, file), ms: 110 });
// Foozle sheets: rows 0-2 move, 3-5 attack, 6-8 death (down, up, side). The side rows are used.
const fzRow = (walk: Sheet, row: number, frames: number): Sheet => ({ ...walk, row, frames, ms: 90 });
export const ENEMIES: Record<string, EnemyDef> = {
  goblin: { id: 'goblin', label: 'Goblin', tier: 1, theme: 'classic', img: '/castle-defense/enemy-goblin.png', preview: '/castle-defense/enemy-goblin.png' },
  knight: { id: 'knight', label: 'Knight', tier: 2, theme: 'classic', img: '/castle-defense/enemy-knight.png', preview: '/castle-defense/enemy-knight.png' },
  rogue: { id: 'rogue', label: 'Rogue', tier: 3, theme: 'classic', img: '/castle-defense/enemy-rogue.png', preview: '/castle-defense/enemy-rogue.png' },
  wizard: { id: 'wizard', label: 'Wizard', tier: 4, theme: 'classic', img: '/castle-defense/enemy-wizard.png', preview: '/castle-defense/enemy-wizard.png' },
  slime: { id: 'slime', label: 'Slime', tier: 1, theme: 'field', sheet: cp('enemies/1/s_walk.png', 48, [15, 14, 34, 38]), size: 0.75, preview: pv('slime') },
  rat: { id: 'rat', label: 'Sneaky Rat', tier: 1, theme: 'field', sheet: cp('enemies-2/1/s_run.png', 96, [24, 35, 85, 64]), size: 1.2, preview: pv('rat') },
  bee: { id: 'bee', label: 'Buzz Bee', tier: 1, theme: 'field', flying: true, sheet: cp('enemies/4/s_walk.png', 48, [16, 14, 34, 36]), size: 0.85, preview: pv('bee') },
  clubgoblin: { id: 'clubgoblin', label: 'Club Goblin', tier: 2, theme: 'field', sheet: cp('enemies/2/s_walk.png', 48, [12, 13, 35, 38]), preview: pv('clubgoblin') },
  wolf: { id: 'wolf', label: 'Shadow Wolf', tier: 3, theme: 'field', sheet: cp('enemies/3/s_walk.png', 48, [12, 17, 37, 39]), preview: pv('wolf') },
  rider: { id: 'rider', label: 'Spear Rider', tier: 4, theme: 'field', sheet: cp('enemies-2/2/s_run.png', 96, [29, 9, 86, 74]), size: 1.45, preview: pv('rider') },
  rockrider: { id: 'rockrider', label: 'Rock Rider', tier: 4, theme: 'field', flying: true, sheet: cp('enemies-2/3/s_fly.png', 96, [29, 28, 68, 73]), size: 1.1, preview: pv('rockrider') },
  leafbug: { id: 'leafbug', label: 'Leafbug', tier: 1, theme: 'bugs', sheet: fz('ground-enemies/ground/spritesheets/leafbug.png', 512, 576, 64, 64, 6, [9, 21, 51, 40]), size: 0.9, preview: pv('leafbug') },
  locust: { id: 'locust', label: 'Flying Locust', tier: 1, theme: 'bugs', flying: true, sheet: fz('flying-enemies/flying/spritesheets/flying-locust.png', 896, 576, 64, 64, 12, [12, 8, 52, 55]), preview: pv('locust') },
  firebug: { id: 'firebug', label: 'Firebug', tier: 2, theme: 'bugs', sheet: fz('ground-enemies/ground/spritesheets/firebug.png', 1408, 576, 128, 64, 6, [38, 16, 93, 49]), size: 1.15, preview: pv('firebug') },
  firewasp: { id: 'firewasp', label: 'Firewasp', tier: 2, theme: 'bugs', flying: true, sheet: fz('flying-enemies/flying/spritesheets/firewasp.png', 1152, 864, 96, 96, 12, [20, 26, 76, 80]), size: 1.1, preview: pv('firewasp') },
  scorpion: { id: 'scorpion', label: 'Scorpion', tier: 3, theme: 'bugs', sheet: fz('ground-enemies/ground/spritesheets/scorpion.png', 512, 576, 64, 64, 8, [6, 12, 60, 53]), size: 1.15, preview: pv('scorpion') },
  clampbeetle: { id: 'clampbeetle', label: 'Clampbeetle', tier: 3, theme: 'bugs', flying: true, sheet: fz('flying-enemies/flying/spritesheets/clampbeetle.png', 832, 576, 64, 64, 8, [5, 15, 53, 57]), preview: pv('clampbeetle') },
  magmacrab: { id: 'magmacrab', label: 'Magma Crab', tier: 4, theme: 'bugs', sheet: fz('ground-enemies/ground/spritesheets/magma-crab.png', 640, 576, 64, 64, 8, [2, 14, 52, 51]), size: 1.2, preview: pv('magmacrab') },
  voidbutterfly: { id: 'voidbutterfly', label: 'Void Butterfly', tier: 4, theme: 'bugs', flying: true, sheet: fz('flying-enemies/flying/spritesheets/voidbutterfly.png', 832, 576, 64, 64, 6, [6, 4, 44, 60]), size: 1.1, preview: pv('voidbutterfly') },
};

// Death and castle-attack animations (Build Queue 2026-10-09, the saved packs' own strips).
const CP_EXTRA: Record<string, { death: string; attack?: string }> = {
  slime: { death: 's_death.png', attack: 's_special.png' }, clubgoblin: { death: 's_death.png', attack: 's_attack.png' },
  wolf: { death: 's_death.png', attack: 's_attack.png' }, bee: { death: 's_death.png' },
  rat: { death: 's_death.png', attack: 's_attack.png' }, rider: { death: 's_death.png', attack: 's_attack.png' }, rockrider: { death: 's_death.png', attack: 's_attack.png' },
};
const FZ_FRAMES: Record<string, { death: number; attack: number }> = {
  leafbug: { death: 7, attack: 8 }, locust: { death: 14, attack: 8 }, firebug: { death: 11, attack: 8 }, firewasp: { death: 12, attack: 8 },
  scorpion: { death: 8, attack: 8 }, clampbeetle: { death: 13, attack: 8 }, magmacrab: { death: 10, attack: 8 }, voidbutterfly: { death: 12, attack: 4 },
};
for (const e of Object.values(ENEMIES)) {
  if (!e.sheet) continue;
  const cpx = CP_EXTRA[e.id];
  if (cpx) { e.death = cpAlt(e.sheet, cpx.death); if (cpx.attack) e.attack = cpAlt(e.sheet, cpx.attack); }
  const fzx = FZ_FRAMES[e.id];
  if (fzx) { e.death = fzRow(e.sheet, 8, fzx.death); e.attack = fzRow(e.sheet, 5, fzx.attack); }
}

// The classic waves as tiers (goblin 1, knight 2, rogue 3, wizard 4). Each theme fills every
// tier with one of its own attackers, chosen once when the game starts.
const WAVE_TIERS: (1 | 2 | 3 | 4)[][] = [
  [1, 1, 1],
  [1, 1, 2, 2],
  [1, 2, 2, 3, 3],
  [2, 3, 3, 4, 4],
  [2, 2, 3, 4, 4, 1],
];
// More than 5 waves (the student's Rounds slider): each extra wave is the last one plus one more
// strong attacker, so it keeps getting a little harder.
export function buildWaves(theme: ThemeId, count = 5, rng: () => number = Math.random): string[][] {
  const pool = Object.values(ENEMIES).filter((e) => theme === 'mix' || e.theme === theme);
  const tiersList = Array.from({ length: count }, (_, i) => (i < WAVE_TIERS.length ? WAVE_TIERS[i] : [...WAVE_TIERS[WAVE_TIERS.length - 1], ...Array.from({ length: i - WAVE_TIERS.length + 1 }, (_, k) => (k % 2 ? 3 : 4) as 3 | 4)]));
  return tiersList.map((tiers) => tiers.map((t) => {
    const opts = pool.filter((e) => e.tier === t);
    return opts[Math.floor(rng() * opts.length)].id;
  }));
}

// The overgrown portal the attackers come out of: calm, then torn, then electric as the waves
// get harder. The Wisp builds every tower; the townspeople cheer when a wave is cleared.
const portal = (name: string, frames: number): Sheet => ({ src: `${CD}/portal/48x48-side-scroller-td-overgrown-${name}.png`, imgW: frames * 48, imgH: 48, cellW: 48, cellH: 48, row: 0, frames, bbox: [0, 0, 48, 48], ms: 140 });
export const PORTAL_STAGES: Sheet[] = [portal('portal', 4), portal('torn-portal', 4), portal('electric-torn-portal', 4)];
export const portalStage = (wave: number, total = 5) => (wave / total <= 0.4 ? 0 : wave / total <= 0.8 ? 1 : 2);
// The Wisp's build: a white dust poof that bursts over the build tile and clears to show the new tower
// (the last row of the Foozle construction sheet, which works over any tower).
export const TOWER_POOF: Sheet = { src: `${CD}/foozle/builder/building-animations/pngs/tower-construction.png`, imgW: 1152, imgH: 1536, cellW: 192, cellH: 256, row: 5, frames: 5, bbox: [44, 56, 148, 197], ms: 110 };
// The Wisp's collapse when a student removes a tower (13 frames of the tower crumbling into dust).
export const TOWER_COLLAPSE: Sheet = { src: `${CD}/foozle/builder/building-animations/pngs/tower---collapse.png`, imgW: 3328, imgH: 192, cellW: 256, cellH: 192, row: 0, frames: 13, bbox: [2, 25, 254, 156], ms: 90 };
export const WISP_CAST: Sheet = { src: `${CD}/foozle/builder/wisp/spritesheet/wisp---animations.png`, imgW: 576, imgH: 384, cellW: 64, cellH: 64, row: 3, frames: 9, bbox: [12, 10, 52, 58], ms: 90 };
export const citizen = (n: number, cheering: boolean): Sheet => ({
  src: `${CD}/craftpix/citizens/${n}/s_${cheering ? 'special' : 'idle'}.png`, imgW: cheering ? 288 : 192, imgH: 48, cellW: 48, cellH: 48, row: 0, frames: cheering ? 6 : 4, bbox: [12, 0, 36, 33], ms: cheering ? 110 : 160,
});

// Where the battle happens (teacher 2026-10-08, the Poison Swamp pack): the meadow, or the swamp.
// The Stone Road Field (Build Queue 2026-10-09) is built from her CraftPix field tiles and objects.
export type MapId = 'meadow' | 'swamp' | 'field';
export const MAPS: { id: MapId; label: string; icon: string }[] = [
  { id: 'meadow', label: 'Sunny meadow', icon: '🌼' },
  { id: 'swamp', label: 'Poison swamp', icon: '🐸' },
  { id: 'field', label: 'Stone road field', icon: '⛺' },
];
