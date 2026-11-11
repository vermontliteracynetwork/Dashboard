// Symbol Sentence Writer, Phase 1 (Build Queue 166, 218 and 611; spec in docs/DEVELOPMENT_PLAN.md, "SYMBOL SENTENCE
// WRITER"). A question set of her symbol sentences where the student types the missing words. Each question is an
// ordinary symbol sentence question (so Assignments, Quiz Mode and Question Reports already carry it) with a `writer`
// tag: which of her cards it is and which help levels the set uses. The boxes the student types are picked at play
// time from the student's own place on the help ladder:
//   1 one missing word, with two word cards (the right word and a different kind of word) to copy
//   2 one missing word, on their own
//   3 two missing words
//   4 every naming, action and describing word (the small words stay)
// Up a level after 4 of the last 5 are right on the first try; after 3 misses in a row a step down is offered (never
// forced). Levels 5 to 8 come in Phases 2 and 3.
import { useStore } from '../store/store';
import { ALL_SYMBOL_SENTENCES, SYMBOL_SENTENCE_PAGES, type SymbolSentence } from './symbolDeck';
import { punctSlot, randomWord } from './symbolSentence';
import type { SymbolPos, SymbolQuestion, SymbolSlot } from '../types';

export type WriterLevel = 1 | 2 | 3 | 4;
export const WRITER_LEVELS: WriterLevel[] = [1, 2, 3, 4];
export const WRITER_LEVEL_INFO: Record<WriterLevel, { label: string; hint: string; prompt: string }> = {
  1: { label: 'One word, with helper cards', hint: 'One word is missing. Two word cards show under it, and the student types the right one.', prompt: 'Type the missing word. A word card can help.' },
  2: { label: 'One word, on my own', hint: 'One word is missing. The symbol is the clue.', prompt: 'Type the missing word.' },
  3: { label: 'Two words', hint: 'Two words are missing, usually a naming word and its action word.', prompt: 'Type the two missing words.' },
  4: { label: 'Every naming, action and describing word', hint: 'Every noun, verb, adjective and adverb is missing. The small words stay.', prompt: 'Type the missing words.' },
};
// A card word without the comma or ! that sits on it.
export const bare = (w: string) => w.replace(/[,!]$/, '');
const CONTENT: SymbolPos[] = ['noun', 'propernoun', 'verb', 'adjective', 'adverb'];
const NAMING: SymbolPos[] = ['noun', 'propernoun'];

export const writerSentence = (id: string): SymbolSentence | undefined => ALL_SYMBOL_SENTENCES.find((s) => s.id === id);
// Her card number (1 to 43) for a sentence, in the deck's own order.
export const cardNumber = (id: string) => ALL_SYMBOL_SENTENCES.findIndex((s) => s.id === id) + 1;
export const WRITER_PAGES = SYMBOL_SENTENCE_PAGES;

