import { useStore } from '../store/store';

// Supernature, the witchy creature app on the student computer (Build Queue item 96, plan in
// docs/SUPERNATURE_PLAN.md). This file holds its data (regions, word parts, recipes), each
// student's saved progress, and its sounds. The creatures live in supernatureCreatures.ts.

export const SN = '/games/supernature/';

export type Energy = 'very high' | 'high' | 'just right' | 'low' | 'very low';
export const ENERGY_STEPS: Energy[] = ['very high', 'high', 'just right', 'low', 'very low'];
export const ENERGY_FACE: Record<Energy, string> = {
  'very high': `${SN}energy/very-high.png`,
  high: `${SN}energy/high.png`,
  'just right': `${SN}energy/just-right.png`,
  low: `${SN}energy/low.png`,
  'very low': `${SN}energy/very-low.png`,
};

export interface Part { text: string; meaning: string; kind: 'start' | 'main' | 'end' }
export const REGIONS: { id: string; label: string; kind: 'land' | 'ocean'; frontier?: boolean }[] = [
  { id: 'europe', label: 'Europe', kind: 'land' }, { id: 'asia', label: 'Asia', kind: 'land' }, { id: 'africa', label: 'Africa', kind: 'land' },
  { id: 'northamerica', label: 'North America', kind: 'land' }, { id: 'southamerica', label: 'South America', kind: 'land' },
  { id: 'oceania', label: 'Oceania', kind: 'land' }, { id: 'antarctica', label: 'Antarctica', kind: 'land', frontier: true },
  { id: 'atlantic', label: 'Atlantic Ocean', kind: 'ocean' }, { id: 'pacific', label: 'Pacific Ocean', kind: 'ocean' },
  { id: 'indian', label: 'Indian Ocean', kind: 'ocean' }, { id: 'arctic', label: 'Arctic Ocean', kind: 'ocean' },
  { id: 'southern', label: 'Southern Ocean', kind: 'ocean', frontier: true },
];

// Word parts for the Name Builder and the Word Part Book (plan sections 13 and 18).
export const WORD_PARTS: (Part & { example: string })[] = [
  { text: 'uni', meaning: 'one', kind: 'start', example: 'unicycle' }, { text: 'bi', meaning: 'two', kind: 'start', example: 'bicycle' },
  { text: 'tri', meaning: 'three', kind: 'start', example: 'triangle' }, { text: 'mega', meaning: 'huge', kind: 'start', example: 'megaphone' },
  { text: 'micro', meaning: 'tiny', kind: 'start', example: 'microscope' }, { text: 'velo', meaning: 'fast', kind: 'start', example: 'velocity' },
  { text: 'aero', meaning: 'air', kind: 'main', example: 'aerospace' }, { text: 'aqua', meaning: 'water', kind: 'main', example: 'aquarium' },
  { text: 'pyro', meaning: 'fire', kind: 'main', example: 'pyrotechnics' }, { text: 'cryo', meaning: 'cold', kind: 'main', example: 'cryogenic' },
  { text: 'lumin', meaning: 'light', kind: 'main', example: 'luminous' }, { text: 'lev', meaning: 'lift', kind: 'main', example: 'levitate' },
  { text: 'fort', meaning: 'strong', kind: 'main', example: 'fortress' }, { text: 'ops', meaning: 'eye', kind: 'main', example: 'Cyclops' },
  { text: 'pod', meaning: 'foot', kind: 'main', example: 'tripod' }, { text: 'noct', meaning: 'night', kind: 'main', example: 'nocturnal' },
  { text: 'ium', meaning: 'a thing', kind: 'end', example: 'aquarium' }, { text: 'ify', meaning: 'to make', kind: 'end', example: 'magnify' },
  { text: 'vore', meaning: 'eats', kind: 'end', example: 'herbivore' }, { text: 'ling', meaning: 'little', kind: 'end', example: 'duckling' },
  { text: 'phobe', meaning: 'is afraid of', kind: 'end', example: 'aquaphobe' },
  { text: 'cera', meaning: 'horn', kind: 'main', example: 'triceratops' }, { text: 'derm', meaning: 'skin', kind: 'main', example: 'epidermis' },
  { text: 'pter', meaning: 'wing', kind: 'main', example: 'pterodactyl' }, { text: 'saur', meaning: 'lizard', kind: 'end', example: 'dinosaur' },
];

