import { describe, it, expect } from 'vitest';
import { readLine, lineText } from '../engine/board';
import { runSentence } from '../engine/pipeline';
import { EXAMPLE_SENTENCES, exampleItems } from '../data/examples';

// Every example sentence in the parts menu must be a working 3-star machine
// that reads exactly as its label says.
describe('example sentences', () => {
  let n = 0;
  const uid = () => `e${n++}`;
  for (const ex of EXAMPLE_SENTENCES) {
    it(ex.text, () => {
      const line = { id: 'l', x: 0, y: 0, items: exampleItems(ex, uid) };
      const rd = readLine(line, 'full');
      expect(rd.problems).toEqual([]);
      expect(lineText(line, rd)).toBe(ex.text);
      expect(runSentence(rd.draft).rubric?.stars).toBe(3);
    });
  }
});

// The Proper Noun machine's class names (teacher 2026-10-08) run as names.
describe('class names in the Proper Noun machine', () => {
  for (const name of ['Mom', 'Dad', 'Gma', 'Gpa', 'Miss Kayden', 'Xander', 'Geoff', 'Yoga']) {
    it(`${name} runs.`, () => {
      let n = 0; const uid = () => `p${n++}`;
      const items = [{ id: uid(), kind: 'lever' as const, word: null }, { id: uid(), kind: 'clock' as const, word: 'present' }, { id: uid(), kind: 'proper' as const, word: name, bottom: { id: uid(), kind: 'cap' as const, word: null } }, { id: uid(), kind: 'V' as const, word: 'run', form: 'third' as const }, { id: uid(), kind: 'stop' as const, word: null }, { id: uid(), kind: 'tv' as const, word: null }];
      const line = { id: 'l', x: 0, y: 0, items };
      const rd = readLine(line, 'full');
      expect(rd.problems).toEqual([]);
      expect(lineText(line, rd)).toBe(`${name} runs.`);
      expect(runSentence(rd.draft).rubric?.stars).toBe(3);
    });
  }
  it('my mom still works as an everyday noun', () => {
    let n = 0; const uid = () => `q${n++}`;
    const items = [{ id: uid(), kind: 'lever' as const, word: null }, { id: uid(), kind: 'A' as const, word: 'my', bottom: { id: uid(), kind: 'cap' as const, word: null } }, { id: uid(), kind: 'N' as const, word: 'mom' }, { id: uid(), kind: 'V' as const, word: 'run' }, { id: uid(), kind: 'stop' as const, word: null }, { id: uid(), kind: 'tv' as const, word: null }];
    const line = { id: 'l', x: 0, y: 0, items };
    const rd = readLine(line, 'full');
    expect(lineText(line, rd)).toBe('My mom runs.');
    expect(runSentence(rd.draft).rubric?.stars).toBe(3);
  });
});
