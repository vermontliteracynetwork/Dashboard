// Science Lab (teacher 2026-10-09: "lets build a science lab. science lab should be an app in the
// computer not a native game"). A 2D sandbox lab: pour bottles into glass beakers and mix them.
// Things fizz, change color, go cloudy, foam or explode with animations, but only when the real
// chemistry would. Discoveries go in the Science Journal with their recipe, and each one unlocks
// new bottles, so elements are learned over time. Pure data and rules: no React, no DOM.

export type LabState = 'liquid' | 'powder' | 'solid' | 'gas';
export interface Substance { id: string; name: string; formula: string; color: string; state: LabState; element?: string; fact: string }

export const SUBSTANCES: Substance[] = [
  // Starter shelf: kitchen things and five elements.
  { id: 'water', name: 'Water', formula: 'H₂O', color: '#9fd8ff', state: 'liquid', fact: 'Water is made of two hydrogen atoms and one oxygen atom.' },
  { id: 'vinegar', name: 'Vinegar', formula: 'CH₃COOH', color: '#f4f1d0', state: 'liquid', fact: 'Vinegar is an acid. Acids taste sour.' },
  { id: 'bakingsoda', name: 'Baking soda', formula: 'NaHCO₃', color: '#ffffff', state: 'powder', fact: 'Baking soda is a base. Bases react with acids.' },
  { id: 'salt', name: 'Table salt', formula: 'NaCl', color: '#f2f2f2', state: 'powder', fact: 'Table salt is sodium and chlorine joined together.' },
  { id: 'sugar', name: 'Sugar', formula: 'C₁₂H₂₂O₁₁', color: '#fffdf5', state: 'powder', fact: 'Sugar is made of carbon, hydrogen and oxygen.' },
  { id: 'oil', name: 'Cooking oil', formula: 'oil', color: '#ffd54a', state: 'liquid', fact: 'Oil is lighter than water, so it floats on top.' },
  { id: 'lemon', name: 'Lemon juice', formula: 'citric acid', color: '#fff27a', state: 'liquid', fact: 'Lemon juice is an acid called citric acid.' },
  { id: 'H', name: 'Hydrogen', formula: 'H₂', color: '#e3f2fd', state: 'gas', element: 'H', fact: 'Hydrogen is the lightest element and the most common one in the universe.' },
  { id: 'O', name: 'Oxygen', formula: 'O₂', color: '#e1f5fe', state: 'gas', element: 'O', fact: 'Oxygen is the gas we breathe. Fire needs it to burn.' },
  { id: 'C', name: 'Carbon', formula: 'C', color: '#3a3a3a', state: 'powder', element: 'C', fact: 'Carbon is in every living thing. Diamonds and pencil lead are both carbon.' },
  { id: 'Na', name: 'Sodium', formula: 'Na', color: '#d7dde3', state: 'solid', element: 'Na', fact: 'Sodium is a soft metal you can cut with a butter knife. It reacts with water.' },
  { id: 'Cl', name: 'Chlorine', formula: 'Cl₂', color: '#d8f5a2', state: 'gas', element: 'Cl', fact: 'Chlorine is a yellow-green gas. Tiny amounts keep pool water clean.' },
  // Unlocked by discoveries.
  { id: 'cabbage', name: 'Red cabbage juice', formula: 'indicator', color: '#7b4fb3', state: 'liquid', fact: 'Red cabbage juice changes color in acids and bases. It is an indicator.' },
  { id: 'chalk', name: 'Chalk', formula: 'CaCO₃', color: '#fafafa', state: 'powder', fact: 'Chalk and seashells are made of calcium carbonate.' },
  { id: 'silvernitrate', name: 'Silver nitrate', formula: 'AgNO₃', color: '#f5f7fa', state: 'liquid', fact: 'Silver nitrate finds hidden salt by making a cloud.' },
  { id: 'starch', name: 'Starch', formula: 'starch', color: '#fffaf0', state: 'powder', fact: 'Starch is in potatoes, bread and rice.' },
  { id: 'soap', name: 'Dish soap', formula: 'soap', color: '#7fd3a8', state: 'liquid', fact: 'Soap traps gas in bubbles and makes foam.' },
  { id: 'K', name: 'Potassium', formula: 'K', color: '#d1c4e9', state: 'solid', element: 'K', fact: 'Potassium reacts with water even faster than sodium. Bananas have a little potassium.' },
  { id: 'Mg', name: 'Magnesium', formula: 'Mg', color: '#cfd8dc', state: 'solid', element: 'Mg', fact: 'Magnesium burns with a super bright white light, like fireworks.' },
  { id: 'He', name: 'Helium', formula: 'He', color: '#fce4ec', state: 'gas', element: 'He', fact: 'Helium is a noble gas. It does not react with anything, and it makes balloons float.' },
  { id: 'N', name: 'Nitrogen', formula: 'N₂', color: '#e8eaf6', state: 'gas', element: 'N', fact: 'Most of the air around you is nitrogen.' },
  { id: 'peroxide', name: 'Hydrogen peroxide', formula: 'H₂O₂', color: '#e0f7fa', state: 'liquid', fact: 'Hydrogen peroxide slowly breaks into water and oxygen.' },
  { id: 'Ca', name: 'Calcium', formula: 'Ca', color: '#eceff1', state: 'solid', element: 'Ca', fact: 'Calcium makes your bones and teeth strong.' },
  { id: 'Li', name: 'Lithium', formula: 'Li', color: '#eeeeee', state: 'solid', element: 'Li', fact: 'Lithium is the lightest metal. It powers phone batteries.' },
  { id: 'yeast', name: 'Yeast', formula: 'yeast', color: '#d7b98a', state: 'powder', fact: 'Yeast is a tiny living thing. It helps bread rise.' },
  { id: 'Fe', name: 'Iron', formula: 'Fe', color: '#8d8d8d', state: 'solid', element: 'Fe', fact: 'Iron is the metal in steel. Earth has a giant iron core.' },
  { id: 'coppersulfate', name: 'Copper sulfate', formula: 'CuSO₄', color: '#3f8ef0', state: 'powder', element: 'Cu', fact: 'Copper sulfate makes bright blue crystals.' },
  { id: 'Al', name: 'Aluminum', formula: 'Al', color: '#cfd8dc', state: 'powder', element: 'Al', fact: 'Aluminum is the metal in soda cans and foil.' },
  { id: 'S', name: 'Sulfur', formula: 'S', color: '#fff176', state: 'powder', element: 'S', fact: 'Sulfur is a yellow element. Some of its gases smell like rotten eggs.' },
  { id: 'I', name: 'Iodine', formula: 'I₂', color: '#6d3b1e', state: 'liquid', element: 'I', fact: 'Iodine turns starch dark blue, so it can find starch in food.' },
  // Made in the lab (they only show up inside a beaker).
  { id: 'saltwater', name: 'Salt water', formula: 'NaCl + H₂O', color: '#bfe6ff', state: 'liquid', fact: 'The salt is still there, just too small to see.' },
  { id: 'sugarwater', name: 'Sugar water', formula: 'sugar + H₂O', color: '#d6efff', state: 'liquid', fact: 'Sugar dissolves in water.' },
  { id: 'fizzwater', name: 'Fizzy foam', formula: 'CO₂ bubbles', color: '#f7f7ee', state: 'liquid', fact: 'The bubbles are carbon dioxide gas.' },
  { id: 'lye', name: 'Sodium hydroxide', formula: 'NaOH', color: '#e8f4ff', state: 'liquid', fact: 'Sodium hydroxide is a strong base.' },
  { id: 'co2', name: 'Carbon dioxide', formula: 'CO₂', color: '#eeeeee', state: 'gas', fact: 'You breathe out carbon dioxide. Plants breathe it in.' },
  { id: 'mgo', name: 'Magnesium oxide', formula: 'MgO', color: '#ffffff', state: 'powder', fact: 'The white ash left after magnesium burns.' },
  { id: 'rust', name: 'Rust', formula: 'Fe₂O₃', color: '#b5561f', state: 'powder', fact: 'Rust forms when iron meets oxygen and water.' },
  { id: 'bluewater', name: 'Blue copper water', formula: 'CuSO₄ + H₂O', color: '#2f7fe8', state: 'liquid', fact: 'Copper sulfate dissolves into a bright blue liquid.' },
  { id: 'copper', name: 'Copper', formula: 'Cu', color: '#c8662f', state: 'solid', element: 'Cu', fact: 'Copper is the orange metal in wires and pennies.' },
  { id: 'silvercloud', name: 'Silver chloride cloud', formula: 'AgCl', color: '#f3f3f3', state: 'liquid', fact: 'A cloudy solid that forms right in the liquid is called a precipitate.' },
  { id: 'ammonia', name: 'Ammonia', formula: 'NH₃', color: '#f3f6ff', state: 'gas', fact: 'Ammonia smells very strong. Farmers use it to help plants grow.' },
  { id: 'hcl', name: 'Hydrochloric acid', formula: 'HCl', color: '#f1ffe0', state: 'liquid', fact: 'Your stomach uses a little of this acid to break down food.' },
  { id: 'foam', name: 'Giant foam', formula: 'O₂ foam', color: '#ffffff', state: 'liquid', fact: 'The foam is full of oxygen gas.' },
  { id: 'fes', name: 'Iron sulfide', formula: 'FeS', color: '#4a3f35', state: 'solid', fact: 'A new solid made from iron and sulfur.' },
  { id: 'pinkjuice', name: 'Pink cabbage juice', formula: 'acid', color: '#ff5fa2', state: 'liquid', fact: 'Pink means acid.' },
  { id: 'greenjuice', name: 'Green cabbage juice', formula: 'base', color: '#3fbf7f', state: 'liquid', fact: 'Green means base.' },
  { id: 'blueblack', name: 'Blue-black starch', formula: 'starch + I₂', color: '#1b1f4a', state: 'liquid', fact: 'Dark blue means starch is here.' },
  { id: 'oilwater', name: 'Oil on water', formula: 'layers', color: '#ffd54a', state: 'liquid', fact: 'Oil and water do not mix.' },
  { id: 'molteniron', name: 'Melted iron', formula: 'Fe (melted)', color: '#ff7a1a', state: 'liquid', fact: 'Thermite gets hot enough to melt iron.' },
  { id: 'limewater', name: 'Calcium water', formula: 'Ca(OH)₂', color: '#f0f7ff', state: 'liquid', fact: 'Calcium makes the water a base.' },
  { id: 'lithwater', name: 'Lithium water', formula: 'LiOH', color: '#ffe3e3', state: 'liquid', fact: 'Lithium fizzes gently and gives off hydrogen.' },
];
export const SUB = new Map(SUBSTANCES.map((s) => [s.id, s]));
export const STARTER = ['water', 'vinegar', 'bakingsoda', 'salt', 'sugar', 'oil', 'lemon', 'H', 'O', 'C', 'Na', 'Cl'];

