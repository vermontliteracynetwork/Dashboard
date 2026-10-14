// Plants and wild critters for the Habitat (Build Queue 135, 136, her words, 2026-10-14: "add
// plants/flora/fauna" and "plants should have a level of naturopathy/alchemy. plants can be used in
// potion making. some plants should be bad for you and have negative effects, and some should be
// healing. plants can be planted and harvested within biomes (relative to their actual survival: coral
// in water, for example). flora/fauna exists naturally in biomes too and should be planted sparsely and
// randomly to be collected"). Each plant grows only where it really could, has a real plant-lore fact
// and an alchemy use, and is healing, food, magic or harmful. Picked or harvested plants go into the
// pantry as Cauldron ingredients.
import { SN } from './supernature';
import { KIND_CHOICES, STEMS, LEAVES, plantUrl, whereItLives, type MadePlant, type PlantSpec } from './supernaturePlantMaker';

export type PlantKind = 'healing' | 'food' | 'magic' | 'harmful';
export type PlantPlace = 'grassland' | 'forest' | 'desert' | 'snow' | 'swamp' | 'ocean';
export interface Plant { id: string; name: string; kind: PlantKind; where: PlantPlace[]; winter?: boolean; lore: string; alchemy: string; eaten: string; status?: string }
const P = `${SN}plants/`;
// Her Plants pack (2026-10-14): garden growing stages and the snapjaw flower come from it.
export const plantImg = (id: string) => (SPECS.has(id) ? plantUrl(SPECS.get(id)!) : id === 'snapjaw' ? `${P}pack/snapjaw.png` : id === 'seed' ? `${P}pack/stage-seed.png` : id === 'sprout' ? `${P}pack/stage-sprout.png` : `${P}${id}.png`);
export const SNAPJAW_STRIP = `${P}pack/snapjaw0.png`;
export const PLANTS: Plant[] = [
  { id: 'chamomile', name: 'Chamomile', kind: 'healing', where: ['grassland'], lore: 'Chamomile tea has been used for thousands of years to help people feel calm and sleepy.', alchemy: 'Calms: used in Calma.', eaten: 'feels calm and rested' },
  { id: 'lavender', name: 'Lavender', kind: 'healing', where: ['grassland'], lore: 'The smell of lavender helps many people relax. Bees love it too.', alchemy: 'Calms: used in Calma.', eaten: 'smells lovely and relaxes' },
  { id: 'peppermint', name: 'Peppermint', kind: 'healing', where: ['grassland', 'swamp'], lore: 'Peppermint tea can help an upset tummy feel better.', alchemy: 'Settles: used in Antidota.', eaten: 'feels fresh and minty' },
  { id: 'echinacea', name: 'Coneflower', kind: 'healing', where: ['grassland'], lore: 'Coneflower (echinacea) is a prairie flower people use when they have a cold.', alchemy: 'Protects: used in Antidota.', eaten: 'feels stronger' },
  { id: 'clover', name: 'Clover', kind: 'food', where: ['grassland', 'forest'], lore: 'A four-leaf clover is rare: about 1 in every 5,000 clovers.', alchemy: 'Grows: used in Germina.', eaten: 'munches a tasty snack' },
  { id: 'sneezeweed', name: 'Sneezeweed', kind: 'harmful', where: ['grassland', 'swamp'], lore: 'Its name says it all: sniffing the dried flowers makes people sneeze. It is not good to eat.', alchemy: 'Too sneezy for potions.', eaten: 'starts sneezing and sneezing', status: 'sneezy' },
  { id: 'fern', name: 'Fern', kind: 'food', where: ['forest', 'swamp'], lore: 'Ferns are older than the dinosaurs. They grow from tiny spores, not seeds.', alchemy: 'Grows: used in Germina.', eaten: 'nibbles the soft fronds' },
  { id: 'foxglove', name: 'Foxglove', kind: 'harmful', where: ['forest'], lore: 'Foxglove is beautiful but poisonous to eat. Doctors make a careful heart medicine from it.', alchemy: 'Only a doctor may use it. Never in a potion.', eaten: 'gets a tummy ache', status: 'tummy' },
  { id: 'glowcap', name: 'Glowcap mushroom', kind: 'magic', where: ['forest', 'swamp'], lore: 'Some real mushrooms glow in the dark. This is called bioluminescence.', alchemy: 'Glows: a magic plant for night potions.', eaten: 'glows softly for a moment' },
  { id: 'willow', name: 'Willow bark', kind: 'healing', where: ['swamp', 'forest'], lore: 'Long ago people chewed willow bark for aches. Aspirin medicine was first made from it.', alchemy: 'Soothes: used in Herba.', eaten: 'feels its aches go away' },
  { id: 'cattail', name: 'Cattail', kind: 'food', where: ['swamp'], lore: 'Almost every part of a cattail can be eaten. Ducks and muskrats nest in them.', alchemy: 'Feeds: a good potion base.', eaten: 'chews a crunchy stalk' },
  { id: 'sundew', name: 'Sundew', kind: 'harmful', where: ['swamp'], lore: 'Sundews catch bugs with sticky drops on their leaves. They are meat-eating plants!', alchemy: 'Too sticky for potions.', eaten: 'gets stuck in the sticky drops', status: 'sticky' },
  { id: 'waterlily', name: 'Water lily', kind: 'healing', where: ['swamp'], lore: 'Water lily flowers close at night and open again in the morning.', alchemy: 'Calms: used in Calma.', eaten: 'feels peaceful' },
  { id: 'nettle', name: 'Stinging nettle', kind: 'harmful', where: ['forest', 'grassland'], lore: 'Tiny hairs on nettle leaves sting when you touch them. Cooked nettle soup is healthy, though.', alchemy: 'Use gloves! Strong when cooked.', eaten: 'gets itchy from the stinging hairs', status: 'itchy' },
  { id: 'arcticmoss', name: 'Arctic moss', kind: 'food', where: ['snow'], winter: true, lore: 'Reindeer and caribou eat arctic moss all winter long.', alchemy: 'Warms: a base for cold-weather potions.', eaten: 'munches moss under the snow' },
  { id: 'snowlotus', name: 'Snow lotus', kind: 'healing', where: ['snow'], winter: true, lore: 'The snow lotus grows high in cold mountains, where few plants can live.', alchemy: 'Warms and heals: used in Herba.', eaten: 'feels warm inside' },
  { id: 'aloe', name: 'Aloe', kind: 'healing', where: ['desert'], lore: 'The cool gel inside aloe leaves soothes sunburns.', alchemy: 'Soothes: used in Herba.', eaten: 'feels cool and soothed' },
  { id: 'pricklypear', name: 'Prickly pear', kind: 'food', where: ['desert'], lore: 'Prickly pear fruit is sweet, but it is covered in tiny spines. Desert animals eat it for water.', alchemy: 'Feeds: holds water for desert potions.', eaten: 'eats the juicy fruit' },
  { id: 'sagebrush', name: 'Sagebrush', kind: 'food', where: ['desert', 'grassland'], lore: 'Sagebrush smells strong after rain. Many desert animals live under it.', alchemy: 'Feeds: a base for dry-land potions.', eaten: 'nibbles the silver leaves' },
  { id: 'kelp', name: 'Kelp', kind: 'food', where: ['ocean'], lore: 'Giant kelp can grow half a meter in one day. Kelp forests are homes for sea otters.', alchemy: 'Feeds: a sea potion base.', eaten: 'munches kelp' },
  { id: 'coral', name: 'Coral', kind: 'food', where: ['ocean'], lore: 'Coral looks like a plant, but it is made of tiny animals. Coral reefs are homes for many fish.', alchemy: 'Protects: a sea potion base.', eaten: 'swims through the reef' },
  { id: 'snapjaw', name: 'Snapjaw flower', kind: 'harmful', where: ['forest', 'swamp', 'grassland'], lore: 'Like a giant Venus flytrap: it snaps at anything that comes too close. Admire it from far away!', alchemy: 'Too snappy for potions.', eaten: 'got snapped at and jumped back', status: 'startled' },
  { id: 'anemone', name: 'Sea anemone', kind: 'harmful', where: ['ocean'], lore: 'Sea anemones sting small fish, but clownfish live safely inside them.', alchemy: 'Too stingy for potions.', eaten: 'gets stung by the tentacles', status: 'stung' },
];
// Plants the student made in the Plant Maker (Build Queue 157) live alongside the real ones.
let MADE_PLANTS: Plant[] = [];
const SPECS = new Map<string, PlantSpec>();
export function setMadePlants(list: MadePlant[]) {
  SPECS.clear();
  MADE_PLANTS = list.map((m) => {
    SPECS.set(m.id, m.spec);
    const w = whereItLives(m.spec).where;
    const stem = STEMS.find((x) => x.id === m.spec.stem)!, leaf = LEAVES.find((x) => x.id === m.spec.leaf)!;
    return { id: m.id, name: m.name, kind: m.kind, where: w, winter: w.includes('snow'), lore: m.sentence?.trim() || `A plant you made. Its ${stem.label.toLowerCase()} ${stem.does}, and its ${leaf.label.toLowerCase()} ${leaf.does}.`,
      alchemy: KIND_CHOICES.find((k) => k.id === m.kind)!.alchemy, eaten: m.kind === 'harmful' ? 'gets itchy from it' : m.kind === 'healing' ? 'feels better' : m.kind === 'magic' ? 'sparkles for a moment' : 'munches a tasty snack', status: m.kind === 'harmful' ? 'itchy' : undefined };
  });
}
export const madePlantIds = () => MADE_PLANTS.map((p) => p.id);
export const PLANT = (id: string) => PLANTS.find((p) => p.id === id) ?? MADE_PLANTS.find((p) => p.id === id);
export const KIND_LABEL: Record<PlantKind, string> = { healing: '💚 Healing', food: '🍽️ Food', magic: '✨ Magic', harmful: '⚠️ Harmful' };
export const EFFECT_STATUS: Record<string, string> = { sneezy: '🤧 Sneezing from sneezeweed', tummy: '🤢 A tummy ache from foxglove', sticky: '🍯 Stuck in sticky sundew drops', itchy: '😣 Itchy from stinging nettle', stung: '🫧 Stung by a sea anemone', startled: '😳 Startled by a snapjaw flower' };

