import { useStore } from '../store/store';
import { todayISO } from './dates';

// Build Queue 730 (her words, on Live Class Overview: "add a button on the live view where i can press play mode/live
// mode. it should be a button that double clicks, always one option required"): a Learn mode / Play mode switch for
// each student. Learn (the usual rules: Learn is required Monday to Friday 7am to 3pm, Build Queue 661) is picked unless
// she picks Play, which opens Play mode for that student for the rest of the day. Saved in the `playmode:<studentId>`
// row, so it reaches the student's iPad.
export const playModeOwner = (studentId: string) => `playmode:${studentId}`;
export function useTeacherPlay(studentId?: string | null): boolean {
  return useStore((s) => {
    if (!studentId) return false;
    const r = s.styleLooks.find((x) => x.ownerId === playModeOwner(studentId))?.look as { mode?: string; day?: string } | undefined;
    return r?.mode === 'play' && r.day === todayISO();
  });
}
export function setTeacherPlay(studentId: string, play: boolean) {
  useStore.getState().mergeStyleRow(playModeOwner(studentId), { mode: play ? 'play' : 'learn', day: todayISO(), at: new Date().toISOString() });
}
