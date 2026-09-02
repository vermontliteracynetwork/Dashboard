import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import QuizEditor from './QuizEditor';
import DrillEditor from './DrillEditor';
import StepsEditor from './StepsEditor';
import ImageUploadField from '../../components/ImageUploadField';
import { makeId } from '../../lib/id';
import { currentDayOfWeek } from '../../lib/dates';
import { parseCSV, downloadCSV } from '../../lib/csv';
import { rowsToQuizQuestions, rowsToDrillCards, QUIZ_TEMPLATE_ROWS, DRILL_TEMPLATE_ROWS } from '../../lib/importQuestions';
import type { Subject, Task, TaskType, QuizQuestion, DrillCard, ActivityLibraryItem, DayOfWeek } from '../../types';
import { TASK_TYPE_LABELS, WEEKDAYS, WEEKDAY_SHORT, WEEKDAY_LABELS } from '../../types';

const ICON_CHOICES = ['📘', '✏️', '🔤', '🔢', '➗', '🧩', '🎧', '🌍', '🖐️', '🎯', '🧠', '📐', '🗣️', '🎨', '▶️', '📖', '⛓️', '🩹'];

const blankTask = (): Task => ({
  id: makeId(),
  title: '',
  icon: ICON_CHOICES[0],
  type: 'quiz',
  quiz: { questions: [] },
  link: { url: '' },
  offscreen: { instructions: '' },
  video: { youtubeUrl: '' },
  passage: { title: '', text: '' },
  drill: { cards: [] },
  wordchain: { startWord: '', steps: [] },
  sentenceEdit: { original: '', corrected: '' },
  customSteps: [],
  referenceImageUrl: '',
  referenceLinkUrl: '',
  referenceLinkLabel: '',
});

// Turns a library item into a fresh, independent Task snapshot — used
// anywhere an activity is copied into a plan/template so later edits or
// deletes in the library never reach back into what was already handed out.
const activityToTaskSnapshot = (a: ActivityLibraryItem): Task => ({
  id: makeId(),
  title: a.title,
  icon: a.icon,
  type: a.type,
  quiz: a.quiz,
  link: a.link,
  offscreen: a.offscreen,
  video: a.video,
  passage: a.passage,
  drill: a.drill,
  wordchain: a.wordchain,
  sentenceEdit: a.sentenceEdit,
  customSteps: a.customSteps,
  referenceImageUrl: a.referenceImageUrl,
  referenceLinkUrl: a.referenceLinkUrl,
  referenceLinkLabel: a.referenceLinkLabel,
});

