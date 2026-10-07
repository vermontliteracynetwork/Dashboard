import type { HelpLevel, Tense } from './types';
import { readLine, type BoardItem, type BoardLine } from './board';
import { adjRank, expectedForms } from './compose';
import { analyze } from './analyze';
import { articleFor, tenseOfForm, verbText } from './conjugate';
import { nounByWord, verbByBase } from '../data/wordbank';
import { pronounFor } from './remix';
import { caseSwap, OBJ_OF, SUBJ_OF } from './validate';
import { TIME_TENSE } from '../data/timeWords';
import { wordPosOf } from '../ui/board/parts';

// Helper gadgets (Claudia's parts catalog, NOW tier; teacher 2026-10-07
// "build now"). When the Start Lever is pulled, each gadget on the machine
// checks or fixes one grammar job, out loud and on screen, before the
// marble rolls: the Time Tunnel sets the time, the Pronoun Teleporter
// zaps a repeated noun into a pronoun, the Describe Sorter puts describing
// words in order, the A/An Sniffer fixes a and an, and the Agreement Gears
// make the action match the who.

export interface GadgetEvent { itemId: string; pop: string; note?: string; fixed: boolean }
export interface GadgetResult { items: BoardItem[]; events: GadgetEvent[]; changed: boolean }

const clone = (items: BoardItem[]) => items.map((i) => ({ ...i }));
const readOf = (line: BoardLine, items: BoardItem[], level: HelpLevel) => readLine({ ...line, items }, level, false);

// The Clock (or Time Tunnel) changes the words in the machine (teacher
// 2026-10-07: "make sure the time click changes the words in the machine").
// Every action word takes the form for the new time.
export function retimeItems(line: BoardLine, tense: Tense, level: HelpLevel): BoardItem[] {
  const items = clone(line.items).map((i) => (i.kind === 'clock' ? { ...i, word: tense } : i));
  if (level === 'full') return items; // Full help: the plates follow the Clock by themselves
  const rd = readOf(line, items, level);
  const forms = expectedForms({ ...rd.draft, tense });
  forms.forEach((want, idx) => { const it = items.find((x) => x.id === rd.tokenIds[idx]); if (it) it.form = want; });
  return items;
}

// The first noun before the first action word: who the sentence is about.
function subjectNoun(items: BoardItem[]): { idx: number; word: string } | null {
  for (let i = 0; i < items.length; i++) {
    const p = wordPosOf(items[i].kind);
    if (p === 'V') return null;
    if (p === 'N' && items[i].word) return { idx: i, word: items[i].word!.toLowerCase() };
  }
  return null;
}

