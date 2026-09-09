export interface FontOption {
  id: string;
  name: string;
  cssFontFamily: string;
  price: number; // Class Cash, in cents; 0 = free starter, always owned
}

// Web-safe + Google Fonts already loaded by the app (Nunito, Baloo 2) plus
// a couple of extra Google Fonts pulled in just for this — real, distinct
// fonts a student can tell apart, not just weight variants.
export const FONT_CATALOG: FontOption[] = [
  { id: 'font-nunito', name: 'Nunito (Default)', cssFontFamily: "'Nunito', sans-serif", price: 0 },
  { id: 'font-comic', name: 'Comic Sans', cssFontFamily: "'Comic Sans MS', 'Comic Sans', cursive", price: 0 },
  { id: 'font-baloo', name: 'Baloo (Bouncy)', cssFontFamily: "'Baloo 2', sans-serif", price: 400 },
  { id: 'font-mono', name: 'Typewriter', cssFontFamily: "'Courier New', monospace", price: 400 },
  { id: 'font-serif', name: 'Storybook', cssFontFamily: "Georgia, 'Times New Roman', serif", price: 600 },
];

export const STARTER_FONT_IDS: string[] = FONT_CATALOG.filter((f) => f.price === 0).map((f) => f.id);

const BY_ID = new Map(FONT_CATALOG.map((f) => [f.id, f]));
export function fontById(id: string): FontOption | undefined {
  return BY_ID.get(id);
}
