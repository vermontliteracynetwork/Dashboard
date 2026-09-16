// The pets system's static catalog — every adoptable pet type, its model,
// price, and category. Per direct teacher spec: every pet here is
// available to every student (no per-student scarcity) unless a future
// teacher tool specifically gifts or locks one — that's not built yet,
// see docs/ASSET_PIPELINE.md-adjacent notes in the commit this shipped in.

export type PetCategory = 'dog' | 'cat' | 'small' | 'farm' | 'bird' | 'aquatic' | 'wild' | 'fun';
export type PetRarity = 'common' | 'uncommon' | 'rare' | 'ultra';

// Category -> rarity, matching the price tiers the catalog already uses —
// small/aquatic critters are cheapest and most common, wild/fun pets are
// the priciest and rarest. Used by the Mystery Adoption Box (Claudia's
// plan) to weight pulls; every category still keeps its own real price for
// direct-purchase/daily-spin, unaffected by this.
const CATEGORY_RARITY: Record<PetCategory, PetRarity> = {
  small: 'common',
  aquatic: 'common',
  dog: 'uncommon',
  cat: 'uncommon',
  farm: 'uncommon',
  bird: 'uncommon',
  wild: 'rare',
  fun: 'ultra',
};

export interface PetDef {
  id: string;
  name: string;
  modelPath: string;
  priceCents: number;
  category: PetCategory;
}

// Rarity is fully derived from category (see CATEGORY_RARITY above) rather
// than stored per-entry — one place to keep in sync instead of 37.
export function rarityFor(pet: PetDef): PetRarity {
  return CATEGORY_RARITY[pet.category];
}

