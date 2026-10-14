// The Cauldron (Build Queue 168, 170, 171): one magic screen for brewing. Every potion is real
// science + a spark of magic + an action, in a wizards-and-mythology frame (her words, 2026-10-14:
// "real science logic in fun game play way. think magic, wizards, mythology"; "key element required
// for some; near misses make a weaker potion"). Pure data and rules: no React.
import { RECIPES, ING, type Recipe } from './supernature';
import { SUB } from '../games/scienceLab/lab';

export type Action = 'heat' | 'stir' | 'chill' | 'zap';
export const ACTIONS: { id: Action; icon: string; label: string; does: string }[] = [
  { id: 'heat', icon: '🔥', label: 'Heat', does: 'Fire under the pot makes things react faster.' },
  { id: 'stir', icon: '🌀', label: 'Stir', does: 'Stirring mixes everything together.' },
  { id: 'chill', icon: '❄️', label: 'Chill', does: 'Cold slows things down and keeps them still.' },
  { id: 'zap', icon: '⚡', label: 'Zap', does: 'A spark of lightning starts some reactions.' },
];

// The element shelf: the real elements (same as the Science Lab) and a few kitchen chemicals.
// Each has a magic nickname from mythology and what it really does.
export interface Elem { id: string; name: string; sym: string; img: string; magic: string; real: string; purpose?: Purpose }
const A = '/games/supernature/alchemy/el/';
const E = (id: string, magic: string, real: string, purpose?: Purpose, sym?: string): Elem => ({ id, name: SUB.get(id)?.name ?? id, sym: sym ?? SUB.get(id)?.formula ?? id, img: `${A}${id}.png`, magic, real, purpose });
export const ELEMENTS: Elem[] = [
  E('H', 'Starfuel', 'Hydrogen is the lightest element. The sun burns it to make light.', undefined, 'H'),
  E('He', 'Featherlight', 'Helium is lighter than air, so balloons float.', 'fly', 'He'),
  E('Li', 'Stormspark', 'Lithium stores energy in batteries.', 'fast', 'Li'),
  E('C', 'Lifespark', 'Carbon is in every living thing. It burns in oxygen.', undefined, 'C'),
  E('N', 'Frostbreath', 'Nitrogen turns liquid at minus 196 °C, cold enough to freeze anything.', 'cold', 'N'),
  E('O', 'Breath of Life', 'Oxygen is the part of air we breathe. Fire needs it too.', 'breathe', 'O'),
  E('Na', 'Wild Metal', 'Sodium is a soft metal that fizzes in water.', undefined, 'Na'),
  E('Mg', 'Sunfire', 'Magnesium burns with a blinding white light.', 'light', 'Mg'),
  E('Al', 'Skymetal', 'Shiny aluminum reflects sunlight. Airplanes are made of it.', 'shade', 'Al'),
  E('S', 'Dragon Brimstone', 'Sulfur smells like rotten eggs, and volcanoes puff it out.', undefined, 'S'),
  E('Cl', 'Green Mist', 'Chlorine keeps pool water clean.', undefined, 'Cl'),
  E('K', 'Banana Fire', 'Potassium is in bananas and gives muscles energy.', 'wake', 'K'),
  E('Ca', 'Bonestone', 'Calcium builds strong bones and eggshells.', 'heal', 'Ca'),
  E('Fe', 'Ironheart', 'Iron is strong and heavy. Steel is made from it.', 'strong', 'Fe'),
  E('Cu', 'Bluefire Wire', 'Copper carries electricity through wires.', undefined, 'Cu'),
  E('I', 'Violet Healer', 'Iodine cleans cuts so they heal.', 'cure', 'I'),
  E('water', 'Moonwater', 'Water: two hydrogens and one oxygen, H₂O.'),
  E('salt', 'Sea Crystals', 'Salt pulls water out of things.', 'dry'),
  E('sugar', 'Sweet Sand', 'Sugar is quick energy for living things.'),
  E('yeast', 'Rising Dust', 'Yeast eats sugar and makes gas, so dough grows big.', 'giant'),
  E('oil', 'Slick Gold', 'Oil and water do not mix, so oil sheds water.', 'dry'),
  E('chalk', 'Stone Dust', 'Chalk is solid rock made of tiny shells.', 'steady'),
  E('vinegar', 'Sour Brew', 'Vinegar is an acid. It fizzes with baking soda.'),
  E('bakingsoda', 'Fizz Powder', 'Baking soda is a base. It fizzes with acids.'),
];
export const ELEM = new Map(ELEMENTS.map((e) => [e.id, e]));

