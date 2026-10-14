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
import { MORE_PARTS, type MorphPart } from './supernatureMorphemes';
const CORE_PARTS: (Part & { example: string })[] = [
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
// Every word part: the core ones, then her morpheme tiles, her 111 Greek and Latin roots and the
// creature-name parts (Build Queue 114). The first one of each spelling wins.
export const WORD_PARTS: MorphPart[] = [...CORE_PARTS.map((p): MorphPart => ({ ...p, src: 'core', origin: 'Greek or Latin' })), ...MORE_PARTS]
  .filter((p, i, all) => all.findIndex((x) => x.text === p.text && x.kind === p.kind) === i);

// Ingredients (Build Queue 100, plan section 10, her spec): base ones like a glass bottle or grass
// are free; the rest are bought in the Shop with real money, $1 to $10, and rare ones $15 to $50.
// A few are also earned by exploring the Globe. Gross humor stays out of the base ingredients.
export type Tier = 'free' | 'basic' | 'rare' | 'wild';
export type Kind = 'spice' | 'herb' | 'nature' | 'critter' | 'relic';
export interface Ingredient { id: string; name: string; img: string; tier: Tier; price: number; note?: string; earnedAs?: string; kind?: Kind }
// The Shop's shelves (Build Queue 122, her words: "make sure the store function has lots of variety
// in potion ingredients").
export const KINDS: { id: Kind; label: string }[] = [
  { id: 'spice', label: 'Spices and seeds' }, { id: 'herb', label: 'Herbs, roots and flowers' }, { id: 'nature', label: 'From nature' },
  { id: 'critter', label: 'Creature finds' }, { id: 'relic', label: 'Crystals and relics' },
];
const SP = `${SN}ingredients/`, MAT = `${SN}materials/`;
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
  // More variety (Build Queue 122): real spices with real facts, garden herbs, things from nature,
  // gentle creature finds (nothing was ever hurt to get them) and rare crystals.
  { id: 'cinnamon', name: 'cinnamon stick', img: `${SP}cinnamon.png`, tier: 'basic', price: 100, kind: 'spice', note: 'Cinnamon is the inside bark of a tree, rolled up as it dries.' },
  { id: 'clove', name: 'clove', img: `${SP}clove.png`, tier: 'basic', price: 100, kind: 'spice', note: 'A clove is a flower bud that was picked and dried before it opened.' },
  { id: 'nutmeg', name: 'nutmeg', img: `${SP}nutmeg.png`, tier: 'basic', price: 150, kind: 'spice', note: 'Nutmeg is the seed of a tree from the Spice Islands of Indonesia.' },
  { id: 'cardamom', name: 'cardamom pod', img: `${SP}cardamom.png`, tier: 'basic', price: 150, kind: 'spice' },
  { id: 'turmeric', name: 'turmeric root', img: `${SP}turmeric.png`, tier: 'basic', price: 100, kind: 'spice', note: 'Turmeric is so yellow it was used to dye cloth.' },
  { id: 'peppercorn', name: 'peppercorns', img: `${SP}peppercorn.png`, tier: 'basic', price: 100, kind: 'spice' },
  { id: 'bayleaf', name: 'bay leaf', img: `${SP}bay-leaf.png`, tier: 'basic', price: 100, kind: 'spice', note: 'In ancient Greece, winners wore crowns of bay leaves.' },
  { id: 'juniper', name: 'juniper berry', img: `${SP}juniper-berry.png`, tier: 'basic', price: 150, kind: 'spice' },
  { id: 'sesame', name: 'sesame seeds', img: `${SP}sesame.png`, tier: 'basic', price: 100, kind: 'spice', note: '"Open sesame!" Sesame pods pop open when they are ripe.' },
  { id: 'sumac', name: 'sumac', img: `${SP}sumac.png`, tier: 'basic', price: 150, kind: 'spice' },
  { id: 'cumin', name: 'cumin seed', img: `${SP}cumin.png`, tier: 'basic', price: 100, kind: 'spice' },
  { id: 'coriander', name: 'coriander seed', img: `${SP}coriander-seed.png`, tier: 'basic', price: 100, kind: 'spice' },
  { id: 'allspice', name: 'allspice', img: `${SP}allspice.png`, tier: 'basic', price: 100, kind: 'spice', note: 'It smells like cinnamon, clove and nutmeg all at once.' },
  { id: 'licorice', name: 'licorice root', img: `${SP}licorice.png`, tier: 'basic', price: 200, kind: 'spice' },
  { id: 'galangal', name: 'galangal root', img: `${SP}galangal.png`, tier: 'basic', price: 200, kind: 'spice' },
  { id: 'garlic', name: 'garlic', img: `${SP}garlic.png`, tier: 'basic', price: 100, kind: 'spice' },
  { id: 'horseradish', name: 'horseradish', img: `${SP}horseradish.png`, tier: 'basic', price: 150, kind: 'spice' },
  { id: 'wasabi', name: 'wasabi', img: `${SP}wasabi.png`, tier: 'basic', price: 300, kind: 'spice', note: 'Real wasabi is a rare root that grows in cold mountain streams.' },
  { id: 'caper', name: 'capers', img: `${SP}caper.png`, tier: 'basic', price: 200, kind: 'spice' },
  { id: 'rubyleaf', name: 'ruby leaf', img: `${CAB}herbs-fungi-roots/ruby_leaf.png`, tier: 'basic', price: 400, kind: 'herb' },
  { id: 'twilightivy', name: 'twilight ivy', img: `${CAB}herbs-fungi-roots/twilight_ivy.png`, tier: 'basic', price: 500, kind: 'herb', note: 'It only grows in the shade.' },
  { id: 'whisperreed', name: 'whispering reed', img: `${CAB}herbs-fungi-roots/whispering_reed.png`, tier: 'basic', price: 500, kind: 'herb', note: 'Reeds grow at the edge of ponds and rivers.' },
  { id: 'ghostpepper', name: 'ghost pepper', img: `${CAB}herbs-fungi-roots/ghost_pepper.png`, tier: 'basic', price: 400, kind: 'herb', note: 'One of the hottest peppers in the world. Do not touch your eyes!' },
  { id: 'mandrake', name: 'mandrake root', img: `${CAB}herbs-fungi-roots/mandrake_root.png`, tier: 'basic', price: 600, kind: 'herb', note: 'In old stories mandrake roots shout. This one is just shy.' },
  { id: 'flytrap', name: 'flytrap flower', img: `${CAB}herbs-fungi-roots/carnivorous_flower.png`, tier: 'basic', price: 600, kind: 'herb', note: 'Some plants catch bugs for food, like the Venus flytrap.' },
  { id: 'snow', name: 'fresh snow', img: `${MAT}snow.png`, tier: 'basic', price: 100, kind: 'nature' },
  { id: 'fallleaves', name: 'fall leaves', img: `${MAT}leaves.png`, tier: 'basic', price: 100, kind: 'nature' },
  { id: 'riverstone', name: 'river stone', img: `${MAT}stone.png`, tier: 'basic', price: 200, kind: 'nature', note: 'Water smooths river stones over hundreds of years.' },
  { id: 'irondust', name: 'iron filings', img: `${MAT}iron.png`, tier: 'basic', price: 300, kind: 'nature', note: 'Iron filings jump to a magnet.' },
  { id: 'oakbark', name: 'oak bark', img: `${MAT}wood.png`, tier: 'basic', price: 200, kind: 'nature' },
  { id: 'shedscale', name: 'shed lizard scale', img: `${MAT}scales.png`, tier: 'basic', price: 300, kind: 'critter', note: 'Lizards shed their old skin as they grow. Nobody was bothered.' },
  { id: 'ectoplasm', name: 'ghost goo', img: `${CAB}monster-ingredients/ghost_ectoplasm.png`, tier: 'basic', price: 800, kind: 'critter', note: 'Wiggly, cold and a little gross. A friendly ghost left it behind.' },
  { id: 'trolltooth', name: 'troll tooth', img: `${CAB}monster-ingredients/troll_tooth.png`, tier: 'basic', price: 900, kind: 'critter', note: 'A troll lost a baby tooth. Trolls get new teeth, just like kids.' },
  { id: 'stoneheart', name: 'heart stone', img: `${CAB}monster-ingredients/stone_heart.png`, tier: 'basic', price: 1000, kind: 'nature', note: 'A heart-shaped stone, very heavy and very steady.' },
  { id: 'mimic', name: 'tiny bottled mimic', img: `${CAB}monster-ingredients/tiny_bottled_mimic.png`, tier: 'rare', price: 1500, kind: 'critter', note: 'It copies whatever is next to it. It is happy in its bottle.' },
  { id: 'basiliskeye', name: 'basilisk eye marble', img: `${CAB}monster-ingredients/basilisk_eye.png`, tier: 'rare', price: 1800, kind: 'critter', note: 'A glass marble shaped like a basilisk eye, from the stories.' },
  { id: 'heartforest', name: 'heart of the forest', img: `${CAB}legendary-relics/heart_of_the_forest.png`, tier: 'rare', price: 2200, kind: 'relic' },
  { id: 'worldseed', name: 'world tree seed', img: `${CAB}legendary-relics/seed_of_the_world_tree.png`, tier: 'rare', price: 2500, kind: 'relic', note: 'In Norse stories, the World Tree holds up all the worlds.' },
  { id: 'oracle', name: "oracle's crystal", img: `${CAB}legendary-relics/oracles_crystal.png`, tier: 'rare', price: 3000, kind: 'relic' },
  { id: 'lostlight', name: 'lantern of lost lights', img: `${CAB}legendary-relics/lantern_of_lost_lights.png`, tier: 'rare', price: 3500, kind: 'relic' },
];
// Older ingredients sorted onto the new shelves.
const OLD_KIND: Record<string, Kind> = {
  newt: 'spice', chili: 'spice', staranise: 'spice', ginger: 'spice', vanilla: 'spice', saffron: 'spice', silversage: 'herb', glowmoss: 'herb', dreamberries: 'herb',
  mooncap: 'herb', frostorchid: 'herb', fireblossom: 'herb', icechip: 'nature', mothdust: 'critter', slimecore: 'critter', mermaidtear: 'critter',
  phoenix: 'critter', dragonscale: 'critter', moonlight: 'relic', frozenflame: 'relic',
};
for (const g of INGREDIENTS) if (!g.kind && OLD_KIND[g.id]) g.kind = OLD_KIND[g.id];
// Wild plants picked or harvested in the Habitat (Build Queue 136). Not sold in the Shop: students find
// or grow them. Harmful plants are not ingredients.
for (const [id, name] of [['chamomile', 'chamomile'], ['lavender', 'lavender'], ['peppermint', 'peppermint'], ['echinacea', 'coneflower'], ['clover', 'clover'], ['fern', 'fern frond'],
  ['glowcap', 'glowcap mushroom'], ['willow', 'willow bark'], ['cattail', 'cattail'], ['waterlily', 'water lily'], ['arcticmoss', 'arctic moss'], ['snowlotus', 'snow lotus'],
  ['aloe', 'aloe leaf'], ['pricklypear', 'prickly pear'], ['sagebrush', 'sagebrush'], ['kelp', 'kelp'], ['coral', 'coral piece']] as const)
  INGREDIENTS.push({ id: `p_${id}`, name, img: `${SN}plants/${id}.png`, tier: 'wild', price: 0, kind: 'herb', note: 'Find it or grow it in the Habitat.' });
