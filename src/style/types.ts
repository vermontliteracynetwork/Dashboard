// Style: the unified character + one-size-fits-all wardrobe system
// (docs/STYLE.md). Every species shares one body template (same torso,
// arms, legs and joint positions), so every clothing item fits every
// species and every species moves with the same animations.

export type SpeciesId = 'dog' | 'cat' | 'frog' | 'capybara';

export type PatternId =
  | 'solid'
  | 'polka'
  | 'stripes'
  | 'plaid'
  | 'gingham'
  | 'checks'
  | 'stars'
  | 'hearts'
  | 'zigzag'
  | 'spots';

// A painted surface: a pattern plus its two colors (the second color is
// the pattern's dots/lines/checks; solid uses only the first).
export interface Paint {
  pattern: PatternId;
  colors: [string, string];
}

export type WardrobeSlot = 'hat' | 'face' | 'gear' | 'top' | 'bottom' | 'shoes' | 'back';

export interface EquippedItem {
  itemId: string;
  zones: Paint[]; // one Paint per color zone the item declares
}

export interface StyleBody {
  fur: Paint; // main body and head
  belly: Paint; // tummy, muzzle, inner ears
  accent: Paint; // ears, spots, paws, frog spots, capybara snout
  eyes: string;
  nose: string;
}

export interface StyleLook {
  species: SpeciesId;
  body: StyleBody;
  outfit: Partial<Record<WardrobeSlot, EquippedItem>>;
}

export type StyleMove = 'idle' | 'walk' | 'run';
export type StyleOneShot = 'jump' | 'wave' | 'cheer' | 'dance';
