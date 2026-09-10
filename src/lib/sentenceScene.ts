// Turns a student's filled-in sentence-formula words into a small emoji
// "scene" — a rule-based stand-in for true AI image generation (no image-gen
// API is configured in this app). Every word in the curated formula word
// banks maps to a specific emoji; anything else (free-typed words, or a
// teacher's own custom organizer) falls back to a generic icon for its role
// so the scene never comes up empty.
const WORD_EMOJI: Record<string, string> = {
  // WHO
  mom: '👩', dad: '👨', 'ms. kayden': '👩‍🏫', yoga: '🧘', 'the dog': '🐶', 'the cat': '🐱',
  'gma and gpa': '👵', 'the neighbor': '🧑', 'my teacher': '👩‍🏫', 'the wizard': '🧙',
  'king tut': '👑', zeus: '⚡', osiris: '🏺', santa: '🎅', bigfoot: '🦍',
  // ACTION
  is: '✨', was: '✨', were: '✨', are: '✨', am: '✨', kick: '🦵', play: '🎮', arrive: '🚪',
  sleep: '😴', put: '✋', work: '💼', eat: '🍽️', place: '📍', finish: '🏁', drink: '🥤',
  climbed: '🧗', went: '🚶',
  // WHO OR WHAT
  ball: '⚽', breakfast: '🍳', groceries: '🛒', book: '📖', coffee: '☕', crayon: '🖍️',
  'dog treat': '🦴', cookie: '🍪', table: '🪑', 'board game': '🎲', flashlight: '🔦',
  flowers: '💐', trampoline: '🤸', 'maple tree': '🍁',
  // DESCRIPTION — adverbs
  quickly: '💨', jokingly: '😂', quietly: '🤫', happily: '😊', sarcastically: '😏', extremely: '❗',
  // DESCRIPTION — adjectives
  angry: '😠', sad: '😢', happy: '😄', excited: '🤩',
  pink: '💗', yellow: '💛', white: '🤍', green: '💚',
  hot: '🥵', cold: '🥶', warm: '♨️', temperate: '🌤️',
  striped: '〰️', rainbow: '🌈', plaid: '🧶',
  tall: '📏', long: '➖', wide: '↔️', short: '🔽', big: '🐘',
  sweet: '🍬', sour: '🍋', salty: '🧂', bitter: '😖',
  stinky: '🤢', fresh: '🌿',
};

export type SceneRole = 'who' | 'action' | 'object' | 'description' | 'other';

const ROLE_FALLBACK: Record<SceneRole, string> = {
  who: '🧍',
  action: '⚡',
  object: '📦',
  description: '✨',
  other: '❓',
};

// A part's role is guessed from its label, since roles aren't a stored
// field — every built-in preset uses these exact labels (see
// sentenceOrganizers.ts), and a teacher's custom label just falls back to
// a generic sparkle rather than guessing wrong.
export function roleFromLabel(label: string | undefined): SceneRole {
  const l = (label ?? '').toLowerCase();
  if (l.includes('who or what')) return 'object';
  if (l.includes('who')) return 'who';
  if (l.includes('action') || l.includes('doing')) return 'action';
  if (l.includes('description') || l.includes('what kind')) return 'description';
  return 'other';
}

export interface SceneToken {
  partId: string;
  word: string;
  emoji: string;
  role: SceneRole;
}

export function wordEmoji(word: string, role: SceneRole): string {
  const key = word.trim().toLowerCase();
  return WORD_EMOJI[key] ?? ROLE_FALLBACK[role];
}
