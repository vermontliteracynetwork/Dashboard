import type { BadgeRule, Student, Subject } from '../types';

export interface BadgeMetricsContext {
  student: Student;
  totalTasksCompleted: number; // lifetime, all subjects
  tasksCompletedTodayBySubject: Partial<Record<Subject, number>>;
  subjectsCompletedCount: number; // lifetime, all subjects
  subjectsCompletedCountBySubject: Partial<Record<Subject, number>>;
  finalChecksPassed: number; // lifetime, all subjects
  finalChecksPassedBySubject: Partial<Record<Subject, number>>;
  toolsUsedCount: number;
  correctionsCount: number;
}

// Pure evaluator — given the current metrics for a student, is this rule's
// condition true right now? Kept separate from the store so it's easy to
// reason about (and test) independent of when/how it gets called.
export function ruleMet(rule: BadgeRule, ctx: BadgeMetricsContext): boolean {
  switch (rule.type) {
    case 'streak':
      return ctx.student.streak >= rule.threshold;
    case 'tasksCompletedTotal':
      return ctx.totalTasksCompleted >= rule.threshold;
    case 'tasksCompletedToday': {
      const count = rule.subject
        ? ctx.tasksCompletedTodayBySubject[rule.subject] ?? 0
        : Object.values(ctx.tasksCompletedTodayBySubject).reduce((sum: number, v) => sum + (v ?? 0), 0);
      return count >= rule.threshold;
    }
    case 'subjectsCompletedTotal': {
      const count = rule.subject ? ctx.subjectsCompletedCountBySubject[rule.subject] ?? 0 : ctx.subjectsCompletedCount;
      return count >= rule.threshold;
    }
    case 'finalChecksPassed': {
      const count = rule.subject ? ctx.finalChecksPassedBySubject[rule.subject] ?? 0 : ctx.finalChecksPassed;
      return count >= rule.threshold;
    }
    case 'toolsUsed':
      return ctx.toolsUsedCount >= rule.threshold;
    case 'correctionsMade':
      return ctx.correctionsCount >= rule.threshold;
    default:
      return false;
  }
}