// The first Cookbook recipe. Steps happen in order, and the bowl always goes first (order of
// operations, her math year).
export interface Ingredient { id: string; name: string; img: string; price: string }
export const SHELF: Ingredient[] = [
  { id: 'bottle', name: 'glass bottle', img: `${SN}witchy-pack/potions-3.png`, price: 'free' },
  { id: 'grass', name: 'grass', img: `${SN}materials/grass.png`, price: 'free' },
  { id: 'dew', name: 'dew', img: `${SN}materials/water.png`, price: 'free' },
  { id: 'fairywing', name: 'fairy wing', img: `${SN}habitat/loot-fairywings.png`, price: 'earned' },
  { id: 'staranise', name: 'star anise', img: `${SN}ingredients/star-anise.png`, price: '$4' },
  { id: 'glowmoss', name: 'glowmoss', img: `${SN}cabinet/herbs-fungi-roots/glowmoss.png`, price: '$6' },
  { id: 'saffron', name: 'saffron', img: `${SN}ingredients/saffron.png`, price: '$25 rare' },
  { id: 'phoenix', name: 'phoenix feather', img: `${SN}cabinet/monster-ingredients/phoenix_feather.png`, price: '$35 rare' },
];
export interface Step { text: string; need: 'bowl' | 'pour' | 'add' | 'stir' | 'spell'; items?: string[]; times?: number; word?: string }
export interface Recipe { name: string; meaning: string; does: string; steps: Step[] }
export const AERO: Recipe = {
  name: 'Aero', meaning: 'aero means air', does: 'Lets you float and fly for 1 minute in Town Square.',
  steps: [
    { text: 'In the bowl, mix ( grass + dew ). The bowl always goes first.', need: 'bowl', items: ['grass', 'dew'] },
    { text: 'Pour the bowl into the cauldron.', need: 'pour' },
    { text: 'Add 1 fairy wing.', need: 'add', items: ['fairywing'] },
    { text: 'Stir 3 times.', need: 'stir', times: 3 },
    { text: 'Write the spell word with your wand: aero.', need: 'spell', word: 'aero' },
  ],
};
// Vita heals a creature in the Habitat back to full hearts (her ask, 2026-10-13: potions that heal
// creatures the weather has worn out). Vita is Latin for life, like vitamin and vital.
export const VITA: Recipe = {
  name: 'Vita', meaning: 'vita means life', does: 'Heals one creature in the Habitat back to full hearts.',
  steps: [
    { text: 'In the bowl, mix ( dew + glowmoss ). The bowl always goes first.', need: 'bowl', items: ['dew', 'glowmoss'] },
    { text: 'Pour the bowl into the cauldron.', need: 'pour' },
    { text: 'Add 1 star anise.', need: 'add', items: ['staranise'] },
    { text: 'Stir 2 times.', need: 'stir', times: 2 },
    { text: 'Write the spell word with your wand: vita.', need: 'spell', word: 'vita' },
  ],
};
export const RECIPES = [AERO, VITA];


// Each student's progress, saved in their own row (no new tables).
export interface SnHabitat { biome?: string; health?: Record<string, number>; season?: number; plants?: number; mush?: number; groups?: Record<string, number> }
export interface SnSave { found?: string[]; potions?: string[]; names?: string[]; earned?: string[]; habitat?: SnHabitat; made?: import('./supernatureCreatures').Made[] }
export function useSupernature(studentId: string | null) {
  const owner = studentId ? `supernature:${studentId}` : '';
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === owner));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const save = (row?.look as SnSave | undefined) ?? {};
  const patch = (p: Partial<SnSave>) => { if (owner) mergeStyleRow(owner, p as Record<string, unknown>); };
  return { save, patch };
}

// Her Witchy UI Sounds. Interface sounds only; music loops are still to come.
const SOUND_FILES = {
  tap: 'click_01_celesta_pluck', open: 'menu_01_spellbook_open', close: 'menu_02_spellbook_close', page: 'menu_03_page_turn',
  stir: 'click_04_cauldron_spoon', cork: 'click_02_potion_cork', brewed: 'confirm_02_potion_brewed', done: 'success_01_potion_complete',
  learned: 'success_03_spell_learned', found: 'success_05_familiar_unlocked', pickup: 'collect_01_herb_pickup', fizzle: 'error_01_hex_fizzle',
  poof: 'cancel_02_puff_of_smoke', season: 'notify_02_wind_chimes', back: 'cancel_01_music_box_fall', chime: 'confirm_04_moon_chime',
} as const;
export type SnSound = keyof typeof SOUND_FILES;
const SOUND_KEY = 'supernature.sounds';
export const soundsOn = () => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } };
export const setSoundsOn = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* fine */ } };
export function snSound(name: SnSound) {
  if (!soundsOn()) return;
  try { const a = new Audio(`${SN}sounds/witchy-ui-wav/${SOUND_FILES[name]}.wav`); a.volume = 0.55; void a.play().catch(() => undefined); } catch { /* fine */ }
}

// Her Weather & Nature SFX (CC BY 4.0, credits in sounds/nature/CREDITS.txt). One-shots, plus one
// looping bed at a time for rain, wind, night crickets and the like; the Habitat stops it on leave.
export type NatureSound = 'gust' | 'thunder' | 'lightning' | 'fire' | 'owl' | 'bird' | 'frog' | 'splash' | 'ice' | 'whoosh';
const NATURE_FILES: Record<NatureSound, string> = {
  gust: 'gust_01', thunder: 'thunder_mid_01', lightning: 'lightning_strike_01', fire: 'fire_ignite_01', owl: 'owl_hoot_01',
  bird: 'bird_chirp_01', frog: 'frog_croak_01', splash: 'splash_01', ice: 'ice_crack_01', whoosh: 'whoosh_01',
};
export function natureSound(name: NatureSound, volume = 0.5) {
  if (!soundsOn()) return;
  try { const a = new Audio(`${SN}sounds/nature/${NATURE_FILES[name]}.wav`); a.volume = volume; void a.play().catch(() => undefined); } catch { /* fine */ }
}
export type NatureLoop = 'rain_light_loop' | 'wind_steady_loop' | 'blizzard_loop' | 'torch_loop' | 'crickets_loop' | 'forest_day_loop' | 'waves_calm_loop' | 'stream_loop';
let loopEl: HTMLAudioElement | null = null; let loopName: string | null = null;
export function setNatureLoop(name: NatureLoop | null, volume = 0.3) {
  if (!soundsOn()) name = null;
  if (name === loopName) return;
  try { loopEl?.pause(); } catch { /* fine */ }
  loopEl = null; loopName = name;
  if (!name) return;
  try { const a = new Audio(`${SN}sounds/nature/${name}.wav`); a.loop = true; a.volume = volume; void a.play().catch(() => undefined); loopEl = a; } catch { /* fine */ }
}
