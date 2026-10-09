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