// What a reaction looks like. boom and bigboom empty the beaker (the glass is fine, it is a cartoon).
export type LabEffect = 'fizz' | 'boom' | 'bigboom' | 'flash' | 'pop' | 'smoke' | 'color' | 'cloudy' | 'layers' | 'dissolve' | 'foam' | 'glow';
export interface Recipe {
  id: string; needs: string[]; makes: string[]; effect: LabEffect; color: string; unlocks: string[];
  name: string; equation: string; fact: string;
  magic: { name: string; line: string };
}
export const RECIPES: Recipe[] = [
  { id: 'volcano', needs: ['bakingsoda', 'vinegar'], makes: ['fizzwater'], effect: 'fizz', color: '#f7f7ee', unlocks: ['cabbage'],
    name: 'Fizzing volcano', equation: 'baking soda + vinegar → carbon dioxide + water + sodium acetate', fact: 'An acid and a base react and make carbon dioxide gas. The gas makes the bubbles.',
    magic: { name: 'Bubbling Brew', line: 'The cauldron burps a cloud of fizzy bubbles!' } },
  { id: 'lemonfizz', needs: ['bakingsoda', 'lemon'], makes: ['fizzwater'], effect: 'fizz', color: '#fff8b0', unlocks: ['chalk'],
    name: 'Lemon fizz', equation: 'baking soda + citric acid → carbon dioxide + water + sodium citrate', fact: 'Lemon juice is an acid too, so it fizzes with baking soda.',
    magic: { name: 'Sunshine Sparkle', line: 'A sour sparkle fizzes up like lemonade magic!' } },
  { id: 'saltwater', needs: ['salt', 'water'], makes: ['saltwater'], effect: 'dissolve', color: '#bfe6ff', unlocks: ['silvernitrate'],
    name: 'Salt dissolves', equation: 'NaCl + H₂O → salt water', fact: 'The salt breaks into pieces too small to see. That is dissolving, not disappearing.',
    magic: { name: 'Mermaid Tears', line: 'The crystals vanish into the water. Where did they go?' } },
  { id: 'sugarwater', needs: ['sugar', 'water'], makes: ['sugarwater'], effect: 'dissolve', color: '#d6efff', unlocks: ['starch'],
    name: 'Sugar dissolves', equation: 'sugar + H₂O → sugar water', fact: 'Sugar dissolves faster in warm water than in cold water.',
    magic: { name: 'Honey Dew', line: 'Sweet crystals melt into a glittering syrup.' } },
  { id: 'layers', needs: ['oil', 'water'], makes: ['oilwater'], effect: 'layers', color: '#ffd54a', unlocks: ['soap'],
    name: 'Oil and water do not mix', equation: 'oil + H₂O → two layers', fact: 'Oil is less dense than water, so it floats on top in its own layer.',
    magic: { name: 'Sunset Layers', line: 'Gold floats over blue and refuses to mix!' } },
  { id: 'sodiumboom', needs: ['Na', 'water'], makes: ['lye'], effect: 'boom', color: '#ffe066', unlocks: ['K'],
    name: 'Sodium meets water: BOOM!', equation: '2Na + 2H₂O → 2NaOH + H₂', fact: 'Sodium pulls apart water so fast that the hydrogen gas it makes catches fire. Real chemists keep sodium in oil.',
    magic: { name: 'Thunder Pebble', line: 'KA-BOOM! The silver pebble wakes the water dragon!' } },
  { id: 'potassiumboom', needs: ['K', 'water'], makes: [], effect: 'bigboom', color: '#c39bff', unlocks: ['Li'],
    name: 'Potassium meets water: BIG BOOM!', equation: '2K + 2H₂O → 2KOH + H₂', fact: 'Potassium reacts even faster than sodium and burns with a lilac purple flame.',
    magic: { name: 'Purple Dragon Sneeze', line: 'A purple fireball bursts out of the cauldron!' } },
  { id: 'lithiumfizz', needs: ['Li', 'water'], makes: ['lithwater'], effect: 'fizz', color: '#ffe3e3', unlocks: [],
    name: 'Lithium fizzes', equation: '2Li + 2H₂O → 2LiOH + H₂', fact: 'Lithium is in the same family as sodium and potassium, but it reacts the gentlest of the three.',
    magic: { name: 'Pixie Fizz', line: 'A gentle fizz, like a tiny pixie giggling.' } },
  { id: 'makesalt', needs: ['Na', 'Cl'], makes: ['salt'], effect: 'flash', color: '#fff7c2', unlocks: ['Mg'],
    name: 'Making table salt', equation: '2Na + Cl₂ → 2NaCl', fact: 'A soft metal and a green gas join with a bright flash and make the salt you eat.',
    magic: { name: 'Salt Star', line: 'A flash of light, and a pile of salt crystals appears!' } },
  { id: 'makewater', needs: ['H', 'O'], makes: ['water'], effect: 'pop', color: '#9fd8ff', unlocks: ['He'],
    name: 'Making water: POP!', equation: '2H₂ + O₂ → 2H₂O', fact: 'Hydrogen and oxygen gas join with a pop and make water. Rockets use this reaction.',
    magic: { name: 'Raindrop Pop', line: 'POP! Two invisible gases turn into real water.' } },
  { id: 'makeco2', needs: ['C', 'O'], makes: ['co2'], effect: 'smoke', color: '#bdbdbd', unlocks: ['N'],
    name: 'Burning carbon', equation: 'C + O₂ → CO₂', fact: 'When carbon burns, it joins with oxygen and makes carbon dioxide.',
    magic: { name: 'Shadow Smoke', line: 'Grey smoke curls up out of the glass.' } },
  { id: 'pink', needs: ['cabbage', 'vinegar'], makes: ['pinkjuice'], effect: 'color', color: '#ff5fa2', unlocks: ['peroxide'],
    name: 'Indicator: pink means acid', equation: 'red cabbage juice + acid → pink', fact: 'Red cabbage juice turns pink in acids like vinegar.',
    magic: { name: 'Rose Potion', line: 'The purple potion blushes bright pink!' } },
  { id: 'green', needs: ['cabbage', 'bakingsoda'], makes: ['greenjuice'], effect: 'color', color: '#3fbf7f', unlocks: ['yeast'],
    name: 'Indicator: green means base', equation: 'red cabbage juice + base → green', fact: 'Red cabbage juice turns green or blue in bases like baking soda.',
    magic: { name: 'Forest Potion', line: 'The purple potion turns forest green!' } },
  { id: 'chalkfizz', needs: ['chalk', 'vinegar'], makes: ['fizzwater'], effect: 'fizz', color: '#fafafa', unlocks: ['Ca'],
    name: 'Chalk fizz', equation: 'CaCO₃ + acid → CO₂ + water + calcium acetate', fact: 'Acid slowly eats away chalk and seashells and makes carbon dioxide.',
    magic: { name: 'Seashell Whisper', line: 'Tiny bubbles whisper out of the chalk.' } },
  { id: 'calciumfizz', needs: ['Ca', 'water'], makes: ['limewater'], effect: 'fizz', color: '#f0f7ff', unlocks: ['Fe'],
    name: 'Calcium fizzes', equation: 'Ca + 2H₂O → Ca(OH)₂ + H₂', fact: 'Calcium reacts with water more slowly than sodium and makes hydrogen bubbles.',
    magic: { name: 'Bone Bubbles', line: 'Slow, steady bubbles rise from the calcium.' } },
  { id: 'mgburn', needs: ['Mg', 'O'], makes: ['mgo'], effect: 'flash', color: '#ffffff', unlocks: ['Fe'],
    name: 'Burning magnesium', equation: '2Mg + O₂ → 2MgO', fact: 'Magnesium burns with a white light so bright that you should never look right at it.',
    magic: { name: 'Starfire', line: 'A blinding white star flares in the glass!' } },
  { id: 'rust', needs: ['Fe', 'O', 'water'], makes: ['rust'], effect: 'color', color: '#b5561f', unlocks: ['Al', 'coppersulfate'],
    name: 'Iron rusts', equation: '4Fe + 3O₂ + water → 2Fe₂O₃ (rust)', fact: 'Iron needs both oxygen and water to rust. That is why old bikes left in the rain get orange.',
    magic: { name: 'Dragon Rust', line: 'The iron grows an orange dragon skin.' } },
  { id: 'bluewater', needs: ['coppersulfate', 'water'], makes: ['bluewater'], effect: 'dissolve', color: '#2f7fe8', unlocks: ['S'],
    name: 'Blue copper water', equation: 'CuSO₄ + H₂O → blue solution', fact: 'Copper sulfate dissolves into one of the bluest liquids in chemistry.',
    magic: { name: 'Ocean Heart', line: 'The water turns deep ocean blue.' } },
  { id: 'copperplate', needs: ['bluewater', 'Fe'], makes: ['copper'], effect: 'color', color: '#7fbfa0', unlocks: [],
    name: 'Iron swaps with copper', equation: 'Fe + CuSO₄ → FeSO₄ + Cu', fact: 'Iron pushes the copper out of the blue liquid. Orange copper coats the iron and the blue fades to green.',
    magic: { name: 'Copper Swap', line: 'The iron turns copper orange like magic!' } },
  { id: 'silvercloud', needs: ['silvernitrate', 'saltwater'], makes: ['silvercloud'], effect: 'cloudy', color: '#f3f3f3', unlocks: ['I'],
    name: 'A cloud appears', equation: 'AgNO₃ + NaCl → AgCl + NaNO₃', fact: 'Two clear liquids make a white cloud. The cloud is a new solid called a precipitate.',
    magic: { name: 'Ghost Cloud', line: 'Two clear potions make a ghostly white cloud!' } },
  { id: 'starchtest', needs: ['I', 'starch'], makes: ['blueblack'], effect: 'color', color: '#1b1f4a', unlocks: [],
    name: 'The starch test', equation: 'iodine + starch → blue-black', fact: 'Iodine turns dark blue-black when starch is there. Scientists use it to find starch in food.',
    magic: { name: 'Midnight Ink', line: 'The potion turns the color of the night sky.' } },
  { id: 'toothpastebig', needs: ['peroxide', 'yeast', 'soap'], makes: ['foam'], effect: 'foam', color: '#ffffff', unlocks: [],
    name: 'Elephant toothpaste', equation: '2H₂O₂ → 2H₂O + O₂ (yeast speeds it up)', fact: 'Yeast makes peroxide break apart super fast. The soap catches the oxygen in a giant foam.',
    magic: { name: 'Giant Cloud Foam', line: 'A mountain of foam erupts out of the beaker!' } },
  { id: 'toothpaste', needs: ['peroxide', 'yeast'], makes: ['water'], effect: 'fizz', color: '#e0f7fa', unlocks: [],
    name: 'Oxygen bubbles', equation: '2H₂O₂ → 2H₂O + O₂', fact: 'Yeast breaks peroxide into water and oxygen bubbles. Add soap to trap the bubbles!',
    magic: { name: 'Breath Bubbles', line: 'Bubbles rise. Something is missing to make it foam.' } },
  { id: 'ammonia', needs: ['N', 'H'], makes: ['ammonia'], effect: 'smoke', color: '#eef2ff', unlocks: [],
    name: 'Making ammonia', equation: 'N₂ + 3H₂ → 2NH₃', fact: 'Nitrogen and hydrogen make ammonia, which helps feed plants all over the world.',
    magic: { name: 'Stinky Mist', line: 'A very stinky mist swirls up. Pee-yew!' } },
  { id: 'hclboom', needs: ['H', 'Cl'], makes: ['hcl'], effect: 'boom', color: '#d8f5a2', unlocks: [],
    name: 'Hydrogen and chlorine: BOOM!', equation: 'H₂ + Cl₂ → 2HCl', fact: 'In light, hydrogen and chlorine react with a bang and make hydrochloric acid.',
    magic: { name: 'Lightning Jar', line: 'A green-white thunderclap rattles the shelf!' } },
  { id: 'ironsulfide', needs: ['Fe', 'S'], makes: ['fes'], effect: 'glow', color: '#ff9a3c', unlocks: [],
    name: 'Iron and sulfur glow', equation: 'Fe + S → FeS', fact: 'Heated iron and sulfur glow orange and join into a new solid. A magnet can no longer pick it up.',
    magic: { name: 'Ember Stone', line: 'The powder glows like a sleeping ember.' } },
  { id: 'thermite', needs: ['Al', 'rust'], makes: ['molteniron'], effect: 'bigboom', color: '#ffb02e', unlocks: [],
    name: 'Thermite!', equation: '2Al + Fe₂O₃ → Al₂O₃ + 2Fe', fact: 'Aluminum steals the oxygen from rust so fast it gets hot enough to melt iron. Welders use it on train tracks.',
    magic: { name: 'Phoenix Fire', line: 'Sparks fly like a phoenix being born!' } },
];
export const RECIPE = new Map(RECIPES.map((r) => [r.id, r]));
export const BEAKER_MAX = 5;

