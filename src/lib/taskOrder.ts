import type { Task } from '../types';

// Numbered activities (task.order set) must be completed in ascending order.
// Once every numbered activity is done, every un-numbered activity unlocks
// as a free-choice board — pick anything, in any order.

export function nextRequiredTaskId(tasks: Task[], completedIds: string[]): string | null {
  const ordered = [...tasks.filter((t) => t.order != null)].sort((a, b) => a.order! - b.order!);
  const next = ordered.find((t) => !completedIds.includes(t.id));
  return next ? next.id : null;
}

export function isTaskLocked(task: Task, tasks: Task[], completedIds: string[]): boolean {
  if (completedIds.includes(task.id)) return false;
  const nextRequiredId = nextRequiredTaskId(tasks, completedIds);
  if (task.order != null) return nextRequiredId !== null && nextRequiredId !== task.id;
  return nextRequiredId !== null; // unordered: locked until every numbered task is done
}

// Ordered-by-number first (ascending), then unordered tasks in their existing relative order.
export function sortForDisplay(tasks: Task[]): Task[] {
  const ordered = tasks.filter((t) => t.order != null).sort((a, b) => a.order! - b.order!);
  const unordered = tasks.filter((t) => t.order == null);
  return [...ordered, ...unordered];
}

// A Final Check must always be the very last thing in the day's plan — bump
// its order above every other numbered task and move it to the end of the
// list, so a teacher never has to remember to place it last by hand.
export function enforceFinalCheckLast(tasks: Task[]): Task[] {
  const idx = tasks.findIndex((t) => t.isFinalCheck);
  if (idx === -1) return tasks;
  const maxOrder = tasks.reduce((max, t) => (t.isFinalCheck ? max : Math.max(max, t.order ?? 0)), 0);
  const finalCheckTask = { ...tasks[idx], order: maxOrder + 1 };
  const rest = tasks.filter((_, i) => i !== idx);
  return [...rest, finalCheckTask];
}
