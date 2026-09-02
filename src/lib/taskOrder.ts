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
