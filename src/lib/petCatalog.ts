// The pets system's static catalog — every adoptable pet type, its model,
// price, and category. Per direct teacher spec: every pet here is
// available to every student (no per-student scarcity) unless a future
// teacher tool specifically gifts or locks one — that's not built yet,
// see docs/ASSET_PIPELINE.md-adjacent notes in the commit this shipped in.

export type PetCategory = 'dog' | 'cat' | 'small' | 'farm' | 'bird' | 'aquatic' | 'wild' | 'fun';

export interface PetDef {
  id: string;
  name: string;
  modelPath: string;
  priceCents: number;
  category: PetCategory;
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

export const PET_CATALOG: PetDef[] = [
  // Dogs
  { id: 'pet-dog', name: 'Dog', modelPath: '/world/models/pets/animal-dog.glb', priceCents: 15000, category: 'dog' },
  { id: 'pet-pug', name: 'Pug', modelPath: '/world/models/pets/animal-pug.glb', priceCents: 18000, category: 'dog' },
  { id: 'pet-husky', name: 'Husky', modelPath: '/world/models/pets/animal-husky.glb', priceCents: 20000, category: 'dog' },
  { id: 'pet-poodle', name: 'Poodle', modelPath: '/world/models/pets/animal-poodle.glb', priceCents: 20000, category: 'dog' },
  { id: 'pet-beagle', name: 'Beagle', modelPath: '/world/models/pets/animal-beagle.glb', priceCents: 18000, category: 'dog' },
  { id: 'pet-great-dane', name: 'Great Dane', modelPath: '/world/models/pets/animal-great-dane.glb', priceCents: 22000, category: 'dog' },
  { id: 'pet-shiba-inu', name: 'Shiba Inu', modelPath: '/world/models/pets/animal-shiba-inu.glb', priceCents: 20000, category: 'dog' },
  { id: 'pet-blob-dog', name: 'Blob Dog', modelPath: '/world/models/creatures/blob-dog.glb', priceCents: 15000, category: 'dog' },

  // Cats
  { id: 'pet-cat', name: 'Cat', modelPath: '/world/models/pets/animal-cat.glb', priceCents: 15000, category: 'cat' },
  { id: 'pet-cat-2', name: 'Tabby Cat', modelPath: '/world/models/pets/animal-cat-2.glb', priceCents: 15000, category: 'cat' },
  { id: 'pet-blob-cat', name: 'Blob Cat', modelPath: '/world/models/creatures/blob-cat.glb', priceCents: 15000, category: 'cat' },

  // Small critters
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

export function petDefById(id: string): PetDef | undefined {
  return PET_CATALOG.find((p) => p.id === id);
}

export function canPetFollow(trainingProgress: number): boolean {
  return trainingProgress >= PET_FOLLOW_TRAINING_THRESHOLD;
}
