import type { Tense, VerbForm } from './types';
import type { VerbEntry } from '../data/wordbank';

// Verb forms and a/an (plan sections 12 and 15.2).
export function formFor(tense: Tense, plural: boolean): VerbForm {
  if (tense === 'past') return 'past';
  if (tense === 'future') return 'future';
  return plural ? 'base' : 'third';
}

export function verbText(v: VerbEntry, form: VerbForm): string {
  if (form === 'past') return v.past;
  if (form === 'future') return `will ${v.base}`;
  return form === 'third' ? v.third : v.base;
}

export function tenseOfForm(form: VerbForm): Tense {
  return form === 'past' ? 'past' : form === 'future' ? 'future' : 'present';
}

// a or an by sound, not spelling (plan 25.8). Words that start with a
// vowel letter but a consonant sound (and the reverse) are listed.
const CONSONANT_SOUND = new Set(['unicorn', 'uniform', 'unit', 'useful', 'one', 'once', 'european', 'ukulele']);
const VOWEL_SOUND = new Set(['hour', 'honest', 'honor', 'heir']);
export function articleFor(nextWord: string): 'a' | 'an' {
  const w = nextWord.toLowerCase();
  if (VOWEL_SOUND.has(w)) return 'an';
  if (CONSONANT_SOUND.has(w)) return 'a';
  return /^[aeiou]/.test(w) ? 'an' : 'a';
}
