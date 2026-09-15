#!/usr/bin/env node
// Generates the master marketplace-classification chart for every asset in
// public/world/asset-manifest.json, applying Claudia's classification
// ruleset (cross-game research: Webkinz, Minecraft/Minecraft Education,
// Sims 4, Club Penguin, Blooket, Legends of Learning, Baamboozle) on top of
// the existing size-class/collision system already shipped in
// WorldEditor.tsx (SIZE_CLASS_TARGET/SIZE_CLASS_KEYWORDS/classifySizeForLabel/
// COLLIDING_CATEGORIES/CATEGORY_TO_GROUP — ported here verbatim rather than
// reinvented, so this chart never drifts from what the app actually does).
// Run: node scripts/generate-master-asset-chart.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const CHARACTER_HEIGHT = 1.745;
const KAYDEN_UNIT = CHARACTER_HEIGHT / 2;

// --- ported verbatim from WorldEditor.tsx (see that file for the full
// reasoning comments behind every number/keyword) ---
const SIZE_CLASS_TARGET = {
  tiny: KAYDEN_UNIT * 0.25,
  smallObject: KAYDEN_UNIT * 0.5,
  furniture: KAYDEN_UNIT * 1,
  tallFurniture: CHARACTER_HEIGHT,
  personScale: CHARACTER_HEIGHT,
  pole: KAYDEN_UNIT * 5,
  smallStructure: KAYDEN_UNIT * 6,
  largeStructure: CHARACTER_HEIGHT * 4.5,
  cityStructure: CHARACTER_HEIGHT * 9,
};

const SIZE_CLASS_KEYWORDS = [
  { cls: 'tiny', pattern: /\b(cup|mug|bowl|bottle\b|plate|spike|card\b|coin|fork|spoon|knife|bacon|bread|burger|receipt|blender|drone|beacon|bag|avocado|cucumber|tomato|carrot|corn\b|lettuce|cheese|banana|pepper|onion|potato|strawberry|grape|melon|pumpkin|egg|sausage|steak|pizza|donut|cookie|cake|pie|taco|sandwich|fries|noodle|sushi|watermelon|pineapple|broccoli|mushroom)/i },
  { cls: 'smallObject', pattern: /\b(basket|sack|box|register|drawer|bin|trashcan|houseplant|birdbath|feeder|pot|planter|cash|checkout|charger|module|compressor|crystal|fryer|hydrant|backpack|canister|target)/i },
  { cls: 'furniture', pattern: /\b(chair|stool|bench|sofa|couch|table|desk|shelf|barrel|crate|cauldron|chest|awning|parasol|booth|seat|stand|rack|cabinet|mold|sphere|roof|floor|bed|washing|toilet|sink|bathtub|shower|tub|mirror)/i },
  { cls: 'tallFurniture', pattern: /\b(bookcase|bookshelf|wardrobe|door|window|fireplace)/i },
  { cls: 'personScale', pattern: /\b(sign|post|cone|fence|pillar|flag|ladder|column|curtain)/i },
  { cls: 'pole', pattern: /\blight\b/i },
  { cls: 'smallStructure', pattern: /\b(stall|shed|cottage|hut|coop|cold\s*frame)/i },
  { cls: 'cityStructure', pattern: /\bskyscraper\b/i },
  { cls: 'largeStructure', pattern: /\bhouse\b|\bbarn\b|castle\s*(wall|gate)|\binn\b|manor/i },
];
const SIZE_CLASS_OVERRIDE = {
  'Boat Row Large': 'smallStructure',
  'Boat Row Small': 'furniture',
  'Back Bar A': 'furniture',
  'Detail Overhang': 'furniture',
  'Detail Overhang Wide': 'furniture',
};
function classifySizeForLabel(label, category) {
  if (SIZE_CLASS_OVERRIDE[label]) return SIZE_CLASS_OVERRIDE[label];
  if (category === 'interior' && /^light\s/i.test(label)) return 'smallObject';
  if (/\blow\b/i.test(label) && /\bcolumn\b/i.test(label)) return 'smallObject';
  if (category === 'creatures' && /mushroom/i.test(label)) return null;
  for (const { cls, pattern } of SIZE_CLASS_KEYWORDS) {
    if (pattern.test(label)) return cls;
  }
  return null;
}

