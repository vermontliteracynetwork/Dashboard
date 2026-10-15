// Science Lab (teacher 2026-10-09: "lets build a science lab. science lab should be an app in the
// computer not a native game"). A 2D sandbox lab: pour bottles into glass beakers and mix them.
// Things fizz, change color, go cloudy, foam or explode with animations, but only when the real
// chemistry would. Discoveries go in the Science Journal with their recipe, and each one unlocks
// new bottles, so elements are learned over time. Pure data and rules: no React, no DOM.

import { RULE_HEAT_RECIPES, RULE_RECIPES, TOKENS, TOKEN_LABEL, elementSubstances, isRadioactive } from './elementLab';

export type LabState = 'liquid' | 'powder' | 'solid' | 'gas';
export interface Substance { id: string; name: string; formula: string; color: string; state: LabState; element?: string; fact: string }

export const SUBSTANCES: Substance[] = [
  // Starter shelf: kitchen things and five elements.
  { id: 'water', name: 'Water', formula: 'H₂O', color: '#9fd8ff', state: 'liquid', fact: 'Water is made of two hydrogen atoms and one oxygen atom.' },
  { id: 'vinegar', name: 'Vinegar', formula: 'CH₃COOH', color: '#f4f1d0', state: 'liquid', fact: 'Vinegar is mostly water with a little acetic acid in it. Acids taste sour.' },
  { id: 'bakingsoda', name: 'Baking soda', formula: 'NaHCO₃', color: '#ffffff', state: 'powder', fact: 'Baking soda is a base. Bases react with acids.' },
  { id: 'salt', name: 'Table salt', formula: 'NaCl', color: '#f2f2f2', state: 'powder', fact: 'Table salt is sodium and chlorine joined together.' },
  { id: 'sugar', name: 'Sugar', formula: 'C₁₂H₂₂O₁₁', color: '#fffdf5', state: 'powder', fact: 'Sugar is made of carbon, hydrogen and oxygen.' },
  { id: 'oil', name: 'Cooking oil', formula: 'oil', color: '#ffd54a', state: 'liquid', fact: 'Oil is lighter than water, so it floats on top.' },
  { id: 'lemon', name: 'Lemon juice', formula: 'citric acid', color: '#fff27a', state: 'liquid', fact: 'Lemon juice is an acid called citric acid.' },
  { id: 'H', name: 'Hydrogen', formula: 'H₂', color: '#e3f2fd', state: 'gas', element: 'H', fact: 'Hydrogen is the lightest element and the most common one in the universe.' },
  { id: 'O', name: 'Oxygen', formula: 'O₂', color: '#e1f5fe', state: 'gas', element: 'O', fact: 'Oxygen is the gas we breathe. Fire needs it to burn.' },
  { id: 'C', name: 'Carbon', formula: 'C', color: '#3a3a3a', state: 'powder', element: 'C', fact: 'Carbon is in every living thing. Diamonds and pencil lead are both carbon.' },
  { id: 'Na', name: 'Sodium', formula: 'Na', color: '#d7dde3', state: 'solid', element: 'Na', fact: 'Sodium is a soft metal you can cut with a butter knife. It reacts with water.' },
  { id: 'Cl', name: 'Chlorine', formula: 'Cl₂', color: '#d8f5a2', state: 'gas', element: 'Cl', fact: 'Chlorine is a poisonous yellow-green gas. Chlorine compounds keep pool water clean.' },
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
  { id: 'coppersulfate', name: 'Copper sulfate', formula: 'CuSO₄·5H₂O', color: '#3f8ef0', state: 'powder', fact: 'Copper sulfate crystals are bright blue because water is locked inside them. Heated dry, they turn white.' },
  { id: 'Al', name: 'Aluminum', formula: 'Al', color: '#cfd8dc', state: 'powder', element: 'Al', fact: 'Aluminum is the metal in soda cans and foil.' },
  { id: 'S', name: 'Sulfur', formula: 'S', color: '#fff176', state: 'powder', element: 'S', fact: 'Sulfur is a yellow element. Some of its gases smell like rotten eggs.' },
  { id: 'I', name: 'Iodine', formula: 'I₂', color: '#3b2a4a', state: 'solid', element: 'I', fact: 'Iodine is a shiny, dark purple-gray solid. Warmed, it turns straight into purple vapor. Dissolved in water, it finds starch.' },
  // Made in the lab (they only show up inside a beaker).
  { id: 'saltwater', name: 'Salt water', formula: 'NaCl + H₂O', color: '#bfe6ff', state: 'liquid', fact: 'The salt is still there, just too small to see.' },
  { id: 'sugarwater', name: 'Sugar water', formula: 'sugar + H₂O', color: '#d6efff', state: 'liquid', fact: 'Sugar dissolves in water.' },
  { id: 'fizzwater', name: 'Fizzy foam', formula: 'CO₂ bubbles', color: '#f7f7ee', state: 'liquid', fact: 'The bubbles are carbon dioxide gas.' },
  { id: 'lye', name: 'Sodium hydroxide', formula: 'NaOH', color: '#e8f4ff', state: 'liquid', fact: 'Sodium hydroxide is a strong base.' },
  { id: 'co2', name: 'Carbon dioxide', formula: 'CO₂', color: '#eeeeee', state: 'gas', fact: 'You breathe out carbon dioxide. Plants breathe it in.' },
  { id: 'mgo', name: 'Magnesium oxide', formula: 'MgO', color: '#ffffff', state: 'powder', fact: 'The white ash left after magnesium burns.' },
  { id: 'rust', name: 'Rust', formula: 'Fe₂O₃·xH₂O', color: '#b5561f', state: 'powder', fact: 'Rust is iron oxide with water locked in it. It forms when iron meets oxygen and water.' },
  { id: 'bluewater', name: 'Blue copper water', formula: 'CuSO₄ + H₂O', color: '#2f7fe8', state: 'liquid', fact: 'Copper sulfate dissolves into a bright blue liquid.' },
  { id: 'copper', name: 'Copper coating', formula: 'Cu', color: '#c8662f', state: 'solid', fact: 'Copper is the orange metal in wires and on the outside of pennies.' },
  { id: 'silvercloud', name: 'Silver chloride cloud', formula: 'AgCl', color: '#f3f3f3', state: 'liquid', fact: 'A cloudy solid that forms right in the liquid is called a precipitate.' },
  { id: 'ammonia', name: 'Ammonia', formula: 'NH₃', color: '#f3f6ff', state: 'gas', fact: 'Ammonia smells very strong. Farmers use it to help plants grow.' },
  { id: 'hcl', name: 'Dilute hydrochloric acid', formula: 'HCl', color: '#f1ffe0', state: 'liquid', fact: 'A strong acid, watered down for school labs. Your stomach uses a little of it to break down food.' },
  { id: 'chlorinewater', name: 'Chlorine water', formula: 'HCl + HOCl', color: '#eef8c8', state: 'liquid', fact: 'Chlorine dissolved in water. It kills germs.' },
  { id: 'iodinewater', name: 'Iodine water', formula: 'I₂ in H₂O', color: '#e8c27a', state: 'liquid', fact: 'A little iodine dissolved in water. It turns dark blue with starch.' },
  { id: 'foam', name: 'Giant foam', formula: 'O₂ foam', color: '#ffffff', state: 'liquid', fact: 'The foam is full of oxygen gas.' },
  { id: 'fes', name: 'Iron sulfide', formula: 'FeS', color: '#4a3f35', state: 'solid', fact: 'A new solid made from iron and sulfur.' },
  { id: 'pinkjuice', name: 'Pink cabbage juice', formula: 'acid', color: '#ff5fa2', state: 'liquid', fact: 'Pink means acid.' },
  { id: 'greenjuice', name: 'Green cabbage juice', formula: 'base', color: '#3fbf7f', state: 'liquid', fact: 'Green means base.' },
  { id: 'blueblack', name: 'Blue-black starch', formula: 'starch + I₂', color: '#1b1f4a', state: 'liquid', fact: 'Dark blue means starch is here.' },
  { id: 'oilwater', name: 'Oil on water', formula: 'layers', color: '#ffd54a', state: 'liquid', fact: 'Oil and water do not mix.' },
  { id: 'molteniron', name: 'Melted iron', formula: 'Fe (melted)', color: '#ff7a1a', state: 'liquid', fact: 'Thermite gets hot enough to melt iron.' },
  { id: 'limewater', name: 'Calcium water', formula: 'Ca(OH)₂', color: '#f0f7ff', state: 'liquid', fact: 'Calcium makes the water a base.' },
  { id: 'caramel', name: 'Caramel', formula: 'melted sugar', color: '#b5651d', state: 'liquid', fact: 'Heat breaks sugar apart into brown, sweet caramel.' },
  { id: 'saltcrystals', name: 'Salt crystals', formula: 'NaCl', color: '#ffffff', state: 'powder', fact: 'The water left as steam and the salt stayed behind.' },
  { id: 'bluecrystals', name: 'Blue crystals', formula: 'CuSO₄', color: '#2f6fd0', state: 'powder', fact: 'Blue crystals grow as the water leaves.' },
  { id: 'lithwater', name: 'Lithium water', formula: 'LiOH', color: '#ffe3e3', state: 'liquid', fact: 'Lithium fizzes gently and gives off hydrogen.' },
  // Colors and dyes (Build Queue 212, her words 2026-10-15: "add a food color or other dyes element so thye can see
  // things change colors based on certian reactions"). Kitchen bottles first, then what they make in a beaker.
  { id: 'reddye', name: 'Red food coloring', formula: 'dye', color: '#e0262b', state: 'liquid', fact: 'Food coloring is a dye: a chemical that soaks up some colors of light and bounces back the rest. Red dye bounces back red.' },
  { id: 'bluedye', name: 'Blue food coloring', formula: 'dye', color: '#1f5fe0', state: 'liquid', fact: 'Blue food coloring soaks up red, orange and yellow light, so you see blue.' },
  { id: 'yellowdye', name: 'Yellow food coloring', formula: 'dye', color: '#ffd21f', state: 'liquid', fact: 'Yellow food coloring soaks up blue light, so you see yellow.' },
  { id: 'bleach', name: 'Bleach', formula: 'NaOCl', color: '#f3f7d6', state: 'liquid', fact: 'Bleach breaks apart the color chemicals in stains. It is a strong base and a strong chemical. Grown-ups only.' },
  { id: 'turmeric', name: 'Turmeric', formula: 'curcumin', color: '#f0a500', state: 'powder', fact: 'Turmeric is a yellow spice. Its color chemical, curcumin, is an indicator: it turns red in bases.' },
  { id: 'butterflypea', name: 'Butterfly pea tea', formula: 'indicator', color: '#2f46c8', state: 'liquid', fact: 'Tea made from blue butterfly pea flowers. Like red cabbage juice, it changes color in acids and bases.' },
  { id: 'phenol', name: 'Phenolphthalein', formula: 'C₂₀H₁₄O₄', color: '#f7f9ff', state: 'liquid', fact: 'A lab indicator that looks just like water. It turns hot pink in a strong base.' },
  { id: 'milk', name: 'Milk', formula: 'milk', color: '#fbfaf3', state: 'liquid', fact: 'Milk is mostly water with tiny drops of fat and a protein called casein floating in it.' },
  { id: 'purpledye', name: 'Purple dye', formula: 'red + blue dye', color: '#7a2bc4', state: 'liquid', fact: 'Red and blue dyes mixed. Both dyes are still there.' },
  { id: 'greendye', name: 'Green dye', formula: 'blue + yellow dye', color: '#1fa64a', state: 'liquid', fact: 'Blue and yellow dyes mixed. Both dyes are still there.' },
  { id: 'orangedye', name: 'Orange dye', formula: 'red + yellow dye', color: '#ff7a1a', state: 'liquid', fact: 'Red and yellow dyes mixed. Both dyes are still there.' },
  { id: 'faded', name: 'Faded water', formula: 'broken dye', color: '#eef3e6', state: 'liquid', fact: 'The bleach broke the dye apart, so the color is gone for good.' },
  { id: 'turmericred', name: 'Red turmeric', formula: 'curcumin in a base', color: '#c4301c', state: 'liquid', fact: 'Red means base.' },
  { id: 'peapurple', name: 'Purple-pink tea', formula: 'indicator in acid', color: '#b24bc8', state: 'liquid', fact: 'Purple-pink means acid.' },
  { id: 'peagreen', name: 'Green tea', formula: 'indicator in a base', color: '#2fa77a', state: 'liquid', fact: 'Green means base.' },
  { id: 'phenolpink', name: 'Hot pink', formula: 'phenolphthalein in a base', color: '#ff2f92', state: 'liquid', fact: 'Hot pink means a strong base.' },
  { id: 'magicmilk', name: 'Magic milk', formula: 'swirling colors', color: '#f6b9de', state: 'liquid', fact: 'The colors swirl as the soap chases the milk fat.' },
  { id: 'curds', name: 'Curds and whey', formula: 'casein clumps', color: '#fffbe6', state: 'liquid', fact: 'Clumps of milk protein. This is how cheese starts.' },
];
// Every element has its own bottle (Build Queue 201): the ones the lab did not have are added here.
SUBSTANCES.push(...elementSubstances(new Set(SUBSTANCES.map((s) => s.id))));
export const SUB = new Map(SUBSTANCES.map((s) => [s.id, s]));
export const STARTER = ['water', 'vinegar', 'bakingsoda', 'salt', 'sugar', 'oil', 'lemon', 'H', 'O', 'C', 'Na', 'Cl'];
// The shelf: kitchen and lab bottles, then all 118 elements, all unlocked (Build Queue 201: "Unlock ... all elements").
export const KITCHEN = ['water', 'vinegar', 'lemon', 'hcl', 'bakingsoda', 'salt', 'sugar', 'oil', 'milk', 'cabbage', 'chalk', 'starch', 'soap', 'yeast', 'peroxide', 'silvernitrate', 'coppersulfate',
  'reddye', 'bluedye', 'yellowdye', 'turmeric', 'butterflypea', 'phenol', 'bleach'];

