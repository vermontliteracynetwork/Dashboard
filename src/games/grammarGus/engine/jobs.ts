import type { Tense } from './types';
import { makeOrder, orderCard, type OrderCard, type SceneKey } from './orders';
import { frameworkById } from '../data/frameworks';
import type { Pos } from './types';
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

export type JobKind = 'delivery' | 'inspector' | 'order' | 'blueprint' | 'spark';
export type Flaw = 'missing-end' | 'end-middle' | 'missing-cap' | 'cap-late';
export interface BoardJob { id: string; kind: JobKind; text: string; flaw?: Flaw | 'who' | 'did' | 'runon' | 'appos'; key?: SceneKey; card?: OrderCard; group?: string; label?: string; part?: number; of?: number; blueprint?: string }
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
  const words: BoardItem[] = tokens.map((t) => ({ id: uid(), kind: t.pos, word: t.word, ...(t.form ? { form: t.form } : {}) }));
  const lever: BoardItem = { id: uid(), kind: 'lever', word: null };
  const clock: BoardItem = { id: uid(), kind: 'clock', word: tense };
  if (kind === 'delivery') {
    let mixed = [...words];
    for (let k = 0; k < 20 && mixed.every((w, i) => w.word === words[i].word); k++) mixed = [...words].sort(() => rng() - 0.5);
    return { items: [lever, clock, ...mixed], job: { id: uid(), kind, text: order.text }, tense };
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
  return { items, job: { id: uid(), kind, text: order.text, flaw }, tense };
}

// Gus's Orders on the Workboard (moved from the classic machine, teacher
// 2026-10-07 "run until this dev plan is complete"): Gus posts a scene as
// pictures and words, never the sentence, and the student builds ANY
// sentence that makes that scene, with the right time on the Clock.
export function makeOrderJob(rng: Rng, uid: () => string, o: { gentleOnly?: boolean } = {}): { items: BoardItem[]; job: BoardJob } {
  const order = makeOrder(rng, o);
  return {
    items: [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'clock', word: 'present' }, { id: uid(), kind: 'blank', word: null }, { id: uid(), kind: 'tv', word: null }],
    job: { id: uid(), kind: 'order', text: order.text, key: order.key, card: orderCard(order.key) },
  };
}

// Blueprints on the Workboard: a paragraph plan delivered as linked
// machines, one per sentence, each with its empty word machines in a
// working order, its label (Beginning, Middle, End) and any fixed lines.
export const WORKBOARD_BLUEPRINTS = ['silly-story', 'news', 'day-in-the-life', 'rescue', 'knock-knock'];
export function makeBlueprint(id: string, uid: () => string): { items: BoardItem[]; job: BoardJob; connector?: string }[] {
  const fw = frameworkById.get(id);
  if (!fw) return [];
  const group = uid();
  const builds = fw.lines.filter((l) => l.kind === 'build');
  const out: { items: BoardItem[]; job: BoardJob; connector?: string }[] = [];
  let pending: string[] = [];
  fw.lines.forEach((l) => {
    if (l.kind === 'fixed') { pending.push(l.text); return; }
    if (l.kind !== 'build') return;
    const shape = l.shapes[0] as Pos[];
    const words: BoardItem[] = shape.map((pos) => ({ id: uid(), kind: pos, word: pos === 'R' && l.locks?.['who.pron'] ? l.locks['who.pron'] : null }));
    words[0] = { ...words[0], bottom: { id: uid(), kind: 'cap', word: null } };
    const k = builds.indexOf(l);
    const last = k === builds.length - 1;
    const items: BoardItem[] = [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'clock', word: fw.tense ?? 'present' }, ...words, { id: uid(), kind: 'stop', word: null }, { id: uid(), kind: 'tv', word: null }, ...(last ? [] : [{ id: uid(), kind: 'link' as const, word: null }])];
    out.push({ items, job: { id: uid(), kind: 'blueprint', text: pending.join(' '), group, label: l.label, part: k + 1, of: builds.length, blueprint: fw.id }, connector: l.lead?.replace(/,$/, '') });
    pending = [];
  });
  if (pending.length && out.length) out[out.length - 1].job.text = `${out[out.length - 1].job.text}${out[out.length - 1].job.text ? ' ' : ''}After: ${pending.join(' ')}`;
  return out;
}