const CATEGORY_SCALE_TARGET = {
  city: CHARACTER_HEIGHT * 0.8, buildings: CHARACTER_HEIGHT * 4.5, structures: CHARACTER_HEIGHT * 2.5,
  restaurant: CHARACTER_HEIGHT * 0.8, suburb: CHARACTER_HEIGHT * 4.5, 'quaternius-buildings': CHARACTER_HEIGHT * 8,
  'commercial-buildings': CHARACTER_HEIGHT * 4.5, market: CHARACTER_HEIGHT * 3, interior: CHARACTER_HEIGHT * 1,
  forest: CHARACTER_HEIGHT * 5.5, farm: CHARACTER_HEIGHT * 3, camping: CHARACTER_HEIGHT * 1.5, food: CHARACTER_HEIGHT * 0.15,
  creatures: CHARACTER_HEIGHT * 0.8, pets: CHARACTER_HEIGHT * 0.6, aquarium: CHARACTER_HEIGHT * 0.4, water: CHARACTER_HEIGHT * 0.8,
  resources: CHARACTER_HEIGHT * 0.8, halloween: CHARACTER_HEIGHT * 1.3, holiday: CHARACTER_HEIGHT * 1.3, fantasy: CHARACTER_HEIGHT * 3,
  japan: CHARACTER_HEIGHT * 2.5, pirate: CHARACTER_HEIGHT * 1.5, scifi: CHARACTER_HEIGHT * 2, platformer: CHARACTER_HEIGHT * 1,
  characters: CHARACTER_HEIGHT * 1, props: CHARACTER_HEIGHT * 0.8, prototype: CHARACTER_HEIGHT * 1, toolsbits: CHARACTER_HEIGHT * 0.5,
  misc: CHARACTER_HEIGHT * 0.8,
};
const DEFAULT_SCALE_TARGET_HEIGHT = CHARACTER_HEIGHT;

const COLLIDING_CATEGORIES = new Set([
  'buildings', 'city', 'interior', 'market', 'restaurant', 'structures', 'props', 'prototype', 'toolsbits',
  'misc', 'suburb', 'quaternius-buildings', 'commercial-buildings',
]);
function defaultCollidesForCategory(category) { return COLLIDING_CATEGORIES.has(category); }

const CATEGORY_TO_GROUP = {
  aquarium: 'Nature & Animals', camping: 'Nature & Animals', creatures: 'Nature & Animals', fall: 'Nature & Animals', farm: 'Nature & Animals', food: 'Nature & Animals', forest: 'Nature & Animals', pets: 'Nature & Animals', water: 'Nature & Animals', resources: 'Nature & Animals',
  buildings: 'Buildings & Places', city: 'Buildings & Places', interior: 'Buildings & Places', market: 'Buildings & Places', restaurant: 'Buildings & Places', roads: 'Buildings & Places', structures: 'Buildings & Places', suburb: 'Buildings & Places', 'quaternius-buildings': 'Buildings & Places', 'commercial-buildings': 'Buildings & Places',
  fantasy: 'Seasonal & Themed', halloween: 'Seasonal & Themed', holiday: 'Seasonal & Themed', japan: 'Seasonal & Themed', pirate: 'Seasonal & Themed', scifi: 'Seasonal & Themed', platformer: 'Seasonal & Themed',
  characters: 'Characters',
  props: 'Props & Tools', prototype: 'Props & Tools', toolsbits: 'Props & Tools', misc: 'Props & Tools',
};

