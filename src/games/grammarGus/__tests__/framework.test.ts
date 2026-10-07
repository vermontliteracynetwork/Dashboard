import { describe, it, expect } from 'vitest';
import { FRAMEWORKS, frameworkById } from '../data/frameworks';
import { buildLines, fillLine, frameworkScript, frameworkText, jokeScript, machineSetupFor, matchesBlueprint, reviewFramework } from '../engine/framework';
import { storyCast, type SealedSentence } from '../engine/story';
import { runSentence } from '../engine/pipeline';
import { makeRng, pick } from '../engine/rng';
import { FB } from '../render/fb';
import { renderVideoFrame } from '../render/stage';
import { NOUNS, INTERJECTIONS } from '../data/wordbank';
import { d } from './helpers';
import type { Draft } from '../engine/types';

// Paragraph frameworks (plan 11.11).
const sealAll = (drafts: Draft[]): SealedSentence[] => {
  const out: SealedSentence[] = [];
  drafts.forEach((dr, i) => {
    const r = runSentence(dr, storyCast(out), `s${i + 1}`);
    if (!r.script || !r.frame || !r.resolution) throw new Error(`not 3 stars: ${r.composed.text}`);
    out.push({ id: `s${i + 1}`, draft: dr, text: r.composed.text, script: r.script, frame: r.frame, resolution: r.resolution });
  });
  return out;
};
const play = (script: NonNullable<ReturnType<typeof frameworkScript>>) => { const fb = new FB(); for (let t = 0; t <= script.timing.total; t += 0.3) renderVideoFrame(fb, script, t); };

describe('paragraph frameworks', { timeout: 120000 }, () => {
  it('blueprint shapes become the right machine sockets', () => {
    expect(machineSetupFor(['I', 'A', 'N', 'V'])).toMatchObject({ whoPron: false, open: ['shout'], keys: ['shout', 'who.art', 'who.noun', 'did.verb'] });
    expect(machineSetupFor(['R', 'V', 'A', 'N'], { 'who.pron': 'I' })).toMatchObject({ whoPron: true, open: ['obj'], words: { 'who.pron': 'I' } });
    expect(machineSetupFor(['A', 'J', 'N', 'V', 'P', 'A', 'N']).keys).toEqual(['who.art', 'who.adj1', 'who.noun', 'did.verb', 'where.prep', 'where.art', 'where.noun']);
    expect(machineSetupFor(['A', 'J', 'N', 'V', 'D'], {}, 'zebra').words['who.noun']).toBe('zebra');
    expect(machineSetupFor(['I', 'A', 'N', 'V'], {}, 'wow').words.shout).toBe('Wow');
  });
  it('only the blueprint shape fits a build line', () => {
    const line = buildLines(frameworkById.get('silly-story')!)[1]; // I A N V
    expect(matchesBlueprint(d('I A N V', 'Eek! The pig fell.').tokens, line)).toBe(true);
    expect(matchesBlueprint(d('A N V', 'The pig fell.').tokens, line)).toBe(false);
  });
  for (const fw of FRAMEWORKS) {
    it(`${fw.name}: the Hopper completes every line with 3 stars, and the video plays`, () => {
      const rng = makeRng(7);
      const setup = fw.lines.some((l) => l.kind === 'word') ? (fw.id === 'riddle' ? 'rabbit' : 'zebra') : undefined;
      const sealed: SealedSentence[] = [];
      for (const line of buildLines(fw)) {
        const f = fillLine(line, rng, { tense: fw.tense ?? 'past', castBefore: storyCast(sealed), sentenceId: `s${sealed.length + 1}`, setup });
        expect(f, `${fw.id} ${line.id}`).toBeTruthy();
        sealed.push({ id: `s${sealed.length + 1}`, draft: f!.draft, text: f!.run.composed.text, script: f!.run.script!, frame: f!.run.frame!, resolution: f!.run.resolution! });
      }
      const text = frameworkText(fw, setup, sealed);
      for (const l of fw.lines) if (l.kind === 'fixed') expect(text).toContain(l.text);
      expect(reviewFramework(fw, setup, sealed).stars).toBeGreaterThanOrEqual(2);
      const script = frameworkScript(fw, setup, sealed)!;
      expect(script).toBeTruthy();
      play(script);
    });
  }
  it('the knock-knock joke video is 10.0 seconds or less for any setup word and punchline', () => {
    const fw = frameworkById.get('knock-knock')!;
    const line = buildLines(fw)[0];
    const rng = makeRng(3);
    for (let k = 0; k < 40; k++) {
      const setup = rng() < 0.7 ? pick(rng, NOUNS).word : pick(rng, INTERJECTIONS);
      const f = fillLine(line, rng, { tense: pick(rng, ['past', 'present', 'future'] as const), setup })!;
      const punch = sealAll([f.draft])[0];
      const s = jokeScript(setup, punch);
      expect(s.timing.total).toBeLessThanOrEqual(10 + 1e-9);
    }
  });
  it('framework stars: the setup word, the character link and the same time', () => {
    const kk = frameworkById.get('knock-knock')!;
    expect(reviewFramework(kk, 'zebra', sealAll([d('A J N V D', 'The tiny zebra drank loudly.')])).stars).toBe(3);
    const two = reviewFramework(kk, 'zebra', sealAll([d('A J N V D', 'The tiny cat drank loudly.')]));
    expect(two.stars).toBe(2);
    expect(two.tip).toContain('Zebra');
    expect(reviewFramework(kk, undefined, []).stars).toBe(1);
    const story = frameworkById.get('silly-story')!;
    expect(reviewFramework(story, undefined, sealAll([d('A J N V P A N', 'A brave pig climbed up the kite.'), d('I A N V', 'Eek! The pig fell.'), d('R V D', 'He jumped softly.')])).stars).toBe(3);
    expect(reviewFramework(story, undefined, sealAll([d('A J N V P A N', 'A brave pig climbed up the kite.'), d('I A N V', 'Eek! A dog fell.'), d('A N V D', 'A cat jumped softly.')].map((x, i) => (i === 2 ? x : x)))).stars).toBe(2);
  });
  it('lead-ins join the sentence with a small letter, and the riddle answer gets its a or an', () => {
    const story = frameworkById.get('silly-story')!;
    const sealed = sealAll([d('A J N V P A N', 'A brave pig climbed up the kite.')]);
    expect(frameworkText(story, undefined, sealed)).toBe('Once upon a time, a brave pig climbed up the kite.');
    const riddle = frameworkById.get('riddle')!;
    expect(frameworkText(riddle, 'owl', [])).toContain('I am an owl.');
  });
});
