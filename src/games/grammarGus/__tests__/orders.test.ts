import { describe, it, expect } from 'vitest';
import { compareOrder, makeOrder, orderCard, sceneKey } from '../engine/orders';
import { runSentence } from '../engine/pipeline';
import { makeRng } from '../engine/rng';
import { d } from './helpers';

// Gus's Orders (plan 3.8): scenes are compared, not words.
const keyOf = (sym: string, text: string) => sceneKey(runSentence(d(sym, text)).frame!);
const run = (sym: string, text: string) => runSentence(d(sym, text));

describe("Gus's Orders", { timeout: 60000 }, () => {
  it('orders are always 3-star sentences the machine can build', () => {
    const rng = makeRng(9);
    for (let k = 0; k < 40; k++) {
      const o = makeOrder(rng);
      expect(o.filled.run.rubric?.stars).toBe(3);
      expect(compareOrder(o.key, o.filled.run)).toEqual([]);
      expect(orderCard(o.key).who.words).toBeTruthy();
    }
  });
  it('a, the, over, above and cook, bake all make the same scene', () => {
    const order = keyOf('A J N V P A N', 'A big dog jumped over the van.');
    expect(compareOrder(order, run('A J N V P A N', 'The big dog jumped above a van.'))).toEqual([]);
    const cook = keyOf('A N V A N', 'The cat cooked the apple.');
    expect(compareOrder(cook, run('A N V A N', 'A cat baked an apple.'))).toEqual([]);
  });
  it('the hint names what is still different', () => {
    const order = keyOf('A J N V P A N', 'A big dog jumped over the van.');
    expect(compareOrder(order, run('A N V P A N', 'A dog jumped over the van.'))[0]).toContain('not big yet');
    expect(compareOrder(order, run('A J N V P A N', 'A big dog jumped under the van.'))[0]).toContain('over the van');
    expect(compareOrder(order, run('A J N V P A N', 'A big dog jumps over the van.'))[0]).toContain('Yesterday');
    expect(compareOrder(order, run('A J N V P A N', 'A big cat jumped over the van.'))[0]).toContain('big dog');
  });
});
