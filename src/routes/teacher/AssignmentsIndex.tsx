import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { ActivityLibraryBrowse, activityToTaskSnapshot, CreateActivityForm } from './ActivityLibrary';
import NewDailyPlanBuilder from './NewDailyPlanBuilder';
import { StudentPlanTabs } from './LessonPlanBuilder';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import type { EditingPlan } from './NewDailyPlanBuilder';
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

// One "Publish Plan" click creates one Assignment row per student — group
// those back together here so a plan shared with 5 students reads as one
// card, the way a real classroom LMS shows one assignment card per plan.
function groupAssignments(assignments: Assignment[]): AssignmentGroup[] {
  const map = new Map<string, AssignmentGroup>();
  for (const a of assignments) {
    const key = `${a.templateId}:${a.subject}:${a.startDate}:${a.endDate}:${a.mode}`;
    const existing = map.get(key);
    if (existing) existing.rows.push(a);
    else map.set(key, { key, templateId: a.templateId, subject: a.subject, startDate: a.startDate, endDate: a.endDate, mode: a.mode, rows: [a] });
  }
  return [...map.values()].sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
}

// A student should only ever have one row in a given group — this is a
// display-time safety net (the write path is idempotent, but this also
// protects against any duplicate rows already sitting in the database).
function uniqueRowsByStudent(rows: Assignment[]): Assignment[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.studentId) ? false : (seen.add(r.studentId), true)));
}

type Filter = 'active' | 'upcoming' | 'past' | 'drafts' | 'all' | 'by-student';

// What the full builder needs to reopen editing an existing draft or
// upcoming assignment, pre-filled exactly as it was.
interface EditRequest {
  editing: EditingPlan;
  name: string;
  startDate: string;
  endDate: string;
  mode: 'repeat' | 'span';
  selectedIds: string[];
}

function DraftCard({
  template,
  onEdit,
}: {
  template: PlanTemplate;
  onEdit: () => void;
}) {
  const students = useStore((s) => s.students);
  const duplicateTemplate = useStore((s) => s.duplicateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const addStudentToAssignment = useStore((s) => s.addStudentToAssignment);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [published, setPublished] = useState(false);

  // One-click publish with sensible defaults (today, every student,
  // repeats daily) — reuses this same template rather than duplicating
  // it. For anything more specific (a date range, only some students),
  // use Edit instead.
  const quickPublish = () => {
    const today = todayISO();
    students.forEach((st) => addStudentToAssignment(st.id, template.subject, template.id, today, today, 'repeat'));
    setPublished(true);
  };

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
          <button className="btn btn-sm" onClick={onEdit}>✏️ Edit</button>
          <button className="btn btn-sm btn-primary" disabled={students.length === 0} onClick={quickPublish}>🚀 Publish</button>
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
        {published && (
          <p style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 700, margin: '6px 0 0' }}>
            ✅ Published to {students.length} student{students.length === 1 ? '' : 's'} today.
          </p>
        )}
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

  const studentList = uniqueRowsByStudent(group.rows)
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
            <span key={st.id} title={st.name}><AvatarGlyph value={st.avatar} size={22} /></span>
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
        {group.endDate >= today && <p style={{ fontSize: '0.75rem', opacity: 0.65, margin: '4px 0 0' }}>Tap to edit — dates, students, and activities</p>}
      </div>
    </button>
  );
}

