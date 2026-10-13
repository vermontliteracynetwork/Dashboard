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

// Ingredients (Build Queue 100, plan section 10, her spec): base ones like a glass bottle or grass
// are free; the rest are bought in the Shop with real money, $1 to $10, and rare ones $15 to $50.
// A few are also earned by exploring the Globe. Gross humor stays out of the base ingredients.
export type Tier = 'free' | 'basic' | 'rare';
export interface Ingredient { id: string; name: string; img: string; tier: Tier; price: number; note?: string; earnedAs?: string }
const CAB = `${SN}cabinet/`;
export const INGREDIENTS: Ingredient[] = [
  { id: 'bottle', name: 'glass bottle', img: `${SN}witchy-pack/potions-3.png`, tier: 'free', price: 0 },
  { id: 'grass', name: 'grass', img: `${SN}materials/grass.png`, tier: 'free', price: 0 },
  { id: 'dew', name: 'dew', img: `${SN}materials/water.png`, tier: 'free', price: 0 },
  { id: 'fairywing', name: 'fairy wing', img: `${SN}habitat/loot-fairywings.png`, tier: 'free', price: 0, note: 'Found on the ground in the garden. No fairies were bothered.' },
  { id: 'newt', name: 'eye of newt', img: `${SN}ingredients/mustard-seed.png`, tier: 'basic', price: 100, note: 'In old recipes, eye of newt was really a mustard seed.' },
  { id: 'chili', name: 'chili pepper', img: `${SN}ingredients/chili-pepper.png`, tier: 'basic', price: 100 },
  { id: 'staranise', name: 'star anise', img: `${SN}ingredients/star-anise.png`, tier: 'basic', price: 200 },
  { id: 'ginger', name: 'ginger root', img: `${SN}ingredients/ginger.png`, tier: 'basic', price: 200 },
  { id: 'silversage', name: 'silver sage', img: `${CAB}herbs-fungi-roots/silver_sage.png`, tier: 'basic', price: 200 },
  { id: 'icechip', name: 'ice chip', img: `${SN}materials/ice.png`, tier: 'basic', price: 200 },
  { id: 'glowmoss', name: 'glowmoss', img: `${CAB}herbs-fungi-roots/glowmoss.png`, tier: 'basic', price: 300 },
  { id: 'dreamberries', name: 'dreamberries', img: `${CAB}herbs-fungi-roots/dreamberries.png`, tier: 'basic', price: 300 },
  { id: 'vanilla', name: 'vanilla bean', img: `${SN}ingredients/vanilla.png`, tier: 'basic', price: 300 },
  { id: 'mooncap', name: 'mooncap mushroom', img: `${CAB}herbs-fungi-roots/mooncap_mushroom.png`, tier: 'basic', price: 400 },
  { id: 'mothdust', name: 'moth wing powder', img: `${CAB}monster-ingredients/moth_wing_powder.png`, tier: 'basic', price: 400 },
  { id: 'frostorchid', name: 'frost orchid', img: `${CAB}herbs-fungi-roots/frost_orchid.png`, tier: 'basic', price: 500 },
  { id: 'fireblossom', name: 'fire blossom', img: `${CAB}herbs-fungi-roots/fire_blossom.png`, tier: 'basic', price: 500 },
  { id: 'slimecore', name: 'slime core', img: `${CAB}monster-ingredients/slime_core.png`, tier: 'basic', price: 500, note: 'Squishy, sticky and a little gross. Wash your hands!' },
  { id: 'moonlight', name: 'bottled moonlight', img: `${CAB}bottled-brews/bottled_moonlight.png`, tier: 'rare', price: 2000 },
  { id: 'saffron', name: 'saffron', img: `${SN}ingredients/saffron.png`, tier: 'rare', price: 2500, note: 'Real saffron is the most expensive spice in the world.' },
  { id: 'mermaidtear', name: 'mermaid tear', img: `${CAB}monster-ingredients/mermaid_tear.png`, tier: 'rare', price: 3000, earnedAs: 'mermaid tear' },
  { id: 'phoenix', name: 'phoenix feather', img: `${CAB}monster-ingredients/phoenix_feather.png`, tier: 'rare', price: 3500, earnedAs: 'phoenix feather' },
  { id: 'dragonscale', name: 'dragon scale', img: `${CAB}monster-ingredients/dragon_scale.png`, tier: 'rare', price: 4000 },
  { id: 'frozenflame', name: 'frozen flame', img: `${CAB}legendary-relics/frozen_flame.png`, tier: 'rare', price: 5000 },
];
export const ING = (id: string) => INGREDIENTS.find((x) => x.id === id)!;

