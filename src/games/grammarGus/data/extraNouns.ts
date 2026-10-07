import { nounByWord, type NounEntry } from './wordbank';

// Workboard-only nouns (teacher 2026-10-07, "keep building"): names for the
// Proper Name Stamp, and nouns with weird plurals for the Plural Crusher.
// They join the dictionary of real words, not the everyday word lists.
const add = (e: NounEntry) => { if (!nounByWord.has(e.word)) nounByWord.set(e.word, e); };
const name = (word: string, kind: NounEntry['kind'], rig: NounEntry['rig'], emoji: string): NounEntry => ({ word, tier: 2, kind, rig, emoji, pack: 'core', proper: true, noA: true });
export const NAMES = ['Mia', 'Ava', 'Zoe', 'Leo', 'Max', 'Gus', 'Vermont', 'Boston', 'Paris', 'Mars'];
export const SHE_NAMES = new Set(['mia', 'ava', 'zoe']);
export const HE_NAMES = new Set(['leo', 'max', 'gus']);
for (const w of NAMES) {
  const k = w.toLowerCase();
  const person = SHE_NAMES.has(k) || HE_NAMES.has(k);
  add(name(k, person ? 'human' : 'thing', person ? 'biped' : 'object', person ? '🧑' : k === 'mars' ? '🪐' : k === 'paris' ? '🗼' : k === 'vermont' ? '🏔️' : '🏙️'));
}
// Singular nouns whose plural is not just -s.
const one = (word: string, kind: NounEntry['kind'], rig: NounEntry['rig'], emoji: string): NounEntry => ({ word, tier: 3, kind, rig, emoji, pack: 'core' });
[one('child', 'human', 'biped', '🧒'), one('mouse', 'animal', 'critter', '🐭'), one('foot', 'thing', 'object', '🦶'), one('tooth', 'thing', 'object', '🦷'), one('person', 'human', 'biped', '🧑'), one('ox', 'animal', 'quadruped', '🐂')].forEach(add);
export const WEIRD_PLURAL_NOUNS = ['child', 'mouse', 'man', 'woman', 'goose', 'foot', 'tooth', 'person', 'ox'];