// The card as boxes: every word with its symbol (a comma stays on its word), then the punctuation. Content words are
// left open here, so the saved question reads as a typed question everywhere; the play screen picks the real blanks.
export function writerSlots(s: SymbolSentence): SymbolSlot[] {
  const tokens = s.sentence.match(/[A-Za-z'’-]+(?:,|!(?=\s))?/g) ?? [];
  const mark = /[.!?]$/.test(s.sentence) ? s.sentence.slice(-1) : '.';
  const words = s.words.map((w, i): SymbolSlot => {
    const tok = tokens[i] && tokens[i].replace(/[,!]$/, '').toLowerCase() === w.word.toLowerCase() ? tokens[i] : w.word;
    return { pos: w.wordClass, word: tok, given: !CONTENT.includes(w.wordClass) };
  });
  return [...words, punctSlot(mark, true)];
}

export function writerQuestion(id: string, s: SymbolSentence, levels: WriterLevel[]): SymbolQuestion {
  return {
    id, kind: 'symbol', mode: 'fill', prompt: `Card ${cardNumber(s.id)}: finish the sentence.`, slots: writerSlots(s),
    settings: { dice: false, spellCheck: false, grammarCheck: true, capitalCheck: false, punctuationCheck: false },
    writer: { sentenceId: s.id, levels: [...levels].sort() },
  };
}

// Which boxes the student types at a level (indexes into the slots). Random, so the same card asks a different word.
export function writerBlanks(slots: SymbolSlot[], level: WriterLevel, rand: () => number = Math.random): number[] {
  const content = slots.map((s, i) => (CONTENT.includes(s.pos) ? i : -1)).filter((i) => i >= 0);
  const any = content.length ? content : slots.map((s, i) => (s.pos !== 'punctuation' ? i : -1)).filter((i) => i >= 0);
  const pick = (list: number[]) => list[Math.floor(rand() * list.length)];
  if (level === 4) return any;
  if (level === 3 && any.length >= 2) {
    const nouns = any.filter((i) => NAMING.includes(slots[i].pos)), verbs = any.filter((i) => slots[i].pos === 'verb');
    if (nouns.length && verbs.length) return [pick(nouns), pick(verbs)].sort((a, b) => a - b);
    const first = pick(any);
    return [first, pick(any.filter((i) => i !== first))].sort((a, b) => a - b);
  }
  return [pick(any)];
}

// Level 1: the right word and a word of a different kind, in a random order (the symbol tells them which fits).
export function helperCards(slot: SymbolSlot, rand: () => number = Math.random): string[] {
  const right = bare(slot.word);
  const other: SymbolPos = slot.pos === 'verb' ? 'adjective' : slot.pos === 'adjective' || slot.pos === 'adverb' ? 'noun' : 'verb';
  const wrong = randomWord(other, right) || (other === 'verb' ? 'jumped' : 'happy');
  return rand() < 0.5 ? [right, wrong] : [wrong, right];
}

// ---------- the student's place on the help ladder ----------
// Kept per student in a `writerladder:<id>` row (the same store as typed support levels), so it follows them across
// sets and devices.
interface LadderRow { level?: WriterLevel; recent?: boolean[]; missRun?: number }
export const levelWithin = (level: WriterLevel, allowed: WriterLevel[]): WriterLevel => {
  const list = allowed.length ? [...allowed].sort() : WRITER_LEVELS;
  return [...list].reverse().find((l) => l <= level) ?? list[0];
};
export function useWriterLadder() {
  const id = useStore((s) => s.currentStudentId);
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === `writerladder:${id}`));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const look = (row?.look ?? {}) as LadderRow;
  const level: WriterLevel = look.level ?? 1;
  const save = (patch: LadderRow) => { if (id) mergeStyleRow(`writerladder:${id}`, { ...look, ...patch, at: new Date().toISOString() }); };
  // One finished sentence at `played` (the level it was asked at), within the set's levels.
  const record = (firstTry: boolean, played: WriterLevel, allowed: WriterLevel[]) => {
    const recent = [...(look.recent ?? []), firstTry].slice(-5);
    const missRun = firstTry ? 0 : (look.missRun ?? 0) + 1;
    const up = [...allowed].sort().find((l) => l > played);
    // The stored level only changes on a move up or a chosen step down (a game asking at most level 3 never lowers it).
    if (up && recent.length >= 5 && recent.filter(Boolean).length >= 4) save({ level: Math.max(level, up) as WriterLevel, recent: [], missRun: 0 });
    else save({ recent, missRun });
  };
  const stepDown = (played: WriterLevel, allowed: WriterLevel[]) => {
    const down = [...allowed].sort().reverse().find((l) => l < played);
    save({ level: down ?? played, recent: [], missRun: 0 });
  };
  const keepGoing = () => save({ missRun: 0 });
  return { level, missRun: look.missRun ?? 0, record, stepDown, keepGoing };
}
