import { PROPER_NOUNS, SUBJECT_PRONOUNS, ADJECTIVES, ADVERBS, type WordOption } from './montessoriGrammar';
import { SANDBOX_VERBS } from './grammarContent';
import { SOUND_WORDS } from './soundContent';

// Sentence Formulas — Claudia's audit + expansion plan, direct teacher
// instruction: "The sentence formula development... should be
// developmental priorities" plus "Claudia should Audit the sentence
// formula concept and expand." The real gap her audit found: the shipped
// Mad Libs mode only had 2 slot types (noun/verb) and 6 invented
// templates, nothing like the teacher's own real curriculum document
// (docs/curriculum-reference/sentence-formulas/), which has 22 named
// formulas across 8 categories, phonics-leveled word banks, and a
// separate 4-step progressive build. This module is that real content,
// built as a genuinely new toolbar mode (kept separate from Mad Libs,
// which stays as-is for open silly random play) per Claudia's own
// mechanism recommendation — a curated, NAMED set of target structures
// is the whole pedagogical point here, which the tap-to-fill-blank
// mechanic (already proven by Mad Libs) can render directly without
// needing montessoriGrammar.ts's open-ended decision tree.
//
// Word banks reuse existing hand-verified content wherever possible
// (PROPER_NOUNS/SUBJECT_PRONOUNS/ADJECTIVES/ADVERBS from
// montessoriGrammar.ts, SANDBOX_VERBS from grammarContent.ts, the real
// CVC/CVCe words from soundContent.ts) rather than re-authoring — per
// Claudia's explicit "don't duplicate, tag tiers onto existing pools"
// engineering note.

export type FormulaSlotType =
  | 'who' | 'action' | 'what' | 'where' | 'when' | 'frequency'
  | 'description-adj' | 'description-adv' | 'indirect-object' | 'complement'
  | 'reflexive' | 'linking-verb' | 'question-word';

export type PhonicsTier = 'general' | 'cvc' | 'vce' | 'blends';

export interface FormulaWordOption extends WordOption {
  tier: PhonicsTier;
}

export type AuxType = 'do-does' | 'is-are' | 'is-not-are-not' | 'does-not-do-not';

export type FormulaSegment =
  | { kind: 'slot'; slot: FormulaSlotType; verbFormOverride?: 'base' }
  | { kind: 'fixed'; text: string }
  | { kind: 'aux'; auxType: AuxType };

export type FormulaCategory =
  | 'basic-action' | 'descriptive' | 'adverbial' | 'object'
  | 'existence-location' | 'command-request' | 'question' | 'negative';

export const FORMULA_CATEGORIES: { id: FormulaCategory; label: string; icon: string }[] = [
  { id: 'basic-action', label: 'Basic Action', icon: '🏃' },
  { id: 'descriptive', label: 'Descriptive', icon: '🎨' },
  { id: 'adverbial', label: 'Adverbial', icon: '⚡' },
  { id: 'object', label: 'Object', icon: '🎁' },
  { id: 'existence-location', label: 'Existence / Location', icon: '📍' },
  { id: 'command-request', label: 'Command / Request', icon: '🙋' },
  { id: 'question', label: 'Question', icon: '❓' },
  { id: 'negative', label: 'Negative', icon: '🚫' },
];

export interface SentenceFormula {
  id: string;
  name: string;
  category: FormulaCategory;
  segments: FormulaSegment[];
  punctuation: 'period' | 'question' | 'exclamation';
  examples: [string, string];
}

const slot = (s: FormulaSlotType, verbFormOverride?: 'base'): FormulaSegment => ({ kind: 'slot', slot: s, verbFormOverride });
const fixed = (text: string): FormulaSegment => ({ kind: 'fixed', text });
const aux = (auxType: AuxType): FormulaSegment => ({ kind: 'aux', auxType });

