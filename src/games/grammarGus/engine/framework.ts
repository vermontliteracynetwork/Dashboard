import type { Draft, Pos, Tense, Token } from './types';
import { runSentence, type Run } from './pipeline';
import { buildTokens, CORE_VERBS, POOLS, SLOT_BY_KEY, type HousingId, type Words } from './machine';
import { pick, type Rng } from './rng';
import { DISSOLVE_SECONDS, reviewStory, storyCast, type SealedSentence } from './story';
import { nounByWord, INTERJECTIONS } from '../data/wordbank';
import type { Framework, FrameworkLine, LinkRule } from '../data/frameworks';
import { CURTAIN_SECONDS, STAMP_SECONDS, fitBudget, type Look, type Scene, type SceneScript } from '../director/director';
import type { CastMember } from '../director/cast';

// The blueprint engine (plan section 11). Every build line is an ordinary
// sentence machine judged by the usual checklist and rubric; this file
// only sets the machine up for a line, checks the line's symbol shape,
// writes the paragraph and its video, and gives the framework stars.

export type BuildLine = Extract<FrameworkLine, { kind: 'build' }>;
export const buildLines = (fw: Framework) => fw.lines.filter((l): l is BuildLine => l.kind === 'build');
export const needsWord = (fw: Framework) => fw.lines.some((l) => l.kind === 'word');

export interface MachineSetup { words: Words; whoPron: boolean; open: HousingId[]; keys: string[] }

// A blueprint shape (A J N V P A N) as machine sockets, with locked words
// and the echo-start word already in place (plan 11.2).
export function machineSetupFor(shape: Pos[], locks: Record<string, string> = {}, echoWord?: string): MachineSetup {
  const keys: string[] = []; const open: HousingId[] = []; let whoPron = false;
  let i = 0;
  const at = () => shape[i];
  if (at() === 'I') { keys.push('shout'); open.push('shout'); i++; }
  if (at() === 'R') { whoPron = true; keys.push('who.pron'); i++; }
  else {
    if (at() === 'A') { keys.push('who.art'); i++; }
    let adj = 0;
    while (at() === 'J') { keys.push(adj ? 'who.adj2' : 'who.adj1'); adj++; i++; }
    if (at() === 'N') { keys.push('who.noun'); i++; }
  }
  if (at() === 'V') { keys.push('did.verb'); i++; }
  let where = false;
  while (i < shape.length) {
    const p = at();
    if (p === 'P') { where = true; if (!open.includes('where')) open.push('where'); keys.push('where.prep'); }
    else if (p === 'D') { if (!open.includes('how')) open.push('how'); keys.push('how.adv'); }
    else if (where && (p === 'A' || p === 'N')) keys.push(p === 'A' ? 'where.art' : 'where.noun');
    else if (p === 'A' || p === 'J' || p === 'N') { if (!open.includes('obj')) open.push('obj'); keys.push(p === 'A' ? 'obj.art' : p === 'J' ? 'obj.adj' : 'obj.noun'); }
    else throw new Error(`The machine cannot build ${p} here yet`);
    i++;
  }
  const words: Words = {};
  for (const [k, w] of Object.entries(locks)) if (keys.includes(k)) words[k] = w;
  if (echoWord) {
    const lower = echoWord.toLowerCase();
    if (nounByWord.has(lower) && keys.includes('who.noun')) words['who.noun'] = lower;
    const shout = INTERJECTIONS.find((x) => x.toLowerCase() === lower);
    if (shout && keys.includes('shout')) words.shout = shout;
  }
  return { words, whoPron, open, keys };
}

function isSubsequence(need: Pos[], have: Pos[]): boolean {
  let k = 0;
  for (const p of have) if (p === need[k]) k++;
  return k === need.length;
}
// Does the machine's sentence follow the line's blueprint symbols?
export function matchesBlueprint(tokens: Token[], line: BuildLine): boolean {
  const have = tokens.map((t) => t.pos);
  return line.shapes.some((sh) => (line.expandable ? isSubsequence(sh, have) : sh.join(' ') === have.join(' ')));
}

export interface FilledLine { words: Words; whoPron: boolean; open: HousingId[]; draft: Draft; run: Run }

