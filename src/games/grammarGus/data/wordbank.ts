// Word bank (plan sections 3.13, 6.2, 13.2, 13.3). Core words are the
// teacher's word-list PDF. "example" words are the extra words her own 33
// pattern examples use (fish, dolphin, swam, proudly...) so every example
// sentence can be built and earns 3 stars. "color" and "action" are the
// Color pack and the start of the Action Pack the plan adds (section 6).

export type Rig = 'biped' | 'quadruped' | 'critter' | 'bird' | 'serpent' | 'vehicle' | 'object' | 'weather' | 'prop';
export type NounKind = 'human' | 'animal' | 'thing';
export type Pack = 'core' | 'example' | 'color' | 'action' | 'space' | 'ocean' | 'custom';
// Interest word packs (plan 17.5). The teacher turns them on or off; they
// follow the same data model and agreement rules as every other word.
export const WORD_PACKS: { id: Pack; name: string; icon: string }[] = [{ id: 'space', name: 'Space', icon: '🚀' }, { id: 'ocean', name: 'Ocean', icon: '🌊' }];
export const isPackWord = (p: Pack) => p === 'space' || p === 'ocean';

export interface NounEntry {
  word: string; tier: 1 | 2 | 3; kind: NounKind; rig: Rig; emoji: string; pack: Pack;
  plural?: boolean; noA?: boolean; group?: number; // group: how many sprites (children, crowd)
  proper?: boolean; // a name: Mia, Vermont (always a capital letter, no article)
  singular?: string; // a Duplicator plural ("cats") drawn with its singular's picture
  food?: boolean; drink?: boolean; size?: 'small' | 'normal' | 'big';
}

const n = (word: string, tier: 1 | 2 | 3, kind: NounKind, rig: Rig, emoji: string, extra: Partial<NounEntry> = {}): NounEntry =>
  ({ word, tier, kind, rig, emoji, pack: 'core', ...extra });

