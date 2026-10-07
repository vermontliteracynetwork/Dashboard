import type { Draft, Marks, Token, VerbForm } from './types';
import { analyze, subjectIsPlural, type Analysis } from './analyze';
import { normWord } from './grammar';
import { articleFor, formFor, verbText } from './conjugate';
import { ADJ_RANK, adjByWord, nounByWord, verbByBase } from '../data/wordbank';

// Tokens to display words (plan section 15): verb forms, a/an, describing
// word order, capitals, commas and the end mark. At Full help the engine
// does all of it ("machine did this"). At Guided and Challenge the words
// show exactly what the student chose and placed.

export interface Word { text: string; index: number; pos: Token['pos'] }
export interface Composed { words: Word[]; text: string; analysis: Analysis }

export const adjRank = (w: string) => ADJ_RANK[adjByWord.get(w.toLowerCase())?.kind ?? 'feeling'];

// The verb form the time crank and subject call for.
export function expectedForms(draft: Draft, a: Analysis = analyze(draft.tokens)): Map<number, VerbForm> {
  const m = new Map<number, VerbForm>();
  for (const cl of a.clauses) {
    const plural = subjectIsPlural(draft.tokens, cl);
    for (const v of cl.verbs) m.set(v, formFor(draft.tense, plural));
  }
  return m;
}

// Where commas belong (plan section 12): after an opening HOW word at the
// start, and before a clause joining word when the second half starts with
// a HOW word (pattern 19). No other commas in v1.
export function requiredCommas(a: Analysis): number[] {
  const out: number[] = [];
  const c1 = a.clauses[0];
  if (c1?.open !== undefined) out.push(c1.open);
  const c2 = a.clauses[1];
  if (c2?.open !== undefined && a.clauseConj !== undefined) out.push(a.clauseConj - 1);
  // A list of three: a comma after each item before "and" (Comma List Train).
  for (const cl of a.clauses) if (cl.subj.length === 3) for (const np of cl.subj.slice(0, 2)) { const last = np.noun ?? Math.max(np.art ?? -1, ...np.adjs); if (last >= 0) out.push(last); }
  return out;
}

// Capitals the sentence needs: the first word, the word after a shout,
// and the word I.
export function requiredCapitals(tokens: Token[], a: Analysis, includeI: boolean): number[] {
  const out = new Set<number>();
  if (tokens.length) out.add(0);
  if (a.shout !== undefined && a.shout + 1 < tokens.length) out.add(a.shout + 1);
  if (includeI) tokens.forEach((t, i) => { if (t.pos === 'R' && t.word && normWord(t.word) === 'I') out.add(i); });
  return [...out].sort((x, y) => x - y);
}

// Sentences that start with a shout default to ! (plan 3.12).
export const defaultEndMark = (a: Analysis): '.' | '!' => (a.shout === 0 ? '!' : '.');

// The marks a student would place to finish the sentence correctly
// (used by Full help, the generator and tests).
export function autoMarks(draft: Draft, a: Analysis = analyze(draft.tokens)): Marks {
  return { capitals: requiredCapitals(draft.tokens, a, true), endMark: defaultEndMark(a), shoutMark: a.shout !== undefined, commas: requiredCommas(a) };
}
export function autoForms(draft: Draft): Token[] {
  const forms = expectedForms(draft);
  return draft.tokens.map((t, i) => (forms.has(i) ? { ...t, form: forms.get(i) } : t));
}

// Engine fixes at Full and Guided help: describing words sorted into
// order, a/an by sound, and "a" never with a plural or "no a" noun.
export function autoFixWords(tokens: Token[], a: Analysis): Token[] {
  const out = tokens.map((t) => ({ ...t }));
  const nps = a.clauses.flatMap((cl) => [...cl.subj, cl.obj, cl.pp]).filter((x) => !!x);
  for (const np of nps) {
    if (np.adjs.length > 1) {
      const words = np.adjs.map((i) => out[i].word);
      const sorted = [...words].sort((x, y) => (x && y ? adjRank(x) - adjRank(y) : 0));
      np.adjs.forEach((i, k) => { out[i].word = sorted[k]; });
    }
    if (np.art !== undefined && out[np.art].word && out[np.art].word!.toLowerCase() !== 'the') {
      const noun = np.noun !== undefined ? nounByWord.get((out[np.noun].word ?? '').toLowerCase()) : undefined;
      if (noun?.plural || noun?.noA) out[np.art].word = 'the';
      else {
        const next = out[np.art + 1]?.word;
        out[np.art].word = next ? articleFor(next) : 'a';
      }
    }
  }
  return out;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function compose(draft: Draft): Composed {
  const a = analyze(draft.tokens);
  const full = draft.level === 'full';
  const tokens = draft.level === 'challenge' ? draft.tokens : autoFixWords(draft.tokens, a);
  const forms = expectedForms(draft, a);
  // At Full help the engine places the marks, but a Workboard student's own
  // end punctuation (a Big Horn "!") and extra commas (the Comma
  // Drawbridge) still show.
  const own = draft.marks;
  const auto = full ? autoMarks(draft, a) : null;
  const marks: Marks = auto ? { ...auto, endMark: own?.endMark ?? auto.endMark, commas: [...new Set([...auto.commas, ...(own?.commas ?? [])])], shoutMark: auto.shoutMark || !!own?.shoutMark } : {
    ...(own ?? { capitals: [], endMark: null, shoutMark: false, commas: [] }),
    // Guided: the engine still places commas and the shout mark.
    ...(draft.level === 'guided' ? { commas: [...new Set([...requiredCommas(a), ...(own?.commas ?? [])])], shoutMark: a.shout !== undefined } : {}),
  };
  const capitals = new Set(marks.capitals);
  const commas = new Set(marks.commas);
  const words: Word[] = [];
  tokens.forEach((t, i) => {
    if (t.word === null) return;
    let text = normWord(t.word);
    if (t.pos === 'V') {
      const v = verbByBase.get(text);
      const form = full ? forms.get(i) : (t.form ?? forms.get(i));
      if (v && form) text = verbText(v, form);
    }
    if (t.pos === 'R' && text === 'I') text = full || capitals.has(i) ? 'I' : 'i';
    if (t.pos === 'I') text = text.toLowerCase();
    if (t.pos === 'N' && nounByWord.get(text.replace(/'s?$/, ''))?.proper) text = cap(text); // names always get a capital letter
    if (capitals.has(i)) text = cap(text);
    if (t.pos === 'I' && marks.shoutMark) text += '!';
    if (commas.has(i)) text += ',';
    words.push({ text, index: i, pos: t.pos });
  });
  if (words.length && marks.endMark) words[words.length - 1].text += marks.endMark;
  return { words, text: words.map((w) => w.text).join(' '), analysis: a };
}