// --- Claudia's ruleset (see subagent report) applied on top of the above ---
const SEASONAL_CATEGORIES = new Set(['halloween', 'holiday', 'japan', 'pirate', 'scifi', 'fantasy']);
const EXCLUDED_CATEGORIES = new Set(['platformer', 'prototype']); // level-geometry/greybox, never a collectible
const PET_CREATURE_CATEGORIES = new Set(['pets', 'creatures']);
const SIZE_BASE_PRICE_CENTS = {
  tiny: 50, smallObject: 150, furniture: 500, tallFurniture: 600, personScale: 800,
  pole: 1000, smallStructure: 2000, largeStructure: 3500, cityStructure: 5000,
};
const SPECIALTY_MULTIPLIER = 1.25;
const NECESSITY_FREE_RE = /\b(door|window|bookcase|bookshelf|wardrobe|fireplace)\b/i; // tallFurniture keyword group, 'interior' only — Sims 4 lot-requirement precedent
const SPIN_HOUSEPLANT_RE = /\b(houseplant|planter)\b/i;
const ANIMATED_INTERACT_RE = /\b(tv|television|fireplace)\b/i;
const REGISTER_RE = /\b(register|checkout)\b/i;

function fallbackSizeClassFromCategoryHeight(category) {
  const h = CATEGORY_SCALE_TARGET[category] ?? DEFAULT_SCALE_TARGET_HEIGHT;
  if (h <= CHARACTER_HEIGHT * 0.3) return 'tiny';
  if (h <= CHARACTER_HEIGHT * 0.6) return 'smallObject';
  if (h <= CHARACTER_HEIGHT * 1.2) return 'furniture';
  if (h <= CHARACTER_HEIGHT * 3) return 'personScale';
  if (h <= CHARACTER_HEIGHT * 6) return 'largeStructure';
  return 'cityStructure';
}

