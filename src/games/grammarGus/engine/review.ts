import type { Draft, Tense } from './types';
import type { Run } from './pipeline';
import type { Kind } from '../ui/board/parts';
import { RUBRIC_LINES, lineFor } from '../data/gusLines';
import { verbByBase } from '../data/wordbank';
import { verbText } from './conjugate';

// Gus's review of a sentence (teacher 2026-10-07: "grammar gus should
// evaluate quality, comprehension, and understanding of sentences. gus
// should also give suggestions on how to improve and expand on the
// machine/sentence"). After a run: a short scorecard (complete, makes
// sense, detail, variety), up to two ways to make it bigger, each pointing
// at a real part, and one quick question that checks the student
// understood their own sentence.

export interface ScoreRow { label: string; level: 0 | 1 | 2 | 3; note: string }
export interface Tip { text: string; kind: Kind }
export interface Quiz { q: string; choices: string[]; answer: string; why: string }
export interface Review { score: ScoreRow[]; tips: Tip[]; quiz: Quiz | null }

const TIME_Q: Record<Tense, string> = { past: 'in the past', present: 'in the present', future: 'in the future' };

export function reviewSentence(draft: Draft, run: Run, round = 0, distractors: string[] = []): Review {
  const t = draft.tokens;
  const a = run.validation.analysis;
  const cl = a.clauses[0];
  const has = (p: string) => t.some((x) => x.pos === p && x.word);
  const word = (i?: number) => (i !== undefined ? (t[i]?.word ?? '') : '');
  const ok = run.validation.ok;
  const stars = run.rubric?.stars ?? 0;
  const detail = (has('J') ? 1 : 0) + (has('D') ? 1 : 0) + (has('P') ? 1 : 0);
  const variety = (a.clauses.length > 1 ? 1 : 0) + (cl?.open !== undefined || a.shout !== undefined ? 1 : 0) + ((cl?.subj.length ?? 0) > 1 ? 1 : 0);
  const verdict = run.rubric?.verdicts[0];
  const score: ScoreRow[] = [
    { label: 'Complete sentence', level: ok ? 3 : 0, note: ok ? 'A who and an action. It runs!' : 'Something is missing or out of order.' },
    { label: 'Makes sense', level: !ok ? 0 : stars === 3 ? 3 : stars === 2 ? 2 : 1, note: verdict ? lineFor(RUBRIC_LINES[verdict.code], 1).fix : stars === 3 ? 'Gus can picture it.' : 'Read it out loud. Does it make sense?' },
    { label: 'Detail', level: detail as ScoreRow['level'], note: detail === 3 ? 'What it is like, how, and where. Rich!' : `${detail} of 3: describing word, how word, where words.` },
    { label: 'Variety', level: Math.min(3, variety) as ScoreRow['level'], note: variety ? 'Nice sentence shape!' : 'Try a new shape: an opener, a team of two, or two ideas joined.' },
  ];
  // Ways to grow the sentence, each with the part that does it.
  const subj = word(cl?.subj[0]?.noun) || word(cl?.subjPron) || 'it';
  const verb = word(cl?.verbs[0]);
  const tips: Tip[] = [];
  if (!has('J') && cl?.subj[0]?.noun !== undefined) tips.push({ text: `Describe the ${subj}: snap a Spring Mat or Adjective in front of it (fuzzy, giant, silly).`, kind: 'spring' });
  if (!has('D') && verb) tips.push({ text: `Tell how they ${verb}: add a Fan or Adverb (quickly, loudly).`, kind: 'fan' });
  if (!has('P')) tips.push({ text: 'Tell where it happens: a Ramp or Preposition, then a noun (on the moon, under the bed).', kind: 'ramp' });
  if (a.clauses.length < 2) tips.push({ text: 'Add a second idea: a Comma Drawbridge, a Conveyor Belt (and, but), then another who and action.', kind: 'bridge' });
  if (cl?.open === undefined && a.shout === undefined) tips.push({ text: 'Start with a bang: an Opener Slingshot (Quickly,) or a Time Tunnel (Long ago,).', kind: 'slingshot' });
  if ((cl?.subj.length ?? 0) < 2 && cl?.subjPron === undefined) tips.push({ text: `Make a team: a Merge Funnel and another noun ("the ${subj} and the dog").`, kind: 'funnel' });
  // One quick question, a different kind each run.
  let quiz: Quiz | null = null;
  if (ok && t.length) {
    const nouns = t.filter((x) => (x.pos === 'N' || x.pos === 'R') && x.word).map((x) => x.word!.toLowerCase());
    const verbs = t.filter((x) => x.pos === 'V' && x.word).map((x) => x.word!);
    const kinds = ['who', 'did', 'when', ...(cl?.preps.length ? ['where'] : [])];
    const k = kinds[round % kinds.length];
    const shuffle = (xs: string[]) => [...new Set(xs)].sort((x, y) => ((x.length * 7 + round) % 5) - ((y.length * 7 + round) % 5));
    const pad = (right: string, others: string[]) => shuffle([right, ...others.filter((x) => x !== right), ...distractors.filter((x) => x !== right)].slice(0, 3));
    if (k === 'who' && subj) quiz = { q: 'Who or what is this sentence about?', choices: pad(subj.toLowerCase(), nouns), answer: subj.toLowerCase(), why: `It is about the ${subj}: that is the who (the subject).` };
    else if (k === 'did' && verb) {
      const v = verbByBase.get(verb.toLowerCase());
      const shown = (w: string) => { const e = verbByBase.get(w.toLowerCase()); return e ? verbText(e, draft.tense === 'past' ? 'past' : draft.tense === 'future' ? 'future' : 'base') : w; };
      quiz = { q: `What did the ${subj} do?`, choices: pad(shown(verb), [...verbs.map(shown), ...['sleep', 'sing', 'dance'].map(shown)]), answer: shown(verb), why: `"${v ? shown(verb) : verb}" is the action (the verb).` };
    } else if (k === 'when') quiz = { q: 'When does this happen?', choices: ['in the past', 'in the present', 'in the future'], answer: TIME_Q[draft.tense], why: `The action word tells the time: ${TIME_Q[draft.tense]}.` };
    else if (k === 'where' && cl?.pp?.noun !== undefined) { const place = word(cl.pp.noun).toLowerCase(); quiz = { q: 'Where does it happen?', choices: pad(`${word(cl.preps[0])} the ${place}`, nouns.filter((x) => x !== place).map((x) => `${word(cl.preps[0])} the ${x}`)), answer: `${word(cl.preps[0])} the ${place}`, why: 'The where words (preposition and its noun) tell the place.' }; }
    if (quiz && quiz.choices.length < 2) quiz = null;
  }
  return { score, tips: tips.slice(0, 2), quiz };
}
