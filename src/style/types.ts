// Style: the unified character + one-size-fits-all wardrobe system
// (docs/STYLE.md). Every species shares one body template (same torso,
// arms, legs and joint positions), so every clothing item fits every
// species and every species moves with the same animations.

// 'person' is MOCK-UP ONLY for now (Build Queue 195): it is not in SPECIES, so no picker offers it.
export type SpeciesId = 'dog' | 'cat' | 'frog' | 'capybara' | 'chicken' | 'squirrel' | 'fox' | 'person';

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

// 'costume' replaces the animal and everything else it wears (a full-body
// character, e.g. the Space Alien).
// 'hair' (hairstyles and wigs) is MOCK-UP ONLY for now (Build Queue 195): not in SLOT_ORDER, so no tab shows it.
export type WardrobeSlot = 'hat' | 'face' | 'gear' | 'top' | 'bottom' | 'shoes' | 'back' | 'costume' | 'hair';

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

// swim: stroking along in deep water; tread: floating in place in deep water.
export type StyleMove = 'idle' | 'walk' | 'run' | 'swim' | 'tread';
export type StyleOneShot = 'jump' | 'wave' | 'cheer' | 'dance';

// Teacher edits to catalog items (item workshop): a new name and/or new
// default colors and patterns. Saved once for the whole class; per the
// teacher's instruction, edits reach students even for items they own.
export interface StyleItemOverride {
  name?: string;
  zones?: Paint[];
}
export type StyleCatalogOverrides = Record<string, StyleItemOverride>;
