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
  // Real-world-proportional companion height in meters (same avatar-
  // relative convention WorldEditor's CHARACTER_HEIGHT=1.745 system uses),
  // NOT a flat multiplier on the model's own raw export units — direct
  // teacher bug report: a single flat scale on raw units made every pet
  // come out the same rendered size regardless of species (a Great Dane
  // no bigger than a Chihuahua-scale toy dog), since raw GLB units vary
  // pack to pack the same way WorldEditor's whole asset catalog does.
  // Kept deliberately compressed within a category (a Great Dane is only
  // "slightly bigger" than a Poodle here, not real-world much-bigger) per
  // direct instruction — these are companions standing next to a student,
  // not a biology chart. Aquatic/small critters stay genuinely small.
  targetHeight: number;
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

// Pets overhaul (teacher 2026-10-06): every pet function is paused while
// the whole system is rebuilt (cats and dogs only, grammar inside
// training). Adoption, the Shelter, the Journal, the Mystery Box, the
// daily spin pet wedge, trading, companions, training and the care card
// are all off, and every existing pet was refunded at its catalog price
// and removed (src/lib/petOverhaul.ts). Flip to false when v2 ships.
export const PETS_PAUSED = false; // Pets v2 reopened 2026-10-11 (her spec, Build Queue 19a)

export const PET_OWNERSHIP_CAP = 10; // her Pets v2 spec (2026-10-11): "Students can have a total of 10 pets"

// Task completions logged (via trainingProgress) before a pet unlocks
// "walk beside you" — direct teacher spec: training comes from finishing
// assignments/question sets, not from care actions.
export const PET_FOLLOW_TRAINING_THRESHOLD = 10; // Pets v2: a pet walks beside you once it is a Juvenile

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
// Teacher cleanup 2026-10-11 (verbatim): "Pet Breeds: Cats: tabby cat. Dogs: Pug, husky, poodle,
// beagle, great dane, shiba inu. keep as future pets: hamster ... delete all other pets from
// catelog entirely. lets clean things up". The pets are these 7 breeds. The Hamster stays defined
// as a future pet but is not adoptable. Every other pet was removed from the catalog (their models
// are deleted; the ones she kept for future Neighbors or as placeable animals live on in the
// Build Mode catalog, see the dev plan). Pets were all refunded and removed on 2026-10-06, so no
// student owns a removed pet.
const PET_CATALOG_ALL: PetDef[] = [
  // Dogs — player-relative ratio scale (player = 1): Great Dane 0.8, the others 0.6.
  // targetHeight = ratio * CHARACTER_HEIGHT (1.745).
  { id: 'pet-pug', name: 'Pug', modelPath: '/world/models/pets/animal-pug.glb', priceCents: 30000, category: 'dog', targetHeight: 0.8725 },
  { id: 'pet-husky', name: 'Husky', modelPath: '/world/models/pets/animal-husky.glb', priceCents: 30000, category: 'dog', targetHeight: 1.047 },
  { id: 'pet-poodle', name: 'Poodle', modelPath: '/world/models/pets/animal-poodle.glb', priceCents: 30000, category: 'dog', targetHeight: 1.047 },
  { id: 'pet-beagle', name: 'Beagle', modelPath: '/world/models/pets/animal-beagle.glb', priceCents: 30000, category: 'dog', targetHeight: 1.047 },
  { id: 'pet-great-dane', name: 'Great Dane', modelPath: '/world/models/pets/animal-great-dane.glb', priceCents: 30000, category: 'dog', targetHeight: 1.396 },
  { id: 'pet-shiba-inu', name: 'Shiba Inu', modelPath: '/world/models/pets/animal-shiba-inu.glb', priceCents: 30000, category: 'dog', targetHeight: 1.047 },
  // Cats — 0.5 of the player.
  { id: 'pet-cat-2', name: 'Tabby Cat', modelPath: '/world/models/pets/animal-cat-2.glb', priceCents: 30000, category: 'cat', targetHeight: 0.8725 },
  // Her uploads 2026-10-11 ("add these to the pets"): five realistic cats, each with its own idle
  // animation (the black cat sits and grooms). Shrunk from 33 MB to 11 MB for iPads.
  { id: 'pet-cat-bicolor', name: 'Bicolor Cat', modelPath: '/world/models/pets/animal-cat-bicolor.glb', priceCents: 30000, category: 'cat', targetHeight: 0.8725 },
  { id: 'pet-cat-black', name: 'Black Cat', modelPath: '/world/models/pets/animal-cat-black.glb', priceCents: 30000, category: 'cat', targetHeight: 0.8725 },
  { id: 'pet-cat-maine-coon', name: 'Maine Coon', modelPath: '/world/models/pets/animal-cat-maine-coon.glb', priceCents: 30000, category: 'cat', targetHeight: 0.95 },
  { id: 'pet-cat-ragdoll', name: 'Ragdoll', modelPath: '/world/models/pets/animal-cat-ragdoll.glb', priceCents: 30000, category: 'cat', targetHeight: 0.8725 },
  { id: 'pet-cat-bengal', name: 'Bengal', modelPath: '/world/models/pets/animal-cat-bengal.glb', priceCents: 30000, category: 'cat', targetHeight: 0.8725 },
  // Build Queue 398 (her words: "make sure that these animals are animated and can interact functionally"): the Styloo
  // animal pack. The dog and cow keep their own Idle, Walk, Run and Jump; the cat, giraffe, chicken and ladybug got
  // walk and idle moves made for their own skeletons, and the butterfly flies. The pup and kitty can be adopted.
  // Her own walking cat (cat.fbx with her catskin.png picture, 2026-10-27).
  { id: 'pet-cat-tuxedo', name: 'Tuxedo Cat', modelPath: '/world/models/pets/animal-cat-tuxedo.glb', priceCents: 30000, category: 'cat', targetHeight: 0.8725 },
  { id: 'pet-styloo-pup', name: 'Spotted Pup', modelPath: '/world/models/pets-styloo/styloo-dog.glb', priceCents: 30000, category: 'dog', targetHeight: 1.0 },
  { id: 'pet-styloo-kitty', name: 'Pink Nose Kitty', modelPath: '/world/models/pets-styloo/styloo-cat.glb', priceCents: 30000, category: 'cat', targetHeight: 0.85 },
  { id: 'pet-styloo-cow', name: 'Cow', modelPath: '/world/models/pets-styloo/styloo-cow.glb', priceCents: 30000, category: 'farm', targetHeight: 1.4 },
  { id: 'pet-styloo-chicken', name: 'Chicken', modelPath: '/world/models/pets-styloo/styloo-chicken.glb', priceCents: 20000, category: 'farm', targetHeight: 0.7 },
  { id: 'pet-styloo-giraffe', name: 'Giraffe', modelPath: '/world/models/pets-styloo/styloo-giraffe.glb', priceCents: 40000, category: 'wild', targetHeight: 2.2 },
  { id: 'pet-styloo-ladybug', name: 'Ladybug', modelPath: '/world/models/pets-styloo/styloo-ladybug.glb', priceCents: 13000, category: 'small', targetHeight: 0.3 },
  { id: 'pet-styloo-butterfly', name: 'Butterfly', modelPath: '/world/models/pets-styloo/styloo-butterfly.glb', priceCents: 13000, category: 'small', targetHeight: 0.35 },
  // A future pet (her words: "keep as future pets: hamster"), not adoptable yet.
  { id: 'pet-hamster', name: 'Hamster', modelPath: '/world/models/pets/animal-hamster.glb', priceCents: 13000, category: 'small', targetHeight: 0.09 },
];

