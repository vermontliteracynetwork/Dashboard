import type { MarketplaceItem } from '../types';

// Standard prices, in cents, for anything the teacher hasn't priced
// individually — used both to seed starter data and as the smart default
// the "New Item" form in Marketplace Manager suggests per kind. A
// "specialty" item (seasonal, fancy, or otherwise a step up from the
// everyday option) is priced 25% above its kind's standard.
export const STANDARD_PRICE_CENTS: Record<'font' | 'color' | 'voice' | 'powerup' | 'emote', number> = {
  font: 200, // $2.00
  color: 200, // $2.00
  voice: 400, // $4.00
  powerup: 1500, // $15.00
  emote: 200, // $2.00
};
export const SPECIALTY_MULTIPLIER = 1.25;
export const specialtyPrice = (kind: keyof typeof STANDARD_PRICE_CENTS) => Math.round(STANDARD_PRICE_CENTS[kind] * SPECIALTY_MULTIPLIER);

// One-time bootstrap data: the very first set of fonts/colors/voices/
// power-ups the marketplace ships with, seeded into the (teacher-editable)
// marketplace_items table the first time the app ever hydrates with none
// present. IDs are stable — matching the app's original hardcoded catalogs
// — so an existing student's ownedFontIds/ownedColorIds/ownedVoiceIds keep
// resolving correctly. After the one-time seed, this file is never read
// again; everything from here on is edited, added to, or deleted entirely
// by the teacher from the Marketplace Manager.
export const STARTER_MARKETPLACE_ITEMS: Omit<MarketplaceItem, 'createdAt'>[] = [
  // Fonts — 3 free starters, everything else at the standard/specialty rate
  { id: 'font-nunito', kind: 'font', name: 'Nunito (Default)', icon: '🔤', price: 0, category: 'Fonts', tags: [], cssFontFamily: "'Nunito', sans-serif" },
  { id: 'font-lexend', kind: 'font', name: 'Easy Reading (Lexend)', icon: '🔤', price: 0, category: 'Fonts', tags: ['accessibility'], cssFontFamily: "'Lexend', sans-serif" },
  { id: 'font-comic', kind: 'font', name: 'Comic Sans', icon: '🔤', price: 0, category: 'Fonts', tags: [], cssFontFamily: "'Comic Sans MS', 'Comic Sans', cursive" },
  { id: 'font-baloo', kind: 'font', name: 'Baloo (Bouncy)', icon: '🔤', price: specialtyPrice('font'), category: 'Fonts', tags: ['fun'], cssFontFamily: "'Baloo 2', sans-serif" },
  { id: 'font-mono', kind: 'font', name: 'Typewriter', icon: '🔤', price: STANDARD_PRICE_CENTS.font, category: 'Fonts', tags: [], cssFontFamily: "'Courier New', monospace" },
  { id: 'font-serif', kind: 'font', name: 'Storybook', icon: '🔤', price: specialtyPrice('font'), category: 'Fonts', tags: ['fancy'], cssFontFamily: "Georgia, 'Times New Roman', serif" },
  // Colors — Notes text color
  { id: 'color-black', kind: 'color', name: 'Black', icon: '🎨', price: 0, category: 'Text Colors', tags: [], colorHex: '#1f1147', colorUse: 'text' },
  { id: 'color-blue', kind: 'color', name: 'Blue', icon: '🎨', price: 0, category: 'Text Colors', tags: [], colorHex: '#3b82f6', colorUse: 'text' },
  { id: 'color-red', kind: 'color', name: 'Red', icon: '🎨', price: STANDARD_PRICE_CENTS.color, category: 'Text Colors', tags: [], colorHex: '#e63946', colorUse: 'text' },
  { id: 'color-green', kind: 'color', name: 'Green', icon: '🎨', price: STANDARD_PRICE_CENTS.color, category: 'Text Colors', tags: [], colorHex: '#2fae5d', colorUse: 'text' },
  { id: 'color-purple', kind: 'color', name: 'Purple', icon: '🎨', price: STANDARD_PRICE_CENTS.color, category: 'Text Colors', tags: [], colorHex: '#7c3aed', colorUse: 'text' },
  { id: 'color-orange', kind: 'color', name: 'Orange', icon: '🎨', price: STANDARD_PRICE_CENTS.color, category: 'Text Colors', tags: [], colorHex: '#fb923c', colorUse: 'text' },
  { id: 'color-pink', kind: 'color', name: 'Pink', icon: '🎨', price: STANDARD_PRICE_CENTS.color, category: 'Text Colors', tags: [], colorHex: '#ec4899', colorUse: 'text' },
  { id: 'color-teal', kind: 'color', name: 'Teal', icon: '🎨', price: STANDARD_PRICE_CENTS.color, category: 'Text Colors', tags: [], colorHex: '#14b8a6', colorUse: 'text' },
  { id: 'color-gold', kind: 'color', name: 'Gold', icon: '🎨', price: specialtyPrice('color'), category: 'Text Colors', tags: ['fancy'], colorHex: '#d4a017', colorUse: 'text' },
  { id: 'color-rainbow', kind: 'color', name: 'Rainbow', icon: '🎨', price: specialtyPrice('color'), category: 'Text Colors', tags: ['fancy'], colorHex: 'rainbow', colorUse: 'text' },
  // Colors — Notes highlight (note background) color
  { id: 'highlight-yellow', kind: 'color', name: 'Yellow', icon: '🖍️', price: 0, category: 'Highlight Colors', tags: [], colorHex: '#fef3a8', colorUse: 'highlight' },
  { id: 'highlight-green', kind: 'color', name: 'Green', icon: '🖍️', price: STANDARD_PRICE_CENTS.color, category: 'Highlight Colors', tags: [], colorHex: '#c8f4c8', colorUse: 'highlight' },
  { id: 'highlight-pink', kind: 'color', name: 'Pink', icon: '🖍️', price: STANDARD_PRICE_CENTS.color, category: 'Highlight Colors', tags: [], colorHex: '#fbd5e8', colorUse: 'highlight' },
  { id: 'highlight-blue', kind: 'color', name: 'Blue', icon: '🖍️', price: STANDARD_PRICE_CENTS.color, category: 'Highlight Colors', tags: [], colorHex: '#cfe4fd', colorUse: 'highlight' },
  // Colors — Whiteboard marker color (kept free, matching the app's original always-free palette)
  { id: 'marker-black', kind: 'color', name: 'Black', icon: '✏️', price: 0, category: 'Whiteboard Markers', tags: [], colorHex: '#1f1147', colorUse: 'marker' },
  { id: 'marker-red', kind: 'color', name: 'Red', icon: '✏️', price: 0, category: 'Whiteboard Markers', tags: [], colorHex: '#e63946', colorUse: 'marker' },
  { id: 'marker-blue', kind: 'color', name: 'Blue', icon: '✏️', price: 0, category: 'Whiteboard Markers', tags: [], colorHex: '#2a6df4', colorUse: 'marker' },
  { id: 'marker-green', kind: 'color', name: 'Green', icon: '✏️', price: 0, category: 'Whiteboard Markers', tags: [], colorHex: '#2fae5d', colorUse: 'marker' },
  { id: 'marker-orange', kind: 'color', name: 'Orange', icon: '✏️', price: 0, category: 'Whiteboard Markers', tags: [], colorHex: '#f4a300', colorUse: 'marker' },
  { id: 'marker-purple', kind: 'color', name: 'Purple', icon: '✏️', price: 0, category: 'Whiteboard Markers', tags: [], colorHex: '#8b5cf6', colorUse: 'marker' },
  // Voices
  { id: 'voice-default', kind: 'voice', name: 'My Voice', icon: '🔊', price: 0, category: 'Voices', tags: [], voicePitch: 1, voiceRate: 1, voiceHints: [] },
  { id: 'voice-robot', kind: 'voice', name: '🤖 Robot', icon: '🔊', price: 0, category: 'Voices', tags: [], voicePitch: 0.3, voiceRate: 0.9, voiceHints: [] },
  { id: 'voice-santa', kind: 'voice', name: '🎅 Santa', icon: '🔊', price: specialtyPrice('voice'), category: 'Voices', tags: ['seasonal'], voicePitch: 0.5, voiceRate: 0.82, voiceHints: ['male', 'daniel', 'fred', 'david'] },
  { id: 'voice-fairy', kind: 'voice', name: '🧚 Fairy', icon: '🔊', price: STANDARD_PRICE_CENTS.voice, category: 'Voices', tags: [], voicePitch: 1.8, voiceRate: 1.15, voiceHints: ['female', 'samantha', 'victoria', 'karen'] },
  { id: 'voice-giant', kind: 'voice', name: '👹 Giant', icon: '🔊', price: STANDARD_PRICE_CENTS.voice, category: 'Voices', tags: [], voicePitch: 0.2, voiceRate: 0.75, voiceHints: ['male'] },
  { id: 'voice-chipmunk', kind: 'voice', name: '🐿️ Chipmunk', icon: '🔊', price: STANDARD_PRICE_CENTS.voice, category: 'Voices', tags: [], voicePitch: 2, voiceRate: 1.4, voiceHints: [] },
  // Power-ups
  {
    id: 'powerup-skip',
    kind: 'powerup',
    name: 'Skip Pass',
    icon: '🎫',
    price: STANDARD_PRICE_CENTS.powerup,
    category: 'Power-Ups',
    tags: [],
    description: "Cross off one to-do item without doing it. Your teacher can still see it was skipped.",
  },
];

export const STARTER_FONT_IDS = STARTER_MARKETPLACE_ITEMS.filter((it) => it.kind === 'font' && it.price === 0).map((it) => it.id);
export const STARTER_COLOR_IDS = STARTER_MARKETPLACE_ITEMS.filter((it) => it.kind === 'color' && it.price === 0).map((it) => it.id);
export const STARTER_VOICE_IDS = STARTER_MARKETPLACE_ITEMS.filter((it) => it.kind === 'voice' && it.price === 0).map((it) => it.id);