export const ING = (id: string) => INGREDIENTS.find((x) => x.id === id)!;

// The Cookbook (Build Queue 101, plan section 6): 10 base recipes, and discovered recipes that
// unlock after their base one is brewed (her example: flying unlocks super speed flying). Steps
// happen in order, and the part in parentheses always goes first (order of operations, her math
// year). Everything mixes in one cauldron (her ask, Build Queue 113: no separate bowl).
export interface Step { text: string; need: 'bowl' | 'pour' | 'add' | 'stir' | 'spell'; items?: string[]; times?: number; word?: string }
export interface Recipe { name: string; meaning: string; does: string; where: string; steps: Step[]; unlock?: string }
const r = (name: string, meaning: string, does: string, where: string, bowl: [string, string], add: string[], stir: number, word: string, unlock?: string): Recipe => ({
  name, meaning, does, where, unlock,
  steps: [
    { text: `Mix ( ${ING(bowl[0]).name} + ${ING(bowl[1]).name} ) in the cauldron first. Parentheses always go first.`, need: 'bowl', items: bowl },
    ...add.map((a): Step => ({ text: `Add 1 ${ING(a).name}.`, need: 'add', items: [a] })),
    { text: `Stir ${stir} times.`, need: 'stir', times: stir },
    { text: `Write the spell word with your wand: ${word}.`, need: 'spell', word },
  ],
});
export const RECIPES: Recipe[] = [
  r('Aero', 'aero means air', 'Lets one creature float up and fly over the Habitat for 1 minute.', 'Habitat: give it to one creature', ['grass', 'dew'], ['fairywing'], 3, 'aero'),
  r('Vita', 'vita means life', 'Heals one creature in the Habitat back to full hearts.', 'Habitat: tap a creature', ['dew', 'glowmoss'], ['staranise'], 2, 'vita'),
  r('Dorm', 'dorm means sleep, like a dormitory', 'Calms a creature with high energy down to just right.', 'Habitat: tap a creature', ['dew', 'silversage'], ['dreamberries'], 2, 'dorm'),
  r('Viv', 'viv means lively, like vivid', 'Wakes up a creature with low energy to just right.', 'Habitat: tap a creature', ['dew', 'ginger'], ['chili'], 4, 'viv'),
  r('Lumin', 'lumin means light, like luminous', 'Fills your Habitat with floating lights at night.', 'Habitat: Potions button', ['dew', 'mooncap'], ['glowmoss'], 3, 'lumin'),
  r('Cryo', 'cryo means cold', 'Puts out a wildfire in your Habitat.', 'Habitat: Potions button', ['icechip', 'dew'], ['frostorchid'], 2, 'cryo'),
  r('Aqua', 'aqua means water', 'Ends a drought and fills the pond back up.', 'Habitat: Potions button', ['dew', 'grass'], ['icechip'], 3, 'aqua'),
  r('Fort', 'fort means strong, like a fortress', 'A strength potion: one creature stands strong in tornadoes and earthquakes this season.', 'Habitat: give it to one creature', ['grass', 'ginger'], ['newt'], 3, 'fort'),
  r('Velo', 'velo means fast, like velocity', 'A speed potion: one creature runs super fast for 1 minute.', 'Habitat: give it to one creature', ['dew', 'chili'], ['vanilla'], 2, 'velo'),
  r('Mega', 'mega means huge', 'Makes one creature giant in your Habitat for a minute.', 'Habitat: tap a creature', ['grass', 'mothdust'], ['slimecore'], 5, 'mega'),
  r('Veloaero', 'velo means fast and aero means air', 'One creature zooms around the sky at super speed for 1 minute.', 'Habitat: give it to one creature', ['grass', 'dew'], ['fairywing', 'phoenix'], 5, 'veloaero', 'Aero'),
  r('Megavita', 'mega means huge and vita means life', 'Heals every creature in your Habitat at once.', 'Habitat: Potions button', ['dew', 'glowmoss'], ['saffron'], 3, 'megavita', 'Vita'),
  r('Pyro', 'pyro means fire', 'Warms your Habitat and ends a blizzard.', 'Habitat: Potions button', ['dew', 'fireblossom'], ['dragonscale'], 3, 'pyro', 'Cryo'),
  // Season potions (Build Queue 121, her words: "a comprehensive list of potions with hyper specific
  // purposes, like supporting desert animals through winter"). Each one helps one creature with one
  // hard time, and lasts until the season ends. Every name is a Greek or Latin word part.
  r('Thermo', 'thermo means heat, like a thermometer', 'Keeps a desert or scaly creature warm through the whole winter.', 'Habitat: give it to one creature', ['dew', 'cinnamon'], ['ginger', 'clove'], 3, 'thermo'),
  r('Umbra', 'umbra means shade, like an umbrella', 'Gives a furry creature cool shade through the whole summer.', 'Habitat: give it to one creature', ['dew', 'twilightivy'], ['snow'], 2, 'umbra'),
  r('Hydro', 'hydro means water, like a fire hydrant', 'One creature never gets thirsty in a drought this season.', 'Habitat: give it to one creature', ['dew', 'whisperreed'], ['icechip'], 4, 'hydro'),
  r('Somnus', 'somn means sleep, like insomnia', 'Tucks a creature in to hibernate: it sleeps safe and snug until winter ends.', 'Habitat: give it in fall or winter', ['dew', 'dreamberries'], ['nutmeg', 'fallleaves'], 2, 'somnus', 'Dorm'),
  r('Ancora', 'ancora means anchor', 'Holds a flier steady so a tornado cannot toss it this season.', 'Habitat: give it to a flier', ['grass', 'riverstone'], ['irondust'], 3, 'ancora'),
  r('Pneumo', 'pneum means air or breath, like pneumatic', 'Fresh air for one creature: no coughing in wildfire smoke this season.', 'Habitat: give it to one creature', ['dew', 'silversage'], ['cardamom'], 3, 'pneumo'),
  r('Sicco', 'sicc means dry, like desiccate', 'A dry coat: one creature stays dry in floods and storms this season.', 'Habitat: give it to one creature', ['grass', 'sumac'], ['shedscale'], 2, 'sicco'),
  r('Stabil', 'stabil means steady, like stable', 'Steady feet: one walker stays steady in an earthquake this season.', 'Habitat: give it to a walker', ['grass', 'stoneheart'], ['turmeric'], 4, 'stabil'),
  r('Patria', 'patri means homeland, like patriot', 'Makes any land feel like home: no homesickness this season.', 'Habitat: give it to one creature', ['grass', 'dew'], ['bayleaf', 'oakbark'], 3, 'patria'),
  r('Nidus', 'nid means nest', 'A cozy nest: a group can have babies even when it is not its baby season.', 'Habitat: give it to one creature', ['grass', 'fairywing'], ['juniper', 'sesame'], 3, 'nidus'),
  // Plant potions (Build Queue 136): made from plants the student finds or grows in the Habitat.
  r('Herba', 'herb means plant', 'Plant medicine: heals one creature 2 hearts and clears plant troubles.', 'Habitat: give it to one creature', ['p_aloe', 'p_willow'], ['dew'], 3, 'herba'),
  r('Calma', 'calm means quiet and still', 'Helps one creature feel calm (Green Zone) for the season, even in hard times.', 'Habitat: give it to one creature', ['p_chamomile', 'p_lavender'], ['p_waterlily'], 2, 'calma'),
  r('Germina', 'germin means sprout, like germinate', 'Every plant growing in this biome is ready to harvest right away.', 'Habitat: Potions hotbar', ['p_clover', 'p_fern'], ['grass'], 4, 'germina'),
  r('Antidota', 'anti means against, like antidote', 'Cures one creature that ate a harmful plant and protects it from them this season.', 'Habitat: give it to one creature', ['p_peppermint', 'p_echinacea'], ['dew'], 3, 'antidota'),
  r('Redux', 're means back and dux means to lead', 'Leads every creature family that did not survive back to your Habitat right away.', 'Habitat: Potions hotbar', ['dew', 'heartforest'], ['phoenix'], 5, 'redux', 'Vita'),
];
export const AERO = RECIPES[0];
export const VITA = RECIPES[1];

