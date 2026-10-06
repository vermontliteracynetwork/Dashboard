import { useStore } from '../store/store';
import { todayISO } from './dates';
import { getEconomy } from './economy';
import { recordPetTrainingAnswer } from './petTraining';

// Daily Streak (teacher spec 2026-10-04, full words in the dev plan). A
// streak day is saved by answering streakGoal() questions (10 by default) right anywhere in
// the app (native games, quizzes, the gas pump, Quiz mode). Each saved day
// adds one to the streak and pays treasure chests. A missed day breaks the
// streak unless a Streak Freeze covers it: every student starts with one,
// more cost $20 in the Marketplace or come from the Daily Spin (5%).
// Saved as the `streak:<studentId>` row in style_looks (no new SQL).
//
// Claudia's calls on the open questions (from her earlier choices, change
// any of these):
// - Weekends are not automatically safe (her spec uses freezes for that).
// - A missed day uses a freeze automatically if one is available (the "oh
//   no" fix happens for them). Freezes can also be put on upcoming days
//   ahead of time from the streak view.
// - If the streak broke with no freeze, buying one the same day and
//   tapping "Get my streak back" restores it.
// - Chests per day stop growing at MAX_CHESTS so opening stays quick; the
//   money cap for the day is unchanged.
// - Only right answers count (wrong answers never cost anything).

// Teacher-editable in Economy Settings (src/lib/economy.ts); defaults 10 (teacher change 2026-10-06, was 20), 7 and $20.
export const streakGoal = () => getEconomy().streakGoal;
export const freezePriceCents = () => getEconomy().freezePriceCents;

export interface StreakRow {
  count?: number;
  best?: number;
  lastSavedDay?: string;
  savedDays?: string[]; // recent saved days (for the week view)
  frozenDays?: string[]; // days covered by a freeze
  freezes?: number; // undefined = never set: everyone starts with 1
  today?: { day: string; correct: number };
  cardShownDay?: string;
  lost?: { count: number; day: string };
  chestsPending?: { day: number; amounts: number[]; opened: number };
  noticeFroze?: number; // freezes used automatically, to tell the student once
}

export const streakOwner = (studentId: string) => `streak:${studentId}`;

export function readStreak(studentId: string): StreakRow {
  const row = useStore.getState().styleLooks.find((r) => r.ownerId === streakOwner(studentId))?.look as StreakRow | undefined;
  return row ?? {};
}
export function useStreak(studentId: string | null | undefined): StreakRow {
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === streakOwner(studentId)) : undefined));
  return (row?.look as StreakRow | undefined) ?? {};
}
function save(studentId: string, patch: Partial<StreakRow>) {
  useStore.getState().mergeStyleRow(streakOwner(studentId), patch as Record<string, unknown>);
}

export const freezesOf = (r: StreakRow) => r.freezes ?? 1;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayAfter = (iso: string) => addDays(iso, 1);

// Before anything else on a new day: walk the days missed since the last
// saved one. Each is fine if a freeze was put on it ahead of time; otherwise
// a freeze is used for it automatically; with none left, the streak breaks.
export function reconcileStreak(studentId: string): StreakRow {
  const r = readStreak(studentId);
  const today = todayISO();
  if (!r.lastSavedDay || !r.count) return r;
  let freezes = freezesOf(r);
  const frozen = new Set(r.frozenDays ?? []);
  let usedNow = 0;
  let broken = false;
  for (let d = dayAfter(r.lastSavedDay); d < today; d = dayAfter(d)) {
    if (frozen.has(d)) continue;
    if (freezes > 0) { freezes -= 1; frozen.add(d); usedNow += 1; continue; }
    broken = true;
    break;
  }
  if (!broken && usedNow === 0) return r;
  // The last day the streak is still alive through (so the next check
  // doesn't walk the same days again).
  const yesterday = addDays(today, -1);
  const patch: Partial<StreakRow> = broken
    ? { count: 0, lost: { count: r.count, day: today }, freezes, frozenDays: [...frozen].slice(-30), lastSavedDay: undefined }
    : { freezes, frozenDays: [...frozen].slice(-30), lastSavedDay: yesterday, noticeFroze: (r.noticeFroze ?? 0) + usedNow };
  save(studentId, patch);
  return { ...r, ...patch };
}

// Chest amounts (whole dollars, in cents) for a streak of `day` days.
// Day 1: one $5 chest. Day 2: two chests, $1 to $5 each, at most $10 total.
// Days 3 to 9: one chest per day, $1 to $5 each, at most $10. Days 10 to 19:
// $1 to $10 each, at most $20. Days 20 to 29: $1 to $15, at most $30. Every
// further 10 days: +$5 per chest, +$10 per day.
export function chestAmounts(day: number, rand = Math.random): number[] {
  const econ = getEconomy();
  if (day <= 1) return [econ.dayOneChestCents];
  const band = Math.floor(day / 10);
  const maxEach = 5 * (band + 1);
  const cap = 10 * (band + 1);
  const n = Math.min(day, econ.maxChests);
  const dollars = Array.from({ length: n }, () => 1 + Math.floor(rand() * maxEach));
  let total = dollars.reduce((a, b) => a + b, 0);
  while (total > cap) {
    const i = dollars.indexOf(Math.max(...dollars));
    if (dollars[i] <= 1) break;
    dollars[i] -= 1;
    total -= 1;
  }
  return dollars.map((d) => d * 100);
}

