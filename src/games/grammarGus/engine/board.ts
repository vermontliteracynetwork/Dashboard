import type { Draft, HelpLevel, Marks, Tense, Token, VerbForm } from './types';
import { isFront, markOf, wordPosOf, type Kind } from '../ui/board/parts';
import { TIME_TENSE } from '../data/timeWords';
import type { OrderCard, SceneKey } from './orders';
import { compose, requiredCommas } from './compose';
import { analyze } from './analyze';
import { questionOf, quoteOf } from './question';
import { canCompare, compareOf, pluralNounOf, possessiveOf } from './dictionary';

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
// span: the Speech Bubble's cloud stretches from one word machine to another (teacher 2026-10-07).
// tabs: the Appositive Clamp's comma tabs (1 = the comma before the fact, 2 = the comma after it).
export interface BoardItem { id: string; kind: Kind; word: string | null; form?: VerbForm; top?: BoardItem; bottom?: BoardItem; locked?: boolean; span?: { from: string; to: string }; tabs?: number }
// Every part on a line, snapped-on parts included.
export const allParts = (items: BoardItem[]): BoardItem[] => items.flatMap((i) => [i, ...(i.top ? [i.top] : []), ...(i.bottom ? [i.bottom] : [])]);
export interface BoardLine { id: string; x: number; y: number; items: BoardItem[]; tense?: Tense; stars?: number | null; silly?: number; job?: { id?: string; kind: 'delivery' | 'inspector' | 'order' | 'blueprint' | 'spark' | 'read'; article?: string; question?: string; text: string; flaw?: string; done?: boolean; key?: SceneKey; card?: OrderCard; group?: string; label?: string; part?: number; of?: number; blueprint?: string }; connector?: string }

