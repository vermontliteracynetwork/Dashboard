import type { Event, RubricResult, SemanticFrame } from '../engine/types';
import type { CastMember, Resolution } from './cast';
import { ADVERB_FX, ADVERB_SPEED, CLIP_BASE_SECONDS, clipFor, pathFor, type PathKind } from './clips';
import { adjByWord, nounByWord, verbByBase } from '../data/wordbank';

// Sentence-to-video director (plan section 5). Pure and deterministic:
// frame + cast in, a small JSON scene script out. Only 3-star sentences
// get a script (plan 3.18.7); nothing else can produce a video.

export interface Look {
  color?: string; pattern?: 'striped' | 'spotted'; scale: number; wide: boolean;
  mood?: string; extras: string[];
}
export interface Beat {
  t: number; dur: number; do: string; who: string[];
  target?: string; path?: PathKind; speed: number; fx: string[]; tags: string[];
  word?: string; sprout?: boolean; x0?: number; x1?: number; optional?: boolean;
}
export interface Scene {
  id: string; tense: 'past' | 'present' | 'future'; caption: string;
  shout?: string; props: { castId: string; x: number }[];
  start: Record<string, { x: number; facing: 1 | -1 }>;
  beats: Beat[]; duration: number; joinIcon?: 'but' | 'for' | 'or';
}
export interface SceneScript {
  version: 1; cast: CastMember[]; looks: Record<string, Look>; scenes: Scene[];
  timing: { curtainsOpen: number; scene: number; curtainsClose: number; stamp: number; total: number };
}

export const CURTAIN_SECONDS = 0.9;
export const STAMP_SECONDS = 0.6;
export const SCENE_BUDGET = 7.6;
const ENTER = 0.6; const SETTLE = 0.5; const SHOUT = 0.8;

const SIZE_SCALE: Record<string, number> = { tiny: 0.6, small: 0.75, big: 1.5, great: 1.35, chubby: 1, plump: 1 };

export function lookFor(m: CastMember): Look {
  const look: Look = { scale: 1, wide: false, extras: [] };
  const base = nounByWord.get(m.noun)?.size;
  if (base === 'small') look.scale = 0.8; else if (base === 'big') look.scale = 1.25;
  for (const a of m.adjectives) {
    const kind = adjByWord.get(a)?.kind;
    if (kind === 'size') { look.scale *= SIZE_SCALE[a] ?? 1; if (a === 'chubby' || a === 'plump') look.wide = true; }
    else if (kind === 'color') { if (a === 'striped' || a === 'spotted') look.pattern = a; else look.color = a; }
    else if (kind === 'feeling') look.mood = a;
    else look.extras.push(a);
  }
  return look;
}

const STAGE_LEFT = 28; const STAGE_CENTER = 90; const STAGE_RIGHT = 132;

function eventBeats(ev: Event, res: Resolution, castById: Map<string, CastMember>, start: Scene['start'], props: Scene['props']): Beat[] {
  const beats: Beat[] = [];
  const subj = res.refs[ev.subject.id] ?? [];
  const lead = castById.get(subj[0]);
  for (let cur: Event | undefined = ev; cur; cur = cur.join?.next) {
    const verb = verbByBase.get(cur.verb);
    const base = verb?.clip ?? 'wiggle';
    const clip = clipFor(base, lead?.rig ?? 'object');
    const speed = cur.adverbs.reduce((s, a) => s * (ADVERB_SPEED[a] ?? 1), 1);
    const fx = cur.adverbs.flatMap((a) => ADVERB_FX[a] ?? []);
    const tags = cur.adverbs.filter((a) => !(ADVERB_FX[a]?.length));
    const obj = cur.object ? res.refs[cur.object.id]?.[0] : undefined;
    const place = cur.places[0];
    const ground = place ? res.refs[place.ground.id]?.[0] : undefined;
    const path = place ? pathFor(place.prep) : 'none';
    const target = obj ?? ground;
    const tx = target ? (start[target]?.x ?? props.find((p) => p.castId === target)?.x ?? STAGE_CENTER) : undefined;
    const x0 = start[subj[0]]?.x ?? STAGE_LEFT;
    let x1 = x0;
    if (['run', 'walk', 'chase', 'swim', 'fly', 'slide'].includes(base)) {
      x1 = tx === undefined ? STAGE_RIGHT : path === 'to' || base === 'chase' ? tx - 14 : path === 'none' ? tx - 14 : tx + 26;
    } else if (base === 'jump') {
      x1 = tx !== undefined && path !== 'none' && path !== 'to' ? tx + 22 : x0;
    } else if (base === 'pounce' || base === 'hug' || base === 'kick') {
      x1 = tx !== undefined ? tx - 12 : x0 + 20;
    }
    beats.push({
      t: 0, dur: (CLIP_BASE_SECONDS[clip.do] ?? 1.6) / speed, do: clip.do, who: subj, target,
      path, speed, fx, tags, sprout: clip.sprout, x0, x1,
      ...(clip.fallback ? { word: `${cur.verb}!` } : {}),
    });
    if (start[subj[0]]) start[subj[0]] = { ...start[subj[0]], x: x1 };
    if (cur.join && cur.join.word === 'or') beats[beats.length - 1].fx.push('or');
  }
  return beats;
}