// Real rendered picture of the actual model — same offline-generated PNGs
// and slug rule Build Mode's own AssetThumb uses (WorldEditor.tsx), so a
// pet's shelter/journal card shows an actual photo-like image of that pet,
// not just an icon. Not guaranteed to exist for every model; every render
// site falls back to a plain paw icon on a 404 rather than a broken image.
export function thumbnailFor(pet: PetDef): string {
  return '/world/thumbnails/' + pet.modelPath.replace(/^\/world\/models\//, '').replace(/\.(glb|gltf)$/, '').replace(/[/\s]/g, '_') + '.png';
}

export const PET_OWNERSHIP_CAP = 4; // direct teacher spec: "Students can have up to 4 pets each"

// Task completions logged (via trainingProgress) before a pet unlocks
// "walk beside you" — direct teacher spec: training comes from finishing
// assignments/question sets, not from care actions.
export const PET_FOLLOW_TRAINING_THRESHOLD = 5;

// Soft-decay tuning: stats only fall while a student is actively in Town
// Square (a real setInterval there, never a background/away timer — see
// TownSquare.tsx's petDecayTick), floored so a pet is never neglected to
// zero. "Pets never die," per spec.
export const PET_STAT_FLOOR = 20;
export const PET_DECAY_TICK_MS = 3 * 60 * 1000; // every 3 real minutes of active play
export const PET_DECAY_AMOUNT = 4;

// Every pet model ever shipped, dogs/cats and the wider animal roster and
// the non-animal "fun" characters alike. Kept as the full lookup table (see
// petDefById below) so a pet a student already owns from before this
// restriction shipped still resolves correctly in Home Room/My Stuff —
// nothing already adopted disappears or breaks.
const PET_CATALOG_ALL: PetDef[] = [
  // Dogs
  { id: 'pet-dog', name: 'Dog', modelPath: '/world/models/pets/animal-dog.glb', priceCents: 15000, category: 'dog' },
  { id: 'pet-pug', name: 'Pug', modelPath: '/world/models/pets/animal-pug.glb', priceCents: 18000, category: 'dog' },
  { id: 'pet-husky', name: 'Husky', modelPath: '/world/models/pets/animal-husky.glb', priceCents: 20000, category: 'dog' },
  { id: 'pet-poodle', name: 'Poodle', modelPath: '/world/models/pets/animal-poodle.glb', priceCents: 20000, category: 'dog' },
  { id: 'pet-beagle', name: 'Beagle', modelPath: '/world/models/pets/animal-beagle.glb', priceCents: 18000, category: 'dog' },
  { id: 'pet-great-dane', name: 'Great Dane', modelPath: '/world/models/pets/animal-great-dane.glb', priceCents: 22000, category: 'dog' },
  { id: 'pet-shiba-inu', name: 'Shiba Inu', modelPath: '/world/models/pets/animal-shiba-inu.glb', priceCents: 20000, category: 'dog' },
  { id: 'pet-blob-dog', name: 'Blob Dog', modelPath: '/world/models/creatures/blob-dog.glb', priceCents: 15000, category: 'dog' },
  { id: 'pet-dog-pink', name: 'Pink Dog', modelPath: '/world/models/pets/animal-dog-pink.glb', priceCents: 16000, category: 'dog' },

  // Cats
  { id: 'pet-cat', name: 'Cat', modelPath: '/world/models/pets/animal-cat.glb', priceCents: 15000, category: 'cat' },
  { id: 'pet-cat-2', name: 'Tabby Cat', modelPath: '/world/models/pets/animal-cat-2.glb', priceCents: 15000, category: 'cat' },
  { id: 'pet-blob-cat', name: 'Blob Cat', modelPath: '/world/models/creatures/blob-cat.glb', priceCents: 15000, category: 'cat' },

  // Small critters
  { id: 'pet-hamster', name: 'Hamster', modelPath: '/world/models/pets/animal-hamster.glb', priceCents: 13000, category: 'small' },
  { id: 'pet-bunny', name: 'Bunny', modelPath: '/world/models/pets/animal-bunny.glb', priceCents: 15000, category: 'small' },
  { id: 'pet-bunny-2', name: 'Fluffy Bunny', modelPath: '/world/models/pets/animal-bunny-2.glb', priceCents: 15000, category: 'small' },
  { id: 'pet-beaver', name: 'Beaver', modelPath: '/world/models/pets/animal-beaver.glb', priceCents: 17000, category: 'small' },
  { id: 'pet-bee', name: 'Bee', modelPath: '/world/models/pets/animal-bee.glb', priceCents: 12000, category: 'small' },
  { id: 'pet-caterpillar', name: 'Caterpillar', modelPath: '/world/models/pets/animal-caterpillar.glb', priceCents: 12000, category: 'small' },
  { id: 'pet-crab', name: 'Crab', modelPath: '/world/models/pets/animal-crab.glb', priceCents: 14000, category: 'small' },
  { id: 'pet-chick', name: 'Chick', modelPath: '/world/models/pets/animal-chick.glb', priceCents: 14000, category: 'small' },

  // Farm
  { id: 'pet-cow', name: 'Cow', modelPath: '/world/models/pets/animal-cow.glb', priceCents: 25000, category: 'farm' },
  { id: 'pet-pig', name: 'Pig', modelPath: '/world/models/pets/animal-pig.glb', priceCents: 20000, category: 'farm' },
  { id: 'pet-hog', name: 'Hog', modelPath: '/world/models/pets/animal-hog.glb', priceCents: 22000, category: 'farm' },

  // Birds
  { id: 'pet-parrot', name: 'Parrot', modelPath: '/world/models/pets/animal-parrot.glb', priceCents: 22000, category: 'bird' },
  { id: 'pet-parrot-2', name: 'Tropical Parrot', modelPath: '/world/models/pets/animal-parrot-2.glb', priceCents: 22000, category: 'bird' },
  { id: 'pet-duck', name: 'Duck', modelPath: '/world/models/pets/animal-duck.glb', priceCents: 14000, category: 'bird' },
  { id: 'pet-penguin', name: 'Penguin', modelPath: '/world/models/pets/animal-penguin.glb', priceCents: 24000, category: 'bird' },

  // Aquatic
  { id: 'pet-fish', name: 'Fish', modelPath: '/world/models/pets/animal-fish.glb', priceCents: 12000, category: 'aquatic' },

  // Wild (pricier — a stretch goal for the economy, not starter-tier)
  { id: 'pet-fox', name: 'Fox', modelPath: '/world/models/pets/animal-fox.glb', priceCents: 30000, category: 'wild' },
  { id: 'pet-deer', name: 'Deer', modelPath: '/world/models/pets/animal-deer.glb', priceCents: 30000, category: 'wild' },
  { id: 'pet-elephant', name: 'Elephant', modelPath: '/world/models/pets/animal-elephant.glb', priceCents: 45000, category: 'wild' },
  { id: 'pet-giraffe', name: 'Giraffe', modelPath: '/world/models/pets/animal-giraffe.glb', priceCents: 42000, category: 'wild' },
  { id: 'pet-koala', name: 'Koala', modelPath: '/world/models/pets/animal-koala.glb', priceCents: 35000, category: 'wild' },
  { id: 'pet-lion', name: 'Lion', modelPath: '/world/models/pets/animal-lion.glb', priceCents: 45000, category: 'wild' },
  { id: 'pet-monkey', name: 'Monkey', modelPath: '/world/models/pets/animal-monkey.glb', priceCents: 32000, category: 'wild' },
  { id: 'pet-panda', name: 'Panda', modelPath: '/world/models/pets/animal-panda.glb', priceCents: 40000, category: 'wild' },
  { id: 'pet-polar-bear', name: 'Polar Bear', modelPath: '/world/models/pets/animal-polar.glb', priceCents: 40000, category: 'wild' },
  { id: 'pet-tiger', name: 'Tiger', modelPath: '/world/models/pets/animal-tiger.glb', priceCents: 45000, category: 'wild' },

  // Fun / novelty (silliest tier, priced like the wild animals)
  { id: 'pet-banana-guy', name: 'Banana Guy', modelPath: '/world/models/creatures/banana-guy.glb', priceCents: 35000, category: 'fun' },
  { id: 'pet-potato-character', name: 'Potato Pal', modelPath: '/world/models/creatures/potato-character.glb', priceCents: 35000, category: 'fun' },
  { id: 'pet-butter-character', name: 'Butter Buddy', modelPath: '/world/models/creatures/butter-character.glb', priceCents: 35000, category: 'fun' },
  { id: 'pet-cactoro', name: 'Cactoro', modelPath: '/world/models/creatures/cactoro-quaternius.glb', priceCents: 35000, category: 'fun' },
  { id: 'pet-sussy-imposter', name: 'Sus Buddy', modelPath: '/world/models/creatures/sussy-imposter.glb', priceCents: 35000, category: 'fun' },
  { id: 'pet-wizardus', name: 'Wizardus', modelPath: '/world/models/creatures/wizardus-maximus.glb', priceCents: 35000, category: 'fun' },
];

// Direct teacher instruction: for now, adoptable pets are limited to real
// animals — specifically dogs and cats — not the novelty "fun" characters
// (Butter Buddy, Potato Pal, etc.) and not yet the wider animal roster
// (farm/wild/bird/aquatic/small critters). Everything else stays defined
// in PET_CATALOG_ALL above, ready to re-enable later by widening this list
// — nothing was deleted, just held back from adoption.
const ADOPTABLE_CATEGORIES: PetCategory[] = ['dog', 'cat'];

// The adoptable roster — what students can actually adopt, see in the Pet
// Shelter/Journal, and pull from the Mystery Box or daily spin wheel.
export const PET_CATALOG: PetDef[] = PET_CATALOG_ALL.filter((p) => ADOPTABLE_CATEGORIES.includes(p.category));

// Looks up ANY pet ever shipped, including ones outside the current
// adoptable roster — so a pet a student already owns from before this
// restriction always still resolves (Home Room, My Stuff), even though it
// can no longer be newly adopted.
export function petDefById(id: string): PetDef | undefined {
  return PET_CATALOG_ALL.find((p) => p.id === id);
}

export function canPetFollow(trainingProgress: number): boolean {
  return trainingProgress >= PET_FOLLOW_TRAINING_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Pet Journal (Claudia's collection-identity plan) — a short, per-category
// flavor bio rather than 37 hand-authored ones, so every pet reads as a
// real character without an inconsistent quality spread under time
// pressure. Templated on the pet's own name, not generic.
// ---------------------------------------------------------------------------
const CATEGORY_BIO: Record<PetCategory, string> = {
  dog: 'is a loyal, playful companion who loves fetch and cuddles.',
  cat: 'is independent and curious, happiest napping in a sunbeam or chasing string.',
  small: 'is tiny and energetic, always exploring every corner it can find.',
  farm: 'is gentle and hardworking, happiest out in the fresh morning air.',
  bird: 'is cheerful and chatty, always ready with a song or a short flight.',
  aquatic: 'is calm and graceful, gliding through the water without a care.',
  wild: 'is bold and adventurous, always up for exploring somewhere new.',
  fun: 'is silly and one-of-a-kind, and loves making everyone laugh.',
};
export function bioFor(pet: PetDef): string {
  return `${pet.name} ${CATEGORY_BIO[pet.category]}`;
}

// ---------------------------------------------------------------------------
// ABA shaping ladder (Claudia's plan, Phase 4) — successive approximations
// toward a fully-bonded companion, reusing the existing trainingProgress
// counter rather than new plumbing. Purely presentational milestones (a
// badge in the Home pet-care panel) — no new mechanic gated behind them,
// since new 3D animations/accessories aren't in scope for this pass.
// ---------------------------------------------------------------------------
export interface PetMilestone {
  threshold: number;
  label: string;
  icon: string;
}
export const PET_MILESTONES: PetMilestone[] = [
  { threshold: PET_FOLLOW_TRAINING_THRESHOLD, label: 'Walks with you', icon: '🚶' },
  { threshold: 10, label: 'Best Friends', icon: '💛' },
  { threshold: 15, label: 'Bonded for Life', icon: '⭐' },
];
export function milestonesReached(trainingProgress: number): PetMilestone[] {
  return PET_MILESTONES.filter((m) => trainingProgress >= m.threshold);
}
export function nextMilestone(trainingProgress: number): PetMilestone | null {
  return PET_MILESTONES.find((m) => trainingProgress < m.threshold) ?? null;
}

// ---------------------------------------------------------------------------
// Mystery Adoption Box (Claudia's plan, Phase 3/2) — a real Class Cash
// purchase, alongside (never replacing) direct catalog purchase and the
// daily spin's own pet wedge. Priced as a middle ground between the
// catalog's cheapest and priciest direct pets: you're paying for a chance
// at a rare pull, not a guaranteed one.
// ---------------------------------------------------------------------------
export const MYSTERY_PACK_PRICE_CENTS = 20000;
const RARITY_WEIGHTS: Record<PetRarity, number> = { common: 45, uncommon: 30, rare: 18, ultra: 7 };

function weightedPool(pets: PetDef[]): PetDef[] {
  const pool: PetDef[] = [];
  for (const p of pets) {
    for (let i = 0; i < RARITY_WEIGHTS[rarityFor(p)]; i++) pool.push(p);
  }
  return pool;
}

// Always returns a pet — there is no "empty pack" outcome. That's the line
// between a fun surprise (a variable-ratio reinforcement schedule on WHICH
// pet) and a loot-box mechanic (a schedule on WHETHER you're reinforced at
// all) — never blur it. Re-rolls within not-currently-owned species first,
// so a pull rarely feels wasted; only falls back to the full catalog once a
// student already owns every species in reach.
export function rollMysteryPet(ownedDefIds: Set<string>): PetDef {
  const notOwned = PET_CATALOG.filter((p) => !ownedDefIds.has(p.id));
  const pool = weightedPool(notOwned.length > 0 ? notOwned : PET_CATALOG);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------------------------------------------------------------------------
// Novelty-rotation scaffolding (Claudia's plan, Phase 7 — deliberately
// scoped down). The app has no "season" concept yet, so this is data-
// structure support only, not a live feature: a teacher tool could someday
// populate this with a few species' ids to temporarily boost, and
// rollMysteryPet could check it first before falling through to the normal
// weighted pool. Left empty and unwired until that teacher tool exists.
// ---------------------------------------------------------------------------
export const SEASONAL_BOOST_PET_IDS: string[] = [];
