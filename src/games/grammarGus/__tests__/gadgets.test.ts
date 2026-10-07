import { describe, it, expect } from 'vitest';
import { readLine, type BoardItem, type BoardLine } from '../engine/board';
import { applyGadgets, retimeItems } from '../engine/gadgets';
import { compose } from '../engine/compose';
import { runSentence } from '../engine/pipeline';
import type { Kind } from '../ui/board/parts';

// Claudia's NOW parts (teacher 2026-10-07: "build now", and "everything
// snaps ... in the right order in order to run").
let n = 0;
const part = (kind: Kind, word: string | null = null, form?: BoardItem['form']): BoardItem => ({ id: `g${n++}`, kind, word, ...(form ? { form } : {}) });
const line = (items: BoardItem[]): BoardLine => ({ id: `l${n++}`, x: 0, y: 0, items });
const text = (l: BoardLine, level: 'full' | 'guided' | 'challenge' = 'full') => compose(readLine(l, level, false).draft).text;

describe('NOW parts', () => {
  it('the Mood Meter Valve: calm is a period, big is an exclamation point (it shows at Full help too)', () => {
    expect(text(line([part('cap'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('mood', 'calm')]))).toBe('The cat runs.');
    expect(text(line([part('cap'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('mood', 'big')]))).toBe('The cat runs!');
  });
  it('the Time Tunnel opens the sentence with a time word and sets the time', () => {
    const l = line([part('cap'), part('tunnel', 'long ago'), part('A', 'the'), part('N', 'cat'), part('V', 'jump'), part('stop')]);
    expect(text(l)).toBe('Long ago, the cat jumped.');
    expect(runSentence(readLine(l, 'full', false).draft).validation.ok).toBe(true);
  });
  it('front parts only work at the front, in order', () => {
    const l = line([part('cap'), part('A', 'the'), part('N', 'cat'), part('slingshot', 'quickly'), part('V', 'jump'), part('stop')]);
    expect(readLine(l, 'full', false).problems.map((p) => p.code)).toEqual(['NOT_FRONT']);
    expect(text(line([part('cap'), part('slingshot', 'quickly'), part('A', 'the'), part('N', 'cat'), part('V', 'jump'), part('stop')]))).toBe('Quickly, the cat jumps.');
  });
  it('the Confetti Trapdoor brings its own punctuation and capital letter', () => {
    const r = readLine(line([part('cap'), part('trapdoor', 'Wow'), part('A', 'the'), part('N', 'cat'), part('V', 'jump'), part('stop')]), 'challenge', false);
    expect(r.draft.marks).toMatchObject({ shoutMark: true, capitals: [0, 1] });
  });
  it('the Merge Funnel joins two nouns into a team that takes "run"', () => {
    expect(text(line([part('cap'), part('N', 'cat'), part('funnel', 'and'), part('N', 'dog'), part('V', 'run'), part('stop')]))).toMatch(/cat and the dog run\.|cat and dog run\./i);
  });
  it('the Comma Drawbridge only lowers before a joining word', () => {
    const ok = line([part('cap'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('bridge'), part('C', 'and'), part('A', 'the'), part('N', 'dog'), part('V', 'jump'), part('stop')]);
    expect(readLine(ok, 'full', false).problems).toEqual([]);
    expect(text(ok)).toBe('The cat runs, and the dog jumps.');
    const up = line([part('cap'), part('A', 'the'), part('bridge'), part('N', 'cat'), part('V', 'run'), part('stop')]);
    expect(readLine(up, 'full', false).problems.map((p) => p.code)).toContain('BRIDGE_UP');
  });
  it('the Dead-End Detector closes the road on a where word with no landing', () => {
    const l = line([part('detector'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('switch', 'on')]);
    expect(readLine(l, 'full', false).problems.map((p) => p.code)).toEqual(['DEAD_END']);
  });
  it('the Sprinter Flag needs a capital letter and punctuation even when the teacher setting adds them', () => {
    expect(readLine(line([part('flag'), part('A', 'the'), part('N', 'cat'), part('V', 'run')]), 'full', false).problems.map((p) => p.code)).toEqual(['NEED_CAP', 'NEED_END', 'NEED_TV']);
  });
});

describe('helper gadgets', () => {
  it('the Clock changes the action words in the machine', () => {
    const l = line([part('clock', 'present'), part('A', 'the'), part('N', 'cat'), part('V', 'jump', 'third')]);
    const past = retimeItems(l, 'past', 'guided');
    expect(past.find((i) => i.kind === 'V')!.form).toBe('past');
    expect(past.find((i) => i.kind === 'clock')!.word).toBe('past');
    expect(retimeItems({ ...l, items: past }, 'future', 'guided').find((i) => i.kind === 'V')!.form).toBe('future');
  });
  it('the A/An Sniffer sneezes a into an', () => {
    const l = line([part('sniffer'), part('A', 'a'), part('N', 'apple'), part('V', 'jump')]);
    const g = applyGadgets(l, 'challenge');
    expect(g.items.find((i) => i.kind === 'A')!.word).toBe('an');
    expect(g.events[0].fixed).toBe(true);
  });
  it('the Describe Sorter puts describing words in order', () => {
    const l = line([part('sorter'), part('A', 'the'), part('J', 'red'), part('J', 'big'), part('N', 'dog'), part('V', 'run')]);
    expect(applyGadgets(l, 'guided').items.filter((i) => i.kind === 'J').map((i) => i.word)).toEqual(['big', 'red']);
  });
  it('the Agreement Gears shift the action to match the who', () => {
    const l = line([part('gears'), part('A', 'the'), part('N', 'cat'), part('V', 'jump', 'base')]);
    expect(applyGadgets(l, 'guided').items.find((i) => i.kind === 'V')!.form).toBe('third');
  });
  it('the Time Tunnel turns the Clock to match its time word', () => {
    const l = line([part('clock', 'present'), part('tunnel', 'next week'), part('A', 'the'), part('N', 'cat'), part('V', 'jump', 'third')]);
    const g = applyGadgets(l, 'guided');
    expect(g.items.find((i) => i.kind === 'clock')!.word).toBe('future');
    expect(g.items.find((i) => i.kind === 'V')!.form).toBe('future');
  });
  it('the Pronoun Teleporter zaps a repeated noun into a pronoun', () => {
    const prev = line([part('A', 'the'), part('N', 'girl'), part('V', 'sing')]);
    const l = line([part('teleporter'), part('cap'), part('A', 'the'), part('N', 'girl'), part('V', 'jump'), part('stop')]);
    const g = applyGadgets(l, 'full', prev);
    expect(text({ ...l, items: g.items })).toBe('She jumps.');
  });
});

describe('SOON parts', () => {
  it('the Proper Name Stamp: names need no article and always get a capital letter', () => {
    const l = line([part('cap'), part('stamp', 'Mia'), part('V', 'jump'), part('stop')]);
    expect(text(l)).toBe('Mia jumps.');
    expect(runSentence(readLine(l, 'full', false).draft).validation.ok).toBe(true);
    expect(text(line([part('cap'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('P', 'to'), part('stamp', 'Vermont'), part('stop')]))).toBe('The cat runs to Vermont.');
  });
  it('the Plural Crusher makes a weird plural, and the action agrees', () => {
    const l = line([part('cap'), part('A', 'the'), part('crusher', 'mouse'), part('V', 'jump'), part('stop')]);
    expect(text(l)).toBe('The mice jump.');
    expect(text(line([part('cap'), part('A', 'the'), part('crusher', 'child'), part('V', 'run'), part('stop')]))).toBe('The children run.');
  });
  it('the Irregular Past Press holds verbs whose past breaks the rule', async () => {
    const { FUN_ROLE } = await import('../ui/board/parts');
    const { regularPast } = await import('../engine/dictionary');
    expect(FUN_ROLE.pastpress.words!.length).toBeGreaterThan(3);
    expect(regularPast('go')).toBe('goed');
    expect(regularPast('hop')).toBe('hopped');
  });
  it('the Comma List Train: a list of three who all take "run", with commas', () => {
    const l = line([part('cap'), part('A', 'the'), part('N', 'cat'), part('listtrain'), part('A', 'the'), part('N', 'dog'), part('listtrain'), part('C', 'and'), part('A', 'the'), part('N', 'frog'), part('V', 'run'), part('stop')]);
    expect(text(l)).toBe('The cat, the dog, and the frog run.');
    expect(runSentence(readLine(l, 'challenge', false).draft).validation.ok).toBe(true);
  });
  it('object pronouns work after the action, and the Turnstile fixes the wrong case', () => {
    expect(text(line([part('cap'), part('A', 'the'), part('N', 'cat'), part('V', 'chase'), part('R', 'him'), part('stop')]))).toBe('The cat chases him.');
    const wrong = line([part('turnstile'), part('cap'), part('R', 'him'), part('V', 'jump'), part('stop')]);
    expect(runSentence(readLine(wrong, 'full', false).draft).validation.violations[0].code).toBe('PRONOUN_CASE');
    const g = applyGadgets(wrong, 'full');
    expect(text({ ...wrong, items: g.items })).toBe('He jumps.');
  });
});

describe("Gus's review", () => {
  it('scores the sentence, suggests real parts to grow it, and asks a question about it', async () => {
    const { reviewSentence } = await import('../engine/review');
    const l = line([part('cap'), part('A', 'the'), part('N', 'cat'), part('V', 'jump'), part('stop')]);
    const d = readLine(l, 'full', false).draft;
    const rv = reviewSentence(d, runSentence(d), 0, ['robot']);
    expect(rv.score.map((s) => s.label)).toEqual(['Complete sentence', 'Makes sense', 'Detail', 'Variety']);
    expect(rv.score[0].level).toBe(3);
    expect(rv.tips.map((t) => t.kind)).toEqual(['spring', 'fan']);
    expect(rv.quiz?.answer).toBe('cat');
    expect(rv.quiz?.choices).toContain('cat');
    expect(reviewSentence(d, runSentence(d), 2).quiz?.answer).toBe('in the present');
  });
});
