import type { Draft, HelpLevel, Marks, Tense, Token, VerbForm } from './types';
import type { Kind } from '../ui/board/parts';

// The Workboard's machine lines (teacher 2026-10-07). A line is a row of
// snapped-together machines. Word machines become rail tokens in order;
// finishing machines become the marks: the Big Letter Press capitalizes
// the word after it, a Comma Clip adds a comma after the word before it,
// a Stop Stamp or Bang Whistle at the end is the end mark, a Bang Whistle
// right after a shout word is the shout's "!", and the Pixel TV must be
// plugged on the very end.

export interface BoardItem { id: string; kind: Kind; word: string | null; form?: VerbForm }
export interface BoardLine { id: string; x: number; y: number; items: BoardItem[]; tense?: Tense; stars?: number | null }

export type FinishProblem = 'NEED_CAP' | 'NEED_END' | 'NEED_TV' | 'END_NOT_LAST' | 'TV_NOT_LAST' | 'EMPTY_PART' | 'NO_WORDS';
export const tenseOf = (line: BoardLine): Tense => (line.items.find((i) => i.kind === 'clock')?.word as Tense | undefined) ?? 'present';
export interface LineRead { draft: Draft; tokenIds: string[]; problems: { code: FinishProblem; itemId?: string }[]; hasTV: boolean }

const isWord = (k: Kind) => k.length === 1;

export function readLine(line: BoardLine, level: HelpLevel, requireFinish = true): LineRead {
  const tokens: Token[] = []; const tokenIds: string[] = [];
  const marks: Marks = { capitals: [], endMark: null, shoutMark: false, commas: [] };
  const problems: LineRead['problems'] = [];
  const lastWord = line.items.reduce((m, it, i) => (isWord(it.kind) ? i : m), -1);
  let pendingCap = false;
  line.items.forEach((it, i) => {
    if (isWord(it.kind)) {
      if (!it.word) problems.push({ code: 'EMPTY_PART', itemId: it.id });
      if (pendingCap) marks.capitals.push(tokens.length);
      pendingCap = false;
      tokens.push({ pos: it.kind as Token['pos'], word: it.word, ...(level !== 'full' ? { form: it.form ?? 'base' } : {}) });
      tokenIds.push(it.id);
    } else if (it.kind === 'cap') pendingCap = true;
    else if (it.kind === 'comma') { if (tokens.length) marks.commas.push(tokens.length - 1); }
    else if (it.kind === 'stop' || it.kind === 'bang') {
      if (i > lastWord) marks.endMark = it.kind === 'stop' ? '.' : '!';
      else if (it.kind === 'bang' && tokens[tokens.length - 1]?.pos === 'I') marks.shoutMark = true;
      else problems.push({ code: 'END_NOT_LAST', itemId: it.id });
    } else if (it.kind === 'tv' && line.items.slice(i + 1).some((x) => isWord(x.kind) || ['cap', 'stop', 'bang', 'comma'].includes(x.kind))) problems.push({ code: 'TV_NOT_LAST', itemId: it.id });
  });
  const hasTV = line.items.some((it) => it.kind === 'tv');
  if (!tokens.length) problems.unshift({ code: 'NO_WORDS' });
  if (requireFinish && tokens.length) {
    if (!marks.capitals.includes(0)) problems.push({ code: 'NEED_CAP' });
    if (!marks.endMark) problems.push({ code: 'NEED_END' });
    if (!hasTV) problems.push({ code: 'NEED_TV' });
  }
  return { draft: { tokens, tense: tenseOf(line), level, marks }, tokenIds, problems, hasTV };
}

// Gus's words for each finishing problem (kid words, never a trap).
export const FINISH_LINES: Record<FinishProblem, { joke: string; fix: string }> = {
  NO_WORDS: { joke: 'An empty machine. Very minimalist.', fix: 'Add some word machines from the Parts drawer.' },
  EMPTY_PART: { joke: 'One of these machines has no word in it. It is just humming to itself.', fix: 'Tap the machine with the ? and pick its word.' },
  NEED_CAP: { joke: 'Every sentence starts with a capital letter. My machine insists.', fix: 'Plug a Capital Letter Press onto the front.' },
  NEED_END: { joke: 'This sentence has no punctuation at the end. It might go on forever!', fix: 'Plug punctuation onto the end: a period or an exclamation point.' },
  NEED_TV: { joke: 'Lovely sentence. But where will the movie play?', fix: 'Plug a Pixel TV onto the very end.' },
  END_NOT_LAST: { joke: 'End punctuation in the middle? The sentence would trip over it.', fix: 'Move the punctuation to the end of the sentence.' },
  TV_NOT_LAST: { joke: 'The TV is stuck in the middle of the pipes.', fix: 'Move the Pixel TV after the words and punctuation.' },
};

// Paragraphs (teacher 2026-10-07: "another machine part that makes it so
// paragraphs/collections of sentences can be added"): a Paragraph Link on
// a machine hooks it to the next machine below it in reading order.
export function paragraphs(lines: BoardLine[]): BoardLine[][] {
  const order = readingOrder(lines);
  const out: BoardLine[][] = [];
  let cur: BoardLine[] = [];
  for (const l of order) {
    cur.push(l);
    if (!l.items.some((i) => i.kind === 'link')) { out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}

// Reading order on the board: top to bottom, then left to right.
export const readingOrder = (lines: BoardLine[]) => [...lines].sort((a, b) => (Math.abs(a.y - b.y) > 60 ? a.y - b.y : a.x - b.x));
