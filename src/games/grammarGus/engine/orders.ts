import type { Pos, SemanticFrame, EntityRef, Tense } from './types';
import type { Run } from './pipeline';
import { fillLine, type BuildLine, type FilledLine } from './framework';
import { pick, type Rng } from './rng';
import { nounByWord, verbByBase } from '../data/wordbank';
import { ADVERB_FX, ADVERB_SPEED, pathFor, type PathKind } from '../director/clips';

// Gus's Orders (plan 3.8): an optional goal mode. Gus posts a scene and the
// student builds ANY sentence that makes the same scene. Scenes are
// compared, not words: "a" or "the", "over" or "above", "cook" or "bake"
// all count. No timer, no limit, no failing; the hint names one thing
// that is still different.

interface NP { noun: string; adjs: string[] }
export interface SceneKey {
  who?: NP; act: string; verb: string; obj?: NP;
  where?: { path: PathKind; prep: string; ground: NP };
  how?: { word: string; feel: string }; tense: Tense; extra: boolean;
}
export interface Order { text: string; filled: FilledLine; key: SceneKey }

const ORDER_SHAPES = ['A J N V', 'A N V D', 'A J N V D', 'A N V P A N', 'A J N V P A N', 'A N V A N', 'A J N V A J N', 'A J J N V', 'A N V A N D', 'A J N V D P A N'];

const np = (e?: EntityRef): NP | undefined => (e ? { noun: e.pronoun ? `(${e.pronoun})` : e.noun, adjs: [...e.adjectives].sort() } : undefined);
// How an adverb looks on screen: its effects and a speed bucket.
const feelOf = (a: string) => {
  const sp = ADVERB_SPEED[a] ?? 1;
  return `${sp > 1.2 ? 'fast' : sp < 0.7 ? 'slow' : sp < 1 ? 'soft' : 'normal'}|${(ADVERB_FX[a] ?? []).join(',')}`;
};

export function sceneKey(frame: SemanticFrame): SceneKey {
  const ev = frame.events[0];
  const pl = ev.places[0];
  return {
    who: np(ev.subject), act: verbByBase.get(ev.verb)?.clip ?? ev.verb, verb: ev.verb, obj: np(ev.object),
    where: pl ? { path: pathFor(pl.prep), prep: pl.prep, ground: np(pl.ground)! } : undefined,
    how: ev.adverbs[0] ? { word: ev.adverbs[0], feel: feelOf(ev.adverbs[0]) } : undefined,
    tense: ev.tense, extra: frame.events.length > 1 || !!ev.join || ev.places.length > 1 || ev.adverbs.length > 1,
  };
}

export function makeOrder(rng: Rng, o: { gentleOnly?: boolean } = {}): Order {
  for (;;) {
    const shape = pick(rng, ORDER_SHAPES).split(' ') as Pos[];
    const line: BuildLine = { id: 'order', kind: 'build', label: 'Order', shapes: [shape] };
    const tense = pick(rng, ['past', 'present', 'future'] as Tense[]);
    const filled = fillLine(line, rng, { tense, gentleOnly: o.gentleOnly, tries: 300 });
    if (filled?.run.frame) return { text: filled.run.composed.text, filled, key: sceneKey(filled.run.frame) };
  }
}

const an = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');
const TIME_NAMES: Record<Tense, string> = { past: 'Past', present: 'Present', future: 'Future' };
const sameNP = (a?: NP, b?: NP) => !!a && !!b && a.noun === b.noun && a.adjs.join() === b.adjs.join();

