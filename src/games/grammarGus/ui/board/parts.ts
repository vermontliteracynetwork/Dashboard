import type { Pos } from '../../engine/types';
import { SYMBOLS } from '../../data/symbols';

// Workboard parts (teacher 2026-10-07). Every part of speech is its own
// factory machine shaped like its grammar symbol, in its symbol's color.
// Students build the whole machine: the Start Lever, the word machines,
// the capital letter and punctuation machines, the Pixel TV, and (for
// fun) Rube Goldberg contraption parts a marble rolls through when the
// lever is pulled. Copy rule: always "capital letter" and "punctuation".
export type FinishKind = 'cap' | 'stop' | 'bang' | 'comma' | 'tv' | 'lever' | 'clock' | 'link';
export type ContraptionKind = 'spring' | 'pulley' | 'ramp' | 'conveyor' | 'fan' | 'bell' | 'dominoes' | 'bucket';
export type Kind = Pos | FinishKind | ContraptionKind | 'blank';
export const isWordKind = (k: Kind): k is Pos => k.length === 1;
export const CONTRAPTIONS: ContraptionKind[] = ['spring', 'pulley', 'ramp', 'conveyor', 'fan', 'bell', 'dominoes', 'bucket'];
export const isContraption = (k: Kind): k is ContraptionKind => (CONTRAPTIONS as string[]).includes(k);

export type Job = 'power' | 'time' | 'paragraph' | 'who' | 'did' | 'where' | 'join' | 'shout' | 'finish' | 'contraption';
export interface KindInfo { kind: Kind; name: string; machine: string; hint: string; color: string; job: Job }
const W = (pos: Pos, name: string, machine: string, job: Job): KindInfo => ({ kind: pos, name, machine, hint: SYMBOLS[pos].kidHint, color: SYMBOLS[pos].color, job });
const X = (kind: ContraptionKind, name: string, hint: string, color: string): KindInfo => ({ kind, name, machine: 'Contraption part', hint, color, job: 'contraption' });
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
  X('spring', 'Spring Mat', 'The marble bounces way up', '#7fb3d5'),
  X('pulley', 'Pulley', 'Hoists a bucket up the rope', '#b9875a'),
  X('ramp', 'Ramp', 'The marble rolls down', '#d9a441'),
  X('conveyor', 'Conveyor Belt', 'Carries the marble along', '#6f7f8f'),
  X('fan', 'Fan', 'Blows the marble onward', '#69b7a8'),
  X('bell', 'Bell', 'Ding!', '#e6b54a'),
  X('dominoes', 'Dominoes', 'They topple in a row', '#d95f5f'),
  X('bucket', 'Bucket Drop', 'Tips the marble out', '#8f6bb3'),
];
export const kindInfo = (k: Kind): KindInfo => KINDS.find((x) => x.kind === k) ?? { kind: 'blank', name: 'Blank word space', machine: 'Empty space', hint: 'Drag a machine part onto it', color: '#ffffff', job: 'power' };
export const JOB_TITLES: Record<Job, string> = { power: 'START and TV', time: 'TIME', paragraph: 'PARAGRAPH', shout: 'INTERJECTION', who: 'WHO parts', did: 'DID parts', where: 'WHERE parts', join: 'JOIN parts', finish: 'CAPITAL LETTER and PUNCTUATION', contraption: 'CONTRAPTION parts' };

export const PART_H = 172;
// How big each symbol body is, Montessori style: the noun and verb are the
// biggest, the article is the smallest.
export const BODY: Record<Pos, number> = { N: 112, V: 104, R: 96, P: 96, C: 100, J: 86, I: 84, D: 76, A: 64 };
export const textW = (word: string | null) => (word ? word.length * 10.5 : 10);
export function partWidth(kind: Kind, word: string | null): number {
  if (kind === 'tv') return 214;
  if (kind === 'lever') return 108;
  if (kind === 'clock') return 132;
  if (kind === 'link') return 100;
  if (kind === 'blank') return 128;
  if (kind === 'cap') return 104;
  if (kind === 'comma') return 78;
  if (kind === 'stop' || kind === 'bang') return 90;
  if (isContraption(kind)) return kind === 'conveyor' || kind === 'dominoes' ? 150 : 112;
  return Math.ceil(Math.max(BODY[kind] + 34, textW(word) + 44, 96));
}
