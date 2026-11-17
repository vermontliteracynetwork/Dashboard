// Build Queue 639 (2026-11-17, the students' request, passed on by the teacher): "add all the periodic elements in a form
// like this but no atomic weight or the dot in the right corner. sort in colors of pdf attatched. Students have requested
// adding elements to the alchemy game (give them the ability to drag and drop from a periodic table that can be opened in
// a collapsable, moveable window. they can alwyas be dragged without being unlocked. the goal is that they will mix with
// the things we currently have but also will make new things." Inspiration: the DK Smithsonian "Elements" book, where
// every element has its Forms and its Uses (phosphorus: safety matches, fertilizer, bones; calcium: chalk, sea shells,
// marble, plaster casts). Tiles are colored by chemical group like the PubChem table she sent.
// All 118 are always on the Periodic Table window (never locked, not counted as discoveries). Every one mixes with at
// least one thing: element pairs (H + O = Water), "uses" from the book (P + Wood = Safety Match), and group rules
// (every halogen + Metal = Salt, every alkali metal + Water = Explosion). No weapons, no harm: radioactive elements make
// power plants, space probes and smoke detectors.

export type Family = 'am' | 'ae' | 'tm' | 'pt' | 'md' | 'nm' | 'hg' | 'ng' | 'la' | 'ac';
export const FAMILY_NAMES: Record<Family, string> = {
  am: 'Alkali Metal', ae: 'Alkaline Earth Metal', tm: 'Transition Metal', pt: 'Post-Transition Metal', md: 'Metalloid',
  nm: 'Nonmetal', hg: 'Halogen', ng: 'Noble Gas', la: 'Lanthanide', ac: 'Actinide',
};
export const FAMILY_ORDER: Family[] = ['am', 'ae', 'tm', 'pt', 'md', 'nm', 'hg', 'ng', 'la', 'ac'];

// [atomic number, symbol, name, family]
const RAW: [number, string, string, Family][] = [
  [1,'H','Hydrogen','nm'],[2,'He','Helium','ng'],[3,'Li','Lithium','am'],[4,'Be','Beryllium','ae'],[5,'B','Boron','md'],
  [6,'C','Carbon','nm'],[7,'N','Nitrogen','nm'],[8,'O','Oxygen','nm'],[9,'F','Fluorine','hg'],[10,'Ne','Neon','ng'],
  [11,'Na','Sodium','am'],[12,'Mg','Magnesium','ae'],[13,'Al','Aluminum','pt'],[14,'Si','Silicon','md'],[15,'P','Phosphorus','nm'],
  [16,'S','Sulfur','nm'],[17,'Cl','Chlorine','hg'],[18,'Ar','Argon','ng'],[19,'K','Potassium','am'],[20,'Ca','Calcium','ae'],
  [21,'Sc','Scandium','tm'],[22,'Ti','Titanium','tm'],[23,'V','Vanadium','tm'],[24,'Cr','Chromium','tm'],[25,'Mn','Manganese','tm'],
  [26,'Fe','Iron','tm'],[27,'Co','Cobalt','tm'],[28,'Ni','Nickel','tm'],[29,'Cu','Copper','tm'],[30,'Zn','Zinc','tm'],
  [31,'Ga','Gallium','pt'],[32,'Ge','Germanium','md'],[33,'As','Arsenic','md'],[34,'Se','Selenium','nm'],[35,'Br','Bromine','hg'],
  [36,'Kr','Krypton','ng'],[37,'Rb','Rubidium','am'],[38,'Sr','Strontium','ae'],[39,'Y','Yttrium','tm'],[40,'Zr','Zirconium','tm'],
  [41,'Nb','Niobium','tm'],[42,'Mo','Molybdenum','tm'],[43,'Tc','Technetium','tm'],[44,'Ru','Ruthenium','tm'],[45,'Rh','Rhodium','tm'],
  [46,'Pd','Palladium','tm'],[47,'Ag','Silver','tm'],[48,'Cd','Cadmium','tm'],[49,'In','Indium','pt'],[50,'Sn','Tin','pt'],
  [51,'Sb','Antimony','md'],[52,'Te','Tellurium','md'],[53,'I','Iodine','hg'],[54,'Xe','Xenon','ng'],[55,'Cs','Cesium','am'],
  [56,'Ba','Barium','ae'],[57,'La','Lanthanum','la'],[58,'Ce','Cerium','la'],[59,'Pr','Praseodymium','la'],[60,'Nd','Neodymium','la'],
  [61,'Pm','Promethium','la'],[62,'Sm','Samarium','la'],[63,'Eu','Europium','la'],[64,'Gd','Gadolinium','la'],[65,'Tb','Terbium','la'],
  [66,'Dy','Dysprosium','la'],[67,'Ho','Holmium','la'],[68,'Er','Erbium','la'],[69,'Tm','Thulium','la'],[70,'Yb','Ytterbium','la'],
  [71,'Lu','Lutetium','la'],[72,'Hf','Hafnium','tm'],[73,'Ta','Tantalum','tm'],[74,'W','Tungsten','tm'],[75,'Re','Rhenium','tm'],
  [76,'Os','Osmium','tm'],[77,'Ir','Iridium','tm'],[78,'Pt','Platinum','tm'],[79,'Au','Gold','tm'],[80,'Hg','Mercury','tm'],
  [81,'Tl','Thallium','pt'],[82,'Pb','Lead','pt'],[83,'Bi','Bismuth','pt'],[84,'Po','Polonium','md'],[85,'At','Astatine','hg'],
  [86,'Rn','Radon','ng'],[87,'Fr','Francium','am'],[88,'Ra','Radium','ae'],[89,'Ac','Actinium','ac'],[90,'Th','Thorium','ac'],
  [91,'Pa','Protactinium','ac'],[92,'U','Uranium','ac'],[93,'Np','Neptunium','ac'],[94,'Pu','Plutonium','ac'],[95,'Am','Americium','ac'],
  [96,'Cm','Curium','ac'],[97,'Bk','Berkelium','ac'],[98,'Cf','Californium','ac'],[99,'Es','Einsteinium','ac'],[100,'Fm','Fermium','ac'],
  [101,'Md','Mendelevium','ac'],[102,'No','Nobelium','ac'],[103,'Lr','Lawrencium','ac'],[104,'Rf','Rutherfordium','tm'],[105,'Db','Dubnium','tm'],
  [106,'Sg','Seaborgium','tm'],[107,'Bh','Bohrium','tm'],[108,'Hs','Hassium','tm'],[109,'Mt','Meitnerium','tm'],[110,'Ds','Darmstadtium','tm'],
  [111,'Rg','Roentgenium','tm'],[112,'Cn','Copernicium','tm'],[113,'Nh','Nihonium','pt'],[114,'Fl','Flerovium','pt'],[115,'Mc','Moscovium','pt'],
  [116,'Lv','Livermorium','pt'],[117,'Ts','Tennessine','hg'],[118,'Og','Oganesson','ng'],
];