function TaskEditor({
  initial,
  subject,
  onSave,
  onCancel,
  matchExisting,
}: {
  initial: Task;
  subject: Subject;
  onSave: (t: Task) => void;
  onCancel: () => void;
  matchExisting?: (title: string) => Task | undefined;
}) {
  const [task, setTask] = useState<Task>(initial);
  const [showSteps, setShowSteps] = useState((initial.customSteps?.length ?? 0) > 0);
  const [matchedNotice, setMatchedNotice] = useState<string | null>(null);

  return (
    <div className="content-well stack">
      <div className="row-wrap">
        <div>
          <label>Icon</label>
          <select value={task.icon} onChange={(e) => setTask({ ...task, icon: e.target.value })}>
            {ICON_CHOICES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label>Title</label>
          <input
            style={{ width: '100%' }}
            value={task.title}
            onChange={(e) => setTask({ ...task, title: e.target.value })}
            onBlur={() => {
              if (!matchExisting) return;
              const trimmed = task.title.trim();
              if (!trimmed) return;
              const match = matchExisting(trimmed);
              if (match && match.id !== initial.id) {
                setTask({ ...match, id: task.id, title: trimmed });
                setShowSteps((match.customSteps?.length ?? 0) > 0);
                setMatchedNotice(`Filled in from your existing "${trimmed}" activity — directions, links, and settings all matched. Change anything you need for this one.`);
              }
            }}
            placeholder="e.g. Sound Drill Review"
          />
          {matchedNotice && (
            <p style={{ fontSize: '0.78rem', color: 'var(--purple-dark)', margin: '4px 0 0' }}>↩️ {matchedNotice}</p>
          )}
        </div>
        <div>
          <label>Type</label>
          <select value={task.type} onChange={(e) => setTask({ ...task, type: e.target.value as TaskType })}>
            {(Object.keys(TASK_TYPE_LABELS) as TaskType[]).map((t) => (
              <option key={t} value={t}>{TASK_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      {task.type === 'quiz' && (
        <QuizEditor
          subject={subject}
          questions={task.quiz?.questions ?? []}
          onChange={(questions) => setTask({ ...task, quiz: { questions } })}
        />
      )}

      {task.type === 'link' && (
        <div>
          <label>Link URL</label>
          <input
            style={{ width: '100%' }}
            placeholder="https://..."
            value={task.link?.url ?? ''}
            onChange={(e) => setTask({ ...task, link: { url: e.target.value } })}
          />
        </div>
      )}

      {task.type === 'offscreen' && (
        <div>
          <label>Instructions for the student</label>
          <textarea
            style={{ width: '100%' }}
            rows={3}
            value={task.offscreen?.instructions ?? ''}
            onChange={(e) => setTask({ ...task, offscreen: { instructions: e.target.value } })}
            placeholder="What should the student do?"
          />
        </div>
      )}

      {task.type === 'video' && (
        <div className="stack">
          <div>
            <label>YouTube URL</label>
            <input
              style={{ width: '100%' }}
              placeholder="https://www.youtube.com/watch?v=..."
              value={task.video?.youtubeUrl ?? ''}
              onChange={(e) => setTask({ ...task, video: { ...task.video, youtubeUrl: e.target.value } })}
            />
          </div>
          <div>
            <label>Note for the student (optional)</label>
            <input
              style={{ width: '100%' }}
              value={task.video?.note ?? ''}
              onChange={(e) => setTask({ ...task, video: { youtubeUrl: task.video?.youtubeUrl ?? '', note: e.target.value } })}
            />
          </div>
        </div>
      )}

      {task.type === 'passage' && (
        <div className="stack">
          <div>
            <label>Passage title</label>
            <input
              style={{ width: '100%' }}
              value={task.passage?.title ?? ''}
              onChange={(e) => setTask({ ...task, passage: { ...task.passage!, title: e.target.value } })}
            />
          </div>
          <div>
            <label>Passage text</label>
            <textarea
              style={{ width: '100%' }}
              rows={6}
              value={task.passage?.text ?? ''}
              onChange={(e) => setTask({ ...task, passage: { ...task.passage!, text: e.target.value } })}
            />
          </div>
          <ImageUploadField
            label="Image (optional)"
            value={task.passage?.imageUrl}
            onChange={(imageUrl) => setTask({ ...task, passage: { ...task.passage!, imageUrl: imageUrl || undefined } })}
          />
          <hr className="divider" />
          <strong>Comprehension questions (optional)</strong>
          <QuizEditor
            subject={subject}
            questions={task.quiz?.questions ?? []}
            onChange={(questions) => setTask({ ...task, quiz: { questions } })}
          />
        </div>
      )}

      {task.type === 'drill' && (
        <DrillEditor
          subject={subject}
          cards={task.drill?.cards ?? []}
          onChange={(cards) => setTask({ ...task, drill: { cards } })}
        />
      )}

      {task.type === 'wordchain' && (
        <div className="stack">
          <div>
            <label>Starting word</label>
            <input value={task.wordchain?.startWord ?? ''} onChange={(e) => setTask({ ...task, wordchain: { startWord: e.target.value, steps: task.wordchain?.steps ?? [] } })} />
          </div>
          <label>Chain steps</label>
          {(task.wordchain?.steps ?? []).map((step, i) => (
            <div key={step.id} className="content-well row-wrap">
              <div>
                <label>Clue</label>
                <input
                  value={step.hint}
                  placeholder="e.g. Change one letter to mean 'a place to sleep'"
                  onChange={(e) => {
                    const steps = [...(task.wordchain?.steps ?? [])];
                    steps[i] = { ...steps[i], hint: e.target.value };
                    setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
                  }}
                  style={{ minWidth: 260 }}
                />
              </div>
              <div>
                <label>Answer word</label>
                <input
                  value={step.answer}
                  onChange={(e) => {
                    const steps = [...(task.wordchain?.steps ?? [])];
                    steps[i] = { ...steps[i], answer: e.target.value };
                    setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
                  }}
                />
              </div>
              <button
                className="btn btn-sm btn-danger"
                onClick={() => {
                  const steps = (task.wordchain?.steps ?? []).filter((_, idx) => idx !== i);
                  setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => {
              const steps = [...(task.wordchain?.steps ?? []), { id: makeId(), hint: '', answer: '' }];
              setTask({ ...task, wordchain: { startWord: task.wordchain?.startWord ?? '', steps } });
            }}
          >
            ➕ Add step
          </button>
        </div>
      )}

      {task.type === 'sentenceEdit' && (
        <div className="stack">
          <div>
            <label>Original (flawed) sentence</label>
            <input
              style={{ width: '100%' }}
              value={task.sentenceEdit?.original ?? ''}
              onChange={(e) => setTask({ ...task, sentenceEdit: { original: e.target.value, corrected: task.sentenceEdit?.corrected ?? '' } })}
            />
          </div>
          <div>
            <label>Corrected sentence (exact answer)</label>
            <input
              style={{ width: '100%' }}
              value={task.sentenceEdit?.corrected ?? ''}
              onChange={(e) => setTask({ ...task, sentenceEdit: { original: task.sentenceEdit?.original ?? '', corrected: e.target.value, hint: task.sentenceEdit?.hint } })}
            />
          </div>
          <div>
            <label>Hint (optional, shown after a couple tries)</label>
            <input
              style={{ width: '100%' }}
              value={task.sentenceEdit?.hint ?? ''}
              onChange={(e) => setTask({ ...task, sentenceEdit: { original: task.sentenceEdit?.original ?? '', corrected: task.sentenceEdit?.corrected ?? '', hint: e.target.value } })}
            />
          </div>
        </div>
      )}

      <hr className="divider" />
      <strong>Extras</strong>
      <div className="row-wrap">
        <div style={{ flex: 1, minWidth: 220 }}>
          <ImageUploadField
            label="🖼️ Reference image for the student (optional)"
            value={task.referenceImageUrl}
            onChange={(url) => setTask({ ...task, referenceImageUrl: url })}
          />
        </div>
      </div>
      <div className="row-wrap">
        <div style={{ flex: 1, minWidth: 220 }}>
          <label>🔗 Reference link (optional — a helper link shown alongside the activity)</label>
          <input
            style={{ width: '100%' }}
            placeholder="https://..."
            value={task.referenceLinkUrl ?? ''}
            onChange={(e) => setTask({ ...task, referenceLinkUrl: e.target.value })}
          />
        </div>
        <div>
          <label>Link button text</label>
          <input
            placeholder="e.g. Open worksheet"
            value={task.referenceLinkLabel ?? ''}
            onChange={(e) => setTask({ ...task, referenceLinkLabel: e.target.value })}
          />
        </div>
      </div>
      <hr className="divider" />
      <label>
        <input type="checkbox" checked={showSteps} onChange={(e) => setShowSteps(e.target.checked)} style={{ marginRight: 6 }} />
        Customize the visual "how to do this" step guide for this task
      </label>
      {showSteps && (
        <StepsEditor steps={task.customSteps ?? []} onChange={(customSteps) => setTask({ ...task, customSteps })} />
      )}

      <div className="row">
        <button className="btn btn-primary" disabled={!task.title.trim()} onClick={() => onSave(showSteps ? task : { ...task, customSteps: [] })}>
          💾 Save Activity
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

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

function PlaygroundPool() {
  const [open, setOpen] = useState(true);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const updateLibraryActivity = useStore((s) => s.updateLibraryActivity);

  const entries = activityLibrary.filter((a) => a.inPlayground);

  return (
    <div className="zone zone-playground stack">
      <button className="zone-header-btn" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 🎪 Playground Pool ({entries.length}) — shared across all students, unlocked after finishing today's work
      </button>
      {open && (
        entries.length === 0 ? (
          <p className="zone-empty-note">Nothing here yet — tap the 🎪 button on any card in the Activity Library below.</p>
        ) : (
          <div className="playground-strip">
            {entries.map((a) => (
              <div key={a.id} className="playground-chip">
                {a.referenceImageUrl ? <img src={a.referenceImageUrl} alt="" /> : <span className="playground-chip-icon">{a.icon}</span>}
                <strong>{a.title}</strong>
                <span className="tag-pill">{a.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>
                <button className="btn btn-sm btn-danger" onClick={() => updateLibraryActivity(a.id, { inPlayground: false })}>
                  ✕ Remove
                </button>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function ActivityLibraryPanel({ subject, tasks }: { subject: Subject; tasks: Task[] }) {
  const activityLibrary = useStore((s) => s.activityLibrary);
  const addLibraryActivity = useStore((s) => s.addLibraryActivity);
  const updateLibraryActivity = useStore((s) => s.updateLibraryActivity);
  const deleteLibraryActivity = useStore((s) => s.deleteLibraryActivity);
  const addActivityToPlan = useStore((s) => s.addActivityToPlan);
  const { studentId } = useParams<{ studentId: string }>();

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const allForSubject = activityLibrary.filter((a) => a.subject === subject);
  const activities = allForSubject.filter(
    (a) => !search.trim() || a.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const editingActivity = activities.find((a) => a.id === editingId);
  const titlesOnTodaysPlan = new Set(tasks.map((t) => t.title.trim().toLowerCase()));

  return (
    <div className="zone zone-library stack">
      <div className="zone-header-bar">🗂️ Activity Library — build it once, use it everywhere</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Create an activity here, then drag its card down into "Today's Plan," tap "➕ Add to plan," or tap 🎪 to put
          it in the shared Playground. Typing a title that matches an existing activity auto-fills the rest for you.
        </p>
        <div className="row-wrap">
          <input
            placeholder="🔍 Search this subject's activities…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
          {!creating && <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>➕ New Activity</button>}
        </div>

        {creating && (
          <TaskEditor
            initial={blankTask()}
            subject={subject}
            matchExisting={(title) => allForSubject.find((a) => a.title.trim().toLowerCase() === title.toLowerCase())}
            onSave={(t) => {
              addLibraryActivity({ ...t, subject, inPlayground: false });
              setCreating(false);
            }}
            onCancel={() => setCreating(false)}
          />
        )}

        {activities.length === 0 ? (
          <p style={{ opacity: 0.7 }}>{search ? 'No activities match your search.' : 'No activities in the library for this subject yet.'}</p>
        ) : (
          <div className="library-card-grid">
            {activities.map((a) => {
              const onTodaysPlan = titlesOnTodaysPlan.has(a.title.trim().toLowerCase());
              return (
                <div
                  key={a.id}
                  className="library-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', a.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                >
                  {editingId === a.id && editingActivity ? (
                    <div style={{ padding: 10 }}>
                      <TaskEditor
                        initial={editingActivity}
                        subject={subject}
                        matchExisting={(title) => allForSubject.find((x) => x.title.trim().toLowerCase() === title.toLowerCase())}
                        onSave={(t) => {
                          updateLibraryActivity(a.id, t);
                          setEditingId(null);
                        }}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <div className="library-card-thumb">
                        {a.referenceImageUrl ? <img src={a.referenceImageUrl} alt="" /> : <span>{a.icon}</span>}
                      </div>
                      <div className="library-card-body">
                        <div className="row-wrap" style={{ gap: 4 }}>
                          {a.inPlayground && <span className="badge-pill badge-playground">🎪 Playground</span>}
                          {onTodaysPlan && <span className="badge-pill badge-onplan">📌 On today's plan</span>}
                        </div>
                        <div className="set-card-title">{a.title || '(untitled)'}</div>
                        <div className="set-card-meta">{TASK_TYPE_LABELS[a.type]}</div>
                        <div className="row-wrap">
                          <button
                            className={`btn btn-sm ${a.inPlayground ? 'btn-primary' : ''}`}
                            onClick={() => updateLibraryActivity(a.id, { inPlayground: !a.inPlayground })}
                            title="Add to / remove from the Playground"
                          >
                            🎪
                          </button>
                          {studentId && (
                            <button className="btn btn-sm btn-success" onClick={() => addActivityToPlan(studentId, subject, a.id)}>
                              ➕ Add to plan
                            </button>
                          )}
                          <button className="btn btn-sm" onClick={() => setEditingId(a.id)}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteLibraryActivity(a.id)}>Delete</button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function WeeklyScheduleGrid({ studentId, subject, studentName }: { studentId: string; subject: Subject; studentName: string }) {
  const planTemplates = useStore((s) => s.planTemplates);
  const weeklySchedule = useStore((s) => s.weeklySchedule);
  const setWeeklyScheduleDay = useStore((s) => s.setWeeklyScheduleDay);
  const applyTemplateToStudent = useStore((s) => s.applyTemplateToStudent);

  const templates = planTemplates.filter((t) => t.subject === subject);
  const today = currentDayOfWeek();

  const assignedFor = (day: DayOfWeek) =>
    weeklySchedule.find((w) => w.studentId === studentId && w.subject === subject && w.day === day)?.templateId ?? '';

  const todaysTemplateId = today ? assignedFor(today) : '';

  return (
    <div className="zone zone-week stack">
      <div className="zone-header-bar">📅 This Week — {studentName}'s recurring plan</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Assign a template to each weekday — it loads automatically into "Today's Plan" below the first time{' '}
          {studentName} logs in that day. Leave a day set to "— manual —" to keep managing it by hand. After a
          template loads, you can still tweak that one day's copy (like swapping a link) without changing the
          template or any other day.
        </p>
        {templates.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Save a template in "📑 Templates" below first, then come back here to assign it to days.</p>
        ) : (
          <div className="week-grid">
            {WEEKDAYS.map((day) => (
              <div key={day} className={`week-cell ${today === day ? 'week-cell-today' : ''}`}>
                <div className="week-cell-label">{WEEKDAY_SHORT[day]}{today === day ? ' • today' : ''}</div>
                <select value={assignedFor(day)} onChange={(e) => setWeeklyScheduleDay(studentId, subject, day, e.target.value || null)}>
                  <option value="">— manual —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
        {today && (
          <button
            className="btn btn-sm"
            disabled={!todaysTemplateId}
            onClick={() => todaysTemplateId && applyTemplateToStudent(studentId, todaysTemplateId)}
          >
            ▶️ Load {WEEKDAY_LABELS[today]}'s plan now
          </button>
        )}
      </div>
    </div>
  );
}

function TemplatesPanel({ studentId, subject, currentTasks }: { studentId: string; subject: Subject; currentTasks: Task[] }) {
  const [open, setOpen] = useState(true);
  const [savingName, setSavingName] = useState<string | null>(null);
  const planTemplates = useStore((s) => s.planTemplates);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const addTemplate = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const duplicateTemplate = useStore((s) => s.duplicateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const applyTemplateToStudent = useStore((s) => s.applyTemplateToStudent);
  const [confirmApplyId, setConfirmApplyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [addFromLibraryId, setAddFromLibraryId] = useState('');

  const templates = planTemplates.filter((t) => t.subject === subject);
  const libraryForSubject = activityLibrary.filter((a) => a.subject === subject);

  return (
    <div className="zone zone-templates stack">
      <button className="zone-header-btn zone-header-bar" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 📑 Templates ({templates.length}) — reusable daily plans
      </button>
      <div style={{ padding: 14 }} className="stack">
        <div className="row-wrap">
          {savingName === null ? (
            <button className="btn btn-sm" disabled={currentTasks.length === 0} onClick={() => setSavingName('')}>
              💾 Save today's plan as a new template
            </button>
          ) : (
            <>
              <input placeholder="Template name" value={savingName} onChange={(e) => setSavingName(e.target.value)} />
              <button
                className="btn btn-sm btn-primary"
                disabled={!savingName.trim()}
                onClick={() => {
                  addTemplate(savingName.trim(), subject, currentTasks);
                  setSavingName(null);
                }}
              >
                Save
              </button>
              <button className="btn btn-sm" onClick={() => setSavingName(null)}>Cancel</button>
            </>
          )}
        </div>
        {open && (
          templates.length === 0 ? (
            <p style={{ opacity: 0.7 }}>No saved templates for this subject yet.</p>
          ) : (
            <div className="stack">
              {templates.map((t) => {
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
                      {confirmApplyId === t.id ? (
                        <div className="row-wrap">
                          <span style={{ fontSize: '0.85rem' }}>Replace this student's Today's Plan?</span>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => {
                              applyTemplateToStudent(studentId, t.id);
                              setConfirmApplyId(null);
                            }}
                          >
                            Yes, load it
                          </button>
                          <button className="btn btn-sm" onClick={() => setConfirmApplyId(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="row-wrap">
                          <button className="btn btn-sm" onClick={() => { setRenamingId(t.id); setRenameDraft(t.name); }}>✏️ Rename</button>
                          <button className="btn btn-sm" onClick={() => setExpandedId(expanded ? null : t.id)}>
                            {expanded ? '▾ Hide activities' : '▸ Edit activities'}
                          </button>
                          <button className="btn btn-sm" onClick={() => duplicateTemplate(t.id)}>⧉ Duplicate</button>
                          <button className="btn btn-sm btn-primary" onClick={() => setConfirmApplyId(t.id)}>▶️ Load into Today's Plan</button>
                          <button className="btn btn-sm btn-danger" onClick={() => deleteTemplate(t.id)}>Delete</button>
                        </div>
                      )}
                    </div>

                    {expanded && (
                      <div className="stack" style={{ paddingLeft: 8, borderLeft: '3px solid var(--content-border)' }}>
                        {t.activities.length === 0 && <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No activities in this template yet.</p>}
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

export default function LessonPlanBuilder() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const rotationModes = useStore((s) => s.rotationModes);
  const setRotationMode = useStore((s) => s.setRotationMode);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const reorderTasks = useStore((s) => s.reorderTasks);
  const addActivityToPlan = useStore((s) => s.addActivityToPlan);

  const [subj, setSubj] = useState<Subject>('math');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
  const mode = rotationModes[student.id]?.[subj] ?? 'sequence';

  const switchSubject = (s: Subject) => {
    setSubj(s);
    setEditingTaskId(null);
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="space-between">
          <h1>{student.avatar} {student.name} — Assignments</h1>
          <button className="btn btn-sm" onClick={() => navigate('/teacher')}>← Overview</button>
        </div>

        <div className="subject-tabs">
          <button className={`subject-tab-btn tab-math ${subj === 'math' ? 'active' : ''}`} onClick={() => switchSubject('math')}>🔢 Math</button>
          <button className={`subject-tab-btn tab-literacy ${subj === 'literacy' ? 'active' : ''}`} onClick={() => switchSubject('literacy')}>📚 Literacy</button>
        </div>

        <div className="chrome-frame row-wrap" style={{ padding: 14 }}>
          <strong>Order for the student:</strong>
          <button
            className={`btn btn-sm ${mode === 'sequence' ? 'btn-primary' : ''}`}
            onClick={() => setRotationMode(student.id, subj, 'sequence')}
          >
            🔢 Specific order (required)
          </button>
          <button
            className={`btn btn-sm ${mode === 'choiceboard' ? 'btn-primary' : ''}`}
            onClick={() => setRotationMode(student.id, subj, 'choiceboard')}
          >
            🧩 Choice board (any order)
          </button>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            {mode === 'sequence' ? 'Student does activities 1, 2, 3… in this order.' : 'Student picks any remaining activity from a board.'}
          </span>
        </div>

        <ActivityLibraryPanel subject={subj} tasks={tasks} />
        <PlaygroundPool />
        <WeeklyScheduleGrid studentId={student.id} subject={subj} studentName={student.name} />
        <TemplatesPanel studentId={student.id} subject={subj} currentTasks={tasks} />

        <div className="zone zone-today stack">
          <div className="zone-header-bar">✅ Today's Plan — exactly what {student.name} sees right now</div>
          <div
            className={`stack drop-zone ${dragOver ? 'drop-zone-active' : ''}`}
            style={{ padding: 14 }}
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
              if (activityId) addActivityToPlan(student.id, subj, activityId);
            }}
          >
            {tasks.length === 0 && (
              <p className="chrome-frame" style={{ padding: 14, opacity: 0.7, textAlign: 'center' }}>
                No activities yet. Drag one in from the Activity Library above, assign a Template in "This Week," or
                tap "➕ Add to plan" on any library card.
              </p>
            )}
            {tasks.map((t, i) => (
              <div key={t.id} className="chrome-frame stack" style={{ padding: 14 }}>
                <div className="space-between">
                  <div className="row">
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
                      </div>
                    </div>
                  </div>
                  <div className="row-wrap">
                    <button className="btn btn-sm" disabled={i === 0} onClick={() => reorderTasks(student.id, subj, i, i - 1)}>⬆️</button>
                    <button className="btn btn-sm" disabled={i === tasks.length - 1} onClick={() => reorderTasks(student.id, subj, i, i + 1)}>⬇️</button>
                    <button className="btn btn-sm" onClick={() => setEditingTaskId(editingTaskId === t.id ? null : t.id)}>
                      {editingTaskId === t.id ? 'Close' : 'Edit'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => deleteTask(student.id, subj, t.id)}>Delete</button>
                  </div>
                </div>
                {editingTaskId === t.id && (
                  <TaskEditor
                    initial={t}
                    subject={subj}
                    onSave={(nt) => {
                      updateTask(student.id, subj, nt.id, nt);
                      setEditingTaskId(null);
                    }}
                    onCancel={() => setEditingTaskId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <ContentLibrary subject={subj} />
      </div>
    </div>
  );
}
