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
