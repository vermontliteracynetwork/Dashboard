// Symbol sentence question sets (Build Queue 253): her grammar symbols, definitions, a kid word list for
// the randomizer dice, and the grammar check ("That's not a verb, try again.").
// Symbols, colors and definitions match her Literacy Manipulatives whiteboard (the same ten pictures).
import type { SymbolMode, SymbolPos, SymbolQuestion, SymbolSettings, SymbolSlot } from '../types';
import type { BankFormula } from './formulaBank';
import { NOUNS, VERBS, ADJECTIVES as GUS_ADJ, ADVERBS as GUS_ADV, PREPOSITIONS, SUBJECT_PRONOUNS, ARTICLES, CONJUNCTIONS, INTERJECTIONS } from '../games/grammarGus/data/wordbank';
import { PROPER_NOUN_WORDS } from '../games/grammarGus/data/extraNouns';
import { IRREGULAR_PAST } from '../games/grammarGus/data/irregularVerbs';
import { SYMBOL_SENTENCE_PAGES } from './symbolDeck';
import { fitsType, isDictionaryWord, loadWordTypes, readSentence, typeList, typesOf } from './wordTypes';

export const SYMBOLS: Record<SymbolPos, { name: string; def: string; color: string; img?: string }> = {
  article: { name: 'Article', def: 'Refers to nouns (a, an, the)', color: '#F0B0C8', img: '/literacy/symbols/article-triangle.svg' },
  adjective: { name: 'Adjective', def: 'Describes nouns (details for things you can touch)', color: '#48B8E0', img: '/literacy/symbols/adjective.png' },
  noun: { name: 'Noun', def: 'Person, place, thing, animal', color: '#D02028', img: '/literacy/symbols/noun.png' },
  propernoun: { name: 'Proper noun', def: 'A specific noun (it has a name)', color: '#D02028', img: '/literacy/symbols/propernoun.png' },
  verb: { name: 'Verb', def: 'Action word', color: '#40A870', img: '/literacy/symbols/verb.png' },
  adverb: { name: 'Adverb', def: 'Describes verbs and adjectives', color: '#1868A8', img: '/literacy/symbols/adverb.png' },
  pronoun: { name: 'Pronoun', def: 'Replaces a noun', color: '#E8C800', img: '/literacy/symbols/pronoun.png' },
  preposition: { name: 'Preposition', def: 'Identifies time, place, or direction', color: '#703818', img: '/literacy/symbols/preposition.png' },
  conjunction: { name: 'Conjunction', def: 'Connecting words', color: '#9870B8', img: '/literacy/symbols/conjunction.png' },
  interjection: { name: 'Interjection', def: 'Something you shout; interrupting words or phrases', color: '#F87220', img: '/literacy/symbols/interjection.png' },
  punctuation: { name: 'Punctuation', def: 'Ends the sentence (. ? !)', color: '#9CA3AF' },
};
export const SYMBOL_ORDER: SymbolPos[] = ['article', 'adjective', 'noun', 'propernoun', 'verb', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'punctuation'];
export const DEFAULT_SYMBOL_SETTINGS: SymbolSettings = { dice: true, spellCheck: false, grammarCheck: true, capitalCheck: false, punctuationCheck: false };
// Dark text on the light symbol colors, white on the rest.
export const inkOn = (pos: SymbolPos) => (['article', 'adjective', 'pronoun', 'punctuation'].includes(pos) ? '#231b33' : '#ffffff');

