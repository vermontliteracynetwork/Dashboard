import { ADJECTIVES, ADVERBS, NOUNS, VERBS, adjByWord, adverbSet, interjectionSet, nounByWord, verbByBase, type Pack } from '../data/wordbank';
import { IRREGULAR_PAST } from '../data/irregularVerbs';

// Real dictionary words (teacher 2026-10-07: "if the student types a real
// word, make sure it adds. reference a real dictionary"). When a typed word
// is not in Gus's word bank, Gus checks the Free Dictionary API
// (dictionaryapi.dev, built from Wiktionary). If the dictionary lists the
// word as the part of speech the student is building, the word joins the
// bank for this device, with its verb forms worked out by spelling rules
// and an irregular verb table, and the grammar engine treats it like any
// other word. Rude words are never added.

export type DictPos = 'N' | 'V' | 'J' | 'D' | 'I';
export interface CustomWord { pos: DictPos; word: string; plural?: boolean }
export type LookupResult = { status: 'ok'; pos: DictPos[] } | { status: 'notfound' | 'offline' | 'blocked'; pos: DictPos[] };

const API = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const POS_MAP: Record<string, DictPos> = { noun: 'N', verb: 'V', adjective: 'J', adverb: 'D', interjection: 'I', exclamation: 'I' };
// Rude or unsafe words are never added, even if a dictionary lists them.
const BLOCK = /^(ass|arse|bitch|bastard|crap|cunt|cock|dick|damn|fag|fuck|hell|jizz|nigg|piss|porn|pussy|rape|retard|sex|shit|slut|tit|twat|whore|kill|murder|suicide|gun|drug|weed|beer|vodka)/i;

export const cleanWord = (w: string) => w.trim().toLowerCase().replace(/[^a-z'-]/g, '');
export const isBlocked = (w: string) => BLOCK.test(cleanWord(w));

const cache = new Map<string, LookupResult>();
export async function lookupWord(word: string, fetchImpl: typeof fetch = fetch): Promise<LookupResult> {
  const w = cleanWord(word);
  if (!w || w.length < 2) return { status: 'notfound', pos: [] };
  if (isBlocked(w)) return { status: 'blocked', pos: [] };
  const hit = cache.get(w); if (hit) return hit;
  try {
    const res = await fetchImpl(API + encodeURIComponent(w));
    if (res.status === 404) { const r: LookupResult = { status: 'notfound', pos: [] }; cache.set(w, r); return r; }
    if (!res.ok) return { status: 'offline', pos: [] };
    const data = await res.json() as { word?: string; meanings?: { partOfSpeech?: string }[] }[];
    const pos = [...new Set(data.flatMap((e) => (e.meanings ?? []).map((m) => POS_MAP[(m.partOfSpeech ?? '').toLowerCase()]).filter(Boolean)))] as DictPos[];
    const r: LookupResult = pos.length ? { status: 'ok', pos } : { status: 'notfound', pos: [] };
    cache.set(w, r);
    return r;
  } catch { return { status: 'offline', pos: [] }; }
}

// Verb forms by rule: walk/walks/walked, fix/fixes, cry/cries/cried,
// stop/stopped, bake/baked, plus the irregular table (sit/sat).
export function verbForms(base: string): { third: string; past: string } {
  const b = cleanWord(base);
  const third = /(s|sh|ch|x|z|o)$/.test(b) ? `${b}es` : /[^aeiou]y$/.test(b) ? `${b.slice(0, -1)}ies` : `${b}s`;
  let past = IRREGULAR_PAST[b];
  if (!past) {
    if (b.endsWith('e')) past = `${b}d`;
    else if (/[^aeiou]y$/.test(b)) past = `${b.slice(0, -1)}ied`;
    else if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(b)) past = `${b}${b.slice(-1)}ed`; // one short vowel then one consonant: stop, hug
    else past = `${b}ed`;
  }
  return { third, past };
}

const STORE = 'gus-custom-words';
const added = new Set<string>();
export function registerWord(cw: CustomWord): void {
  const w = cleanWord(cw.word);
  const key = `${cw.pos}:${w}`;
  if (!w || added.has(key) || isBlocked(w)) return;
  added.add(key);
  const pack: Pack = 'custom';
  if (cw.pos === 'N' && !nounByWord.has(w)) { const e = { word: w, tier: 3 as const, kind: 'thing' as const, rig: 'object' as const, emoji: '📖', pack, ...(cw.plural ? { plural: true, noA: true } : {}) }; NOUNS.push(e); nounByWord.set(w, e); }
  if (cw.pos === 'V' && !verbByBase.has(w)) { const f = verbForms(w); const e = { base: w, third: f.third, past: f.past, objectUse: 'B' as const, clip: 'wiggle', pack, gentle: true }; VERBS.push(e); verbByBase.set(w, e); }
  if (cw.pos === 'J' && !adjByWord.has(w)) { const e = { word: w, kind: 'look' as const, pack }; ADJECTIVES.push(e); adjByWord.set(w, e); }
  if (cw.pos === 'D' && !adverbSet.has(w)) { ADVERBS.push({ word: w, pack }); adverbSet.add(w); }
  if (cw.pos === 'I') interjectionSet.add(w.charAt(0).toUpperCase() + w.slice(1));
}
export function customWords(): CustomWord[] {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '[]') as CustomWord[]; } catch { return []; }
}
export function addCustomWord(cw: CustomWord): void {
  registerWord(cw);
  try { const list = customWords(); if (!list.some((x) => x.pos === cw.pos && x.word === cleanWord(cw.word))) localStorage.setItem(STORE, JSON.stringify([...list, { ...cw, word: cleanWord(cw.word) }].slice(-300))); } catch { /* fine */ }
}
export function loadCustomWords(): void { for (const cw of customWords()) registerWord(cw); }
export const customFor = (pos: DictPos) => customWords().filter((c) => c.pos === pos).map((c) => (pos === 'I' ? c.word.charAt(0).toUpperCase() + c.word.slice(1) : c.word));
