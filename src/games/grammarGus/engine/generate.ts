import type { Tense, Token } from './types';
import { PATTERNS, patternsForColumns, type Pattern } from '../data/patterns';
import { parse } from './grammar';
import { validateSentence } from './validate';
import { runSentence } from './pipeline';
import { pick, type Rng } from './rng';
import { exampleTokens } from './fromText';
import { adjRank } from './compose';
import {
  ADJECTIVES, ADVERBS, CONJ_POOLS, INTERJECTIONS, NOUNS, PREPOSITIONS, SUBJECT_PRONOUNS, VERBS, nounByWord,
} from '../data/wordbank';

// The Surprise Hopper / spin generator (plan 15.3 and 16). Pattern first,
// never independent random reels: pick a valid pattern for the column
// count, fill each reel only from words that fit, re-roll until the
// sentence is valid (and, for the Hopper, earns 3 stars).

export interface SpinSettings {
  columns: number; tense: Tense | 'random'; nounTier: 1 | 2 | 3;
  patternFocus?: number; gentleOnly?: boolean; threeStar?: boolean;
}
export interface Reel extends Token { locked?: boolean }
export interface SpinResult { pattern: Pattern; reels: Reel[]; tense: Tense; attempts: number }

function rolesFor(pattern: Pattern): string[] {
  return parse(pattern.symbols.map((pos) => ({ pos, word: null })), true).roles.map((r) => r ?? '');
}

const ADJ_POOL = ADJECTIVES.filter((a) => a.pack !== 'example').map((a) => a.word);
const ADV_POOL = ADVERBS.map((a) => a.word);

export function candidatesFor(reels: Reel[], i: number, roles: string[], s: SpinSettings): string[] {
  const role = roles[i];
  const pos = reels[i].pos;
  const npPrefix = role.split('.').slice(0, 2).join('.');
  const npNounIdx = roles.findIndex((r, k) => k > i && r === `${npPrefix}.noun`);
  const npArtIdx = roles.findIndex((r, k) => k < i && r === `${npPrefix}.art`);
  switch (pos) {
    case 'A': {
      const noun = npNounIdx >= 0 && reels[npNounIdx].locked ? nounByWord.get(reels[npNounIdx].word ?? '') : undefined;
      return noun?.plural || noun?.noA ? ['the'] : ['a', 'the'];
    }
    case 'N': {
      const art = npArtIdx >= 0 ? reels[npArtIdx].word : null;
      return NOUNS.filter((x) => x.tier <= s.nounTier && !(art && art !== 'the' && (x.plural || x.noA))).map((x) => x.word);
    }
    case 'J': return ADJ_POOL;
    case 'D': return ADV_POOL;
    case 'P': return PREPOSITIONS;
    case 'I': return [...INTERJECTIONS];
    case 'R': return [...SUBJECT_PRONOUNS];
    case 'C': {
      if (role === 'clauseconj') return [...CONJ_POOLS.clause];
      if (role.endsWith('subj.conj')) return [...CONJ_POOLS.subject];
      if (role.endsWith('verbconj')) return [...CONJ_POOLS.verb];
      if (role.endsWith('advconj')) return [...CONJ_POOLS.adverb];
      return [...CONJ_POOLS.prep];
    }
    case 'V': {
      const clause = role.split('.')[0];
      const lastVerb = !roles.some((r, k) => k > i && r.startsWith(`${clause}.verb`));
      const needsObj = lastVerb && roles.some((r) => r.startsWith(`${clause}.obj`));
      return VERBS.filter((v) => (needsObj ? v.objectUse !== 'I' : v.objectUse !== 'T') && (!s.gentleOnly || v.gentle !== false)).map((v) => v.base);
    }
  }
}

function tryFill(pattern: Pattern, locked: (Reel | null)[], s: SpinSettings, rng: Rng): Reel[] {
  const roles = rolesFor(pattern);
  const reels: Reel[] = pattern.symbols.map((pos, i) => locked[i] && locked[i]!.pos === pos ? { ...locked[i]!, locked: true } : { pos, word: null });
  // Nouns before articles, so "a" never lands in front of mice.
  const order = reels.map((_, i) => i).sort((x, y) => (reels[x].pos === 'A' ? 1 : 0) - (reels[y].pos === 'A' ? 1 : 0));
  for (const i of order) {
    if (reels[i].locked) continue;
    let choices = candidatesFor(reels, i, roles, s);
    const prevWord = reels[i - 1]?.word; const nextWord = reels[i + 1]?.word;
    choices = choices.filter((w) => w !== prevWord && w !== nextWord);
    reels[i].word = pick(rng, choices);
  }
  // Describing words always come out in order (plan 3.13).
  const groups = new Map<string, number[]>();
  roles.forEach((r, i) => { if (r.endsWith('.adj')) groups.set(r, [...(groups.get(r) ?? []), i]); });
  for (const idx of groups.values()) {
    if (idx.length < 2 || idx.some((i) => reels[i].locked)) continue;
    const sorted = idx.map((i) => reels[i].word!).sort((x, y) => adjRank(x) - adjRank(y));
    idx.forEach((i, k) => { reels[i].word = sorted[k]; });
  }
  return reels;
}

export function spin(s: SpinSettings, rng: Rng, current?: Reel[]): SpinResult {
  const locked = current?.map((r) => (r.locked ? r : null)) ?? [];
  let pool = s.patternFocus ? PATTERNS.filter((x) => x.id === s.patternFocus) : patternsForColumns(s.columns);
  if (locked.some(Boolean)) {
    const fit = pool.filter((p) => locked.every((r, i) => !r || p.symbols[i] === r.pos));
    if (fit.length) pool = fit;
  }
  const tense: Tense = s.tense === 'random' ? pick(rng, ['past', 'present', 'future'] as Tense[]) : s.tense;
  let last: SpinResult | null = null;
  for (let attempt = 1; attempt <= 200; attempt++) {
    const pattern = pick(rng, pool);
    const reels = tryFill(pattern, locked, s, rng);
    const draft = { tokens: reels.map(({ pos, word }) => ({ pos, word })), tense, level: 'full' as const };
    if (!validateSentence(draft).ok) continue;
    last = { pattern, reels, tense, attempts: attempt };
    if (!s.threeStar) return last;
    if (runSentence(draft).rubric?.stars === 3) return last;
  }
  // Never emit an invalid sentence: fall back to the pattern's own example.
  if (last && !s.threeStar) return last;
  const fallback = pool[0] ?? PATTERNS[0];
  return { pattern: fallback, reels: exampleReels(fallback), tense, attempts: 200 };
}

function exampleReels(p: Pattern): Reel[] { return exampleTokens(p).tokens; }