// Where each one sits on the table (row 8 is the gap above the lanthanide and actinide rows, like the PubChem chart).
function place(z: number): [number, number] {
  if (z === 1) return [1, 1];
  if (z === 2) return [1, 18];
  if (z <= 4) return [2, z - 2];
  if (z <= 10) return [2, z + 8];
  if (z <= 12) return [3, z - 10];
  if (z <= 18) return [3, z];
  if (z <= 36) return [4, z - 18];
  if (z <= 54) return [5, z - 36];
  if (z <= 56) return [6, z - 54];
  if (z <= 71) return [9, z - 53];
  if (z <= 86) return [6, z - 68];
  if (z <= 88) return [7, z - 86];
  if (z <= 103) return [10, z - 85];
  return [7, z - 100];
}

export type PeriodicEl = { id: string; z: number; sym: string; name: string; fam: Family; row: number; col: number };
export const PERIODIC: PeriodicEl[] = RAW.map(([z, sym, name, fam]) => { const [row, col] = place(z); return { id: `el-${sym.toLowerCase()}`, z, sym, name, fam, row, col }; });
export const PERIODIC_BY_ID: Record<string, PeriodicEl> = Object.fromEntries(PERIODIC.map((p) => [p.id, p]));
// As alchemy elements: the picture is "pt:" so the game draws a periodic tile instead of an emoji.
export const PERIODIC_ELEMENTS: [string, string, string][] = PERIODIC.map((p) => [p.id, `pt:${p.id}`, p.name]);

