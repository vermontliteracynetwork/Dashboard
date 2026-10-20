// Mad Lib style typed answers (Build Queue 238). Turns the teacher's sentence ("The [dog] ran to the
// [park|playground].") into words and blanks, picks which words become blanks from the question's
// settings, and checks the student's words.
import type { MadLibSettings } from '../types';
import { isCloseEnoughAnswer } from './answerMatch';

export const DEFAULT_MADLIB: MadLibSettings = { blanks: 1, pick: 'marked', support: 'bank', spellCheck: false, forgiving: true, hints: true };

export interface MadToken { text: string; word: boolean; marked: boolean; answers: string[] }

// Words, [marked words], and everything between (spaces, punctuation) kept in order.
export function tokenize(text: string): MadToken[] {
  const out: MadToken[] = [];
  const re = /\[([^\]]+)\]|[A-Za-z0-9’'-]+|[^A-Za-z0-9[\]’'-]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[1] !== undefined) {
      const answers = m[1].split('|').map((a) => a.trim()).filter(Boolean);
      if (answers.length) out.push({ text: answers[0], word: true, marked: true, answers });
    } else {
      const t = m[0];
      const word = /[A-Za-z0-9]/.test(t);
      out.push({ text: t, word, marked: false, answers: word ? [t] : [] });
    }
  }
  return out;
}

export const plainText = (text: string) => tokenize(text).map((t) => t.text).join('');
export const markedCount = (text: string) => tokenize(text).filter((t) => t.marked).length;

// Little words make poor random blanks.
const SMALL = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'is', 'it', 'he', 'she', 'we', 'i', 'my', 'was', 'for', 'with', 'as', 'by', 'be']);

function shuffle<T>(a: T[]): T[] {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

// Which token positions become blanks this time.
export function chooseBlanks(tokens: MadToken[], s: MadLibSettings): number[] {
  const marked = tokens.map((t, i) => (t.marked ? i : -1)).filter((i) => i >= 0);
  const words = tokens.map((t, i) => (t.word && (t.marked || (t.text.length >= 3 && !SMALL.has(t.text.toLowerCase()))) ? i : -1)).filter((i) => i >= 0);
  const pool = s.pick === 'marked' && marked.length ? marked : words.length ? words : tokens.map((t, i) => (t.word ? i : -1)).filter((i) => i >= 0);
  const want = s.blanks > 0 ? Math.min(s.blanks, pool.length) : pool.length;
  return shuffle(pool).slice(0, want).sort((a, b) => a - b);
}

// The word bank: the right words, plus (bank-extra) up to three other words from the sentence.
export function wordBank(tokens: MadToken[], blanks: number[], s: MadLibSettings): string[] {
  const right = blanks.map((i) => tokens[i].answers[0]);
  let extra: string[] = [];
  if (s.support === 'bank-extra') {
    const taken = new Set(right.map((w) => w.toLowerCase()));
    extra = shuffle(tokens.filter((t, i) => t.word && !blanks.includes(i) && t.text.length >= 3 && !SMALL.has(t.text.toLowerCase()) && !taken.has(t.text.toLowerCase())).map((t) => t.text))
      .filter((w, i, a) => a.findIndex((x) => x.toLowerCase() === w.toLowerCase()) === i).slice(0, 3);
  }
  return shuffle([...right, ...extra]);
}

export function isBlankRight(given: string, t: MadToken, s: MadLibSettings): boolean {
  const g = given.trim();
  if (!g) return false;
  return t.answers.some((a) => (s.forgiving && s.support !== 'bank' && s.support !== 'bank-extra' ? isCloseEnoughAnswer(g, a) : g.toLowerCase() === a.toLowerCase()));
}

// The sentence read aloud with "blank" for each missing word.
export const sayWithBlanks = (tokens: MadToken[], blanks: number[]) => tokens.map((t, i) => (blanks.includes(i) ? ' blank ' : t.text)).join('').replace(/\s+/g, ' ').trim();
