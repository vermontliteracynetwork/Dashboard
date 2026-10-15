import { describe, it, expect } from 'vitest';
import { PERIODIC } from '../elements';
import { HEAT_RECIPES, KITCHEN, RECIPES, STARTER, SUB, SUBSTANCES, heatUp, pour } from '../lab';
import { whyNothing } from '../elementLab';

describe('Science Lab', () => {
  it('has all 118 elements in unique spots', () => {
    expect(PERIODIC.length).toBe(118);
    expect(new Set(PERIODIC.map((e) => `${e.row}-${e.col}`)).size).toBe(118);
    expect(PERIODIC.find((e) => e.sym === 'Og')).toMatchObject({ n: 118, row: 7, col: 18 });
  });
  it('every recipe uses and makes real substances, and every element has a bottle', () => {
    for (const r of [...RECIPES, ...HEAT_RECIPES]) [...r.needs, ...r.makes].forEach((id) => expect(id === 'heat' || id.startsWith('@') || SUB.get(id), `${r.id}: ${id}`).toBeTruthy());
    PERIODIC.forEach((e) => expect(SUB.get(e.sym)?.element, e.sym).toBe(e.sym));
    KITCHEN.forEach((id) => expect(SUB.get(id), id).toBeTruthy());
    expect(STARTER.every((id) => SUB.has(id))).toBe(true);
    expect(new Set([...RECIPES, ...HEAT_RECIPES].map((r) => r.id)).size).toBe(RECIPES.length + HEAT_RECIPES.length);
  });
  it('real chemistry rules', () => {
    expect(pour(['vinegar'], 'K').reaction?.effect).toBe('bigboom'); // alkali metals react with anything watery
    expect(pour(['water'], 'Cs').reaction?.id).toBe('w-Cs');
    expect(pour(['hcl'], 'Zn').reaction?.id).toBe('a-Zn');
    expect(pour(['hcl'], 'Cu').reaction).toBeNull(); // copper is below hydrogen
    expect(whyNothing(['hcl', 'Cu'])).toMatch(/below hydrogen/);
    expect(pour(['bluewater'], 'Zn').reaction?.id).toBe('cu-Zn');
    expect(pour(['bluewater'], 'Al').reaction).toBeNull(); // the oxide coat protects aluminum
    expect(pour(['bluewater', 'Al'], 'salt').reaction?.id).toBe('alcopper');
    expect(pour(['silvernitrate'], 'Cu').reaction?.id).toBe('ag-Cu');
    expect(pour(['H'], 'O').reaction).toBeNull(); // needs a spark
    expect(heatUp(['H', 'O']).reaction?.id).toBe('makewater');
    expect(heatUp(['Mg', 'O']).reaction?.id).toBe('mgburn');
    expect(pour(['U'], 'water').reaction).toBeNull();
    expect(pour(['water'], 'U').radioactive).toBe('U');
    expect(pour(['water'], 'Ne').noble).toBe(true);
    expect(pour(['water'], 'I').contents).toEqual(['iodinewater']);
    expect(pour(['iodinewater'], 'starch').reaction?.id).toBe('starchtest');
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

import { atomInfo } from '../AtomBuilder';
describe('burner and Atom Builder', () => {
  it('heating salt water leaves salt crystals; heating oil does nothing', () => {
    expect(heatUp(['saltwater']).contents).toEqual(['saltcrystals']);
    expect(heatUp(['oil']).reaction).toBeNull();
    HEAT_RECIPES.forEach((r) => expect(r.needs).toContain('heat'));
  });
  it('protons decide the element, electrons the charge', () => {
    expect(atomInfo(6, 6, 6)).toMatchObject({ charge: 0, mass: 12, stable: true });
    expect(atomInfo(6, 6, 6).el?.name).toBe('Carbon');
    expect(atomInfo(11, 12, 10).charge).toBe(1);
    expect(atomInfo(6, 2, 6).stable).toBe(false);
  });
  it('colors and dyes change color only by real rules (Build Queue 212)', () => {
    expect(pour(['bluedye'], 'yellowdye').reaction?.id).toBe('mixgreen');
    expect(pour(['reddye'], 'bleach').contents).toEqual(['faded']);
    expect(pour(['greendye'], 'bleach').reaction?.id).toBe('bleachdye');
    expect(pour(['bleach'], 'vinegar').reaction?.id).toBe('bleachacid');
    expect(pour(['turmeric'], 'bakingsoda').reaction?.id).toBe('turmericbase');
    expect(pour(['turmeric'], 'soap').reaction?.id).toBe('turmericbase');
    expect(pour(['turmeric'], 'vinegar').reaction).toBeNull();
    expect(whyNothing(['turmeric', 'vinegar'])).toMatch(/stays yellow/);
    expect(pour(['butterflypea'], 'lemon').reaction?.id).toBe('peaacid');
    expect(pour(['butterflypea'], 'bakingsoda').reaction?.id).toBe('peabase');
    expect(pour(['phenol'], 'bakingsoda').reaction).toBeNull(); // too weak a base
    expect(pour(['phenol'], 'limewater').reaction?.id).toBe('phenolpink');
    expect(pour(['phenolpink'], 'vinegar').reaction?.id).toBe('phenolclear');
    expect(pour(['milk', 'reddye'], 'soap').reaction?.id).toBe('magicmilk');
    expect(pour(['milk'], 'lemon').reaction?.id).toBe('curds');
  });
});
