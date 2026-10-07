import { describe, it, expect } from 'vitest';
import { readLine, type BoardLine, type BoardItem } from '../engine/board';
import { runSentence } from '../engine/pipeline';
import { SEED_ARTICLES, starterItems, bankFor } from '../reading/library';

// Read and Respond (teacher 2026-10-07): "Cats purr because" in the machines.
let n = 0;
const id = () => `r${n++}`;
const part = (kind: BoardItem['kind'], word: string | null = null): BoardItem => ({ id: id(), kind, word });
const line = (items: BoardItem[]): BoardLine => ({ id: 'l', x: 0, y: 0, items });

describe('read and respond', () => {
  const cats = SEED_ARTICLES[0];
  it('the starter becomes locked word machines', () => {
    const items = starterItems(cats, id);
    expect(items.map((i) => [i.kind, i.word, i.locked])).toEqual([['N', 'cats', true], ['V', 'purr', true], ['C', 'because', true]]);
  });
  it('finished answers with the article words run', () => {
    const answers: [string, string][][] = [
      [['R', 'they'], ['V', 'be'], ['J', 'happy']],
      [['R', 'they'], ['V', 'be'], ['J', 'content'], ['C', 'and'], ['J', 'calm']],
      [['R', 'it'], ['V', 'heal'], ['N', 'bones']],
    ];
    for (const a of answers) {
      const items = [part('cap'), ...starterItems(cats, id), ...a.map(([k, w]) => part(k as BoardItem['kind'], w)), part('stop'), part('tv')];
      const rd = readLine(line(items), 'full');
      expect(rd.problems).toEqual([]);
      expect(runSentence(rd.draft).validation.ok).toBe(true);
    }
  });
  it('the starter alone does not run', () => {
    const rd = readLine(line([part('cap'), ...starterItems(cats, id), part('stop'), part('tv')]), 'full');
    expect(runSentence(rd.draft).validation.ok).toBe(false);
  });
  it('the word bank lists the article words for each part of speech', () => {
    expect(bankFor(cats, 'J')).toContain('happy');
    expect(bankFor(null, 'J')).toEqual([]);
  });
});