// Each student's progress, saved in their own row (no new tables).
export interface SnHabitat { biome?: string; health?: Record<string, number>; season?: number; plants?: number; mush?: number; groups?: Record<string, number>; levels?: Record<string, number>; abs?: number; seen?: Record<string, string[]>; faded?: Record<string, number>; buffs?: Record<string, string[]>; homes?: Record<string, string>; skills?: Record<string, Record<string, number>>; train?: Record<string, Record<string, number>>; out?: string[]; plots?: Record<string, ({ plant: string; at: number; frozenAt?: number; frozenAbs?: number; dead?: 'burnt' | 'dried' } | null)[]>; veg?: Record<string, { kind: 'burnt' | 'washed' | 'dried' | 'frozen'; abs: number }>; picked?: string[]; book?: string[]; names?: Record<string, string[]>; kin?: Record<string, { hp: number; born: number }[]> }
export interface SnSave { battle?: { npcs: import('./supernatureBattle').Npc[]; log: { npc: string; fighter: string; fighterName: string; won: boolean; at: string }[]; aff?: Record<string, string[]>; acc?: Record<string, { right: number; total: number }> }; found?: string[]; potions?: string[]; names?: string[]; earned?: string[]; habitat?: SnHabitat; made?: import('./supernatureCreatures').Made[]; pantry?: Record<string, number>; brewed?: string[]; spellbook?: { id: string; type: 'spell' | 'creature' | 'invention' | 'phobia'; name: string; parts: Part[]; explain: string; haiku?: string[]; art?: string; at: string }[]; petDay?: string; checkins?: number }
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

