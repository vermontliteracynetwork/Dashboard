import type { Draft, HelpLevel, Marks, Tense, Token, VerbForm } from './types';
import { isFront, markOf, wordPosOf, type Kind } from '../ui/board/parts';
import { TIME_TENSE } from '../data/timeWords';
import { compose } from './compose';
import { questionOf, quoteOf } from './question';
import { compareOf, pluralNounOf, possessiveOf } from './dictionary';

// The Workboard's machine lines (teacher 2026-10-07). A line is a row of
// snapped-together machines. Word machines (and fun parts that hold a
// word) become rail tokens in order; finishing machines (and fun parts
// that act like them) become the marks: the Capital Letter Press or
// Pulley capitalizes the word after it, a Comma or Dominoes adds a comma
// after the word before it, a period, exclamation point, Bell or Big Horn
// at the end is the end mark, an exclamation point or Big Horn right
// after a shout word is the shout's "!", the Duplicator makes the next
// noun more than one, and the Pixel TV must be plugged on the very end.

// top / bottom: a part snapped on above or below a word machine.
export interface BoardItem { id: string; kind: Kind; word: string | null; form?: VerbForm; top?: BoardItem; bottom?: BoardItem }
// Every part on a line, snapped-on parts included.
export const allParts = (items: BoardItem[]): BoardItem[] => items.flatMap((i) => [i, ...(i.top ? [i.top] : []), ...(i.bottom ? [i.bottom] : [])]);
export interface BoardLine { id: string; x: number; y: number; items: BoardItem[]; tense?: Tense; stars?: number | null; silly?: number; job?: { id?: string; kind: 'delivery' | 'inspector'; text: string; flaw?: string; done?: boolean }; connector?: string }

export type FinishProblem = 'NEED_CAP' | 'NEED_END' | 'NEED_TV' | 'END_NOT_LAST' | 'TV_NOT_LAST' | 'EMPTY_PART' | 'NO_WORDS' | 'COMMA_PLACE' | 'COPY_NO_NOUN' | 'BRIDGE_UP' | 'DEAD_END' | 'NOT_FRONT' | 'WRONG_HOST' | 'NEED_ASK' | 'NEED_CRANE' | 'CRANE_ONE_IDEA';
// The Time Tunnel's time word sets the time; otherwise the Clock does.
export const tenseOf = (line: BoardLine): Tense => {
  const tw = line.items.find((i) => i.kind === 'tunnel' && i.word)?.word;
  return (tw && TIME_TENSE.get(tw.toLowerCase())) || ((line.items.find((i) => i.kind === 'clock')?.word as Tense | undefined) ?? 'present');
};
export interface LineRead { draft: Draft; tokenIds: string[]; problems: { code: FinishProblem; itemId?: string }[]; hasTV: boolean; question: boolean }
// The mark an item makes (the Mood Meter Valve's depends on its setting).
export const itemMark = (it: BoardItem) => (it.kind === 'mood' ? (it.word === 'big' ? 'bang' : 'stop') : markOf(it.kind));
// Front parts (Confetti Trapdoor, Time Tunnel, Opener Slingshot) only
// work at the very front of the sentence, in the order they are snapped
// (teacher 2026-10-07: "everything snaps to click in the machine, in the
// right order in order to run").

