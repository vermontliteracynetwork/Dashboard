import { describe, it, expect } from 'vitest';
import { runSentence } from '../engine/pipeline';
import { reviewStory, storyCast, storyScript, type SealedSentence } from '../engine/story';
import { d } from './helpers';
import { FB } from '../render/fb';
import { renderVideoFrame } from '../render/stage';
import type { Draft } from '../engine/types';

// Seal sentences the way the machine does: each one starts from the cast
// the story already has (plan 5.3, 7.1).
function seal(drafts: Draft[]): SealedSentence[] {
  const out: SealedSentence[] = [];
  drafts.forEach((dr, i) => {
    const r = runSentence(dr, storyCast(out), `s${i + 1}`);
    expect(r.rubric?.stars, r.composed.text).toBe(3);
    out.push({ id: `s${i + 1}`, draft: dr, text: r.composed.text, script: r.script!, frame: r.frame!, resolution: r.resolution! });
  });
  return out;
}

describe('paragraph machines', () => {
  it('white cat / black cat: the same white cat in both sentences, 3 story stars', () => {
    const story = seal([d('A J N V D', 'The white cat ran quickly.'), d('A J N V A J N', 'The black cat attacked the white cat.')]);
    const white1 = story[0].resolution.refs[story[0].frame.events[0].subject.id][0];
    const white2 = story[1].resolution.refs[story[1].frame.events[0].object!.id][0];
    expect(white2).toBe(white1);
    const r = reviewStory(story);
    expect(r.stars).toBe(3); expect(r.connect).toBe(true);
  });
  it('a then the earns the bonus; a time change costs a star unless on purpose', () => {
    const story = seal([d('A N V', 'A dog ran.'), d('A N V', 'The dog will jump.')]);
    expect(reviewStory(story).aThenThe).toBe(true);
    expect(reviewStory(story).stars).toBe(1); // ran / will jump: different times, so no connect star either
    expect(reviewStory(story, true).stars).toBe(3);
  });
  it('pronouns with nobody to point to are flagged', () => {
    expect(reviewStory(seal([d('R V', 'He jumps.')])).pronounsPoint).toBe(false);
    expect(reviewStory(seal([d('A N V', 'A boy runs.'), d('R V', 'He jumps.')])).pronounsPoint).toBe(true);
  });
  it('Play All renders every scene with curtains once', () => {
    const story = seal([d('A J N V D', 'The white cat ran quickly.'), d('A N V', 'A dog jumped.'), d('A N V', 'The dog walked.')]);
    const script = storyScript(story)!;
    expect(script.scenes).toHaveLength(3);
    const fb = new FB();
    for (let t = 0; t <= script.timing.total; t += 0.2) renderVideoFrame(fb, script, t);
    expect(script.timing.total).toBeGreaterThan(10);
  });
});