// Science writing jobs (Claudia's Phase 1 scaffold plan, 2026-10-07).
// Procedure Conveyor: numbered command steps (First, Next, Then, Finally).
// Hypothesis Engine: "If ..., then ... will ..." and a past observation.
export type ScienceJob = 'procedure' | 'hypothesis';
export function makeScienceJob(kind: ScienceJob, uid: () => string): { items: BoardItem[]; job: BoardJob; connector?: string }[] {
  const group = uid();
  const cap = (): BoardItem => ({ id: uid(), kind: 'cap', word: null });
  const tail = (last: boolean): BoardItem[] => [{ id: uid(), kind: 'stop', word: null }, { id: uid(), kind: 'tv', word: null }, ...(last ? [] : [{ id: uid(), kind: 'link' as const, word: null }])];
  const w = (kind: Pos, word: string | null = null): BoardItem => ({ id: uid(), kind, word });
  if (kind === 'procedure') {
    const steps: { lead: string; shape: Pos[] }[] = [
      { lead: 'First', shape: ['V', 'A', 'N'] }, { lead: 'Next', shape: ['V', 'A', 'J', 'N'] },
      { lead: 'Then', shape: ['V', 'A', 'N', 'D'] }, { lead: 'Finally', shape: ['V', 'A', 'N'] },
    ];
    return steps.map((st, k) => {
      const words = st.shape.map((p) => w(p));
      words[0] = { ...words[0], bottom: cap() };
      return { items: [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'command', word: null }, ...words, ...tail(k === steps.length - 1)], job: { id: uid(), kind: 'blueprint', text: '', group, label: `Step ${k + 1}`, part: k + 1, of: steps.length, blueprint: 'procedure' }, connector: st.lead };
    });
  }
  const hypo: BoardItem[] = [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'clock', word: 'future' }, { id: uid(), kind: 'hypo', word: 'if', bottom: cap() }, w('A'), w('N'), { ...w('V'), bottom: { id: uid(), kind: 'comma', word: null } }, w('D', 'then'), w('A'), w('N'), w('V'), ...tail(false)];
  const obs: BoardItem[] = [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'clock', word: 'past' }, { ...w('A'), bottom: cap() }, w('N'), w('V'), w('D'), ...tail(true)];
  return [
    { items: hypo, job: { id: uid(), kind: 'blueprint', text: 'If (a change), then (what will happen).', group, label: 'Hypothesis', part: 1, of: 2, blueprint: 'hypothesis' } },
    { items: obs, job: { id: uid(), kind: 'blueprint', text: 'What really happened, in the past.', group, label: 'Observation', part: 2, of: 2, blueprint: 'hypothesis' } },
  ];
}

// Spark Check (Claudia's Phase 1): Gus delivers a fragment, a "dud" missing
// its who or its action. The student finds what is missing and adds it.
export function makeSparkJob(rng: Rng, uid: () => string, o: { gentleOnly?: boolean } = {}): { items: BoardItem[]; job: BoardJob } {
  const order = makeOrder(rng, o);
  const tokens = order.filled.draft.tokens;
  const v = tokens.findIndex((t) => t.pos === 'V');
  const missing = rng() < 0.5 ? 'who' : 'did';
  const keep = tokens.filter((_, i) => (missing === 'who' ? i >= v : i !== v));
  const words: BoardItem[] = keep.map((t) => ({ id: uid(), kind: t.pos, word: t.word, ...(t.form ? { form: t.form } : {}) }));
  if (words[0]) words[0] = { ...words[0], bottom: { id: uid(), kind: 'cap', word: null } };
  return {
    items: [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'clock', word: order.filled.draft.tense }, ...words, { id: uid(), kind: 'stop', word: null }, { id: uid(), kind: 'tv', word: null }],
    job: { id: uid(), kind: 'spark', text: order.text, flaw: missing },
  };
}

