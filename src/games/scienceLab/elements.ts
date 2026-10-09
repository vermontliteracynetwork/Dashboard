// The periodic table board on the Science Lab wall (teacher 2026-10-09: "a period table board in the
// background can be clicked"). All 118 elements in the standard layout, with the lanthanides and
// actinides in their own two rows underneath.

const NAMES = 'H Hydrogen,He Helium,Li Lithium,Be Beryllium,B Boron,C Carbon,N Nitrogen,O Oxygen,F Fluorine,Ne Neon,Na Sodium,Mg Magnesium,Al Aluminum,Si Silicon,P Phosphorus,S Sulfur,Cl Chlorine,Ar Argon,K Potassium,Ca Calcium,Sc Scandium,Ti Titanium,V Vanadium,Cr Chromium,Mn Manganese,Fe Iron,Co Cobalt,Ni Nickel,Cu Copper,Zn Zinc,Ga Gallium,Ge Germanium,As Arsenic,Se Selenium,Br Bromine,Kr Krypton,Rb Rubidium,Sr Strontium,Y Yttrium,Zr Zirconium,Nb Niobium,Mo Molybdenum,Tc Technetium,Ru Ruthenium,Rh Rhodium,Pd Palladium,Ag Silver,Cd Cadmium,In Indium,Sn Tin,Sb Antimony,Te Tellurium,I Iodine,Xe Xenon,Cs Cesium,Ba Barium,La Lanthanum,Ce Cerium,Pr Praseodymium,Nd Neodymium,Pm Promethium,Sm Samarium,Eu Europium,Gd Gadolinium,Tb Terbium,Dy Dysprosium,Ho Holmium,Er Erbium,Tm Thulium,Yb Ytterbium,Lu Lutetium,Hf Hafnium,Ta Tantalum,W Tungsten,Re Rhenium,Os Osmium,Ir Iridium,Pt Platinum,Au Gold,Hg Mercury,Tl Thallium,Pb Lead,Bi Bismuth,Po Polonium,At Astatine,Rn Radon,Fr Francium,Ra Radium,Ac Actinium,Th Thorium,Pa Protactinium,U Uranium,Np Neptunium,Pu Plutonium,Am Americium,Cm Curium,Bk Berkelium,Cf Californium,Es Einsteinium,Fm Fermium,Md Mendelevium,No Nobelium,Lr Lawrencium,Rf Rutherfordium,Db Dubnium,Sg Seaborgium,Bh Bohrium,Hs Hassium,Mt Meitnerium,Ds Darmstadtium,Rg Roentgenium,Cn Copernicium,Nh Nihonium,Fl Flerovium,Mc Moscovium,Lv Livermorium,Ts Tennessine,Og Oganesson';

export type ElementFamily = 'alkali' | 'alkaline' | 'transition' | 'post' | 'metalloid' | 'nonmetal' | 'halogen' | 'noble' | 'lanthanide' | 'actinide';
export const FAMILIES: Record<ElementFamily, { name: string; color: string; magic: string }> = {
  alkali: { name: 'Alkali metal', color: '#ff8a80', magic: '#ff6fa8' },
  alkaline: { name: 'Alkaline earth metal', color: '#ffcc80', magic: '#ffb36b' },
  transition: { name: 'Transition metal', color: '#ffe082', magic: '#f7d774' },
  post: { name: 'Other metal', color: '#c5e1a5', magic: '#9be37a' },
  metalloid: { name: 'Metalloid', color: '#80cbc4', magic: '#5fe3cf' },
  nonmetal: { name: 'Nonmetal', color: '#90caf9', magic: '#7fb4ff' },
  halogen: { name: 'Halogen', color: '#b39ddb', magic: '#c89bff' },
  noble: { name: 'Noble gas', color: '#f48fb1', magic: '#ff8ae0' },
  lanthanide: { name: 'Lanthanide', color: '#bcaaa4', magic: '#d0a8ff' },
  actinide: { name: 'Actinide', color: '#cfd8dc', magic: '#a8b8ff' },
};

