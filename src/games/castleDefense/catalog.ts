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

export type TowerId = 'stone' | 'wood' | 'pink' | 'archer' | 'crossbow' | 'crystal' | 'orb' | 'bolt' | 'zap' | 'gemmine';
export interface TowerDef {
  id: TowerId; label: string; blurb: string; cost: number[]; dps: number[];
  cooldownMs: number; sprite: (tier: 1 | 2 | 3) => string; isNew?: boolean;
  cleave?: number; cleaveMult?: number; splashAll?: boolean; slowTicks?: number; reach?: 1 | 2; gemsPerWave?: [number, number, number];
}
const built = (name: string) => (tier: 1 | 2 | 3) => `${CD}/built/${name}-${tier}.png`;
export const TOWERS: Record<TowerId, TowerDef> = {
  stone: { id: 'stone', label: 'Stone Tower', blurb: 'Hits one attacker hard.', cost: [3, 3, 4], dps: [3, 5, 8], cooldownMs: 1000, sprite: (t) => `/castle-defense/tower-stone-${t}.png` },
  wood: { id: 'wood', label: 'Banner Tower', blurb: 'Also hits a second attacker nearby.', cost: [4, 4, 5], dps: [2, 4, 6], cooldownMs: 1000, cleave: 1, cleaveMult: 0.5, sprite: (t) => `/castle-defense/tower-wood-${t}.png` },
  pink: { id: 'pink', label: 'Mystic Tower', blurb: 'Slows down the attacker it hits.', cost: [4, 4, 5], dps: [2, 3, 5], cooldownMs: 1000, slowTicks: 3, sprite: (t) => `/castle-defense/tower-pink-${t}.png` },
  archer: { id: 'archer', label: 'Archer Tower', blurb: 'Fast arrows: shoots two times a second.', cost: [5, 5, 6], dps: [2, 3, 5], cooldownMs: 500, sprite: built('archer'), isNew: true },
  crossbow: { id: 'crossbow', label: 'Crossbow Tower', blurb: 'Long reach: also guards the next part of the road.', cost: [4, 4, 5], dps: [3, 4, 7], cooldownMs: 1000, reach: 2, sprite: built('foozle-01'), isNew: true },
  crystal: { id: 'crystal', label: 'Crystal Tower', blurb: 'Hits every attacker near it at once.', cost: [5, 5, 6], dps: [1, 2, 4], cooldownMs: 1000, splashAll: true, sprite: built('foozle-02'), isNew: true },
  orb: { id: 'orb', label: 'Frost Orb Tower', blurb: 'Slows attackers for a long time.', cost: [4, 4, 5], dps: [1, 2, 3], cooldownMs: 1000, slowTicks: 7, sprite: built('foozle-05'), isNew: true },
  bolt: { id: 'bolt', label: 'Bolt Tower', blurb: 'Giant hits, but slow to reload.', cost: [4, 5, 6], dps: [7, 11, 16], cooldownMs: 2000, sprite: built('foozle-06'), isNew: true },
  zap: { id: 'zap', label: 'Spark Lamp', blurb: 'Zaps one attacker, then jumps to 2 more.', cost: [5, 5, 6], dps: [2, 3, 5], cooldownMs: 1000, cleave: 2, cleaveMult: 0.5, sprite: built('foozle-07'), isNew: true },
  gemmine: { id: 'gemmine', label: 'Gem Mine', blurb: 'Digs up bonus gems after every wave. Pokes attackers too.', cost: [5, 5, 6], dps: [1, 1, 2], cooldownMs: 1000, gemsPerWave: [1, 2, 3], sprite: built('foozle-08'), isNew: true },
};
export const TOWER_IDS = Object.keys(TOWERS) as TowerId[];

export type ThemeId = 'classic' | 'field' | 'bugs' | 'mix';
export const ATTACKER_THEMES: { id: ThemeId; label: string; icon: string }[] = [
  { id: 'classic', label: 'Castle raiders', icon: '🗡️' },
  { id: 'field', label: 'Field monsters', icon: '🐺' },
  { id: 'bugs', label: 'Bug swarm', icon: '🐞' },
  { id: 'mix', label: 'Surprise mix', icon: '🎲' },
];

export interface EnemyDef { id: string; label: string; tier: 1 | 2 | 3 | 4; theme: Exclude<ThemeId, 'mix'>; flying?: boolean; img?: string; sheet?: Sheet; size?: number; preview: string }
// Health by tier, the same as the original raiders (goblin 3, knight 5, rogue 4, wizard 6), so
// every theme is exactly as hard as the classic game.
export const TIER_HP: Record<1 | 2 | 3 | 4, number> = { 1: 3, 2: 5, 3: 4, 4: 6 };
const cp = (path: string, cell: number, bbox: Sheet['bbox']): Sheet => ({ src: `${CD}/craftpix/${path}`, imgW: cell * 6, imgH: cell, cellW: cell, cellH: cell, row: 0, frames: 6, bbox });
const fz = (path: string, imgW: number, imgH: number, cellW: number, cellH: number, frames: number, bbox: Sheet['bbox']): Sheet => ({ src: `${CD}/foozle/${path}`, imgW, imgH, cellW, cellH, row: 2, frames, bbox });
const pv = (id: string) => `${CD}/built/enemy-${id}.png`;
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

// The classic waves as tiers (goblin 1, knight 2, rogue 3, wizard 4). Each theme fills every
// tier with one of its own attackers, chosen once when the game starts.
const WAVE_TIERS: (1 | 2 | 3 | 4)[][] = [
  [1, 1, 1],
  [1, 1, 2, 2],
  [1, 2, 2, 3, 3],
  [2, 3, 3, 4, 4],
  [2, 2, 3, 4, 4, 1],
];
export function buildWaves(theme: ThemeId, rng: () => number = Math.random): string[][] {
  const pool = Object.values(ENEMIES).filter((e) => theme === 'mix' || e.theme === theme);
  return WAVE_TIERS.map((tiers) => tiers.map((t) => {
    const opts = pool.filter((e) => e.tier === t);
    return opts[Math.floor(rng() * opts.length)].id;
  }));
}

// The overgrown portal the attackers come out of: calm, then torn, then electric as the waves
// get harder. The Wisp builds every tower; the townspeople cheer when a wave is cleared.
const portal = (name: string, frames: number): Sheet => ({ src: `${CD}/portal/48x48-side-scroller-td-overgrown-${name}.png`, imgW: frames * 48, imgH: 48, cellW: 48, cellH: 48, row: 0, frames, bbox: [0, 0, 48, 48], ms: 140 });
export const PORTAL_STAGES: Sheet[] = [portal('portal', 4), portal('torn-portal', 4), portal('electric-torn-portal', 4)];
export const portalStage = (wave: number) => (wave <= 2 ? 0 : wave <= 4 ? 1 : 2);
export const WISP_CAST: Sheet = { src: `${CD}/foozle/builder/wisp/spritesheet/wisp---animations.png`, imgW: 576, imgH: 384, cellW: 64, cellH: 64, row: 3, frames: 9, bbox: [12, 10, 52, 58], ms: 90 };
export const citizen = (n: number, cheering: boolean): Sheet => ({
  src: `${CD}/craftpix/citizens/${n}/s_${cheering ? 'special' : 'idle'}.png`, imgW: cheering ? 288 : 192, imgH: 48, cellW: 48, cellH: 48, row: 0, frames: cheering ? 6 : 4, bbox: [12, 0, 36, 33], ms: cheering ? 110 : 160,
});
