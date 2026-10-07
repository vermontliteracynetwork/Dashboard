import type { Draft } from './types';
import { analyze, subjectIsPlural } from './analyze';
import { compose } from './compose';
import { normWord } from './grammar';
import { nounByWord } from '../data/wordbank';
import { pronounFor } from './remix';

// Questions and speech (Claudia's LATER parts; teacher 2026-10-07: "run
// until this dev plan is complete"). The Question Crane lifts a helper
// verb to the front and the action goes back to its plain form: "The cat
// jumps." becomes "Does the cat jump?" The Speech Bubble Blower wraps the
// sentence in quotation marks with a speaker tag: "The cat jumps," said Mia.

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The question form of a one-idea sentence, or null when the crane cannot
// lift it (two ideas joined, or a shout at the front).
export function questionOf(draft: Draft): string | null {
  const a = analyze(draft.tokens);
  if (a.clauses.length !== 1 || a.shout !== undefined || !a.parse.viable) return null;
  const cl = a.clauses[0]; const v = cl.verbs[0];
  // An opener at the front (Quickly, Long ago,) would land in the wrong place.
  if (v === undefined || cl.open !== undefined) return null;
  const words = compose({ ...draft, marks: { ...(draft.marks ?? { capitals: [], shoutMark: false, commas: [] }), endMark: null } }).words;
  const vi = words.findIndex((w) => w.index === v);
  if (vi < 0) return null;
  const aux = draft.tense === 'past' ? 'did' : draft.tense === 'future' ? 'will' : subjectIsPlural(draft.tokens, cl) ? 'do' : 'does';
  const keepCap = (i: number) => { const t = draft.tokens[i]; const w = normWord(t.word ?? ''); return w === 'I' || !!nounByWord.get(w.replace(/'s?$/, ''))?.proper; };
  const before = words.slice(0, vi).map((w, k) => (k === 0 && !keepCap(w.index) ? w.text.charAt(0).toLowerCase() + w.text.slice(1) : w.text));
  const after = words.slice(vi).map((w) => (w.pos === 'V' ? normWord(draft.tokens[w.index].word ?? w.text) + (w.text.endsWith(',') ? ',' : '') : w.text));
  return `${cap(aux)} ${[...before, ...after].join(' ')}?`;
}

// A short answer to a yes-or-no question: "Yes, it does." "No, they did not."
export function shortAnswers(draft: Draft): { right: string; wrong: string[] } | null {
  const a = analyze(draft.tokens); const cl = a.clauses[0];
  if (!cl) return null;
  const plural = subjectIsPlural(draft.tokens, cl);
  const subjWord = cl.subjPron !== undefined ? normWord(draft.tokens[cl.subjPron].word ?? 'it') : null;
  const swapMe: Record<string, string> = { I: 'you', you: 'I', we: 'you' };
  const p = subjWord ? (swapMe[subjWord] ?? subjWord) : cl.subj.length > 1 ? 'they' : pronounFor((draft.tokens[cl.subj[0]?.noun ?? -1]?.word ?? '').toLowerCase());
  void plural;
  const pl = p === 'you' || p === 'they' || p === 'we';
  const aux = draft.tense === 'past' ? 'did' : draft.tense === 'future' ? 'will' : pl || p === 'I' ? 'do' : 'does';
  const other = aux === 'does' ? 'do' : aux === 'do' ? 'does' : aux === 'did' ? 'done' : 'willed';
  return { right: `Yes, ${p} ${aux}.`, wrong: [`No, ${p} ${aux} not.`, `Yes, ${p} ${other}.`] };
}

// Wrap a finished sentence in quotation marks with a speaker tag.
export function quoteOf(text: string, speaker: string, question: boolean): string {
  const m = text.match(/[.!?]$/)?.[0] ?? '.';
  const inner = text.replace(/[.!?]$/, '');
  const who = /^[A-Z]/.test(speaker) ? speaker : speaker;
  if (m === '.') return `"${inner}," said ${who}.`;
  return `"${inner}${m}" ${question || m === '?' ? 'asked' : 'said'} ${who}.`;
}