export function readLine(line: BoardLine, level: HelpLevel, requireFinish = true): LineRead {
  const tokens: Token[] = []; const tokenIds: string[] = [];
  const marks: Marks = { capitals: [], endMark: null, shoutMark: false, commas: [] };
  const problems: LineRead['problems'] = [];
  const items = line.items;
  const mustFinish = requireFinish || items.some((i) => i.kind === 'flag');
  const lastWord = items.reduce((m, it, i) => (wordPosOf(it.kind) ? i : m), -1);
  let pendingCap = false; let capAfterShout = false; let mainStarted = false; let question = false;
  let pendingCopy: string | null = null;
  const commaAt: { tok: number; id: string }[] = [];
  items.forEach((it, i) => {
    const pos = wordPosOf(it.kind); const mark = itemMark(it);
    if (pos) {
      if (!it.word) problems.push({ code: 'EMPTY_PART', itemId: it.id });
      if (isFront(it.kind)) { if (mainStarted) problems.push({ code: 'NOT_FRONT', itemId: it.id }); } else mainStarted = true;
      const under = it.bottom ? itemMark(it.bottom) : null;
      if (pendingCap || capAfterShout || under === 'cap') marks.capitals.push(tokens.length);
      pendingCap = false; capAfterShout = false;
      let word = it.word;
      if (pos === 'N' && pendingCopy) { if (word) word = pluralNounOf(word); pendingCopy = null; }
      if (under === 'plural') { if (pos === 'N') { if (word) word = pluralNounOf(word); } else problems.push({ code: 'COPY_NO_NOUN', itemId: it.bottom!.id }); }
      if (under === 'poss') { if (pos === 'N') { if (word) word = possessiveOf(word); } else problems.push({ code: 'WRONG_HOST', itemId: it.bottom!.id }); }
      if (under === 'size') { if (pos === 'J') { if (word) word = compareOf(word, it.bottom!.word === 'er' ? 'er' : 'est'); } else problems.push({ code: 'WRONG_HOST', itemId: it.bottom!.id }); }
      if (it.kind === 'crusher' && word) word = pluralNounOf(word); // the Plural Crusher's noun is always more than one
      tokens.push({ pos, word, ...(level !== 'full' ? { form: it.form ?? 'base' } : {}) });
      tokenIds.push(it.id);
      // The Trapdoor's shout comes with its "!" and a capital letter after it;
      // the Slingshot and Time Tunnel bring their comma.
      if (it.kind === 'trapdoor') { marks.shoutMark = true; capAfterShout = true; }
      else if (isFront(it.kind) && it.word) marks.commas.push(tokens.length - 1);
      // Punctuation snapped on top: it comes right after this word.
      const over = it.top ? itemMark(it.top) : null;
      if (over === 'comma') {
        marks.commas.push(tokens.length - 1); commaAt.push({ tok: tokens.length - 1, id: it.top!.id });
        if (it.top!.kind === 'bridge') { const nx = items.slice(i + 1).find((x) => wordPosOf(x.kind)); if (!nx || wordPosOf(nx.kind) !== 'C') problems.push({ code: 'BRIDGE_UP', itemId: it.top!.id }); }
      } else if (over === 'stop' || over === 'bang' || over === 'ask') {
        if (i === lastWord) { marks.endMark = over === 'bang' ? '!' : '.'; question = over === 'ask'; }
        else if (over === 'bang' && pos === 'I') { marks.shoutMark = true; capAfterShout = true; }
        else problems.push({ code: 'END_NOT_LAST', itemId: it.top!.id });
      }
    } else if (mark === 'cap') pendingCap = true;
    else if (mark === 'plural') pendingCopy = it.id;
    else if (mark === 'comma') {
      if (tokens.length) { marks.commas.push(tokens.length - 1); commaAt.push({ tok: tokens.length - 1, id: it.id }); } else problems.push({ code: 'COMMA_PLACE', itemId: it.id });
      // The Comma Drawbridge only lowers right before a joining word.
      if (it.kind === 'bridge') { const nx = items.slice(i + 1).find((x) => wordPosOf(x.kind)); if (!nx || wordPosOf(nx.kind) !== 'C') problems.push({ code: 'BRIDGE_UP', itemId: it.id }); }
    } else if (mark === 'stop' || mark === 'bang' || mark === 'ask') {
      if (i > lastWord) { marks.endMark = mark === 'bang' ? '!' : '.'; question = mark === 'ask'; }
      else if (mark === 'bang' && tokens[tokens.length - 1]?.pos === 'I') { marks.shoutMark = true; capAfterShout = true; }
      else problems.push({ code: 'END_NOT_LAST', itemId: it.id });
    } else if (it.kind === 'tv' && items.slice(i + 1).some((x) => wordPosOf(x.kind) || markOf(x.kind))) problems.push({ code: 'TV_NOT_LAST', itemId: it.id });
  });
  // A comma after the last word is a pause before nothing.
  const tail = commaAt.find((c) => c.tok === tokens.length - 1);
  if (tail) problems.push({ code: 'COMMA_PLACE', itemId: tail.id });
  if (pendingCopy) problems.push({ code: 'COPY_NO_NOUN', itemId: pendingCopy });
  // A question mark needs the Question Crane, and the crane needs a question mark.
  const crane = items.find((i) => i.kind === 'crane');
  const askPart = allParts(items).find((i) => i.kind === 'ask');
  if (question && !crane && askPart) problems.push({ code: 'NEED_CRANE', itemId: askPart.id });
  if (crane && tokens.length && !question) problems.push({ code: 'NEED_ASK', itemId: crane.id });
  // The Dead-End Detector: every where word needs a noun after it.
  if (items.some((i) => i.kind === 'detector')) for (const id of deadEnds(line)) problems.push({ code: 'DEAD_END', itemId: id });
  const hasTV = items.some((it) => it.kind === 'tv');
  if (!tokens.length) problems.unshift({ code: 'NO_WORDS' });
  if (mustFinish && tokens.length) {
    if (!marks.capitals.includes(0)) problems.push({ code: 'NEED_CAP' });
    if (!marks.endMark) problems.push({ code: 'NEED_END' });
    if (!hasTV) problems.push({ code: 'NEED_TV' });
  }
  const draft: Draft = { tokens, tense: tenseOf(line), level, marks };
  if (crane && question && tokens.every((t) => t.word) && !questionOf(draft)) problems.push({ code: 'CRANE_ONE_IDEA', itemId: crane.id });
  return { draft, tokenIds, problems, hasTV, question };
}

