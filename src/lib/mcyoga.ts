// McYoga, the second restaurant (Build Queue 600). Her words: "students after level 7 can purchase a new Restaurant.
// they can toggle between restaurants when they have more than one, but the restaurant they arent playing in should be
// closed. new restaruant can have Walk in fridge with unlimited storage purchased. restaurant called McYoga. McYoga, at
// level one, should not have the main tutorial, but should instead start at what the first restaurants level 3
// (starting at level 3 difficulty). McYoga has the ability for students to create, update, edit, and save the menu ...
// Menus at level one can have one appetizer, two entrees, and one dessert. in marketplace, students can buy more menu
// spots ... npcs purchase from menu. students can set prices. though default for appetizers should be $2-10 (avg $5),
// entrees should be $8-20 (avg $10-15), desserts should be $5-15 (avg. $8-10). student can set any price though
// warnings/reccomnedations should be added for averages. prices can be brought down if npcs arent buying things.
// player can start sales. lets have more control for the general economy of mcyoga that is an improvement over the
// original restaruant."
//
// This file is the menu and the economy: the dishes, the usual price ranges, how much each dish costs to make, how
// much customers want a dish at a price (demand), and the price advice shown while the student edits the menu.

export type Course = 'app' | 'ent' | 'des';
export interface CourseDef { id: Course; name: string; plural: string; min: number; max: number; usual: string; slots0: number; slotsMax: number }
export const COURSES: CourseDef[] = [
  { id: 'app', name: 'Appetizer', plural: 'Appetizers', min: 2, max: 10, usual: 'about $5', slots0: 1, slotsMax: 3 },
  { id: 'ent', name: 'Entree', plural: 'Entrees', min: 8, max: 20, usual: 'about $10 to $15', slots0: 2, slotsMax: 5 },
  { id: 'des', name: 'Dessert', plural: 'Desserts', min: 5, max: 15, usual: 'about $8 to $10', slots0: 1, slotsMax: 4 },
];
export const courseOf = (c: Course) => COURSES.find((x) => x.id === c)!;

// Every dish McYoga can put on its menu. All of them are open from the start (her words: "all options unlocked").
// `avg` is the usual price; `cost` is what the ingredients for one cost (paid when the oven starts a batch); `pop` is how
// popular the dish is at its usual price (1 is normal).
export interface Dish { course: Course; avg: number; cost: number; pop: number }
export const DISHES: Record<string, Dish> = {
  rings: { course: 'app', avg: 5, cost: 1, pop: 1.1 },
  gyoza: { course: 'app', avg: 6, cost: 2, pop: 1 },
  bun: { course: 'app', avg: 4, cost: 1, pop: 0.9 },
  riceball: { course: 'app', avg: 3, cost: 1, pop: 0.9 },
  salad: { course: 'app', avg: 5, cost: 2, pop: 0.8 },
  burger: { course: 'ent', avg: 12, cost: 4, pop: 1.3 },
  vburger: { course: 'ent', avg: 12, cost: 4, pop: 1 },
  ramen: { course: 'ent', avg: 14, cost: 5, pop: 1.1 },
  udon: { course: 'ent', avg: 13, cost: 4, pop: 0.9 },
  sroll: { course: 'ent', avg: 15, cost: 6, pop: 0.9 },
  stew: { course: 'ent', avg: 11, cost: 4, pop: 0.8 },
  dinner: { course: 'ent', avg: 18, cost: 7, pop: 0.9 },
  eggs: { course: 'ent', avg: 10, cost: 3, pop: 1 },
  croissant: { course: 'app', avg: 4, cost: 1, pop: 0.9 },
  // Low Poly Fast Food Vol.2 (her pack, Build Queue 603).
  fries: { course: 'app', avg: 4, cost: 1, pop: 1.4 },
  nuggets: { course: 'app', avg: 6, cost: 2, pop: 1.3 },
  drums: { course: 'app', avg: 7, cost: 2, pop: 1 },
  dcheese: { course: 'ent', avg: 15, cost: 5, pop: 1.3 },
  csand: { course: 'ent', avg: 12, cost: 4, pop: 1.1 },
  hotdog: { course: 'ent', avg: 9, cost: 3, pop: 1.1 },
  burrito: { course: 'ent', avg: 11, cost: 4, pop: 1 },
  taco: { course: 'ent', avg: 10, cost: 3, pop: 1 },
  icecream: { course: 'des', avg: 5, cost: 1, pop: 1.3 },
  shake: { course: 'des', avg: 7, cost: 2, pop: 1.2 },
  // Desserts: Tiny Treats Baked Goods (her pack, Build Queue 602) and the rainbow dango.
  dango: { course: 'des', avg: 8, cost: 2, pop: 1 },
  cupcake: { course: 'des', avg: 8, cost: 2, pop: 1.2 },
  donut: { course: 'des', avg: 6, cost: 2, pop: 1.2 },
  cdonut: { course: 'des', avg: 7, cost: 2, pop: 1.1 },
  cookie: { course: 'des', avg: 5, cost: 1, pop: 1.1 },
  muffin: { course: 'des', avg: 7, cost: 2, pop: 1 },
  waffle: { course: 'des', avg: 9, cost: 3, pop: 1 },
  cinroll: { course: 'des', avg: 8, cost: 2, pop: 1 },
  scake: { course: 'des', avg: 10, cost: 3, pop: 1.1 },
  ccake: { course: 'des', avg: 10, cost: 3, pop: 1.2 },
  bcake: { course: 'des', avg: 12, cost: 4, pop: 1 },
  apie: { course: 'des', avg: 9, cost: 3, pop: 1 },
  cpie: { course: 'des', avg: 9, cost: 3, pop: 0.9 },
};
export const dishesIn = (c: Course) => Object.keys(DISHES).filter((k) => DISHES[k].course === c);

