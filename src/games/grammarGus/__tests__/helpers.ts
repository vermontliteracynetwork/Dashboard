import type { Draft, HelpLevel, Pos, Tense, Token } from '../engine/types';
import { tokensFromWords } from '../engine/fromText';

// Build a draft from words and their symbols: d('A N V', 'The cat ran.')
export function d(symbols: string, sentence: string, level: HelpLevel = 'full', tense?: Tense): Draft {
  const r = tokensFromWords(symbols.split(' ') as Pos[], sentence);
  return { tokens: r.tokens, tense: tense ?? r.tense, level };
}
export const tok = (pos: Pos, word: string | null, form?: Token['form']): Token => ({ pos, word, ...(form ? { form } : {}) });
