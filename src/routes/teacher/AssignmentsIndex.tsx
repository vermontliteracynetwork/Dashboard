import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { ActivityLibraryBrowse, activityToTaskSnapshot, CreateActivityForm, TaskEditor } from './ActivityLibrary';
import NewDailyPlanBuilder from './NewDailyPlanBuilder';
import { formatDateLong, todayISO } from '../../lib/dates';
import { sortForDisplay } from '../../lib/taskOrder';
import { makeId } from '../../lib/id';
import type { Assignment, PlanTemplate, Student, Subject, Task } from '../../types';

interface AssignmentGroup {
  key: string;
  templateId: string;
  subject: Subject;
  startDate: string;
  endDate: string;
  mode: 'repeat' | 'span';
  rows: Assignment[]; // one row per assigned student
}

const groupKey = (templateId: string, subject: Subject, startDate: string, endDate: string, mode: 'repeat' | 'span') =>
  `${templateId}:${subject}:${startDate}:${endDate}:${mode}`;

// One "Publish Plan" click creates one Assignment row per student — group
// those back together here so a plan shared with 5 students reads as one
// card, the way a real classroom LMS shows one assignment card per plan.
function groupAssignments(assignments: Assignment[]): AssignmentGroup[] {
  const map = new Map<string, AssignmentGroup>();
  for (const a of assignments) {
    const key = groupKey(a.templateId, a.subject, a.startDate, a.endDate, a.mode);
    const existing = map.get(key);
    if (existing) existing.rows.push(a);
    else map.set(key, { key, templateId: a.templateId, subject: a.subject, startDate: a.startDate, endDate: a.endDate, mode: a.mode, rows: [a] });
  }
  return [...map.values()].sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
}

type Filter = 'active' | 'upcoming' | 'past' | 'drafts' | 'all';

// Rename, reorder, edit, delete, and add activities on a saved plan
// template — shared by the Drafts editor and an upcoming assignment's
// activities section (editing here also updates the template everywhere
// else it's reused, same as the per-student Backlog/Drafts editor).
function TemplateActivitiesEditor({ template }: { template: PlanTemplate }) {
  const updateTemplate = useStore((s) => s.updateTemplate);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [addFromLibraryId, setAddFromLibraryId] = useState('');

  const ordered = sortForDisplay(template.activities);
  const libraryForSubject = activityLibrary.filter((a) => a.subject === template.subject);

  return (
    <div className="stack">
      <div>
        <label>Plan name</label>
        <input
          style={{ width: '100%' }}
          value={template.name}
          onChange={(e) => updateTemplate(template.id, { name: e.target.value })}
        />
      </div>
      <strong>Activities ({ordered.length})</strong>
      <div className="stack" style={{ gap: 6 }}>
        {ordered.length === 0 && <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No activities yet.</p>}
        {ordered.map((t) => (
          <div key={t.id} className="content-well stack" style={{ padding: 10 }}>
            <div className="space-between">
              <div className="row" style={{ gap: 6, fontSize: '0.9rem' }}>
                <span className="tag-pill" style={{ fontSize: '0.65rem', minWidth: 22, textAlign: 'center' }}>
                  {t.order != null ? `#${t.order}` : '⇄'}
                </span>
                <span>{t.icon}</span>
                <span>{t.title || '(untitled)'}</span>
              </div>
              <div className="row-wrap">
                <button className="btn btn-sm" onClick={() => setEditingActivityId(editingActivityId === t.id ? null : t.id)}>
                  {editingActivityId === t.id ? 'Close' : 'Edit'}
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => updateTemplate(template.id, { activities: template.activities.filter((x) => x.id !== t.id) })}
                >
                  Delete
                </button>
              </div>
            </div>
            {editingActivityId === t.id && (
              <TaskEditor
                initial={t}
                subject={template.subject}
                onSave={(nt) => {
                  updateTemplate(template.id, { activities: template.activities.map((x) => (x.id === t.id ? nt : x)) });
                  setEditingActivityId(null);
                }}
                onCancel={() => setEditingActivityId(null)}
              />
            )}
          </div>
        ))}
      </div>
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
            updateTemplate(template.id, { activities: [...template.activities, activityToTaskSnapshot(lib)] });
            setAddFromLibraryId('');
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}

