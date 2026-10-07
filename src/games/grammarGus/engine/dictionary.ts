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
// Whole words only (plus simple endings), so "hello", "assist" and
// "cockatoo" stay fine.
const BLOCKED = new Set(['shitty', 'bitchy', 'ass', 'arse', 'bitch', 'bastard', 'crap', 'cunt', 'cock', 'dick', 'damn', 'fag', 'faggot', 'fuck', 'hell', 'jizz', 'nigger', 'nigga', 'piss', 'porn', 'pussy', 'rape', 'retard', 'sex', 'sexy', 'shit', 'slut', 'tit', 'tits', 'twat', 'whore', 'murder', 'suicide', 'gun', 'drug', 'weed', 'beer', 'vodka', 'boob', 'boobs', 'butt']);
export const cleanWord = (w: string) => w.trim().toLowerCase().replace(/[^a-z'-]/g, '');
export const isBlocked = (word: string) => {
  const w = cleanWord(word);
  // Only plain endings (s, es, ed, ing) are stripped, so "butter" and "hello" stay fine.
  const m = w.match(/^(.{3,}?)(es|s|ed|ing)$/);
  return BLOCKED.has(w) || (!!m && BLOCKED.has(m[1])) || (!!m && BLOCKED.has(m[1].replace(/(.)\1$/, '$1')));
};

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
// Typed forms that are not the base word: "walked" should be "walk" (the
// Clock sets the time), and "cats" is a plural noun, not a new singular.
const PAST_TO_BASE = new Map(Object.entries(IRREGULAR_PAST).map(([b, p]) => [p, b]));
export function baseCandidates(q: string, pos: DictPos): string[] {
  const w = cleanWord(q); const out: string[] = [];
  if (pos === 'V') {
    if (PAST_TO_BASE.has(w)) out.push(PAST_TO_BASE.get(w)!);
    if (w.endsWith('ied')) out.push(`${w.slice(0, -3)}y`);
    if (w.endsWith('ies')) out.push(`${w.slice(0, -3)}y`);
    if (w.endsWith('ing')) { const s = w.slice(0, -3); out.push(s, `${s}e`, s.replace(/(.)\1$/, '$1')); }
    if (w.endsWith('ed')) { const s = w.slice(0, -2); out.push(s, `${s}e`, s.replace(/(.)\1$/, '$1'), w.slice(0, -1)); }
    if (w.endsWith('es')) out.push(w.slice(0, -2));
    if (w.endsWith('s') && !w.endsWith('ss')) out.push(w.slice(0, -1));
  }
  if (pos === 'N') {
    if (w.endsWith('ies')) out.push(`${w.slice(0, -3)}y`);
    if (w.endsWith('es')) out.push(w.slice(0, -2));
    if (w.endsWith('s') && !w.endsWith('ss')) out.push(w.slice(0, -1));
  }
  return [...new Set(out)].filter((x) => x.length >= 2 && x !== w);
}

export type TypedCheck =
  | { kind: 'ok'; word: string; plural?: boolean }
  | { kind: 'base'; base: string }
  | { kind: 'otherPos'; pos: DictPos[] }
  | { kind: 'notfound' | 'offline' | 'blocked' };
const IRREGULAR_PLURAL: Record<string, string> = { child: 'children', mouse: 'mice', person: 'people', man: 'men', woman: 'women', foot: 'feet', tooth: 'teeth', goose: 'geese', ox: 'oxen', fish: 'fish', sheep: 'sheep', deer: 'deer' };
const ingForms = (b: string) => [`${b}ing`, `${b.replace(/e$/, '')}ing`, `${b}${b.slice(-1)}ing`, b.endsWith('ie') ? `${b.slice(0, -2)}ying` : ''];
const pluralOf = (b: string) => IRREGULAR_PLURAL[b] ?? (/(s|sh|ch|x|z)$/.test(b) ? `${b}es` : /[^aeiou]y$/.test(b) ? `${b.slice(0, -1)}ies` : `${b}s`);
// A typed word is a form of a base word only when the base really makes
// that form: "walked" is walk's past, but "seed" is not see's past.
function isFormOf(w: string, b: string, pos: DictPos): boolean {
  if (pos === 'V') { const f = verbForms(b); return f.past === w || f.third === w || ingForms(b).includes(w); }
  return pluralOf(b) === w;
}
// The whole check for a typed word in one machine's menu.
export async function checkTyped(q: string, pos: DictPos, inBank: (w: string) => boolean, fetchImpl: typeof fetch = fetch): Promise<TypedCheck> {
  const w = cleanWord(q);
  if (isBlocked(w)) return { kind: 'blocked' };
  const isPos = async (x: string) => inBank(x) || ((await lookupWord(x, fetchImpl)).pos.includes(pos));
  if (pos === 'N') { const irr = Object.entries(IRREGULAR_PLURAL).find(([sing, p]) => p === w && sing !== p); if (irr && await isPos(irr[0])) return { kind: 'ok', word: w, plural: true }; }
  for (const b of baseCandidates(w, pos)) {
    if (!isFormOf(w, b, pos) || !(await isPos(b))) continue;
    return pos === 'V' ? { kind: 'base', base: b } : { kind: 'ok', word: w, plural: true };
  }
  const r = await lookupWord(w, fetchImpl);
  if (r.status === 'ok') return r.pos.includes(pos) ? { kind: 'ok', word: w } : { kind: 'otherPos', pos: r.pos };
  return { kind: r.status };
}

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
// The Duplicator (teacher 2026-10-07, fun parts with a grammar job): the
// next noun becomes more than one. Its plural joins the lexicon as a
// plural noun that keeps the singular's picture, so "cats" is drawn as a
// few cats and the verb has to agree with it.
export function pluralNounOf(word: string): string {
  const w = cleanWord(word);
  if (!w || word !== word.toLowerCase()) return word; // names stay as they are
  const e = nounByWord.get(w);
  if (e?.plural || e?.group || e?.singular) return w;
  const p = pluralOf(w);
  if (p === w) return w;
  if (!nounByWord.has(p)) nounByWord.set(p, { ...(e ?? { tier: 3 as const, kind: 'thing' as const, rig: 'object' as const, emoji: '📖', pack: 'custom' as Pack }), word: p, plural: true, noA: true, singular: w });
  return p;
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