// Wild critters to spot (fauna). Spotting one adds it to the Plant and Critter Book.
export interface Critter { id: string; name: string; img: string; where: PlantPlace[]; lore: string }
const HB = `${SN}habitat/`;
export const CRITTERS: Critter[] = [
  { id: 'leafbug', name: 'Leaf bug', img: `${HB}leafbug.png`, where: ['forest', 'grassland'], lore: 'Leaf insects look so much like leaves that birds fly right past them. That is camouflage!' },
  { id: 'firebug', name: 'Firebug', img: `${HB}firebug.png`, where: ['grassland', 'desert'], lore: 'Firebugs gather in big groups in the sun to stay warm.' },
  { id: 'clampbeetle', name: 'Stag beetle', img: `${HB}clampbeetle.png`, where: ['forest', 'swamp'], lore: 'Stag beetles use their big jaws like antlers. They help break down old wood.' },
  { id: 'scorpion', name: 'Scorpion', img: `${HB}scorpion.png`, where: ['desert'], lore: 'Scorpions glow blue under ultraviolet light. Watch, do not touch!' },
  { id: 'starfish', name: 'Sea star', img: `${HB}starfish.png`, where: ['ocean'], lore: 'A sea star can grow back an arm it lost.' },
  { id: 'voidbutterfly', name: 'Night butterfly', img: `${HB}voidbutterfly.png`, where: ['forest', 'swamp', 'snow'], lore: 'Some butterflies and moths fly at night and find flowers by smell.' },
];

