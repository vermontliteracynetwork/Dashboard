import type { Tense } from '../engine/types';
import { adverbSet } from './wordbank';

// Time words for the Time Tunnel (Claudia's parts catalog, teacher
// 2026-10-07). Each one belongs to past, present or future. Copy rule:
// never yesterday, today, tomorrow or now.
export const TIME_WORDS: Record<Tense, string[]> = {
  past: ['long ago', 'last week', 'last night', 'earlier'],
  present: ['every day', 'every morning', 'usually', 'always'],
  future: ['next week', 'someday', 'soon', 'later'],
};
export const TIME_TENSE = new Map<string, Tense>((Object.entries(TIME_WORDS) as [Tense, string[]][]).flatMap(([t, ws]) => ws.map((w) => [w, t] as const)));
// They open a sentence like any how word: "Long ago, the cat jumped."
for (const w of TIME_TENSE.keys()) adverbSet.add(w);
