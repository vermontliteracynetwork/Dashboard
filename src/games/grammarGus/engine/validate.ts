import type { Draft, HelpLevel, Token, Violation, ViolationHit } from './types';
import { parse } from './grammar';
import { analyze, type Analysis } from './analyze';
import { adjRank, autoFixWords, expectedForms, isSuperlative, requiredCapitals, requiredCommas } from './compose';
import { articleFor, tenseOfForm } from './conjugate';
import { nounByWord, verbByBase } from '../data/wordbank';

// validateSentence (plan sections 3.5, 3.6 and 12): the one source of
// truth for whether the machine runs. Every rule here is also a checklist
// item, so the checklist and the machine can never disagree.

export interface Validation { ok: boolean; complete: boolean; violations: ViolationHit[]; analysis: Analysis }

// Which help level makes each rule the student's job (and so able to block).
const STUDENT_JOB: Partial<Record<Violation, HelpLevel[]>> = {
  AGREEMENT: ['guided', 'challenge'],
  TENSE: ['challenge'], // shown at Guided as a tip; the rubric's TENSE_MIX covers it
  NO_CAPITAL: ['guided', 'challenge'],
  NO_END_MARK: ['guided', 'challenge'],
  ADJ_ORDER: ['guided', 'challenge'],
  NO_SHOUT_MARK: ['challenge'],
  A_AN: ['challenge'],
  A_WITH_PLURAL: ['challenge'],
  NO_COMMA: ['challenge'],
};

// Missing part (by grammar role) to the code the student sees.
function codeForRole(role: string): Violation {
  if (role === 'clauseconj') return 'NO_JOIN';
  const [c, a] = role.split('.');
  if (a === 'subjm') return 'CONJ_UNBALANCED';
  if (a === 'subj' && role.endsWith('.conj')) return 'NO_JOIN';
  if (a === 'verbconj' || a === 'advconj' || a === 'prepconj') return 'NO_JOIN';
  if (a === 'subj2' || a === 'verb2' || a === 'adv2' || a === 'prep2') return 'CONJ_UNBALANCED';
  if (c === 'c2') return 'HALF_INCOMPLETE';
  if (a === 'subj') return 'NO_SUBJECT';
  if (a === 'verb') return 'NO_VERB';
  if (a === 'obj') return 'NO_OBJECT';
  if (a === 'adv') return 'CONJ_UNBALANCED';
  return 'PREP_INCOMPLETE'; // prep, pp
}

function structural(tokens: Token[], a: Analysis): ViolationHit[] {
  const hits = new Map<Violation, ViolationHit>();
  const add = (code: Violation, target: number, insertAt?: number) => {
    const h = hits.get(code) ?? { code, targets: [], insertAt, blocking: true };
    if (target >= 0 && !h.targets.includes(target)) h.targets.push(target);
    hits.set(code, h);
  };
  const p = a.parse;
  // "Him jumped": the right pronoun in the wrong case (Turnstile).
  const swap = caseSwap(tokens);
  if (swap.length) { for (const i of swap) add('PRONOUN_CASE', i); return [...hits.values()]; }
  if (!p.viable) {
    // Not finishable. Explain the most likely reason.
    const noWords = tokens.map((t) => ({ ...t, word: null }));
    if (parse(noWords).viable) {
      const verbsNull = tokens.map((t) => (t.pos === 'V' ? { ...t, word: null } : t));
      if (parse(verbsNull).viable) {
        tokens.forEach((t, i) => { if (t.pos === 'V' && verbByBase.get((t.word ?? '').toLowerCase())?.objectUse === 'I') add('EXTRA_OBJECT', i); });
        if (!hits.size) add('NO_OBJECT', tokens.findIndex((t) => t.pos === 'V'));
      } else {
        tokens.forEach((t, i) => { if (t.pos === 'C') add('CONJ_UNBALANCED', i); });
      }
    }
    if (!hits.size) add('BAD_SHAPE', -1);
    return [...hits.values()];
  }
  for (const ins of p.inserted) {
    // "The cat ran the ball": an action that cannot take a thing, with a
    // thing right after it. Say that, not "add a where-word".
    const before = tokens[ins.at - 1];
    if (ins.role.endsWith('.prep') && before?.pos === 'V' && verbByBase.get((before.word ?? '').toLowerCase())?.objectUse === 'I') { add('EXTRA_OBJECT', ins.at - 1, ins.at); continue; }
    add(codeForRole(ins.role), Math.max(0, ins.at - 1), ins.at);
  }
  tokens.forEach((t, i) => { if (t.word === null) add(p.roles[i] ? codeForRole(p.roles[i]!) : 'EMPTY_SOCKET', i); });
  if (hits.has('NO_VERB')) {
    for (const cl of a.clauses) if (cl.advs.length || cl.open !== undefined) add('ADV_NO_VERB', cl.advs[0] ?? cl.open!);
  }
  return [...hits.values()];
}

