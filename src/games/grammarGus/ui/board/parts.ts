import type { Pos } from '../../engine/types';
import { SYMBOLS } from '../../data/symbols';

// Workboard parts (teacher 2026-10-07). Every part of speech is its own
// factory machine shaped like its grammar symbol, in its symbol's color.
// Students build the whole machine: the Start Lever, the word machines,
// the capital letter and punctuation machines, the Pixel TV, and (for
// fun) Rube Goldberg contraption parts a marble rolls through when the
// lever is pulled. Copy rule: always "capital letter" and "punctuation".
//
// Every fun part has a grammar job too (teacher 2026-10-07: "make sure all
// fun parts have a grammatical purpose ... silly goofy and fun for my 5/6th
// graders", and "a sandbox ... with hidden grammar concepts"). The Spring
// Mat bounces in a describing word, the Big Horn blasts an exclamation
// point, the Duplicator copies the next noun into more than one, and so on.
export type FinishKind = 'cap' | 'stop' | 'bang' | 'comma' | 'tv' | 'lever' | 'clock' | 'link';
export type ContraptionKind = 'spring' | 'pulley' | 'ramp' | 'conveyor' | 'fan' | 'bell' | 'dominoes' | 'bucket' | 'horn' | 'duplicator';
export type Kind = Pos | FinishKind | ContraptionKind | 'blank';
export const isWordKind = (k: Kind): k is Pos => k.length === 1;
export const CONTRAPTIONS: ContraptionKind[] = ['horn', 'spring', 'fan', 'ramp', 'conveyor', 'bucket', 'pulley', 'bell', 'dominoes', 'duplicator'];
export const isContraption = (k: Kind): k is ContraptionKind => (CONTRAPTIONS as string[]).includes(k);
export type MarkRole = 'cap' | 'stop' | 'bang' | 'comma' | 'plural';
// pos: the fun part holds a word of that part of speech. mark: it acts
// like that capital letter or punctuation machine. pop: its sound word.
export interface FunRole { pos?: Pos; mark?: MarkRole; pop: string; does: string; grammar: string }
export const FUN_ROLE: Record<ContraptionKind, FunRole> = {
  horn: { mark: 'bang', pop: 'HONK!', does: 'Blasts an exclamation point', grammar: 'exclamation point' },
  spring: { pos: 'J', pop: 'BOING!', does: 'Bounces in a describing word', grammar: 'adjective' },
  fan: { pos: 'D', pop: 'WHOOSH!', does: 'Blows in a how word', grammar: 'adverb' },
  ramp: { pos: 'P', pop: 'WHEEE!', does: 'Rolls in a where word', grammar: 'preposition' },
  conveyor: { pos: 'C', pop: 'CLANK-CLANK', does: 'Carries in a joining word', grammar: 'conjunction' },
  bucket: { pos: 'A', pop: 'SPLOSH!', does: 'Drops in a, an or the', grammar: 'article' },
  pulley: { mark: 'cap', pop: 'HEAVE-HO!', does: 'Hoists the next word to a capital letter', grammar: 'capital letter' },
  bell: { mark: 'stop', pop: 'DING!', does: 'Rings a period at the end', grammar: 'period' },
  dominoes: { mark: 'comma', pop: 'CLACK-CLACK', does: 'Topples a comma pause after a word', grammar: 'comma' },
  duplicator: { mark: 'plural', pop: 'COPY! COPY!', does: 'Copies the next noun: more than one', grammar: 'plural noun' },
};
// The part of speech a part holds a word for (word machines and fun parts).
export const wordPosOf = (k: Kind): Pos | null => (isWordKind(k) ? k : isContraption(k) ? FUN_ROLE[k].pos ?? null : null);
export const needsWord = (k: Kind) => wordPosOf(k) !== null;
// The mark a part makes (capital letter, punctuation, or a plural copy).
export const markOf = (k: Kind): MarkRole | null => (k === 'cap' || k === 'stop' || k === 'bang' || k === 'comma' ? k : isContraption(k) ? FUN_ROLE[k].mark ?? null : null);
export const isEndMark = (k: Kind) => { const m = markOf(k); return m === 'stop' || m === 'bang'; };
// A short example under each part in the parts menu: play first, the
// grammar is inside.
export const EXAMPLES: Record<Pos, string> = { A: 'a, an, the', J: 'fuzzy, giant, silly', N: 'dog, pizza, robot', R: 'he, she, they', V: 'jump, eat, zoom', D: 'quickly, loudly', P: 'on, under, over', C: 'and, but, or', I: 'Wow! Oops! Yikes!' };

