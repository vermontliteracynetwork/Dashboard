import type { Draft, HelpLevel, Violation } from './types';
import { validateSentence, type Validation } from './validate';
import { requiredCommas } from './compose';

// Gus's Checklist, the Inspector's Clipboard (plan 3.9 to 3.15). One source
// of truth: the validator returns violation codes and this maps them to
// kid-worded items. There is no separate checklist logic that could drift
// from what the machine does: the machine runs exactly when every
// required item is done.

export type ItemGroup = 'pieces' | 'match' | 'describe' | 'join' | 'finish';
export type ItemStatus = 'done' | 'todo' | 'fix' | 'auto';
export interface ChecklistItem {
  id: string; group: ItemGroup; label: string; grownUp: string; hint: string;
  codes: Violation[]; required: boolean; status: ItemStatus;
  targets: number[]; // token indices to pulse
}
export interface ChecklistState { items: ChecklistItem[]; done: number; total: number; allRequiredDone: boolean; validation: Validation }

interface Def {
  id: string; group: ItemGroup; label: string; grownUp: string; hint: string; codes: Violation[];
  applies: (c: Ctx) => boolean;
  studentDoes?: HelpLevel[]; // undefined: always the student's job
  requiredAt?: HelpLevel[]; // undefined: required whenever it applies and is the student's job
}
interface Ctx { draft: Draft; v: Validation; has: (pos: string) => boolean }

// Kid wording: 7 words or fewer, plain verbs (plan 3.9).
const DEFS: Def[] = [
  { id: 'who', group: 'pieces', label: 'WHO or WHAT is it about?', grownUp: 'subject', hint: 'Add a noun. Who or what is it about?', codes: ['NO_SUBJECT'], applies: () => true },
  { id: 'did', group: 'pieces', label: 'WHAT THEY DID', grownUp: 'verb, predicate', hint: 'What did they do? Add a verb.', codes: ['NO_VERB', 'ADV_NO_VERB'], applies: () => true },
  { id: 'whole', group: 'pieces', label: 'It tells a whole idea', grownUp: 'complete sentence', hint: 'Needs both a WHO and a WHAT THEY DID.', codes: ['NO_SUBJECT', 'NO_VERB', 'BAD_SHAPE', 'EMPTY_SOCKET'], applies: () => true },
  { id: 'object', group: 'pieces', label: 'The action needs a thing', grownUp: 'object', hint: 'Kick what? Add something to kick.', codes: ['NO_OBJECT', 'EXTRA_OBJECT'],
    applies: (c) => c.v.violations.some((x) => x.code === 'NO_OBJECT' || x.code === 'EXTRA_OBJECT') || c.v.analysis.clauses.some((cl) => !!cl.obj || cl.objPron !== undefined) },
  { id: 'agree', group: 'match', label: 'WHO and the verb match', grownUp: 'subject-verb agreement', hint: 'Say it out loud: the cats run.', codes: ['AGREEMENT'],
    applies: (c) => c.has('V') && (c.has('N') || c.has('R')), studentDoes: ['guided', 'challenge'] },
  { id: 'time', group: 'match', label: 'The verb matches the time', grownUp: 'tense', hint: 'Use a verb for the time on the crank.', codes: ['TENSE'],
    applies: (c) => c.has('V'), studentDoes: ['guided', 'challenge'], requiredAt: ['challenge'] },
  { id: 'aan', group: 'describe', label: 'a or an sounds right', grownUp: 'a / an', hint: 'Listen to the next word.', codes: ['A_AN', 'A_WITH_PLURAL'],
    applies: (c) => c.draft.tokens.some((t) => t.pos === 'A' && t.word && t.word.toLowerCase() !== 'the'), studentDoes: ['challenge'] },
  { id: 'order', group: 'describe', label: 'Describing words in order', grownUp: 'order of adjectives', hint: 'Feeling, then size, then age, then color.', codes: ['ADJ_ORDER'],
    applies: (c) => c.draft.tokens.some((t, i) => t.pos === 'J' && c.draft.tokens[i + 1]?.pos === 'J'), studentDoes: ['guided', 'challenge'] },
  { id: 'how', group: 'describe', label: 'HOW word goes with a verb', grownUp: 'adverb', hint: 'Add the verb this word describes.', codes: ['ADV_NO_VERB'], applies: (c) => c.has('D') },
  { id: 'where', group: 'describe', label: 'WHERE phrase is finished', grownUp: 'prepositional phrase', hint: 'Add a naming word after the where-word.', codes: ['PREP_INCOMPLETE'], applies: (c) => c.has('P') },
  { id: 'join', group: 'join', label: 'Join word connects matching parts', grownUp: 'conjunction', hint: 'And needs something on both sides.', codes: ['CONJ_UNBALANCED', 'NO_JOIN'],
    applies: (c) => c.has('C') || c.v.violations.some((x) => x.code === 'NO_JOIN') },
  { id: 'halves', group: 'join', label: 'Both halves tell a whole idea', grownUp: 'compound sentence', hint: 'Each half needs a WHO and a WHAT THEY DID.', codes: ['HALF_INCOMPLETE'],
    applies: (c) => c.v.analysis.clauseConj !== undefined || c.v.violations.some((x) => x.code === 'HALF_INCOMPLETE') },
  { id: 'capital', group: 'finish', label: 'Starts with a capital letter', grownUp: 'capital letter', hint: 'Use the Capital Letter Press on the first word.', codes: ['NO_CAPITAL'], applies: () => true, studentDoes: ['guided', 'challenge'] },
  { id: 'shout', group: 'finish', label: 'The shout has its own !', grownUp: 'interjection mark', hint: 'A shout word gets an exclamation mark.', codes: ['NO_SHOUT_MARK'], applies: (c) => c.has('I'), studentDoes: ['challenge'] },
  { id: 'comma', group: 'finish', label: 'A comma is where it belongs', grownUp: 'comma', hint: 'Put a comma after the opening HOW word.', codes: ['NO_COMMA'], applies: (c) => requiredCommas(c.v.analysis).length > 0, studentDoes: ['challenge'] },
  { id: 'end', group: 'finish', label: 'Ends with punctuation', grownUp: 'end punctuation', hint: 'Add punctuation at the end: . or !', codes: ['NO_END_MARK'], applies: () => true, studentDoes: ['guided', 'challenge'] },
];