// Naturalist rank (Build Queue 105; plan section 5). XP comes from everything a student does in
// Supernature, so it never needs its own bookkeeping beyond check-ins and creature levels. Each
// rank unlocks something new (nothing that was already open ever gets locked).
export const RANKS = [
  { name: 'Apprentice', at: 0, unlock: 'Welcome to Supernature!' },
  { name: 'Field Scout', at: 60, unlock: '6 sparkly colors in the Creature Maker' },
  { name: 'Creature Keeper', at: 160, unlock: 'Rainbow Storm, a magic weather for your Habitat' },
  { name: 'Habitat Builder', at: 320, unlock: 'Meteor Sparkle Shower, a magic sky for your Habitat' },
  { name: 'Grand Naturalist', at: 560, unlock: 'Gold creature cards and a crown for the Cat Wizard' },
];
export const SPARKLY_COLORS = ['#ff9de2', '#9de8ff', '#c9ff9d', '#ffd1a1', '#b9a1ff', '#fff27a'];
export function naturalist(save: SnSave) {
  const levels = Object.values(save.habitat?.levels ?? {}).reduce((a, n) => a + n, 0);
  const parts = [
    { label: 'creatures found', n: (save.found ?? []).length, each: 10 },
    { label: 'creatures made', n: (save.made ?? []).length, each: 15 },
    { label: 'recipes brewed', n: (save.brewed ?? []).length, each: 10 },
    { label: 'seasons in the Habitat', n: save.habitat?.season ?? 0, each: 5 },
    { label: 'creature levels', n: levels, each: 5 },
    { label: 'energy check-ins', n: save.checkins ?? 0, each: 3 },
  ];
  const xp = parts.reduce((a, p) => a + p.n * p.each, 0);
  let level = 0; RANKS.forEach((r, i) => { if (xp >= r.at) level = i; });
  return { xp, level, rank: RANKS[level], next: RANKS[level + 1], parts };
}

