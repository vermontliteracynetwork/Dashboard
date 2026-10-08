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
