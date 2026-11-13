// The Symbolic Grammar Engine (her request 2026-11-13: "use the same grammar engine for all my ongoing projects for
// symbolic grammar and literacy manipulatives"). This file used to hold the dashboard's own copy of the word type
// engine (Build Queue 597). Now every word's type comes from the one shared engine,
// github.com/vermontliteracynetwork/symbolic-grammar-engine (pinned in package.json, the same commit as Literacy
// Manipulatives), so a word gets the same symbol in every project. Its rules are in the engine's RULES.md, and its
// checks run before every build here (scripts/engine-check.mjs).
//
// The names below stay the same, so the screens that use them (symbol sentences, Word Tools, the Symbol Set editor)
// did not change:
//   typesOf(word)        what a word can be: { all, common } (WordNet's rare uses are left out of common)
//   fitsType(word, pos)  does a student's word fit this symbol ('yes', 'no', 'unknown')
//   readSentence(words)  each word's symbol, read in context with its neighbors
// The dashboard keeps its live dictionary lookups (Build Queue 597/598) and its own symbol pictures.
import {
  configureEngine, fitsJob, isKnown, jobsDetail, loadEngine, readWords,
  lookUpWords, onWordTypes, rememberTypes, typeOfPart, type SymbolWordClass,
} from 'symbolic-grammar-engine';

configureEngine({ dataUrl: '/writer', liveLookups: true });

export type WordType = SymbolWordClass;
export { lookUpWords, onWordTypes, rememberTypes, typeOfPart };

// Loads the engine's word lists (copied to public/writer before dev and build).
export const loadWordTypes = (): Promise<void> => loadEngine();

export interface WordTypes { all: WordType[]; common: WordType[]; from: 'dictionary' | 'online' | 'ending' }
// Every type a word can be (most common first), or null when no word list knows it.
export function typesOf(raw: string): WordTypes | null {
  const d = jobsDetail(raw);
  return d ? { all: d.all, common: d.common, from: 'dictionary' } : null;
}
// Is it a real word any word list here knows (null while the lists are still loading)?
export const isDictionaryWord = (raw: string): boolean | null => isKnown(raw);

// Plain names for the types a word is.
export const TYPE_NAME: Record<WordType, string> = {
  article: 'an article', adjective: 'an adjective', noun: 'a noun', propernoun: 'a proper noun', verb: 'a verb', adverb: 'an adverb',
  pronoun: 'a pronoun', preposition: 'a preposition', conjunction: 'a conjunction', interjection: 'an interjection',
};
export const typeList = (types: WordType[]) => {
  const n = types.slice(0, 3).map((t) => TYPE_NAME[t]);
  return n.length < 2 ? n[0] ?? '' : `${n.slice(0, -1).join(', ')} or ${n[n.length - 1]}`;
};

// Does a student's word do this job? wholeTypes also counts a word's rare uses (a teacher-given word).
export function fitsType(raw: string, want: WordType, wholeTypes = false): 'yes' | 'no' | 'unknown' {
  if (wholeTypes && typesOf(raw)?.all.includes(want)) return 'yes';
  return fitsJob(raw, want);
}

// A sentence as a list of words: each word's symbol, read in context by the engine ("a jump" is a noun, "they jump" a verb).
export const readSentence = (list: string[]): WordType[] => readWords(list);
