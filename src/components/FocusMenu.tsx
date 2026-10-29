import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/store';
import type { QuestionSet } from '../types';
import { useFocusStudents } from '../lib/questionFocus';

// Build Queue 337 (her words: "when i click the focus star, a menu should appear where i can select all student or
// select the students it is a focus for"). Build Queue 437 (her words: "when a focus start is selected, show the studnet
// names with a selcection check. save it for only that student(s). select all student for all. default is all. star must
// be pressed twice to have focus menu pop up in front of current cards"): one tap on the star opens this menu in front
// of everything (a centered window, never squeezed inside a card). Every student is listed with a check; All students is
// checked by default; Save keeps the focus for only the checked students (or everyone).
export default function FocusMenu({ set, onClose }: { set: QuestionSet; onClose: () => void; align?: 'left' | 'right' }) {
  const students = useStore((s) => s.students);
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const { map, set: setFor } = useFocusStudents();
  const saved = set.isFocus ? map[set.id] ?? [] : [];
  // An empty pick means All students.
  const [picked, setPicked] = useState<string[]>(saved);
  const all = picked.length === 0;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const save = () => {
    setFor(set.id, picked.length && picked.length < students.length ? picked : undefined);
    updateQuestionSet(set.id, { isFocus: true, focusedAt: set.isFocus ? set.focusedAt : new Date().toISOString() });
    onClose();
  };
  const unstar = () => { setFor(set.id, undefined); updateQuestionSet(set.id, { isFocus: false }); onClose(); };
  return createPortal(
    <div className="pf-overlay fm-wrap" onClick={onClose}>
      <div className="pf-panel fm-panel" role="dialog" aria-label={`Focus for ${set.name}`} onClick={(e) => e.stopPropagation()}>
        <h2>Focus: {set.name}</h2>
        <p className="fm-sub">Who is this a focus for?</p>
        <label className={`fm-row fm-all${all ? ' on' : ''}`}><input type="checkbox" checked={all} onChange={() => setPicked([])} /> All students</label>
        <div className="fm-list">
          {students.map((st) => (
            <label key={st.id} className={`fm-row${!all && picked.includes(st.id) ? ' on' : ''}`}>
              <input type="checkbox" checked={!all && picked.includes(st.id)} onChange={() => toggle(st.id)} /> {st.name}
            </label>
          ))}
        </div>
        <div className="fm-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={save}>Save{all ? ' for all students' : ` for ${picked.length} ${picked.length === 1 ? 'student' : 'students'}`}</button>
          {set.isFocus && <button type="button" className="btn" onClick={unstar}>Not a focus</button>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
