import type { PatternId, SpeciesId } from './types';
import type { WardrobeItem } from './wardrobe';

// What students own in Style at the Seamstress, and what everything costs
// (teacher's list, 2026-10-04). Prices are Class Cash cents. The teacher
// always has everything; these rules only apply to students.

export const SPECIES_PRICE = 5000; // the first animal is free, every other one is $50
export const PATTERN_PRICE = 500; // each extra pattern is $5, and then works everywhere

export const FREE_PATTERNS: PatternId[] = ['solid', 'stripes', 'polka'];

export const FREE_ITEMS = new Set([
  'cap', 'beanie', 'partyhat',
  'roundglasses', 'squareglasses',
  'eardefenders',
  'tee', 'tank', 'longsleeve',
  'pants',
  'sneakers',
]);

export const ITEM_PRICES: Record<string, number> = {
  crown: 1000,
  tophat: 600,
  buckethat: 600,
  cheesehat: 1500,
  starglasses: 600,
  heartglasses: 600,
  headphones: 600,
  hoodie: 1000,
  dress: 800,
  shorts: 600,
  skirt: 600,
  boots: 800,
  rainboots: 800,
  backpack: 1000,
  cape: 1000,
  wings: 1200,
};

// A student's Style things, kept in the style_looks table under the
// owner id `inv:<studentId>` (no new database columns needed).
export interface StyleInventory {
  species: SpeciesId[];
  items: string[];
  patterns: PatternId[];
  walkthroughDone: boolean;
}
export const EMPTY_INVENTORY: StyleInventory = { species: [], items: [], patterns: [], walkthroughDone: false };
export const inventoryOwner = (studentId: string) => `inv:${studentId}`;

export function asInventory(x: unknown): StyleInventory {
  const v = (x ?? {}) as Partial<StyleInventory>;
  return {
    species: Array.isArray(v.species) ? v.species : [],
    items: Array.isArray(v.items) ? v.items : [],
    patterns: Array.isArray(v.patterns) ? v.patterns : [],
    walkthroughDone: !!v.walkthroughDone,
  };
}

export const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

export type Lock =
  | { kind: 'buy'; price: number }
  | { kind: 'earn'; label: string };

// Why an item is locked for this student (null = they can use it).
export function itemLock(item: WardrobeItem, inv: StyleInventory, unlockedIds: string[]): Lock | null {
  if (item.unlock) return unlockedIds.includes(item.unlock.id) ? null : { kind: 'earn', label: item.unlock.label };
  if (FREE_ITEMS.has(item.id) || inv.items.includes(item.id)) return null;
  return { kind: 'buy', price: ITEM_PRICES[item.id] ?? 600 };
}
export const patternLocked = (p: PatternId, inv: StyleInventory) => !FREE_PATTERNS.includes(p) && !inv.patterns.includes(p);
export const speciesLocked = (s: SpeciesId, inv: StyleInventory) => inv.species.length > 0 && !inv.species.includes(s);
