import { describe, it, expect } from 'vitest';
import { readLine, type BoardLine, type BoardItem } from '../engine/board';
import { runSentence } from '../engine/pipeline';
import { compose } from '../engine/compose';
import { CONTRAPTIONS, FUN_ROLE, type Kind } from '../ui/board/parts';
import { nounByWord } from '../data/wordbank';

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

// Fun parts with a grammar job (teacher 2026-10-07: "make sure all fun parts
// have a grammatical purpose").
describe('fun parts do grammar', () => {
  it('every fun part holds a word, makes a mark, or is a helper gadget (exactly one job)', () => {
    for (const k of CONTRAPTIONS) expect([FUN_ROLE[k].pos, FUN_ROLE[k].mark, FUN_ROLE[k].tool].filter(Boolean).length).toBe(1);
  });
  it('word fun parts are words; Pulley, Bell and Dominoes are capital letter, period and comma', () => {
    const r = readLine(line([part('pulley'), part('bucket', 'the'), part('spring', 'fuzzy'), part('N', 'cat'), part('V', 'run'), part('fan', 'quickly'), part('dominoes'), part('conveyor', 'and'), part('A', 'the'), part('N', 'dog'), part('V', 'sit'), part('bell'), part('tv')]), 'full');
    expect(r.problems).toEqual([]);
    expect(r.draft.tokens.map((t) => t.pos).join('')).toBe('AJNVDCANV');
    expect(r.draft.marks).toMatchObject({ capitals: [0], endMark: '.', commas: [4] });
  });
  it('the Big Horn is an exclamation point, or a shout mark right after an interjection', () => {
    const r = readLine(line([part('cap'), part('I', 'Wow'), part('horn'), part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('horn'), part('tv')]), 'full');
    expect(r.draft.marks).toMatchObject({ shoutMark: true, endMark: '!' });
  });
  it('the Duplicator makes the next noun more than one, and the verb agrees', () => {
    const r = readLine(line([part('cap'), part('A', 'the'), part('duplicator'), part('spring', 'silly'), part('N', 'cat'), part('V', 'run'), part('stop'), part('tv')]), 'full');
    expect(r.draft.tokens[2].word).toBe('cats');
    expect(nounByWord.get('cats')).toMatchObject({ plural: true, singular: 'cat' });
    expect(compose(r.draft).text).toBe('The silly cats run.');
    const lonely = readLine(line([part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('duplicator')]), 'full', false);
    expect(lonely.problems.map((p) => p.code)).toEqual(['COPY_NO_NOUN']);
  });
  it('a comma needs a word on both sides', () => {
    expect(readLine(line([part('comma'), part('A', 'the'), part('N', 'cat'), part('V', 'run')]), 'full', false).problems.map((p) => p.code)).toEqual(['COMMA_PLACE']);
    expect(readLine(line([part('A', 'the'), part('N', 'cat'), part('V', 'run'), part('dominoes'), part('stop')]), 'full', false).problems.map((p) => p.code)).toEqual(['COMMA_PLACE']);
  });
});
