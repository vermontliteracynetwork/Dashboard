// Every element in the Science Lab (Build Queue 201, her words 2026-10-15: "Add jars and pictures for each element
// ... Unlock and add images for all elements on the periodic table. Ensure all are playable and react according to
// real world reactions"), checked for accuracy (Build Queue 203: "claudia must reveiw, research, audit, and ensure
// actual scientific accuracy for science lab components").
//
// For each of the 118 elements: what it looks like at room temperature, how a real lab stores it (the jar art),
// whether it is radioactive, and the reactions it really has, written as rules (with water, with an acid, swapping
// with copper or silver, joining a halogen, burning in oxygen) that build ordinary lab recipes. Sources for the rules:
// the reactivity (activity) series of metals, group trends for the alkali and alkaline earth metals and the
// halogens, and standard flame test and gas discharge colors. Pure data and rules; no React.

import { PERIODIC, ELEMENT_USES, elementBySym, type ElementFamily } from './elements';
import type { LabState, Recipe, Substance } from './lab';

export type Storage = 'jar' | 'oil' | 'ampoule' | 'gas' | 'lead' | 'atoms';

// Gases and liquids at room temperature (everything else is a solid; for the heaviest elements nobody knows).
const GASES = new Set(['H', 'He', 'N', 'O', 'F', 'Ne', 'Cl', 'Ar', 'Kr', 'Xe', 'Rn']);
const LIQUIDS = new Set(['Br', 'Hg']);
// Radioactive: technetium, promethium, and polonium onward (bismuth decays so slowly it counts as stable).
export const isRadioactive = (sym: string) => { const n = elementBySym.get(sym)?.n ?? 0; return n === 43 || n === 61 || n >= 84; };
// Only a few atoms have ever been made or seen (astatine, francium, and fermium onward).
export const isFewAtoms = (sym: string) => { const n = elementBySym.get(sym)?.n ?? 0; return n === 85 || n === 87 || n >= 100; };
const DIATOMIC: Record<string, string> = { H: 'H₂', N: 'N₂', O: 'O₂', F: 'F₂', Cl: 'Cl₂', Br: 'Br₂', I: 'I₂' };

const COLOR: Record<string, string> = {
  H: '#e3f2fd', He: '#fce4ec', N: '#e8eaf6', O: '#e1f5fe', F: '#f2eea0', Ne: '#ffe3d9', Cl: '#d8f5a2', Ar: '#ede7f6', Kr: '#eeeeee', Xe: '#e3e8ff', Rn: '#f0f0f0',
  Br: '#8b2a0f', Hg: '#d9dde3', C: '#2f2f2f', S: '#ffe14d', P: '#b5442c', Se: '#6e6e6e', I: '#3b2a4a', B: '#4a3b30', Si: '#7d8796', As: '#8a8f96',
  Te: '#9aa0a6', Sb: '#b8bcc2', Ge: '#a7adb5', Cu: '#c8662f', Au: '#e2b53b', Cs: '#e8cf7a', Bi: '#d9c6e8', Os: '#9fb3c8', Fe: '#8d8d8d', Pb: '#7f8790',
  Zn: '#b9c3cc', Ni: '#c2c0b5', Co: '#a4acb8', Mn: '#a8a39d', Ti: '#a3a9b0', W: '#9da3a8', Mg: '#cfd8dc', Ca: '#e7e9ec', Al: '#cfd8dc',
};
// How a real school or research lab keeps it.
function storageOf(sym: string, family: ElementFamily): Storage {
  if (isFewAtoms(sym)) return 'atoms';
  if (isRadioactive(sym)) return 'lead';
  if (GASES.has(sym)) return 'gas';
  if (sym === 'Rb' || sym === 'Cs' || sym === 'Br') return 'ampoule'; // sealed glass, under argon (Rb, Cs) or on its own (Br)
  if (family === 'alkali' || sym === 'Sr' || sym === 'Ba' || sym === 'Eu') return 'oil'; // kept under oil so air and water cannot reach it
  return 'jar';
}