// Pixel bottles for every potion (her Witch's Cabinet), used by the Habitat hotbar and the Cauldron.
const BREW = `${SN}cabinet/bottled-brews/`;
export const POTION_ICON: Record<string, string> = {
  Aero: `${BREW}preserved_fairy.png`, Vita: `${BREW}healing_tincture.png`, Dorm: `${BREW}sleepy_draught.png`, Viv: `${BREW}liquid_luck.png`,
  Lumin: `${BREW}bottled_moonlight.png`, Cryo: `${BREW}ghost_essence.png`, Aqua: `${BREW}mana_draught.png`, Fort: `${BREW}mystery_potion.png`,
  Velo: `${BREW}memory_tonic.png`, Mega: `${BREW}transformation_serum.png`, Veloaero: `${BREW}bottled_storm.png`, Megavita: `${BREW}friendship_philter.png`,
  Pyro: `${BREW}dragonfire_flask.png`,
  Herba: `${SN}plants/aloe.png`, Calma: `${SN}plants/lavender.png`, Germina: `${SN}plants/sprout.png`, Antidota: `${SN}plants/peppermint.png`,
  ...Object.fromEntries(['Thermo', 'Umbra', 'Hydro', 'Somnus', 'Ancora', 'Pneumo', 'Sicco', 'Stabil', 'Patria', 'Nidus', 'Redux'].map((n) => [n, `${SN}potions/${n.toLowerCase()}.png`])),
};