// Only the 7 breeds can be adopted; the Hamster waits as a future pet.
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
  { threshold: 25, label: 'Trick Master', icon: '🎪' },
];

// Pets review (teacher, 2026-10-06: "lets review the pet training and
// general pet functions. lets improve them"). Training used to come ONLY
// from finished assignments, so a student playing native games or Quiz
// mode never trained a pet, even though the growth-stage spec says pets
// grow "with attention, love, and native games". Now every 10 right
// answers anywhere (games, quizzes, the gas pump) is also 1 training.
export const PET_ANSWERS_PER_TRAINING = 10;
export const PET_TRAINING_CAP = 25; // the top of the milestone ladder

// The milestone a training count just crossed (for the "can walk with you
// now!" moment), or null.
export function milestoneCrossed(before: number, after: number): PetMilestone | null {
  return PET_MILESTONES.find((m) => before < m.threshold && after >= m.threshold) ?? null;
}
export function milestonesReached(trainingProgress: number): PetMilestone[] {
  return PET_MILESTONES.filter((m) => trainingProgress >= m.threshold);
}
export function nextMilestone(trainingProgress: number): PetMilestone | null {
  return PET_MILESTONES.find((m) => trainingProgress < m.threshold) ?? null;
}

// ---------------------------------------------------------------------------
// Teach a Trick — Part C's own open question ("I taught it a trick"?) made
// real: a small, guaranteed-success SEL/bonding interaction, not an academic
// task. Same 5 generic tricks for every pet (no new 3D assets/animations —
// out of scope, same reasoning as the milestone badges above). First
// attempt always succeeds; no retry-until-correct, no skill check.
// ---------------------------------------------------------------------------
//
// Pets review (2026-10-06): teaching is now a real training session
// (PetTrainingSession.tsx) shaped like a discrete trial: say the cue, the
// pet does the trick, give a treat, three times, then it's learned. It
// still always succeeds. New tricks unlock as training grows (unlockAt), so
// the work a student does visibly gives their pet new things to learn, and
// learned tricks can be shown off any time at home or in Town Square.
// ---------------------------------------------------------------------------
export interface PetTrick {
  id: string;
  label: string;
  icon: string;
  cue: string; // what the student "says"
  unlockAt: number; // training needed before it can be taught
}
export const PET_TRICKS: PetTrick[] = [
  { id: 'trick-sit', label: 'Sit', icon: '🪑', cue: 'Sit!', unlockAt: 0 },
  { id: 'trick-shake', label: 'Shake', icon: '🤝', cue: 'Shake!', unlockAt: 0 },
  { id: 'trick-spin', label: 'Spin', icon: '🌀', cue: 'Spin!', unlockAt: 3 },
  { id: 'trick-speak', label: 'Speak', icon: '🗣️', cue: 'Speak!', unlockAt: 5 },
  { id: 'trick-playdead', label: 'Play Dead', icon: '🛌', cue: 'Play dead!', unlockAt: 10 },
  { id: 'trick-rollover', label: 'Roll Over', icon: '🔄', cue: 'Roll over!', unlockAt: 15 },
  { id: 'trick-dance', label: 'Dance', icon: '💃', cue: 'Dance!', unlockAt: 20 },
  { id: 'trick-highfive', label: 'High Five', icon: '🙌', cue: 'High five!', unlockAt: 25 },
];
export const TRICK_REPS_TO_LEARN = 3;
export function trickUnlocked(trick: PetTrick, trainingProgress: number): boolean {
  return trainingProgress >= trick.unlockAt;
}
// Tricks that just became teachable when training went before -> after.
export function tricksUnlockedBetween(before: number, after: number): PetTrick[] {
  return PET_TRICKS.filter((t) => t.unlockAt > before && t.unlockAt <= after);
}
const SPEAK_WORD: Record<PetCategory, string> = {
  dog: 'Woof woof!', cat: 'Meow!', small: 'Squeak!', farm: 'Moo... I mean hi!', bird: 'Tweet tweet!', aquatic: 'Blub blub!', wild: 'Roar!', fun: 'Ta-da!',
};
export function speakWordFor(pet: PetDef): string {
  return SPEAK_WORD[pet.category];
}