// The blueprint Surprise Hopper (plan 11.6): fill a build line with words
// that make a 3-star sentence in the line's shape. Story lines like to
// bring back a character already on stage.
export function fillLine(line: BuildLine, rng: Rng, o: { tense: Tense; castBefore?: CastMember[]; sentenceId?: string; setup?: string; gentleOnly?: boolean; base?: Words; tries?: number }): FilledLine | null {
  const cast = (o.castBefore ?? []).filter((m) => !m.isDefault && nounByWord.has(m.noun));
  // Jokes: prefer a punchline shape that can use the setup word (plan 11.4).
  const echoShapes = o.setup && line.echoStart ? line.shapes.filter((sh) => { const w = machineSetupFor(sh, line.locks, o.setup).words; return !!(w['who.noun'] || w.shout); }) : [];
  for (let k = 0; k < (o.tries ?? 600); k++) {
    const shape = echoShapes.length && rng() < 0.85 ? pick(rng, echoShapes) : pick(rng, line.shapes);
    const st = machineSetupFor(shape, line.locks, line.echoStart ? o.setup : undefined);
    const w: Words = { ...st.words };
    if (o.base) for (const key of st.keys) if (o.base[key] && !w[key]) w[key] = o.base[key];
    const hasObj = st.keys.includes('obj.noun');
    if (cast.length && st.keys.includes('who.noun') && !w['who.noun'] && rng() < 0.65) { w['who.art'] = 'the'; w['who.noun'] = pick(rng, cast).noun; }
    for (const key of st.keys) {
      if (w[key]) continue;
      if (key === 'did.verb') {
        const pool = CORE_VERBS.filter((v) => (hasObj ? v.objectUse !== 'I' : v.objectUse !== 'T') && (!o.gentleOnly || v.gentle !== false)).map((v) => v.base);
        w[key] = pick(rng, pool);
      } else w[key] = pick(rng, POOLS[key === 'who.pron' ? 'R' : SLOT_BY_KEY.get(key)!.pos]);
    }
    const built = buildTokens(w, st.whoPron);
    const draft: Draft = { tokens: built.tokens, tense: o.tense, level: 'full' };
    const run = runSentence(draft, o.castBefore ?? [], o.sentenceId ?? 's1');
    if (run.rubric?.stars === 3 && run.script && matchesBlueprint(built.tokens, line)) return { words: w, whoPron: st.whoPron, open: st.open, draft, run };
  }
  return null;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const lowerFirst = (s: string) => (/^I\b/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));