function classify(asset) {
  const { label, category } = asset;
  const group = CATEGORY_TO_GROUP[category] ?? 'Other';
  let explicitSizeClass = classifySizeForLabel(label, category);
  // Double-check catch (not in classifySizeForLabel itself, since that
  // function is ported verbatim from the shipped app): WorldEditor.tsx's
  // own 'structures' comment (lines 137-145) says ~9 "Pack X" items
  // (PackHouse/Bank/Hospital/Shop/Flat) are whole pre-assembled buildings,
  // not kit parts — "Pack House" hits the largeStructure \bhouse\b keyword
  // by luck, but "Pack Bank"/"Pack Hospital"/"Pack Flat"/"Pack Flat2" match
  // no keyword at all and were falling through to a generic category-height
  // fallback (~$8, mid-tier), pricing a whole building like a fence post.
  // Same label-prefix signal the app's own comment already uses.
  if (!explicitSizeClass && category === 'structures' && /^pack\b/i.test(label)) explicitSizeClass = 'largeStructure';
  const sizeClassSource = explicitSizeClass ? 'keyword' : 'category-fallback';
  const sizeClass = explicitSizeClass ?? fallbackSizeClassFromCategoryHeight(category);
  const targetHeightUnits = explicitSizeClass ? SIZE_CLASS_TARGET[explicitSizeClass] : (CATEGORY_SCALE_TARGET[category] ?? DEFAULT_SCALE_TARGET_HEIGHT);

  // Walkable vs solid (Claudia §5): category default, overridden true for
  // structural size classes regardless of category, EXCEPT pets/creatures
  // (a live pet must never be a solid obstacle) and roads (never overridden).
  const structuralBySize = sizeClass === 'smallStructure' || sizeClass === 'largeStructure' || sizeClass === 'cityStructure';
  const collides = category === 'roads'
    ? false
    : PET_CREATURE_CATEGORIES.has(category)
      ? false
      : (defaultCollidesForCategory(category) || structuralBySize);

  // Marketplace pricing (Claudia §2)
  const isRoad = category === 'roads';
  const isModularKitPart = category === 'structures' && /^modular\b/i.test(label);
  const marketplaceEligible = !EXCLUDED_CATEGORIES.has(category);
  let priceCents = null;
  let priceTier = 'excluded';
  if (marketplaceEligible) {
    if (isRoad) {
      priceCents = 0;
      priceTier = 'free-infrastructure';
    } else if (category === 'interior' && NECESSITY_FREE_RE.test(label)) {
      priceCents = 0;
      priceTier = 'free-starter (one per student — Sims4 lot-requirement precedent)';
    } else {
      let base = SIZE_BASE_PRICE_CENTS[sizeClass];
      let mult = 1.0;
      if (PET_CREATURE_CATEGORIES.has(category)) mult = 2.5;
      else if (isModularKitPart) mult = 0.6;
      else if (SEASONAL_CATEGORIES.has(category)) mult = SPECIALTY_MULTIPLIER;
      priceCents = Math.round(base * mult);
      priceTier = 'paid';
    }
  }

  // Daily spin wheel eligibility (Claudia §3) — allowlist, not denylist
  const spinWheelEligible = marketplaceEligible && (
    PET_CREATURE_CATEGORIES.has(category) || category === 'aquarium' || category === 'farm' ||
    (category === 'interior' && SPIN_HOUSEPLANT_RE.test(label))
  );

  // Interactable / animation (Claudia §4)
  let interactable = false;
  let needsNewAnimation = false;
  let interactNote = '';
  if (PET_CREATURE_CATEGORIES.has(category)) {
    interactable = true; needsNewAnimation = true;
    interactNote = 'caretaking loop (feed/pet/play) — no animation clips exist in manifest today, real new production work';
  } else if (category === 'interior' && ANIMATED_INTERACT_RE.test(label)) {
    interactable = true; needsNewAnimation = true;
    interactNote = 'needs an animated material/shader (flicker/play) not present today';
  } else if ((category === 'market' || category === 'restaurant') && REGISTER_RE.test(label)) {
    interactable = true; needsNewAnimation = true;
    interactNote = 'a visible checkout action needs new animation';
  } else if (category === 'food' || category === 'resources' || category === 'toolsbits') {
    interactable = true; needsNewAnimation = false;
    interactNote = 'static click-to-collect, same pattern as joke-card pickup';
  } else if (sizeClass === 'tiny' || sizeClass === 'smallObject') {
    interactable = true; needsNewAnimation = false;
    interactNote = 'static click-to-collect';
  } else {
    interactNote = 'placed decoration only, not clickable';
  }

  return {
    path: asset.path, label, category, group, sizeClass, sizeClassSource,
    targetHeightUnits: targetHeightUnits.toFixed(3),
    walkableOrSolid: collides ? 'solid (blocks movement)' : 'walkable (walk-through)',
    marketplaceEligible: marketplaceEligible ? 'yes' : 'no (level-geometry/greybox — not a collectible)',
    priceCents: priceCents === null ? '' : priceCents,
    priceDollars: priceCents === null ? '' : (priceCents / 100).toFixed(2),
    priceTier,
    spinWheelEligible: spinWheelEligible ? 'yes' : 'no',
    interactable: interactable ? 'yes' : 'no',
    needsNewAnimation: needsNewAnimation ? 'yes' : 'no',
    interactNote,
  };
}

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const manifest = JSON.parse(readFileSync(path.join(root, 'public/world/asset-manifest.json'), 'utf8'));
const assets = manifest.assets;
const columns = [
  'path', 'label', 'category', 'group', 'sizeClass', 'sizeClassSource', 'targetHeightUnits',
  'walkableOrSolid', 'marketplaceEligible', 'priceCents', 'priceDollars', 'priceTier',
  'spinWheelEligible', 'interactable', 'needsNewAnimation', 'interactNote',
];
const rows = assets.map(classify);
const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => csvEscape(r[c])).join(','))].join('\n');
writeFileSync(path.join(root, 'master-asset-chart.csv'), csv);

// Summary counts for a sanity check
const byCategory = {};
for (const r of rows) {
  byCategory[r.category] = byCategory[r.category] || { count: 0, marketplace: 0, spin: 0, solid: 0, interactable: 0 };
  byCategory[r.category].count++;
  if (r.marketplaceEligible === 'yes') byCategory[r.category].marketplace++;
  if (r.spinWheelEligible === 'yes') byCategory[r.category].spin++;
  if (r.walkableOrSolid.startsWith('solid')) byCategory[r.category].solid++;
  if (r.interactable === 'yes') byCategory[r.category].interactable++;
}
console.log('Total assets:', rows.length);
console.table(byCategory);