// New things the elements make (Carbon Dioxide, Electric Car and Ore were already in the game). [id, emoji, name]
export const CHEM_ELEMENTS: [string, string, string][] = [
  ["bronze","🥉","Bronze"],["brass","🎺","Brass"],["balloon","🎈","Balloon"],["squeaky-voice","🎈🗣️","Squeaky Voice"],
  ["blimp","🎈✈️","Blimp"],["neon-sign","🪧✨","Neon Sign"],["chalk","🖍️","Writing Chalk"],["seashell","🐚","Sea Shell"],
  ["strong-bones","🦴💪","Strong Bones"],["gypsum","🪨🤍","Gypsum"],["plaster-cast","🩹🦾","Plaster Cast"],["cement","🧱","Cement"],
  ["concrete","🏗️","Concrete"],["marble","🏛️","Marble"],["stalactite","🦇⛰️","Stalactite"],["antacid","💊","Antacid Tablet"],
  ["safety-match","🔥🪵","Safety Match"],["fertilizer","🌱🟤","Fertilizer"],["dna","🧬🔗","DNA"],["fiber-optics","💡🧵","Fiber Optics"],
  ["glow-dark","✨🌙","Glow in the Dark"],["microchip","🔲","Microchip"],["super-magnet","🧲✨","Super Magnet"],
  ["penny","🪙","Penny"],["foil","🌯✨","Aluminum Foil"],["toothpaste","🪥","Toothpaste"],
  ["bleach","🧴","Bleach"],["red-fireworks","🎆🔴","Red Fireworks"],["green-fireworks","🎆🟢","Green Fireworks"],["blue-fireworks","🎆🔵","Blue Fireworks"],
  ["nuclear-power","⚛️🏭","Nuclear Power Plant"],["space-probe","🛰️","Space Probe"],["fishing-sinker","🎣⚫","Fishing Sinker"],["stinky-egg","🥚💨","Stinky Egg Smell"],
  ["iodized-salt","🧂","Iodized Salt"],["sunscreen","🧴☀️","Sunscreen"],["nickel-coin","🪙⚪","Nickel Coin"],["tin-can","🥫","Tin Can"],
  ["cobalt-glass","🔵🫙","Cobalt Blue Glass"],["stainless-steel","🍴","Stainless Steel"],["sparkler","🎇","Sparkler"],["ion-engine","🚀💙","Ion Engine"],
  ["smoke-detector","🚨","Smoke Detector"],["melting-spoon","🥄💧","Melting Spoon"],["atom-poof","⚛️💨","Gone in a Blink"],
  ["lab-glass","🧪🔥","Lab Glassware"],["silver-coin","🪙🥈","Silver Coin"],["gold-medal","🥇","Gold Medal"],["trumpet","🎺🎶","Trumpet"],
  ["rare-earth","🧲📱","Rare Earth Metal"],["x-ray","🩻","X-ray"],["hydrogen-fuel","💧🚀","Hydrogen Fuel"],
];

