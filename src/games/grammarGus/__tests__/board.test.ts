import { describe, it, expect } from 'vitest';
import { readLine, type BoardLine, type BoardItem } from '../engine/board';
import { runSentence } from '../engine/pipeline';
import { compose } from '../engine/compose';
import type { Kind } from '../ui/board/parts';

// Workboard lines (teacher 2026-10-07): finishing machines become marks.
let n = 0;
const part = (kind: Kind, word: string | null = null): BoardItem => ({ id: `i${n++}`, kind, word });
const line = (items: BoardItem[]): BoardLine => ({ id: 'l', x: 0, y: 0, items, tense: 'past' });

describe('workboard lines', () => {
  it('a full machine reads as a sentence with its marks', () => {
    const r = readLine(line([part('cap'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('stop'), part('tv')]), 'full');
    expect(r.problems).toEqual([]);
    expect(r.draft.marks).toMatchObject({ capitals: [0], endMark: '.' });
    expect(runSentence(r.draft).rubric?.stars).toBe(3);
  });
  it('missing finishing parts are named, kindly', () => {
    const r = readLine(line([part('A', 'the'), part('N', 'cat'), part('V', 'run')]), 'full');
    expect(r.problems.map((p) => p.code)).toEqual(['NEED_CAP', 'NEED_END', 'NEED_TV']);
    expect(readLine(line([part('A', 'the'), part('N', 'cat'), part('V', 'run')]), 'full', false).problems).toEqual([]);
  });
  it('stamps and the TV must be at the end; a bang after a shout is the shout mark', () => {
    expect(readLine(line([part('cap'), part('A', 'the'), part('stop'), part('N', 'cat'), part('V', 'run'), part('stop'), part('tv')]), 'full').problems[0].code).toBe('END_NOT_LAST');
    expect(readLine(line([part('cap'), part('tv'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('stop')]), 'full').problems[0].code).toBe('TV_NOT_LAST');
    const r = readLine(line([part('cap'), part('I', 'Wow'), part('bang'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('stop'), part('tv')]), 'challenge');
    expect(r.draft.marks?.shoutMark).toBe(true);
    expect(r.draft.marks?.endMark).toBe('.');
  });
  it('the Comma Clip and the Big Letter Press work at Challenge', () => {
    const items = [part('clock', 'past'), part('cap'), part('D', 'softly'), part('comma'), part('A', 'the'), part('N', 'girl'), part('V', 'sing'), part('stop'), part('tv')];
    items[6].form = 'past';
    const r = readLine(line(items), 'challenge');
    expect(r.draft.marks?.commas).toEqual([0]);
    expect(compose(r.draft).text).toBe('Softly, the girl sang.');
    expect(runSentence(r.draft).validation.ok).toBe(true);
  });
});
