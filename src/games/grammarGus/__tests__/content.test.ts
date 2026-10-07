import { describe, it, expect } from 'vitest';
import { NOUNS, VERBS } from '../data/wordbank';
import { clipFor } from '../director/clips';
import { spriteFor } from '../render/rigs';
import { FB, T } from '../render/fb';
import { drawText } from '../render/font';
import type { CastMember } from '../director/cast';

// Pixel content pass (plan 6, milestone 7).
const member = (noun: string): CastMember => {
  const e = NOUNS.find((x) => x.word === noun)!;
  return { id: 'c1', noun, adjectives: [], plural: false, count: 1, kind: e.kind, rig: e.rig, introducedIn: 's1', label: noun };
};

describe('pixel content pass', () => {
  it('every word list noun has its own drawing, never a blank sprite', () => {
    for (const n of NOUNS) for (let frame = 0; frame < 4; frame++) {
      const spr = spriteFor(member(n.word), { scale: 1, wide: false, extras: [] }, { frame, squash: 0 });
      expect(spr.px.some((c) => c !== T)).toBe(true);
    }
  });
  it('every verb plays its real clip for animals and people (no fallback wiggle)', () => {
    for (const v of VERBS) for (const rig of ['biped', 'quadruped', 'critter', 'bird', 'serpent'] as const) {
      expect(clipFor(v.clip, rig).fallback).toBe(false);
    }
  });
  it('things without legs sprout legs to walk, and can still sing, fall and spin', () => {
    expect(clipFor('walk', 'object')).toMatchObject({ sprout: true, fallback: false });
    for (const c of ['sing', 'fall', 'spin', 'melt', 'break']) expect(clipFor(c, 'object').sprout).toBe(false);
  });
  it('the pixel font has lower case letters', () => {
    const a = new FB(), b = new FB();
    drawText(a, 'cat', 10, 10); drawText(b, 'CAT', 10, 10);
    expect(a.hash()).not.toBe(b.hash());
  });
});
