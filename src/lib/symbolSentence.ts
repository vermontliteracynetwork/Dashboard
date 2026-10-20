// Symbol sentence question sets (Build Queue 253): her grammar symbols, definitions, a kid word list for
// the randomizer dice, and the grammar check ("That's not a verb, try again.").
// Symbols, colors and definitions match her Literacy Manipulatives whiteboard (the same ten pictures).
import type { SymbolPos, SymbolQuestion, SymbolSettings, SymbolSlot } from '../types';
import { NOUNS, VERBS, ADJECTIVES as GUS_ADJ, ADVERBS as GUS_ADV, PREPOSITIONS, SUBJECT_PRONOUNS, ARTICLES, CONJUNCTIONS, INTERJECTIONS } from '../games/grammarGus/data/wordbank';
import { PROPER_NOUN_WORDS } from '../games/grammarGus/data/extraNouns';
import { IRREGULAR_PAST } from '../games/grammarGus/data/irregularVerbs';
import { SYMBOL_SENTENCE_PAGES } from './symbolDeck';

export const SYMBOLS: Record<SymbolPos, { name: string; def: string; color: string; img?: string }> = {
  article: { name: 'Article', def: 'Refers to nouns (a, an, the)', color: '#F0B0C8', img: '/literacy/symbols/article.png' },
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
export const DEFAULT_SYMBOL_SETTINGS: SymbolSettings = { dice: true, spellCheck: false, grammarCheck: true };
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
PREPOSITIONS.forEach((w) => add(w, 'preposition'));
[...SUBJECT_PRONOUNS, 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their', 'its'].forEach((w) => add(w, 'pronoun', (SUBJECT_PRONOUNS as readonly string[]).includes(w)));
ARTICLES.forEach((w) => add(w, 'article'));
[...CONJUNCTIONS, 'because', 'so', 'yet', 'nor'].forEach((w) => add(w, 'conjunction'));
INTERJECTIONS.forEach((w) => add(w, 'interjection'));
// Her own 43 symbol sentences count too (cat, ran, small...).
SYMBOL_SENTENCE_PAGES.forEach((p) => p.sentences.forEach((s) => s.words.forEach((w) => add(w.word.replace(/[.,!?]/g, ''), w.wordClass, false))));

export function posesOf(word: string): Set<SymbolPos> | null {
  const k = word.trim().toLowerCase().replace(/[.,!?]+$/, '');
  return LEX.get(k) ?? null;
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
export function sentenceToSlots(text: string): SymbolSlot[] {
  const parts = text.match(/[A-Za-z0-9'’-]+|[.!?]/g) ?? [];
  return parts.map((w, i) => ({ pos: guessPos(w, i), word: w, given: true }));
}
export const randomWord = (pos: SymbolPos, not?: string) => {
  const pool = POOL[pos].filter((w) => w.toLowerCase() !== (not ?? '').toLowerCase());
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '';
};

// The grammar check for one typed word: null when it fits, otherwise a kind message.
export function grammarProblem(word: string, slot: SymbolSlot): string | null {
  const w = word.trim();
  if (!w) return `Type a ${SYMBOLS[slot.pos].name.toLowerCase()}.`;
  if (w.toLowerCase() === slot.word.trim().toLowerCase()) return null;
  const p = posesOf(w);
  const name = SYMBOLS[slot.pos].name.toLowerCase();
  const an = /^[aeiou]/.test(name) ? 'an' : 'a';
  if (slot.pos === 'propernoun') return /^[A-Z]/.test(w) ? null : 'A proper noun starts with a capital letter. Try again.';
  if (p) {
    if (p.has(slot.pos)) return null;
    if (slot.pos === 'noun' && p.has('propernoun')) return null;
    return `That's not ${an} ${name}. ${SYMBOLS[slot.pos].name}: ${SYMBOLS[slot.pos].def.toLowerCase()}. Try again.`;
  }
  // A word we do not know: the endings give a hint, otherwise it gets the benefit of the doubt.
  if (slot.pos === 'adverb' && !/ly$/i.test(w) && /(ed|ing)$/i.test(w)) return `That looks like a verb, not ${an} ${name}. Try again.`;
  if (slot.pos === 'adjective' && /ly$/i.test(w)) return `That looks like an adverb, not ${an} ${name}. Try again.`;
  return null;
}

export const fullSentence = (slots: SymbolSlot[], words?: Record<number, string>) =>
  slots.map((s, i) => (words && !s.given ? words[i] ?? '' : s.word)).join(' ').replace(/\s+([.!?,])/g, '$1').trim();

export const blankSymbolQuestion = (id: string, settings: SymbolSettings = DEFAULT_SYMBOL_SETTINGS): SymbolQuestion => ({ id, kind: 'symbol', prompt: 'Finish the symbol sentence.', slots: [], settings: { ...settings } });

// ---------- typed-answer help (Build Queue 273) ----------
export const isKnownWord = (word: string) => posesOf(word) !== null;
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