export function applyGadgets(line: BoardLine, level: HelpLevel, prev?: BoardLine): GadgetResult {
  let items = clone(line.items);
  const events: GadgetEvent[] = [];
  const at = (k: string) => items.find((i) => i.kind === k);
  // Time Tunnel: the time word sets the Clock and the action words.
  const tun = at('tunnel');
  const t = tun?.word ? TIME_TENSE.get(tun.word.toLowerCase()) : undefined;
  if (tun && t) {
    const clock = at('clock');
    const before = JSON.stringify(items);
    items = retimeItems({ ...line, items }, t, level);
    const moved = JSON.stringify(items) !== before;
    events.push({ itemId: tun.id, pop: `WARP! ${t.toUpperCase()}`, fixed: moved, note: moved ? `The Time Tunnel zoomed everything to the ${t}${clock ? ' and turned the Clock' : ''}: "${tun.word}" happens in the ${t}.` : undefined });
  }
  // Pronoun Teleporter: the same noun as the sentence before becomes a pronoun.
  const tel = at('teleporter');
  if (tel) {
    const mine = subjectNoun(items); const theirs = prev ? subjectNoun(prev.items) : null;
    if (mine && theirs && (mine.word === theirs.word || nounByWord.get(mine.word)?.singular === theirs.word)) {
      let start = mine.idx;
      while (start > 0 && ['A', 'J'].includes(wordPosOf(items[start - 1].kind) ?? '') || (start > 0 && items[start - 1].kind === 'duplicator')) start--;
      const plural = items.slice(start, mine.idx).some((i) => i.kind === 'duplicator') || !!nounByWord.get(mine.word)?.plural;
      const pron = plural ? 'they' : pronounFor(mine.word);
      const gone = items.slice(start, mine.idx + 1).filter((i) => wordPosOf(i.kind) || i.kind === 'duplicator');
      const keep = items.slice(start, mine.idx + 1).filter((i) => !gone.includes(i));
      const capUnder = gone.find((i) => i.bottom)?.bottom; // a capital letter press under "the" moves under the pronoun
      items = [...items.slice(0, start), ...keep, { id: `${gone[gone.length - 1].id}-r`, kind: 'R', word: pron, ...(capUnder && capUnder.kind !== 'duplicator' ? { bottom: capUnder } : {}) }, ...items.slice(mine.idx + 1)];
      events.push({ itemId: tel.id, pop: `ZAP! ${pron}`, fixed: true, note: `The Pronoun Teleporter zapped "${mine.word}" into "${pron}", so it does not repeat.` });
    } else events.push({ itemId: tel.id, pop: 'zzz...', fixed: false, note: prev ? undefined : 'The Pronoun Teleporter waits for a noun that repeats from the sentence before. Hook two sentences with a Paragraph Link.' });
  }
  // Describe Sorter: describing words in order (feeling, size, age, look, color).
  const sorter = at('sorter');
  if (sorter) {
    const rd = readOf(line, items, level); const a = analyze(rd.draft.tokens);
    let moved = false;
    for (const np of a.clauses.flatMap((cl) => [...cl.subj, cl.obj, cl.pp]).filter((x) => !!x)) {
      const its = np.adjs.map((i) => items.find((x) => x.id === rd.tokenIds[i])!).filter((x) => x?.word);
      const sorted = [...its.map((x) => x.word!)].sort((x, y) => adjRank(x) - adjRank(y));
      its.forEach((x, k) => { if (x.word !== sorted[k]) { x.word = sorted[k]; moved = true; } });
    }
    events.push({ itemId: sorter.id, pop: moved ? 'CLACK-CLACK! Sorted!' : 'CLACK! In order!', fixed: moved, note: moved ? 'The Describe Sorter clacked the describing words into order: feeling, size, age, look, then color.' : undefined });
  }
  // A/An Sniffer: a before a consonant sound, an before a vowel sound, the with more than one.
  const sniff = at('sniffer');
  if (sniff) {
    const rd = readOf(line, items, level); const a = analyze(rd.draft.tokens);
    const fixes: string[] = [];
    for (const np of a.clauses.flatMap((cl) => [...cl.subj, cl.obj, cl.pp]).filter((x) => !!x)) {
      if (np.art === undefined) continue;
      const it = items.find((x) => x.id === rd.tokenIds[np.art!]);
      const art = it?.word?.toLowerCase();
      if (!it || !art || art === 'the') continue;
      const noun = np.noun !== undefined ? nounByWord.get((rd.draft.tokens[np.noun].word ?? '').toLowerCase()) : undefined;
      const next = rd.draft.tokens[np.art + 1]?.word;
      const want = noun?.plural || noun?.noA ? 'the' : next ? articleFor(next) : art;
      if (want !== art) { it.word = want; fixes.push(`${art} → ${want}`); }
    }
    events.push({ itemId: sniff.id, pop: fixes.length ? `ACHOO! ${fixes[0]}` : 'sniff... all good!', fixed: !!fixes.length, note: fixes.length ? `The A/An Sniffer sneezed: ${fixes.join(', ')}. "an" goes before a vowel sound, "the" with more than one.` : undefined });
  }
  // Subject and Object Turnstile: he goes first, him after the action.
  const turn = at('turnstile');
  if (turn) {
    const rd = readOf(line, items, level);
    const swaps: string[] = [];
    for (const k of caseSwap(rd.draft.tokens)) {
      const it = items.find((x) => x.id === rd.tokenIds[k]);
      if (!it?.word) continue;
      const w = it.word === 'I' || it.word === 'i' ? 'I' : it.word.toLowerCase();
      const other = SUBJ_OF[w] ?? OBJ_OF[w];
      swaps.push(`${it.word} → ${other}`); it.word = other;
    }
    events.push({ itemId: turn.id, pop: swaps.length ? `BONK! ${swaps[0]}` : 'CLICK-CLICK', fixed: !!swaps.length, note: swaps.length ? `The Pronoun Turnstile bonked and swapped: ${swaps.join(', ')}. The doer takes I, he, she, we, they. After the action: me, him, her, us, them.` : undefined });
  }
  // Agreement Gears: the action matches the who (one or more than one).
  const gears = at('gears');
  if (gears) {
    const rd = readOf(line, items, level);
    const fixed: string[] = [];
    if (level !== 'full') {
      expectedForms(rd.draft).forEach((want, idx) => {
        const it = items.find((x) => x.id === rd.tokenIds[idx]);
        if (!it?.word) return;
        const got = it.form ?? 'base';
        if (tenseOfForm(got) === rd.draft.tense && got !== want) { const v = verbByBase.get(it.word); if (v) fixed.push(`${verbText(v, got)} → ${verbText(v, want)}`); it.form = want; }
      });
    }
    events.push({ itemId: gears.id, pop: fixed.length ? `GRIND... ${fixed[0]}` : 'MESH! Whirrr', fixed: !!fixed.length, note: fixed.length ? `The Agreement Gears ground and shifted: ${fixed.join(', ')}. One who takes "jumps", more than one takes "jump".` : undefined });
  }
  return { items, events, changed: JSON.stringify(items) !== JSON.stringify(line.items) };
}
