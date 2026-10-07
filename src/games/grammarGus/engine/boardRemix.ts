import type { HelpLevel } from './types';
import { readLine, type BoardItem, type BoardLine } from './board';
import { runSentence } from './pipeline';
import { pronounFor } from './remix';
import { ADJECTIVES, ADVERBS, NOUNS, PREPOSITIONS, nounByWord } from '../data/wordbank';
import { wordPosOf } from '../ui/board/parts';
import { pick, type Rng } from './rng';

// Remix tools on the Workboard (moved from the classic machine, teacher
// 2026-10-07 "run until this dev plan is complete"). Each tool changes the
// machine's parts and keeps only a change that still makes a working
// sentence, or it says why it cannot.
export type RemixKind = 'longer' | 'shorter' | 'silly' | 'pronoun';
export interface RemixResult { items: BoardItem[]; note: string }

const works = (line: BoardLine, items: BoardItem[], level: HelpLevel) => runSentence(readLine({ ...line, items }, level, false).draft).validation.ok;
const idx = (items: BoardItem[], pos: string) => items.findIndex((i) => wordPosOf(i.kind) === pos);

export function remixLine(line: BoardLine, kind: RemixKind, level: HelpLevel, rng: Rng, uid: () => string): RemixResult | string {
  const items = line.items;
  const core = (w: string[]) => w.length ? w : ['silly'];
  if (kind === 'longer') {
    const n = idx(items, 'N'); const v = idx(items, 'V');
    const tries: [string, () => BoardItem[]][] = [];
    if (n >= 0 && !items.slice(0, n).some((i) => wordPosOf(i.kind) === 'J')) tries.push(['a describing word', () => { const w = pick(rng, core(ADJECTIVES.filter((a) => a.pack === 'core').map((a) => a.word))); const c = [...items]; c.splice(n, 0, { id: uid(), kind: 'J', word: w }); return c; }]);
    if (v >= 0 && !items.some((i) => wordPosOf(i.kind) === 'D')) tries.push(['a how word', () => { const w = pick(rng, ADVERBS.filter((a) => a.pack === 'core').map((a) => a.word)); const c = [...items]; c.splice(v + 1, 0, { id: uid(), kind: 'D', word: w }); return c; }]);
    if (v >= 0 && !items.some((i) => wordPosOf(i.kind) === 'P')) tries.push(['where words', () => { const end = items.reduce((m, it, i) => (wordPosOf(it.kind) ? i : m), -1); const c = [...items]; c.splice(end + 1, 0, { id: uid(), kind: 'P', word: pick(rng, ['on', 'under', 'near', 'behind']) }, { id: uid(), kind: 'A', word: 'the' }, { id: uid(), kind: 'N', word: pick(rng, NOUNS.filter((x) => x.pack === 'core' && x.kind === 'thing').map((x) => x.word)) }); return c; }]);
    for (const [what, make] of tries) for (let k = 0; k < 12; k++) { const c = make(); if (works(line, c, level)) return { items: c, note: `Longer! Gus added ${what}.` }; }
    return 'This machine is already nice and long. Try Make it shorter, or add a Comma Drawbridge and a second idea.';
  }
  if (kind === 'shorter') {
    const drop = (pred: (i: BoardItem) => boolean) => items.filter((i) => !pred(i));
    const options: [string, BoardItem[]][] = [
      ['the how word', drop((i) => wordPosOf(i.kind) === 'D')],
      ['the describing words', drop((i) => wordPosOf(i.kind) === 'J')],
    ];
    const p = idx(items, 'P');
    if (p >= 0) { let e = p + 1; while (e < items.length && ['A', 'J'].includes(wordPosOf(items[e].kind) ?? '')) e++; if (wordPosOf(items[e]?.kind) === 'N') options.unshift(['the where words', [...items.slice(0, p), ...items.slice(e + 1)]]); }
    for (const [what, c] of options) if (c.length < items.length && works(line, c, level)) return { items: c, note: `Shorter! Gus took off ${what}. Still a whole sentence.` };
    return 'This machine is as short as a sentence can be: a who and an action.';
  }
  if (kind === 'silly') {
    const n = idx(items, 'N');
    if (n < 0) return 'Silly Swap needs a noun machine to swap.';
    for (let k = 0; k < 30; k++) {
      const w = pick(rng, NOUNS.filter((x) => x.pack === 'core' && x.kind === 'thing' && x.word !== items[n].word).map((x) => x.word));
      const c = items.map((it, i) => (i === n ? { ...it, word: w } : it));
      if (works(line, c, level)) return { items: c, note: `Silly Swap! The ${items[n].word} became a ${w}. Still a whole sentence, much sillier.` };
    }
    return 'Gus could not find a sillier word that still works.';
  }
  // pronoun: the who becomes he, she, it or they
  const v = idx(items, 'V'); const n = idx(items, 'N');
  if (n < 0 || (v >= 0 && n > v)) return 'The who is already a pronoun (or missing).';
  let s = n; while (s > 0 && ['A', 'J'].includes(wordPosOf(items[s - 1].kind) ?? '')) s--;
  const word = (items[n].word ?? '').toLowerCase();
  const pron = nounByWord.get(word)?.plural || items.slice(s, n).some((i) => i.bottom?.kind === 'duplicator') || items[n].bottom?.kind === 'duplicator' ? 'they' : pronounFor(word);
  const capUnder = items.slice(s, n + 1).find((i) => i.bottom && i.bottom.kind !== 'duplicator')?.bottom;
  const c = [...items.slice(0, s), { id: uid(), kind: 'R' as const, word: pron, ...(capUnder ? { bottom: capUnder } : {}) }, ...items.slice(n + 1)];
  if (works(line, c, level)) return { items: c, note: `Pronoun swap! "${word}" became "${pron}".` };
  void PREPOSITIONS;
  return 'Gus could not swap that one.';
}