export const NOUNS: NounEntry[] = [
  // Tier 1 (CVC)
  n('ball', 1, 'thing', 'object', '⚽', { size: 'small' }), n('bat', 1, 'animal', 'bird', '🦇', { size: 'small' }),
  n('boy', 1, 'human', 'biped', '👦'), n('car', 1, 'thing', 'vehicle', '🚗', { size: 'big' }),
  n('cat', 1, 'animal', 'quadruped', '🐱'), n('cow', 1, 'animal', 'quadruped', '🐄', { size: 'big' }),
  n('dad', 1, 'human', 'biped', '👨'), n('dog', 1, 'animal', 'quadruped', '🐶'),
  n('girl', 1, 'human', 'biped', '👧'), n('kite', 1, 'thing', 'object', '🪁'),
  n('man', 1, 'human', 'biped', '👨'), n('mom', 1, 'human', 'biped', '👩'),
  n('pet', 1, 'animal', 'quadruped', '🐾'), n('pig', 1, 'animal', 'quadruped', '🐷'),
  n('rat', 1, 'animal', 'critter', '🐀', { size: 'small' }), n('son', 1, 'human', 'biped', '👦'),
  n('van', 1, 'thing', 'vehicle', '🚐', { size: 'big' }),
  // Tier 2
  n('apple', 2, 'thing', 'object', '🍎', { food: true, size: 'small' }), n('bike', 2, 'thing', 'vehicle', '🚲'),
  n('bird', 2, 'animal', 'bird', '🐦', { size: 'small' }), n('book', 2, 'thing', 'object', '📕', { size: 'small' }),
  n('clam', 2, 'animal', 'critter', '🦪', { size: 'small' }), n('crayon', 2, 'thing', 'object', '🖍️', { size: 'small' }),
  n('crowd', 2, 'human', 'biped', '👥', { group: 5 }), n('dime', 2, 'thing', 'object', '🪙', { size: 'small' }),
  n('mice', 2, 'animal', 'critter', '🐭', { plural: true, noA: true, group: 3, size: 'small' }),
  n('rain', 2, 'thing', 'weather', '🌧️', { noA: true, drink: true }), n('rose', 2, 'thing', 'object', '🌹', { size: 'small' }),
  n('shoe', 2, 'thing', 'object', '👟', { size: 'small' }), n('snail', 2, 'animal', 'critter', '🐌', { size: 'small' }),
  n('snake', 2, 'animal', 'serpent', '🐍'), n('straw', 2, 'thing', 'object', '🥤', { size: 'small' }),
  n('swing', 2, 'thing', 'object', '🛝'), n('tank', 2, 'thing', 'vehicle', '🛢️', { size: 'big' }),
  n('team', 2, 'human', 'biped', '👥', { group: 4 }), n('woman', 2, 'human', 'biped', '👩'),
  // Tier 3
  n('animal', 3, 'animal', 'quadruped', '🐾'), n('aunt', 3, 'human', 'biped', '👩'),
  n('balloon', 3, 'thing', 'object', '🎈'), n('chicken', 3, 'animal', 'bird', '🐔'),
  n('children', 3, 'human', 'biped', '🧒', { plural: true, noA: true, group: 3 }), n('deer', 3, 'animal', 'quadruped', '🦌', { size: 'big' }),
  n('doctor', 3, 'human', 'biped', '🧑‍⚕️'), n('family', 3, 'human', 'biped', '👪', { group: 3 }),
  n('frog', 3, 'animal', 'critter', '🐸', { size: 'small' }), n('goose', 3, 'animal', 'bird', '🪿'),
  n('grandmother', 3, 'human', 'biped', '👵'), n('horse', 3, 'animal', 'quadruped', '🐴', { size: 'big' }),
  n('kitten', 3, 'animal', 'quadruped', '🐱', { size: 'small' }), n('owl', 3, 'animal', 'bird', '🦉'),
  n('rabbit', 3, 'animal', 'quadruped', '🐰', { size: 'small' }), n('sister', 3, 'human', 'biped', '👧'),
  n('spy', 3, 'human', 'biped', '🕵️'), n('tiger', 3, 'animal', 'quadruped', '🐯'),
  n('uncle', 3, 'human', 'biped', '👨'), n('wheel', 3, 'thing', 'vehicle', '🛞'),
  n('zebra', 3, 'animal', 'quadruped', '🦓', { size: 'big' }),
  // Words her 33 example sentences use (pack "example", tier 3).
  ...([
    n('fish', 3, 'animal', 'critter', '🐟', { size: 'small' }), n('dolphin', 3, 'animal', 'critter', '🐬'),
    n('bug', 3, 'animal', 'critter', '🐞', { size: 'small' }), n('turtle', 3, 'animal', 'critter', '🐢', { size: 'small' }),
    n('hare', 3, 'animal', 'quadruped', '🐇', { size: 'small' }), n('plane', 3, 'thing', 'vehicle', '✈️', { size: 'big' }),
    n('popsicle', 3, 'thing', 'object', '🍭', { food: true, size: 'small' }), n('rock', 3, 'thing', 'object', '🪨', { size: 'small' }),
    n('window', 3, 'thing', 'prop', '🪟'), n('floor', 3, 'thing', 'prop', '🟫'), n('table', 3, 'thing', 'prop', '🪑'),
    n('kitchen', 3, 'thing', 'prop', '🍳'), n('door', 3, 'thing', 'prop', '🚪'), n('bus', 3, 'thing', 'vehicle', '🚌', { size: 'big' }),
  ].map((e) => ({ ...e, pack: 'example' as Pack }))),
  // Space pack.
  ...([
    n('astronaut', 3, 'human', 'biped', '🧑‍🚀'), n('alien', 3, 'animal', 'biped', '👽'), n('robot', 3, 'thing', 'biped', '🤖'),
    n('rocket', 3, 'thing', 'vehicle', '🚀', { size: 'big' }), n('planet', 3, 'thing', 'object', '🪐', { size: 'big' }),
    n('moon', 3, 'thing', 'object', '🌙'), n('comet', 3, 'thing', 'object', '☄️'),
  ].map((e) => ({ ...e, pack: 'space' as Pack }))),
  // Ocean pack.
  ...([
    n('shark', 3, 'animal', 'critter', '🦈', { size: 'big' }), n('octopus', 3, 'animal', 'critter', '🐙'), n('whale', 3, 'animal', 'critter', '🐋', { size: 'big' }),
    n('crab', 3, 'animal', 'critter', '🦀', { size: 'small' }), n('jellyfish', 3, 'animal', 'critter', '🪼', { size: 'small' }),
    n('submarine', 3, 'thing', 'vehicle', '🚢', { size: 'big' }), n('shell', 3, 'thing', 'object', '🐚', { size: 'small' }),
  ].map((e) => ({ ...e, pack: 'ocean' as Pack }))),
];

