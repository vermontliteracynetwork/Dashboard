import type { Pos, Tense, Token } from './types';
import type { Pattern } from '../data/patterns';
import { VERBS, interjectionSet } from '../data/wordbank';

// Turns one of the teacher's example sentences (or any sentence written in
// her symbol order) into rail tokens with base words, for fixtures, the
// preview presets and Gus's Orders later.
const VERB_LEMMA = new Map<string, { base: string; tense: Tense }>();
for (const v of VERBS) {
  VERB_LEMMA.set(v.base, { base: v.base, tense: 'present' });
  VERB_LEMMA.set(v.third, { base: v.base, tense: 'present' });
  VERB_LEMMA.set(v.past, { base: v.base, tense: 'past' });
}

export function tokensFromWords(symbols: Pos[], sentence: string): { tokens: Token[]; tense: Tense } {
  const raw = sentence.replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean);
  const words: string[] = [];
  let future = false;
  for (const w of raw) { if (w.toLowerCase() === 'will') { future = true; continue; } words.push(w); }
  if (words.length !== symbols.length) throw new Error(`"${sentence}" has ${words.length} words for ${symbols.length} symbols`);
  let tense: Tense = future ? 'future' : 'present';
  const tokens = symbols.map((pos, i): Token => {
    const w = words[i];
    if (pos === 'V') {
      const l = VERB_LEMMA.get(w.toLowerCase());
      if (!l) throw new Error(`unknown verb ${w}`);
      if (!future && l.tense === 'past') tense = 'past';
      return { pos, word: l.base };
    }
    if (pos === 'I') return { pos, word: interjectionSet.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() };
    if (pos === 'R' && w === 'I') return { pos, word: 'I' };
    return { pos, word: w.toLowerCase() };
  });
  return { tokens, tense };
}

export const exampleTokens = (p: Pattern) => tokensFromWords(p.symbols, p.example);
