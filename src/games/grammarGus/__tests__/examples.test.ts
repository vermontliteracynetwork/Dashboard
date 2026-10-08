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
