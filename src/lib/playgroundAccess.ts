import type { Student, SubjectProgress, BreakRequest } from '../types';

export const PARTIAL_UNLOCK_MINUTES = 20;

export interface PlaygroundAccess {
  unlocked: boolean;
  unlimited: boolean; // true once both subjects are done today — no timer
  minutesRemaining: number | null; // null when unlimited or locked (rounded up, for copy like "3 more minutes")
  remainingMs: number | null; // null when unlimited or locked — precise, for a live-ticking countdown display
  totalMinutes: number | null; // the full length of the current timed window (20, or the student's break length)
  source: 'both-done' | 'partial' | 'granted' | null;
}

// Finishing either subject's full daily plan opens the Playground for 20
// minutes; finishing both opens it for the rest of the day. A teacher can
// also grant early access (before either subject is done) for that
// student's configured break length.
export function getPlaygroundAccess(
  mathDone: boolean,
  litDone: boolean,
  mathProg: SubjectProgress | undefined,
  litProg: SubjectProgress | undefined,
  today: string,
  student: Student,
  breakState: BreakRequest | null,
): PlaygroundAccess {
  if (mathDone && litDone) {
    return { unlocked: true, unlimited: true, minutesRemaining: null, remainingMs: null, totalMinutes: null, source: 'both-done' };
  }

  const completedAts: string[] = [];
  if (mathDone && mathProg?.date === today && mathProg.completedAt) completedAts.push(mathProg.completedAt);
  if (litDone && litProg?.date === today && litProg.completedAt) completedAts.push(litProg.completedAt);

  if (completedAts.length > 0) {
    const earliest = completedAts.sort()[0];
    const remainingMs = PARTIAL_UNLOCK_MINUTES * 60_000 - (Date.now() - new Date(earliest).getTime());
    if (remainingMs > 0) {
      return {
        unlocked: true,
        unlimited: false,
        minutesRemaining: Math.ceil(remainingMs / 60_000),
        remainingMs,
        totalMinutes: PARTIAL_UNLOCK_MINUTES,
        source: 'partial',
      };
    }
  }

  if (breakState && (breakState.status === 'approved' || breakState.status === 'granted')) {
    const remainingMs = student.breakMinutes * 60_000 - (Date.now() - new Date(breakState.timestamp).getTime());
    if (remainingMs > 0) {
      return {
        unlocked: true,
        unlimited: false,
        minutesRemaining: Math.ceil(remainingMs / 60_000),
        remainingMs,
        totalMinutes: student.breakMinutes,
        source: 'granted',
      };
    }
  }

  return { unlocked: false, unlimited: false, minutesRemaining: null, remainingMs: null, totalMinutes: null, source: null };
}