export type McMenu = Record<Course, string[]>;
export const MENU0: McMenu = { app: ['fries'], ent: ['burger', 'ramen'], des: ['icecream'] };
export const menuList = (m: McMenu) => [...m.app, ...m.ent, ...m.des];
export const priceOf = (prices: Record<string, number> | undefined, d: string) => prices?.[d] ?? DISHES[d]?.avg ?? 10;

// A menu spot costs more each time (Shop, "Menu spots").
export const slotCost = (c: Course, have: number) => (c === 'ent' ? 600 : 400) * (have - courseOf(c).slots0 + 1);

// The walk-in fridge (her words: "Walk in fridge with unlimited storage purchased").
// It costs a lot and opens at McYoga level 5 (Build Queue 607).
export const WALKIN_COST = 15000;
// Opening McYoga from the first restaurant's Shop.
export const MCYOGA_COST = 5000;
export const MCYOGA_LEVEL = 7;
// McYoga level 1 plays like the first restaurant's level 3.
export const MCYOGA_OFFSET = 2;

// Demand: how much customers want a dish at a price, next to its usual price. At the usual price it is 1. Cheaper is
// wanted more (up to 2.2 when it is nearly free); dearer is wanted less, and at nearly twice the usual price almost
// nobody buys it.
export function appeal(price: number, avg: number) {
  const r = price / Math.max(0.01, avg);
  return r <= 1 ? Math.min(2.2, 1 + (1 - r) * 1.2) : Math.max(0.02, 1 - (r - 1) * 1.25);
}

// The advice under each price while editing the menu.
export type Tone = 'good' | 'low' | 'high' | 'loss';
export function priceAdvice(d: string, price: number): { tone: Tone; text: string } {
  const dish = DISHES[d], c = courseOf(dish.course);
  if (price <= dish.cost) return { tone: 'loss', text: `It costs $${dish.cost} to make one, so you lose money on every sale. Try $${dish.avg}.` };
  if (price > c.max) return { tone: 'high', text: `Most restaurants charge $${c.min} to $${c.max} for ${c.plural.toLowerCase()}. ${appeal(price, dish.avg) < 0.35 ? 'Very few' : 'Fewer'} customers will buy it at $${price}.` };
  if (price > dish.avg * 1.3) return { tone: 'high', text: `Higher than usual ($${dish.avg}). Fewer customers will buy it.` };
  if (price < c.min) return { tone: 'low', text: `Lower than most restaurants ($${c.min} to $${c.max}). Customers love it, but you keep less of each sale.` };
  if (price < dish.avg * 0.75) return { tone: 'low', text: `A bargain. Lots of customers will buy it, but you earn less on each one.` };
  return { tone: 'good', text: `A fair price. Usual for this dish is $${dish.avg}.` };
}

// A tip for the "How it is selling" report: which dishes need a lower price.
export function sellingTip(d: string, price: number, sold: number, walked: number) {
  const dish = DISHES[d];
  if (walked >= 2 && walked >= sold) return `${walked} customers said it costs too much. Try a lower price, like $${dish.avg}, or start a sale.`;
  if (!sold && price > dish.avg) return `Nobody bought it yet. A lower price or a sale could help.`;
  if (price <= dish.cost) return `You lose money on each one. Raise the price above $${dish.cost}.`;
  if (sold >= 5 && price < dish.avg) return `It sells well. You could raise the price a little.`;
  return '';
}

// Sales the student can start (her words: "player can start sales").
export const SALE_OFFS = [10, 25, 50];
export const SALE_MS = 3 * 60 * 1000;