export interface VerbEntry {
  base: string; third: string; past: string; objectUse: 'T' | 'B' | 'I';
  clip: string; pack: Pack; gentle?: boolean;
}
const v = (base: string, third: string, past: string, objectUse: 'T' | 'B' | 'I', clip: string, pack: Pack = 'core', gentle = true): VerbEntry =>
  ({ base, third, past, objectUse, clip, pack, gentle });

// hid and slid are stored as hide and slide so every tense works (plan 13.3).
export const VERBS: VerbEntry[] = [
  v('chop', 'chops', 'chopped', 'T', 'chop'), v('climb', 'climbs', 'climbed', 'B', 'climb'),
  v('drink', 'drinks', 'drank', 'B', 'drink'), v('eat', 'eats', 'ate', 'B', 'eat'),
  v('fall', 'falls', 'fell', 'I', 'fall'), v('hide', 'hides', 'hid', 'B', 'hide'),
  v('jump', 'jumps', 'jumped', 'I', 'jump'), v('kick', 'kicks', 'kicked', 'T', 'kick'),
  v('mix', 'mixes', 'mixed', 'T', 'mix'), v('run', 'runs', 'ran', 'I', 'run'),
  v('sing', 'sings', 'sang', 'B', 'sing'), v('slide', 'slides', 'slid', 'I', 'slide'),
  v('spin', 'spins', 'spun', 'B', 'spin'), v('talk', 'talks', 'talked', 'I', 'talk'),
  v('walk', 'walks', 'walked', 'B', 'walk'),
  // Verbs her example sentences use.
  v('crawl', 'crawls', 'crawled', 'I', 'walk', 'example'), v('fly', 'flies', 'flew', 'I', 'fly', 'example'),
  v('swim', 'swims', 'swam', 'I', 'swim', 'example'), v('bounce', 'bounces', 'bounced', 'I', 'jump', 'example'),
  v('break', 'breaks', 'broke', 'B', 'break', 'example'), v('clean', 'cleans', 'cleaned', 'B', 'clean', 'example'),
  v('dust', 'dusts', 'dusted', 'B', 'clean', 'example'), v('cook', 'cooks', 'cooked', 'B', 'mix', 'example'),
  v('bake', 'bakes', 'baked', 'B', 'mix', 'example'), v('miss', 'misses', 'missed', 'B', 'miss', 'example'),
  v('land', 'lands', 'landed', 'I', 'fall', 'example'), v('melt', 'melts', 'melted', 'I', 'melt', 'example'),
  // Start of the Action Pack (the white cat / black cat example needs attack).
  v('attack', 'attacks', 'attacked', 'T', 'pounce', 'action', false), v('chase', 'chases', 'chased', 'T', 'chase', 'action'),
  v('hug', 'hugs', 'hugged', 'T', 'hug', 'action'),
  // Space pack.
  v('float', 'floats', 'floated', 'I', 'fly', 'space'), v('zoom', 'zooms', 'zoomed', 'I', 'run', 'space'),
  v('beep', 'beeps', 'beeped', 'I', 'talk', 'space'), v('orbit', 'orbits', 'orbited', 'B', 'spin', 'space'),
  // Ocean pack.
  v('dive', 'dives', 'dived', 'I', 'swim', 'ocean'), v('splash', 'splashes', 'splashed', 'I', 'jump', 'ocean'),
  v('tickle', 'tickles', 'tickled', 'T', 'hug', 'ocean'),
];

