import { useState } from 'react';
import type { Task } from '../types';

// Rounds and questions per round in every native game (teacher 2026-10-08: "in all native game,
// give kids the setting for rounds (if possible, obviously that cannot work for chess) and number
// of questions per rounds (this can be changed as a master, not changable setting if the
// acttivities have been explicitly assigned to the students, but if the kids are just playing,
// they can choose it)"). Kids' own choices are remembered per game on that iPad. When the game is
// being played for an assignment, the assignment's own numbers (set by the teacher in the plan
// builder) are used and the sliders lock.

export interface RoundRange { min: number; max: number; def: number }
const clamp = (n: number, r: RoundRange) => Math.min(r.max, Math.max(r.min, Math.round(n)));
const read = (k: string, r: RoundRange) => { try { const n = Number(localStorage.getItem(k)); return n ? clamp(n, r) : r.def; } catch { return r.def; } };
const write = (k: string, n: number) => { try { localStorage.setItem(k, String(n)); } catch { /* fine */ } };

export function useRoundSettings(game: string, ranges: { rounds?: RoundRange; per: RoundRange }, assigned?: Task | null) {
  const [kidRounds, setKidRounds] = useState(() => (ranges.rounds ? read(`game.${game}.rounds`, ranges.rounds) : 0));
  const [kidPer, setKidPer] = useState(() => read(`game.${game}.per`, ranges.per));
  const locked = !!assigned;
  const rounds = ranges.rounds ? (locked ? clamp(assigned!.gameRounds ?? ranges.rounds.def, ranges.rounds) : kidRounds) : 0;
  const perRound = locked ? clamp(assigned!.gameQuestionsPerRound ?? ranges.per.def, ranges.per) : kidPer;
  return {
    rounds, perRound, locked,
    setRounds: (n: number) => { if (locked || !ranges.rounds) return; const v = clamp(n, ranges.rounds); setKidRounds(v); write(`game.${game}.rounds`, v); },
    setPerRound: (n: number) => { if (locked) return; const v = clamp(n, ranges.per); setKidPer(v); write(`game.${game}.per`, v); },
  };
}
