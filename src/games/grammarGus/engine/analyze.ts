import type { Token } from './types';
import { parse, normWord, type Parse } from './grammar';
import { nounByWord } from '../data/wordbank';

// Turns the parse roles into clauses, subject groups, verbs, objects and
// where phrases (plan section 15.1). Agreement is always computed from the
// words, never stored.

export interface NP { art?: number; adjs: number[]; noun?: number }
export interface ClauseInfo {
  c: 1 | 2;
  open?: number;
  subj: NP[]; subjConj?: number; subjPron?: number;
  verbs: number[]; verbConj?: number;
  obj?: NP; objPron?: number;
  advs: number[]; advConj?: number;
  preps: number[]; prepConj?: number; pp?: NP;
}
export interface Analysis { parse: Parse; shout?: number; clauseConj?: number; clauses: ClauseInfo[] }

const emptyNP = (): NP => ({ adjs: [] });

export function analyze(tokens: Token[], p: Parse = parse(tokens)): Analysis {
  const clauses: Record<1 | 2, ClauseInfo> = {
    1: { c: 1, subj: [], verbs: [], advs: [], preps: [] },
    2: { c: 2, subj: [], verbs: [], advs: [], preps: [] },
  };
  const out: Analysis = { parse: p, clauses: [] };
  const npFor = (cl: ClauseInfo, key: string): NP => {
    if (key === 'subj') { if (!cl.subj[0]) cl.subj[0] = emptyNP(); return cl.subj[0]; }
    if (key === 'subj2') { if (!cl.subj[1]) cl.subj[1] = emptyNP(); return cl.subj[1]; }
    if (key === 'obj') { if (!cl.obj) cl.obj = emptyNP(); return cl.obj; }
    if (!cl.pp) cl.pp = emptyNP(); return cl.pp;
  };
  p.roles.forEach((role, i) => {
    if (!role) return;
    if (role === 'shout') { out.shout = i; return; }
    if (role === 'clauseconj') { out.clauseConj = i; return; }
    const [c, a, b] = role.split('.');
    const cl = clauses[c === 'c2' ? 2 : 1];
    if (a === 'open') cl.open = i;
    else if (a === 'verb' || a === 'verb2') cl.verbs.push(i);
    else if (a === 'verbconj') cl.verbConj = i;
    else if (a === 'adv' || a === 'adv2') cl.advs.push(i);
    else if (a === 'advconj') cl.advConj = i;
    else if (a === 'prep' || a === 'prep2') cl.preps.push(i);
    else if (a === 'prepconj') cl.prepConj = i;
    else if (a === 'subj' && b === 'pron') cl.subjPron = i;
    else if (a === 'subj' && b === 'conj') cl.subjConj = i;
    else if (a === 'obj' && b === 'pron') cl.objPron = i;
    else {
      const np = npFor(cl, a);
      if (b === 'art') np.art = i; else if (b === 'adj') np.adjs.push(i); else if (b === 'noun') np.noun = i;
    }
  });
  out.clauses.push(clauses[1]);
  if (p.roles.some((r) => r?.startsWith('c2')) || p.inserted.some((x) => x.role.startsWith('c2'))) out.clauses.push(clauses[2]);
  return out;
}

// Does this clause's subject take the plain verb (they run) or the -s verb
// (the cat runs)? I, you, we, they, plural nouns and "and" subjects take
// the plain verb. With "or" the verb agrees with the nearest noun.
export function subjectIsPlural(tokens: Token[], cl: ClauseInfo): boolean {
  if (cl.subjPron !== undefined) {
    const w = normWord(tokens[cl.subjPron].word ?? 'he');
    return w === 'I' || w === 'you' || w === 'we' || w === 'they';
  }
  const nounPlural = (np?: NP) => !!(np?.noun !== undefined && nounByWord.get((tokens[np.noun].word ?? '').toLowerCase())?.plural);
  if (cl.subj.length > 1) {
    const conj = cl.subjConj !== undefined ? (tokens[cl.subjConj].word ?? 'and').toLowerCase() : 'and';
    return conj === 'and' ? true : nounPlural(cl.subj[1]);
  }
  return nounPlural(cl.subj[0]);
}