// ---------- the word list: word -> the parts of speech it can be ----------
const LEX = new Map<string, Set<SymbolPos>>();
const POOL: Record<SymbolPos, string[]> = { article: [], adjective: [], noun: [], propernoun: [], verb: [], adverb: [], pronoun: [], preposition: [], conjunction: [], interjection: [], punctuation: ['.', '!', '?'] };
const add = (word: string, pos: SymbolPos, pool = true) => {
  const w = word.trim(); if (!w) return;
  const k = w.toLowerCase();
  (LEX.get(k) ?? LEX.set(k, new Set()).get(k)!).add(pos);
  if (pool && !POOL[pos].includes(w)) POOL[pos].push(w);
};
NOUNS.filter((n) => !n.proper && n.pack === 'core').forEach((n) => add(n.word, 'noun'));
NOUNS.filter((n) => !n.proper && n.pack !== 'core').forEach((n) => add(n.word, 'noun', false));
NOUNS.filter((n) => n.proper).forEach((n) => add(n.word, 'propernoun'));
PROPER_NOUN_WORDS.forEach((w) => add(w, 'propernoun'));
VERBS.forEach((v) => { add(v.past, 'verb', v.pack === 'core'); [v.base, v.third].forEach((f) => add(f, 'verb', false)); add(v.base.endsWith('e') ? `${v.base.slice(0, -1)}ing` : `${v.base}ing`, 'verb', false); });
Object.entries(IRREGULAR_PAST).forEach(([base, past]) => { add(base, 'verb', false); add(past, 'verb', false); });
['is', 'are', 'was', 'were', 'am', 'be', 'has', 'have', 'had', 'did', 'does', 'do', 'went', 'go', 'goes', 'said', 'saw', 'made', 'played', 'looked', 'walked', 'danced', 'swam', 'flew', 'read', 'wrote', 'slept'].forEach((w) => add(w, 'verb', false));
GUS_ADJ.forEach((a) => add(a.word, 'adjective', a.pack === 'core' || a.pack === 'color'));
GUS_ADV.forEach((a) => add(a.word, 'adverb', a.pack === 'core'));
// Everyday adverbs the word bank lacks (so "very" is not guessed as a noun when a sentence is typed in).
['very', 'really', 'too', 'quite', 'always', 'never', 'often', 'soon', 'here', 'there', 'now', 'then', 'today', 'almost'].forEach((w) => add(w, 'adverb', false));
PREPOSITIONS.forEach((w) => add(w, 'preposition'));
[...SUBJECT_PRONOUNS, 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'its'].forEach((w) => add(w, 'pronoun', (SUBJECT_PRONOUNS as readonly string[]).includes(w)));
ARTICLES.forEach((w) => add(w, 'article'));
[...CONJUNCTIONS, 'because', 'so', 'yet', 'nor'].forEach((w) => add(w, 'conjunction'));
INTERJECTIONS.forEach((w) => add(w, 'interjection'));
// Her own 43 symbol sentences count too (cat, ran, small...).
SYMBOL_SENTENCE_PAGES.forEach((p) => p.sentences.forEach((s) => s.words.forEach((w) => add(w.word.replace(/[.,!?]/g, ''), w.wordClass, false))));

