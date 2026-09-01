import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import QuizEditor from './QuizEditor';
import DrillEditor from './DrillEditor';
import StepsEditor from './StepsEditor';
import { makeId } from '../../lib/id';
import type { Subject, Task, TaskType } from '../../types';
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

export default function RotationBuilder() {
  const { studentId, subject } = useParams<{ studentId: string; subject: string }>();
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const rotations = useStore((s) => s.rotations);
  const rotationModes = useStore((s) => s.rotationModes);
  const setRotationMode = useStore((s) => s.setRotationMode);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const reorderTasks = useStore((s) => s.reorderTasks);

  const [editing, setEditing] = useState<Task | 'new' | null>(null);

  const student = students.find((s) => s.id === studentId);
  const subj = subject === 'math' || subject === 'literacy' ? (subject as Subject) : null;

  if (!student || !subj) {
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

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="space-between">
          <h1>{student.avatar} {student.name} — {subj === 'math' ? '🔢 Math' : '📚 Literacy'} Rotation</h1>
          <button className="btn btn-sm" onClick={() => navigate('/teacher')}>← Overview</button>
        </div>
        <p style={{ opacity: 0.75 }}>
          This rotation repeats every day until you change it. Add, edit, reorder, or remove tasks any time.
        </p>

        <div className="chrome-frame row-wrap" style={{ padding: 14 }}>
          <strong>Order for the student:</strong>
          <button
            className={`btn btn-sm ${mode === 'sequence' ? 'btn-primary' : ''}`}
            onClick={() => setRotationMode(student.id, subj, 'sequence')}
          >
            🔢 Numbered order (required)
          </button>
          <button
            className={`btn btn-sm ${mode === 'choiceboard' ? 'btn-primary' : ''}`}
            onClick={() => setRotationMode(student.id, subj, 'choiceboard')}
          >
            🧩 Choice board (any order)
          </button>
          <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>
            {mode === 'sequence' ? 'Student does tasks 1, 2, 3… in order.' : 'Student picks any remaining task from a board.'}
          </span>
        </div>

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
            ➕ Add Task
          </button>
        )}
      </div>
    </div>
  );
}