// What a potion is for. A custom potion with no clear purpose must be given one (her rule).
export type Purpose = 'fly' | 'heal' | 'calm' | 'wake' | 'light' | 'cold' | 'water' | 'strong' | 'fast' | 'giant' | 'fire' | 'warm' | 'shade' | 'breathe' | 'dry' | 'steady' | 'home' | 'grow' | 'cure';
// Each purpose works like one of the Cookbook potions in the Habitat.
export const PURPOSES: { id: Purpose; label: string; icon: string; base: string; shape: Shape }[] = [
  { id: 'fly', label: 'Flying', icon: '🪽', base: 'Aero', shape: 'star' }, { id: 'heal', label: 'Healing', icon: '💖', base: 'Vita', shape: 'heart' },
  { id: 'calm', label: 'Calm', icon: '😌', base: 'Dorm', shape: 'round' }, { id: 'wake', label: 'Wake up', icon: '⏰', base: 'Viv', shape: 'tall' },
  { id: 'light', label: 'Light', icon: '💡', base: 'Lumin', shape: 'star' }, { id: 'cold', label: 'Freezing', icon: '❄️', base: 'Cryo', shape: 'diamond' },
  { id: 'water', label: 'Rain', icon: '🌧️', base: 'Aqua', shape: 'gourd' }, { id: 'strong', label: 'Strength', icon: '💪', base: 'Fort', shape: 'diamond' },
  { id: 'fast', label: 'Speed', icon: '💨', base: 'Velo', shape: 'tall' }, { id: 'giant', label: 'Giant', icon: '🦣', base: 'Mega', shape: 'gourd' },
  { id: 'fire', label: 'Fire', icon: '🔥', base: 'Pyro', shape: 'round' }, { id: 'warm', label: 'Warmth', icon: '🧣', base: 'Thermo', shape: 'round' },
  { id: 'shade', label: 'Shade', icon: '⛱️', base: 'Umbra', shape: 'tall' }, { id: 'breathe', label: 'Fresh air', icon: '🌬️', base: 'Pneumo', shape: 'gourd' },
  { id: 'dry', label: 'Stay dry', icon: '☂️', base: 'Sicco', shape: 'diamond' }, { id: 'steady', label: 'Steady feet', icon: '🪨', base: 'Stabil', shape: 'round' },
  { id: 'home', label: 'Feel at home', icon: '🏡', base: 'Patria', shape: 'heart' }, { id: 'grow', label: 'Plant growth', icon: '🌱', base: 'Germina', shape: 'gourd' },
  { id: 'cure', label: 'Cure', icon: '🩹', base: 'Antidota', shape: 'heart' },
];
export const PURPOSE = new Map(PURPOSES.map((p) => [p.id, p]));
export type Shape = 'round' | 'heart' | 'star' | 'tall' | 'diamond' | 'gourd';
export const bottleImg = (s: Shape) => `/games/supernature/alchemy/bottles/${s}.png`;
export const bottleMask = (s: Shape) => `/games/supernature/alchemy/bottles/${s}-liquid.png`;

