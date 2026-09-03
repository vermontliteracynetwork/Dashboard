import { useState } from 'react';
import { useStore } from '../../store/store';
import { TaskEditor, activityToTaskSnapshot } from './ActivityLibrary';
import { todayISO, formatDateLong } from '../../lib/dates';
import { enforceFinalCheckLast } from '../../lib/taskOrder';
import type { Assignment, Subject, Task } from '../../types';

function defaultPlanName(tasks: Task[]): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const preview = tasks.slice(0, 2).map((t) => t.title || '(untitled)').join(', ');
  return preview ? `${date} — ${preview}${tasks.length > 2 ? '…' : ''}` : date;
}

// Passed in when this builder is editing an existing plan (a draft, or a
// not-yet-started assignment) instead of starting fresh — `rows` is that
// plan's current published Assignment rows (empty for a still-unpublished
// draft), used to reconcile the student roster and dates on save rather
// than always creating new ones.
export interface EditingPlan {
  templateId: string;
  rows: Assignment[];
}

interface Props {
  subject: Subject;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  editing?: EditingPlan;
  initialName?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialMode?: 'repeat' | 'span';
  initialSelectedIds?: string[];
  onSaved?: () => void;
}

// Build a whole daily plan from scratch (not tied to any one student's
// existing plan) and assign the finished result to as many students as
// needed in one action — saves as a draft either way. The scratch `tasks`
// list is owned by the parent so the Activity Library's "Add to plan" flow
// can drop activities straight in here too. When `editing` is set, this is
// the SAME view used to edit an existing draft or upcoming assignment in
// place (full search/drag-drop/ordering/dates/audience), instead of a
// stripped-down editor — saving reconciles the existing plan/rows rather
// than creating duplicates.
export default function NewDailyPlanBuilder({
  subject,
  tasks,
  onTasksChange,
  editing,
  initialName,
  initialStartDate,
  initialEndDate,
  initialMode,
  initialSelectedIds,
  onSaved,
}: Props) {
  const students = useStore((s) => s.students);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const addTemplate = useStore((s) => s.addTemplate);
  const updateTemplate = useStore((s) => s.updateTemplate);
  const publishAssignment = useStore((s) => s.publishAssignment);
  const updateAssignment = useStore((s) => s.updateAssignment);
  const addStudentToAssignment = useStore((s) => s.addStudentToAssignment);
  const deleteAssignment = useStore((s) => s.deleteAssignment);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  // Sharing a plan with everyone is the standard case; a teacher un-checks
  // a student here only when adding something differentiated for the rest.
  const [selectedIds, setSelectedIds] = useState<string[]>(() => initialSelectedIds ?? students.map((st) => st.id));
  const [name, setName] = useState(() => initialName ?? '');
  const [saved, setSaved] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState(() => initialStartDate ?? todayISO());
  const [endDate, setEndDate] = useState(() => initialEndDate ?? todayISO());
  const [mode, setMode] = useState<'repeat' | 'span'>(() => initialMode ?? 'repeat');

  const toggleStudent = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  // A Final Check must stay the last thing in the plan — enforced on every
  // change so a teacher never has to place it last by hand.
  const setTasks = (next: Task[]) => onTasksChange(enforceFinalCheckLast(next));

  const addFromLibrary = (activityId: string) => {
    const lib = activityLibrary.find((a) => a.id === activityId && a.subject === subject);
    if (lib) setTasks([...tasks, activityToTaskSnapshot(lib)]);
  };

  const searchMatches = search.trim()
    ? activityLibrary.filter((a) => a.subject === subject && a.title.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8)
    : [];

  const resetForm = () => {
    onTasksChange([]);
    setName('');
    setSelectedIds(students.map((st) => st.id));
    setEditingTaskId(null);
    setStartDate(todayISO());
    setEndDate(todayISO());
    setMode('repeat');
  };

  const saveToBacklogOnly = () => {
    if (tasks.length === 0) return;
    const finalName = name.trim() || defaultPlanName(tasks);
    if (editing) {
      updateTemplate(editing.templateId, { name: finalName, subject, activities: tasks });
      setSaved(`Saved changes to "${finalName}".`);
      onSaved?.();
      return;
    }
    addTemplate(finalName, subject, tasks);
    setSaved(`Saved "${finalName}" as a draft.`);
    resetForm();
  };

  const publish = () => {
    if (tasks.length === 0 || selectedIds.length === 0) return;
    const finalName = name.trim() || defaultPlanName(tasks);
    const today = todayISO();
    const activeNow = startDate <= today && today <= endDate;
    const range = startDate === endDate ? `on ${formatDateLong(startDate)}` : `from ${formatDateLong(startDate)} to ${formatDateLong(endDate)}`;

    if (editing) {
      updateTemplate(editing.templateId, { name: finalName, subject, activities: tasks });
      const remaining = new Map(editing.rows.map((r) => [r.studentId, r]));
      selectedIds.forEach((studentId) => {
        const existingRow = remaining.get(studentId);
        if (existingRow) {
          updateAssignment(existingRow.id, { startDate, endDate, mode });
          remaining.delete(studentId);
        } else {
          addStudentToAssignment(studentId, subject, editing.templateId, startDate, endDate, mode);
        }
      });
      remaining.forEach((row) => deleteAssignment(row.id));
      setSaved(
        `Saved changes to "${finalName}" — assigned to ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'} ${range}` +
          (activeNow ? ' — it\'s live now.' : ' — it will load automatically when the window opens.'),
      );
      onSaved?.();
      return;
    }

    publishAssignment(selectedIds, subject, tasks, finalName, startDate, endDate, mode);
    setSaved(
      `Published "${finalName}" to ${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'} ${range}` +
        (activeNow ? ' — it\'s live now.' : ' — it will load automatically when the window opens.'),
    );
    resetForm();
  };

  return (
    <div className="zone zone-newplan stack">
      <div className="zone-header-bar">{editing ? '✏️ Edit Assignment' : '🗓️ Build a New Daily Plan'}</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Search and add {subject === 'math' ? 'Math' : 'Literacy'} activities below, or drag them in from the
          Library on the right — then assign the finished plan to any student(s) at once.
        </p>

        <div style={{ position: 'relative' }}>
          <input
            placeholder={`🔍 Search ${subject === 'math' ? 'Math' : 'Literacy'} activities to add…`}
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
                    addFromLibrary(a.id);
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
          className={`plan-list ${dragOver ? 'plan-list-drag-active' : ''}`}
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
            addFromLibrary(activityId);
          }}
        >
          {tasks.length === 0 ? (
            <p className="plan-list-empty">
              No activities yet. Search above, or drag a {subject === 'math' ? 'Math' : 'Literacy'} card in from the Library.
            </p>
          ) : (
            tasks.map((t, i) => (
              <div key={t.id} className="plan-list-item">
                <div className="plan-list-row">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={t.order ?? ''}
                    placeholder="—"
                    title="Order (blank = free choice)"
                    className="plan-order-input"
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '');
                      const order = digits ? parseInt(digits, 10) : undefined;
                      setTasks(tasks.map((x) => (x.id === t.id ? { ...x, order } : x)));
                    }}
                  />
                  <span className="plan-list-icon">{t.icon}</span>
                  <span className="plan-list-title">{t.title || '(untitled)'}</span>
                  <div className="row-wrap" style={{ gap: 4 }}>
                    <button className="btn btn-sm" disabled={i === 0} onClick={() => {
                      const next = [...tasks];
                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                      setTasks(next);
                    }}>
                      ⬆️
                    </button>
                    <button className="btn btn-sm" disabled={i === tasks.length - 1} onClick={() => {
                      const next = [...tasks];
                      [next[i + 1], next[i]] = [next[i], next[i + 1]];
                      setTasks(next);
                    }}>
                      ⬇️
                    </button>
                    <button className="btn btn-sm" onClick={() => setEditingTaskId(editingTaskId === t.id ? null : t.id)}>
                      {editingTaskId === t.id ? '✕' : '✏️'}
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => setTasks(tasks.filter((x) => x.id !== t.id))}>
                      🗑️
                    </button>
                  </div>
                </div>
                {editingTaskId === t.id && (
                  <div style={{ padding: '0 12px 12px' }}>
                    <TaskEditor
                      initial={t}
                      subject={subject}
                      onSave={(nt) => {
                        setTasks(tasks.map((x) => (x.id === t.id ? nt : x)));
                        setEditingTaskId(null);
                      }}
                      onCancel={() => setEditingTaskId(null)}
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="content-well stack" style={{ background: '#faf9ff' }}>
            <div>
              <label>Plan name (optional — auto-named if left blank)</label>
              <input style={{ width: '100%' }} value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultPlanName(tasks)} />
            </div>

            <div className="content-well" style={{ background: 'var(--yellow)', textAlign: 'center', fontWeight: 800 }}>
              📅 Planning for: {startDate === endDate ? formatDateLong(startDate) : `${formatDateLong(startDate)} → ${formatDateLong(endDate)}`}
              {startDate === todayISO() && endDate === todayISO() && ' (today)'}
            </div>

            <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
              <div>
                <label>Start date (first day this plan is active)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (e.target.value > endDate) setEndDate(e.target.value);
                  }}
                />
              </div>
              <div>
                <label>End date (last day — same as start for a single day)</label>
                <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              {(startDate !== todayISO() || endDate !== todayISO()) && (
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    setStartDate(todayISO());
                    setEndDate(todayISO());
                  }}
                >
                  ↺ Reset to today ({formatDateLong(todayISO())})
                </button>
              )}
            </div>

            {endDate > startDate && (
              <div className="stack" style={{ gap: 4 }}>
                <strong style={{ fontSize: '0.85rem' }}>Over this range:</strong>
                <label className="row" style={{ gap: 6 }}>
                  <input type="radio" checked={mode === 'repeat'} onChange={() => setMode('repeat')} />
                  🔁 Repeats every day — fresh checklist each day in the range
                </label>
                <label className="row" style={{ gap: 6 }}>
                  <input type="radio" checked={mode === 'span'} onChange={() => setMode('span')} />
                  📌 One assignment — they have until the end date to finish it
                </label>
              </div>
            )}

            <strong style={{ fontSize: '0.85rem' }}>Assign to:</strong>
            {students.length === 0 ? (
              <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>No students yet — you can still save this as a draft.</p>
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

            <div className="row-wrap" style={{ alignItems: 'center' }}>
              <button className="btn" disabled={tasks.length === 0} onClick={saveToBacklogOnly}>
                💾 Save
              </button>
              <button className="btn btn-primary btn-lg" disabled={tasks.length === 0 || selectedIds.length === 0} onClick={publish}>
                🚀 Publish
              </button>
              {tasks.length === 0 && (
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Add at least one activity above to publish</span>
              )}
              {tasks.length > 0 && selectedIds.length === 0 && (
                <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Pick at least one student above to publish</span>
              )}
            </div>
        </div>

        {saved && <p style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 700 }}>✅ {saved}</p>}
      </div>
    </div>
  );
}