const FAMILY_FACT: Record<ElementFamily, string> = {
  alkali: 'An alkali metal: soft, shiny and so reactive with water that it is stored under oil.',
  alkaline: 'An alkaline earth metal: a shiny metal that reacts with water, though less wildly than the alkali metals.',
  transition: 'A transition metal: usually hard, shiny and good at carrying heat and electricity.',
  post: 'A metal: shiny and able to carry electricity, but softer than most transition metals.',
  metalloid: 'A metalloid: part metal, part nonmetal. Many are used to make computer chips.',
  nonmetal: 'A nonmetal: it does not shine or carry electricity the way metals do.',
  halogen: 'A halogen: a very reactive nonmetal that joins metals to make salts.',
  noble: 'A noble gas: it almost never reacts with anything.',
  lanthanide: 'A lanthanide (rare earth metal): used in magnets, screens and lasers.',
  actinide: 'An actinide: a heavy, radioactive metal.',
};

export interface ElementLab { sym: string; storage: Storage; radioactive: boolean; fewAtoms: boolean }
export const ELEMENT_LAB = new Map<string, ElementLab>(PERIODIC.map((e) => [e.sym, { sym: e.sym, storage: storageOf(e.sym, e.family), radioactive: isRadioactive(e.sym), fewAtoms: isFewAtoms(e.sym) }]));

// A shelf bottle for every element that the lab did not already have one for.
export function elementSubstances(existing: Set<string>): Substance[] {
  return PERIODIC.filter((e) => !existing.has(e.sym)).map((e) => {
    const state: LabState = GASES.has(e.sym) ? 'gas' : LIQUIDS.has(e.sym) ? 'liquid' : 'solid';
    const use = ELEMENT_USES[e.sym];
    const fact = isFewAtoms(e.sym)
      ? `Only a few atoms of ${e.name.toLowerCase()} have ever been made or seen. They break apart very quickly.`
      : isRadioactive(e.sym) ? `${e.name} is radioactive: its atoms slowly break apart and give off radiation. ${use ?? ''}`.trim()
      : `${FAMILY_FACT[e.family]}${use ? ` Used for: ${use}` : ''}`;
    return { id: e.sym, name: e.name, formula: DIATOMIC[e.sym] ?? e.sym, color: COLOR[e.sym] ?? '#c9ced6', state, element: e.sym, fact };
  });
}

// ---- flame test and glow tubes (the burner and a spark of electricity) ----------------------------------------
// Flame colors of metal atoms (standard flame test colors).
export const FLAME: Record<string, { color: string; name: string }> = {
  Li: { color: '#e3001b', name: 'crimson red' }, Na: { color: '#ffa600', name: 'bright yellow-orange' }, K: { color: '#c79cff', name: 'lilac' },
  Rb: { color: '#d0287a', name: 'red-violet' }, Cs: { color: '#7a6bff', name: 'blue-violet' }, Ca: { color: '#ff5a1f', name: 'orange-red' },
  Sr: { color: '#ff1430', name: 'red' }, Ba: { color: '#8ee05a', name: 'pale apple green' }, Cu: { color: '#1fc7a6', name: 'blue-green' },
  B: { color: '#33d46a', name: 'bright green' }, In: { color: '#4f46e5', name: 'indigo blue' }, Tl: { color: '#5eea5e', name: 'bright green' },
  Pb: { color: '#a9bfe6', name: 'pale blue-white' }, Zn: { color: '#9ad7c2', name: 'pale blue-green' }, Se: { color: '#4a8bff', name: 'azure blue' },
  As: { color: '#8fb3ff', name: 'pale blue' }, Sb: { color: '#b0e09b', name: 'pale green' }, Mo: { color: '#c4e05a', name: 'yellow-green' },
  Mn: { color: '#c9e06b', name: 'yellow-green' }, Fe: { color: '#ffb44a', name: 'gold, with sparks' },
};
// The metal a lab substance carries into the flame (table salt and baking soda are sodium compounds, chalk is calcium...).
export const METAL_IN: Record<string, string> = {
  salt: 'Na', bakingsoda: 'Na', lye: 'Na', saltwater: 'Na', saltcrystals: 'Na', chalk: 'Ca', limewater: 'Ca',
  coppersulfate: 'Cu', bluewater: 'Cu', bluecrystals: 'Cu', copper: 'Cu', lithwater: 'Li', mgo: 'Mg', silvernitrate: 'Ag',
};
// Colors of gases glowing in a sealed tube with electricity (like neon signs).
export const GLOW: Record<string, { color: string; name: string }> = {
  H: { color: '#ff4fa3', name: 'pink-purple' }, He: { color: '#ffb08a', name: 'peach orange' }, N: { color: '#e07bff', name: 'pink-violet' },
  O: { color: '#d8c4ff', name: 'pale violet' }, Ne: { color: '#ff4a1c', name: 'red-orange' }, Ar: { color: '#b56cff', name: 'lavender purple' },
  Kr: { color: '#e8e4ff', name: 'white with a lilac tint' }, Xe: { color: '#7aa8ff', name: 'blue' },
};