const boardPoses = (word: string) => LEX.get(word.trim().toLowerCase().replace(/[.,!?]+$/, '')) ?? null;
// Every type a word can be: the board's word lists plus the dictionary (Build Queue 597, src/lib/wordTypes.ts).
export function posesOf(word: string): Set<SymbolPos> | null {
  const board = boardPoses(word), dict = typesOf(word);
  if (!board && !dict) return null;
  return new Set<SymbolPos>([...(board ?? []), ...(dict?.all ?? [])]);
}
// Best guess for the teacher's "type a sentence" quick start (she can change any symbol).
export function guessPos(word: string, i: number): SymbolPos {
  if (/^[.!?]$/.test(word)) return 'punctuation';
  const p = posesOf(word);
  const order: SymbolPos[] = ['article', 'pronoun', 'preposition', 'conjunction', 'interjection', 'verb', 'adverb', 'adjective', 'noun', 'propernoun'];
  if (p) { for (const o of order) if (p.has(o)) return o; }
  if (i > 0 && /^[A-Z]/.test(word)) return 'propernoun';
  if (/ly$/i.test(word)) return 'adverb';
  if (/(ed|ing)$/i.test(word)) return 'verb';
  return 'noun';
}
// The teacher's typed sentence: each word's symbol is read from the dictionary and its neighbors ("a jump", "they jump").
export function sentenceToSlots(text: string): SymbolSlot[] {
  const parts = text.match(/[A-Za-z0-9'’-]+|[.!?]/g) ?? [];
  const wordsOnly = parts.filter((w) => !/^[.!?]$/.test(w));
  const read = readSentence(wordsOnly);
  let k = 0;
  return parts.map((w) => (/^[.!?]$/.test(w) ? { pos: 'punctuation' as SymbolPos, word: w, given: true } : { pos: read[k++] as SymbolPos, word: w, given: true }));
}
export const randomWord = (pos: SymbolPos, not?: string) => {
  const pool = POOL[pos].filter((w) => w.toLowerCase() !== (not ?? '').toLowerCase());
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
};

// Build Queue 342 (her words: "grammar and spell check is wrong for many words and it is frustrating to students"):
// a real English dictionary (275,000 words, public/words/english.txt, MIT licence) decides spelling, loaded once on the
// first typed question. Until it arrives every word gets the benefit of the doubt.
let DICT: Set<string> | null = null;
let dictLoading: Promise<void> | null = null;
export function loadDictionary(): Promise<void> {
  if (DICT || dictLoading) return dictLoading ?? Promise.resolve();
  void loadWordTypes();
  dictLoading = fetch('/words/english.txt').then((r) => (r.ok ? r.text() : '')).then((t) => { if (t) DICT = new Set(t.split('\n')); }).catch(() => {});
  return dictLoading;
}
export const isRealWord = (word: string) => {
  const k = word.trim().toLowerCase().replace(/[.,!?]+$/, '').replace(/[’]/g, "'");
  if (!k || LEX.has(k) || isDictionaryWord(k)) return true;
  if (!DICT) return true;
  return DICT.has(k) || DICT.has(k.replace(/'s$/, '')) || /^\d+$/.test(k);
};

// The grammar check for one typed word: null when it fits, otherwise a kind message. Build Queue 597: the word is looked
// up in a real dictionary (WordNet, then a live dictionary), so the message can say what the word is ("happy" is an
// adjective, not a verb). A word no dictionary knows gets the benefit of the doubt (the spelling check asks about it).
export function grammarProblem(word: string, slot: SymbolSlot): string | null {
  const w = word.trim();
  if (!w) return `Type a ${SYMBOLS[slot.pos].name.toLowerCase()}.`;
  if (w.toLowerCase() === slot.word.trim().toLowerCase()) return null;
  const name = SYMBOLS[slot.pos].name.toLowerCase();
  const an = /^[aeiou]/.test(name) ? 'an' : 'a';
  if (slot.pos === 'propernoun') return /^[A-Z]/.test(w) ? null : 'A proper noun starts with a capital letter. Try again.';
  const board = boardPoses(w);
  if (board && (board.has(slot.pos) || (slot.pos === 'noun' && board.has('propernoun')))) return null;
  if (fitsType(w, slot.pos as Exclude<SymbolPos, 'punctuation'>) !== 'no') return null;
  const t = typesOf(w)!;
  return `"${w}" is ${typeList(t.common.length ? t.common : t.all)}, not ${an} ${name}. ${SYMBOLS[slot.pos].name}: ${SYMBOLS[slot.pos].def.toLowerCase()}. Try again.`;
}

export const fullSentence = (slots: SymbolSlot[], words?: Record<number, string>) =>
  slots.map((s, i) => (words && !s.given ? words[i] ?? '' : s.word)).join(' ').replace(/\s+([.!?,])/g, '$1').trim();

// A new sentence starts as four empty boxes and the punctuation (Build Queue 494): the teacher adds symbols and words,
// and anything she leaves empty is the student's to fill.
// How many boxes go on one row: up to 6, and a long sentence splits into even rows so the boxes stay big enough to read.
export const perRow = (n: number) => (n <= 6 ? Math.max(1, n) : Math.ceil(n / Math.ceil(n / 6)));
export const emptySlot = (): SymbolSlot => ({ pos: 'noun', word: '', given: false, pick: true });
export const punctSlot = (mark = '.', given = false): SymbolSlot => ({ pos: 'punctuation', word: mark, given });
// The three Symbolic Grammar question kinds (Build Queue 502). Older sets have no mode: a set with empty symbol boxes
// reads as Drag and drop, everything else as Fill in the blank.
export const modeOf = (q: SymbolQuestion): SymbolMode => q.mode ?? (q.slots.some((s) => s.pick) ? 'drag' : 'fill');
export const MODE_INFO: Record<SymbolMode, { icon: string; label: string; prompt: string; hint: string }> = {
  fill: { icon: '✏️', label: 'Fill in the blank', prompt: 'Fill in the blank.', hint: 'Every grammar symbol shows. Solid words are given; the student types the outline words.' },
  drag: { icon: '🧩', label: 'Drag and drop', prompt: 'Drag the grammar symbols into the boxes.', hint: 'The student drags a grammar symbol into every empty box. Symbols and words you place stay; the boxes can also all be blank.' },
  picture: { icon: '🖼️', label: 'Picture response', prompt: 'Make a sentence about the picture.', hint: 'Add a picture. The student makes a sentence about it with your formula, or picks one of your formula options.' },
};
const CONTENT: SymbolPos[] = ['noun', 'propernoun', 'verb', 'adjective', 'adverb'];
// A formula from her bank as boxes, set up for each kind: fill gives the small words and leaves the naming, doing and
// describing words for the student; drag gives every word and leaves every symbol box empty; picture leaves every word
// and the punctuation for the student.
export function bankSlots(f: BankFormula, mode: SymbolMode): SymbolSlot[] {
  return f.words.map(([word, pos]) => {
    if (pos === 'punctuation') return punctSlot(word, mode !== 'picture');
    if (mode === 'drag') return { pos, word, given: true, pick: true };
    if (mode === 'picture') return { pos, word, given: false };
    return { pos, word, given: !CONTENT.includes(pos) };
  });
}
export const blankSymbolQuestion = (id: string, settings: SymbolSettings = DEFAULT_SYMBOL_SETTINGS, mode: SymbolMode = 'fill'): SymbolQuestion => ({
  id, kind: 'symbol', mode, prompt: MODE_INFO[mode].prompt, settings: { ...settings },
  slots: mode === 'drag' ? [emptySlot(), emptySlot(), emptySlot(), emptySlot(), punctSlot('.', true)] : [punctSlot('.', mode === 'fill')],
});
// Does a grammar symbol fit a word the teacher gave (the student picked the symbol)? Words the app does not know get
// the benefit of the doubt, like the grammar check.
export function symbolFits(word: string, pos: SymbolPos, first: boolean): boolean {
  const w = word.trim(), board = boardPoses(w);
  if (pos === 'punctuation') return false;
  if (pos === 'propernoun' && /^[A-Z]/.test(w) && (!first || !posesOf(w))) return true;
  if (board && (board.has(pos) || (pos === 'noun' && board.has('propernoun')))) return true;
  const fit = fitsType(w, pos, true);
  return fit === 'yes' || (fit === 'unknown' && !board);
}

// ---------- typed-answer help (Build Queue 273) ----------
export const isKnownWord = (word: string) => posesOf(word) !== null || isRealWord(word);
const dist = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
// Close spellings of a word that are this part of speech (the level 3 correction list).
export function suggestWords(word: string, pos: SymbolPos, n = 4): string[] {
  const w = word.trim().toLowerCase(); if (!w) return [];
  const max = w.length <= 4 ? 1 : 2;
  const out: [string, number][] = [];
  LEX.forEach((poses, k) => { if ((poses.has(pos) || (pos === 'noun' && poses.has('propernoun'))) && Math.abs(k.length - w.length) <= max) { const dd = dist(w, k); if (dd > 0 && dd <= max) out.push([k, dd]); } });
  return out.sort((a, b) => a[1] - b[1]).slice(0, n).map(([k]) => (pos === 'propernoun' ? k[0].toUpperCase() + k.slice(1) : k));
}
// A few example words of a kind, for the Help hint (any fitting word counts, so this never gives the answer away).
export const examplesFor = (pos: SymbolPos, n = 3) => [...POOL[pos]].sort(() => Math.random() - 0.5).slice(0, n);
