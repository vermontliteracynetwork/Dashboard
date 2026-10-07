import type { SemanticFrame } from './types';
import { nounByWord } from '../data/wordbank';

// Silly score 0 to 5 (plan 14.4). Silly never changes stars; it feeds
// flourishes and bonus gears.
const SILLY_ADVERBS = new Set(['wildly', 'messily', 'zealously', 'innocently']);
const ANIMAL_JOBS = new Set(['chop', 'mix', 'talk']);

export function sillyScore(frame: SemanticFrame): number {
  let s = 0;
  for (const ev of frame.events) {
    const subjects = ev.subject.conjoined ?? [ev.subject];
    for (let cur: typeof ev | undefined = ev; cur; cur = cur.join?.next) {
      for (const sub of subjects) {
        const kind = nounByWord.get(sub.noun)?.kind;
        if (kind === 'thing' && cur.verb !== 'fall') s += 2;
        if (kind === 'animal' && ANIMAL_JOBS.has(cur.verb)) s += 2;
      }
    }
    s += ev.adverbs.filter((a) => SILLY_ADVERBS.has(a)).length;
    for (const sub of subjects) if (sub.adjectives.includes('silly')) s += 1;
  }
  return Math.min(5, s);
}

export const sillyLabel = (s: number) => (s >= 4 ? 'SUPER SILLY' : s >= 3 ? 'Very silly' : s >= 1 ? 'A little silly' : 'Sensible');
