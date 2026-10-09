import { describe, it, expect } from 'vitest';
import { CER_LABS } from '../data/cer';

// CER Lab Report data (Claudia's Phase 2, 2026-10-09).
describe('CER Lab Report', () => {
  it('every experiment has one right claim, reason and unit, and a real best row', () => {
    for (const lab of CER_LABS) {
      expect(lab.rows[lab.best]).toBeTruthy();
      expect(lab.units[0]).toBe(lab.rows[lab.best].unit);
      expect(new Set(lab.claims).size).toBe(lab.claims.length);
      expect(new Set(lab.reasons).size).toBe(lab.reasons.length);
      for (const r of lab.rows) expect(r.text).toContain(String(r.value));
      expect(JSON.stringify(lab)).not.toMatch(/—/);
    }
  });
});

import { LABEL_DIAGRAMS } from '../data/labels';
describe('Label and Unit Maker', () => {
  it('every diagram has unique labels, distractors that are not its labels, and one right measurement', () => {
    for (const d of LABEL_DIAGRAMS) {
      const words = d.spots.map((s) => s.word);
      expect(new Set(words).size).toBe(words.length);
      d.extras.forEach((x) => expect(words).not.toContain(x));
      expect([...d.measure.wrong, ...d.measure.wrongNumbers]).not.toContain(d.measure.answer);
      expect(d.measure.sentence).toContain('___');
      expect(JSON.stringify(d)).not.toMatch(/—/);
    }
  });
});

import { makeBlueprint, makeScienceJob } from '../engine/jobs';
describe('new Blueprints (2026-10-09)', () => {
  let n = 0; const uid = () => `b${n++}`;
  it('Show and Tell builds 3 linked machines with I and it filled in', () => {
    const lines = makeBlueprint('show-and-tell', uid);
    expect(lines.length).toBe(3);
    expect(lines[0].items.some((i) => i.kind === 'R' && i.word === 'I')).toBe(true);
    expect(lines[1].items.some((i) => i.kind === 'R' && i.word === 'it')).toBe(true);
  });
  it('the Silly Recipe is 4 command steps with time order words', () => {
    const steps = makeScienceJob('recipe', uid);
    expect(steps.map((s) => s.connector)).toEqual(['First', 'Next', 'Then', 'Finally']);
    steps.forEach((s) => expect(s.items.some((i) => i.kind === 'command')).toBe(true));
    expect(steps[0].job.blueprint).toBe('recipe');
  });
});

import { NOUNS, WORD_PACKS, isPackWord, nounByWord } from '../data/wordbank';
import { registerTeacherWord } from '../engine/dictionary';
describe('word packs and teacher words (2026-10-09)', () => {
  it('every pack has words and every pack word is unique', () => {
    // Every interest pack brings nouns; 🎓 Big words is hard how and where words only.
    for (const p of WORD_PACKS.filter((x) => x.id !== 'big')) expect(NOUNS.filter((n) => n.pack === p.id).length, p.id).toBeGreaterThan(4);
    expect(isPackWord('dinos')).toBe(true);
    const words = NOUNS.map((n) => n.word);
    expect(new Set(words).size).toBe(words.length);
  });
  it('a teacher word joins with its picture and its plural', () => {
    registerTeacherWord({ pos: 'N', word: 'axolotl', emoji: '🦎', plural: 'axolotls' });
    expect(nounByWord.get('axolotl')?.emoji).toBe('🦎');
    expect(nounByWord.get('axolotls')?.plural).toBe(true);
  });
});

import { runSentence } from '../engine/pipeline';
describe('Pixel TV "with" (2026-10-09)', () => {
  it('a living thing after "with" walks along in the same beat', () => {
    const r = runSentence({ tokens: [{ pos: 'A', word: 'the' }, { pos: 'N', word: 'dog' }, { pos: 'V', word: 'walk' }, { pos: 'P', word: 'with' }, { pos: 'A', word: 'the' }, { pos: 'N', word: 'cat' }], tense: 'past', level: 'full' });
    const scene = r.script?.scenes[0];
    expect(scene).toBeTruthy();
    const act = scene!.beats.find((b) => b.do === 'walk' || b.do === 'run');
    expect(act?.who.length).toBe(2);
    expect(scene!.props.length).toBe(0);
  });
});

import { CHECKUP } from '../data/checkup';
describe("Gus's Checkup", () => {
  it('ten skills, one right answer each, no em dashes', () => {
    expect(CHECKUP.length).toBe(10);
    expect(new Set(CHECKUP.map((c) => c.skill)).size).toBe(10);
    for (const c of CHECKUP) { expect(c.wrong).not.toContain(c.right); expect(JSON.stringify(c)).not.toMatch(/—/); }
  });
});