function DraftCard({
  template,
  onPublish,
  onEdit,
}: {
  template: PlanTemplate;
  onPublish: () => void;
  onEdit: () => void;
}) {
  const duplicateTemplate = useStore((s) => s.duplicateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="assignment-card" style={{ cursor: 'default' }}>
      <div className={`assignment-card-banner ${template.subject === 'math' ? 'banner-math' : 'banner-literacy'}`}>
        <span>{template.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>
        <span className="tag-pill">📝 Draft</span>
      </div>
      <div className="assignment-card-body">
        <strong className="assignment-card-title">{template.name}</strong>
        <div className="assignment-card-meta">{template.activities.length} activities</div>
        <div className="row-wrap" style={{ marginTop: 8 }}>
          <button className="btn btn-sm btn-primary" onClick={onPublish}>🚀 Publish</button>
          <button className="btn btn-sm" onClick={onEdit}>✏️ Edit</button>
          <button className="btn btn-sm" onClick={() => duplicateTemplate(template.id)}>⧉ Duplicate</button>
          {confirmDelete ? (
            <>
              <button className="btn btn-sm btn-danger" onClick={() => deleteTemplate(template.id)}>Confirm delete</button>
              <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>🗑️</button>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftEditModal({ template, onClose }: { template: PlanTemplate; onClose: () => void }) {
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 560, maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="space-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>✏️ Edit Draft</h3>
          <button className="btn btn-sm" onClick={onClose}>✕ Done</button>
        </div>
        <TemplateActivitiesEditor template={template} />
      </div>
    </div>
  );
}

function AssignmentCard({ group, onOpen }: { group: AssignmentGroup; onOpen: () => void }) {
  const planTemplates = useStore((s) => s.planTemplates);
  const students = useStore((s) => s.students);
  const progress = useStore((s) => s.progress);
  const template = planTemplates.find((t) => t.id === group.templateId);
  const today = todayISO();
  const isActiveToday = group.startDate <= today && today <= group.endDate;
  const isUpcoming = group.startDate > today;

  const studentList = group.rows
    .map((r) => students.find((s) => s.id === r.studentId))
    .filter((s): s is Student => !!s);

  const doneToday = studentList.filter((st) => {
    const p = progress[st.id]?.[group.subject];
    return p?.date === today && p.subjectComplete;
  }).length;

  return (
    <button className="assignment-card" onClick={onOpen}>
      <div className={`assignment-card-banner ${group.subject === 'math' ? 'banner-math' : 'banner-literacy'}`}>
        <span>{group.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>
        {group.endDate < today && <span className="tag-pill">Past</span>}
        {isUpcoming && <span className="tag-pill">✏️ Upcoming</span>}
      </div>
      <div className="assignment-card-body">
        <strong className="assignment-card-title">{template?.name ?? '(deleted plan)'}</strong>
        <div className="assignment-card-meta">
          {template?.activities.length ?? 0} activities · {group.mode === 'repeat' ? '🔁 Repeats daily' : '📌 One span'}
        </div>
        <div className="assignment-card-meta">
          {group.startDate === group.endDate
            ? formatDateLong(group.startDate)
            : `${formatDateLong(group.startDate)} → ${formatDateLong(group.endDate)}`}
        </div>
        <div className="assignment-card-students">
          {studentList.map((st) => (
            <span key={st.id} title={st.name}>{st.avatar}</span>
          ))}
          <span className="assignment-card-count">
            {studentList.length} student{studentList.length === 1 ? '' : 's'}
          </span>
        </div>
        {isActiveToday && studentList.length > 0 && (
          <div className="assignment-card-progress">
            <div className="assignment-card-progress-bar">
              <div style={{ width: `${(doneToday / studentList.length) * 100}%` }} />
            </div>
            <span>{doneToday}/{studentList.length} done today</span>
          </div>
        )}
      </div>
    </button>
  );
}

function AssignmentDetailModal({
  group,
  editable,
  onClose,
  onDelete,
  onRekey,
}: {
  group: AssignmentGroup;
  editable: boolean;
  onClose: () => void;
  onDelete: () => void;
  onRekey: (newKey: string) => void;
}) {
  const planTemplates = useStore((s) => s.planTemplates);
  const students = useStore((s) => s.students);
  const updateAssignment = useStore((s) => s.updateAssignment);
  const deleteAssignment = useStore((s) => s.deleteAssignment);
  const addStudentToAssignment = useStore((s) => s.addStudentToAssignment);
  const template = planTemplates.find((t) => t.id === group.templateId);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const studentList = group.rows
    .map((r) => students.find((s) => s.id === r.studentId))
    .filter((s): s is Student => !!s);
  const ordered = template ? sortForDisplay(template.activities) : [];

  const setDates = (startDate: string, endDate: string) => {
    group.rows.forEach((r) => updateAssignment(r.id, { startDate, endDate }));
    onRekey(groupKey(group.templateId, group.subject, startDate, endDate, group.mode));
  };

  const toggleStudent = (studentId: string) => {
    const existing = group.rows.find((r) => r.studentId === studentId);
    if (existing) deleteAssignment(existing.id);
    else addStudentToAssignment(studentId, group.subject, group.templateId, group.startDate, group.endDate, group.mode);
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 560, maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="space-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>
            {group.subject === 'math' ? '🔢' : '📚'} {template?.name ?? '(deleted plan)'} {editable && '· ✏️ Editable'}
          </h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="stack">
          {editable ? (
            <div className="row-wrap">
              <div>
                <label>Start date</label>
                <input
                  type="date"
                  value={group.startDate}
                  onChange={(e) => setDates(e.target.value, e.target.value > group.endDate ? e.target.value : group.endDate)}
                />
              </div>
              <div>
                <label>End date</label>
                <input type="date" value={group.endDate} min={group.startDate} onChange={(e) => setDates(group.startDate, e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="content-well">
              📅{' '}
              {group.startDate === group.endDate
                ? formatDateLong(group.startDate)
                : `${formatDateLong(group.startDate)} → ${formatDateLong(group.endDate)}`}
              {' · '}
              {group.mode === 'repeat' ? '🔁 Repeats every day in this range' : '📌 One assignment — progress carries forward'}
            </div>
          )}

          {editable && template ? (
            <TemplateActivitiesEditor template={template} />
          ) : (
            <>
              <strong>Activities ({ordered.length})</strong>
              <div className="stack" style={{ gap: 4 }}>
                {ordered.length === 0 && <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No activities.</p>}
                {ordered.map((t) => (
                  <div key={t.id} className="row" style={{ gap: 6, fontSize: '0.9rem' }}>
                    <span className="tag-pill" style={{ fontSize: '0.65rem', minWidth: 22, textAlign: 'center' }}>
                      {t.order != null ? `#${t.order}` : '⇄'}
                    </span>
                    <span>{t.icon}</span>
                    <span>{t.title || '(untitled)'}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <strong>Assigned to</strong>
          {editable ? (
            <div className="row-wrap">
              {students.map((st) => (
                <label key={st.id} className="row" style={{ gap: 4, fontWeight: 700 }}>
                  <input type="checkbox" checked={group.rows.some((r) => r.studentId === st.id)} onChange={() => toggleStudent(st.id)} />
                  {st.avatar} {st.name}
                </label>
              ))}
            </div>
          ) : (
            <div className="row-wrap">
              {studentList.map((st) => (
                <span key={st.id} className="tag-pill">{st.avatar} {st.name}</span>
              ))}
            </div>
          )}

          <hr className="divider" />
          {confirmDelete ? (
            <div className="row-wrap">
              <span style={{ fontSize: '0.85rem' }}>Remove this assignment for everyone?</span>
              <button className="btn btn-sm btn-danger" onClick={onDelete}>Yes, remove it</button>
              <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-sm btn-danger" style={{ alignSelf: 'flex-start' }} onClick={() => setConfirmDelete(true)}>
              🗑️ Delete this assignment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AssignmentsIndex() {
  const assignments = useStore((s) => s.assignments);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const planTemplates = useStore((s) => s.planTemplates);
  const deleteAssignment = useStore((s) => s.deleteAssignment);

  const [subject, setSubject] = useState<Subject>('math');
  const [creating, setCreating] = useState(false);
  const [planTasks, setPlanTasks] = useState<Task[]>([]);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [editDraftId, setEditDraftId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');

  const groups = useMemo(() => groupAssignments(assignments), [assignments]);
  const detailGroup = groups.find((g) => g.key === detailKey) ?? null;
  const editDraft = planTemplates.find((t) => t.id === editDraftId) ?? null;
  const today = todayISO();
  const filteredGroups = groups.filter((g) => {
    if (filter === 'all' || filter === 'drafts') return filter === 'all';
    if (filter === 'active') return g.startDate <= today && today <= g.endDate;
    if (filter === 'upcoming') return g.startDate > today;
    return g.endDate < today;
  });

  const startFromDraft = (template: PlanTemplate) => {
    setSubject(template.subject);
    setPlanTasks(template.activities.map((a) => ({ ...a, id: makeId() })));
    setCreating(true);
  };

  if (creating) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container stack">
          <div className="space-between">
            <h1>🗓️ Create an Assignment</h1>
            <button
              className="btn btn-sm"
              onClick={() => {
                setCreating(false);
                setPlanTasks([]);
              }}
            >
              ← Back to Assignments
            </button>
          </div>

          <div className="subject-tabs">
            <button className={`subject-tab-btn tab-math ${subject === 'math' ? 'active' : ''}`} onClick={() => setSubject('math')}>🔢 Math</button>
            <button className={`subject-tab-btn tab-literacy ${subject === 'literacy' ? 'active' : ''}`} onClick={() => setSubject('literacy')}>📚 Literacy</button>
          </div>

          <div className="assignments-split">
            <div className="assignments-split-main">
              <NewDailyPlanBuilder subject={subject} tasks={planTasks} onTasksChange={setPlanTasks} />
            </div>
            <div className="assignments-split-side">
              <ActivityLibraryBrowse
                subject={subject}
                compact
                onAddActivity={(activityId) => {
                  const lib = activityLibrary.find((a) => a.id === activityId);
                  if (lib) setPlanTasks((prev) => [...prev, activityToTaskSnapshot(lib)]);
                }}
              />
            </div>
          </div>

          <CreateActivityForm subject={subject} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>📋 Assignments</h1>

        <div className="lp-tabs">
          {(['active', 'upcoming', 'past', 'drafts', 'all'] as Filter[]).map((f) => (
            <button key={f} className={`lp-tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'active'
                ? '🟢 Active'
                : f === 'upcoming'
                  ? '🔜 Upcoming'
                  : f === 'past'
                    ? '⏪ Past / Completed'
                    : f === 'drafts'
                      ? `📝 Drafts (${planTemplates.length})`
                      : 'All'}
            </button>
          ))}
        </div>

        <div className="assignment-card-grid">
          <button className="assignment-card assignment-card-create" onClick={() => setCreating(true)}>
            <span style={{ fontSize: '2rem' }}>➕</span>
            <strong>Create Assignment</strong>
          </button>
          {filter === 'drafts'
            ? planTemplates.map((t) => (
                <DraftCard key={t.id} template={t} onPublish={() => startFromDraft(t)} onEdit={() => setEditDraftId(t.id)} />
              ))
            : filteredGroups.map((g) => <AssignmentCard key={g.key} group={g} onOpen={() => setDetailKey(g.key)} />)}
        </div>

        {filter === 'drafts' && planTemplates.length === 0 && (
          <p style={{ opacity: 0.7 }}>
            No drafts yet — save a plan as a draft from any student's Assignments page ("📜 History &amp; Drafts"),
            or build one here and use "💾 Save as Draft only" instead of publishing.
          </p>
        )}
        {filter !== 'drafts' && filteredGroups.length === 0 && (
          <p style={{ opacity: 0.7 }}>
            No {filter === 'all' ? '' : filter} assignments yet. Tap "➕ Create Assignment" to build one.
          </p>
        )}
      </div>

      {detailGroup && (
        <AssignmentDetailModal
          group={detailGroup}
          editable={detailGroup.startDate > today}
          onClose={() => setDetailKey(null)}
          onRekey={setDetailKey}
          onDelete={() => {
            detailGroup.rows.forEach((r) => deleteAssignment(r.id));
            setDetailKey(null);
          }}
        />
      )}

      {editDraft && <DraftEditModal template={editDraft} onClose={() => setEditDraftId(null)} />}
    </div>
  );
}
