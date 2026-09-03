import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { AVATAR_OPTIONS } from '../../store/badges';
import { makeId } from '../../lib/id';
import { ALL_TOOL_KEYS, TOOL_LABELS } from '../../types';
import type { CustomTool, Subject, Student } from '../../types';

function CustomToolsEditor({ student }: { student: Student }) {
  const updateStudent = useStore((s) => s.updateStudent);
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [subject, setSubject] = useState<Subject | 'both'>('both');

  const add = () => {
    if (!label.trim() || !url.trim()) return;
    const tool: CustomTool = { id: makeId(), label: label.trim(), url: url.trim(), subject };
    updateStudent(student.id, { customTools: [...student.customTools, tool] });
    setLabel('');
    setUrl('');
  };

  const remove = (id: string) => updateStudent(student.id, { customTools: student.customTools.filter((t) => t.id !== id) });

  return (
    <div className="stack">
      <strong>More Tools (custom links)</strong>
      <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
        Add any external link — Amplify, Polypad, a research article — as its own button in this student's Tools
        menu. It opens in the internal browser, same as an activity.
      </p>
      {student.customTools.length > 0 && (
        <div className="stack">
          {student.customTools.map((t) => (
            <div key={t.id} className="content-well space-between">
              <span>🔗 <strong>{t.label}</strong> <span className="tag-pill">{t.subject === 'both' ? 'Math + Literacy' : t.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span></span>
              <button className="btn btn-sm btn-danger" onClick={() => remove(t.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
      <div className="row-wrap">
        <input placeholder="Label (e.g. Polypad)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} style={{ minWidth: 220 }} />
        <select value={subject} onChange={(e) => setSubject(e.target.value as Subject | 'both')}>
          <option value="both">Math + Literacy</option>
          <option value="math">Math only</option>
          <option value="literacy">Literacy only</option>
        </select>
        <button className="btn btn-sm btn-primary" disabled={!label.trim() || !url.trim()} onClick={add}>➕ Add</button>
      </div>
    </div>
  );
}

function AddStudentForm() {
  const addStudent = useStore((s) => s.addStudent);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);

  return (
    <div className="chrome-frame stack" style={{ padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>➕ Add a Student</h3>
      <div className="row-wrap">
        <input placeholder="Student's name" value={name} onChange={(e) => setName(e.target.value)} />
        <select value={avatar} onChange={(e) => setAvatar(e.target.value)}>
          {AVATAR_OPTIONS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <span className="avatar-sm">{avatar}</span>
        <button
          className="btn btn-primary"
          disabled={!name.trim()}
          onClick={() => {
            addStudent(name.trim(), avatar);
            setName('');
          }}
        >
          Add Student
        </button>
      </div>
    </div>
  );
}

export default function StudentManager() {
  const students = useStore((s) => s.students);
  const updateStudent = useStore((s) => s.updateStudent);
  const deleteStudent = useStore((s) => s.deleteStudent);
  const setFeatureToggle = useStore((s) => s.setFeatureToggle);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>Students</h1>
        <AddStudentForm />

        {students.map((st) => (
          <div key={st.id} className="chrome-frame stack" style={{ padding: 18 }}>
            <div className="space-between">
              <div className="row">
                <span className="avatar-sm" style={{ width: 56, height: 56, fontSize: '1.8rem' }}>{st.avatar}</span>
                <strong>{st.name}</strong>
              </div>
              <div className="row-wrap">
                <button className="btn btn-sm" onClick={() => setExpanded(expanded === st.id ? null : st.id)}>
                  {expanded === st.id ? 'Close' : 'Edit'}
                </button>
                {confirmDelete === st.id ? (
                  <>
                    <span style={{ fontSize: '0.85rem' }}>Delete for good?</span>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteStudent(st.id)}>Yes, delete</button>
                    <button className="btn btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(st.id)}>Delete</button>
                )}
              </div>
            </div>

            {expanded === st.id && (
              <div className="content-well stack">
                <div className="row-wrap">
                  <div>
                    <label>Name</label>
                    <input value={st.name} onChange={(e) => updateStudent(st.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <label>Avatar</label>
                    <select value={st.avatar} onChange={(e) => updateStudent(st.id, { avatar: e.target.value })}>
                      {AVATAR_OPTIONS.map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Streak</label>
                    <input
                      type="number"
                      style={{ width: 80 }}
                      value={st.streak}
                      onChange={(e) => updateStudent(st.id, { streak: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label>Break length (min)</label>
                    <input
                      type="number"
                      style={{ width: 80 }}
                      value={st.breakMinutes}
                      onChange={(e) => updateStudent(st.id, { breakMinutes: parseInt(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={st.streakHidden}
                    onChange={(e) => updateStudent(st.id, { streakHidden: e.target.checked })}
                  />{' '}
                  Hide streak from this student
                </label>

                <hr className="divider" />
                <strong>Feature Toggles</strong>
                <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
                  Everything is on by default. Turn off anything this student doesn't need.
                </p>
                <div className="row-wrap">
                  {ALL_TOOL_KEYS.map((tool) => (
                    <label key={tool} className="tag-pill" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={st.featureToggles[tool] !== false}
                        onChange={(e) => setFeatureToggle(st.id, tool, e.target.checked)}
                        style={{ marginRight: 6 }}
                      />
                      {TOOL_LABELS[tool]}
                    </label>
                  ))}
                </div>

                <hr className="divider" />
                <CustomToolsEditor student={st} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