// Run-ons (Claudia's Phase 2, first machine; teacher 2026-10-08 "go for gus stuff"): two whole
// sentences glued together with nothing joining them. runOnSplit finds where the second idea
// starts (its who right before its last action word), or null when it is not a run-on.
export function runOnSplit(tokens: { pos: Pos }[]): number | null {
  let v = -1;
  for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].pos === 'V') { v = i; break; }
  if (v < 2) return null;
  let i = v - 1;
  if (tokens[i].pos !== 'N' && tokens[i].pos !== 'R') return null;
  i--;
  while (i >= 0 && tokens[i].pos === 'J') i--;
  if (i >= 0 && tokens[i].pos === 'A') i--;
  const start = i + 1;
  if (start === 0 || !tokens.slice(0, start).some((t) => t.pos === 'V')) return null;
  if (tokens[start - 1].pos === 'C' || tokens[start - 1].pos === 'P') return null;
  return start;
}

// The Run-on Fixer job: Gus glues two complete sentences into one machine. The student snaps a
// Logic Gate (and, but, so) between the two ideas, and the comma comes with it.
export function makeRunOnJob(rng: Rng, uid: () => string, o: { gentleOnly?: boolean } = {}): { items: BoardItem[]; job: BoardJob } {
  for (let tries = 0; ; tries++) {
    const a = makeOrder(rng, o);
    const tense = a.filled.draft.tense;
    let b = makeOrder(rng, o);
    for (let k = 0; k < 40 && b.filled.draft.tense !== tense; k++) b = makeOrder(rng, o);
    const ta = a.filled.draft.tokens, tb = b.filled.draft.tokens;
    if (tries < 200 && (b.filled.draft.tense !== tense || ta.length + tb.length > 9 || ta.length > 5 || tb.length > 5 || ta.some((t) => t.pos === 'C') || tb.some((t) => t.pos === 'C'))) continue;
    const words: BoardItem[] = [...ta, ...tb].map((t) => ({ id: uid(), kind: t.pos, word: t.word, ...(t.form ? { form: t.form } : {}) }));
    if (runOnSplit([...ta, ...tb]) !== ta.length && tries < 200) continue;
    words[0] = { ...words[0], bottom: { id: uid(), kind: 'cap', word: null } };
    return {
      items: [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'clock', word: tense }, ...words, { id: uid(), kind: 'stop', word: null }, { id: uid(), kind: 'tv', word: null }],
      job: { id: uid(), kind: 'spark', text: `${a.text} ${b.text}`, flaw: 'runon' },
    };
  }
}

// The Appositive Clamp job (Claudia's Phase 2, second machine; Build Queue 2026-10-09): Gus delivers
// a finished sentence with an empty Appositive Clamp gripping its who. The student picks a fact
// about the who (or types one) and, at Guided and Challenge, snaps on both comma tabs.
export function makeAppositiveJob(rng: Rng, uid: () => string, o: { gentleOnly?: boolean } = {}): { items: BoardItem[]; job: BoardJob; noun: string } {
  for (let tries = 0; ; tries++) {
    const order = makeOrder(rng, o);
    const tokens = order.filled.draft.tokens;
    const v = tokens.findIndex((t) => t.pos === 'V');
    const n = tokens.findIndex((t, i) => t.pos === 'N' && i < v);
    if ((n < 0 || v < 0) && tries < 200) continue;
    const words: BoardItem[] = tokens.map((t) => ({ id: uid(), kind: t.pos, word: t.word, ...(t.form ? { form: t.form } : {}) }));
    words[0] = { ...words[0], bottom: { id: uid(), kind: 'cap', word: null } };
    const at = n < 0 ? 0 : n;
    words.splice(at + 1, 0, { id: uid(), kind: 'clamp', word: null });
    return {
      items: [{ id: uid(), kind: 'lever', word: null }, { id: uid(), kind: 'clock', word: order.filled.draft.tense }, ...words, { id: uid(), kind: 'stop', word: null }, { id: uid(), kind: 'tv', word: null }],
      job: { id: uid(), kind: 'spark', text: order.text, flaw: 'appos' },
      noun: tokens[at]?.word ?? 'the who',
    };
  }
}
