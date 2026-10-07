import { describe, it, expect } from 'vitest';
import { makeLevel, newRunner, step, respawn, safeForBreak, U, GROUND_Y, type Level, type Runner } from './engine';

// A simple robot player: jumps when something is just ahead. If it can
// finish every level, the levels are fair (Shape Dash, teacher 2026-10-07).
function botRun(lv: Level, maxCrashes = 0) {
  const r: Runner = newRunner();
  let crashes = 0; let finished = false; let coins = 0;
  for (let i = 0; i < 60 * 240 && !finished; i++) {
    const ahead = lv.things.find((t) => (t.kind === 'spike' || t.kind === 'gap' || t.kind === 'block') && t.x > r.x + U * 0.5 && t.x < r.x + U * 0.5 + lv.speed * 0.2);
    const block = ahead?.kind === 'block' && ahead.y < r.y + U - 4; // something taller than where we stand
    const jump = !!ahead && (ahead.kind !== 'block' || block);
    for (const e of step(r, lv, 1 / 60, jump)) {
      if (e.kind === 'crash') { crashes++; respawn(r, lv, false); if (crashes > maxCrashes) return { finished, crashes, coins }; }
      if (e.kind === 'coin') coins++;
      if (e.kind === 'finish') finished = true;
    }
  }
  return { finished, crashes, coins };
}

describe('Shape Dash', () => {
  it('levels get faster and longer', () => {
    const a = makeLevel(1), b = makeLevel(5);
    expect(b.speed).toBeGreaterThan(a.speed);
    expect(b.length).toBeGreaterThan(a.length);
    expect(a.things.some((t) => t.kind === 'finish')).toBe(true);
    expect(a.things.some((t) => t.kind === 'checkpoint')).toBe(true);
  });
  it('a level is the same every time it is played', () => {
    expect(JSON.stringify(makeLevel(3).things)).toBe(JSON.stringify(makeLevel(3).things));
  });
  it('every level can be finished (a robot player clears levels 1 to 8 with a few tries)', () => {
    for (let n = 1; n <= 8; n++) expect(botRun(makeLevel(n), 6).finished).toBe(true);
  });
  it('the player stands on the ground and a tap jumps', () => {
    const lv = makeLevel(1); const r = newRunner();
    step(r, lv, 1 / 60, false);
    expect(r.grounded).toBe(true);
    expect(r.y).toBe(GROUND_Y - U);
    const ev = step(r, lv, 1 / 60, true);
    expect(ev.some((e) => e.kind === 'jump')).toBe(true);
    expect(r.vy).toBeLessThan(0);
  });
  it('running into a spike is a crash, and a shield saves you once', () => {
    const lv: Level = { n: 1, speed: 300, length: 3000, hue: 0, things: [{ kind: 'spike', x: 400, y: GROUND_Y - U, w: U, h: U, id: 1 }] };
    let r = newRunner(300); let crashed = false;
    for (let i = 0; i < 120 && !crashed; i++) crashed = step(r, lv, 1 / 60, false).some((e) => e.kind === 'crash');
    expect(crashed).toBe(true);
    r = newRunner(300); respawn(r, lv, true); r.x = 300;
    let saved = false; crashed = false;
    for (let i = 0; i < 120; i++) { const ev = step(r, lv, 1 / 60, false); saved ||= ev.some((e) => e.kind === 'saved'); crashed ||= ev.some((e) => e.kind === 'crash'); }
    expect(saved).toBe(true);
    expect(crashed).toBe(false);
  });
  it('question breaks only come when the way ahead is clear', () => {
    const lv: Level = { n: 1, speed: 300, length: 3000, hue: 0, things: [{ kind: 'spike', x: 500, y: GROUND_Y - U, w: U, h: U, id: 1 }] };
    expect(safeForBreak(newRunner(300), lv)).toBe(false);
    expect(safeForBreak(newRunner(1000), lv)).toBe(true);
  });
});
