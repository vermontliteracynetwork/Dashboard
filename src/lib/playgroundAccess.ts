import type { Student, BreakRequest } from '../types';

export interface PlaygroundAccess {
  unlocked: boolean;
  unlimited: boolean; // true once both subjects are done today — no timer
  minutesRemaining: number | null; // null when unlimited or locked (rounded up, for copy like "3 more minutes")
  remainingMs: number | null; // null when unlimited or locked — precise, for a live-ticking countdown display
  totalMinutes: number | null; // the full length of the current timed window (the student's break length)
  source: 'both-done' | 'granted' | null;
}

// The Playground opens for the rest of the day once the whole day's
// assignment is finished (both subjects — a subject with nothing assigned
// counts as done, same as everywhere else). A teacher can also grant early
// access (before the assignment is done) for that student's configured
// break length.
export function getPlaygroundAccess(
  mathDone: boolean,
  litDone: boolean,
  student: Student,
  breakState: BreakRequest | null,
): PlaygroundAccess {
  if (mathDone && litDone) {
    return { unlocked: true, unlimited: true, minutesRemaining: null, remainingMs: null, totalMinutes: null, source: 'both-done' };
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