export interface MixResult { contents: string[]; reaction: Recipe | null; full?: boolean; noble?: boolean }
// Pour one substance into a beaker. The reaction with the most ingredients wins (so peroxide, yeast
// and soap make the giant foam, not just bubbles). A boom empties the beaker.
export function pour(contents: string[], id: string): MixResult {
  if (contents.length >= BEAKER_MAX) return { contents, reaction: null, full: true };
  const next = [...contents, id];
  const has = (needs: string[]) => { const left = [...next]; return needs.every((n) => { const i = left.indexOf(n); if (i < 0) return false; left.splice(i, 1); return true; }); };
  const r = [...RECIPES].sort((a, b) => b.needs.length - a.needs.length).find((x) => x.needs.includes(id) && has(x.needs)) ?? null;
  if (!r) return { contents: next, reaction: null, noble: id === 'He' && contents.length > 0 };
  const left = [...next];
  r.needs.forEach((n) => left.splice(left.indexOf(n), 1));
  const after = r.effect === 'boom' || r.effect === 'bigboom' ? [] : [...left, ...r.makes];
  return { contents: after, reaction: r };
}

// The liquid's color: the newest reaction's color, or a blend of what is inside.
export function blend(contents: string[]): string {
  if (!contents.length) return 'transparent';
  const cs = contents.map((c) => SUB.get(c)?.color ?? '#ffffff').map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
  const avg = [0, 1, 2].map((k) => Math.round(cs.reduce((n, c) => n + c[k], 0) / cs.length));
  return `#${avg.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
