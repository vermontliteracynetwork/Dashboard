// Creaturemon battle rules as plain functions (Build Queue 735), shared by battles with a classmate: one move, its
// type, the right answer fuel, guard and the abilities from 732. The computer battles (Battle.tsx) follow the same
// numbers.
import { abName, abv, line, statsAt, form, typeMult, type AbilityId, type CType } from './data';

export interface BF { name: string; formId: string; level: number; type: CType; hp: number; max: number; atk: number; def: number; spd: number; guard: boolean; berry: boolean; abs: AbilityId[]; uid?: string }
export type MoveId = 'tackle' | 'special' | 'guard' | 'berry';
export function makeBF(formId: string, level: number, name: string, abs: AbilityId[] = [], uid?: string): BF {
  const s = statsAt(form(formId), level); const max = Math.round(s.hp * 1.5);
  return { name, formId, level, type: line(formId).type, hp: max, max, atk: s.atk, def: s.def, spd: s.spd, guard: false, berry: true, abs, uid };
}
const has = (f: BF, a: AbilityId) => f.abs.includes(a);
const stg = (f: BF) => form(f.formId).stage;
export const moveName = (f: BF, m: MoveId) => (m === 'special' ? line(f.formId).special.name : m === 'tackle' ? 'Tackle' : m === 'guard' ? 'Guard' : 'Berry snack');
export interface MoveOut { a: BF; d: BF; text: string; hit: boolean; dmg: number; fx: string }
export function resolveMove(a0: BF, d: BF, m: MoveId, foc: number): MoveOut {
  const a = { ...a0, guard: false };
  if (m === 'guard') return { a: { ...a, guard: true, hp: Math.min(a.max, a.hp + Math.round(a.max * 0.06)) }, d, text: `${a.name} uses Guard! It gets ready to block.`, hit: false, dmg: 0, fx: 'guard' };
  if (m === 'berry') return { a: { ...a, berry: false, hp: Math.min(a.max, a.hp + Math.round(a.max * (has(a, 'snacky') ? abv('snacky', stg(a)) : 0.4))) }, d, text: `${a.name} eats a berry and gets health back!`, hit: false, dmg: 0, fx: 'heal' };
  const special = m === 'special';
  if (Math.random() > (special ? 0.88 : 0.96) - (has(d, 'speedy') ? abv('speedy', stg(d)) : 0)) return { a, d: { ...d, guard: false }, text: `${a.name} uses ${moveName(a, m)}, but ${d.name} dodges!`, hit: false, dmg: 0, fx: '' };
  const mult = special ? typeMult(a.type, d.type) : 1;
  let dmg = (special ? 1.45 : 1) * a.atk * mult * (0.75 + 0.5 * foc) * (9 / (d.def + 9)) * (0.85 + Math.random() * 0.3) * 1.3;
  const notes: string[] = [];
  if (has(a, 'brave') && a.hp < a.max / 2) { dmg *= abv('brave', stg(a)); notes.push(`${a.name} is ${abName('brave', stg(a))}!`); }
  // Build Queue 737 (her words: "increase their offensive abilities with low health"): every creature hits harder as its
  // hearts run low, 20% under half and 45% under a quarter (Brave adds more on top).
  const low = a.hp < a.max * 0.25 ? 1.45 : a.hp < a.max * 0.5 ? 1.2 : 1;
  if (low > 1) { dmg *= low; notes.push(`${a.name} fights back harder!`); }
  if (has(a, 'focused') && foc >= 1) dmg *= abv('focused', stg(a));
  if (has(d, 'tough')) dmg *= abv('tough', stg(d));
  if (d.guard) dmg *= has(d, 'zen') ? abv('zen', stg(d)) : 0.45;
  let n = Math.max(1, Math.round(dmg));
  if (has(a, 'lucky') && Math.random() < abv('lucky', stg(a))) { n *= 2; notes.push('A lucky double hit!'); }
  let na = a;
  if (has(d, 'spiky')) { const poke = Math.max(1, Math.ceil(n * abv('spiky', stg(d)))); na = { ...a, hp: Math.max(1, a.hp - poke) }; notes.push(`Ouch, ${abName('spiky', stg(d))}! ${a.name} gets poked and loses ${poke}.`); }
  const extra = mult > 1 ? ' It is super strong!' : mult < 1 ? ' It is not very strong.' : '';
  return { a: na, d: { ...d, hp: Math.max(0, d.hp - n), guard: false }, text: `${a.name} uses ${moveName(a, m)}!${extra} ${d.name} loses ${n} health.${notes.length ? ` ${notes.join(' ')}` : ''}`, hit: true, dmg: n, fx: special ? a.type.toLowerCase() : 'stone' };
}
// Lazy: a tired creature sometimes naps after its move.
export function nap(f: BF): { f: BF; text?: string } {
  if (!has(f, 'lazy') || f.hp >= f.max * 0.6 || f.hp <= 0 || Math.random() > abv('lazyChance', stg(f))) return { f };
  return { f: { ...f, hp: Math.min(f.max, f.hp + Math.round(f.max * abv('lazyHeal', stg(f)))) }, text: `${f.name} is ${abName('lazy', stg(f))} and takes a quick nap. Zzz. It gets health back!` };
}