// The real 22 formulas, transcribed from Kayden's own Sentence Formulas
// Template 7 taxonomy (docs/curriculum-reference/sentence-formulas/
// README.md, pages 28-31) — no invented formulas. Worked examples use her
// own recurring characters (Yoga, Azalea, Xander, Geoff, Moxie, Ms.
// Kayden) for continuity with content she's already using in class.
export const SENTENCE_FORMULAS: SentenceFormula[] = [
  // Basic Action
  {
    id: 'simple-sentence', name: 'Simple Sentence', category: 'basic-action',
    segments: [slot('who'), slot('action'), fixed('.')], punctuation: 'period',
    examples: ['Yoga runs.', 'Azalea sleeps.'],
  },
  {
    id: 'simple-statement', name: 'Simple Statement', category: 'basic-action',
    segments: [slot('who'), slot('action'), slot('what'), fixed('.')], punctuation: 'period',
    examples: ['Xander eats cake.', 'Geoff kicks the ball.'],
  },
  {
    id: 'reflexive-sentence', name: 'Reflexive Sentence', category: 'basic-action',
    segments: [slot('who'), slot('action'), slot('reflexive'), fixed('.')], punctuation: 'period',
    examples: ['Xander sees himself.', 'Azalea washes herself.'],
  },
  // Descriptive (linking verbs)
  {
    id: 'what-is-it', name: 'What Is It?', category: 'descriptive',
    segments: [slot('who'), aux('is-are'), slot('description-adj'), fixed('.')], punctuation: 'period',
    examples: ['The cake is hot.', 'Moxie is silly.'],
  },
  {
    id: 'who-what-is-it', name: 'Who/What Is It?', category: 'descriptive',
    segments: [slot('who'), aux('is-are'), slot('what'), fixed('.')], punctuation: 'period',
    examples: ['Yoga is a wizard.', 'Geoff is my friend.'],
  },
  {
    id: 'where-is-it', name: 'Where Is It?', category: 'descriptive',
    segments: [slot('who'), aux('is-are'), slot('where'), fixed('.')], punctuation: 'period',
    examples: ['Azalea is at home.', 'The ball is under the tree.'],
  },
  {
    id: 'how-does-it-feel', name: 'How Does It Feel/Seem?', category: 'descriptive',
    segments: [slot('who'), slot('linking-verb'), slot('description-adj'), fixed('.')], punctuation: 'period',
    examples: ['Xander feels happy.', 'Moxie looks hungry.'],
  },
  // Adverbial
  {
    id: 'how-was-it-done', name: 'How Was It Done?', category: 'adverbial',
    segments: [slot('who'), slot('action'), slot('description-adv'), fixed('.')], punctuation: 'period',
    examples: ['Yoga teleported quickly.', 'Azalea sings happily.'],
  },
  {
    id: 'when-did-it-happen', name: 'When Did It Happen?', category: 'adverbial',
    segments: [slot('who'), slot('action'), slot('when'), fixed('.')], punctuation: 'period',
    examples: ['Geoff arrived yesterday.', 'Xander plays after school.'],
  },
  {
    id: 'where-did-it-happen', name: 'Where Did It Happen?', category: 'adverbial',
    segments: [slot('who'), slot('action'), slot('where'), fixed('.')], punctuation: 'period',
    examples: ['Moxie ran into the forest.', 'Azalea sleeps in her bed.'],
  },
  {
    id: 'why-or-how-often', name: 'Why or How Often?', category: 'adverbial',
    segments: [slot('who'), slot('action'), slot('frequency'), fixed('.')], punctuation: 'period',
    examples: ['Yoga practices often.', 'Geoff jokes all the time.'],
  },
  // Object
  {
    id: 'who-got-what', name: 'Who Got What?', category: 'object',
    segments: [slot('who'), slot('action'), slot('indirect-object'), slot('what'), fixed('.')], punctuation: 'period',
    examples: ['Mom gave Xander a cookie.', 'Ms. Kayden showed the class a trick.'],
  },
  {
    id: 'what-did-it-become', name: 'What Did It Become?', category: 'object',
    segments: [slot('who'), slot('action'), slot('what'), slot('complement'), fixed('.')], punctuation: 'period',
    examples: ['Yoga made Azalea happy.', 'The spell turned Moxie blue.'],
  },
  {
    id: 'what-did-someone-make', name: 'What Did Someone Make/Build?', category: 'object',
    segments: [slot('who'), slot('action'), slot('what'), fixed('for'), slot('indirect-object'), fixed('.')], punctuation: 'period',
    examples: ['Geoff built a fort for Xander.', 'Azalea baked a cake for Ms. Kayden.'],
  },
  // Existence / Location
  {
    id: 'there-is-are', name: 'There Is/Are Something', category: 'existence-location',
    segments: [fixed('There is/are'), slot('what'), fixed('.')], punctuation: 'period',
    examples: ['There is a dragon.', 'There are two cats.'],
  },
  {
    id: 'here-is-are', name: 'Here Is/Are Something', category: 'existence-location',
    segments: [fixed('Here is/are'), slot('what'), fixed('.')], punctuation: 'period',
    examples: ['Here is your book.', 'Here are the cookies.'],
  },
  // Command / Request
  {
    id: 'simple-command', name: 'Simple Command', category: 'command-request',
    segments: [fixed('(You)'), slot('action', 'base'), slot('what'), fixed('!')], punctuation: 'exclamation',
    examples: ['(You) close the door!', '(You) feed the dog!'],
  },
  {
    id: 'polite-request', name: 'Polite Request', category: 'command-request',
    segments: [fixed('Please'), slot('action', 'base'), slot('what'), fixed('.')], punctuation: 'period',
    examples: ['Please pass the ball.', 'Please help Azalea.'],
  },
  // Question
  {
    id: 'yes-no-question', name: 'Yes/No Question', category: 'question',
    segments: [aux('do-does'), slot('who'), slot('action', 'base'), fixed('?')], punctuation: 'question',
    examples: ['Does Yoga fly?', 'Do the dogs bark?'],
  },
  {
    id: 'wh-question', name: 'Wh- Question', category: 'question',
    segments: [slot('question-word'), aux('do-does'), slot('who'), slot('action', 'base'), fixed('?')], punctuation: 'question',
    examples: ['Where does Xander go?', 'What do the cats eat?'],
  },
  // Negative
  {
    id: 'simple-negative-action', name: 'Simple Negative Action', category: 'negative',
    segments: [slot('who'), aux('does-not-do-not'), slot('action', 'base'), fixed('.')], punctuation: 'period',
    examples: ['Geoff does not jump.', 'The dragons do not fly.'],
  },
  {
    id: 'simple-negative-description', name: 'Simple Negative Description', category: 'negative',
    segments: [slot('who'), aux('is-not-are-not'), slot('description-adj'), fixed('.')], punctuation: 'period',
    examples: ['Moxie is not scary.', 'The cats are not hungry.'],
  },
];