// The Cookbook potions, rebuilt as science recipes. key = required elements; extras = helpful elements
// (missing ones make a weaker potion); act = the action; why = the real science; myth = the story.
export interface Science { key: string[]; extras: string[]; act: Action; why: string; myth: string; clue: string; color: string; shape: Shape }
const S = (key: string[], extras: string[], act: Action, why: string, myth: string, clue: string, color: string, shape: Shape): Science => ({ key, extras, act, why, myth, clue, color, shape });
export const SCIENCE: Record<string, Science> = {
  Aero: S(['He'], [], 'stir', 'Helium is lighter than air, so it floats up, like a balloon.', 'Hermes, messenger of the gods, flew on winged sandals.', 'To fly, you need something lighter than air.', '#9fe3ff', 'star'),
  Vita: S(['Ca'], ['water'], 'heat', 'Calcium builds strong bones, and the body heals with it.', 'Asclepius, the Greek god of medicine, healed with a magic staff.', 'Healing starts with what makes bones strong.', '#e0457a', 'heart'),
  Dorm: S(['Mg'], ['water'], 'chill', 'Magnesium helps muscles relax.', 'Hypnos, god of sleep, calmed even the wildest beasts.', 'To calm down, find the mineral that relaxes muscles, then cool it.', '#8c5ad1', 'round'),
  Viv: S(['K'], ['sugar'], 'stir', 'Potassium (in bananas) and sugar give quick energy.', 'Eos, goddess of the dawn, woke the whole world each morning.', 'To wake up, find what bananas are full of.', '#f2c14e', 'tall'),
  Lumin: S(['Mg'], ['O'], 'heat', 'Magnesium burns in oxygen with a blinding white light.', 'Apollo drove the sun across the sky.', 'For light, find the metal that burns brightest.', '#fff6a8', 'star'),
  Cryo: S(['N'], ['water'], 'chill', 'Liquid nitrogen is minus 196 °C, cold enough to freeze anything.', 'Boreas, the north wind, blew winter over the land.', 'To freeze, use the coldest gas there is.', '#9fe3ff', 'diamond'),
  Aqua: S(['H', 'O'], [], 'zap', 'Hydrogen and oxygen with a spark really make water: H₂O.', 'Poseidon raised the oceans with his trident.', 'Water is made of two gases. A spark joins them.', '#3a6fd1', 'gourd'),
  Fort: S(['Fe'], ['C'], 'heat', 'Iron heated with a little carbon makes steel.', 'Hephaestus, the blacksmith god, forged armor in his volcano.', 'For strength, forge the heavy metal with carbon.', '#8f8aa8', 'diamond'),
  Velo: S(['Li'], [], 'zap', 'Lithium stores energy in batteries that power fast things.', 'Atalanta was the fastest runner in all of Greece.', 'For speed, use the metal inside batteries.', '#f2783a', 'tall'),
  Mega: S(['yeast'], ['sugar'], 'heat', 'Yeast eats sugar and makes gas, so warm dough grows big.', 'The Titans were the giant elder gods.', 'To grow big, use what makes bread rise.', '#c98b5a', 'gourd'),
  Veloaero: S(['He', 'Li'], [], 'zap', 'Floating helium plus battery power: lift and speed.', 'Pegasus, the winged horse, raced across the clouds.', 'Fly and go fast: mix the floating gas and the battery metal.', '#9fe3ff', 'star'),
  Megavita: S(['Ca'], ['water', 'O'], 'heat', 'Calcium for bones and oxygen for breathing: healing for everyone.', 'Panacea, goddess of cures, could heal every illness.', 'Heal everyone: bones, water and breath.', '#e0457a', 'heart'),
  Pyro: S(['C', 'O'], [], 'heat', 'Carbon burns in oxygen. That is fire.', 'Prometheus stole fire from the gods and gave it to people.', 'Fire needs fuel and air.', '#e0452f', 'round'),
  Thermo: S(['Fe'], ['O', 'salt'], 'stir', 'Iron rusting with salt and air gives off heat, like a hand warmer.', 'Hestia, goddess of the hearth, kept every home warm.', 'Warm, like a hand warmer: the metal that rusts.', '#f2783a', 'round'),
  Umbra: S(['Al'], ['water'], 'chill', 'Shiny aluminum reflects sunlight, so things stay cool.', 'Nyx, goddess of night, wrapped the world in cool shade.', 'For shade, use the shiny metal that bounces sunlight.', '#2fa89a', 'tall'),
  Hydro: S(['water'], ['salt'], 'stir', 'A pinch of salt helps the body hold on to water.', 'Tethys, mother of all rivers, never let the land go dry.', 'Never thirsty: water and a pinch of sea crystals.', '#3a6fd1', 'gourd'),
  Somnus: S(['Mg'], ['Ca'], 'chill', 'Hibernating animals slow down in the cold, and magnesium helps them rest.', 'Morpheus brought long, peaceful dreams.', 'Sleep all winter: the relaxing mineral, cooled.', '#8c5ad1', 'round'),
  Ancora: S(['Fe'], ['water'], 'stir', 'Iron is heavy and sinks. Ships drop iron anchors.', 'Atlas held up the whole sky without moving.', 'Stay put: the heavy metal anchors use.', '#8f8aa8', 'diamond'),
  Pneumo: S(['O'], [], 'stir', 'Oxygen is the part of air we breathe.', 'Aeolus, keeper of the winds, gave sailors fresh air.', 'Fresh air: the gas we breathe.', '#e8f6ee', 'gourd'),
  Sicco: S(['oil'], ['salt'], 'stir', 'Oil and water do not mix, so an oily coat sheds rain, like duck feathers.', 'Thetis dipped her son in a magic river to protect him.', 'Stay dry: what water slides right off.', '#f2c14e', 'diamond'),
  Stabil: S(['chalk'], ['Fe'], 'stir', 'Chalk is solid rock. Low, heavy, solid things do not tip.', 'Gaia, Mother Earth, held the ground steady.', 'Steady feet: rock dust and heavy metal.', '#c9b38a', 'round'),
  Patria: S(['Fe'], ['Cu'], 'zap', 'Animals find home using Earth\'s magnetism, which comes from its iron core.', 'Odysseus sailed ten years to find his way home.', 'Find home: the magnet metal, and a zap.', '#57d3b8', 'heart'),
  Nidus: S(['Ca'], ['C'], 'heat', 'Eggshells are made of calcium.', 'Hera, goddess of family, watched over every nest.', 'A cozy nest: what eggshells are made of, kept warm.', '#f6efe0', 'heart'),
  Herba: S(['I'], ['water'], 'stir', 'Iodine cleans cuts so they can heal.', 'Chiron, the wise centaur, healed with herbs.', 'Plant medicine: the violet cleaner and healing plants.', '#6cbf5a', 'heart'),
  Calma: S(['O'], ['water'], 'chill', 'Slow, deep breaths bring in oxygen and calm the body.', 'Eirene, goddess of peace, brought calm after storms.', 'Feel calm: deep breaths, cool and slow.', '#9fd34e', 'round'),
  Germina: S(['N', 'K'], [], 'stir', 'Plants need nitrogen and potassium to grow. That is what fertilizer is.', 'Demeter, goddess of the harvest, made the fields grow.', 'Make plants grow: what fertilizer is made of.', '#6cbf5a', 'gourd'),
  Antidota: S(['C'], ['water'], 'stir', 'Charcoal (carbon) soaks up poisons.', 'Hygieia, goddess of health, kept people safe from poison.', 'Soak up poison: black carbon.', '#2d2a3a', 'heart'),
  Redux: S(['C', 'H', 'O'], [], 'heat', 'Every living thing is built mostly from carbon, hydrogen and oxygen.', 'The phoenix is reborn from its own ashes.', 'Bring life back: the three things life is built from.', '#f2783a', 'star'),
};