// Pronoun case: he / him, she / her, I / me, we / us, they / them. The
// pronouns whose case, once swapped, lets the sentence fit.
export const SUBJ_OF: Record<string, string> = { me: 'I', him: 'he', her: 'she', us: 'we', them: 'they' };
export const OBJ_OF: Record<string, string> = { I: 'me', he: 'him', she: 'her', we: 'us', they: 'them' };
export function caseSwap(tokens: Token[]): number[] {
  const out: number[] = [];
  const now = parse(tokens);
  const cost = now.viable ? now.cost : Infinity;
  if (cost === 0) return out;
  tokens.forEach((t, i) => {
    if (t.pos !== 'R' || !t.word) return;
    const w = t.word === 'I' || t.word === 'i' ? 'I' : t.word.toLowerCase();
    const other = SUBJ_OF[w] ?? OBJ_OF[w];
    if (!other) return;
    const next = tokens.map((x, k) => (k === i ? { ...x, word: other } : x));
    const p2 = parse(next);
    if (p2.viable && p2.cost < cost) out.push(i);
  });
  return out;
}

export function validateSentence(draft: Draft): Validation {
  const { tokens, level } = draft;
  const a = analyze(tokens);
  const violations = structural(tokens, a);
  const complete = a.parse.viable && violations.length === 0;
  const job = (code: Violation) => STUDENT_JOB[code]?.includes(level) ?? true;
  const add = (code: Violation, targets: number[], blocking = job(code)) => violations.push({ code, targets, blocking });
  if (a.parse.viable) {
    const words = level === 'challenge' ? tokens : autoFixWords(tokens, a);
    const lw = (i: number) => (words[i].word ?? '').toLowerCase();
    // Verb forms the student chose (Guided and Challenge).
    if (level !== 'full') {
      const forms = expectedForms(draft, a);
      const tenses = new Set<string>();
      forms.forEach((want, i) => {
        const got = tokens[i].form ?? want;
        tenses.add(tenseOfForm(got));
        if (tenseOfForm(got) !== draft.tense) add('TENSE', [i], level === 'challenge');
        else if (got !== want && (got === 'base' || got === 'third')) add('AGREEMENT', [i]);
      });
    }
    // Describing words in order: feeling, size, age, look, color.
    if (level !== 'full') {
      const nps = a.clauses.flatMap((cl) => [...cl.subj, cl.obj, cl.pp]).filter((x) => !!x);
      for (const np of nps) {
        const ranks = np.adjs.filter((i) => tokens[i].word).map((i) => adjRank(tokens[i].word!));
        if (ranks.some((r, k) => k > 0 && r < ranks[k - 1])) add('ADJ_ORDER', np.adjs);
      }
    }
    if (level === 'challenge') {
      const nps = a.clauses.flatMap((cl) => [...cl.subj, cl.obj, cl.pp]).filter((x) => !!x);
      for (const np of nps) {
        if (np.art === undefined || !words[np.art].word) continue;
        const art = lw(np.art);
        if (art !== 'a' && art !== 'an' && art !== 'the') continue; // this, my, some...
        const noun = np.noun !== undefined ? nounByWord.get(lw(np.noun)) : undefined;
        if (art !== 'the' && np.adjs.some((i) => isSuperlative(words[i].word))) add('SUPERLATIVE_THE', [np.art]);
        else if (art !== 'the' && (noun?.plural || noun?.noA)) add('A_WITH_PLURAL', [np.art]);
        else if (art !== 'the' && words[np.art + 1]?.word && articleFor(words[np.art + 1].word!) !== art) add('A_AN', [np.art]);
      }
    }
    if (level !== 'full') {
      const m = draft.marks ?? { capitals: [], endMark: null, shoutMark: false, commas: [] };
      const caps = requiredCapitals(tokens, a, level === 'challenge').filter((i) => !m.capitals.includes(i));
      if (caps.length) add('NO_CAPITAL', caps);
      if (!m.endMark) add('NO_END_MARK', [tokens.length - 1]);
      if (level === 'challenge') {
        if (a.shout !== undefined && !m.shoutMark) add('NO_SHOUT_MARK', [a.shout]);
        const missingCommas = requiredCommas(a, tokens).filter((i) => !m.commas.includes(i));
        if (missingCommas.length) add('NO_COMMA', missingCommas);
      }
    }
    // Extra commas and capital letters (Claudia's audit, L.4.2 and L.5.2):
    // the student's own marks must each belong somewhere.
    if (draft.marks) {
      const okCommas = new Set(requiredCommas(a, tokens));
      const extraCommas = draft.marks.commas.filter((i) => !okCommas.has(i) && i < tokens.length - 1);
      if (extraCommas.length) add('EXTRA_COMMA', extraCommas);
      const okCaps = new Set(requiredCapitals(tokens, a, true));
      tokens.forEach((t, i) => { const w = (t.word ?? '').toLowerCase().replace(/'s?$/, ''); if (t.pos === 'N' && (nounByWord.get(w)?.proper || nounByWord.get((t.word ?? '').replace(/'s?$/, ''))?.proper)) okCaps.add(i); });
      const extraCaps = draft.marks.capitals.filter((i) => !okCaps.has(i));
      if (extraCaps.length) add('EXTRA_CAPITAL', extraCaps);
    }
  }
  return { ok: violations.every((v) => !v.blocking), complete, violations, analysis: a };
}
