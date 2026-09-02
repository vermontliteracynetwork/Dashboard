import { useState } from 'react';
import { useStore } from '../../store/store';
import { TaskEditor, activityToTaskSnapshot } from './ActivityLibrary';
import type { Subject, Task } from '../../types';

function defaultPlanName(tasks: Task[]): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const preview = tasks.slice(0, 2).map((t) => t.title || '(untitled)').join(', ');
  return preview ? `${date} — ${preview}${tasks.length > 2 ? '…' : ''}` : date;
}

// Build a whole daily plan from scratch (not tied to any one student's
// existing plan) and assign the finished result to as many students as
// needed in one action — saves to the Backlog either way.
export default function NewDailyPlanBuilder() {
  const students = useStore((s) => s.students);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const addTemplate = useStore((s) => s.addTemplate);
  const applyTemplateToStudents = useStore((s) => s.applyTemplateToStudents);

  const [subject, setSubject] = useState<Subject>('math');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const toggleStudent = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const switchSubject = (s: Subject) => {
    setSubject(s);
    setTasks([]);
    setEditingTaskId(null);
    setSaved(null);
  };

  const save = () => {
    if (tasks.length === 0) return;
    const finalName = name.trim() || defaultPlanName(tasks);
    const id = addTemplate(finalName, subject, tasks);
    if (selectedIds.length > 0) applyTemplateToStudents(selectedIds, id);
    setSaved(`Saved "${finalName}" to the Backlog${selectedIds.length > 0 ? ` and assigned to ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'}.` : '.'}`);
    setTasks([]);
    setName('');
    setSelectedIds([]);
    setEditingTaskId(null);
  };

  return (
    <div className="zone zone-newplan stack">
      <div className="zone-header-bar">🗓️ Build a New Daily Plan</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Drag activities in from the Activity Library above, then assign the finished plan to any student(s) at once.
        </p>

        <div className="subject-tabs">
          <button className={`subject-tab-btn tab-math ${subject === 'math' ? 'active' : ''}`} onClick={() => switchSubject('math')}>🔢 Math</button>
          <button className={`subject-tab-btn tab-literacy ${subject === 'literacy' ? 'active' : ''}`} onClick={() => switchSubject('literacy')}>📚 Literacy</button>
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
            const lib = activityLibrary.find((a) => a.id === activityId && a.subject === subject);
            if (lib) setTasks((prev) => [...prev, activityToTaskSnapshot(lib)]);
          }}
        >
          {tasks.length === 0 ? (
            <p className="chrome-frame" style={{ padding: 14, opacity: 0.7, textAlign: 'center' }}>
              Drag {subject === 'math' ? 'Math' : 'Literacy'} activities here from the Library above.
            </p>
          ) : (
            tasks.map((t, i) => (
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
                        onChange={(e) => {
                          const order = e.target.value ? parseInt(e.target.value) : undefined;
                          setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, order } : x)));
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '1.6rem' }}>{t.icon}</span>
                    <strong>{t.title || '(untitled)'}</strong>
                  </div>
                  <div className="row-wrap">
                    <button
                      className="btn btn-sm"
                      disabled={i === 0}
                      onClick={() => {
                        const next = [...tasks];
                        [next[i - 1], next[i]] = [next[i], next[i - 1]];
                        setTasks(next);
                      }}
                    >
                      ⬆️
                    </button>
                    <button
                      className="btn btn-sm"
                      disabled={i === tasks.length - 1}
                      onClick={() => {
                        const next = [...tasks];
                        [next[i + 1], next[i]] = [next[i], next[i + 1]];
                        setTasks(next);
                      }}
                    >
                      ⬇️
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditingTaskId(editingTaskId === t.id ? null : t.id)}>
                      {editingTaskId === t.id ? 'Close' : 'Edit'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => setTasks((prev) => prev.filter((x) => x.id !== t.id))}>
                      Delete
                    </button>
                  </div>
                </div>
                {editingTaskId === t.id && (
                  <TaskEditor
                    initial={t}
                    subject={subject}
                    onSave={(nt) => {
                      setTasks((prev) => prev.map((x) => (x.id === t.id ? nt : x)));
                      setEditingTaskId(null);
                    }}
                    onCancel={() => setEditingTaskId(null)}
                  />
                )}
              </div>
            ))
          )}
        </div>

        {tasks.length > 0 && (
          <div className="content-well stack" style={{ background: '#faf9ff' }}>
            <div>
              <label>Plan name (optional — auto-named if left blank)</label>
              <input style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultPlanName(tasks)} />
            </div>
            <strong style={{ fontSize: '0.85rem' }}>Assign to:</strong>
            {students.length === 0 ? (
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>No students yet — this will just save to the Backlog.</p>
            ) : (
              <div className="row-wrap">
                {students.map((st) => (
                  <label key={st.id} className="row" style={{ gap: 4, fontWeight: 700 }}>
                    <input type="checkbox" checked={selectedIds.includes(st.id)} onChange={() => toggleStudent(st.id)} />
                    {st.avatar} {st.name}
                  </label>
                ))}
              </div>
            )}
            <button className="btn btn-primary" onClick={save}>
              💾 Save to Backlog{selectedIds.length > 0 ? ` & assign to ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'}` : ''}
            </button>
          </div>
        )}

        {saved && <p style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 700 }}>✅ {saved}</p>}
      </div>
    </div>
  );
}