// Dye groups for the color reactions (Build Queue 212).
TOKENS['@dye'] = ['reddye', 'bluedye', 'yellowdye', 'purpledye', 'greendye', 'orangedye'];
TOKENS['@base'] = ['bakingsoda', 'lye', 'limewater', 'lithwater', 'soap', 'bleach'];
TOKENS['@strongbase'] = ['lye', 'limewater', 'lithwater'];
TOKEN_LABEL['@dye'] = 'any food coloring';
TOKEN_LABEL['@base'] = 'a base (baking soda, soap or bleach)';
TOKEN_LABEL['@strongbase'] = 'a strong base (sodium or calcium hydroxide)';

// What a reaction looks like. boom and bigboom empty the beaker (the glass is fine, it is a cartoon).
export type LabEffect = 'fizz' | 'boom' | 'bigboom' | 'flash' | 'pop' | 'smoke' | 'color' | 'cloudy' | 'layers' | 'dissolve' | 'foam' | 'glow';
export interface Recipe {
  id: string; needs: string[]; makes: string[]; effect: LabEffect; color: string; unlocks: string[];
  name: string; equation: string; fact: string;
  magic: { name: string; line: string };
  group?: string; safety?: string;
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
  { id: 'sodiumboom', needs: ['Na', '@wet'], makes: ['lye'], effect: 'boom', color: '#ffe066', unlocks: ['K'],
    name: 'Sodium meets water: BOOM!', equation: '2Na + 2H₂O → 2NaOH + H₂', fact: 'Sodium melts into a ball, zooms around and pulls water apart so fast that the hydrogen it makes can catch fire. Real chemists keep sodium under oil.',
    magic: { name: 'Thunder Pebble', line: 'KA-BOOM! The silver pebble wakes the water dragon!' } },
  { id: 'potassiumboom', needs: ['K', '@wet'], makes: [], effect: 'bigboom', color: '#c39bff', unlocks: ['Li'],
    name: 'Potassium meets water: BIG BOOM!', equation: '2K + 2H₂O → 2KOH + H₂', fact: 'Potassium reacts even faster than sodium and burns with a lilac purple flame.',
    magic: { name: 'Purple Dragon Sneeze', line: 'A purple fireball bursts out of the cauldron!' } },
  { id: 'lithiumfizz', needs: ['Li', '@wet'], makes: ['lithwater'], effect: 'fizz', color: '#ffe3e3', unlocks: [],
    name: 'Lithium fizzes', equation: '2Li + 2H₂O → 2LiOH + H₂', fact: 'Lithium is in the same family as sodium and potassium, but it reacts the gentlest of the three.',
    magic: { name: 'Pixie Fizz', line: 'A gentle fizz, like a tiny pixie giggling.' } },
  { id: 'makesalt', needs: ['Na', 'Cl'], makes: ['salt'], effect: 'flash', color: '#fff7c2', unlocks: ['Mg'],
    name: 'Making table salt', equation: '2Na + Cl₂ → 2NaCl', fact: 'A soft metal and a green gas join with a bright flash and make the salt you eat.',
    magic: { name: 'Salt Star', line: 'A flash of light, and a pile of salt crystals appears!' } },
  { id: 'pink', needs: ['cabbage', 'vinegar'], makes: ['pinkjuice'], effect: 'color', color: '#ff5fa2', unlocks: ['peroxide'],
    name: 'Indicator: pink means acid', equation: 'red cabbage juice + acid → pink', fact: 'Red cabbage juice turns pink in acids like vinegar.',
    magic: { name: 'Rose Potion', line: 'The purple potion blushes bright pink!' } },
  { id: 'green', needs: ['cabbage', 'bakingsoda'], makes: ['greenjuice'], effect: 'color', color: '#3fbf7f', unlocks: ['yeast'],
    name: 'Indicator: green means base', equation: 'red cabbage juice + base → green', fact: 'Red cabbage juice turns green or blue in bases like baking soda.',
    magic: { name: 'Forest Potion', line: 'The purple potion turns forest green!' } },
  { id: 'chalkfizz', needs: ['chalk', 'vinegar'], makes: ['fizzwater'], effect: 'fizz', color: '#fafafa', unlocks: ['Ca'],
    name: 'Chalk fizz', equation: 'CaCO₃ + acid → CO₂ + water + calcium acetate', fact: 'Acid slowly eats away chalk and seashells and makes carbon dioxide.',
    magic: { name: 'Seashell Whisper', line: 'Tiny bubbles whisper out of the chalk.' } },
  { id: 'calciumfizz', needs: ['Ca', '@wet'], makes: ['limewater'], effect: 'fizz', color: '#f0f7ff', unlocks: ['Fe'],
    name: 'Calcium fizzes', equation: 'Ca + 2H₂O → Ca(OH)₂ + H₂', fact: 'Calcium reacts with water more slowly than sodium and makes hydrogen bubbles.',
    magic: { name: 'Bone Bubbles', line: 'Slow, steady bubbles rise from the calcium.' } },
  { id: 'rust', needs: ['Fe', 'O', 'water'], makes: ['rust'], effect: 'color', color: '#b5561f', unlocks: ['Al', 'coppersulfate'],
    name: 'Iron rusts', equation: '4Fe + 3O₂ + water → 2Fe₂O₃·xH₂O (rust)', fact: 'Iron needs both oxygen and water to rust. That is why old bikes left in the rain get orange.',
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
  { id: 'starchtest', needs: ['iodinewater', 'starch'], makes: ['blueblack'], effect: 'color', color: '#1b1f4a', unlocks: [],
    name: 'The starch test', equation: 'iodine + starch → blue-black', fact: 'Iodine turns dark blue-black when starch is there. Scientists use it to find starch in food.',
    magic: { name: 'Midnight Ink', line: 'The potion turns the color of the night sky.' } },
  { id: 'toothpastebig', needs: ['peroxide', 'yeast', 'soap'], makes: ['foam'], effect: 'foam', color: '#ffffff', unlocks: [],
    name: 'Elephant toothpaste', equation: '2H₂O₂ → 2H₂O + O₂ (yeast speeds it up)', fact: 'Yeast makes peroxide break apart super fast. The soap catches the oxygen in a giant foam.',
    magic: { name: 'Giant Cloud Foam', line: 'A mountain of foam erupts out of the beaker!' } },
  { id: 'toothpaste', needs: ['peroxide', 'yeast'], makes: ['water'], effect: 'fizz', color: '#e0f7fa', unlocks: [],
    name: 'Oxygen bubbles', equation: '2H₂O₂ → 2H₂O + O₂', fact: 'Yeast breaks peroxide into water and oxygen bubbles. Add soap to trap the bubbles!',
    magic: { name: 'Breath Bubbles', line: 'Bubbles rise. Something is missing to make it foam.' } },
  { id: 'hclboom', needs: ['H', 'Cl'], makes: ['hcl'], effect: 'boom', color: '#d8f5a2', unlocks: [],
    name: 'Hydrogen and chlorine: BOOM!', equation: 'H₂ + Cl₂ → 2HCl', fact: 'In light, hydrogen and chlorine react with a bang and make hydrochloric acid.',
    magic: { name: 'Lightning Jar', line: 'A green-white thunderclap rattles the shelf!' } },
  // More recipes (Build Queue 2026-10-09).
  { id: 'lemonpink', needs: ['cabbage', 'lemon'], makes: ['pinkjuice'], effect: 'color', color: '#ff5fa2', unlocks: [],
    name: 'Lemon turns it pink', equation: 'red cabbage juice + citric acid → pink', fact: 'Lemon juice is an acid too, so the indicator turns pink, just like with vinegar.',
    magic: { name: 'Pink Lemonade Potion', line: 'A squeeze of sunshine turns the potion pink!' } },
  { id: 'soapbubbles', needs: ['soap', 'water'], makes: ['foam'], effect: 'foam', color: '#e8fff4', unlocks: [],
    name: 'Soap bubbles', equation: 'soap + H₂O → bubbles (no new chemical)', fact: 'Soap makes water stretchy, so it can hold air in bubbles. Nothing new is made, so this is a physical change.',
    magic: { name: 'Bubble Charm', line: 'Shiny bubbles float out of the cauldron.' } },
  { id: 'mgfizz', needs: ['Mg', 'vinegar'], makes: ['fizzwater'], effect: 'fizz', color: '#f4f1d0', unlocks: [],
    name: 'Magnesium fizzes in acid', equation: 'Mg + 2CH₃COOH → magnesium acetate + H₂', fact: 'Acids eat away some metals and give off hydrogen gas. The bubbles are hydrogen.',
    magic: { name: 'Silver Sizzle', line: 'The metal sizzles away into tiny bubbles!' } },
  { id: 'alcopper', needs: ['bluewater', 'Al', '@chloride'], makes: ['copper'], effect: 'glow', color: '#c8662f', unlocks: [],
    name: 'Aluminum swaps with copper', equation: '2Al + 3CuSO₄ → Al₂(SO₄)₃ + 3Cu', fact: 'A thin coat of oxide protects aluminum, so nothing happens at first. Salt breaks the coat, then aluminum pushes copper out of the blue liquid, gets hot and fizzes.',
    magic: { name: 'Copper Bloom', line: 'Orange copper blooms out of the blue!' } },
  // Colors and dyes (Build Queue 212). Every color change here happens in real kitchens and school labs.
  { id: 'mixpurple', group: 'dye', needs: ['reddye', 'bluedye'], makes: ['purpledye'], effect: 'color', color: '#7a2bc4', unlocks: [],
    name: 'Red and blue make purple', equation: 'red dye + blue dye → purple (a mixture)', fact: 'Nothing new is made: the red dye and the blue dye are both still there, and together they bounce back purple light. That is a physical change.',
    magic: { name: 'Royal Ink', line: 'The colors swirl into royal purple.' } },
  { id: 'mixgreen', group: 'dye', needs: ['bluedye', 'yellowdye'], makes: ['greendye'], effect: 'color', color: '#1fa64a', unlocks: [],
    name: 'Blue and yellow make green', equation: 'blue dye + yellow dye → green (a mixture)', fact: 'The blue dye soaks up red and yellow light, the yellow dye soaks up blue light, and green is what is left. Both dyes are still there.',
    magic: { name: 'Meadow Ink', line: 'The colors swirl into meadow green.' } },
  { id: 'mixorange', group: 'dye', needs: ['reddye', 'yellowdye'], makes: ['orangedye'], effect: 'color', color: '#ff7a1a', unlocks: [],
    name: 'Red and yellow make orange', equation: 'red dye + yellow dye → orange (a mixture)', fact: 'Mixing two dyes is a physical change. No new chemical is made, the colors just add up to orange.',
    magic: { name: 'Sunset Ink', line: 'The colors swirl into sunset orange.' } },
  { id: 'bleachdye', group: 'dye', needs: ['@dye', 'bleach'], makes: ['faded'], effect: 'color', color: '#eef3e6', unlocks: [],
    name: 'Bleach erases the color', equation: 'NaOCl + dye → colorless pieces', fact: 'Bleach breaks the dye molecules apart at the exact spot that catches light, so the color fades away. That is a chemical change: the color cannot come back. It is how bleach takes out stains.',
    magic: { name: 'Vanishing Ink', line: 'The color fades away like a ghost!' } },
  { id: 'bleachacid', group: 'dye', needs: ['bleach', '@acid'], makes: ['chlorinewater'], effect: 'smoke', color: '#e6f3a8', unlocks: [],
    name: 'Bleach and acid make chlorine gas', equation: 'NaOCl + 2H⁺ → Cl₂ + water + salt', fact: 'Acid pulls chlorine gas out of bleach. Chlorine gas is poisonous, which is why the bottle says never mix bleach with vinegar or other cleaners.',
    magic: { name: 'Poison Fog', line: 'A sharp green-yellow fog curls up. Stand back!' } },
  { id: 'turmericbase', group: 'dye', needs: ['turmeric', '@base'], makes: ['turmericred'], effect: 'color', color: '#c4301c', unlocks: [],
    name: 'Yellow turmeric turns red', equation: 'curcumin + base → red curcumin', fact: 'Turmeric\'s yellow chemical, curcumin, changes shape in a base and turns red. A yellow curry stain turns red when you scrub it with soap! In acids it stays yellow.',
    magic: { name: 'Dragon Blush', line: 'The golden potion blushes deep red!' } },
  { id: 'peaacid', group: 'dye', needs: ['butterflypea', '@acid'], makes: ['peapurple'], effect: 'color', color: '#b24bc8', unlocks: [],
    name: 'Blue tea turns purple-pink', equation: 'butterfly pea tea + acid → purple-pink', fact: 'Butterfly pea flowers have the same family of color chemicals as red cabbage. A squeeze of lemon turns the blue tea purple, and more acid turns it pink. Some color-changing lemonades work this way.',
    magic: { name: 'Twilight Tea', line: 'The blue tea turns twilight purple!' } },
  { id: 'peabase', group: 'dye', needs: ['butterflypea', '@base'], makes: ['peagreen'], effect: 'color', color: '#2fa77a', unlocks: [],
    name: 'Blue tea turns green', equation: 'butterfly pea tea + base → green', fact: 'In a base, the butterfly pea color chemical changes shape again and the tea turns green.',
    magic: { name: 'Forest Tea', line: 'The blue tea turns forest green!' } },
  { id: 'phenolpink', group: 'dye', needs: ['phenol', '@strongbase'], makes: ['phenolpink'], effect: 'color', color: '#ff2f92', unlocks: [],
    name: 'Clear turns hot pink', equation: 'phenolphthalein + strong base → pink', fact: 'Phenolphthalein looks like water, but in a strong base it turns hot pink. Baking soda is too weak a base to do it. Make a strong base first: drop calcium or lithium into water.',
    magic: { name: 'Flamingo Potion', line: 'Two clear potions make hot pink!' } },
  { id: 'phenolclear', group: 'dye', needs: ['phenolpink', '@acid'], makes: ['saltwater'], effect: 'color', color: '#eaf4ff', unlocks: [],
    name: 'The pink disappears', equation: 'base + acid → salt + water, so phenolphthalein goes clear', fact: 'The acid uses up the base (that is called neutralizing). With no base left, the indicator goes back to clear.',
    magic: { name: 'Vanishing Flamingo', line: 'The pink fades away to nothing!' } },
  { id: 'magicmilk', group: 'dye', needs: ['milk', '@dye', 'soap'], makes: ['magicmilk'], effect: 'color', color: '#f6b9de', unlocks: [],
    name: 'Magic milk', equation: 'milk + food coloring + soap → swirling colors', fact: 'Soap breaks the skin on top of the milk and grabs onto the tiny drops of fat. The milk rushes away from the soap and drags the food coloring into swirls.',
    magic: { name: 'Rainbow Swirl', line: 'The colors dance and swirl all by themselves!' } },
  { id: 'curds', group: 'dye', needs: ['milk', '@acid'], makes: ['curds'], effect: 'cloudy', color: '#fffbe6', unlocks: [],
    name: 'Milk makes curds', equation: 'milk protein (casein) + acid → curds', fact: 'Acid makes the casein protein in milk clump together into white curds. That is the first step in making cheese.',
    magic: { name: 'Cloud Cheese', line: 'The milk clumps into fluffy little clouds!' } },
];
// The 🔥 burner (Build Queue 2026-10-09): heating a beaker. 'heat' is not a bottle, it only starts these.
export const HEAT_RECIPES: Recipe[] = [
  { id: 'makewater', needs: ['H', 'O', 'heat'], makes: ['water'], effect: 'pop', color: '#9fd8ff', unlocks: ['He'],
    name: 'Making water: POP!', equation: '2H₂ + O₂ → 2H₂O', fact: 'Hydrogen and oxygen sit together quietly until a spark or flame. Then they join with a POP and make water. Rockets use this reaction.',
    magic: { name: 'Raindrop Pop', line: 'POP! Two invisible gases turn into real water.' } },
  { id: 'makeco2', needs: ['C', 'O', 'heat'], makes: ['co2'], effect: 'smoke', color: '#bdbdbd', unlocks: ['N'],
    name: 'Burning carbon', equation: 'C + O₂ → CO₂', fact: 'Carbon needs a flame to start burning. Then it joins with oxygen and makes carbon dioxide, an invisible gas.',
    magic: { name: 'Shadow Smoke', line: 'Grey smoke curls up out of the glass.' } },
  { id: 'mgburn', needs: ['Mg', 'O', 'heat'], makes: ['mgo'], effect: 'flash', color: '#ffffff', unlocks: ['Fe'],
    name: 'Burning magnesium', equation: '2Mg + O₂ → 2MgO', fact: 'Magnesium burns with a white light so bright that you should never look right at it.',
    magic: { name: 'Starfire', line: 'A blinding white star flares in the glass!' } },
  { id: 'ammonia', needs: ['N', 'H', 'Fe', 'heat'], makes: ['ammonia', 'Fe'], effect: 'smoke', color: '#eef2ff', unlocks: [],
    name: 'Making ammonia', equation: 'N₂ + 3H₂ → 2NH₃ (iron helps, with heat and pressure)', fact: 'Nitrogen and hydrogen only join with heat, high pressure and iron to help (the Haber process). The ammonia makes fertilizer that feeds plants all over the world.',
    magic: { name: 'Stinky Mist', line: 'A very stinky mist swirls up. Pee-yew!' } },
  { id: 'ironsulfide', needs: ['Fe', 'S', 'heat'], makes: ['fes'], effect: 'glow', color: '#ff9a3c', unlocks: [],
    name: 'Iron and sulfur glow', equation: 'Fe + S → FeS', fact: 'Heated iron and sulfur glow orange and join into a new solid. A magnet can no longer pick it up.',
    magic: { name: 'Ember Stone', line: 'The powder glows like a sleeping ember.' } },
  { id: 'thermite', needs: ['Al', 'rust', 'heat'], makes: ['molteniron'], effect: 'bigboom', color: '#ffb02e', unlocks: [],
    name: 'Thermite!', equation: '2Al + Fe₂O₃ → Al₂O₃ + 2Fe', fact: 'Thermite needs a very hot start, like a burning magnesium ribbon. Then aluminum steals the oxygen from rust so fast it gets hot enough to melt iron. Welders use it on train tracks.',
    magic: { name: 'Phoenix Fire', line: 'Sparks fly like a phoenix being born!' } },
  { id: 'boil', needs: ['water', 'heat'], makes: [], effect: 'smoke', color: '#e3f2fd', unlocks: [],
    name: 'Boiling water', equation: 'H₂O (liquid) + heat → H₂O (gas, steam)', fact: 'At 100 °C water boils and turns into steam, a gas. It is still water, just spread out.',
    magic: { name: 'Cloud Maker', line: 'The water floats away as a puffy cloud!' } },
  { id: 'evaporate', needs: ['saltwater', 'heat'], makes: ['saltcrystals'], effect: 'dissolve', color: '#ffffff', unlocks: [],
    name: 'Getting the salt back', equation: 'salt water + heat → steam + salt crystals', fact: 'Heat turns the water to steam and leaves the salt behind. That is how sea salt is made.',
    magic: { name: 'Mermaid Treasure', line: 'The water vanishes and leaves sparkling crystals!' } },
  { id: 'caramel', needs: ['sugar', 'heat'], makes: ['caramel'], effect: 'color', color: '#b5651d', unlocks: [],
    name: 'Making caramel', equation: 'sugar + heat → caramel + water', fact: 'Heat breaks sugar apart and makes new brown, sweet chemicals. You cannot turn caramel back into sugar.',
    magic: { name: 'Golden Syrup', line: 'The sugar melts into a golden river!' } },
  { id: 'crystals', needs: ['bluewater', 'heat'], makes: ['bluecrystals'], effect: 'dissolve', color: '#2f6fd0', unlocks: [],
    name: 'Growing blue crystals', equation: 'blue copper water + heat → steam + CuSO₄ crystals', fact: 'As the water leaves, the copper sulfate comes back as blue crystals.',
    magic: { name: 'Sapphire Garden', line: 'Blue gems grow in the cauldron!' } },
  { id: 'meltice', needs: ['fes', 'heat'], makes: ['fes'], effect: 'glow', color: '#ff9a3c', unlocks: [],
    name: 'Glowing hot', equation: 'FeS + heat → glowing FeS', fact: 'Very hot solids glow orange, like the coils in a toaster.',
    magic: { name: 'Ember Heart', line: 'The stone glows like a dragon heart.' } },
];
// Safety lines on the dangerous recipes (Build Queue 202 Phase 1 and 203).
const SAFETY: Record<string, string> = {
  sodiumboom: 'Only done by scientists, with a tiny piece, safety glasses and a screen. Never at home.',
  potassiumboom: 'Only done by scientists, with a tiny piece, safety glasses and a screen. Never at home.',
  lithiumfizz: 'Lithium makes a strong base. Scientists wear gloves and safety glasses.',
  makesalt: 'Chlorine gas is poisonous and sodium is very reactive. Only scientists do this, behind a screen.',
  makewater: 'Hydrogen catches fire very easily. Never light hydrogen yourself.',
  hclboom: 'Chlorine is poisonous and this mix explodes in light. Specialist labs only.',
  mgburn: 'Never look straight at burning magnesium. Its light can hurt your eyes.',
  thermite: 'Thermite burns at over 2,000 °C and cannot be put out with water. Experts only.',
  silvercloud: 'Silver nitrate stains skin black. Scientists wear gloves.',
  ironsulfide: 'Heating sulfur makes a gas that hurts lungs. Done in a fume cupboard.',
  ammonia: 'Ammonia gas stings the eyes and lungs. Factories make it, not school labs.',
  toothpastebig: 'Strong hydrogen peroxide burns skin. Schools use a weak one, with gloves and glasses.',
  bleachdye: 'Bleach burns skin and eyes. Grown-ups only, with gloves, and never mixed with other cleaners.',
  bleachacid: 'Never mix bleach with vinegar, lemon or other cleaners. Chlorine gas is poisonous. Specialist labs only.',
  phenolpink: 'Strong bases burn skin. Scientists wear gloves and safety glasses.',
  calciumfizz: 'Calcium makes a strong base in water. Scientists wear gloves and glasses.',
};
for (const r of [...RECIPES, ...HEAT_RECIPES]) if (SAFETY[r.id]) r.safety = SAFETY[r.id];

// Rule-made reactions for all 118 elements (elementLab.ts, Build Queue 201 and 203).
RECIPES.push(...RULE_RECIPES);
HEAT_RECIPES.push(...RULE_HEAT_RECIPES);
export const RECIPE = new Map([...RECIPES, ...HEAT_RECIPES].map((r) => [r.id, r]));
export const BEAKER_MAX = 5;

// Does this beaker hold everything a recipe needs? Tokens (@wet, @acid, @chloride) match any one of their group.
// Returns what is left after the recipe's ingredients are used up, or null.
function take(contents: string[], needs: string[]): string[] | null {
  const left = [...contents];
  // Exact ingredients first, so a token never uses up something a named ingredient needs.
  for (const n of [...needs].sort((x, y) => Number(x.startsWith('@')) - Number(y.startsWith('@')))) {
    if (n === 'heat') continue;
    const i = n.startsWith('@') ? left.findIndex((c) => TOKENS[n]?.includes(c)) : left.indexOf(n);
    if (i < 0) return null;
    left.splice(i, 1);
  }
  return left;
}
// The plain ingredient list for places that do not use tokens (Supernature's Cauldron).
const PLAIN: Record<string, string> = { '@wet': 'water', '@acid': 'vinegar', '@chloride': 'salt', '@dye': 'reddye', '@base': 'bakingsoda', '@strongbase': 'lye' };
export const plainNeeds = (r: Recipe) => r.needs.map((n) => PLAIN[n] ?? n);

// Heat a beaker on the burner: the biggest heat recipe whose ingredients are all inside.
export function heatUp(contents: string[]): MixResult {
  const r = [...HEAT_RECIPES].sort((x, y) => y.needs.length - x.needs.length).find((x) => take(contents, x.needs)) ?? null;
  if (!r) return { contents, reaction: null };
  const left = take(contents, r.needs)!;
  const after = r.effect === 'boom' || r.effect === 'bigboom' ? [] : [...left, ...r.makes];
  return { contents: after, reaction: r };
}

export interface MixResult { contents: string[]; reaction: Recipe | null; full?: boolean; noble?: boolean; radioactive?: string }
const NOBLE_GASES = ['He', 'Ne', 'Ar', 'Kr', 'Xe'];
// Pour one substance into a beaker. The reaction with the most ingredients wins (so peroxide, yeast and soap make
// the giant foam, not just bubbles). A boom empties the beaker. A radioactive element never reacts here: the
// Geiger counter clicks instead.
export function pour(contents: string[], id: string): MixResult {
  if (contents.length >= BEAKER_MAX) return { contents, reaction: null, full: true };
  const next = [...contents, id];
  if (isRadioactive(id)) return { contents: next, reaction: null, radioactive: id };
  const r = [...RECIPES].sort((a, b) => b.needs.length - a.needs.length)
    .find((x) => x.needs.some((n) => n === id || (n.startsWith('@') && TOKENS[n]?.includes(id))) && take(next, x.needs)) ?? null;
  if (!r) return { contents: next, reaction: null, noble: NOBLE_GASES.includes(id) && contents.length > 0 };
  const left = take(next, r.needs)!;
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