function AssignmentDetailModal({
  group,
  onClose,
  onDelete,
}: {
  group: AssignmentGroup;
  onClose: () => void;
  onDelete: () => void;
}) {
  const planTemplates = useStore((s) => s.planTemplates);
  const students = useStore((s) => s.students);
  const addStudentToAssignment = useStore((s) => s.addStudentToAssignment);
  const template = planTemplates.find((t) => t.id === group.templateId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [republished, setRepublished] = useState(false);
  const today = todayISO();
  const isPast = group.endDate < today;

  const studentList = uniqueRowsByStudent(group.rows)
    .map((r) => students.find((s) => s.id === r.studentId))
    .filter((s): s is Student => !!s);
  const ordered = template ? sortForDisplay(template.activities) : [];

  // Reuses this same plan for today — the "run it again" path for a
  // completed assignment now that a past-published plan no longer falls
  // back into the Drafts tab to do this from.
  const republishForToday = () => {
    const targets = studentList.length > 0 ? studentList : students;
    targets.forEach((st) => addStudentToAssignment(st.id, group.subject, group.templateId, today, today, 'repeat'));
    setRepublished(true);
  };

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="space-between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{group.subject === 'math' ? '🔢' : '📚'} {template?.name ?? '(deleted plan)'}</h3>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <div className="stack">
          <div className="content-well">
            📅{' '}
            {group.startDate === group.endDate
              ? formatDateLong(group.startDate)
              : `${formatDateLong(group.startDate)} → ${formatDateLong(group.endDate)}`}
            {' · '}
            {group.mode === 'repeat' ? '🔁 Repeats every day in this range' : '📌 One assignment — progress carries forward'}
          </div>

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

          <strong>Assigned to</strong>
          <div className="row-wrap">
            {studentList.map((st) => (
              <span key={st.id} className="tag-pill"><AvatarGlyph value={st.avatar} size={18} /> {st.name}</span>
            ))}
          </div>

          {isPast && (
            <>
              <hr className="divider" />
              <div className="row-wrap" style={{ alignItems: 'center' }}>
                <button className="btn btn-sm btn-primary" onClick={republishForToday}>
                  🚀 Publish again for today
                </button>
                {republished && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>
                    ✅ Published to {studentList.length > 0 ? studentList.length : students.length} student
                    {(studentList.length > 0 ? studentList.length : students.length) === 1 ? '' : 's'} today.
                  </span>
                )}
              </div>
            </>
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
  const students = useStore((s) => s.students);
  const deleteAssignment = useStore((s) => s.deleteAssignment);

  const [subject, setSubject] = useState<Subject>('math');
  const [creating, setCreating] = useState(false);
  const [planTasks, setPlanTasks] = useState<Task[]>([]);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const groups = useMemo(() => groupAssignments(assignments), [assignments]);
  const detailGroup = groups.find((g) => g.key === detailKey) ?? null;
  const today = todayISO();
  const filteredGroups = groups.filter((g) => {
    if (filter === 'all' || filter === 'drafts' || filter === 'by-student') return filter === 'all';
    if (filter === 'active') return g.startDate <= today && today <= g.endDate;
    if (filter === 'upcoming') return g.startDate > today;
    return g.endDate < today;
  });
  const selectedStudent = students.find((st) => st.id === selectedStudentId) ?? null;

  // A template only counts as a "Draft" until the first time it's actually
  // published. Once it has any assignment record at all — active, upcoming,
  // or already past — it belongs in that tab, not back in Drafts, even
  // after its date window ends; "Draft" always means "never sent to a
  // student," the same as every other tool that has drafts. A published
  // plan is still reusable (see "🚀 Publish again" on a past assignment),
  // which covers the old "recycle it back to Drafts" use case without the
  // confusing double-listing.
  const everPublishedTemplateIds = new Set(groups.map((g) => g.templateId));
  const draftTemplates = planTemplates.filter((t) => !everPublishedTemplateIds.has(t.id));

  const closeBuilder = () => {
    setCreating(false);
    setEditRequest(null);
    setPlanTasks([]);
  };

  const startCreateNew = () => {
    setEditRequest(null);
    setPlanTasks([]);
    setCreating(true);
  };

  const startEditDraft = (template: PlanTemplate) => {
    setSubject(template.subject);
    setPlanTasks(template.activities.map((a) => ({ ...a, id: makeId() })));
    setEditRequest({
      editing: { templateId: template.id, rows: [] },
      name: template.name,
      startDate: today,
      endDate: today,
      mode: 'repeat',
      selectedIds: students.map((st) => st.id),
    });
    setCreating(true);
  };

  const startEditGroup = (group: AssignmentGroup) => {
    const template = planTemplates.find((t) => t.id === group.templateId);
    // Self-heals any duplicate rows for the same student found on this
    // group (e.g. from before addStudentToAssignment was made idempotent)
    // by deleting the extras now, so editing never re-creates them.
    const uniqueRows = uniqueRowsByStudent(group.rows);
    if (uniqueRows.length !== group.rows.length) {
      const keepIds = new Set(uniqueRows.map((r) => r.id));
      group.rows.filter((r) => !keepIds.has(r.id)).forEach((r) => deleteAssignment(r.id));
    }
    setSubject(group.subject);
    setPlanTasks((template?.activities ?? []).map((a) => ({ ...a, id: makeId() })));
    setEditRequest({
      editing: { templateId: group.templateId, rows: uniqueRows },
      name: template?.name ?? '',
      startDate: group.startDate,
      endDate: group.endDate,
      mode: group.mode,
      selectedIds: uniqueRows.map((r) => r.studentId),
    });
    setCreating(true);
  };

  if (creating) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container stack">
          <div className="space-between">
            <h1>{editRequest ? '✏️ Edit Assignment' : '🗓️ Create an Assignment'}</h1>
            <button className="btn btn-sm" onClick={closeBuilder}>← Back to Assignments</button>
          </div>

          <div className="subject-tabs">
            <button
              className={`subject-tab-btn tab-math ${subject === 'math' ? 'active' : ''}`}
              disabled={!!editRequest}
              onClick={() => setSubject('math')}
            >
              🔢 Math
            </button>
            <button
              className={`subject-tab-btn tab-literacy ${subject === 'literacy' ? 'active' : ''}`}
              disabled={!!editRequest}
              onClick={() => setSubject('literacy')}
            >
              📚 Literacy
            </button>
          </div>

          <div className="assignments-split">
            <div className="assignments-split-main">
              <NewDailyPlanBuilder
                key={editRequest?.editing.templateId ?? 'new'}
                subject={subject}
                tasks={planTasks}
                onTasksChange={setPlanTasks}
                editing={editRequest?.editing}
                initialName={editRequest?.name}
                initialStartDate={editRequest?.startDate}
                initialEndDate={editRequest?.endDate}
                initialMode={editRequest?.mode}
                initialSelectedIds={editRequest?.selectedIds}
                onSaved={closeBuilder}
              />
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
          {(['active', 'upcoming', 'past', 'drafts', 'all', 'by-student'] as Filter[]).map((f) => (
            <button key={f} className={`lp-tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'active'
                ? '🟢 Active'
                : f === 'upcoming'
                  ? '🔜 Upcoming'
                  : f === 'past'
                    ? '⏪ Past / Completed'
                    : f === 'drafts'
                      ? `📝 Drafts (${draftTemplates.length})`
                      : f === 'by-student'
                        ? '🧑 By Student'
                        : 'All'}
            </button>
          ))}
        </div>

        {filter === 'by-student' ? (
          <>
            {students.length === 0 ? (
              <p style={{ opacity: 0.7 }}>No students yet — add one from the Students page first.</p>
            ) : (
              <div className="row-wrap">
                {students.map((st) => (
                  <button
                    key={st.id}
                    className={`btn btn-sm ${selectedStudentId === st.id ? 'btn-primary' : ''}`}
                    onClick={() => setSelectedStudentId(st.id)}
                  >
                    <AvatarGlyph value={st.avatar} size={18} /> {st.name}
                  </button>
                ))}
              </div>
            )}
            {selectedStudent ? (
              <StudentPlanTabs studentId={selectedStudent.id} studentName={selectedStudent.name} />
            ) : (
              students.length > 0 && <p style={{ opacity: 0.7 }}>Pick a student above to see their plan.</p>
            )}
          </>
        ) : (
          <>
            <div className="assignment-card-grid">
              <button className="assignment-card assignment-card-create" onClick={startCreateNew}>
                <span style={{ fontSize: '2rem' }}>➕</span>
                <strong>Create Assignment</strong>
              </button>
              {filter === 'drafts'
                ? draftTemplates.map((t) => <DraftCard key={t.id} template={t} onEdit={() => startEditDraft(t)} />)
                : filteredGroups.map((g) => (
                    <AssignmentCard
                      key={g.key}
                      group={g}
                      onOpen={() => (g.endDate >= today ? startEditGroup(g) : setDetailKey(g.key))}
                    />
                  ))}
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
          </>
        )}
      </div>

      {detailGroup && (
        <AssignmentDetailModal
          group={detailGroup}
          onClose={() => setDetailKey(null)}
          onDelete={() => {
            detailGroup.rows.forEach((r) => deleteAssignment(r.id));
            setDetailKey(null);
          }}
        />
      )}
    </div>
  );
}
