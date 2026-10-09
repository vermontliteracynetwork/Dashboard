import { describe, it, expect } from 'vitest';
import { PERIODIC } from '../elements';
import { RECIPES, STARTER, SUB, SUBSTANCES, pour } from '../lab';

describe('Science Lab', () => {
  it('has all 118 elements in unique spots', () => {
    expect(PERIODIC.length).toBe(118);
    expect(new Set(PERIODIC.map((e) => `${e.row}-${e.col}`)).size).toBe(118);
    expect(PERIODIC.find((e) => e.sym === 'Og')).toMatchObject({ n: 118, row: 7, col: 18 });
  });
  it('every recipe uses and makes real substances, and everything can be reached', () => {
    for (const r of RECIPES) [...r.needs, ...r.makes, ...r.unlocks].forEach((id) => expect(SUB.get(id), `${r.id}: ${id}`).toBeTruthy());
    // Walk the unlock ladder from the starter shelf.
    const have = new Set(STARTER);
    const made = new Set<string>();
    for (let pass = 0; pass < 20; pass++) for (const r of RECIPES) {
      if (r.needs.every((n) => have.has(n) || made.has(n))) { r.unlocks.forEach((u) => have.add(u)); r.makes.forEach((m) => made.add(m)); }
    }
    for (const r of RECIPES) expect(r.needs.every((n) => have.has(n) || made.has(n)), r.id).toBe(true);
    const shelf = SUBSTANCES.filter((s) => RECIPES.some((r) => r.unlocks.includes(s.id)));
    shelf.forEach((s) => expect(have.has(s.id), s.id).toBe(true));
  });
  it('sodium and water explode and empty the beaker', () => {
    const r = pour(['water'], 'Na');
    expect(r.reaction?.effect).toBe('boom');
    expect(r.contents).toEqual([]);
  });
  it('the biggest recipe wins', () => {
    expect(pour(['peroxide', 'soap'], 'yeast').reaction?.id).toBe('toothpastebig');
    expect(pour(['peroxide'], 'yeast').reaction?.id).toBe('toothpaste');
  });
  it('water and salt dissolve; helium does nothing', () => {
    expect(pour(['water'], 'salt').contents).toEqual(['saltwater']);
    const he = pour(['water'], 'He');
    expect(he.reaction).toBeNull();
    expect(he.noble).toBe(true);
  });
  it('no em dashes in student text', () => {
    const text = JSON.stringify([SUBSTANCES, RECIPES]);
    expect(text).not.toMatch(/—/);
  });
});
