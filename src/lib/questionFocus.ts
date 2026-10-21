import { useStore } from '../store/store';
import type { QuestionSet, SymbolSettings } from '../types';

// Build Queue 337 (her words: "when i click the focus star, a menu should appear where i can select all student or
// select the students it is a focus for"): a starred set can be a focus for everyone or for chosen students only.
// The chosen students live in the `qs-focus` style row ({ map: { [setId]: studentId[] } }); no list means everyone,
// so older stars keep working and no new database column is needed.
const FOCUS_OWNER = 'qs-focus';
// Build Queue 338: per-student settings for a set (same questions, more or less support), in `qs-student-settings`
// ({ map: { [setId]: { [studentId]: Partial<SymbolSettings> } } }).
const SETTINGS_OWNER = 'qs-student-settings';

type FocusMap = Record<string, string[]>;
type SettingsMap = Record<string, Record<string, Partial<SymbolSettings>>>;
const rowOf = <T,>(owner: string): T => ((useStore.getState().styleLooks.find((r) => r.ownerId === owner)?.look as { map?: T } | undefined)?.map ?? ({} as T));

// Is this set a focus for the student (the one playing unless given)?
export function focusFor(qs: QuestionSet, studentId?: string | null): boolean {
  if (!qs.isFocus) return false;
  const list = rowOf<FocusMap>(FOCUS_OWNER)[qs.id];
  if (!list?.length) return true;
  const sid = studentId ?? useStore.getState().currentStudentId;
  return !sid || list.includes(sid);
}

export function useFocusStudents() {
  const map = useStore((s) => (s.styleLooks.find((r) => r.ownerId === FOCUS_OWNER)?.look as { map?: FocusMap } | undefined)?.map ?? {});
  const merge = useStore((s) => s.mergeStyleRow);
  return { map, set: (setId: string, ids: string[] | undefined) => { const m = { ...map }; if (ids?.length) m[setId] = ids; else delete m[setId]; merge(FOCUS_OWNER, { map: m }); } };
}

export function useStudentSettings() {
  const map = useStore((s) => (s.styleLooks.find((r) => r.ownerId === SETTINGS_OWNER)?.look as { map?: SettingsMap } | undefined)?.map ?? {});
  const merge = useStore((s) => s.mergeStyleRow);
  return {
    map,
    set: (setId: string, studentId: string, v: Partial<SymbolSettings> | undefined) => {
      const forSet = { ...(map[setId] ?? {}) };
      if (v) forSet[studentId] = v; else delete forSet[studentId];
      merge(SETTINGS_OWNER, { map: { ...map, [setId]: forSet } });
    },
  };
}

// The current student's own settings for the set a question belongs to (empty if none).
export function studentSettingsFor(questionId: string): Partial<SymbolSettings> {
  const st = useStore.getState();
  const sid = st.currentStudentId; if (!sid) return {};
  const set = st.questionSets.find((qs) => qs.questions.some((q) => q.id === questionId));
  return set ? rowOf<SettingsMap>(SETTINGS_OWNER)[set.id]?.[sid] ?? {} : {};
}