// ---- reactions as rules ---------------------------------------------------------------------------------------
// Ingredient tokens a rule recipe can use: @wet is water or anything watery (vinegar, lemon juice, salt water...),
// @acid is an acid, @chloride is salt, salt water or hydrochloric acid.
export const WET = ['water', 'vinegar', 'lemon', 'saltwater', 'sugarwater', 'bluewater', 'hcl', 'fizzwater', 'limewater', 'lye', 'pinkjuice', 'greenjuice', 'cabbage', 'peroxide', 'silvernitrate', 'chlorinewater', 'iodinewater'];
export const ACIDS = ['hcl', 'vinegar', 'lemon'];
export const CHLORIDES = ['salt', 'saltwater', 'hcl'];
export const TOKENS: Record<string, string[]> = { '@wet': WET, '@acid': ACIDS, '@chloride': CHLORIDES };
export const TOKEN_LABEL: Record<string, string> = { '@wet': 'water (or anything watery)', '@acid': 'an acid', '@chloride': 'salt or salt water' };

const name = (s: string) => elementBySym.get(s)?.name ?? s;
type Group = 'water' | 'acid' | 'swap' | 'salt' | 'burn' | 'heat';
export type RuleRecipe = Recipe & { group: Group; safety?: string };
const R = (r: Omit<RuleRecipe, 'magic' | 'unlocks'> & { magic?: Recipe['magic'] }): RuleRecipe => ({ unlocks: [], magic: r.magic ?? { name: r.name, line: r.fact }, ...r });