export type AdjKind = 'feeling' | 'size' | 'age' | 'look' | 'color';
export const ADJ_RANK: Record<AdjKind, number> = { feeling: 1, size: 2, age: 3, look: 4, color: 5 };
export interface AdjEntry { word: string; kind: AdjKind; pack: Pack }
const adj = (kind: AdjKind, pack: Pack, words: string) => words.split(' ').map((word) => ({ word, kind, pack }));

// Order of describing words: feeling, size, age, look, color (plan 3.13).
export const ADJECTIVES: AdjEntry[] = [
  ...adj('feeling', 'core', 'beautiful brave calm dazzling fancy gentle great handsome happy lazy plain polite pretty silly thankful'),
  ...adj('size', 'core', 'big small tiny chubby plump'),
  ...adj('age', 'core', 'young old new'),
  ...adj('look', 'core', 'bald'),
  ...adj('look', 'example', 'hard'),
  ...adj('color', 'color', 'red blue green yellow white black pink purple orange brown gray striped spotted'),
  ...adj('feeling', 'space', 'cosmic'), ...adj('look', 'space', 'shiny glowing'),
  ...adj('look', 'ocean', 'slimy sparkly soggy'),
];

export const ADVERBS: { word: string; pack: Pack }[] = [
  ...'gently innocently lightly loudly messily quickly quietly slowly softly swiftly tenderly warmly wildly zealously'.split(' ').map((word) => ({ word, pack: 'core' as Pack })),
  ...'proudly safely'.split(' ').map((word) => ({ word, pack: 'example' as Pack })),
  ...'weirdly silently'.split(' ').map((word) => ({ word, pack: 'space' as Pack })),
  ...'gracefully sneakily'.split(' ').map((word) => ({ word, pack: 'ocean' as Pack })),
];

export const PREPOSITIONS: string[] = 'above across along around below behind down from in into on over past through to under underneath up upon within at'.split(' ');
export const SUBJECT_PRONOUNS = ['I', 'you', 'he', 'she', 'it', 'we', 'they'] as const;
export const REFLEXIVE_PRONOUNS = ['itself', 'himself', 'herself', 'themselves', 'myself', 'yourself', 'ourselves'] as const;
export const ARTICLES = ['a', 'an', 'the'] as const;
// "nor" is left out of v1 (needs inverted word order, plan section 12).
export const CONJUNCTIONS = ['and', 'but', 'for', 'or'] as const;
export const INTERJECTIONS = ['Eek', 'Golly', 'Wow', 'Whew', 'Yuck', 'Phew'] as const;

// Conjunction pools by position (plan section 12, configurable).
export const CONJ_POOLS = {
  subject: ['and', 'or'], verb: ['and', 'or'], prep: ['and', 'or'],
  adverb: ['and', 'but', 'or'], clause: ['and', 'but', 'for'],
} as const;

export const nounByWord = new Map(NOUNS.map((x) => [x.word, x]));
export const verbByBase = new Map(VERBS.map((x) => [x.base, x]));
export const adjByWord = new Map(ADJECTIVES.map((x) => [x.word, x]));
export const adverbSet = new Set(ADVERBS.map((x) => x.word));
export const prepSet = new Set(PREPOSITIONS);
export const subjectPronounSet = new Set<string>(SUBJECT_PRONOUNS);
export const reflexiveSet = new Set<string>(REFLEXIVE_PRONOUNS);
export const interjectionSet = new Set<string>(INTERJECTIONS);

// Every word of a part of speech (for the generator and the word shelf).
export const nounsForTier = (tier: 1 | 2 | 3) => NOUNS.filter((x) => x.tier <= tier).map((x) => x.word);