const ALKALI = [3, 11, 19, 37, 55, 87], ALKALINE = [4, 12, 20, 38, 56, 88], NOBLE = [2, 10, 18, 36, 54, 86, 118];
const HALOGEN = [9, 17, 35, 53, 85, 117], NONMETAL = [1, 6, 7, 8, 15, 16, 34], METALLOID = [5, 14, 32, 33, 51, 52];
function familyOf(n: number, col: number): ElementFamily {
  if (ALKALI.includes(n)) return 'alkali';
  if (ALKALINE.includes(n)) return 'alkaline';
  if (NOBLE.includes(n)) return 'noble';
  if (HALOGEN.includes(n)) return 'halogen';
  if (NONMETAL.includes(n)) return 'nonmetal';
  if (METALLOID.includes(n)) return 'metalloid';
  if (n >= 57 && n <= 71) return 'lanthanide';
  if (n >= 89 && n <= 103) return 'actinide';
  return col >= 3 && col <= 12 ? 'transition' : 'post';
}
// [row, column]: rows 1 to 7 are the periods, 9 and 10 the two rows underneath.
function place(n: number): [number, number] {
  if (n === 1) return [1, 1];
  if (n === 2) return [1, 18];
  if (n <= 10) return [2, n <= 4 ? n - 2 : n + 8];
  if (n <= 18) return [3, n <= 12 ? n - 10 : n];
  if (n <= 36) return [4, n - 18];
  if (n <= 54) return [5, n - 36];
  if (n <= 56) return [6, n - 54];
  if (n <= 71) return [9, n - 54];
  if (n <= 86) return [6, n - 68];
  if (n <= 88) return [7, n - 86];
  if (n <= 103) return [10, n - 86];
  return [7, n - 100];
}
export interface PtElement { n: number; sym: string; name: string; row: number; col: number; family: ElementFamily }
export const PERIODIC: PtElement[] = NAMES.split(',').map((s, i) => {
  const [sym, name] = s.split(' ');
  const [row, col] = place(i + 1);
  return { n: i + 1, sym, name, row, col, family: familyOf(i + 1, col) };
});
export const elementBySym = new Map(PERIODIC.map((e) => [e.sym, e]));

// What each element is used for (the element cards on the board, Build Queue 2026-10-09).
export const ELEMENT_USES: Record<string, string> = {
  H: 'Fuel for rockets and the sun. It is in water.', He: 'Floating balloons and blimps.', Li: 'Phone, tablet and car batteries.', Be: 'Light, strong parts for space telescopes.',
  B: 'Tough glass for baking dishes.', C: 'Pencil lead, diamonds and every living thing.', N: 'Most of the air. Plant food on farms.', O: 'The air we breathe and fire.',
  F: 'Toothpaste that protects teeth.', Ne: 'Glowing red signs.', Na: 'Table salt and street lights.', Mg: 'Fireworks and light bike frames.',
  Al: 'Soda cans, foil and airplanes.', Si: 'Computer chips and sand.', P: 'Match heads and plant food.', S: 'Matches and making rubber tires strong.',
  Cl: 'Keeping pool water clean.', Ar: 'The gas inside light bulbs.', K: 'Bananas, and plant food.', Ca: 'Bones, teeth, chalk and seashells.',
  Ti: 'Strong, light bike parts and airplanes.', Cr: 'Shiny car parts.', Mn: 'Making steel strong.', Fe: 'Steel, nails, bridges and your blood.',
  Co: 'Deep blue paint and glass.', Ni: 'Coins and magnets.', Cu: 'Electric wires and pennies.', Zn: 'Coating steel so it does not rust.',
  Ga: 'A metal that melts in your hand. Used in LED lights.', Ge: 'Lenses for night vision cameras.', As: 'Very poisonous. Used in some computer chips.', Se: 'Solar cells and copy machines.',
  Br: 'A red-brown liquid. Fire safety chemicals.', Kr: 'Bright flash lamps for cameras.', Rb: 'Super accurate atomic clocks.', Sr: 'Red fireworks.',
  Ag: 'Jewelry, mirrors and the best electric wires.', Sn: 'Tin cans (a thin coat inside).', I: 'Cleaning cuts, and it is in salt to keep you healthy.', Xe: 'Bright car headlights.',
  Cs: 'Atomic clocks that keep world time.', Ba: 'Green fireworks.', Nd: 'Super strong magnets in earbuds.', W: 'Light bulb wires and drill tips.',
  Pt: 'Car parts that clean exhaust, and jewelry.', Au: 'Gold jewelry, coins and phone parts.', Hg: 'A liquid metal. Old thermometers.', Pb: 'Heavy and poisonous. Shields from X-rays.',
  Rn: 'A radioactive gas that can build up in basements.', Ra: 'Glowing paint long ago, before people knew it was dangerous.', U: 'Fuel for nuclear power plants.', Pu: 'Power for space probes far from the sun.',
  Am: 'Inside smoke detectors.', Es: 'Named after Albert Einstein.', Og: 'The heaviest element ever made. It lasts less than a second.',
};