// Plant lore rank: how much the student knows about plants and critters (her "level of naturopathy/alchemy").
export const LORE_RANKS = [{ at: 0, name: 'Seed' }, { at: 3, name: 'Sprout' }, { at: 7, name: 'Herbalist' }, { at: 12, name: 'Alchemist' }, { at: 20, name: 'Master Alchemist' }];
export function loreRank(n: number) { let r = LORE_RANKS[0]; for (const x of LORE_RANKS) if (n >= x.at) r = x; const next = LORE_RANKS.find((x) => x.at > n); return { rank: r.name, next }; }

// Where a plant can live, and why not when it cannot.
export function canGrow(p: Plant, place: PlantPlace, season: string): { ok: boolean; why?: string } {
  if (!p.where.includes(place)) return { ok: false, why: `${p.name} only lives in the ${p.where.join(' or ')}.` };
  if (season === 'Winter' && !p.winter && place !== 'ocean') return { ok: false, why: 'It is winter: it is too cold for it to grow until spring.' };
  return { ok: true };
}
// Growing time: 1 minute to sprout, 2 more to be ready (it keeps growing while the student is away).
export const SPROUT_MS = 60_000, GROWN_MS = 180_000;

// Wild plants and critters sprinkled sparsely and randomly in each biome, new every season.
export function wildSpots(place: PlantPlace, abs: number): { key: string; plant?: string; critter?: string; x: number; y: number }[] {
  let seed = (abs * 9301 + place.length * 49297 + place.charCodeAt(0) * 233) % 233280;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const plants = [...PLANTS, ...MADE_PLANTS].filter((p) => p.where.includes(place));
  const critters = CRITTERS.filter((c) => c.where.includes(place));
  const out: { key: string; plant?: string; critter?: string; x: number; y: number }[] = [];
  const n = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < n && plants.length; i++) out.push({ key: `${abs}:${place}:p${i}`, plant: plants[Math.floor(rnd() * plants.length)].id, x: 250 + Math.floor(rnd() * 520), y: place === 'ocean' ? 470 + Math.floor(rnd() * 40) : 230 + Math.floor(rnd() * 260) });
  if (critters.length && rnd() < 0.8) out.push({ key: `${abs}:${place}:c`, critter: critters[Math.floor(rnd() * critters.length)].id, x: 260 + Math.floor(rnd() * 500), y: place === 'ocean' ? 480 : 250 + Math.floor(rnd() * 220) });
  return out;
}
// Garden plots in each biome (fixed spots near the bottom, clear of the pond and the shelter).
export const PLOTS: Record<PlantPlace, { x: number; y: number }[]> = {
  grassland: [{ x: 300, y: 500 }, { x: 390, y: 500 }, { x: 480, y: 500 }, { x: 570, y: 500 }],
  forest: [{ x: 300, y: 500 }, { x: 390, y: 500 }, { x: 480, y: 500 }, { x: 570, y: 500 }],
  desert: [{ x: 300, y: 500 }, { x: 390, y: 500 }, { x: 480, y: 500 }, { x: 570, y: 500 }],
  snow: [{ x: 300, y: 500 }, { x: 390, y: 500 }, { x: 480, y: 500 }, { x: 570, y: 500 }],
  swamp: [{ x: 300, y: 500 }, { x: 390, y: 500 }, { x: 480, y: 500 }, { x: 570, y: 500 }],
  ocean: [{ x: 420, y: 500 }, { x: 520, y: 500 }, { x: 620, y: 500 }, { x: 720, y: 500 }],
};
