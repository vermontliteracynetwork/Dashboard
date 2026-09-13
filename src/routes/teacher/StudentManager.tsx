import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { AVATAR_CATALOG } from '../../store/badges';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import { makeId } from '../../lib/id';
import { todayISO } from '../../lib/dates';
import { ALL_TOOL_KEYS, TOOL_LABELS } from '../../types';
import type { CustomTool, Subject, Student } from '../../types';

// Adds `days - 1` days to an ISO date — used to default a new focus set's
// window to a week (today through six days out) without pulling in a date
// library for one calculation.
function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tagListToText(list: string[]): string {
  return list.join(', ');
}
function textToTagList(text: string): string[] {
  return text.split(',').map((w) => w.trim()).filter(Boolean);
}

// Weekly phonics pattern / morpheme / practice-word focus for one student
// (see LiteracyFocusSet). Editing while today falls inside an existing
// window edits that window in place; otherwise "Publish" starts a new one.
function LiteracyFocusEditor({ student }: { student: Student }) {
  const literacyFocusSets = useStore((s) => s.literacyFocusSets);
  const publishLiteracyFocusSet = useStore((s) => s.publishLiteracyFocusSet);
  const deleteLiteracyFocusSet = useStore((s) => s.deleteLiteracyFocusSet);

  const today = todayISO();
  const mine = literacyFocusSets.filter((f) => f.studentId === student.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const active = mine.find((f) => f.startDate <= today && today <= f.endDate) ?? null;

  const [startDate, setStartDate] = useState(active?.startDate ?? today);
  const [endDate, setEndDate] = useState(active?.endDate ?? addDaysISO(today, 6));
  const [phonics, setPhonics] = useState(tagListToText(active?.phonicsPatterns ?? []));
  const [morphemes, setMorphemes] = useState(tagListToText(active?.morphemes ?? []));
  const [words, setWords] = useState(tagListToText(active?.practiceWords ?? []));

  const publish = () => {
    publishLiteracyFocusSet(student.id, startDate, endDate, textToTagList(phonics), textToTagList(morphemes), textToTagList(words));
  };

  const others = mine.filter((f) => f.id !== active?.id);

  return (
    <div className="stack">
      <strong>📚 Weekly Literacy Focus</strong>
      <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
        This student's phonics pattern(s), morpheme(s), and practice/spelling words for a date window, shown to
        them as a quick reference while they work on Literacy.
      </p>
      <div className="row-wrap">
        <div>
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div>
          <label>End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label>Phonics pattern(s), comma-separated</label>
        <input style={{ width: '100%' }} value={phonics} onChange={(e) => setPhonics(e.target.value)} placeholder="e.g. -ild, -ost" />
      </div>
      <div>
        <label>Morpheme(s), comma-separated</label>
        <input style={{ width: '100%' }} value={morphemes} onChange={(e) => setMorphemes(e.target.value)} placeholder="e.g. -ed, -est" />
      </div>
      <div>
        <label>Practice / spelling words, comma-separated</label>
        <input style={{ width: '100%' }} value={words} onChange={(e) => setWords(e.target.value)} placeholder="e.g. child, mild, wildest" />
      </div>
      <div className="row-wrap">
        <button className="btn btn-sm btn-primary" disabled={!startDate || !endDate} onClick={publish}>
          {active ? '💾 Update this week\'s focus' : '➕ Publish focus set'}
        </button>
        {active && (
          <button className="btn btn-sm btn-danger" onClick={() => deleteLiteracyFocusSet(active.id)}>Delete</button>
        )}
      </div>

      {others.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '0.85rem' }}>Past focus sets ({others.length})</summary>
          <div className="stack" style={{ marginTop: 8 }}>
            {others.map((f) => (
              <div key={f.id} className="content-well space-between">
                <span style={{ fontSize: '0.85rem' }}>
                  <strong>{f.startDate} → {f.endDate}</strong>
                  {f.phonicsPatterns.length > 0 && <> · Phonics: {tagListToText(f.phonicsPatterns)}</>}
                  {f.morphemes.length > 0 && <> · Morphemes: {tagListToText(f.morphemes)}</>}
                </span>
                <button className="btn btn-sm btn-danger" onClick={() => deleteLiteracyFocusSet(f.id)}>Delete</button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

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
        Add any external link (Amplify, Polypad, a research article) as its own button in this student's Tools
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
  const [avatar, setAvatar] = useState(AVATAR_CATALOG[0].id);

  return (
    <div className="chrome-frame stack" style={{ padding: 18 }}>
      <h3 style={{ marginTop: 0 }}>➕ Add a Student</h3>
      <div className="row-wrap">
        <input placeholder="Student's name" value={name} onChange={(e) => setName(e.target.value)} />
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
      <div className="row-wrap">
        {AVATAR_CATALOG.map((a) => (
          <button
            key={a.id}
            className="avatar-sm stack"
            style={{
              width: 62,
              height: 68,
              flexDirection: 'column',
              gap: 2,
              outline: a.id === avatar ? '3px solid var(--purple)' : 'none',
            }}
            aria-label={a.name}
            onClick={() => setAvatar(a.id)}
          >
            <AvatarGlyph value={a.id} size={36} />
            <span style={{ fontSize: '0.58rem', fontWeight: 700, lineHeight: 1.1, textAlign: 'center' }}>{a.name}</span>
          </button>
        ))}
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
                <span className="avatar-sm" style={{ width: 56, height: 56 }}><AvatarGlyph value={st.avatar} /></span>
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
                    <div className="row-wrap">
                      {AVATAR_CATALOG.map((a) => (
                        <button
                          key={a.id}
                          className="avatar-sm stack"
                          style={{
                            width: 56,
                            height: 62,
                            flexDirection: 'column',
                            gap: 2,
                            outline: a.id === st.avatar ? '3px solid var(--purple)' : 'none',
                          }}
                          aria-label={a.name}
                          onClick={() => updateStudent(st.id, { avatar: a.id })}
                        >
                          <AvatarGlyph value={a.id} size={32} />
                          <span style={{ fontSize: '0.56rem', fontWeight: 700, lineHeight: 1.1, textAlign: 'center' }}>{a.name}</span>
                        </button>
                      ))}
                    </div>
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
                <strong>Town Square</strong>
                <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
                  All on by default. Turn any of these down or off per student — Claudia's full-game
                  audit flagged that none of them had a teacher override yet.
                </p>
                <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
                  <div>
                    <label>Talk reward (¢ per NPC/day)</label>
                    <input
                      type="number"
                      min={0}
                      style={{ width: 90 }}
                      value={st.worldTalkRewardCents}
                      onChange={(e) => updateStudent(st.id, { worldTalkRewardCents: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={st.worldShowArrivalCard}
                    onChange={(e) => updateStudent(st.id, { worldShowArrivalCard: e.target.checked })}
                  />{' '}
                  Show the daily "start Math/Reading or free time" arrival card
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={st.worldShowDeskGlow}
                    onChange={(e) => updateStudent(st.id, { worldShowDeskGlow: e.target.checked })}
                  />{' '}
                  Glow/label the computer desk when tasks are waiting
                </label>

                <hr className="divider" />
                <CustomToolsEditor student={st} />

                <hr className="divider" />
                <LiteracyFocusEditor student={st} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