const withArticle = (noun: string) => {
  const e = nounByWord.get(noun);
  if (e?.plural || e?.noA) return noun;
  return `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
};

// The text of one line, or null while it is still empty.
export function lineText(fw: Framework, line: FrameworkLine, setup: string | undefined, sealed: SealedSentence[]): string | null {
  switch (line.kind) {
    case 'fixed': return line.text;
    case 'word': {
      if (!setup) return null;
      if (line.lead) return `${line.lead} ${nounByWord.has(setup) ? withArticle(setup) : setup}${line.tail ?? '.'}`;
      return `${cap(setup)}${line.tail ?? '.'}`;
    }
    case 'echo': return setup ? `${cap(setup)}${line.suffix}` : null;
    case 'build': {
      const idx = buildLines(fw).indexOf(line);
      const s = sealed[idx];
      if (!s) return null;
      return line.lead ? `${line.lead} ${lowerFirst(s.text)}` : s.text;
    }
  }
}
export const frameworkText = (fw: Framework, setup: string | undefined, sealed: SealedSentence[]) =>
  fw.lines.map((l) => lineText(fw, l, setup, sealed)).filter(Boolean).join(' ');

// Framework stars (plan 11.7).
export interface FrameworkReview { stars: 1 | 2 | 3; complete: boolean; links: Partial<Record<LinkRule, boolean>>; tip: string }
export function reviewFramework(fw: Framework, setup: string | undefined, sealed: SealedSentence[], timeOnPurpose = false): FrameworkReview {
  const complete = sealed.length >= buildLines(fw).length && (!needsWord(fw) || !!setup);
  if (!complete) return { stars: 1, complete, links: {}, tip: 'Fill every line of the blueprint first.' };
  const rs = reviewStory(sealed, timeOnPurpose);
  const usesSetup = !!setup && sealed.some((s) => new RegExp(`\\b${setup.replace(/[^a-z]/gi, '')}\\b`, 'i').test(s.text));
  const links: Partial<Record<LinkRule, boolean>> = {};
  for (const l of fw.links) links[l] = l === 'usesSetupWord' ? usesSetup : l === 'characterConnects' ? rs.connect : rs.sameTime;
  const missing = fw.links.find((l) => !links[l]);
  const tip = !missing ? 'A flawless blueprint. Framed and hung in my office.'
    : missing === 'usesSetupWord' ? `For 3 stars, put "${cap(setup ?? '')}" in the punchline.`
    : missing === 'characterConnects' ? 'For 3 stars, bring a character back in another line, like "the pig" or "he".'
    : 'For 3 stars, keep every line in the same time, or tap On purpose.';
  return { stars: missing ? 2 : 3, complete, links, tip };
}

// ---- Video -----------------------------------------------------------------

const PLAIN: Look = { scale: 1, wide: false, extras: [] };
const member = (id: string, noun: string): CastMember => {
  const e = nounByWord.get(noun);
  return { id, noun, adjectives: [], plural: !!e?.plural, count: e?.group ?? 1, kind: e?.kind ?? 'human', rig: e?.rig ?? 'biped', introducedIn: 'fw', label: noun, isDefault: true };
};
const titleScene = (id: string, text: string, seconds = 1.2): Scene => ({ id, tense: 'present', caption: text, props: [], start: {}, beats: [], duration: seconds, title: text });
const JOKE_PUNCH_BUDGET = 3.5; // 3.8 s doorway + 0.3 s dissolve + 3.5 s = 7.6 s (plan 11.4.1)

function finish(cast: CastMember[], looks: Record<string, Look>, scenes: Scene[]): SceneScript {
  const body = scenes.reduce((a, sc) => a + sc.duration, 0) + DISSOLVE_SECONDS * (scenes.length - 1);
  return { version: 1, cast, looks, scenes, timing: { curtainsOpen: CURTAIN_SECONDS, scene: body, curtainsClose: CURTAIN_SECONDS, stamp: STAMP_SECONDS, total: CURTAIN_SECONDS + body + CURTAIN_SECONDS + STAMP_SECONDS } };
}

// The compact joke video (plan 11.4.1): a doorway scene, then the
// punchline plays in the doorway. 10.0 seconds or less in total.
export function jokeScript(setup: string, punch: SealedSentence): SceneScript {
  const knocker = member('kk-knocker', 'kid');
  const door = { ...member('kk-door', 'door'), rig: 'prop' as const, kind: 'thing' as const };
  const word = cap(setup);
  const sprite = nounByWord.has(setup.toLowerCase()) ? member('kk-setup', setup.toLowerCase()) : null;
  const intro: Scene = {
    id: 'kk', tense: 'present', caption: 'Knock knock.', props: [{ castId: door.id, x: 116 }],
    start: { [knocker.id]: { x: 76, facing: 1 }, ...(sprite ? { [sprite.id]: { x: 46, facing: 1 } } : {}) },
    beats: sprite ? [{ t: 2.0, dur: 0.3, do: 'enter', who: [sprite.id], speed: 1, fx: [], tags: [] }] : [],
    duration: 3.8, knocks: [0.25, 0.65],
    bubbles: [
      { t: 0, dur: 1.2, text: 'Knock knock!', x: 70 },
      { t: 1.2, dur: 0.8, text: 'Who\'s there?', x: 112 },
      { t: 2.0, dur: 0.9, text: `${word}.`, x: 56 },
      { t: 2.9, dur: 0.9, text: `${word} who?`, x: 108 },
    ],
  };
  const sc: Scene = JSON.parse(JSON.stringify(punch.script.scenes[0]));
  fitBudget(sc, JOKE_PUNCH_BUDGET);
  const cast = [...punch.script.cast, knocker, door, ...(sprite ? [sprite] : [])];
  return finish(cast, { ...punch.script.looks, [knocker.id]: PLAIN, [door.id]: PLAIN, ...(sprite ? { [sprite.id]: PLAIN } : {}) }, [intro, sc]);
}

// Per-line frameworks (plan 11.6): fixed lines and lead-ins are title
// cards, each build line plays its own scene, Play All joins them.
export function frameworkScript(fw: Framework, setup: string | undefined, sealed: SealedSentence[]): SceneScript | null {
  const builds = buildLines(fw);
  if (fw.video === 'compact') {
    const punch = sealed[builds.length - 1];
    return setup && punch ? jokeScript(setup, punch) : null;
  }
  const scenes: Scene[] = [];
  const cast = new Map<string, CastMember>(); const looks: Record<string, Look> = {};
  for (const line of fw.lines) {
    if (line.kind === 'fixed') scenes.push(titleScene(line.id, line.text));
    else if (line.kind === 'build') {
      const s = sealed[builds.indexOf(line)];
      if (!s) continue;
      if (line.lead) scenes.push(titleScene(`${line.id}-lead`, line.lead, 1.0));
      for (const m of s.script.cast) cast.set(m.id, m);
      Object.assign(looks, s.script.looks);
      scenes.push(s.script.scenes[0]);
    } else if (line.kind === 'word' && setup) {
      const text = lineText(fw, line, setup, sealed)!;
      const noun = nounByWord.has(setup) ? member(`${line.id}-answer`, setup) : null;
      if (noun) { cast.set(noun.id, noun); looks[noun.id] = PLAIN; }
      scenes.push({ id: line.id, tense: 'present', caption: text, props: [], start: noun ? { [noun.id]: { x: 80, facing: 1 } } : {}, beats: noun ? [{ t: 0, dur: 0.3, do: 'enter', who: [noun.id], speed: 1, fx: [], tags: [] }] : [], duration: 2.0, bubbles: [{ t: 0.3, dur: 1.7, text, x: 80 }] });
    }
  }
  return scenes.length ? finish([...cast.values()], looks, scenes) : null;
}

export { storyCast };
