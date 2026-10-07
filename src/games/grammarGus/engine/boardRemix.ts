import type { HelpLevel } from './types';
import { readLine, type BoardItem, type BoardLine } from './board';
import { runSentence } from './pipeline';
import { analyze } from './analyze';
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

// The Flip Switch (Logic Gate, Claudia's Phase 1): moves a because, when,
// after, before, while or if idea to the front with a comma after it, or
// back to the end. The Capital Letter Press moves to the new first word.
const SUB_WORDS = ['because', 'when', 'after', 'before', 'while', 'if'];
export function flipIdeas(items: BoardItem[], uid: () => string): { items: BoardItem[]; front: boolean } | string {
  const isWord = (i: BoardItem) => !!wordPosOf(i.kind);
  const firstW = items.findIndex(isWord);
  let lastW = -1; items.forEach((it, i) => { if (isWord(it)) lastW = i; });
  const conj = items.findIndex((i) => wordPosOf(i.kind) === 'C' && SUB_WORDS.includes((i.word ?? '').toLowerCase()));
  if (conj < 0 || firstW < 0) return 'The Flip Switch needs a because, when, after, before, while or if joining two ideas.';
  const strip = (i: BoardItem): BoardItem => ({ ...i, ...(i.bottom && i.bottom.kind !== 'duplicator' && i.bottom.kind !== 'taggun' && i.bottom.kind !== 'inflator' ? { bottom: undefined } : {}), ...(i.top && (i.top.kind === 'comma' || i.top.kind === 'dominoes') ? { top: undefined } : {}) });
  const before = items.slice(0, firstW);
  const after = items.slice(lastW + 1);
  const words = items.slice(firstW, lastW + 1).map(strip);
  const k = conj - firstW;
  const capOf = items.slice(firstW, lastW + 1).find((i) => i.bottom && ['cap', 'pulley'].includes(i.bottom.kind))?.bottom ?? { id: uid(), kind: 'cap' as const, word: null };
  let out: BoardItem[];
  let front: boolean;
  if (k === 0) {
    // Already in front: find where the main idea starts (the second who) and move the depending idea back.
    const rd = readLine({ id: 'flip', x: 0, y: 0, items }, 'full', false);
    const c1 = analyze(rd.draft.tokens).parse.roles.findIndex((r) => !!r && r.startsWith('c1.') && r !== 'c1.open');
    const mainStart = c1 >= 0 ? words.findIndex((w) => w.id === rd.tokenIds[c1]) : -1;
    if (mainStart < 0) return 'Gus could not find where the main idea starts.';
    const sub = words.slice(0, mainStart); const main = words.slice(mainStart);
    out = [...before, { ...main[0], bottom: capOf }, ...main.slice(1), ...sub, ...after];
    front = false;
  } else {
    const main = words.slice(0, k); const sub = words.slice(k);
    const lastSub = sub[sub.length - 1];
    out = [...before, { ...sub[0], bottom: capOf }, ...sub.slice(1, -1), ...(sub.length > 1 ? [{ ...lastSub, top: { id: uid(), kind: 'comma' as const, word: null } }] : []), ...main, ...after];
    front = true;
  }
  return { items: out, front };
}
