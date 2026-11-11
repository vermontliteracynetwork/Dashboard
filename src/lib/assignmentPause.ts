import { useStore } from '../store/store';

// Build Queue 593 (her words: "in live class overview, let me pause all current assignments for each student so they
// can just be in plau mode"): one switch per student, saved in the `asgpause:<studentId>` row. While it is on, nothing
// counts as due (no pop up, no bar), games skip the assignment questions they would weave in, and Play mode is open.
export const pauseOwner = (studentId: string) => `asgpause:${studentId}`;
export function isAssignmentsPaused(studentId?: string | null): boolean {
  if (!studentId) return false;
  return !!(useStore.getState().styleLooks.find((r) => r.ownerId === pauseOwner(studentId))?.look as { on?: boolean } | undefined)?.on;
}
export function useAssignmentsPaused(studentId?: string | null): boolean {
  return useStore((s) => !!studentId && !!(s.styleLooks.find((r) => r.ownerId === pauseOwner(studentId))?.look as { on?: boolean } | undefined)?.on);
}
export function setAssignmentsPaused(studentId: string, on: boolean) {
  useStore.getState().mergeStyleRow(pauseOwner(studentId), { on, at: new Date().toISOString() });
}
