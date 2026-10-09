import { describe, it, expect } from 'vitest';
import { runSentence } from '../engine/pipeline';
import { d } from './helpers';

// Audit leftover (2026-10-09): a -self word matches its WHO.
const codes = (sym: string, text: string) => runSentence(d(sym, text)).validation.violations.map((v) => v.code);

describe('reflexive pronouns match the WHO', () => {
  it('he ... himself and they ... themselves are fine', () => {
    expect(codes('R V R', 'He ate himself.')).not.toContain('REFLEXIVE_MATCH');
    expect(codes('R V R', 'They ate themselves.')).not.toContain('REFLEXIVE_MATCH');
    expect(codes('A N V R', 'The cat ate itself.')).not.toContain('REFLEXIVE_MATCH');
  });
  it('he ... herself and the children ... itself are caught', () => {
    expect(codes('R V R', 'He ate herself.')).toContain('REFLEXIVE_MATCH');
    expect(codes('A N V R', 'The children ate itself.')).toContain('REFLEXIVE_MATCH');
    expect(codes('A N V R', 'The cat ate myself.')).toContain('REFLEXIVE_MATCH');
  });
});

import { describingOutOfOrder } from '../engine/gadgets';
describe('the Describe Sorter lamp', () => {
  it('is red for "the white small cat" and green for "the small white cat"', () => {
    expect(describingOutOfOrder(d('A J J N V', 'The white small cat ran.').tokens)).toBe(true);
    expect(describingOutOfOrder(d('A J J N V', 'The small white cat ran.').tokens)).toBe(false);
  });
});