export type FinishProblem = 'NEED_CAP' | 'NEED_END' | 'NEED_TV' | 'END_NOT_LAST' | 'TV_NOT_LAST' | 'EMPTY_PART' | 'NO_WORDS' | 'COMMA_PLACE' | 'COPY_NO_NOUN' | 'BRIDGE_UP' | 'DEAD_END' | 'NOT_FRONT' | 'WRONG_HOST' | 'NEED_ASK' | 'NEED_CRANE' | 'CRANE_ONE_IDEA' | 'NO_SIZES' | 'NEED_COMMA' | 'CLAMP_HOST' | 'CLAMP_COMMA';
// The Time Tunnel's time word sets the time; otherwise the Clock does.
export const tenseOf = (line: BoardLine): Tense => {
  const tw = line.items.find((i) => i.kind === 'tunnel' && i.word)?.word;
  return (tw && TIME_TENSE.get(tw.toLowerCase())) || ((line.items.find((i) => i.kind === 'clock')?.word as Tense | undefined) ?? 'present');
};
// appositives: each Appositive Clamp's fact and the token (its noun) it sits after.
export interface LineRead { draft: Draft; tokenIds: string[]; problems: { code: FinishProblem; itemId?: string }[]; hasTV: boolean; question: boolean; appositives: { tok: number; phrase: string; itemId: string; tabs: number }[] }
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
  const appositives: LineRead['appositives'] = [];
  items.forEach((it, i) => {
    const pos = wordPosOf(it.kind); const mark = itemMark(it);
    // The Appositive Clamp (Claudia's Phase 2): it grips the noun right before it and clamps a fact
    // about it between two commas. At Full help the comma tabs snap on by themselves; at Guided and
    // Challenge the student snaps them (only the first one when the noun ends the sentence).
    if (it.kind === 'clamp') {
      const prev = items[i - 1];
      if (!prev || wordPosOf(prev.kind) !== 'N' || !tokens.length) { problems.push({ code: 'CLAMP_HOST', itemId: it.id }); return; }
      if (!it.word) { problems.push({ code: 'EMPTY_PART', itemId: it.id }); return; }
      appositives.push({ tok: tokens.length - 1, phrase: it.word, itemId: it.id, tabs: level === 'full' ? 3 : it.tabs ?? 0 });
      const need = i > lastWord ? 1 : 3;
      if (level !== 'full' && ((it.tabs ?? 0) & need) !== need) problems.push({ code: 'CLAMP_COMMA', itemId: it.id });
      return;
    }
    // The Command Conveyor: a command's who is a hidden "you" (Pour the water.).
    if (it.kind === 'command') { if (mainStarted) problems.push({ code: 'NOT_FRONT', itemId: it.id }); else { tokens.push({ pos: 'R', word: 'you', hidden: true }); tokenIds.push(it.id); } return; }
    if (pos) {
      if (!it.word && it.kind !== 'crate') problems.push({ code: 'EMPTY_PART', itemId: it.id }); // an empty Mystery Crate is a surprise
      if (isFront(it.kind)) { if (mainStarted) problems.push({ code: 'NOT_FRONT', itemId: it.id }); } else mainStarted = true;
      // A part snapped on above or below works the same in either spot.
      const att = [it.bottom, it.top].filter((a): a is BoardItem => !!a);
      const on = (m: string) => att.find((a) => itemMark(a) === m);
      const plu = on('plural'), pos2 = on('poss'), sz = on('size');
      if (pendingCap || capAfterShout || on('cap')) marks.capitals.push(tokens.length);
      pendingCap = false; capAfterShout = false;
      let word = it.word;
      if (pos === 'N' && pendingCopy) { if (word) word = pluralNounOf(word); pendingCopy = null; }
      if (plu) { if (pos === 'N') { if (word) word = pluralNounOf(word); } else problems.push({ code: 'COPY_NO_NOUN', itemId: plu.id }); }
      if (pos2) { if (pos === 'N') { if (word) word = possessiveOf(word); } else problems.push({ code: 'WRONG_HOST', itemId: pos2.id }); }
      if (sz) { if (pos !== 'J') problems.push({ code: 'WRONG_HOST', itemId: sz.id }); else if (word && !canCompare(word)) problems.push({ code: 'NO_SIZES', itemId: sz.id }); else if (word) word = compareOf(word, sz.word === 'er' ? 'er' : 'est'); }
      if (it.kind === 'crusher' && word) word = pluralNounOf(word); // the Plural Crusher's noun is always more than one
      tokens.push({ pos, word, ...(level !== 'full' ? { form: it.form ?? 'base' } : {}) });
      tokenIds.push(it.id);
      // The Trapdoor's shout comes with its "!" and a capital letter after it;
      // the Slingshot and Time Tunnel bring their comma.
      if (it.kind === 'trapdoor') { marks.shoutMark = true; capAfterShout = true; }
      else if (isFront(it.kind) && it.word) marks.commas.push(tokens.length - 1);
      // Punctuation snapped on: it comes right after this word.
      const cm = on('comma');
      if (cm) {
        marks.commas.push(tokens.length - 1); commaAt.push({ tok: tokens.length - 1, id: cm.id });
        if (cm.kind === 'bridge') { const nx = items.slice(i + 1).find((x) => wordPosOf(x.kind)); if (!nx || wordPosOf(nx.kind) !== 'C') problems.push({ code: 'BRIDGE_UP', itemId: cm.id }); }
      }
      const em = att.find((a) => ['stop', 'bang', 'ask'].includes(itemMark(a) ?? ''));
      if (em) {
        const over = itemMark(em);
        if (i === lastWord) { marks.endMark = over === 'bang' ? '!' : '.'; question = over === 'ask'; }
        else if (over === 'bang' && pos === 'I') { marks.shoutMark = true; capAfterShout = true; }
        else problems.push({ code: 'END_NOT_LAST', itemId: em.id });
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
  if (!tokens.some((t) => !t.hidden)) problems.unshift({ code: 'NO_WORDS' });
  if (mustFinish && tokens.length) {
    if (!marks.capitals.includes(Math.max(0, tokens.findIndex((t) => !t.hidden)))) problems.push({ code: 'NEED_CAP' });
    if (!marks.endMark) problems.push({ code: 'NEED_END' });
    if (!hasTV) problems.push({ code: 'NEED_TV' });
    // Guess and check (teacher 2026-10-07): "if they're making a compound
    // sentence and they need a comma, that needs to be put in there." The
    // machine only runs once every comma it needs is snapped on.
    if (tokens.every((t) => t.word)) {
      const a = analyze(tokens);
      // A clamp's own comma after the fact covers a pause needed right after its noun.
      if (a.parse.viable) for (const k of requiredCommas(a, tokens)) if (!marks.commas.includes(k) && k < tokens.length - 1 && !appositives.some((p) => p.tok === k)) problems.push({ code: 'NEED_COMMA', itemId: tokenIds[k] });
    }
  }
  const draft: Draft = { tokens, tense: tenseOf(line), level, marks };
  if (crane && question && tokens.every((t) => t.word) && !questionOf(draft)) problems.push({ code: 'CRANE_ONE_IDEA', itemId: crane.id });
  return { draft, tokenIds, problems, hasTV, question, appositives };
}

// The sentence as it reads on the plate, the TV caption and the Journal:
// the Question Crane flips it into a question, the Speech Bubble Blower
// wraps it in quotation marks.
export function lineText(line: BoardLine, rd: LineRead, plain = false): string {
  if (!rd.draft.tokens.some((t) => t.word)) return '';
  const crane = line.items.some((i) => i.kind === 'crane');
  let text = (rd.question && crane ? questionOf(rd.draft) : null) ?? withAppositives(rd, plain);
  if (rd.question && !crane) text = text.replace(/[.!]$/, '?');
  const bubble = line.items.find((i) => i.kind === 'bubble');
  if (bubble?.word && /[.!?]$/.test(text)) {
    // The cloud may cover only some of the words: only those are spoken.
    const ids = bubbleSpan(line, bubble);
    const words = rd.question && crane ? null : compose(rd.draft, plain).words;
    const inside = words ? words.map((w, k) => (ids.includes(rd.tokenIds[w.index]) ? k : -1)).filter((k) => k >= 0) : [];
    if (!words || !inside.length || inside.length === words.length) text = quoteOf(text, bubble.word, rd.question);
    else {
      const m = text.match(/[.!?]$/)?.[0] ?? '.';
      const parts = words.map((w) => w.text.replace(/[.!?]$/, ''));
      const a = inside[0], b = inside[inside.length - 1];
      const q = parts.slice(a, b + 1).join(' ').replace(/,$/, '');
      const quote = q.charAt(0).toUpperCase() + q.slice(1);
      const before = parts.slice(0, a).join(' ').replace(/,$/, ''); const after = parts.slice(b + 1).join(' ');
      const verb = rd.question || m === '?' ? 'asked' : 'said';
      text = a === 0
        ? `"${quote}${m === '.' ? ',' : m}" ${verb} ${bubble.word}${after ? ` ${after}` : ''}.`
        : `${before.charAt(0).toUpperCase() + before.slice(1)} ${verb}, "${quote}${b === words.length - 1 ? m : ''}"${b < words.length - 1 ? ` ${after}${m}` : ''}`;
    }
  }
  return text;
}
// The sentence with each Appositive Clamp's fact clamped in after its noun, between commas:
// "Gus, a giant robot, fixed the lab." At the end: "We met Gus, a giant robot."
export function withAppositives(rd: LineRead, plain = false): string {
  const c = compose(rd.draft, plain);
  if (!rd.appositives?.length) return c.text;
  const parts = c.words.map((w) => w.text);
  for (const ap of rd.appositives) {
    const k = c.words.findIndex((w) => w.index === ap.tok);
    if (k < 0) continue;
    const end = parts[k].match(/[.!?]$/)?.[0] ?? '';
    const base = parts[k].replace(/[.!?]$/, '').replace(/,$/, '');
    // As written (plain): only the comma tabs the student snapped on.
    const before = !plain || ap.tabs & 1 ? ',' : '', after = !plain || ap.tabs & 2 ? ',' : '';
    parts[k] = k === parts.length - 1 ? `${base}${before} ${ap.phrase}${end}` : `${base}${before} ${ap.phrase}${after}`;
  }
  return parts.join(' ');
}
// The word machines inside the Speech Bubble's cloud, in order (all of them until it is stretched).
export function bubbleSpan(line: BoardLine, bubble: BoardItem): string[] {
  const words = line.items.filter((i) => wordPosOf(i.kind));
  let a = bubble.span ? words.findIndex((w) => w.id === bubble.span!.from) : 0;
  let b = bubble.span ? words.findIndex((w) => w.id === bubble.span!.to) : words.length - 1;
  if (a < 0) a = 0; if (b < 0 || b < a) b = words.length - 1;
  return words.slice(a, b + 1).map((w) => w.id);
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
  NEED_COMMA: { joke: 'The marble zipped right past a spot where it needed to pause.', fix: 'Snap a comma under the glowing word.' },
  COMMA_PLACE: { joke: 'A comma with no word on one side? That is a pause for nothing.', fix: 'A comma goes right after a word, with more words after it.' },
  BRIDGE_UP: { joke: 'The drawbridge is stuck up. It only comes down right before a joining word.', fix: 'Put the Comma Drawbridge right before and, but or or.' },
  WRONG_HOST: { joke: 'That part is snapped onto the wrong kind of word. It looks very confused.', fix: 'The Tag Gun goes on top of a noun. The Size-Up Inflator goes under a describing word.' },
  NEED_CRANE: { joke: 'A question mark on a telling sentence? Gus is very puzzled?', fix: 'Snap on a Question Crane to turn it into a question, or use a period.' },
  NEED_ASK: { joke: 'The crane lifted a question, but it has no question mark to land on.', fix: 'End a question with a Question Mark.' },
  CRANE_ONE_IDEA: { joke: 'The crane can only lift one idea at a time. Two is too heavy!', fix: 'Use the Question Crane on a sentence with one who and one action, with no opener or shout at the front.' },
  NO_SIZES: { joke: 'That describing word does not come in sizes. Stripier? Stripiest? Nope!', fix: 'Snap the Size-Up Inflator under a describing word like tall, big or happy.' },
  NOT_FRONT: { joke: 'That part only launches from the very front of the sentence. In the middle it just wobbles.', fix: 'Snap it at the front, right after the capital letter part.' },
  DEAD_END: { joke: 'ROAD CLOSED! A where word with nowhere to land.', fix: 'Put a noun after the where word: on the mat, under the bed.' },
  CLAMP_HOST: { joke: 'The clamp is squeezing... nothing it can hold. It only grips a noun.', fix: 'Put the Appositive Clamp right after a noun, like Gus or the dog.' },
  CLAMP_COMMA: { joke: 'The fact is wobbling loose! A clamp holds it with two comma tabs.', fix: 'Tap the clamp and snap on its comma tabs: one before the fact and one after it. When the noun ends the sentence, only the first one.' },
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
