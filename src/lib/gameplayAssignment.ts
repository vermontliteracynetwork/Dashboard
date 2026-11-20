// Helpers for gameplay-mode question-set assignments (direct teacher
// spec): a Quiz/Native-Game activity can be assigned so its questions are
// answered inside one specific native game, or pooled across every native
// game in the world, instead of the ordinary Quiz/Practice flow. See
// CompletionMode/NativeGameId in types.ts for the full shape.

import type { MCQuestion, NativeGameId, QuizRuntimeState, Subject, Task } from '../types';
import { pickWeighted, playableOf } from './questionPick';
import { isAssignmentsPaused } from './assignmentPause';
import { useStore } from '../store/store';

// Native games only render multiple-choice questions (QuestionScreen's
// choices/correctIndex shape) — a Matching/FillBlank question in the same
// set is simply not offered here, same as how QuizTask itself only shows
// what it can render.
export function gameplayQuestionPool(task: Task): MCQuestion[] {
  return playableOf(task.quiz?.questions ?? []);
}

// How many correct answers this task's gameplay mode needs — the whole
// set once when no explicit target was assigned.
export function gameplayTarget(task: Task): number {
  return task.targetQuestionCount ?? gameplayQuestionPool(task).length;
}

// Every correct log entry counts, including repeats past the set's own
// size — this is what lets a target higher than the set's question count
// cycle back through the same questions instead of stalling.
export function gameplayProgress(state: QuizRuntimeState | undefined): number {
  return state?.log.filter((l) => l.correct).length ?? 0;
}

// Picks a random question from the pool, with replacement (repeats are
// expected once the pool is smaller than the assigned target) — avoids
// immediately repeating the very last question shown when the pool has
// more than one question, purely so two in a row doesn't feel like a glitch.
export function pickGameplayQuestion(task: Task, avoidId?: string): MCQuestion | null {
  const pool = gameplayQuestionPool(task);
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];
  const choices = avoidId ? pool.filter((q) => q.id !== avoidId) : pool;
  const usable = choices.length > 0 ? choices : pool;
  // Build Queue 505: missed questions come back more often here too.
  return pickWeighted(usable);
}

// Build Queue 771 (her words: "if i select "Student picks the game ..." ALL questions students answer should continue
// their count. this can be in many games throughout the dashboard. as long as they are correct, they count"): every
// right answer on any question screen anywhere (every game, Town Square, quizzes) counts toward an open "Student picks
// the game" assignment, even when the question came from another set. QuestionScreen calls this on every right answer;
// the store skips a second count of the same answer when a game also reports it (submitGameplayAnswer).
export function countCorrectAnywhere(questionKey: string) {
  const st = useStore.getState(); const sid = st.currentStudentId; if (!sid || st.role !== 'student') return;
  if (isAssignmentsPaused(sid)) return;
  const subjects: Subject[] = ['math', 'literacy'];
  for (const subject of subjects) {
    const done = st.progress[sid]?.[subject]?.completedTaskIds ?? [];
    const task = (st.rotations[sid]?.[subject] ?? []).find((t) => t.completionMode === 'anyGame' && gameplayQuestionPool(t).length > 0 && !done.includes(t.id));
    if (task) { st.submitGameplayAnswer(sid, subject, task, questionKey, true); return; }
  }
}

// Finds the one active, not-yet-completed gameplay-mode task (if any) a
// student's answer in `nativeGameId` should count toward — a specific-game
// match for this exact game wins over an any-game match, and only one task
// is ever fed per answer. Scans both subjects since a native game isn't
// tied to one subject the way a Quiz task is.
export function findActiveGameplayTask(
  tasksBySubject: Record<Subject, Task[]>,
  completedIdsBySubject: Record<Subject, string[]>,
  nativeGameId: NativeGameId,
): { task: Task; subject: Subject } | null {
  // Build Queue 593: paused assignments put no assignment questions into games.
  if (isAssignmentsPaused(useStore.getState().currentStudentId)) return null;
  const subjects: Subject[] = ['math', 'literacy'];
  const isOpen = (t: Task, subject: Subject) =>
    (t.completionMode === 'specificGame' || t.completionMode === 'anyGame') &&
    gameplayQuestionPool(t).length > 0 &&
    !(completedIdsBySubject[subject] ?? []).includes(t.id);

  for (const subject of subjects) {
    const match = (tasksBySubject[subject] ?? []).find(
      (t) => isOpen(t, subject) && t.completionMode === 'specificGame' && t.nativeGameId === nativeGameId,
    );
    if (match) return { task: match, subject };
  }
  for (const subject of subjects) {
    const match = (tasksBySubject[subject] ?? []).find((t) => isOpen(t, subject) && t.completionMode === 'anyGame');
    if (match) return { task: match, subject };
  }
  return null;
}