// What each new thing is, shown when it is discovered (like the feelings meanings).
export const CHEM_FACTS: Record<string, string> = {
  "bronze": "Bronze is copper and tin melted together. People made tools from it over 5,000 years ago.",
  "brass": "Brass is copper and zinc melted together. Trumpets and door knobs are made of it.",
  "balloon": "Helium is lighter than air, so a helium balloon floats up.",
  "squeaky-voice": "Sound moves faster through helium, so a voice sounds high and squeaky.",
  "blimp": "A blimp floats because it is filled with helium.",
  "neon-sign": "Noble gases glow when electricity runs through them. Neon glows red orange.",
  "chalk": "Writing chalk is made from calcium.",
  "seashell": "Sea snails make their hard shells from calcium in sea water.",
  "strong-bones": "Your bones are hardened by calcium. Milk and broccoli have calcium in them.",
  "gypsum": "Gypsum is a soft mineral made of calcium and sulfur.",
  "plaster-cast": "Plaster of Paris is made from gypsum. It hardens to hold a broken bone still while it heals.",
  "cement": "Cement is made with calcium. It turns sand and stone into hard concrete.",
  "concrete": "Concrete is cement, sand, stone and water. Sidewalks and bridges are made of it.",
  "marble": "Marble forms when limestone, a calcium rock, is squeezed and heated deep under the ground.",
  "stalactite": "Water in caves leaves calcium behind, drip by drip. It slowly grows into a stalactite.",
  "antacid": "Antacid tablets have calcium in them. They help settle an upset tummy.",
  "safety-match": "The strip on the side of a match box has phosphorus. It lights the match when you strike it.",
  "fertilizer": "Fertilizer gives plants nitrogen, phosphorus and potassium to help them grow.",
  "dna": "DNA tells your body how to work. Its sides are held together by phosphorus.",
  "fiber-optics": "Fiber optics are thin glass threads that carry light, and the internet, very far.",
  "glow-dark": "Phosphorus means \"giver of light\". White phosphorus glows in the dark.",
  "microchip": "Microchips are made of silicon. Every computer and phone has them.",
  "carbon-dioxide": "Carbon dioxide is carbon and oxygen. You breathe it out, and plants breathe it in.",
  "super-magnet": "Neodymium makes the strongest magnets in the world.",
  "penny": "A penny is coated with copper.",
  "electric-car": "Electric cars run on lithium batteries.",
  "foil": "Aluminum is light and bends easily, so it makes kitchen foil.",
  "toothpaste": "Toothpaste has fluorine in it to keep teeth strong.",
  "bleach": "Bleach has chlorine in it. It cleans and makes things whiter.",
  "red-fireworks": "Strontium makes fireworks glow red.",
  "green-fireworks": "Barium makes fireworks glow green.",
  "blue-fireworks": "Copper makes fireworks glow blue.",
  "nuclear-power": "Uranium and other actinides can make electricity in a nuclear power plant.",
  "space-probe": "Plutonium keeps some space probes powered far from the sun.",
  "fishing-sinker": "Lead is very heavy, so it was used to sink a fishing line.",
  "stinky-egg": "Sulfur is what makes rotten eggs smell stinky.",
  "iodized-salt": "Iodine is added to table salt to help keep people healthy.",
  "sunscreen": "Zinc in sunscreen blocks the sun's rays.",
  "nickel-coin": "A nickel coin is made of nickel and copper.",
  "tin-can": "Tin cans are steel cans coated with tin so they do not rust.",
  "cobalt-glass": "Cobalt turns glass a deep blue.",
  "stainless-steel": "Chromium makes steel stainless, so forks and spoons do not rust.",
  "sparkler": "Magnesium burns with a bright white light.",
  "ion-engine": "Some spaceships push themselves with xenon gas in an ion engine.",
  "smoke-detector": "Many smoke detectors use a tiny bit of americium to sense smoke.",
  "melting-spoon": "Gallium melts at a low heat, so a gallium spoon melts in hot tea.",
  "ore": "Ore is a rock with metal inside. Miners dig it up to get the metal out.",
  "atom-poof": "The heaviest elements only last a tiny part of a second before they change into other elements.",
  "lab-glass": "Boron makes glass that does not crack when it gets hot, like science lab glass.",
  "silver-coin": "Silver has been used to make coins for thousands of years.",
  "gold-medal": "Gold medals are given to the winners.",
  "trumpet": "Trumpets are made of brass.",
  "rare-earth": "Rare earth metals are in phones, screens and magnets.",
  "x-ray": "Doctors use barium to see inside the body on an X-ray.",
  "hydrogen-fuel": "Hydrogen is a rocket fuel. When it burns, it makes only water.",
};