// The 4-step progressive build (README pages 2-3): a real, already-
// authored scaffold — WHO+ACTION, then one new slot at a time — kept
// separate from the 22 named formulas above rather than folded in as a
// 23rd, since its whole point is the step-by-step reveal, not a single
// target structure to name and practice.
export const PROGRESSIVE_BUILD_STEPS: { label: string; segments: FormulaSegment[] }[] = [
  { label: 'WHO + ACTION', segments: [slot('who'), slot('action')] },
  { label: '+ WHAT', segments: [slot('who'), slot('action'), slot('what')] },
  { label: '+ WHERE', segments: [slot('who'), slot('action'), slot('what'), slot('where')] },
  { label: '+ WHEN', segments: [slot('who'), slot('action'), slot('what'), slot('where'), slot('when')] },
];

function resolveVerbForm(who: string, whoBankAll: FormulaWordOption[]): 'singular' | 'plural' {
  const found = whoBankAll.find((w) => w.text === who);
  return found?.verbForm ?? 'singular';
}

// Auxiliary/function words render automatically once a WHO slot is
// filled — matching Claudia's build-step 8, "auto-render punctuation and
// auxiliary words... not student-fillable, no correctness check, just
// modeled correctly." Simplified to is/are (not is/was) and feels-only
// linking-verb agreement — a deliberate, logged scope trim, not a bug.
export function auxWordFor(auxType: AuxType, who: string | undefined, whoBankAll: FormulaWordOption[]): string {
  const form = who ? resolveVerbForm(who, whoBankAll) : 'singular';
  if (auxType === 'do-does') return form === 'singular' ? 'Does' : 'Do';
  if (auxType === 'is-are') return form === 'singular' ? 'is' : 'are';
  if (auxType === 'is-not-are-not') return form === 'singular' ? 'is not' : 'are not';
  return form === 'singular' ? 'does not' : 'do not';
}

