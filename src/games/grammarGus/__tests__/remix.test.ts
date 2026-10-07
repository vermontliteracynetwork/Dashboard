import { describe, it, expect } from 'vitest';
import { makeLonger, makeShorter, pronounFor, pronounSwap, rollPart, sillySwap, type MachineState } from '../engine/remix';
import { platesFor } from '../engine/labels';
import { buildTokens } from '../engine/machine';
import { runSentence } from '../engine/pipeline';
import { makeRng } from '../engine/rng';

// Remix tools (plan 17.6) and Label It plates (plan 18.7).
const base: MachineState = { words: { 'who.art': 'the', 'who.noun': 'cat', 'did.verb': 'run' }, whoPron: false, howFirst: false, open: [] };
const o = { tense: 'past' as const };
const valid = (m: MachineState) => runSentence({ tokens: buildTokens(m.words, m.whoPron, m.howFirst).tokens, tense: 'past', level: 'full' }).validation.ok;

describe('remix tools', { timeout: 60000 }, () => {
  it('every tool keeps the sentence working, over many rolls', () => {
    const rng = makeRng(4);
    let m = base;
    for (let k = 0; k < 60; k++) {
      const tool = k % 5;
      const next = tool === 0 ? rollPart(m, 'did.verb', rng, o) : tool === 1 ? makeLonger(m, rng, o) : tool === 2 ? sillySwap(m, rng, o) : tool === 3 ? makeShorter(m, rng, o) : pronounSwap(m, o);
      if (next) { expect(valid(next)).toBe(true); m = next; }
    }
  });
  it('shorter never removes WHO or the verb', () => {
    const rng = makeRng(1);
    expect(makeShorter(base, rng, o)).toBeNull();
    const longer = { ...base, words: { ...base.words, 'who.adj1': 'big', 'how.adv': 'quickly' } };
    const s = makeShorter(longer, rng, o)!;
    expect(s.words['who.noun']).toBe('cat');
    expect(s.words['did.verb']).toBe('run');
  });
  it('pronoun swap: cat to it, girl to she, crowd to they, and back', () => {
    expect(pronounFor('cat')).toBe('it'); expect(pronounFor('girl')).toBe('she'); expect(pronounFor('crowd')).toBe('they'); expect(pronounFor('dad')).toBe('he');
    const p = pronounSwap(base, o)!;
    expect(p.whoPron).toBe(true); expect(p.words['who.pron']).toBe('it');
    expect(pronounSwap(p, o)!.whoPron).toBe(false);
  });
  it('Label It plates follow the housings', () => {
    const { keys } = buildTokens({ shout: 'Wow', 'who.art': 'the', 'who.adj1': 'big', 'who.noun': 'dog', 'did.verb': 'jump', 'where.prep': 'over', 'where.art': 'the', 'where.noun': 'van' }, false);
    expect(platesFor(keys).map((p) => [p.label, p.indices])).toEqual([['SHOUT', [0]], ['WHO', [1, 2, 3]], ['WHAT THEY DID', [4]], ['WHERE', [5, 6, 7]]]);
  });
});