// The Cookbook (Build Queue 101, plan section 6): 10 base recipes, and discovered recipes that
// unlock after their base one is brewed (her example: flying unlocks super speed flying). Steps
// happen in order, and the bowl always goes first (order of operations, her math year).
export interface Step { text: string; need: 'bowl' | 'pour' | 'add' | 'stir' | 'spell'; items?: string[]; times?: number; word?: string }
export interface Recipe { name: string; meaning: string; does: string; where: string; steps: Step[]; unlock?: string }
const r = (name: string, meaning: string, does: string, where: string, bowl: [string, string], add: string[], stir: number, word: string, unlock?: string): Recipe => ({
  name, meaning, does, where, unlock,
  steps: [
    { text: `In the bowl, mix ( ${ING(bowl[0]).name} + ${ING(bowl[1]).name} ). The bowl always goes first.`, need: 'bowl', items: bowl },
    { text: 'Pour the bowl into the cauldron.', need: 'pour' },
    ...add.map((a): Step => ({ text: `Add 1 ${ING(a).name}.`, need: 'add', items: [a] })),
    { text: `Stir ${stir} times.`, need: 'stir', times: stir },
    { text: `Write the spell word with your wand: ${word}.`, need: 'spell', word },
  ],
});
export const RECIPES: Recipe[] = [
  r('Aero', 'aero means air', 'Lets you float and fly for 1 minute in Town Square.', 'Town Square: drink it here', ['grass', 'dew'], ['fairywing'], 3, 'aero'),
  r('Vita', 'vita means life', 'Heals one creature in the Habitat back to full hearts.', 'Habitat: tap a creature', ['dew', 'glowmoss'], ['staranise'], 2, 'vita'),
  r('Dorm', 'dorm means sleep, like a dormitory', 'Calms a creature with high energy down to just right.', 'Habitat: tap a creature', ['dew', 'silversage'], ['dreamberries'], 2, 'dorm'),
  r('Viv', 'viv means lively, like vivid', 'Wakes up a creature with low energy to just right.', 'Habitat: tap a creature', ['dew', 'ginger'], ['chili'], 4, 'viv'),
  r('Lumin', 'lumin means light, like luminous', 'Fills your Habitat with floating lights at night.', 'Habitat: Potions button', ['dew', 'mooncap'], ['glowmoss'], 3, 'lumin'),
  r('Cryo', 'cryo means cold', 'Puts out a wildfire in your Habitat.', 'Habitat: Potions button', ['icechip', 'dew'], ['frostorchid'], 2, 'cryo'),
  r('Aqua', 'aqua means water', 'Ends a drought and fills the pond back up.', 'Habitat: Potions button', ['dew', 'grass'], ['icechip'], 3, 'aqua'),
  r('Fort', 'fort means strong, like a fortress', 'A strength potion for a pet: +1 training.', 'Pets: give it here, once a day', ['grass', 'ginger'], ['newt'], 3, 'fort'),
  r('Velo', 'velo means fast, like velocity', 'A speed potion for a pet: +1 training.', 'Pets: give it here, once a day', ['dew', 'chili'], ['vanilla'], 2, 'velo'),
  r('Mega', 'mega means huge', 'Makes one creature giant in your Habitat for a minute.', 'Habitat: tap a creature', ['grass', 'mothdust'], ['slimecore'], 5, 'mega'),
  r('Veloaero', 'velo means fast and aero means air', 'Super speed flying in Town Square for 1 minute.', 'Town Square: drink it here', ['grass', 'dew'], ['fairywing', 'phoenix'], 5, 'veloaero', 'Aero'),
  r('Megavita', 'mega means huge and vita means life', 'Heals every creature in your Habitat at once.', 'Habitat: Potions button', ['dew', 'glowmoss'], ['saffron'], 3, 'megavita', 'Vita'),
  r('Pyro', 'pyro means fire', 'Warms your Habitat and ends a blizzard.', 'Habitat: Potions button', ['dew', 'fireblossom'], ['dragonscale'], 3, 'pyro', 'Cryo'),
];
export const AERO = RECIPES[0];
export const VITA = RECIPES[1];

// Each student's progress, saved in their own row (no new tables).
export interface SnHabitat { biome?: string; health?: Record<string, number>; season?: number; plants?: number; mush?: number; groups?: Record<string, number> }
export interface SnSave { found?: string[]; potions?: string[]; names?: string[]; earned?: string[]; habitat?: SnHabitat; made?: import('./supernatureCreatures').Made[]; pantry?: Record<string, number>; brewed?: string[]; petDay?: string }
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
