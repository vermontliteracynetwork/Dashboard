import type { HelpLevel, Tense } from './types';

// Teacher reports (plan 3.18.8 and 25.10). Every START pull is logged on
// the student's own Gus row; this file turns the log into a teacher view.
// Pure TypeScript. Never compared across students (standing no-leaderboard rule).

export interface Attempt {
  at: string; stars: 0 | 1 | 2 | 3; // 0 = the machine leaked steam (did not run)
  codes: string[]; level: HelpLevel; words: number; tense: Tense; text: string;
  hopper?: boolean; bp?: string;
}
export interface BlueprintDone { at: string; id: string; stars: number }
export const MAX_ATTEMPTS = 400;

// Teacher-facing names for every code the machine and Gus's review use.
export const CODE_NAMES: Record<string, string> = {
  NO_SUBJECT: 'Missing subject (who or what)', NO_VERB: 'Missing verb', NO_OBJECT: 'Verb needs an object', AGREEMENT: 'Subject-verb agreement',
  TENSE: 'Verb tense', NO_CAPITAL: 'Capital letter', NO_END_MARK: 'End punctuation', NO_SHOUT_MARK: 'Interjection mark (!)',
  A_AN: 'a / an', A_WITH_PLURAL: '"a" with a plural noun', ADJ_ORDER: 'Order of adjectives', ADV_NO_VERB: 'Adverb with no verb',
  PREP_INCOMPLETE: 'Unfinished prepositional phrase', CONJ_UNBALANCED: 'Conjunction joins unlike parts', HALF_INCOMPLETE: 'Half of a compound sentence is incomplete',
  NO_COMMA: 'Comma', PRONOUN_NO_REFERENT: 'Pronoun with no referent', TENSE_SHIFT: 'Tense shift', NO_JOIN: 'Two verbs with no join word',
  EXTRA_OBJECT: 'Object after an intransitive verb', EMPTY_SOCKET: 'Empty part', BAD_SHAPE: 'Word order', PRONOUN_CASE: 'Pronoun case (he / him)',
  SELF_ACTION: 'Subject acts on itself', SELF_PLACE: 'Something placed by itself', CONTRADICTORY_DESCRIBERS: 'Adjectives that contradict',
  CONTRADICTORY_HOW: 'Adverbs that contradict', TENSE_MIX: 'Mixed times', AMBIGUOUS_REFERENCE: 'Unclear "the" reference',
  SAME_THING_TWICE: 'Same thing named twice', EAT_NOT_FOOD: 'Eats something that is not food', DRINK_NOT_DRINKABLE: 'Drinks something not drinkable',
  SIZE_PARADOX: 'Size contradiction',
};

export interface Report {
  total: number; week: number;
  stars: [number, number, number, number]; // this week: leaked, 1, 2, 3 stars
  threeStarRate: number | null; // this week
  triesToThree: number | null; // average START pulls per 3-star sentence (last 30 days)
  topCodes: { code: string; name: string; count: number }[]; // last 30 days
  hopperRate: number | null; // share of pulls right after a Hopper fill (prompt dependence, last 30 days)
  avgWords: number | null; // 3-star sentences, last 30 days
  lengthTrend: { week: string; avg: number; count: number }[]; // last 6 weeks with 3-star sentences
  tenses: Record<Tense, number>; // 3-star sentences, last 30 days
  levels: Partial<Record<HelpLevel, { tries: number; three: number }>>; // accuracy by help level, last 30 days
  blueprints: number; recent: string[]; lastAt?: string;
}

const DAY = 86400000;
// Monday of the week, as YYYY-MM-DD (local time).
export function weekOf(iso: string): string {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7;
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

export function summarize(attempts: Attempt[], blueprints: BlueprintDone[] = [], now = Date.now()): Report {
  const all = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  const thisWeek = weekOf(new Date(now).toISOString());
  const week = all.filter((a) => weekOf(a.at) === thisWeek);
  const month = all.filter((a) => now - Date.parse(a.at) <= 30 * DAY);
  const stars: Report['stars'] = [0, 0, 0, 0];
  for (const a of week) stars[a.stars]++;
  // Pulls per 3-star sentence: count pulls since the last 3 stars.
  const runs: number[] = []; let n = 0;
  for (const a of month) { n++; if (a.stars === 3) { runs.push(n); n = 0; } }
  const codeCount = new Map<string, number>();
  for (const a of month) for (const c of new Set(a.codes)) codeCount.set(c, (codeCount.get(c) ?? 0) + 1);
  const topCodes = [...codeCount.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 4).map(([code, count]) => ({ code, name: CODE_NAMES[code] ?? code, count }));
  const three = month.filter((a) => a.stars === 3);
  const byWeek = new Map<string, number[]>();
  for (const a of all.filter((x) => x.stars === 3)) { const k = weekOf(a.at); byWeek.set(k, [...(byWeek.get(k) ?? []), a.words]); }
  const lengthTrend = [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([wk, ws]) => ({ week: wk, avg: Math.round((ws.reduce((s, x) => s + x, 0) / ws.length) * 10) / 10, count: ws.length }));
  const tenses: Record<Tense, number> = { past: 0, present: 0, future: 0 };
  for (const a of three) tenses[a.tense]++;
  const levels: Report['levels'] = {};
  for (const a of month) { const l = (levels[a.level] ??= { tries: 0, three: 0 }); l.tries++; if (a.stars === 3) l.three++; }
  const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null);
  return {
    total: all.length, week: week.length, stars,
    threeStarRate: week.length ? stars[3] / week.length : null,
    triesToThree: avg(runs), topCodes,
    hopperRate: month.length ? month.filter((a) => a.hopper).length / month.length : null,
    avgWords: avg(three.map((a) => a.words)), lengthTrend, tenses, levels,
    blueprints: blueprints.filter((b) => b.stars >= 2).length,
    recent: [...three].reverse().slice(0, 5).map((a) => a.text),
    lastAt: all[all.length - 1]?.at,
  };
}

const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function attemptsCsv(attempts: Attempt[]): string {
  const rows = [...attempts].sort((a, b) => a.at.localeCompare(b.at)).map((a) => [
    a.at, a.stars === 0 ? 'did not run' : a.stars, a.level, a.tense, a.words, a.codes.map((c) => CODE_NAMES[c] ?? c).join('; '), a.hopper ? 'yes' : 'no', a.bp ?? '', a.text,
  ].map(csvCell).join(','));
  return ['Date,Stars,Help level,Time,Words,Fixes needed,After Hopper,Blueprint,Sentence', ...rows].join('\n');
}
