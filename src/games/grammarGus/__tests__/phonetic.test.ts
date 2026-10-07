import { describe, it, expect } from 'vitest';
import { predictWords, soundKey } from '../engine/phonetic';
import { NOUNS, VERBS, ADVERBS } from '../data/wordbank';

// Phonetic predictive typing (teacher 2026-10-07).
const nouns = NOUNS.map((n) => n.word);
const verbs = VERBS.map((v) => v.base);
const advs = ADVERBS.map((a) => a.word);
const top = (q: string, list: string[]) => predictWords(q, list)[0];

describe('phonetic predictive typing', () => {
  it('sound keys ignore middle vowels and double letters', () => {
    expect(soundKey('balloon')).toBe(soundKey('baloon'));
    expect(soundKey('balloon')).toBe(soundKey('bloon'));
    expect(soundKey('cat')).toBe(soundKey('kat'));
    expect(soundKey('dolphin')).toBe(soundKey('dolfin'));
  });
  it('finds the word a student is reaching for', () => {
    for (const [typed, want] of [['baloon', 'balloon'], ['bloon', 'balloon'], ['balun', 'balloon'], ['kat', 'cat'], ['dolfin', 'dolphin'], ['chiken', 'chicken'],
      ['kitchin', 'kitchen'], ['grandmuther', 'grandmother'], ['tyger', 'tiger'], ['elefant', undefined], ['zeebra', 'zebra'], ['rabit', 'rabbit'], ['ball', 'ball'], ['bal', 'ball']] as const) {
      if (want) expect(top(typed, nouns), typed).toBe(want);
    }
    expect(top('jumpt', verbs)).toBe('jump');
    expect(top('quikly', advs)).toBe('quickly');
    expect(top('sloly', advs)).toBe('slowly');
  });
  it('an empty box shows every word, and nonsense shows nothing', () => {
    expect(predictWords('', nouns).length).toBe(nouns.length);
    expect(predictWords('xqzv', nouns)).toEqual([]);
  });
});