// Word banks. Tiering is genuinely built out only where a phonics level
// naturally applies to real single-syllable words (WHO/WHAT/WHERE/
// DESCRIPTION-adj) — Claudia's audit named this the single biggest
// functional gap in the old Mad Libs pool. WHEN/FREQUENCY/DESCRIPTION-adv
// stay general-tier only: real adverbs of time/frequency and -ly adverbs
// are inherently multi-syllable, so forcing a CVC/VCe version would be
// unnatural rather than genuinely easier — a logged scope decision, not
// an oversight.
const g = (text: string, verbForm?: 'singular' | 'plural'): FormulaWordOption => ({ text, tier: 'general', verbForm });
const t = (tier: PhonicsTier) => (text: string, verbForm?: 'singular' | 'plural'): FormulaWordOption => ({ text, tier, verbForm });
const cvcOpt = t('cvc');
const vceOpt = t('vce');
const blendsOpt = t('blends');

export const WHO_WORDS: FormulaWordOption[] = [
  ...PROPER_NOUNS.map((p) => ({ ...p, tier: 'general' as PhonicsTier })),
  ...SUBJECT_PRONOUNS.map((p) => ({ ...p, tier: 'general' as PhonicsTier })),
  g('the teacher', 'singular'), g('the class', 'plural'),
  cvcOpt('the cat', 'singular'), cvcOpt('the dog', 'singular'), cvcOpt('the pig', 'singular'), cvcOpt('Sam', 'singular'), cvcOpt('Ben', 'singular'),
  vceOpt('the ape', 'singular'), vceOpt('Jake', 'singular'), vceOpt('Kate', 'singular'), vceOpt('Zane', 'singular'),
  blendsOpt('the skunk', 'singular'), blendsOpt('the frog', 'singular'), blendsOpt('Gwen', 'singular'), blendsOpt('Frank', 'singular'),
];

const cvcNouns = SOUND_WORDS.filter((w) => w.pattern === 'CVC' && !['sit', 'win'].includes(w.word)).map((w) => w.word);
const vceNouns = SOUND_WORDS.filter((w) => w.pattern === 'CVCe').map((w) => w.word);

export const WHAT_WORDS: FormulaWordOption[] = [
  g('a cookie'), g('a book'), g('a ball'), g('a trick'), g('cake'), g('a fort'), g('a story'), g('my homework'),
  ...cvcNouns.map((n) => cvcOpt(`a ${n}`)),
  ...vceNouns.map((n) => vceOpt(`a ${n}`)),
  blendsOpt('a sled'), blendsOpt('a crab'), blendsOpt('a flag'), blendsOpt('a drum'), blendsOpt('a stamp'),
];

export const WHERE_WORDS: FormulaWordOption[] = [
  g('home'), g('school'), g('the park'), g('the store'), g('outside'), g('the kitchen'), g('the yard'), g('under the tree'),
  cvcOpt('the tub'), cvcOpt('the hut'), cvcOpt('the den'),
  vceOpt('the lake'), vceOpt('the cave'),
  blendsOpt('the pond'), blendsOpt('the swamp'),
];

// WHEN/FREQUENCY — general-tier only, see header comment.
export const WHEN_WORDS: FormulaWordOption[] = [
  'today', 'tomorrow', 'yesterday', 'tonight', 'this morning', 'after school', 'at noon', 'on Monday',
].map((text) => g(text));

export const FREQUENCY_WORDS: FormulaWordOption[] = [
  'always', 'never', 'often', 'sometimes', 'usually', 'rarely', 'every day', 'all the time',
].map((text) => g(text));

export const DESCRIPTION_ADJ_WORDS: FormulaWordOption[] = [
  ...ADJECTIVES.map((a) => ({ ...a, tier: 'general' as PhonicsTier })),
  cvcOpt('hot'), cvcOpt('sad'), cvcOpt('big'), cvcOpt('wet'), cvcOpt('mad'),
  vceOpt('cute'), vceOpt('late'), vceOpt('wide'),
  blendsOpt('fresh'), blendsOpt('swift'), blendsOpt('grand'),
];

// DESCRIPTION-adv — general-tier only, see header comment.
export const DESCRIPTION_ADV_WORDS: FormulaWordOption[] = ADVERBS.map((a) => ({ ...a, tier: 'general' as PhonicsTier }));

export const INDIRECT_OBJECT_WORDS: FormulaWordOption[] = WHO_WORDS;

export const COMPLEMENT_WORDS: FormulaWordOption[] = DESCRIPTION_ADJ_WORDS;

export const REFLEXIVE_WORDS: FormulaWordOption[] = ['himself', 'herself', 'itself', 'themselves'].map((text) => g(text));

