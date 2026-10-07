import type { Draft, RubricResult, RubricSettings, SemanticFrame, Verdict, Event } from './types';
import { DEFAULT_RUBRIC_SETTINGS } from './types';
import type { Resolution } from '../director/cast';
import { areOpposites, DESCRIBER_OPPOSITES, HOW_OPPOSITES } from '../data/antonyms';
import { RUBRIC_LINES, lineFor } from '../data/gusLines';
import { hashString } from './rng';
import { nounByWord } from '../data/wordbank';
import { sillyScore } from './silly';

// Grammar Gus's star review (plan 3.18). Runs only after the checklist
// gate passes. Silly is celebrated; impossible is explained kindly.
// Pure and deterministic: same sentence and cast, same stars.

const allEvents = (f: SemanticFrame): Event[] => f.events.flatMap((e) => (e.join ? [e, e.join.next] : [e]));

export function evaluate(draft: Draft, frame: SemanticFrame, res: Resolution, settings: RubricSettings = DEFAULT_RUBRIC_SETTINGS): RubricResult {
  const verdicts: Verdict[] = [];
  const seed = hashString(draft.tokens.map((t) => t.word).join(' '));
  const verdict = (code: Verdict['code'], criterion: Verdict['criterion'], severity: Verdict['severity'], targets: number[]) => {
    const l = lineFor(RUBRIC_LINES[code], seed);
    if (!verdicts.some((v) => v.code === code)) verdicts.push({ code, criterion, severity, targets, kid: l.joke, fix: l.fix });
  };
  const events = allEvents(frame);
  const ids = (e?: { id: string }) => (e ? res.refs[e.id] ?? [] : []);

  // Possible (hard fails).
  for (const ev of events) {
    const subj = ids(ev.subject);
    if (ev.object && (ev.object.reflexive || ids(ev.object).some((x) => subj.includes(x)))) verdict('SELF_ACTION', 'possible', 'hard', ev.object.tokens);
    for (const pl of ev.places) if (ids(pl.ground).some((x) => subj.includes(x))) verdict('SELF_PLACE', 'possible', 'hard', pl.ground.tokens);
    const how = ev.adverbs;
    if (ev.adverbJoin !== 'or' && how.some((a, i) => how.some((b, j) => j > i && areOpposites(HOW_OPPOSITES, a, b)))) verdict('CONTRADICTORY_HOW', 'possible', 'hard', [ev.verbToken]);
  }
  const nps = events.flatMap((ev) => [ev.subject, ...(ev.subject.conjoined ?? []), ...(ev.object ? [ev.object] : []), ...ev.places.map((p) => p.ground)]);
  for (const np of nps) {
    if (np.adjectives.some((a, i) => np.adjectives.some((b, j) => j > i && areOpposites(DESCRIBER_OPPOSITES, a, b)))) verdict('CONTRADICTORY_DESCRIBERS', 'possible', 'hard', np.tokens);
  }
  if (settings.strictness === 'real') {
    for (const ev of events) {
      const obj = ev.object && nounByWord.get(ev.object.noun);
      if (ev.verb === 'eat' && ev.object && !obj?.food) verdict('EAT_NOT_FOOD', 'possible', 'hard', ev.object.tokens);
      if (ev.verb === 'drink' && ev.object && !obj?.drink) verdict('DRINK_NOT_DRINKABLE', 'possible', 'hard', ev.object.tokens);
      if (ev.verb === 'chop' && ev.object && ev.subject.adjectives.includes('tiny') && (ev.object.adjectives.includes('big') || obj?.size === 'big')) verdict('SIZE_PARADOX', 'possible', 'hard', ev.object.tokens);
    }
  }
  // Same time (soft).
  const tenses = new Set(events.map((e) => e.tense));
  if (tenses.size > 1 || [...tenses].some((t) => t !== draft.tense)) verdict('TENSE_MIX', 'sameTime', 'soft', events.map((e) => e.verbToken));
  // Clear (soft).
  if (res.ambiguous.length) verdict('AMBIGUOUS_REFERENCE', 'clear', 'soft', []);
  if (res.sameTwice.length) verdict('SAME_THING_TWICE', 'clear', 'soft', []);

  const hard = verdicts.some((v) => v.severity === 'hard');
  const sameTime = verdicts.some((v) => v.criterion === 'sameTime') ? 0 : 20;
  const clear = verdicts.some((v) => v.criterion === 'clear') ? 0 : 15;
  const possible = hard ? 0 : 25;
  const total = 40 + sameTime + clear + possible;
  const softCount = (sameTime === 0 ? 1 : 0) + (clear === 0 ? 1 : 0);
  const stars: 1 | 2 | 3 = hard || softCount >= 2 ? 1 : softCount === 1 ? 2 : 3;
  const hasAdj = nps.some((np) => np.adjectives.length > 0);
  const hasHow = events.some((e) => e.adverbs.length > 0);
  const hasWhere = events.some((e) => e.places.length > 0);
  return {
    points: { grammar: 40, sameTime, possible, clear, total },
    stars, producible: stars >= settings.videoThreshold, verdicts,
    silly: sillyScore(frame), sparkles: ((hasAdj ? 1 : 0) + (hasHow ? 1 : 0) + (hasWhere ? 1 : 0)) as 0 | 1 | 2 | 3,
  };
}