// ---------------------------------------------------------------------------
// Growth stages — direct teacher spec: "pets should start out as babies/
// puppies/kittens and grow to be full adults with attention, love, and
// native games." Reuses the SAME trainingProgress counter and thresholds
// the milestone ladder above already uses (attention/love comes through as
// real academic engagement, per this app's own established rule that
// training comes from finishing assignments/question sets — native games
// included — not from clicking a care button) rather than a second,
// parallel counter: a newly adopted pet's trainingProgress already starts
// at 0, so "starts as a baby" is true for free. Baby -> Juvenile lines up
// with the existing "Walks with you" unlock (a pet that hasn't bonded
// enough yet doesn't follow you as a baby), Juvenile -> Adult lines up
// with "Best Friends." Purely a render-time scale multiplier on top of a
// pet's own real targetHeight — no new stored field, no schema change.
export type PetGrowthStage = 'baby' | 'juvenile' | 'adult';
const GROWTH_STAGE_SCALE: Record<PetGrowthStage, number> = {
  baby: 0.55,
  juvenile: 0.78,
  adult: 1,
};
const GROWTH_STAGE_LABEL: Record<PetGrowthStage, string> = {
  baby: 'Baby',
  juvenile: 'Juvenile',
  adult: 'Adult',
};
const GROWTH_STAGE_ICON: Record<PetGrowthStage, string> = {
  baby: '🍼',
  juvenile: '🌱',
  adult: '⭐',
};
export function growthStageFor(trainingProgress: number): PetGrowthStage {
  // Pets v2 (her Buff Doge's Gym prototype): Juvenile from 10 training, Adult from 25.
  if (trainingProgress >= 25) return 'adult';
  if (trainingProgress >= 10) return 'juvenile';
  return 'baby';
}
export function growthScaleFactor(stage: PetGrowthStage): number {
  return GROWTH_STAGE_SCALE[stage];
}
export function growthStageLabel(stage: PetGrowthStage): string {
  return GROWTH_STAGE_LABEL[stage];
}
export function growthStageIcon(stage: PetGrowthStage): string {
  return GROWTH_STAGE_ICON[stage];
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