const ALKALI_SAFE = 'Only done by scientists, with a tiny piece, safety glasses and a screen. Never at home.';
const WATER: RuleRecipe[] = [
  R({ id: 'w-Rb', group: 'water', needs: ['Rb', '@wet'], makes: [], effect: 'bigboom', color: '#d0287a', name: 'Rubidium meets water: KA-BOOM!', equation: '2Rb + 2H₂O → 2RbOH + H₂', fact: 'Rubidium is lower in the alkali metal family than potassium, so it reacts even faster. The hydrogen bursts into flame.', safety: ALKALI_SAFE }),
  R({ id: 'w-Cs', group: 'water', needs: ['Cs', '@wet'], makes: [], effect: 'bigboom', color: '#7a6bff', name: 'Cesium meets water: the biggest BOOM', equation: '2Cs + 2H₂O → 2CsOH + H₂', fact: 'Cesium is the most reactive metal you can hold. It explodes in water instantly, even in ice-cold water.', safety: ALKALI_SAFE }),
  R({ id: 'w-Sr', group: 'water', needs: ['Sr', '@wet'], makes: ['limewater'], effect: 'fizz', color: '#f4f7ff', name: 'Strontium fizzes', equation: 'Sr + 2H₂O → Sr(OH)₂ + H₂', fact: 'Strontium reacts with water faster than calcium. The bubbles are hydrogen, and the water becomes a base.' }),
  R({ id: 'w-Ba', group: 'water', needs: ['Ba', '@wet'], makes: ['limewater'], effect: 'fizz', color: '#f0fff0', name: 'Barium fizzes fast', equation: 'Ba + 2H₂O → Ba(OH)₂ + H₂', fact: 'Barium is lower in its family than strontium, so it fizzes the fastest of the three.', safety: 'Barium compounds that dissolve are poisonous. Scientists wear gloves.' }),
  R({ id: 'w-Eu', group: 'water', needs: ['Eu', '@wet'], makes: [], effect: 'fizz', color: '#f2f2ff', name: 'Europium fizzes', equation: 'Eu + 2H₂O → Eu(OH)₂ + H₂', fact: 'Europium is the most reactive rare earth metal. It fizzes in water much like calcium.' }),
  R({ id: 'w-F', group: 'water', needs: ['F', '@wet'], makes: [], effect: 'flash', color: '#f2eea0', name: 'Fluorine attacks water', equation: '2F₂ + 2H₂O → 4HF + O₂', fact: 'Fluorine is the most reactive element of all. It even pulls water apart and sets free oxygen.', safety: 'Fluorine gas is extremely dangerous. Only specialist labs use it.' }),
  R({ id: 'w-Cl', group: 'water', needs: ['Cl', 'water'], makes: ['chlorinewater'], effect: 'dissolve', color: '#eef8c8', name: 'Chlorine water', equation: 'Cl₂ + H₂O → HCl + HOCl', fact: 'Chlorine dissolves in water and makes a weak acid that kills germs. Swimming pools use chlorine compounds for the same job.', safety: 'Chlorine gas is poisonous to breathe. Real labs use a fume cupboard.' }),
  R({ id: 'w-Br', group: 'water', needs: ['Br', 'water'], makes: [], effect: 'color', color: '#ff9a3c', name: 'Bromine water', equation: 'Br₂ in H₂O → orange bromine water', fact: 'A little bromine dissolves in water and turns it orange. Chemists use bromine water to test for certain oils and fats.', safety: 'Bromine burns skin and its fumes are poisonous. Scientists use gloves and a fume cupboard.' }),
  R({ id: 'w-I', group: 'water', needs: ['I', 'water'], makes: ['iodinewater'], effect: 'dissolve', color: '#e8c27a', name: 'Iodine water', equation: 'I₂ in H₂O → pale brown iodine water', fact: 'Only a tiny bit of iodine dissolves in water, but enough to turn it pale brown. It can find starch.' }),
];
// The slow-reacting rare earth metals (all but promethium, which is radioactive, and europium, above).
const RARE = ['La', 'Ce', 'Pr', 'Nd', 'Sm', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Y'];
for (const s of RARE) WATER.push(R({ id: `w-${s}`, group: 'water', needs: [s, 'water'], makes: [], effect: 'fizz', color: '#f2f6ff', name: `${name(s)} bubbles slowly`, equation: `2${s} + 6H₂O → 2${s}(OH)₃ + 3H₂`, fact: `${name(s)} reacts slowly with cold water and gives off hydrogen bubbles. Hot water makes it go faster.` }));

// Metals that push hydrogen out of acids (above hydrogen in the reactivity series). Fast ones first.
const ACID_METALS: [string, 'fast' | 'steady' | 'slow', string][] = [
  ['Be', 'slow', 'BeCl₂'], ['Al', 'steady', 'AlCl₃'], ['Mn', 'steady', 'MnCl₂'], ['Zn', 'steady', 'ZnCl₂'], ['Cr', 'slow', 'CrCl₂'], ['Fe', 'slow', 'FeCl₂'],
  ['Cd', 'slow', 'CdCl₂'], ['Co', 'slow', 'CoCl₂'], ['Ni', 'slow', 'NiCl₂'], ['Sn', 'slow', 'SnCl₂'], ['Ga', 'slow', 'GaCl₃'], ['In', 'slow', 'InCl₃'], ['Tl', 'slow', 'TlCl'],
  ...[...RARE, 'Eu'].map((s) => [s, 'fast', `${s}Cl₃`] as [string, 'fast', string]),
];
const ACID: RuleRecipe[] = ACID_METALS.map(([s, speed, salt]) => R({
  id: `a-${s}`, group: 'acid', needs: [s, '@acid'], makes: ['fizzwater'], effect: 'fizz', color: s === 'Ni' ? '#bfeccb' : s === 'Co' ? '#f7c6d9' : s === 'Cr' ? '#c8d8ff' : s === 'Fe' ? '#e4f2c8' : '#f4f1d0',
  name: `${name(s)} fizzes in acid`, equation: `${s} + HCl → ${salt} + H₂`,
  fact: `${name(s)} is above hydrogen in the reactivity series, so an acid eats it away and gives off hydrogen bubbles${speed === 'slow' ? ', slowly' : speed === 'fast' ? ', quickly' : ''}.${s === 'Al' ? ' Aluminum waits a moment first, because a thin coat of oxide protects it.' : ''}${s === 'Ni' ? ' The liquid turns pale green.' : ''}${s === 'Co' ? ' The liquid turns pink.' : ''}`,
  safety: s === 'Cd' || s === 'Tl' || s === 'Be' ? `${name(s)} is very poisonous. Scientists wear gloves and work in a fume cupboard.` : undefined,
}));

// Metals more reactive than copper push it out of blue copper sulfate water; more reactive than silver push out silver.
const CU_SWAP: [string, string][] = [['Mg', 'MgSO₄'], ['Zn', 'ZnSO₄'], ['Mn', 'MnSO₄'], ['Cr', 'CrSO₄'], ['Ni', 'NiSO₄'], ['Sn', 'SnSO₄'], ['Pb', 'PbSO₄'], ['Co', 'CoSO₄'], ['Cd', 'CdSO₄']];
const SWAP: RuleRecipe[] = [
  ...CU_SWAP.map(([s, salt]) => R({ id: `cu-${s}`, group: 'swap', needs: ['bluewater', s], makes: ['copper'], effect: 'color', color: s === 'Mg' || s === 'Zn' ? '#e8f4ff' : '#9fd1c0',
    name: `${name(s)} swaps with copper`, equation: `${s} + CuSO₄ → ${salt} + Cu`, fact: `${name(s)} is more reactive than copper, so it pushes the copper out of the blue water. Orange copper coats the metal and the blue fades.` })),
  ...['Cu', 'Zn', 'Fe', 'Mg', 'Sn', 'Pb', 'Ni'].map((s) => R({ id: `ag-${s}`, group: 'swap', needs: ['silvernitrate', s], makes: ['Ag'], effect: 'glow', color: s === 'Cu' ? '#5aa8f0' : '#eef2f6',
    name: s === 'Cu' ? 'A silver tree grows on copper' : `${name(s)} swaps with silver`, equation: s === 'Cu' ? 'Cu + 2AgNO₃ → Cu(NO₃)₂ + 2Ag' : `${s} + AgNO₃ → silver crystals + ${s} nitrate`,
    fact: s === 'Cu' ? 'Copper is more reactive than silver, so shiny silver crystals grow on the copper like a tiny tree, and the liquid slowly turns blue.' : `${name(s)} is more reactive than silver, so silver crystals form on the metal.`,
    safety: 'Silver nitrate stains skin black. Scientists wear gloves.' })),
];

// Metals joining halogens to make salts.
const HALIDE: Record<string, string> = { F: 'fluoride', Cl: 'chloride', Br: 'bromide', I: 'iodide' };
const SALT: RuleRecipe[] = [];
const HALOGEN_HEAT: RuleRecipe[] = [];
for (const m of ['Li', 'Na', 'K', 'Rb', 'Cs']) for (const x of ['F', 'Cl', 'Br', 'I']) {
  if (m === 'Na' && x === 'Cl') continue; // already the lab's "Making table salt"
  const product = `${name(m)} ${HALIDE[x]}`, formula = `${m}${x}`;
  const eq = `2${m} + ${x}₂ → 2${formula}`;
  const base = { needs: [m, x], makes: [] as string[], color: '#fffbe8', name: `Making ${product.toLowerCase()}`, equation: eq, safety: x === 'F' || x === 'Cl' || x === 'Br' ? `${name(x)} is poisonous and ${name(m).toLowerCase()} is very reactive. Only scientists do this, behind a screen.` : undefined };
  // Fluorine and chlorine react straight away; bromine does too with the most reactive metals; iodine needs heat.
  if (x === 'F' || x === 'Cl' || (x === 'Br' && (m === 'K' || m === 'Rb' || m === 'Cs'))) {
    SALT.push(R({ id: `s-${m}${x}`, group: 'salt', ...base, effect: x === 'Br' ? 'boom' : 'flash', fact: `${name(m)} gives up one electron and ${name(x).toLowerCase()} takes it, with a bright flash. The new white solid is a salt, ${product.toLowerCase()}.` }));
  } else {
    HALOGEN_HEAT.push(R({ id: `s-${m}${x}`, group: 'salt', ...base, needs: [m, x, 'heat'], effect: 'glow', fact: `With heat, ${name(m).toLowerCase()} and ${name(x).toLowerCase()} glow and join into a salt, ${product.toLowerCase()}.` }));
  }
}
SALT.push(
  R({ id: 's-AlBr', group: 'salt', needs: ['Al', 'Br'], makes: [], effect: 'flash', color: '#ffcf80', name: 'Aluminum and bromine: sparks!', equation: '2Al + 3Br₂ → 2AlBr₃', fact: 'Aluminum reacts with liquid bromine all by itself, with sparks and flashes, and makes aluminum bromide.', safety: 'Bromine fumes are poisonous. A fume cupboard and a screen are a must.' }),
  R({ id: 's-AlI', group: 'salt', needs: ['Al', 'I', 'water'], makes: [], effect: 'smoke', color: '#8a3fd1', name: 'Aluminum and iodine: purple smoke', equation: '2Al + 3I₂ → 2AlI₃ (a drop of water starts it)', fact: 'Aluminum and iodine sit still until a drop of water starts them. Then the heat turns some iodine into purple smoke.', safety: 'Iodine smoke stings the eyes and lungs. Done only in a fume cupboard.' }),
  R({ id: 's-ZnI', group: 'salt', needs: ['Zn', 'I', 'water'], makes: [], effect: 'color', color: '#f4f4f4', name: 'Zinc and iodine', equation: 'Zn + I₂ → ZnI₂', fact: 'In water, zinc and brown iodine join into zinc iodide. The brown color fades away as the iodine is used up, and the beaker gets warm.' }),
  R({ id: 's-HF', group: 'salt', needs: ['H', 'F'], makes: [], effect: 'boom', color: '#f2eea0', name: 'Hydrogen and fluorine: BOOM!', equation: 'H₂ + F₂ → 2HF', fact: 'Hydrogen and fluorine explode as soon as they meet, even in the dark and the cold.', safety: 'Only specialist labs handle fluorine.' }),
  R({ id: 's-HgS', group: 'salt', needs: ['Hg', 'S'], makes: [], effect: 'color', color: '#2b2b2b', name: 'Mercury and sulfur', equation: 'Hg + S → HgS', fact: 'Sulfur joins liquid mercury even without heat and makes a black solid. That is why sulfur powder is sprinkled on spilled mercury.', safety: 'Mercury vapor is poisonous. Never touch mercury.' }),
);

// Burning in oxygen needs a flame or a spark to start: these use the burner (heat).
const BURN: RuleRecipe[] = [
  R({ id: 'b-S', group: 'burn', needs: ['S', 'O', 'heat'], makes: [], effect: 'smoke', color: '#5a7bff', name: 'Burning sulfur: a blue flame', equation: 'S + O₂ → SO₂', fact: 'Sulfur burns with a pale blue flame and makes sulfur dioxide, a gas with a sharp, choking smell.', safety: 'Sulfur dioxide hurts lungs. Real labs burn sulfur in a fume cupboard.' }),
  R({ id: 'b-P', group: 'burn', needs: ['P', 'O', 'heat'], makes: [], effect: 'smoke', color: '#ffffff', name: 'Burning phosphorus: white smoke', equation: '4P + 5O₂ → P₄O₁₀', fact: 'Red phosphorus burns with a bright flame and thick white smoke. Match boxes use it on the striking strip.', safety: 'Phosphorus burns are serious. Only scientists burn it.' }),
  R({ id: 'b-Fe', group: 'burn', needs: ['Fe', 'O', 'heat'], makes: [], effect: 'glow', color: '#ffb44a', name: 'Burning iron: sparks', equation: '3Fe + 2O₂ → Fe₃O₄', fact: 'A lump of iron will not burn, but thin steel wool does, with orange sparks like a sparkler.' }),
  R({ id: 'b-Al', group: 'burn', needs: ['Al', 'O', 'heat'], makes: [], effect: 'flash', color: '#ffffff', name: 'Burning aluminum powder', equation: '4Al + 3O₂ → 2Al₂O₃', fact: 'Fine aluminum powder burns with a dazzling white flash. Fireworks and rocket fuel use it.' }),
  R({ id: 'b-Zn', group: 'burn', needs: ['Zn', 'O', 'heat'], makes: [], effect: 'smoke', color: '#bfeee0', name: 'Burning zinc', equation: '2Zn + O₂ → 2ZnO', fact: 'Zinc burns with a blue-green flame and makes zinc oxide, which is yellow while hot and white when cool.' }),
  R({ id: 'b-Cu', group: 'burn', needs: ['Cu', 'O', 'heat'], makes: [], effect: 'color', color: '#2a2a2a', name: 'Heating copper', equation: '2Cu + O₂ → 2CuO', fact: 'Copper does not catch fire. Heated in air, it slowly grows a black coat of copper oxide.' }),
  R({ id: 'b-Li', group: 'burn', needs: ['Li', 'O', 'heat'], makes: [], effect: 'flash', color: '#e3001b', name: 'Burning lithium: a red flame', equation: '4Li + O₂ → 2Li₂O', fact: 'Lithium burns with a crimson red flame.', safety: ALKALI_SAFE }),
  R({ id: 'b-Na', group: 'burn', needs: ['Na', 'O', 'heat'], makes: [], effect: 'flash', color: '#ffa600', name: 'Burning sodium: a yellow flame', equation: '2Na + O₂ → Na₂O₂', fact: 'Sodium burns with a bright yellow-orange flame, the same color as old street lights.', safety: ALKALI_SAFE }),
  R({ id: 'b-K', group: 'burn', needs: ['K', 'O', 'heat'], makes: [], effect: 'flash', color: '#c79cff', name: 'Burning potassium: a lilac flame', equation: 'K + O₂ → KO₂', fact: 'Potassium burns with a lilac flame and makes potassium superoxide.', safety: ALKALI_SAFE }),
  R({ id: 'b-Ca', group: 'burn', needs: ['Ca', 'O', 'heat'], makes: [], effect: 'flash', color: '#ff5a1f', name: 'Burning calcium: an orange-red flame', equation: '2Ca + O₂ → 2CaO', fact: 'Calcium burns with an orange-red flame and leaves white calcium oxide, also called quicklime.' }),
  R({ id: 'b-Sr', group: 'burn', needs: ['Sr', 'O', 'heat'], makes: [], effect: 'flash', color: '#ff1430', name: 'Burning strontium: a red flame', equation: '2Sr + O₂ → 2SrO', fact: 'Strontium burns bright red. That is where red fireworks get their color.' }),
  R({ id: 'b-Ba', group: 'burn', needs: ['Ba', 'O', 'heat'], makes: [], effect: 'flash', color: '#8ee05a', name: 'Burning barium: a green flame', equation: '2Ba + O₂ → 2BaO', fact: 'Barium burns with a green flame. Green fireworks use barium.' }),
  R({ id: 'b-Ti', group: 'burn', needs: ['Ti', 'O', 'heat'], makes: [], effect: 'glow', color: '#ffffff', name: 'Burning titanium: white sparks', equation: 'Ti + O₂ → TiO₂', fact: 'Titanium powder burns with brilliant white sparks. Titanium dioxide is the white in paint and toothpaste.' }),
  R({ id: 'b-Ce', group: 'burn', needs: ['Ce', 'O', 'heat'], makes: [], effect: 'glow', color: '#ffd27a', name: 'Cerium sparks', equation: 'Ce + O₂ → CeO₂', fact: 'Scraped cerium throws hot sparks. The flint in a lighter is mostly cerium and iron.' }),
  R({ id: 'b-Be', group: 'burn', needs: ['Be', 'O', 'heat'], makes: [], effect: 'flash', color: '#ffffff', name: 'Burning beryllium powder', equation: '2Be + O₂ → 2BeO', fact: 'Beryllium powder burns with a bright white light.', safety: 'Beryllium dust is very poisonous to breathe. Only specialist labs work with it.' }),
];
// Other things the burner does to elements.
const HEAT_MORE: RuleRecipe[] = [
  ...HALOGEN_HEAT,
  R({ id: 'h-Ga', group: 'heat', needs: ['Ga', 'heat'], makes: [], effect: 'dissolve', color: '#d9dde3', name: 'Gallium melts', equation: 'Ga (solid) + a little heat → Ga (liquid)', fact: 'Gallium melts at about 30 °C, just above room temperature. It would melt in your hand.' }),
  R({ id: 'h-Mg', group: 'heat', needs: ['Mg', 'water', 'heat'], makes: ['limewater'], effect: 'fizz', color: '#f4f7ff', name: 'Magnesium in hot water', equation: 'Mg + 2H₂O → Mg(OH)₂ + H₂', fact: 'In cold water magnesium barely reacts. Heat it, and hydrogen bubbles appear.' }),
  R({ id: 'h-ZnS', group: 'heat', needs: ['Zn', 'S', 'heat'], makes: [], effect: 'flash', color: '#fff7c2', name: 'Zinc and sulfur: a flash', equation: 'Zn + S → ZnS', fact: 'Heated zinc and sulfur powder join in a sudden flash and a puff of smoke, making zinc sulfide.', safety: 'Very fast and hot. Only done by scientists, in a fume cupboard.' }),
  R({ id: 'h-CuS', group: 'heat', needs: ['Cu', 'S', 'heat'], makes: [], effect: 'glow', color: '#2b2b2b', name: 'Copper and sulfur', equation: '2Cu + S → Cu₂S', fact: 'Heated copper and sulfur glow and join into black copper sulfide.' }),
  R({ id: 'h-FeCl', group: 'heat', needs: ['Fe', 'Cl', 'heat'], makes: [], effect: 'glow', color: '#8a4b1c', name: 'Hot iron in chlorine', equation: '2Fe + 3Cl₂ → 2FeCl₃', fact: 'Hot iron wool burns in chlorine gas and makes brown iron chloride smoke.', safety: 'Chlorine is poisonous. Fume cupboard only.' }),
  R({ id: 'h-HBr', group: 'heat', needs: ['H', 'Br', 'heat'], makes: [], effect: 'pop', color: '#ffd0b0', name: 'Hydrogen and bromine', equation: 'H₂ + Br₂ → 2HBr', fact: 'With heat, hydrogen and bromine join into hydrogen bromide, a gas that makes a strong acid in water.' }),
];

export const RULE_RECIPES: RuleRecipe[] = [...ACID, ...WATER, ...SWAP, ...SALT];
export const RULE_HEAT_RECIPES: RuleRecipe[] = [...BURN, ...HEAT_MORE];

// Why nothing happened, for the elements where "nothing" is the real lesson.
const NO_ACID = new Set(['Cu', 'Ag', 'Au', 'Pt', 'Pd', 'Hg', 'Rh', 'Ir', 'Os', 'Ru', 'Bi', 'Sb']);
const OXIDE_SKIN = new Set(['Ti', 'Zr', 'Hf', 'Nb', 'Ta', 'W', 'Mo', 'V', 'Re']);
export function whyNothing(contents: string[]): string | null {
  const has = (ids: string[]) => contents.some((c) => ids.includes(c));
  const metal = contents.find((c) => NO_ACID.has(c) || OXIDE_SKIN.has(c));
  // Colors and dyes (Build Queue 212).
  if (contents.includes('turmeric') && has(ACIDS)) return 'Turmeric stays yellow in acids. It only turns red in a base, like baking soda or soap.';
  if (contents.includes('phenol') && contents.includes('bakingsoda')) return 'Baking soda is too weak a base to turn phenolphthalein pink. Try a strong base: calcium or lithium dropped in water.';
  if (contents.includes('phenol') && has(ACIDS)) return 'Phenolphthalein stays clear in acids. It turns pink only in a strong base.';
  if (contents.includes('cabbage') && contents.some((c) => ['reddye', 'bluedye', 'yellowdye'].includes(c))) return 'Food coloring is not an indicator, so the colors just mix. Try red cabbage juice with an acid or a base.';
  if (metal && has(ACIDS)) return NO_ACID.has(metal)
    ? `${name(metal)} is below hydrogen in the reactivity series, so a weak acid cannot push hydrogen out of it. No bubbles.`
    : `${name(metal)} has a thin, tough coat of oxide on it, so the acid cannot get to the metal. No bubbles.`;
  if (contents.includes('Mg') && contents.includes('water')) return 'Magnesium reacts with cold water so slowly that you cannot see it. Try the burner.';
  if (contents.includes('Be') && has(['water'])) return 'Beryllium does not react with water, even though it is in the same family as calcium.';
  if (contents.includes('Au')) return 'Gold almost never reacts with anything. That is why gold treasure still shines after thousands of years.';
  if (contents.includes('Pt')) return 'Platinum hardly reacts with anything, which is why it is used in jewelry and car exhaust cleaners.';
  if (contents.includes('Xe') && contents.includes('F')) return 'Xenon is one of the few noble gases that can join fluorine, but only in a special lab with heat and pressure.';
  if (contents.includes('N') && contents.includes('O')) return 'Nitrogen and oxygen only join in the heat of lightning or an engine. That is why the air does not burn.';
  return null;
}
