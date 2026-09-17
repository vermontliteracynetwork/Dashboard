import type { GrammarPiece } from '../types';

// Literacy Workspace — open-exploration sandbox. Direct teacher
// instruction: no rungs, no mastery gating, no rewards, no assignment
// structure — just a pool of draggable word pieces a student can pull
// onto an open canvas and snap together into silly, nonsense-but-
// grammatically-correct sentences, the "long lists of words, silly fun
// concepts" the very first brief for this feature asked for. Content
// grounded in the teacher's own uploaded Sentence Formulas curriculum
// (docs/curriculum-reference/sentence-formulas/) — same proper nouns,
// common nouns, and verbs from that document's word lists, plus her own
// established classroom characters (Yoga, Azalea, Xander, Geoff, Moxie)
// for continuity with content she's already using.
function piece(id: string, text: string, wordClass: 'noun' | 'verb', number: 'singular' | 'plural'): GrammarPiece {
  return { id, text, wordClass, number };
}

// Every noun is singular; a piece with number 'plural' is a genuinely
// different plural noun (not a second form of the same singular one) —
// unlike the old Rung 1 content, there's no fixed "correct pairing" to
// hit here, ANY noun and verb that agree in number are meant to snap.
export const SANDBOX_NOUNS: GrammarPiece[] = [
  piece('n-mom', 'Mom', 'noun', 'singular'),
  piece('n-dad', 'Dad', 'noun', 'singular'),
  piece('n-kayden', 'Ms. Kayden', 'noun', 'singular'),
  piece('n-mia', 'Mia', 'noun', 'singular'),
  piece('n-uncle-bill', 'Uncle Bill', 'noun', 'singular'),
  piece('n-yoga', 'Yoga', 'noun', 'singular'),
  piece('n-azalea', 'Azalea', 'noun', 'singular'),
  piece('n-xander', 'Xander', 'noun', 'singular'),
  piece('n-geoff', 'Geoff', 'noun', 'singular'),
  piece('n-moxie', 'Moxie the fox', 'noun', 'singular'),
  piece('n-dog', 'the dog', 'noun', 'singular'),
  piece('n-cat', 'the cat', 'noun', 'singular'),
  piece('n-teacher', 'my teacher', 'noun', 'singular'),
  piece('n-wizard', 'the wizard', 'noun', 'singular'),
  piece('n-dragon', 'a dragon', 'noun', 'singular'),
  piece('n-robot', 'a robot', 'noun', 'singular'),
  piece('n-dogs', 'the dogs', 'noun', 'plural'),
  piece('n-cats', 'the cats', 'noun', 'plural'),
  piece('n-children', 'the children', 'noun', 'plural'),
  piece('n-class', 'our class', 'noun', 'plural'),
  piece('n-wizards', 'the wizards', 'noun', 'plural'),
  piece('n-dragons', 'the dragons', 'noun', 'plural'),
];

export const SANDBOX_VERBS: GrammarPiece[] = [
  piece('v-run-sg', 'runs', 'verb', 'singular'),
  piece('v-run-pl', 'run', 'verb', 'plural'),
  piece('v-play-sg', 'plays', 'verb', 'singular'),
  piece('v-play-pl', 'play', 'verb', 'plural'),
  piece('v-sleep-sg', 'sleeps', 'verb', 'singular'),
  piece('v-sleep-pl', 'sleep', 'verb', 'plural'),
  piece('v-kick-sg', 'kicks', 'verb', 'singular'),
  piece('v-kick-pl', 'kick', 'verb', 'plural'),
  piece('v-eat-sg', 'eats', 'verb', 'singular'),
  piece('v-eat-pl', 'eat', 'verb', 'plural'),
  piece('v-work-sg', 'works', 'verb', 'singular'),
  piece('v-work-pl', 'work', 'verb', 'plural'),
  piece('v-arrive-sg', 'arrives', 'verb', 'singular'),
  piece('v-arrive-pl', 'arrive', 'verb', 'plural'),
  piece('v-teleport-sg', 'teleports', 'verb', 'singular'),
  piece('v-teleport-pl', 'teleport', 'verb', 'plural'),
  piece('v-wiggle-sg', 'wiggles', 'verb', 'singular'),
  piece('v-wiggle-pl', 'wiggle', 'verb', 'plural'),
  piece('v-pounce-sg', 'pounces', 'verb', 'singular'),
  piece('v-pounce-pl', 'pounce', 'verb', 'plural'),
];

export const SANDBOX_PIECES: GrammarPiece[] = [...SANDBOX_NOUNS, ...SANDBOX_VERBS];
