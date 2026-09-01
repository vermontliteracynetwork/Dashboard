import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import QuizEditor from './QuizEditor';
import DrillEditor from './DrillEditor';
import StepsEditor from './StepsEditor';
import { makeId } from '../../lib/id';
import { parseCSV, downloadCSV } from '../../lib/csv';
import { rowsToQuizQuestions, rowsToDrillCards, QUIZ_TEMPLATE_ROWS, DRILL_TEMPLATE_ROWS } from '../../lib/importQuestions';
import type { Subject, Task, TaskType, QuizQuestion, DrillCard } from '../../types';
import { TASK_TYPE_LABELS } from '../../types';

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
  inPlayground: false,
});

function TaskEditor({ initial, subject, onSave, onCancel }: { initial: Task; subject: Subject; onSave: (t: Task) => void; onCancel: () => void }) {
  const [task, setTask] = useState<Task>(initial);
  const [showSteps, setShowSteps] = useState((initial.customSteps?.length ?? 0) > 0);

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
            placeholder="e.g. Sound Drill Review"
          />
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
          <div>
            <label>Image URL (optional)</label>
            <input
              style={{ width: '100%' }}
              value={task.passage?.imageUrl ?? ''}
              onChange={(e) => setTask({ ...task, passage: { ...task.passage!, imageUrl: e.target.value } })}
            />
          </div>
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
          <label>🖼️ Reference image for the student (optional)</label>
          <input
            style={{ width: '100%' }}
            placeholder="https://..."
            value={task.referenceImageUrl ?? ''}
            onChange={(e) => setTask({ ...task, referenceImageUrl: e.target.value })}
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
      <label>
        <input
          type="checkbox"
          checked={task.inPlayground ?? false}
          onChange={(e) => setTask({ ...task, inPlayground: e.target.checked })}
          style={{ marginRight: 6 }}
        />
        🎪 Also add this activity to the Playground (bonus pool)
      </label>

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
          💾 Save Task
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
  const [coverDraft, setCoverDraft] = useState('');

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
              <div className="row-wrap">
                <input
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="Cover image URL"
                  value={coverDraft}
                  onChange={(e) => setCoverDraft(e.target.value)}
                />
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    updateQuestionSet(set.id, { coverImageUrl: coverDraft.trim() || undefined });
                    setEditingCoverId(null);
                  }}
                >
                  ✓
                </button>
              </div>
            ) : (
              <div className="set-card-actions">
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setEditingCoverId(set.id);
                    setCoverDraft(set.coverImageUrl ?? '');
                  }}
                >
                  🖼️ Cover
                </button>
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
  const [coverImageUrl, setCoverImageUrl] = useState('');
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
    addQuestionSet({
      name: name.trim(),
      subject,
      kind,
      questions: parsed.questions,
      cards: parsed.cards,
      coverImageUrl: coverImageUrl.trim() || undefined,
    });
    setParsed(null);
    setName('');
    setCoverImageUrl('');
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
          <input placeholder="Cover image URL (optional)" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} style={{ minWidth: 200 }} />
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
        {open ? '▾' : '▸'} 📚 Content Library (reusable question sets & drills)
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

function PlaygroundPool({ studentId }: { studentId: string }) {
  const [open, setOpen] = useState(false);
  const rotations = useStore((s) => s.rotations);
  const updateTask = useStore((s) => s.updateTask);

  const entries: { task: Task; subject: Subject }[] = [
    ...(rotations[studentId]?.math ?? []).filter((t) => t.inPlayground).map((task) => ({ task, subject: 'math' as Subject })),
    ...(rotations[studentId]?.literacy ?? []).filter((t) => t.inPlayground).map((task) => ({ task, subject: 'literacy' as Subject })),
  ];

  return (
    <div className="chrome-frame stack" style={{ padding: 14 }}>
      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 🎪 Playground Pool ({entries.length})
      </button>
      {open && (
        entries.length === 0 ? (
          <p style={{ opacity: 0.7 }}>Nothing in the Playground yet — check "Add to Playground" on any activity below.</p>
        ) : (
          <div className="stack">
            {entries.map(({ task, subject }) => (
              <div key={`${subject}-${task.id}`} className="content-well space-between">
                <span>{task.icon} <strong>{task.title}</strong> <span className="tag-pill">{subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span></span>
                <button className="btn btn-sm btn-danger" onClick={() => updateTask(studentId, subject, task.id, { inPlayground: false })}>
                  Remove from Playground
                </button>
              </div>
            ))}
          </div>
        )
      )}
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
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const reorderTasks = useStore((s) => s.reorderTasks);

  const [subj, setSubj] = useState<Subject>('math');
  const [editing, setEditing] = useState<Task | 'new' | null>(null);

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
    setEditing(null);
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="space-between">
          <h1>{student.avatar} {student.name} — Daily Lesson Plan</h1>
          <button className="btn btn-sm" onClick={() => navigate('/teacher')}>← Overview</button>
        </div>
        <p style={{ opacity: 0.75 }}>
          This plan repeats every day until you change it. Add, edit, reorder, or remove activities any time.
        </p>

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

        <ContentLibrary subject={subj} />
        <PlaygroundPool studentId={student.id} />

        <div className="stack">
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
                      {t.inPlayground && ' · 🎪 Playground'}
                    </div>
                  </div>
                </div>
                <div className="row-wrap">
                  <button className="btn btn-sm" disabled={i === 0} onClick={() => reorderTasks(student.id, subj, i, i - 1)}>⬆️</button>
                  <button className="btn btn-sm" disabled={i === tasks.length - 1} onClick={() => reorderTasks(student.id, subj, i, i + 1)}>⬇️</button>
                  <button className="btn btn-sm" onClick={() => setEditing(t)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={() => deleteTask(student.id, subj, t.id)}>Delete</button>
                </div>
              </div>
              {editing !== 'new' && editing?.id === t.id && (
                <TaskEditor
                  initial={editing}
                  subject={subj}
                  onSave={(nt) => {
                    updateTask(student.id, subj, nt.id, nt);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                />
              )}
            </div>
          ))}
        </div>

        {editing === 'new' ? (
          <div className="chrome-frame" style={{ padding: 14 }}>
            <TaskEditor
              initial={blankTask()}
              subject={subj}
              onSave={(nt) => {
                addTask(student.id, subj, nt);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        ) : (
          <button className="btn btn-primary btn-lg" onClick={() => setEditing('new')}>
            ➕ Add Activity
          </button>
        )}
      </div>
    </div>
  );
}
