import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import ImageUploadField from '../../components/ImageUploadField';
import { ActivityLibraryPanel, activityToTaskSnapshot, TaskEditor } from './ActivityLibrary';
import { parseCSV, downloadCSV } from '../../lib/csv';
import { rowsToQuizQuestions, rowsToDrillCards, QUIZ_TEMPLATE_ROWS, DRILL_TEMPLATE_ROWS } from '../../lib/importQuestions';
import { currentDayOfWeek } from '../../lib/dates';
import type { Subject, Task, QuizQuestion, DrillCard, DayOfWeek } from '../../types';
import { WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_LABELS } from '../../types';

function SetCard({ subject }: { subject: Subject }) {
  const questionSets = useStore((s) => s.questionSets);
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const deleteQuestionSet = useStore((s) => s.deleteQuestionSet);
  const [editingCoverId, setEditingCoverId] = useState<string | null>(null);

  const sets = questionSets.filter((s) => s.subject === subject);

  if (sets.length === 0) return <p style={{ opacity: 0.7 }}>No saved sets for this subject yet.</p>;

  return (
    <div className="set-card-grid">
      {sets.map((set) => (
        <div className="set-card" key={set.id}>
          {set.coverImageUrl ? (
            <img className="set-card-cover" src={set.coverImageUrl} alt="" />
          ) : (
            <div className="set-card-cover-fallback">{set.kind === 'quiz' ? '🧠' : '🗂️'}</div>
          )}
          <div className="set-card-body">
            <div className="set-card-title">{set.name}</div>
            <div className="set-card-meta">
              {set.kind === 'quiz' ? `${set.questions.length} question(s)` : `${set.cards.length} card(s)`}
            </div>
            {editingCoverId === set.id ? (
              <div className="stack">
                <ImageUploadField
                  label="Cover image"
                  value={set.coverImageUrl}
                  onChange={(url) => {
                    updateQuestionSet(set.id, { coverImageUrl: url || undefined });
                    if (url) setEditingCoverId(null);
                  }}
                />
                <button className="btn btn-sm" onClick={() => setEditingCoverId(null)}>Done</button>
              </div>
            ) : (
              <div className="set-card-actions">
                <button className="btn btn-sm" onClick={() => setEditingCoverId(set.id)}>🖼️ Cover</button>
                <button className="btn btn-sm btn-danger" onClick={() => deleteQuestionSet(set.id)}>Delete</button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function Importer({ subject, kind }: { subject: Subject; kind: 'quiz' | 'drill' }) {
  const addQuestionSet = useStore((s) => s.addQuestionSet);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [parsed, setParsed] = useState<{ questions: QuizQuestion[]; cards: DrillCard[] } | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rows = parseCSV(text);
      if (kind === 'quiz') setParsed({ questions: rowsToQuizQuestions(rows), cards: [] });
      else setParsed({ cards: rowsToDrillCards(rows), questions: [] });
    };
    reader.readAsText(file);
  };

  const save = () => {
    if (!parsed || !name.trim()) return;
    addQuestionSet({ name: name.trim(), subject, kind, questions: parsed.questions, cards: parsed.cards });
    setParsed(null);
    setName('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const count = kind === 'quiz' ? parsed?.questions.length ?? 0 : parsed?.cards.length ?? 0;

  return (
    <div className="content-well stack">
      <strong>{kind === 'quiz' ? '🧠 Import quiz questions' : '🗂️ Import flashcards'}</strong>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        {kind === 'quiz'
          ? 'Columns: Question, ChoiceA, ChoiceB, ChoiceC, ChoiceD, CorrectAnswer, ImageURL. Build it in Google Sheets, then File → Download → CSV.'
          : 'Columns: Front, Back, ImageURL. Good for math facts, grapheme/morpheme review, or vocabulary & etymology.'}
      </p>
      <div className="row-wrap">
        <button
          className="btn btn-sm"
          onClick={() => downloadCSV(kind === 'quiz' ? 'question-set-template.csv' : 'drill-set-template.csv', kind === 'quiz' ? QUIZ_TEMPLATE_ROWS : DRILL_TEMPLATE_ROWS)}
        >
          ⬇️ Download template CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
      {fileName && <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>Loaded: {fileName} — found {count} {kind === 'quiz' ? 'question(s)' : 'card(s)'}</p>}

      {parsed && (
        <div className="row-wrap">
          <input placeholder="Set name" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn btn-sm btn-primary" disabled={!name.trim() || count === 0} onClick={save}>
            💾 Save Set
          </button>
        </div>
      )}
    </div>
  );
}

function ContentLibrary({ subject }: { subject: Subject }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="chrome-frame stack" style={{ padding: 14 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 📚 Question & Drill Sets (reusable content you can insert into any quiz/drill activity)
      </button>
      {open && (
        <div className="stack">
          <SetCard subject={subject} />
          <div className="row-wrap" style={{ alignItems: 'stretch' }}>
            <div style={{ flex: 1, minWidth: 280 }}>
              <Importer subject={subject} kind="quiz" />
            </div>
            <div style={{ flex: 1, minWidth: 280 }}>
              <Importer subject={subject} kind="drill" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function defaultBacklogName(tasks: Task[]): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const preview = tasks.slice(0, 2).map((t) => t.title || '(untitled)').join(', ');
  return preview ? `${date} — ${preview}${tasks.length > 2 ? '…' : ''}` : date;
}

function WeeklyCalendar({ studentId, subject, studentName }: { studentId: string; subject: Subject; studentName: string }) {
  const planTemplates = useStore((s) => s.planTemplates);
  const weeklySchedule = useStore((s) => s.weeklySchedule);
  const setWeeklyScheduleDay = useStore((s) => s.setWeeklyScheduleDay);
  const applyTemplateToStudent = useStore((s) => s.applyTemplateToStudent);
  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null);

  const backlog = planTemplates.filter((t) => t.subject === subject);
  const today = currentDayOfWeek();

  const assignedFor = (day: DayOfWeek) => {
    const templateId = weeklySchedule.find((w) => w.studentId === studentId && w.subject === subject && w.day === day)?.templateId;
    return templateId ? backlog.find((t) => t.id === templateId) ?? null : null;
  };

  return (
    <div className="zone zone-week stack">
      <div className="zone-header-bar">📅 This Week — {studentName}'s recurring plan</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Assign a backlog entry to each weekday — it loads into "Today's Plan" below automatically the first time{' '}
          {studentName} logs in that day. A day left blank stays whatever you set it to by hand. You can still tweak
          a single day's copy afterward (like swapping a link) without changing the backlog entry or any other day.
        </p>
        <div className="week-calendar">
          {WEEKDAYS.map((day) => {
            const entry = assignedFor(day);
            return (
              <div key={day} className={`week-day-card ${today === day ? 'week-day-card-today' : ''}`}>
                <div className="week-day-card-header">{WEEKDAY_SHORT[day]}{today === day ? ' •' : ''}</div>
                {editingDay === day ? (
                  <select
                    autoFocus
                    value={entry?.id ?? ''}
                    onChange={(e) => {
                      setWeeklyScheduleDay(studentId, subject, day, e.target.value || null);
                      setEditingDay(null);
                    }}
                    onBlur={() => setEditingDay(null)}
                  >
                    <option value="">— manual —</option>
                    {backlog.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                ) : entry ? (
                  <>
                    <div className="week-day-preview">
                      {entry.activities.slice(0, 6).map((a) => <span key={a.id}>{a.icon}</span>)}
                      {entry.activities.length === 0 && <span style={{ opacity: 0.5 }}>(empty)</span>}
                    </div>
                    <div className="week-day-name">{entry.name}</div>
                    <div className="row-wrap">
                      <button className="btn btn-sm" onClick={() => setEditingDay(day)}>Change</button>
                      <button className="btn btn-sm btn-danger" onClick={() => setWeeklyScheduleDay(studentId, subject, day, null)}>Clear</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="week-day-empty">— no plan set —</p>
                    <button className="btn btn-sm btn-primary" disabled={backlog.length === 0} onClick={() => setEditingDay(day)}>
                      + Assign
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        {backlog.length === 0 && (
          <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Save today's plan to the Backlog below first, then assign it to days here.</p>
        )}
        {today && (
          <button
            className="btn btn-sm"
            disabled={!assignedFor(today)}
            onClick={() => {
              const entry = assignedFor(today);
              if (entry) applyTemplateToStudent(studentId, entry.id);
            }}
          >
            ▶️ Load {WEEKDAY_LABELS[today]}'s plan now
          </button>
        )}
      </div>
    </div>
  );
}

function BacklogPanel({ studentId, subject, currentTasks }: { studentId: string; subject: Subject; currentTasks: Task[] }) {
  const [open, setOpen] = useState(true);
  const students = useStore((s) => s.students);
  const planTemplates = useStore((s) => s.planTemplates);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const addTemplate = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const duplicateTemplate = useStore((s) => s.duplicateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const applyTemplateToStudents = useStore((s) => s.applyTemplateToStudents);
  const [applyTargetId, setApplyTargetId] = useState<string | null>(null);
  const [applyToIds, setApplyToIds] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [addFromLibraryId, setAddFromLibraryId] = useState('');

  const backlog = planTemplates.filter((t) => t.subject === subject);
  const libraryForSubject = activityLibrary.filter((a) => a.subject === subject);

  const toggleApplyTarget = (id: string) =>
    setApplyToIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="zone zone-backlog stack">
      <button className="zone-header-btn zone-header-bar" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 🗃️ Backlog ({backlog.length}) — previous assignments you can reuse
      </button>
      <div style={{ padding: 14 }} className="stack">
        <button
          className="btn btn-sm"
          disabled={currentTasks.length === 0}
          onClick={() => addTemplate(defaultBacklogName(currentTasks), subject, currentTasks)}
        >
          💾 Save today's plan to backlog
        </button>
        {open && (
          backlog.length === 0 ? (
            <p style={{ opacity: 0.7 }}>Nothing saved yet — save today's plan above to start your backlog.</p>
          ) : (
            <div className="stack">
              {backlog.map((t) => {
                const expanded = expandedId === t.id;
                return (
                  <div key={t.id} className="content-well stack">
                    <div className="space-between">
                      {renamingId === t.id ? (
                        <div className="row-wrap">
                          <input value={renameDraft} onChange={(e) => setRenameDraft(e.target.value)} />
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              updateTemplate(t.id, { name: renameDraft.trim() || t.name });
                              setRenamingId(null);
                            }}
                          >
                            ✓
                          </button>
                          <button className="btn btn-sm" onClick={() => setRenamingId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <span><strong>{t.name}</strong> — {t.activities.length} activities</span>
                      )}
                      {applyTargetId !== t.id && (
                        <div className="row-wrap">
                          <button className="btn btn-sm" onClick={() => { setRenamingId(t.id); setRenameDraft(t.name); }}>✏️ Rename</button>
                          <button className="btn btn-sm" onClick={() => setExpandedId(expanded ? null : t.id)}>
                            {expanded ? '▾ Hide activities' : '▸ Edit activities'}
                          </button>
                          <button className="btn btn-sm" onClick={() => duplicateTemplate(t.id)}>⧉ Duplicate</button>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => {
                              setApplyTargetId(t.id);
                              setApplyToIds([studentId]);
                            }}
                          >
                            ▶️ Load into Today's Plan
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteTemplate(t.id)}>Delete</button>
                        </div>
                      )}
                    </div>

                    {applyTargetId === t.id && (
                      <div className="content-well stack" style={{ background: '#faf9ff' }}>
                        <strong style={{ fontSize: '0.85rem' }}>Load "{t.name}" into Today's Plan for:</strong>
                        <div className="row-wrap">
                          {students.map((st) => (
                            <label key={st.id} className="row" style={{ gap: 4, fontWeight: 700 }}>
                              <input type="checkbox" checked={applyToIds.includes(st.id)} onChange={() => toggleApplyTarget(st.id)} />
                              {st.avatar} {st.name}
                            </label>
                          ))}
                        </div>
                        <div className="row-wrap">
                          <button
                            className="btn btn-sm btn-success"
                            disabled={applyToIds.length === 0}
                            onClick={() => {
                              applyTemplateToStudents(applyToIds, t.id);
                              setApplyTargetId(null);
                            }}
                          >
                            Yes, load it for {applyToIds.length} student{applyToIds.length === 1 ? '' : 's'}
                          </button>
                          <button className="btn btn-sm" onClick={() => setApplyTargetId(null)}>Cancel</button>
                        </div>
                      </div>
                    )}

                    {expanded && (
                      <div className="stack" style={{ paddingLeft: 8, borderLeft: '3px solid var(--content-border)' }}>
                        {t.activities.length === 0 && <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No activities here yet.</p>}
                        {t.activities.map((a, i) => (
                          <div key={a.id} className="content-well stack">
                            <div className="space-between">
                              <span>{a.icon} {a.title || '(untitled)'}</span>
                              <div className="row-wrap">
                                <button
                                  className="btn btn-sm"
                                  disabled={i === 0}
                                  onClick={() => {
                                    const next = [...t.activities];
                                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                    updateTemplate(t.id, { activities: next });
                                  }}
                                >
                                  ⬆️
                                </button>
                                <button
                                  className="btn btn-sm"
                                  disabled={i === t.activities.length - 1}
                                  onClick={() => {
                                    const next = [...t.activities];
                                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                                    updateTemplate(t.id, { activities: next });
                                  }}
                                >
                                  ⬇️
                                </button>
                                <button className="btn btn-sm" onClick={() => setEditingActivityId(editingActivityId === a.id ? null : a.id)}>Edit</button>
                                <button
                                  className="btn btn-sm btn-danger"
                                  onClick={() => updateTemplate(t.id, { activities: t.activities.filter((x) => x.id !== a.id) })}
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                            {editingActivityId === a.id && (
                              <TaskEditor
                                initial={a}
                                subject={subject}
                                onSave={(nt) => {
                                  updateTemplate(t.id, { activities: t.activities.map((x) => (x.id === a.id ? nt : x)) });
                                  setEditingActivityId(null);
                                }}
                                onCancel={() => setEditingActivityId(null)}
                              />
                            )}
                          </div>
                        ))}
                        <div className="row-wrap">
                          <select value={addFromLibraryId} onChange={(e) => setAddFromLibraryId(e.target.value)}>
                            <option value="">+ Add activity from the Library…</option>
                            {libraryForSubject.map((a) => <option key={a.id} value={a.id}>{a.title || '(untitled)'}</option>)}
                          </select>
                          <button
                            className="btn btn-sm btn-primary"
                            disabled={!addFromLibraryId}
                            onClick={() => {
                              const lib = libraryForSubject.find((a) => a.id === addFromLibraryId);
                              if (!lib) return;
                              updateTemplate(t.id, { activities: [...t.activities, activityToTaskSnapshot(lib)] });
                              setAddFromLibraryId('');
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

type ViewTab = 'today' | 'library' | 'week' | 'backlog' | 'sets';

// The daily-driver view: exactly what the student's plan looks like right
// now, with a quick search-to-add so the common case (put an existing
// activity on today's plan) never requires leaving this tab.
function TodaysPlanView({ studentId, subject, studentName }: { studentId: string; subject: Subject; studentName: string }) {
  const rotations = useStore((s) => s.rotations);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const reorderTasks = useStore((s) => s.reorderTasks);
  const addActivityToPlan = useStore((s) => s.addActivityToPlan);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [search, setSearch] = useState('');

  const tasks = rotations[studentId]?.[subject] ?? [];
  const searchMatches = search.trim()
    ? activityLibrary.filter((a) => a.subject === subject && a.title.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : [];

  return (
    <div className="zone zone-today stack">
      <div className="zone-header-bar">✅ Today's Plan — exactly what {studentName} sees right now</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Give an activity a number to require that order (1, 2, 3…). Leave the number blank and it becomes a free
          choice the student can do anytime after every numbered activity is finished.
        </p>

        <div style={{ position: 'relative' }}>
          <input
            placeholder={`🔍 Search ${subject === 'math' ? 'Math' : 'Literacy'} activities to add to today's plan…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
          {searchMatches.length > 0 && (
            <div className="search-add-dropdown">
              {searchMatches.map((a) => (
                <button
                  key={a.id}
                  className="search-add-row"
                  onClick={() => {
                    addActivityToPlan(studentId, subject, a.id);
                    setSearch('');
                  }}
                >
                  <span>{a.icon}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>{a.title || '(untitled)'}</span>
                  <span className="tag-pill" style={{ fontSize: '0.65rem' }}>➕ Add</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className={`stack drop-zone ${dragOver ? 'drop-zone-active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const activityId = e.dataTransfer.getData('text/plain');
            if (activityId) addActivityToPlan(studentId, subject, activityId);
          }}
        >
          {tasks.length === 0 && (
            <p className="chrome-frame" style={{ padding: 14, opacity: 0.7, textAlign: 'center' }}>
              No activities yet. Search above, or head to the 🗂️ Activity Library or 🗃️ Backlog tabs to add a full set at once.
            </p>
          )}
          {tasks.map((t, i) => (
            <div key={t.id} className="chrome-frame stack" style={{ padding: 14 }}>
              <div className="space-between">
                <div className="row">
                  <div className="stack" style={{ gap: 2, alignItems: 'center' }}>
                    <label style={{ fontSize: '0.65rem', opacity: 0.7 }}>Order</label>
                    <input
                      type="number"
                      min={1}
                      value={t.order ?? ''}
                      placeholder="—"
                      style={{ width: 54 }}
                      onChange={(e) =>
                        updateTask(studentId, subject, t.id, { order: e.target.value ? parseInt(e.target.value) : undefined })
                      }
                    />
                  </div>
                  <span style={{ fontSize: '1.6rem' }}>{t.icon}</span>
                  <div>
                    <strong>{t.title || '(untitled)'}</strong>
                    <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                      {t.type === 'quiz' && `Quiz · ${t.quiz?.questions.length ?? 0} question(s)`}
                      {t.type === 'link' && `External link`}
                      {t.type === 'offscreen' && `Off-screen / paper`}
                      {t.type === 'video' && `Video`}
                      {t.type === 'passage' && `Passage · ${t.quiz?.questions.length ?? 0} question(s)`}
                      {t.type === 'drill' && `Flashcard drill · ${t.drill?.cards.length ?? 0} card(s)`}
                      {t.type === 'wordchain' && `Word chain · ${t.wordchain?.steps.length ?? 0} step(s)`}
                      {t.type === 'sentenceEdit' && `Editing sentences`}
                      {t.referenceImageUrl && ' · 🖼️'}
                      {t.referenceLinkUrl && ' · 🔗'}
                      {t.isDaily && ' · ⭐'}
                    </div>
                  </div>
                </div>
                <div className="row-wrap">
                  <button className="btn btn-sm" disabled={i === 0} onClick={() => reorderTasks(studentId, subject, i, i - 1)}>⬆️</button>
                  <button className="btn btn-sm" disabled={i === tasks.length - 1} onClick={() => reorderTasks(studentId, subject, i, i + 1)}>⬇️</button>
                  <button className="btn btn-sm" onClick={() => setEditingTaskId(editingTaskId === t.id ? null : t.id)}>
                    {editingTaskId === t.id ? 'Close' : 'Edit'}
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteTask(studentId, subject, t.id)}>Delete</button>
                </div>
              </div>
              {editingTaskId === t.id && (
                <TaskEditor
                  initial={t}
                  subject={subject}
                  onSave={(nt) => {
                    updateTask(studentId, subject, nt.id, nt);
                    setEditingTaskId(null);
                  }}
                  onCancel={() => setEditingTaskId(null)}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LessonPlanBuilder() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);

  const [subj, setSubj] = useState<Subject>('math');
  const [view, setView] = useState<ViewTab>('today');

  const student = students.find((s) => s.id === studentId);

  if (!student) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container">
          <p>Student not found.</p>
          <button className="btn" onClick={() => navigate('/teacher/students')}>← Back to students</button>
        </div>
      </div>
    );
  }

  const tasks = rotations[student.id]?.[subj] ?? [];

  const TABS: { id: ViewTab; label: string }[] = [
    { id: 'today', label: `✅ Today's Plan${tasks.length ? ` (${tasks.length})` : ''}` },
    { id: 'week', label: '📅 Weekly Schedule' },
    { id: 'backlog', label: '🗃️ Backlog' },
    { id: 'library', label: '🗂️ Activity Library' },
    { id: 'sets', label: '📚 Content Sets' },
  ];

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="space-between">
          <h1>{student.avatar} {student.name} — Assignments</h1>
          <button className="btn btn-sm" onClick={() => navigate('/teacher')}>← Overview</button>
        </div>

        <div className="subject-tabs">
          <button className={`subject-tab-btn tab-math ${subj === 'math' ? 'active' : ''}`} onClick={() => setSubj('math')}>🔢 Math</button>
          <button className={`subject-tab-btn tab-literacy ${subj === 'literacy' ? 'active' : ''}`} onClick={() => setSubj('literacy')}>📚 Literacy</button>
        </div>

        <div className="lp-tabs">
          {TABS.map((t) => (
            <button key={t.id} className={`lp-tab-btn ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {view === 'today' && <TodaysPlanView studentId={student.id} subject={subj} studentName={student.name} />}
        {view === 'week' && <WeeklyCalendar studentId={student.id} subject={subj} studentName={student.name} />}
        {view === 'backlog' && <BacklogPanel studentId={student.id} subject={subj} currentTasks={tasks} />}
        {view === 'library' && <ActivityLibraryPanel subject={subj} tasks={tasks} defaultStudentId={student.id} />}
        {view === 'sets' && <ContentLibrary subject={subj} />}
      </div>
    </div>
  );
}
