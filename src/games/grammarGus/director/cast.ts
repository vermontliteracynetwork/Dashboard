import type { EntityRef, SemanticFrame } from '../engine/types';
import { nounByWord, type Rig, type NounKind } from '../data/wordbank';

// Cast and reference resolution (plan 5.3): how a paragraph keeps its
// story. "a" brings in someone new, "the" points to someone already on
// stage who matches, pronouns point to the most recent match.

export interface CastMember {
  id: string; noun: string; adjectives: string[]; plural: boolean; count: number;
  kind: NounKind; rig: Rig; introducedIn: string; label: string;
  isAvatar?: boolean; isViewer?: boolean; isDefault?: boolean;
}

export interface Resolution {
  refs: Record<string, string[]>; // entity id -> cast ids
  castAfter: CastMember[];
  ambiguous: string[]; // entity ids where "the X" matched two or more
  sameTwice: string[]; // compound subjects naming one member twice
}

const memberFor = (e: EntityRef, id: string, sentenceId: string): CastMember => {
  const entry = nounByWord.get(e.noun);
  return {
    id, noun: e.noun, adjectives: [...e.adjectives], plural: e.plural, count: entry?.group ?? (e.plural ? 3 : 1),
    kind: entry?.kind ?? 'thing', rig: entry?.rig ?? 'object', introducedIn: sentenceId,
    label: [...e.adjectives, e.noun].join(' '),
  };
};

export function resolveCast(frame: SemanticFrame, castBefore: CastMember[], sentenceId: string): Resolution {
  const cast = castBefore.map((m) => ({ ...m }));
  const mentions: string[] = castBefore.map((m) => m.id); // most recent last
  const refs: Record<string, string[]> = {};
  const ambiguous: string[] = [];
  const sameTwice: string[] = [];
  let seq = cast.length;
  const newId = () => `c${++seq}`;
  const mention = (id: string) => { const i = mentions.indexOf(id); if (i >= 0) mentions.splice(i, 1); mentions.push(id); };
  const add = (m: CastMember) => { cast.push(m); mention(m.id); return m.id; };
  const recent = (ok: (m: CastMember) => boolean) => {
    for (let i = mentions.length - 1; i >= 0; i--) { const m = cast.find((c) => c.id === mentions[i])!; if (ok(m)) return m; }
    return undefined;
  };

  const resolveNP = (e: EntityRef, avoid: string[] = []): string[] => {
    if (e.article === 'the') {
      const matches = cast.filter((m) => !m.isAvatar && !m.isViewer && m.noun === e.noun && e.adjectives.every((a) => m.adjectives.includes(a)));
      if (matches.length >= 2) {
        ambiguous.push(e.id);
        // Prefer someone other than the doer: "the cat chased the cat"
        // with two cats on stage means the other cat.
        const pickM = recent((m) => matches.includes(m) && !avoid.includes(m.id)) ?? recent((m) => matches.includes(m))!;
        mention(pickM.id); return [pickM.id];
      }
      if (matches.length === 1) { mention(matches[0].id); return [matches[0].id]; }
    }
    return [add(memberFor(e, newId(), sentenceId))];
  };

  const resolvePronoun = (e: EntityRef, subjectIds: string[]): string[] => {
    if (e.reflexive) return subjectIds;
    switch (e.pronoun) {
      case 'I': {
        const me = cast.find((m) => m.isAvatar) ?? cast[cast.push({ id: 'me', noun: 'me', adjectives: [], plural: false, count: 1, kind: 'human', rig: 'biped', introducedIn: sentenceId, label: 'me', isAvatar: true }) - 1];
        mention(me.id); return [me.id];
      }
      case 'you': {
        const you = cast.find((m) => m.isViewer) ?? cast[cast.push({ id: 'you', noun: 'you', adjectives: [], plural: false, count: 1, kind: 'human', rig: 'biped', introducedIn: sentenceId, label: 'you', isViewer: true }) - 1];
        mention(you.id); return [you.id];
      }
      case 'he': case 'she': {
        const m = recent((c) => !c.plural && !c.isAvatar && !c.isViewer && c.kind !== 'thing');
        if (m) { mention(m.id); return [m.id]; }
        return [add({ id: newId(), noun: 'kid', adjectives: [], plural: false, count: 1, kind: 'human', rig: 'biped', introducedIn: sentenceId, label: e.pronoun, isDefault: true })];
      }
      case 'it': {
        const m = recent((c) => !c.plural && !c.isAvatar && !c.isViewer && c.kind !== 'human');
        if (m) { mention(m.id); return [m.id]; }
        return [add({ id: newId(), noun: 'blob', adjectives: [], plural: false, count: 1, kind: 'thing', rig: 'object', introducedIn: sentenceId, label: 'it', isDefault: true })];
      }
      case 'we': {
        const me = resolvePronoun({ ...e, pronoun: 'I' }, subjectIds)[0];
        const friend = recent((c) => !c.isAvatar && !c.isViewer && c.kind !== 'thing');
        return friend ? [me, friend.id] : [me, add({ id: newId(), noun: 'kid', adjectives: [], plural: false, count: 1, kind: 'human', rig: 'biped', introducedIn: sentenceId, label: 'friend', isDefault: true })];
      }
      default: { // they
        const m = recent((c) => c.plural);
        if (m) { mention(m.id); return [m.id]; }
        return [add({ id: newId(), noun: 'kids', adjectives: [], plural: true, count: 2, kind: 'human', rig: 'biped', introducedIn: sentenceId, label: 'they', isDefault: true })];
      }
    }
  };

  const resolve = (e: EntityRef, subjectIds: string[] = []): string[] => {
    if (refs[e.id]) return refs[e.id];
    if (e.conjoined) {
      const ids: string[] = [];
      for (const part of e.conjoined) {
        const got = resolve(part, subjectIds);
        if (got.some((g) => ids.includes(g))) sameTwice.push(part.id);
        ids.push(...got);
      }
      refs[e.id] = ids; return ids;
    }
    const ids = e.pronoun || e.reflexive ? resolvePronoun(e, subjectIds) : resolveNP(e, subjectIds);
    refs[e.id] = ids; return ids;
  };

  for (const ev of frame.events) {
    const subj = resolve(ev.subject);
    for (let cur: typeof ev | undefined = ev; cur; cur = cur.join?.next) {
      if (cur.object) resolve(cur.object, subj);
      for (const pl of cur.places) resolve(pl.ground, subj);
    }
  }
  return { refs, castAfter: cast, ambiguous, sameTwice };
}
