import type { Pos, Token } from './types';
import { ADJECTIVES, ADVERBS, INTERJECTIONS, NOUNS, PREPOSITIONS, SUBJECT_PRONOUNS, VERBS, verbByBase } from '../data/wordbank';

// The sentence machine's model (plan 4): housings, their sockets, and how
// the parts on the machine become rail tokens. Shared by the machine
// screen and the blueprint engine so both read the machine the same way.

export type HousingId = 'shout' | 'who' | 'did' | 'obj' | 'how' | 'where';
export interface MachineSlot { pos: Pos; key: string; optional?: boolean; label: string }
export const HOUSINGS: { id: HousingId; label: string; slots: MachineSlot[] }[] = [
  { id: 'shout', label: 'SHOUT', slots: [{ pos: 'I', key: 'shout', label: 'shout word', optional: true }] },
  { id: 'who', label: 'WHO', slots: [
    { pos: 'A', key: 'who.art', label: 'a or the' },
    { pos: 'J', key: 'who.adj1', label: 'describing word', optional: true },
    { pos: 'J', key: 'who.adj2', label: 'describing word', optional: true },
    { pos: 'N', key: 'who.noun', label: 'naming word' },
  ] },
  { id: 'did', label: 'WHAT THEY DID', slots: [{ pos: 'V', key: 'did.verb', label: 'action word' }] },
  { id: 'obj', label: 'WHAT IT HAPPENED TO', slots: [
    { pos: 'A', key: 'obj.art', label: 'a or the' },
    { pos: 'J', key: 'obj.adj', label: 'describing word', optional: true },
    { pos: 'N', key: 'obj.noun', label: 'naming word' },
  ] },
  { id: 'how', label: 'HOW THEY DID IT', slots: [{ pos: 'D', key: 'how.adv', label: 'how word', optional: true }] },
  { id: 'where', label: 'WHERE', slots: [
    { pos: 'P', key: 'where.prep', label: 'where word' },
    { pos: 'A', key: 'where.art', label: 'a or the' },
    { pos: 'N', key: 'where.noun', label: 'naming word' },
  ] },
];
export const SLOT_BY_KEY = new Map(HOUSINGS.flatMap((h) => h.slots.map((s) => [s.key, { ...s, housing: h.id }] as const)));

export const POOLS: Record<Pos, string[]> = {
  A: ['a', 'the'], N: NOUNS.map((n) => n.word), J: ADJECTIVES.map((a) => a.word), D: ADVERBS.map((a) => a.word),
  V: VERBS.map((v) => v.base), P: PREPOSITIONS, R: [...SUBJECT_PRONOUNS], I: [...INTERJECTIONS], C: ['and', 'but', 'or'],
};

export type Words = Record<string, string | null>;

export function housingInUse(id: HousingId, w: Words): boolean {
  if (id === 'did') return true;
  if (id === 'who') return true;
  if (id === 'obj') { const v = verbByBase.get(w['did.verb'] ?? ''); return v?.objectUse === 'T' || ['obj.art', 'obj.adj', 'obj.noun'].some((k) => w[k]); }
  return HOUSINGS.find((h) => h.id === id)!.slots.some((s) => w[s.key]);
}

// Housing order on the machine. Dragging HOW THEY DID IT to the front
// makes an opening HOW word ("Softly, the girl sings.", patterns 13 to 21).
export const orderFor = (howFirst: boolean): HousingId[] => (howFirst ? ['shout', 'how', 'who', 'did', 'obj', 'where'] : ['shout', 'who', 'did', 'obj', 'how', 'where']);
export const housingById = (id: HousingId) => HOUSINGS.find((h) => h.id === id)!;

// The machine's parts in sentence order, as rail tokens.
export function buildTokens(w: Words, whoPron: boolean, howFirst = false): { tokens: Token[]; keys: string[] } {
  const tokens: Token[] = []; const keys: string[] = [];
  for (const h of orderFor(howFirst).map(housingById)) {
    if (!housingInUse(h.id, w)) continue;
    if (h.id === 'who' && whoPron) { tokens.push({ pos: 'R', word: w['who.pron'] ?? null }); keys.push('who.pron'); continue; }
    for (const s of h.slots) {
      if (s.optional && !w[s.key]) continue;
      tokens.push({ pos: s.pos, word: w[s.key] ?? null }); keys.push(s.key);
    }
  }
  return { tokens, keys };
}
