import type { Draft, SemanticFrame, EntityRef } from './types';
import type { Resolution, CastMember } from '../director/cast';
import type { SceneScript, Look } from '../director/director';
import { CURTAIN_SECONDS, STAMP_SECONDS } from '../director/director';

// Paragraph machines (plan sections 7, 3.14 and 3.18.9). Sealed 3-star
// sentences feed one screen as a story. The cast carries across sentences,
// so "the white cat" in sentence two is the same white cat as in sentence
// one. Pure TypeScript, no UI.

export interface SealedSentence {
  id: string; draft: Draft; text: string; script: SceneScript; frame: SemanticFrame; resolution: Resolution;
}
export const MAX_STORY_SENTENCES = 4; // the plan's MVP; 8 later
export const DISSOLVE_SECONDS = 0.3; // must match render/stage.ts DISSOLVE

export function storyCast(sentences: SealedSentence[]): CastMember[] {
  return sentences.length ? sentences[sentences.length - 1].resolution.castAfter : [];
}

// One script that plays every sealed sentence in order: curtains open once,
// a quick pixel dissolve between scenes, curtains close once (plan 5.5).
export function storyScript(sentences: SealedSentence[]): SceneScript | null {
  if (!sentences.length) return null;
  const cast = new Map<string, CastMember>();
  const looks: Record<string, Look> = {};
  for (const s of sentences) {
    for (const m of s.script.cast) cast.set(m.id, m);
    Object.assign(looks, s.script.looks);
  }
  const scenes = sentences.map((s) => s.script.scenes[0]);
  const body = scenes.reduce((a, sc) => a + sc.duration, 0) + DISSOLVE_SECONDS * (scenes.length - 1);
  return {
    version: 1, cast: [...cast.values()], looks, scenes,
    timing: { curtainsOpen: CURTAIN_SECONDS, scene: body, curtainsClose: CURTAIN_SECONDS, stamp: STAMP_SECONDS, total: CURTAIN_SECONDS + body + CURTAIN_SECONDS + STAMP_SECONDS },
  };
}

// The Story Clipboard and story stars (plan 3.14 and 3.18.9).
export interface StoryReview {
  stars: 0 | 1 | 2 | 3;
  sameTime: boolean; connect: boolean;
  pronounsPoint: boolean; aThenThe: boolean; differentStarters: boolean;
  bonus: number; // bonus stars for gears, up to 3
  tip: string;
}

const entitiesOf = (f: SemanticFrame): EntityRef[] => {
  const out: EntityRef[] = [];
  for (const ev of f.events) for (let cur: typeof ev | undefined = ev; cur; cur = cur.join?.next) {
    out.push(...(cur.subject.conjoined ?? [cur.subject]));
    if (cur.object) out.push(cur.object);
    for (const p of cur.places) out.push(p.ground);
  }
  return out;
};

export function reviewStory(sentences: SealedSentence[], timeChangeOnPurpose = false): StoryReview {
  if (!sentences.length) return { stars: 0, sameTime: true, connect: false, pronounsPoint: true, aThenThe: false, differentStarters: false, bonus: 0, tip: 'Seal a 3-star sentence to start a story.' };
  const sameTime = timeChangeOnPurpose || new Set(sentences.map((s) => s.draft.tense)).size === 1;
  // Characters connect: one cast member shows up in two or more sentences.
  const seenIn = new Map<string, Set<number>>();
  sentences.forEach((s, i) => Object.values(s.resolution.refs).flat().forEach((id) => {
    if (!seenIn.has(id)) seenIn.set(id, new Set());
    seenIn.get(id)!.add(i);
  }));
  const connect = sentences.length > 1 && [...seenIn.values()].some((set) => set.size > 1);
  // Every he / she / it / they points to someone already in the story.
  const castFlags = new Map(storyCast(sentences).map((m) => [m.id, m]));
  const pronounsPoint = sentences.every((s) => entitiesOf(s.frame).filter((e) => e.pronoun && !['I', 'you', 'we'].includes(e.pronoun)).every((e) => (s.resolution.refs[e.id] ?? []).every((id) => !castFlags.get(id)?.isDefault)));
  // First time "a", then "the".
  const firstArticle = new Map<string, string>();
  let aThenThe = false;
  sentences.forEach((s) => entitiesOf(s.frame).forEach((e) => {
    if (!e.article) return;
    for (const id of s.resolution.refs[e.id] ?? []) {
      const first = firstArticle.get(id);
      if (first === undefined) firstArticle.set(id, e.article);
      else if (first === 'a' && e.article === 'the') aThenThe = true;
    }
  }));
  const starters = sentences.map((s) => (s.text.split(/\s+/)[0] ?? '').toLowerCase().replace(/[^a-z]/g, ''));
  const differentStarters = sentences.length > 1 && new Set(starters).size > 1;
  const stars = (1 + (sameTime ? 1 : 0) + (sameTime && connect ? 1 : 0)) as 1 | 2 | 3;
  const bonus = (aThenThe ? 1 : 0) + (differentStarters ? 1 : 0) + (pronounsPoint ? 1 : 0);
  const tip = !sameTime ? 'Keep every sentence in the same time, or tap "I changed time on purpose".'
    : !connect ? (sentences.length < 2 ? 'Add another sentence about the same character.' : 'Bring a character back in another sentence, like "the cat".')
    : !pronounsPoint ? 'Say who he, she, it or they is in an earlier sentence.'
    : !aThenThe ? 'Bonus: meet someone with "a", then call them "the".'
    : !differentStarters ? 'Bonus: start your sentences with different words.'
    : 'A flawless story. I am framing it.';
  return { stars, sameTime, connect, pronounsPoint, aThenThe, differentStarters, bonus, tip };
}
