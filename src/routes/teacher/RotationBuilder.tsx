import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import QuizEditor from './QuizEditor';
import { makeId } from '../../lib/id';
import type { Subject, Task, TaskType } from '../../types';

const ICON_CHOICES = ['📘', '✏️', '🔤', '🔢', '➗', '🧩', '🎧', '🌍', '🖐️', '🎯', '🧠', '📐', '🗣️', '🎨'];

const blankTask = (): Task => ({
  id: makeId(),
  title: '',
  icon: ICON_CHOICES[0],
  type: 'quiz',
  quiz: { questions: [] },
  link: { url: '' },
  offscreen: { instructions: '' },
});

function TaskEditor({ initial, onSave, onCancel }: { initial: Task; onSave: (t: Task) => void; onCancel: () => void }) {
  const [task, setTask] = useState<Task>(initial);

  return (
    <div className="content-well stack">
      <div className="row-wrap">
        <div>
          <label>Icon</label>
          <select value={task.icon} onChange={(e) => setTask({ ...task, icon: e.target.value })}>
            {ICON_CHOICES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
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
            <option value="quiz">Native quiz</option>
            <option value="link">External link</option>
            <option value="offscreen">Off-screen / paper</option>
          </select>
        </div>
      </div>

      {task.type === 'quiz' && (
        <QuizEditor
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

      <div className="row">
        <button className="btn btn-primary" disabled={!task.title.trim()} onClick={() => onSave(task)}>
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