export const LINKING_VERB_WORDS: FormulaWordOption[] = ['feels', 'seems', 'looks'].map((text) => g(text));
export const LINKING_VERB_WORDS_PLURAL: FormulaWordOption[] = ['feel', 'seem', 'look'].map((text) => g(text));

export const QUESTION_WORDS: FormulaWordOption[] = ['Who', 'What', 'Where', 'When', 'Why', 'How'].map((text) => g(text));

export function wordBankFor(slotType: FormulaSlotType, tier: PhonicsTier, whoVerbForm: 'singular' | 'plural' | null): FormulaWordOption[] {
  const byTier = (bank: FormulaWordOption[]) => bank.filter((w) => w.tier === tier || tier === 'general');
  switch (slotType) {
    case 'who': return byTier(WHO_WORDS);
    case 'what': return byTier(WHAT_WORDS);
    case 'where': return byTier(WHERE_WORDS);
    case 'when': return WHEN_WORDS;
    case 'frequency': return FREQUENCY_WORDS;
    case 'description-adj': return byTier(DESCRIPTION_ADJ_WORDS);
    case 'description-adv': return DESCRIPTION_ADV_WORDS;
    case 'indirect-object': return byTier(INDIRECT_OBJECT_WORDS);
    case 'complement': return byTier(COMPLEMENT_WORDS);
    case 'reflexive': return REFLEXIVE_WORDS;
    case 'linking-verb': return whoVerbForm === 'plural' ? LINKING_VERB_WORDS_PLURAL : LINKING_VERB_WORDS;
    case 'question-word': return QUESTION_WORDS;
    case 'action': return []; // resolved from SANDBOX_VERBS by the sandbox component, agreement-aware
  }
}

export function actionWordsFor(whoVerbForm: 'singular' | 'plural' | null, override?: 'base'): { text: string }[] {
  const form = override === 'base' ? 'plural' : (whoVerbForm ?? 'plural');
  return SANDBOX_VERBS.filter((v) => v.number === form).map((v) => ({ text: v.text }));
}

// Slot type -> Montessori shape/color, built on the existing palette
// (no new colors invented) so the same badge means the same thing here
// and in the Sentence Builder / Word Matrix tools, per Claudia's
// convergence recommendation — shown as a secondary badge, with her own
// WHO/ACTION/WHAT/... label staying the primary text on each blank.
export const SLOT_MONTESSORI_CLASS: Record<FormulaSlotType, 'noun' | 'pronoun' | 'verb' | 'adjective' | 'adverb' | 'preposition' | null> = {
  who: 'noun',
  action: 'verb',
  what: 'noun',
  'indirect-object': 'noun',
  complement: 'adjective',
  reflexive: 'pronoun',
  where: 'preposition',
  when: 'adverb',
  frequency: 'adverb',
  'description-adj': 'adjective',
  'description-adv': 'adverb',
  'linking-verb': 'verb',
  'question-word': null,
};

// Direct teacher instruction: "description words in drop down needs to
// be evaluated, sometimes the required description is an adverb, not
// an adjective (and vice versa) use context clues and ensure the word
// lists are accurate." The word banks themselves were already correct
// per-position (description-adj only ever fills a predicate-adjective
// slot, description-adv only ever fills a describes-the-action slot —
// verified against every formula in SENTENCE_FORMULAS above), but both
// shared the identical "DESCRIPTION" label, giving a student no
// context clue for why one blank's dropdown offers adjectives (hot,
// big, silly...) and another's offers adverbs (quickly, sadly...).
// Split into two distinct, short labels so the word class is legible
// at a glance: DESCRIBE (adjective — describes a person/thing) vs.
// HOW (adverb — describes how the action was done), matching the
// "adverbs answer how/when/where" convention this population is
// already taught. complement shares DESCRIBE since it's the same word
// class (a predicate adjective), just a different grammatical role.
export const SLOT_LABELS: Record<FormulaSlotType, string> = {
  who: 'WHO', action: 'ACTION', what: 'WHAT', where: 'WHERE', when: 'WHEN', frequency: 'FREQUENCY',
  'description-adj': 'DESCRIBE', 'description-adv': 'HOW', 'indirect-object': 'WHO',
  complement: 'DESCRIBE', reflexive: 'REFLEXIVE', 'linking-verb': 'feels/seems/looks', 'question-word': 'Wh-',
};
