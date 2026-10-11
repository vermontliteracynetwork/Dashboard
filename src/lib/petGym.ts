import { useStore } from '../store/store';
import type { StudentPet } from '../types';
import { ageForTraining, type PetAge } from './petsV2';

// Buff Doge's Gym (her Pets v2 spec and her own prototype, 2026-10-11). Saved as small style rows
// (no new SQL): each pet's trick sessions, the one pet a student has signed in, any drop-off fee
// owed, and the gym treats.

export interface TrickDef { name: string; age: PetAge | 'speak'; sessions: number; costCents: number; cue: string; move: string; icon: string }
// Her table: Baby tricks 2 sessions, Juvenile 3, Adult 4, $100 a session; Speak $250 a session and
// 5 sessions, only once every other trick is learned. A session is 30 minutes or 50 questions.
export const TRICKS: TrickDef[] = [
  { name: 'Sit', age: 'baby', sessions: 2, costCents: 10000, cue: 'Sit!', move: 'Sit', icon: '🪑' },
  { name: 'Come', age: 'baby', sessions: 2, costCents: 10000, cue: 'Come!', move: 'Come Here', icon: '🏃' },
  { name: 'Down', age: 'baby', sessions: 2, costCents: 10000, cue: 'Down!', move: 'Down Low, Too Slow', icon: '⬇️' },
  { name: 'Spin', age: 'baby', sessions: 2, costCents: 10000, cue: 'Spin!', move: 'Spin', icon: '🌀' },
  { name: 'Shake a Paw', age: 'juvenile', sessions: 3, costCents: 10000, cue: 'Shake!', move: 'Shake a Paw', icon: '🤝' },
  { name: 'Roll Over', age: 'juvenile', sessions: 3, costCents: 10000, cue: 'Roll over!', move: 'Roll Over', icon: '🔄' },
  { name: 'Jump', age: 'juvenile', sessions: 3, costCents: 10000, cue: 'Jump!', move: 'Jump', icon: '⤴️' },
  { name: 'Fetch', age: 'adult', sessions: 4, costCents: 10000, cue: 'Fetch!', move: 'Fetch', icon: '🎾' },
  { name: 'Dance', age: 'adult', sessions: 4, costCents: 10000, cue: 'Dance!', move: 'Dance', icon: '💃' },
  { name: 'High Five', age: 'adult', sessions: 4, costCents: 10000, cue: 'High five!', move: 'High Five', icon: '🙌' },
  // Her spec: "backflip (advanced only if possible)": an advanced Adult trick, open once the
  // other Adult tricks are learned.
  { name: 'Backflip', age: 'adult', sessions: 4, costCents: 10000, cue: 'Backflip!', move: 'Backflip', icon: '🤸' },
  { name: 'Speak', age: 'speak', sessions: 5, costCents: 25000, cue: 'Speak!', move: 'Speak', icon: '🗣️' },
];
export const STAND_STAY = { name: 'Stand/Stay', move: 'Stand and Stay', icon: '🧍' };
export const SESSION_MINUTES = 30;
export const SESSION_QUESTIONS = 50;
export const DROP_FEE_CENTS = 10000;
export const DROP_FEE_QUESTIONS = 25;
export const trickDef = (name: string) => TRICKS.find((t) => t.name === name);
const AGE_ORDER: PetAge[] = ['baby', 'juvenile', 'adult'];