const MISSING: Violation[] = ['NO_SUBJECT', 'NO_VERB', 'NO_OBJECT', 'PREP_INCOMPLETE', 'HALF_INCOMPLETE', 'EMPTY_SOCKET', 'NO_END_MARK', 'NO_CAPITAL', 'NO_SHOUT_MARK', 'NO_COMMA', 'ADV_NO_VERB'];

export function buildChecklist(draft: Draft, v: Validation = validateSentence(draft)): ChecklistState {
  const ctx: Ctx = { draft, v, has: (pos) => draft.tokens.some((t) => t.pos === pos && t.word) };
  const items: ChecklistItem[] = [];
  for (const d of DEFS) {
    const hits = v.violations.filter((x) => d.codes.includes(x.code));
    // An item shows when its part is on the machine, or when one of its
    // rules is broken (so a broken rule is never hidden).
    if (!d.applies(ctx) && !hits.length) continue;
    const studentJob = !d.studentDoes || d.studentDoes.includes(draft.level);
    const required = studentJob && (!d.requiredAt || d.requiredAt.includes(draft.level));
    let status: ItemStatus;
    if (!studentJob) status = 'auto';
    else if (!hits.length) status = 'done';
    else status = hits.every((h) => MISSING.includes(h.code)) ? 'todo' : 'fix';
    items.push({ id: d.id, group: d.group, label: d.label, grownUp: d.grownUp, hint: d.hint, codes: d.codes, required, status, targets: hits.flatMap((h) => h.targets) });
  }
  const req = items.filter((i) => i.required);
  return { items, done: req.filter((i) => i.status === 'done').length, total: req.length, allRequiredDone: req.every((i) => i.status === 'done'), validation: v };
}

// Focus mode: just the next three things to do (plan 3.9).
export const focusItems = (s: ChecklistState) => s.items.filter((i) => i.status === 'todo' || i.status === 'fix').slice(0, 3);

export const GROUP_TITLES: Record<ItemGroup, string> = { pieces: 'The big pieces', match: 'Match', describe: 'Describe', join: 'Join', finish: 'Finish' };