// The magic part of each Cookbook potion: its special ingredients (free basics like dew and grass are skipped).
export function magicFor(r: Recipe): string[] {
  const items = [...new Set(r.steps.flatMap((s) => s.items ?? []))];
  const special = items.filter((id) => ING(id).tier !== 'free');
  return special.length ? special : items.slice(-1);
}
export const RECIPE_BY = new Map(RECIPES.map((r) => [r.name, r]));

export type Verdict =
  | { kind: 'potion'; name: string; strong: boolean; missing: string[]; why: string }
  | { kind: 'custom'; purpose: Purpose | null; near?: string }
  | { kind: 'fail'; how: 'smoke' | 'overflow'; why: string };

// Decide what the cauldron makes. goal = the recipe card picked (or null for your own potion).
export function brew(contents: string[], act: Action | null, goal: string | null, hasMagic: (name: string) => boolean): Verdict {
  const els = contents.filter((c) => ELEM.has(c));
  const magic = contents.filter((c) => !ELEM.has(c));
  if (contents.length > 7) return { kind: 'fail', how: 'overflow', why: 'Too much in one pot! It bubbled right over the top. Try fewer ingredients.' };
  if (!els.length) return { kind: 'fail', how: 'smoke', why: 'Puff of smoke! Every potion needs at least one real element from the shelf.' };
  // Real chemistry still happens: baking soda + vinegar foams up and over.
  if (els.includes('bakingsoda') && els.includes('vinegar')) return { kind: 'fail', how: 'overflow', why: 'Real science! Baking soda and vinegar make carbon dioxide gas, and the foam bubbled over the top.' };
  if (els.includes('Na') && els.includes('water')) return { kind: 'fail', how: 'overflow', why: 'Real science! Sodium reacts with water so fast that the pot bubbled over.' };
  const score = (name: string) => {
    const sc = SCIENCE[name]; if (!sc) return null;
    if (!sc.key.every((k) => els.includes(k))) return null;
    const missing = [...sc.extras.filter((x) => !els.includes(x)), ...(act === sc.act ? [] : [`the ${sc.act} action`]), ...(hasMagic(name) ? [] : ['its magic ingredient'])];
    return { name, missing, extra: els.filter((x) => !sc.key.includes(x) && !sc.extras.includes(x)).length };
  };
  if (goal) {
    const sc = SCIENCE[goal];
    const s = score(goal);
    if (!s) return { kind: 'fail', how: 'smoke', why: `Puff of smoke! ${sc.clue} The ${goal} potion needs ${sc.key.map((k) => ELEM.get(k)?.name).join(' and ')}.` };
    if (s.extra > 1) return { kind: 'fail', how: 'overflow', why: 'It bubbled over! There were too many things in the pot that this recipe does not use.' };
    return { kind: 'potion', name: goal, strong: s.missing.length === 0, missing: s.missing, why: sc.why };
  }
  // Your own potion: an exact Cookbook match is a discovery; otherwise it is a new potion of your own.
  const hits = Object.keys(SCIENCE).map(score).filter((x): x is NonNullable<ReturnType<typeof score>> => !!x && x.extra === 0);
  const exact = hits.find((h) => h.missing.length === 0);
  if (exact) return { kind: 'potion', name: exact.name, strong: true, missing: [], why: SCIENCE[exact.name].why };
  if (!magic.length) return { kind: 'fail', how: 'smoke', why: 'Puff of smoke! A potion is real science plus a spark of magic. Add a magic ingredient from the Magic shelf.' };
  const purposes = [...new Set(els.map((e) => ELEM.get(e)?.purpose).filter((p): p is Purpose => !!p))];
  return { kind: 'custom', purpose: purposes.length === 1 ? purposes[0] : null, near: hits[0]?.name };
}

// A student's own recipe card (her rule: a custom potion must get a purpose on its card).
export interface CustomPotion { id: string; name: string; purpose: Purpose; items: string[]; act: Action | null; sentence?: string; traced?: boolean; at: string }
export const customLook = (c: { purpose: Purpose }) => { const p = PURPOSE.get(c.purpose)!; return { shape: p.shape, color: SCIENCE[p.base]?.color ?? '#8c5ad1', base: p.base }; };
// Power-ups (her rule): 10 questions per level, 3 levels.
export const POWER_LEVELS = ['', 'Charged', 'Mighty', 'Legendary'];
export const sameBrew = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