// The director (plan 5.7): frame + cast -> script. Returns null unless the
// rubric allows a video.
export function direct(frame: SemanticFrame, res: Resolution, rubric: RubricResult, opts: { sentenceId: string; caption: string; seed?: number }): SceneScript | null {
  if (!rubric.producible) return null;
  const castById = new Map(res.castAfter.map((m) => [m.id, m]));
  const used = new Set<string>(Object.values(res.refs).flat());
  const cast = res.castAfter.filter((m) => used.has(m.id));
  const looks: Record<string, Look> = {};
  for (const m of cast) looks[m.id] = lookFor(m);

  // Who stands where: subjects on the left, everyone else to the right,
  // scenery props in the middle.
  const start: Scene['start'] = {};
  const props: Scene['props'] = [];
  const subjects = frame.events.flatMap((e) => res.refs[e.subject.id] ?? []);
  let leftX = STAGE_LEFT; let rightX = STAGE_CENTER + 18;
  for (const id of subjects) if (!start[id]) { start[id] = { x: leftX, facing: 1 }; leftX += 16; }
  for (const ev of frame.events) {
    for (let cur: Event | undefined = ev; cur; cur = cur.join?.next) {
      for (const pl of cur.places) {
        const id = res.refs[pl.ground.id]?.[0];
        if (id && !start[id] && !props.some((p) => p.castId === id)) props.push({ castId: id, x: STAGE_CENTER });
      }
      const oid = cur.object ? res.refs[cur.object.id]?.[0] : undefined;
      if (oid && !start[oid]) { start[oid] = { x: rightX, facing: -1 }; rightX += 16; }
    }
  }
  const startCopy: Scene['start'] = JSON.parse(JSON.stringify(start));

  const beats: Beat[] = [];
  let t = 0;
  if (frame.shout) { beats.push({ t, dur: SHOUT, do: 'shout', who: subjects.slice(0, 1), speed: 1, fx: [], tags: [], word: `${frame.shout}!` }); t += SHOUT; }
  beats.push({ t, dur: ENTER, do: 'enter', who: Object.keys(start), speed: 1, fx: [], tags: [], optional: true });
  t += ENTER;
  frame.events.forEach((ev, k) => {
    const evBeats = eventBeats(ev, res, castById, start, props);
    for (const b of evBeats) { b.t = t; beats.push(b); t += b.dur; }
    if (k === 0 && frame.events.length > 1 && frame.clauseJoin && frame.clauseJoin !== 'and') beats[beats.length - 1].fx.push(frame.clauseJoin);
  });
  beats.push({ t, dur: SETTLE, do: 'settle', who: [], speed: 1, fx: [], tags: [], optional: true });
  t += SETTLE;

  const scene: Scene = {
    id: opts.sentenceId, tense: frame.events[0]?.tense ?? 'present', caption: opts.caption,
    ...(frame.shout ? { shout: frame.shout } : {}), props, start: startCopy, beats, duration: t,
    ...(frame.clauseJoin === 'but' || frame.clauseJoin === 'for' ? { joinIcon: frame.clauseJoin } : {}),
  };
  fitBudget(scene, SCENE_BUDGET);
  return {
    version: 1, cast, looks, scenes: [scene],
    timing: { curtainsOpen: CURTAIN_SECONDS, scene: scene.duration, curtainsClose: CURTAIN_SECONDS, stamp: STAMP_SECONDS, total: CURTAIN_SECONDS + scene.duration + CURTAIN_SECONDS + STAMP_SECONDS },
  };
}

// Ten-second budget (plan 3.17.1): if the scene runs long, (1) raise the
// tempo up to 1.6x, (2) shorten holds and entrances, (3) drop optional
// effects, (4) finally scale everything to fit. Relative speeds (slowly is
// still slower than quickly) are kept because beats scale together.
export function fitBudget(scene: Scene, budget: number): Scene {
  const total = () => scene.beats.reduce((m, b) => Math.max(m, b.t + b.dur), 0);
  const retime = (factor: number) => { for (const b of scene.beats) { b.t /= factor; b.dur /= factor; } };
  let raw = total();
  if (raw > budget) {
    retime(Math.min(1.6, raw / budget));
    raw = total();
  }
  if (raw > budget) {
    for (const b of scene.beats) if (b.optional) b.dur = Math.min(b.dur, 0.25);
    let t = 0; for (const b of scene.beats) { b.t = t; t += b.dur; }
    raw = total();
  }
  if (raw > budget) {
    for (const b of scene.beats) b.fx = b.fx.filter((f) => f === 'or' || f === 'but' || f === 'for');
    retime(raw / budget);
  }
  scene.duration = Math.min(budget, total());
  return scene;
}
