import { describe, it, expect } from 'vitest';
import { lookupWord, registerWord, verbForms, isBlocked } from '../engine/dictionary';
import { runSentence } from '../engine/pipeline';
import { tok } from './helpers';

// Real dictionary words (teacher 2026-10-07).
const fake = (status: number, body: unknown) => (async () => ({ status, ok: status < 400, json: async () => body })) as unknown as typeof fetch;

describe('real dictionary words', () => {
  it('verb forms follow spelling rules and irregular verbs', () => {
    expect(verbForms('sit')).toEqual({ third: 'sits', past: 'sat' });
    expect(verbForms('wave')).toEqual({ third: 'waves', past: 'waved' });
    expect(verbForms('cry')).toEqual({ third: 'cries', past: 'cried' });
    expect(verbForms('stop')).toEqual({ third: 'stops', past: 'stopped' });
    expect(verbForms('fix')).toEqual({ third: 'fixes', past: 'fixed' });
    expect(verbForms('paint')).toEqual({ third: 'paints', past: 'painted' });
  });
  it('reads the parts of speech from the dictionary', async () => {
    expect(await lookupWord('sit', fake(200, [{ meanings: [{ partOfSpeech: 'verb' }, { partOfSpeech: 'noun' }] }]))).toEqual({ status: 'ok', pos: ['V', 'N'] });
    expect((await lookupWord('blorptastic', fake(404, {}))).status).toBe('notfound');
    expect((await lookupWord('zzwordnet', (async () => { throw new Error('no network'); }) as unknown as typeof fetch)).status).toBe('offline');
  });
  it('rude words are never added', async () => {
    expect(isBlocked('Shitty')).toBe(true);
    expect((await lookupWord('shit', fake(200, [{ meanings: [{ partOfSpeech: 'noun' }] }]))).status).toBe('blocked');
  });
  it('a new dictionary word works in the grammar engine and the movie', () => {
    registerWord({ pos: 'V', word: 'sit' });
    registerWord({ pos: 'N', word: 'penguin' });
    const r = runSentence({ tokens: [tok('A', 'the'), tok('N', 'penguin'), tok('V', 'sit')], tense: 'past', level: 'full' });
    expect(r.composed.text).toBe('The penguin sat.');
    expect(r.rubric?.stars).toBe(3);
    expect(r.script).toBeTruthy();
  });
});

describe('typed forms (Claudia round 1)', () => {
  const verbDict = (words: Record<string, string[]>) => (async (url: string) => {
    const w = decodeURIComponent(String(url).split('/').pop()!);
    return words[w] ? { status: 200, ok: true, json: async () => [{ word: w, meanings: words[w].map((p) => ({ partOfSpeech: p })) }] } : { status: 404, ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
  it('walked becomes walk, sat becomes sit, cats is a plural noun', async () => {
    const f = verbDict({ wobble: ['verb'], giraffe: ['noun'] });
    const { checkTyped } = await import('../engine/dictionary');
    expect(await checkTyped('wobbled', 'V', () => false, f)).toEqual({ kind: 'base', base: 'wobble' });
    expect(await checkTyped('sat', 'V', (w) => w === 'sit', f)).toEqual({ kind: 'base', base: 'sit' });
    expect(await checkTyped('giraffes', 'N', () => false, f)).toEqual({ kind: 'ok', word: 'giraffes', plural: true });
    expect(await checkTyped('giraffe', 'V', () => false, f)).toEqual({ kind: 'otherPos', pos: ['N'] });
  });
  it('the block list matches whole words only', () => {
    expect(isBlocked('hello')).toBe(false);
    expect(isBlocked('assist')).toBe(false);
    expect(isBlocked('cockatoo')).toBe(false);
    expect(isBlocked('shits')).toBe(true);
  });
});
