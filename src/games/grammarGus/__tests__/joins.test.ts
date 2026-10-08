import { describe, it, expect } from 'vitest';
import { runSentence } from '../engine/pipeline';
import '../data/extraNouns';

// Joining words combine words and phrases, not just whole ideas
// (teacher 2026-10-08: "conjunctions can combine words like Xander AND Yoga").
const run = (ws: [string, string][]) => runSentence({ tokens: ws.map(([pos, word]) => ({ pos: pos as never, word })), tense: 'present', level: 'full' });
describe('joining words', () => {
  const ok: [string, [string, string][]][] = [
    ['Xander and Yoga run.', [['N', 'Xander'], ['C', 'and'], ['N', 'Yoga'], ['V', 'run']]],
    ['Mom hugs Xander and Yoga.', [['N', 'Mom'], ['V', 'hug'], ['N', 'Xander'], ['C', 'and'], ['N', 'Yoga']]],
    ['The dog chases the cat and the bird.', [['A', 'the'], ['N', 'dog'], ['V', 'chase'], ['A', 'the'], ['N', 'cat'], ['C', 'and'], ['A', 'the'], ['N', 'bird']]],
    ['The big and happy dog runs.', [['A', 'the'], ['J', 'big'], ['C', 'and'], ['J', 'happy'], ['N', 'dog'], ['V', 'run']]],
    ['The dog runs and jumps.', [['A', 'the'], ['N', 'dog'], ['V', 'run'], ['C', 'and'], ['V', 'jump']]],
  ];
  for (const [text, ws] of ok) it(text, () => {
    const r = run(ws);
    expect(r.validation.violations.filter((v) => v.blocking).map((v) => v.code)).toEqual([]);
    expect(r.composed.text).toBe(text);
    expect(r.rubric?.stars).toBe(3);
  });
});

describe('joined things on the Pixel TV', () => {
  it('both joined things are cast and on the stage together', () => {
    const r = run([['N', 'Mom'], ['V', 'hug'], ['N', 'Xander'], ['C', 'and'], ['N', 'Yoga']]);
    const s = r.script!;
    const nouns = s.cast.map((m) => m.noun);
    expect(nouns).toEqual(expect.arrayContaining(['Mom', 'xander', 'yoga']));
    const onStage = Object.keys(s.scenes[0].start).map((id) => s.cast.find((m) => m.id === id)!.noun);
    expect(onStage).toEqual(expect.arrayContaining(['xander', 'yoga']));
  });
  it('eating two foods is fine, eating a food and a rock is silly', () => {
    const codes = (ws: [string, string][]) => (runSentence({ tokens: ws.map(([pos, word]) => ({ pos: pos as never, word })), tense: 'present', level: 'full' }, undefined, 's1', { strictness: 'real' } as never).rubric?.verdicts ?? []).map((v) => v.code);
    expect(codes([['R', 'she'], ['V', 'eat'], ['A', 'the'], ['N', 'pizza'], ['C', 'and'], ['A', 'the'], ['N', 'cake']])).not.toContain('EAT_NOT_FOOD');
    expect(codes([['R', 'she'], ['V', 'eat'], ['A', 'the'], ['N', 'pizza'], ['C', 'and'], ['A', 'the'], ['N', 'rock']])).toContain('EAT_NOT_FOOD');
  });
});