export type Job = 'power' | 'time' | 'paragraph' | 'who' | 'did' | 'where' | 'join' | 'shout' | 'finish' | 'contraption';
export interface KindInfo { kind: Kind; name: string; machine: string; hint: string; color: string; job: Job }
const W = (pos: Pos, name: string, machine: string, job: Job): KindInfo => ({ kind: pos, name, machine, hint: SYMBOLS[pos].kidHint, color: SYMBOLS[pos].color, job });
const X = (kind: ContraptionKind, name: string, color: string): KindInfo => ({ kind, name, machine: FUN_ROLE[kind].does, hint: `${FUN_ROLE[kind].does} (${FUN_ROLE[kind].grammar})`, color, job: 'contraption' });
export const KINDS: KindInfo[] = [
  { kind: 'lever', name: 'Start Lever', machine: 'Power', hint: 'Every machine starts with a Start Lever at the front', color: '#6b7790', job: 'power' },
  { kind: 'clock', name: 'Clock', machine: 'Time machine', hint: 'Spin it back for the past, keep it still for the present, spin it forward for the future', color: '#e6b54a', job: 'time' },
  { kind: 'link', name: 'Paragraph Link', machine: 'Paragraph chain', hint: 'Hooks this sentence to the sentence below it to build a paragraph', color: '#8b6bb3', job: 'paragraph' },
  { kind: 'tv', name: 'Pixel TV', machine: 'Movie screen', hint: 'Plug it on the very end to watch your sentence', color: '#3a4a63', job: 'power' },
  W('I', 'Interjection', 'Steam Whistle', 'shout'),
  W('A', 'Article', 'Valve Cone', 'who'),
  W('J', 'Adjective', 'Paint Tank', 'who'),
  W('N', 'Noun', 'Noun Boiler', 'who'),
  W('R', 'Pronoun', 'Swap Valve', 'who'),
  W('V', 'Verb', 'Flywheel Engine', 'did'),
  W('D', 'Adverb', 'How Gauge', 'did'),
  W('P', 'Preposition', 'Arch Pipe', 'where'),
  W('C', 'Conjunction', 'Join Clamp', 'join'),
  { kind: 'cap', name: 'Capital Letter Press', machine: 'Capital letter', hint: 'Put it in front of a word to give it a capital letter', color: '#8f9bb0', job: 'finish' },
  { kind: 'stop', name: 'Period', machine: 'Punctuation stamp', hint: 'Punctuation that ends a telling sentence', color: '#c9a646', job: 'finish' },
  { kind: 'bang', name: 'Exclamation Point', machine: 'Punctuation whistle', hint: 'Punctuation for a strong feeling, or after a shout word', color: '#e0703c', job: 'finish' },
  { kind: 'comma', name: 'Comma', machine: 'Punctuation clip', hint: 'Punctuation for a little pause', color: '#b48ad6', job: 'finish' },
  X('horn', 'Big Horn', '#e0a030'),
  X('spring', 'Spring Mat', '#7fb3d5'),
  X('fan', 'Fan', '#69b7a8'),
  X('ramp', 'Ramp', '#d9a441'),
  X('conveyor', 'Conveyor Belt', '#6f7f8f'),
  X('bucket', 'Bucket Drop', '#8f6bb3'),
  X('pulley', 'Pulley', '#b9875a'),
  X('bell', 'Bell', '#e6b54a'),
  X('dominoes', 'Dominoes', '#d95f5f'),
  X('duplicator', 'Duplicator', '#5b8def'),
];
export const kindInfo = (k: Kind): KindInfo => KINDS.find((x) => x.kind === k) ?? { kind: 'blank', name: 'Blank word space', machine: 'Empty space', hint: 'Drag a machine part onto it', color: '#ffffff', job: 'power' };
export const JOB_TITLES: Record<Job, string> = { power: 'START and TV', time: 'TIME', paragraph: 'PARAGRAPH', shout: 'INTERJECTION', who: 'WHO parts', did: 'DID parts', where: 'WHERE parts', join: 'JOIN parts', finish: 'CAPITAL LETTER and PUNCTUATION', contraption: 'FUN PARTS' };

export const PART_H = 172;
// How big each symbol body is, Montessori style: the noun and verb are the
// biggest, the article is the smallest.
export const BODY: Record<Pos, number> = { N: 112, V: 104, R: 96, P: 96, C: 100, J: 86, I: 84, D: 76, A: 64 };
export const textW = (word: string | null) => (word ? word.length * 10.5 : 10);
export function partWidth(kind: Kind, word: string | null): number {
  if (kind === 'tv') return 214;
  if (kind === 'lever') return 108;
  if (kind === 'clock') return 172;
  if (kind === 'link') return 100;
  if (kind === 'blank') return 128;
  if (kind === 'cap') return 104;
  if (kind === 'comma') return 78;
  if (kind === 'stop' || kind === 'bang') return 90;
  if (isContraption(kind)) return Math.ceil(Math.max(kind === 'conveyor' || kind === 'dominoes' || kind === 'horn' ? 150 : kind === 'duplicator' ? 124 : 112, word ? textW(word) + 44 : 0));
  return Math.ceil(Math.max(BODY[kind] + 34, textW(word) + 44, 96));
}
