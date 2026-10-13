import { useStore } from '../store/store';

// Supernature, the witchy creature app on the student computer (Build Queue item 96, plan in
// docs/SUPERNATURE_PLAN.md). This file holds its data (starter creatures, word parts, the first
// recipe, the Habitat roster), each student's saved progress, and its sounds.

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
export interface Creature {
  id: string; name: string; say: string; from: string; region: string; regionLabel: string;
  story: string; traits: string[]; energy: Energy;
  nameParts?: Part[]; nameNote: string; explore: 'explore' | 'remix';
  ingredient: { name: string; img: string };
}

// One starter creature per continent and ocean (her answer, 2026-10-13). Antarctica and the
// Southern Ocean have no traditional creature stories, so they are the students' frontier.
export const CREATURES: Creature[] = [
  { id: 'griffin', name: 'Griffin', say: 'GRIFF-in', from: 'Greece', region: 'europe', regionLabel: 'Europe', explore: 'remix',
    story: 'In stories from ancient Greece, the griffin has the body of a lion and the head and wings of an eagle. It guarded gold high in the mountains.',
    traits: ['flying', 'sharp claws', 'walking'], energy: 'high', nameNote: 'Its name comes from an old Greek word.',
    ingredient: { name: 'lost feather', img: `${SN}cabinet/monster-ingredients/phoenix_feather.png` } },
  { id: 'kappa', name: 'Kappa', say: 'KAH-pah', from: 'Japan', region: 'asia', regionLabel: 'Asia', explore: 'remix',
    story: 'In stories told in Japan, the kappa lives in rivers and ponds. It is famous for mischief, and for always keeping a promise. It carries water in a dish on top of its head.',
    traits: ['aquatic', 'mischievous', 'walking', 'water breathing'], energy: 'high',
    nameParts: [{ text: 'kawa', meaning: 'river', kind: 'main' }, { text: 'wappa', meaning: 'child', kind: 'main' }],
    nameNote: '"River child" in Japanese.', ingredient: { name: 'river water', img: `${SN}materials/water.png` } },
  { id: 'sphinx', name: 'Sphinx', say: 'SFINKS', from: 'Egypt', region: 'africa', regionLabel: 'Africa', explore: 'remix',
    story: 'In stories from ancient Egypt, the sphinx has the body of a lion and the head of a person. Huge stone sphinxes still guard old temples today.',
    traits: ['walking', 'very smart', 'calm'], energy: 'low', nameNote: 'Its name came to English through Greek.',
    ingredient: { name: 'desert sand', img: `${SN}materials/dirt.png` } },
  { id: 'jackalope', name: 'Jackalope', say: 'JACK-uh-lope', from: 'Wyoming, USA', region: 'northamerica', regionLabel: 'North America', explore: 'remix',
    story: 'A joke creature from Wyoming: a jackrabbit with antelope horns. People tell tall tales about it and sell funny postcards of it.',
    traits: ['hopping', 'horns', 'shy', 'fast'], energy: 'very high',
    nameParts: [{ text: 'jackrabbit', meaning: 'a big hare', kind: 'main' }, { text: 'antelope', meaning: 'a horned runner', kind: 'main' }],
    nameNote: 'A blend: two words squished into one.', ingredient: { name: 'lucky leaf', img: `${SN}ingredients/bay-leaf.png` } },
  { id: 'curupira', name: 'Curupira', say: 'koo-roo-PEE-rah', from: 'Brazil', region: 'southamerica', regionLabel: 'South America', explore: 'explore',
    story: 'In stories from Brazil, the Curupira is a guardian of the forest with bright hair and feet that point backward, so its tracks lead the wrong way. It protects the animals of the forest.',
    traits: ['walking', 'fast', 'protector'], energy: 'high', nameNote: 'Its name comes from the Tupi language of Brazil.',
    ingredient: { name: 'forest leaf', img: `${SN}materials/leaves.png` } },
  { id: 'bunyip', name: 'Bunyip', say: 'BUN-yip', from: 'Australia (Aboriginal peoples)', region: 'oceania', regionLabel: 'Oceania', explore: 'explore',
    story: 'In stories told by Aboriginal peoples of southeastern Australia, the Bunyip lives in swamps, creeks and waterholes. People said you could hear its booming call at night.',
    traits: ['aquatic', 'loud call', 'night creature'], energy: 'low', nameNote: 'Its name comes from an Aboriginal language of southeastern Australia.',
    ingredient: { name: 'swamp reed', img: `${SN}cabinet/herbs-fungi-roots/whispering_reed.png` } },
  { id: 'selkie', name: 'Selkie', say: 'SELL-kee', from: 'Scotland and Ireland', region: 'atlantic', regionLabel: 'Atlantic Ocean', explore: 'remix',
    story: 'In stories from Scotland and Ireland, a selkie is a seal that can take off its sealskin and walk on land as a person.',
    traits: ['aquatic', 'shape changing', 'swimming'], energy: 'just right',
    nameParts: [{ text: 'selch', meaning: 'seal (Scots)', kind: 'main' }, { text: 'ie', meaning: 'little', kind: 'end' }],
    nameNote: '"Little seal" in Scots.', ingredient: { name: 'sea star', img: `${SN}habitat/starfish.png` } },
  { id: 'umibozu', name: 'Umibozu', say: 'oo-mee-BOH-zoo', from: 'Japan', region: 'pacific', regionLabel: 'Pacific Ocean', explore: 'remix',
    story: 'In stories from Japan, the umibozu is a huge, dark sea giant that rises out of calm water at night. Sailors told each other to stay very quiet if they saw one.',
    traits: ['aquatic', 'giant', 'night creature'], energy: 'very low',
    nameParts: [{ text: 'umi', meaning: 'sea', kind: 'main' }, { text: 'bozu', meaning: 'monk', kind: 'main' }],
    nameNote: '"Sea monk" in Japanese.', ingredient: { name: 'deep sea ink', img: `${SN}cabinet/bottled-brews/shadow_ink.png` } },
  { id: 'mermaid', name: 'Mermaid', say: 'MUR-maid', from: 'sailors\' stories around the world', region: 'indian', regionLabel: 'Indian Ocean', explore: 'remix',
    story: 'Sailors all around the world told stories of mermaids: half person and half fish, singing to ships from the rocks.',
    traits: ['aquatic', 'singing', 'swimming'], energy: 'just right',
    nameParts: [{ text: 'mere', meaning: 'sea (Old English)', kind: 'main' }, { text: 'maid', meaning: 'young woman', kind: 'main' }],
    nameNote: '"Sea maid" in Old English.', ingredient: { name: 'mermaid tear', img: `${SN}cabinet/monster-ingredients/mermaid_tear.png` } },
  { id: 'kraken', name: 'Kraken', say: 'KRAH-ken', from: 'Norway', region: 'arctic', regionLabel: 'Arctic Ocean', explore: 'remix',
    story: 'In stories from Norway, the Kraken is a sea creature so big that sailors thought it was an island until it moved.',
    traits: ['aquatic', 'giant', 'tentacles'], energy: 'low', nameNote: 'Its name comes from Norwegian.',
    ingredient: { name: 'storm in a bottle', img: `${SN}cabinet/bottled-brews/bottled_storm.png` } },
];

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
export const AERO: { name: string; meaning: string; does: string; steps: Step[] } = {
  name: 'Aero', meaning: 'aero means air', does: 'Lets you float and fly for 1 minute in Town Square.',
  steps: [
    { text: 'In the bowl, mix ( grass + dew ). The bowl always goes first.', need: 'bowl', items: ['grass', 'dew'] },
    { text: 'Pour the bowl into the cauldron.', need: 'pour' },
    { text: 'Add 1 fairy wing.', need: 'add', items: ['fairywing'] },
    { text: 'Stir 3 times.', need: 'stir', times: 3 },
    { text: 'Write the spell word with your wand: aero.', need: 'spell', word: 'aero' },
  ],
};

// Each student's progress, saved in their own row (no new tables).
export interface SnSave { found?: string[]; potions?: string[]; names?: string[]; earned?: string[] }
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