// ---- each pet's trick sessions: `pettricks:<petId>` ----
export const tricksOwner = (petId: string) => `pettricks:${petId}`;
export function useTrickSessions(petId: string | null | undefined): Record<string, number> {
  return useStore((s) => (petId ? ((s.styleLooks.find((r) => r.ownerId === tricksOwner(petId))?.look as { sessions?: Record<string, number> } | undefined)?.sessions ?? EMPTY) : EMPTY));
}
const EMPTY: Record<string, number> = {};
export function trickSessionsOf(petId: string): Record<string, number> {
  return ((useStore.getState().styleLooks.find((r) => r.ownerId === tricksOwner(petId))?.look as { sessions?: Record<string, number> } | undefined)?.sessions) ?? {};
}
export const isLearned = (sessions: Record<string, number>, name: string) => (sessions[name] ?? 0) >= (trickDef(name)?.sessions ?? 99);
export const speakOpen = (sessions: Record<string, number>) => TRICKS.filter((t) => t.age !== 'speak').every((t) => isLearned(sessions, t.name));
export function learnedTricks(sessions: Record<string, number>): string[] {
  return TRICKS.filter((t) => isLearned(sessions, t.name)).map((t) => t.name);
}
// Tricks this pet can work on now: its own age and younger, plus Speak once everything else is learned.
export function trainable(pet: StudentPet, sessions: Record<string, number>): TrickDef[] {
  const ai = AGE_ORDER.indexOf(ageForTraining(pet.trainingProgress));
  const adultDone = ['Fetch', 'Dance', 'High Five'].every((n) => isLearned(sessions, n));
  return TRICKS.filter((t) => (t.age === 'speak' ? speakOpen(sessions) : t.name === 'Backflip' ? adultDone && ai >= 2 : AGE_ORDER.indexOf(t.age) <= ai) && !isLearned(sessions, t.name));
}
// Buff Doge recommends a random trick from the pet's own level (her spec).
export function recommend(pet: StudentPet, sessions: Record<string, number>): TrickDef | null {
  const age = ageForTraining(pet.trainingProgress);
  const all = trainable(pet, sessions);
  const own = all.filter((t) => t.age === age);
  const pool = own.length ? own : all;
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}
// One finished session: +1 toward the trick, and a little Health (her prototype).
export function creditSession(petId: string, trick: string): { done: number; need: number; learned: boolean } {
  const st = useStore.getState();
  const cur = trickSessionsOf(petId);
  const need = trickDef(trick)?.sessions ?? 1;
  const done = Math.min(need, (cur[trick] ?? 0) + 1);
  st.mergeStyleRow(tricksOwner(petId), { sessions: { ...cur, [trick]: done } });
  const pet = st.pets.find((p) => p.id === petId);
  if (pet) st.carePet(petId, 'talk');
  return { done, need, learned: done >= need };
}

// ---- the pet a student has signed in: `gym:<studentId>` ----
export interface GymRow { petId?: string; trick?: string; readyAt?: number; paid?: boolean }
export const gymOwner = (studentId: string) => `gym:${studentId}`;
export function useGym(studentId: string | null | undefined): GymRow {
  return useStore((s) => (studentId ? ((s.styleLooks.find((r) => r.ownerId === gymOwner(studentId))?.look as GymRow) ?? EMPTY_GYM) : EMPTY_GYM));
}
const EMPTY_GYM: GymRow = {};
export const gymRowOf = (studentId: string): GymRow => (useStore.getState().styleLooks.find((r) => r.ownerId === gymOwner(studentId))?.look as GymRow) ?? {};
export function setGym(studentId: string, row: GymRow) { useStore.getState().mergeStyleRow(gymOwner(studentId), { petId: row.petId ?? null, trick: row.trick ?? null, readyAt: row.readyAt ?? null, paid: row.paid ?? null }); }
export function clearGym(studentId: string) { setGym(studentId, {}); }

// ---- a drop-off fee owed: `gymfee:<studentId>` ----
export interface FeeRow { petId?: string | null; trick?: string | null; done?: number; need?: number; learned?: boolean }
export const feeOwner = (studentId: string) => `gymfee:${studentId}`;
export function useFee(studentId: string | null | undefined): FeeRow {
  return useStore((s) => (studentId ? ((s.styleLooks.find((r) => r.ownerId === feeOwner(studentId))?.look as FeeRow) ?? EMPTY_FEE) : EMPTY_FEE));
}
const EMPTY_FEE: FeeRow = {};
export function clearFee(studentId: string) { useStore.getState().mergeStyleRow(feeOwner(studentId), { petId: null, trick: null }); }

// "Personal trainer drops off pet at home if student leaves the game": a paid session that
// finished while the student was away. Called once when the game opens.
export function dropOffIfFinishedWhileAway(studentId: string): boolean {
  const g = gymRowOf(studentId);
  if (!g.petId || !g.trick || !g.readyAt || Date.now() < g.readyAt) return false;
  const r = creditSession(g.petId, g.trick);
  useStore.getState().mergeStyleRow(feeOwner(studentId), { petId: g.petId, trick: g.trick, done: r.done, need: r.need, learned: r.learned });
  clearGym(studentId);
  return true;
}

// ---- gym treats (earned by answering, fed after a session): `pettreats:<studentId>` ----
export const treatsOwner = (studentId: string) => `pettreats:${studentId}`;
export function useTreats(studentId: string | null | undefined): number {
  return useStore((s) => (studentId ? ((s.styleLooks.find((r) => r.ownerId === treatsOwner(studentId))?.look as { treats?: number } | undefined)?.treats ?? 0) : 0));
}
export function addTreats(studentId: string, n: number) {
  const st = useStore.getState();
  const cur = (st.styleLooks.find((r) => r.ownerId === treatsOwner(studentId))?.look as { treats?: number } | undefined)?.treats ?? 0;
  st.mergeStyleRow(treatsOwner(studentId), { treats: Math.max(0, cur + n) });
}