// One right answer, from anywhere. Ignored for teachers and when nobody is
// logged in as a student.
export function recordStreakCorrect(studentIdArg?: string) {
  const st = useStore.getState();
  const studentId = studentIdArg ?? st.currentStudentId;
  if (!studentId || st.role !== 'student') return;
  recordPetTrainingAnswer(studentId);
  const today = todayISO();
  const r = reconcileStreak(studentId);
  const correct = (r.today?.day === today ? r.today.correct : 0) + 1;
  const patch: Partial<StreakRow> = { today: { day: today, correct } };
  if (correct >= streakGoal() && r.lastSavedDay !== today) {
    const count = (r.count ?? 0) + 1;
    patch.count = count;
    patch.best = Math.max(r.best ?? 0, count);
    patch.lastSavedDay = today;
    patch.savedDays = [...(r.savedDays ?? []).filter((d) => d !== today), today].slice(-30);
    patch.lost = undefined;
    patch.chestsPending = { day: count, amounts: chestAmounts(count), opened: 0 };
  }
  save(studentId, patch);
}

// Opens the next chest: pays it into the bank and moves the counter on.
export function openNextChest(studentId: string): number | null {
  const r = readStreak(studentId);
  const c = r.chestsPending;
  if (!c || c.opened >= c.amounts.length) return null;
  const amount = c.amounts[c.opened];
  useStore.getState().recordTransaction(studentId, amount, `🔥 Streak chest (day ${c.day})`, '🎁', 'streak-chest');
  save(studentId, { chestsPending: { ...c, opened: c.opened + 1 } });
  return amount;
}
export function finishChests(studentId: string) {
  save(studentId, { chestsPending: undefined });
}

export function markCardShown(studentId: string) {
  save(studentId, { cardShownDay: todayISO() });
}
export function clearFreezeNotice(studentId: string) {
  save(studentId, { noticeFroze: 0 });
}

export function addFreeze(studentId: string, n = 1) {
  const r = readStreak(studentId);
  save(studentId, { freezes: freezesOf(r) + n });
}

// Buy a Streak Freeze for $20. False if they can't afford it.
export function buyFreeze(studentId: string): boolean {
  const st = useStore.getState();
  const student = st.students.find((s) => s.id === studentId);
  const price = freezePriceCents();
  if (!student || student.coins < price) return false;
  st.recordTransaction(studentId, -price, '🧊 Streak Freeze', '🧊', 'purchase-freeze', false, 'want');
  addFreeze(studentId);
  return true;
}

// Put a freeze on an upcoming day (proactive).
export function freezeDay(studentId: string, day: string): boolean {
  const r = readStreak(studentId);
  if (freezesOf(r) <= 0 || (r.frozenDays ?? []).includes(day)) return false;
  save(studentId, { freezes: freezesOf(r) - 1, frozenDays: [...(r.frozenDays ?? []), day].slice(-30) });
  return true;
}

// "Oh no" fix: the streak broke today with no freeze; spend one to get it back.
export function restoreStreak(studentId: string): boolean {
  const r = readStreak(studentId);
  const today = todayISO();
  if (!r.lost || r.lost.day !== today || freezesOf(r) <= 0) return false;
  save(studentId, { count: r.lost.count, lost: undefined, freezes: freezesOf(r) - 1, lastSavedDay: addDays(today, -1) });
  return true;
}

// Teacher test tools (Student overview, "Reset for testing").
export function resetStreakForTesting(studentId: string) {
  useStore.getState().mergeStyleRow(streakOwner(studentId), {
    count: 0, best: 0, lastSavedDay: undefined, savedDays: [], frozenDays: [], freezes: 1, today: undefined,
    cardShownDay: undefined, lost: undefined, chestsPending: undefined, noticeFroze: 0,
  });
}
export function setTodayCorrectForTesting(studentId: string, correct: number) {
  save(studentId, { today: { day: todayISO(), correct } });
}

// The last 7 days (oldest first) and whether each was saved or frozen.
export function weekView(r: StreakRow): { day: string; label: string; state: 'saved' | 'frozen' | 'today' | 'none' }[] {
  const today = todayISO();
  const saved = new Set(r.savedDays ?? []);
  const frozen = new Set(r.frozenDays ?? []);
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6);
    const label = new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' });
    const state = saved.has(day) ? 'saved' : frozen.has(day) ? 'frozen' : day === today ? 'today' : 'none';
    return { day, label, state };
  });
}