// Every difference between the ordered scene and the student's scene, as
// kid-worded hints, most important first. Empty means the order is filled.
export function compareOrder(order: SceneKey, run: Run): string[] {
  if (!run.frame) return ['The machine has to run first. Pull START!'];
  const got = sceneKey(run.frame);
  const out: string[] = [];
  const w = order.who!;
  if (!got.who || got.who.noun !== w.noun) out.push(`I ordered ${an(w.adjs[0] ?? w.noun)} ${[...w.adjs, w.noun].join(' ')}. Who is your sentence about?`);
  else {
    for (const a of w.adjs) if (!got.who.adjs.includes(a)) out.push(`The ${w.noun} is not ${a} yet.`);
    for (const a of got.who.adjs) if (!w.adjs.includes(a)) out.push(`I did not order ${an(a)} ${a} ${w.noun}. Take that describing word off.`);
  }
  if (got.act !== order.act) out.push(`Not the action I ordered. I ordered: ${order.verb}.`);
  if (order.obj && !sameNP(order.obj, got.obj)) out.push(`Something should happen to ${an(order.obj.adjs[0] ?? order.obj.noun)} ${[...order.obj.adjs, order.obj.noun].join(' ')}.`);
  if (!order.obj && got.obj) out.push('My order does not have WHAT IT HAPPENED TO. Take it off.');
  if (order.where && (!got.where || got.where.path !== order.where.path || !sameNP(order.where.ground, got.where.ground))) out.push(`Where? I ordered it ${order.where.prep} the ${[...order.where.ground.adjs, order.where.ground.noun].join(' ')}.`);
  if (!order.where && got.where) out.push('My order has no WHERE. Take it off.');
  if (order.how && got.how?.feel !== order.how.feel) out.push(`How? I ordered it ${order.how.word}.`);
  if (!order.how && got.how) out.push('My order has no HOW word. Take it off.');
  if (got.tense !== order.tense) out.push(`Check the time crank. I ordered ${TIME_NAMES[order.tense]}.`);
  if (got.extra) out.push('Your machine has extra parts my order does not need.');
  return out;
}

// What the order card shows: pictures and words, never the sentence.
export interface OrderCard { who: { emoji: string; words: string }; did: string; obj?: { emoji: string; words: string }; where?: { prep: string; emoji: string; words: string }; how?: string; time: string }
export function orderCard(k: SceneKey): OrderCard {
  const pic = (x: NP) => ({ emoji: nounByWord.get(x.noun)?.emoji ?? '❔', words: [...x.adjs, x.noun].join(' ') });
  return {
    who: pic(k.who!), did: k.verb, ...(k.obj ? { obj: pic(k.obj) } : {}),
    ...(k.where ? { where: { prep: k.where.prep, ...pic(k.where.ground) } } : {}),
    ...(k.how ? { how: k.how.word } : {}), time: TIME_NAMES[k.tense],
  };
}

export const STICKERS = ['🏅', '⚙️', '🎩', '🧪', '🔩', '🚂', '🎺', '🧀', '🌟', '🪄', '🦉', '🐢'];

// The teacher's own recipe cards (Build Queue 2026-10-09: "Orders: a teacher editor for her own
// orders"). She picks the who, the action, and any what, where, how and time; the machine checks the
// scene can really be made and turns it into a card. Returns the reason when it cannot.
export interface OrderPick { who: string; whoAdj?: string; verb: string; obj?: string; prep?: string; ground?: string; how?: string; tense: Tense }
export function orderFromPick(p: OrderPick, run: (tokens: { pos: Pos; word: string }[], tense: Tense) => Run): { key: SceneKey; text: string } | { error: string } {
  const t: { pos: Pos; word: string }[] = [{ pos: 'A', word: 'the' }];
  if (p.whoAdj) t.push({ pos: 'J', word: p.whoAdj });
  t.push({ pos: 'N', word: p.who }, { pos: 'V', word: p.verb });
  if (p.obj) t.push({ pos: 'A', word: 'the' }, { pos: 'N', word: p.obj });
  if (p.how) t.push({ pos: 'D', word: p.how });
  if (p.prep && p.ground) t.push({ pos: 'P', word: p.prep }, { pos: 'A', word: 'the' }, { pos: 'N', word: p.ground });
  const r = run(t, p.tense);
  if (!r.frame) {
    const v = r.validation.violations.find((x) => x.blocking)?.code;
    return { error: v === 'NO_OBJECT' ? 'That action needs a WHAT (kick the ball).' : v === 'EXTRA_OBJECT' ? 'That action cannot have a WHAT. Take it off.' : 'Gus cannot make that scene. Try different words.' };
  }
  return { key: sceneKey(r.frame), text: r.composed.text };
}
