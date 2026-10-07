import type { Pos } from '../../engine/types';
import { SYMBOLS } from '../../data/symbols';

// Workboard parts (teacher 2026-10-07): every part of speech is its own
// factory machine in its symbol's color, plus finishing machines the
// student plugs in themselves: the Big Letter Press (capital), the Stop
// Stamp (.), the Bang Whistle (!), the Comma Clip and the Pixel TV.
export type FinishKind = 'cap' | 'stop' | 'bang' | 'comma' | 'tv';
export type Kind = Pos | FinishKind;
export const isWordKind = (k: Kind): k is Pos => k.length === 1;

export interface KindInfo { kind: Kind; name: string; machine: string; hint: string; color: string; job: 'who' | 'did' | 'where' | 'join' | 'shout' | 'finish' }
const W = (pos: Pos, name: string, machine: string, job: KindInfo['job']): KindInfo => ({ kind: pos, name, machine, hint: SYMBOLS[pos].kidHint, color: SYMBOLS[pos].color, job });
export const KINDS: KindInfo[] = [
  W('I', 'Shout', 'Steam Whistle', 'shout'),
  W('A', 'Article', 'Valve Wheel', 'who'),
  W('J', 'Adjective', 'Paint Sprayer', 'who'),
  W('N', 'Noun', 'Noun Boiler', 'who'),
  W('R', 'Pronoun', 'Swap Valve', 'who'),
  W('V', 'Verb', 'Action Engine', 'did'),
  W('D', 'Adverb', 'How Gauge', 'did'),
  W('P', 'Preposition', 'Where Pipe', 'where'),
  W('C', 'Conjunction', 'Join Clamp', 'join'),
  { kind: 'cap', name: 'Big Letter Press', machine: 'Capital press', hint: 'Put it in front of a word to make the first letter BIG', color: '#8f9bb0', job: 'finish' },
  { kind: 'comma', name: 'Comma Clip', machine: 'Comma clip', hint: 'A little pause between parts', color: '#b48ad6', job: 'finish' },
  { kind: 'stop', name: 'Stop Stamp', machine: 'Period stamp', hint: 'Ends a telling sentence with a period', color: '#c9a646', job: 'finish' },
  { kind: 'bang', name: 'Bang Whistle', machine: 'Exclamation stamp', hint: 'Ends a sentence, or a shout, with !', color: '#e0703c', job: 'finish' },
  { kind: 'tv', name: 'Pixel TV', machine: 'Pixel TV', hint: 'Plug it on the very end to watch your sentence', color: '#3a4a63', job: 'finish' },
];
export const kindInfo = (k: Kind) => KINDS.find((x) => x.kind === k)!;
export const JOB_TITLES: Record<KindInfo['job'], string> = { shout: 'SHOUT parts', who: 'WHO parts', did: 'DID parts', where: 'WHERE parts', join: 'JOIN parts', finish: 'FINISHING parts' };

export const PART_H = 132;
export function partWidth(kind: Kind, word: string | null): number {
  if (kind === 'tv') return 214;
  if (kind === 'cap') return 104;
  if (kind === 'comma') return 78;
  if (kind === 'stop' || kind === 'bang') return 90;
  const len = word ? word.length : 1;
  return Math.max(118, Math.min(260, Math.ceil(len * 11) + 62));
}