// [a, b, result]
const PAIRS: [string, string, string][] = [
  // Element + element
  ["el-h","el-o","water"],["el-na","el-cl","salt"],["el-c","el-o","carbon-dioxide"],["el-fe","el-c","steel"],["el-cu","el-sn","bronze"],
  ["el-cu","el-zn","brass"],["el-si","el-o","sand"],["el-h","el-he","sun"],["el-o","el-o","oxygen"],["el-ca","el-s","gypsum"],
  ["el-fe","el-o","rust"],["el-c","el-c","diamond"],["el-c","el-h","oil"],["el-cu","el-ni","nickel-coin"],["el-fe","el-cr","stainless-steel"],
  ["el-h","el-h","hydrogen-fuel"],["el-ag","el-ag","silver-coin"],["el-au","el-au","gold"],["el-o","oxygen","ozone"],
  // Hydrogen, helium, carbon, nitrogen, oxygen
  ["el-h","rocket","hydrogen-fuel"],["el-h","star","star"],["el-he","air","balloon"],["el-he","human","squeaky-voice"],["el-he","airplane","blimp"],
  ["balloon","airplane","blimp"],["el-c","wood","pencil"],["el-c","fire","charcoal"],["el-c","earth","coal"],["el-c","life","life"],
  ["carbon-dioxide","plant","oxygen"],["carbon-dioxide","water","soda"],["el-n","air","atmosphere"],["el-n","milk","ice-cream"],
  ["el-o","fire","explosion"],["el-o","water","water"],["el-o","sky","ozone"],
  // Phosphorus (the book's first page)
  ["el-p","wood","safety-match"],["el-p","soil","fertilizer"],["el-n","soil","fertilizer"],["el-k","soil","fertilizer"],["el-p","life","dna"],
  ["el-p","bone","skeleton"],["el-p","night","glow-dark"],["fertilizer","field","wheat"],["safety-match","fire","campfire"],
  // Calcium (the book's second page)
  ["el-ca","stone","chalk"],["el-ca","ocean","seashell"],["el-ca","milk","strong-bones"],["el-ca","bone","strong-bones"],
  ["gypsum","doctor","plaster-cast"],["gypsum","water","plaster-cast"],["el-ca","sand","cement"],["cement","water","concrete"],
  ["concrete","house","skyscraper"],["el-ca","lava","marble"],["marble","human","statue"],["el-ca","cave","stalactite"],["el-ca","doctor","antacid"],
  // Metals and their uses
  ["el-fe","electricity","magnet"],["el-fe","water","rust"],["el-nd","magnet","super-magnet"],["el-cu","money","penny"],["el-cu","electricity","wire"],
  ["el-li","electricity","battery"],["el-li","car","electric-car"],["battery","car","electric-car"],["el-w","glass","lightbulb"],
  ["el-al","paper","foil"],["el-al","sky","airplane"],["el-sn","fish","tin-can"],["el-sn","steel","tin-can"],["el-co","glass","cobalt-glass"],
  ["el-mg","fire","sparkler"],["el-zn","sun","sunscreen"],["el-ni","money","nickel-coin"],["el-ag","glass","mirror"],["el-ag","money","silver-coin"],
  ["el-au","human","gold-medal"],["el-au","ring","ring"],["el-au","crown","crown"],["brass","music","trumpet"],["el-hg","glass","thermometer"],
  ["el-pb","fishing","fishing-sinker"],["el-ga","tea","melting-spoon"],["el-ti","rocket","rocket"],["el-ti","bicycle","bicycle"],
  ["el-pt","ring","ring"],["el-ba","doctor","x-ray"],
  // Nonmetals, halogens and noble gases
  ["el-s","egg","stinky-egg"],["el-s","volcano","stinky-egg"],["el-f","soap","toothpaste"],["el-cl","water","swimming-pool"],["el-cl","soap","bleach"],
  ["el-i","salt","iodized-salt"],["el-ne","glass","neon-sign"],["el-ne","lightbulb","neon-sign"],["el-xe","rocket","ion-engine"],["el-b","glass","lab-glass"],
  ["el-si","electricity","microchip"],["el-si","sun","solar-cell"],["el-si","light","fiber-optics"],["el-si","glass","glass"],
  ["microchip","human","smartphone"],["microchip","tool","computer"],["el-k","fruit","banana"],
  // Fireworks colors
  ["el-sr","explosion","fireworks"],["el-sr","fireworks","red-fireworks"],["el-ba","fireworks","green-fireworks"],["el-cu","fireworks","blue-fireworks"],
  // Radioactive elements make power, not harm
  ["el-u","energy","nuclear-power"],["el-pu","rocket","space-probe"],["el-am","smoke","smoke-detector"],
];

// Group rules so every element mixes with something.
const GROUP: [string, string, string][] = PERIODIC.flatMap((p): [string, string, string][] => {
  const out: [string, string, string][] = [];
  const metal = !['nm', 'hg', 'ng', 'md'].includes(p.fam);
  if (metal) out.push([p.id, 'stone', 'ore'], [p.id, 'fire', 'metal']);
  if (p.fam === 'am') out.push([p.id, 'water', 'explosion']);
  if (p.fam === 'ae') out.push([p.id, 'explosion', 'fireworks']);
  if (p.fam === 'hg') out.push([p.id, 'metal', 'salt']);
  if (p.fam === 'ng') out.push([p.id, 'electricity', 'neon-sign']);
  if (p.fam === 'md') out.push([p.id, 'electricity', 'microchip']);
  if (p.fam === 'la') out.push([p.id, 'magnet', 'super-magnet'], [p.id, 'smartphone', 'rare-earth'], [p.id, 'metal', 'rare-earth']);
  if (p.fam === 'ac') out.push([p.id, 'energy', 'nuclear-power']);
  if (p.z >= 99) out.push([p.id, 'time', 'atom-poof']);
  if (p.fam === 'nm') out.push([p.id, 'life', 'life']);
  return out;
});

export const CHEM_RECIPES: [string, string, string][] = [...PAIRS, ...GROUP];