// The sentence as it reads on the plate, the TV caption and the Journal:
// the Question Crane flips it into a question, the Speech Bubble Blower
// wraps it in quotation marks.
export function lineText(line: BoardLine, rd: LineRead): string {
  if (!rd.draft.tokens.some((t) => t.word)) return '';
  const crane = line.items.some((i) => i.kind === 'crane');
  let text = (rd.question && crane ? questionOf(rd.draft) : null) ?? compose(rd.draft).text;
  if (rd.question && !crane) text = text.replace(/[.!]$/, '?');
  const bubble = line.items.find((i) => i.kind === 'bubble');
  if (bubble?.word && /[.!?]$/.test(text)) text = quoteOf(text, bubble.word, rd.question);
  return text;
}

// Where words (prepositions) with no noun landing after them.
export function deadEnds(line: BoardLine): string[] {
  const out: string[] = [];
  const items = line.items.filter((i) => wordPosOf(i.kind));
  items.forEach((it, k) => {
    if (wordPosOf(it.kind) !== 'P') return;
    let landed = false;
    for (const nx of items.slice(k + 1)) { const p = wordPosOf(nx.kind); if (p === 'N' || p === 'R') { landed = true; break; } if (p === 'V' || p === 'P' || p === 'C') break; }
    if (!landed) out.push(it.id);
  });
  return out;
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
  COMMA_PLACE: { joke: 'A comma with no word on one side? That is a pause for nothing.', fix: 'A comma goes right after a word, with more words after it.' },
  BRIDGE_UP: { joke: 'The drawbridge is stuck up. It only comes down right before a joining word.', fix: 'Put the Comma Drawbridge right before and, but or or.' },
  WRONG_HOST: { joke: 'That part is snapped onto the wrong kind of word. It looks very confused.', fix: 'The Tag Gun goes under a noun. The Size-Up Inflator goes under a describing word.' },
  NEED_CRANE: { joke: 'A question mark on a telling sentence? Gus is very puzzled?', fix: 'Snap on a Question Crane to turn it into a question, or use a period.' },
  NEED_ASK: { joke: 'The crane lifted a question, but it has no question mark to land on.', fix: 'End a question with a Question Mark.' },
  CRANE_ONE_IDEA: { joke: 'The crane can only lift one idea at a time. Two is too heavy!', fix: 'Use the Question Crane on a sentence with one who and one action, and no shout at the front.' },
  NOT_FRONT: { joke: 'That part only launches from the very front of the sentence. In the middle it just wobbles.', fix: 'Snap it at the front, right after the capital letter part.' },
  DEAD_END: { joke: 'ROAD CLOSED! A where word with nowhere to land.', fix: 'Put a noun after the where word: on the mat, under the bed.' },
  COPY_NO_NOUN: { joke: 'The Duplicator is copying... nothing. Very tidy, very useless.', fix: 'Put a noun machine after the Duplicator so it can make more than one.' },
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
export function readingOrder(lines: BoardLine[]): BoardLine[] {
  // Bands of rows (top to bottom), then left to right inside a band. A
  // stable order, so paragraph order never flips (Claudia round 1).
  const bands: BoardLine[][] = [];
  for (const l of [...lines].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const band = bands[bands.length - 1];
    if (band && l.y - band[0].y <= 60) band.push(l); else bands.push([l]);
  }
  return bands.flatMap((b) => b.sort((a, c) => a.x - c.x));
}
