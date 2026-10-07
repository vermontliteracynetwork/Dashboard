import type { Tense } from './types';
import { makeOrder } from './orders';
import { pick, type Rng } from './rng';
import type { BoardItem } from './board';

// Gus's Jobs on the Workboard (Claudia round 2, from her gameplay list).
//  - Mixed-up Delivery: Gus delivers a 3-star sentence's word machines in
//    a scrambled order. The student puts them in order, adds the capital
//    letter, punctuation and TV, and runs it. Trains word order (subject,
//    verb, then the rest).
//  - Punctuation Inspector: Gus delivers a whole machine with one capital
//    letter or punctuation mistake. The student finds and fixes it. Trains
//    capital letters and end punctuation.
// No timer, no failing: a job is done the first time its machine earns 3 stars.

export type JobKind = 'delivery' | 'inspector';
export type Flaw = 'missing-end' | 'end-middle' | 'missing-cap' | 'cap-late';
export interface BoardJob { kind: JobKind; text: string; flaw?: Flaw }
export const FLAW_HINTS: Record<Flaw, string> = {
  'missing-end': 'This sentence has no punctuation at the end.',
  'end-middle': 'Some punctuation is in the wrong place.',
  'missing-cap': 'The first word is missing its capital letter.',
  'cap-late': 'The capital letter is on the wrong word.',
};

export function makeJob(kind: JobKind, rng: Rng, uid: () => string, o: { gentleOnly?: boolean } = {}): { items: BoardItem[]; job: BoardJob; tense: Tense } {
  const order = makeOrder(rng, o);
  const tokens = order.filled.draft.tokens;
  const tense = order.filled.draft.tense;
  const words: BoardItem[] = tokens.map((t) => ({ id: uid(), kind: t.pos, word: t.word }));
  const lever: BoardItem = { id: uid(), kind: 'lever', word: null };
  const clock: BoardItem = { id: uid(), kind: 'clock', word: tense };
  if (kind === 'delivery') {
    let mixed = [...words];
    for (let k = 0; k < 20 && mixed.every((w, i) => w.word === words[i].word); k++) mixed = [...words].sort(() => rng() - 0.5);
    return { items: [lever, clock, ...mixed], job: { kind, text: order.text }, tense };
  }
  const cap: BoardItem = { id: uid(), kind: 'cap', word: null };
  const stop: BoardItem = { id: uid(), kind: 'stop', word: null };
  const tv: BoardItem = { id: uid(), kind: 'tv', word: null };
  const flaw = pick(rng, ['missing-end', 'end-middle', 'missing-cap', 'cap-late'] as Flaw[]);
  let items: BoardItem[] = [lever, clock, cap, ...words, stop, tv];
  if (flaw === 'missing-end') items = items.filter((i) => i !== stop);
  if (flaw === 'missing-cap') items = items.filter((i) => i !== cap);
  if (flaw === 'end-middle') { items = items.filter((i) => i !== stop); items.splice(items.indexOf(words[1]) + 1, 0, stop); }
  if (flaw === 'cap-late') { items = items.filter((i) => i !== cap); items.splice(items.indexOf(words[1]), 0, cap); }
  return { items, job: { kind, text: order.text, flaw }, tense };
}
