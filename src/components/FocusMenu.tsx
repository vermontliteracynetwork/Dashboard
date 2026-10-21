import { useEffect, useRef } from 'react';
import { useStore } from '../store/store';
import type { QuestionSet } from '../types';
import { useFocusStudents } from '../lib/questionFocus';

// Build Queue 337 (her words: "when i click the focus star, a menu should appear where i can select all student or
// select the students it is a focus for"). A small menu under the star: Not a focus, All students, or tick the
// students it is a focus for. Closes on a tap anywhere else.
export default function FocusMenu({ set, onClose, align = 'right' }: { set: QuestionSet; onClose: () => void; align?: 'left' | 'right' }) {
  const students = useStore((s) => s.students);
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const { map, set: setFor } = useFocusStudents();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const t = window.setTimeout(() => document.addEventListener('pointerdown', close), 0);
    return () => { window.clearTimeout(t); document.removeEventListener('pointerdown', close); };
  }, [onClose]);
  const chosen = map[set.id] ?? [];
  const star = (on: boolean) => updateQuestionSet(set.id, { isFocus: on, focusedAt: on && !set.isFocus ? new Date().toISOString() : set.focusedAt });
  const mode = !set.isFocus ? 'none' : chosen.length ? 'some' : 'all';
  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    setFor(set.id, next);
    star(next.length > 0);
  };
  return (
    <div ref={ref} className="focus-menu" style={{ [align]: 0 }} role="dialog" aria-label={`Focus for ${set.name}`} onClick={(e) => e.stopPropagation()}>
      <b>Focus for</b>
      <label><input type="radio" checked={mode === 'all'} onChange={() => { setFor(set.id, undefined); star(true); }} /> All students</label>
      <label><input type="radio" checked={mode === 'some'} onChange={() => { if (!chosen.length && students[0]) setFor(set.id, [students[0].id]); star(true); }} /> Some students</label>
      {mode === 'some' && (
        <div className="focus-menu-list">
          {students.map((st) => <label key={st.id}><input type="checkbox" checked={chosen.includes(st.id)} onChange={() => toggle(st.id)} /> {st.name}</label>)}
        </div>
      )}
      <label><input type="radio" checked={mode === 'none'} onChange={() => { setFor(set.id, undefined); star(false); }} /> Not a focus</label>
    </div>
  );
}
