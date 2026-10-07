import type { Pos } from '../engine/types';

// The teacher's recreated Montessori grammar symbols (plan section 13.1).
// Colors are never recolored; the PNGs are her own art.
export interface SymbolInfo { pos: Pos; name: string; color: string; shape: string; kidHint: string; asset: string }

export const SYMBOLS: Record<Pos, SymbolInfo> = {
  N: { pos: 'N', name: 'noun', color: '#D2232D', shape: 'red triangle', kidHint: 'person, place, thing, animal', asset: '/games/grammar-gus/symbols/noun.png' },
  V: { pos: 'V', name: 'verb', color: '#43AD73', shape: 'green circle', kidHint: 'action word', asset: '/games/grammar-gus/symbols/verb.png' },
  J: { pos: 'J', name: 'adjective', color: '#4DB6E6', shape: 'blue triangle', kidHint: 'tells more about a noun', asset: '/games/grammar-gus/symbols/adjective.png' },
  D: { pos: 'D', name: 'adverb', color: '#1A67AD', shape: 'dark blue circle', kidHint: 'tells HOW', asset: '/games/grammar-gus/symbols/adverb.png' },
  A: { pos: 'A', name: 'article', color: '#F08DB5', shape: 'pink triangle', kidHint: 'a, an, the', asset: '/games/grammar-gus/symbols/article.png' },
  R: { pos: 'R', name: 'pronoun', color: '#E0C800', shape: 'yellow upside-down triangle', kidHint: 'takes the place of a noun', asset: '/games/grammar-gus/symbols/pronoun.png' },
  C: { pos: 'C', name: 'conjunction', color: '#9B7AB9', shape: 'purple arrow', kidHint: 'connects words', asset: '/games/grammar-gus/symbols/conjunction.png' },
  P: { pos: 'P', name: 'preposition', color: '#7A4318', shape: 'brown crescent', kidHint: 'tells WHERE', asset: '/games/grammar-gus/symbols/preposition.png' },
  I: { pos: 'I', name: 'interjection', color: '#F97316', shape: 'orange drop', kidHint: 'a word you shout', asset: '/games/grammar-gus/symbols/interjection.png' },
};
