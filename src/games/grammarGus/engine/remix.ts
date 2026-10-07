import type { Tense } from './types';
import { buildTokens, CORE_VERBS, POOLS, SLOT_BY_KEY, type HousingId, type Words } from './machine';
import { runSentence, type Run } from './pipeline';
import { pick, type Rng } from './rng';
import { nounByWord, verbByBase } from '../data/wordbank';

// Remix tools (plan 17.6). Every tool goes through the grammar engine, so
// a remixed machine still only makes real sentences: a tool returns null
// rather than leave the machine broken.

export interface MachineState { words: Words; whoPron: boolean; howFirst: boolean; open: HousingId[] }
interface Opts { tense: Tense; gentleOnly?: boolean }

const runOf = (m: MachineState, tense: Tense): Run => runSentence({ tokens: buildTokens(m.words, m.whoPron, m.howFirst).tokens, tense, level: 'full' });
const ok = (m: MachineState, tense: Tense) => runOf(m, tense).validation.ok;
const threeStar = (m: MachineState, tense: Tense) => runOf(m, tense).rubric?.stars === 3;
const hasObj = (w: Words) => !!w['obj.noun'] || verbByBase.get(w['did.verb'] ?? '')?.objectUse === 'T';

function candidates(key: string, w: Words, o: Opts): string[] {
  if (key === 'did.verb') return CORE_VERBS.filter((v) => (hasObj(w) && w['obj.noun'] ? v.objectUse !== 'I' : v.objectUse !== 'T') && (!o.gentleOnly || v.gentle !== false)).map((v) => v.base);
  return POOLS[key === 'who.pron' ? 'R' : SLOT_BY_KEY.get(key)!.pos];
}

// 🎲 Dice: re-roll one part with a random word that keeps the sentence working.
export function rollPart(m: MachineState, key: string, rng: Rng, o: Opts): MachineState | null {
  const was = m.words[key];
  for (let k = 0; k < 60; k++) {
    const w = pick(rng, candidates(key, m.words, o));
    if (w === was) continue;
    const next = { ...m, words: { ...m.words, [key]: w } };
    if (ok(next, o.tense)) return next;
  }
  return null;
}

// 🤪 Silly Swap: swap naming, action and how words for sillier ones; the
// silly score goes up or stays the same, and the sentence keeps 3 stars.
export function sillySwap(m: MachineState, rng: Rng, o: Opts): MachineState | null {
  const before = runOf(m, o.tense).rubric?.silly ?? 0;
  const keys = ['who.noun', 'did.verb', 'obj.noun', 'how.adv', 'where.noun'].filter((k) => m.words[k] && !(k === 'who.noun' && m.whoPron));
  if (!keys.length) return null;
  let best: { m: MachineState; silly: number } | null = null;
  for (let k = 0; k < 120; k++) {
    const w = { ...m.words };
    const n = 1 + Math.floor(rng() * Math.min(2, keys.length));
    for (let i = 0; i < n; i++) { const key = pick(rng, keys); w[key] = pick(rng, candidates(key, w, o)); }
    const next = { ...m, words: w };
    const r = runOf(next, o.tense);
    if (r.rubric?.stars !== 3) continue;
    if (r.rubric.silly >= before && (!best || r.rubric.silly > best.silly)) best = { m: next, silly: r.rubric.silly };
  }
  return best && JSON.stringify(best.m.words) !== JSON.stringify(m.words) ? best.m : null;
}

// ➕ Make it longer: add one optional part (describing word, how word, or a
// where phrase) filled with a word that keeps 3 stars when it can.
export function makeLonger(m: MachineState, rng: Rng, o: Opts): MachineState | null {
  const options: { keys: string[]; open?: HousingId }[] = [];
  if (!m.whoPron && !m.words['who.adj1']) options.push({ keys: ['who.adj1'] });
  else if (!m.whoPron && !m.words['who.adj2']) options.push({ keys: ['who.adj2'] });
  if (m.words['obj.noun'] && !m.words['obj.adj']) options.push({ keys: ['obj.adj'] });
  if (!m.words['how.adv']) options.push({ keys: ['how.adv'], open: 'how' });
  if (!m.words['where.prep']) options.push({ keys: ['where.prep', 'where.art', 'where.noun'], open: 'where' });
  if (!options.length) return null;
  for (const want3 of [true, false]) for (let k = 0; k < 80; k++) {
    const opt = pick(rng, options);
    const w = { ...m.words };
    for (const key of opt.keys) w[key] = pick(rng, candidates(key, w, o));
    const next = { ...m, words: w, open: opt.open && !m.open.includes(opt.open) ? [...m.open, opt.open] : m.open };
    if (want3 ? threeStar(next, o.tense) : ok(next, o.tense)) return next;
  }
  return null;
}

// ➖ Make it shorter: take off one optional part. Never the WHO or the verb.
export function makeShorter(m: MachineState, rng: Rng, o: Opts): MachineState | null {
  const groups: string[][] = [['who.adj2'], ['who.adj1'], ['obj.adj'], ['how.adv'], ['where.prep', 'where.art', 'where.noun'], ['shout']].filter((g) => g.some((k) => m.words[k]));
  for (const g of [...groups].sort(() => rng() - 0.5)) {
    const w = { ...m.words };
    for (const k of g) w[k] = null;
    if (g[0] === 'who.adj1' && w['who.adj2']) { w['who.adj1'] = w['who.adj2']; w['who.adj2'] = null; }
    const next = { ...m, words: w, howFirst: g[0] === 'how.adv' ? false : m.howFirst };
    if (ok(next, o.tense)) return next;
  }
  return null;
}

// 🔁 Pronoun swap: the cat becomes it, the girl becomes she, and back.
const SHE = new Set(['girl', 'woman', 'mom', 'aunt', 'sister', 'grandmother']);
const HE = new Set(['boy', 'man', 'dad', 'son', 'uncle']);
export function pronounFor(noun: string): string {
  const e = nounByWord.get(noun);
  if (!e) return 'it';
  if (e.plural || e.group) return 'they';
  if (SHE.has(noun)) return 'she';
  if (HE.has(noun)) return 'he';
  return e.kind === 'human' ? 'they' : 'it';
}
export function pronounSwap(m: MachineState, o: Opts): MachineState | null {
  if (m.whoPron) return m.words['who.noun'] ? { ...m, whoPron: false } : null;
  const noun = m.words['who.noun'];
  if (!noun) return null;
  const next = { ...m, whoPron: true, words: { ...m.words, 'who.pron': pronounFor(noun) } };
  return ok(next, o.tense) ? next : null;
}
