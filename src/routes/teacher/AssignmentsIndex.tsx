import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import { ActivityLibraryBrowse, activityToTaskSnapshot } from './ActivityLibrary';
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

type Filter = 'active' | 'upcoming' | 'past' | 'drafts' | 'all' | 'by-student' | 'deleted';

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

function SubjectCell({ subject }: { subject: Subject }) {
  return <span className={`acad-subject acad-subject-${subject}`}>{subject === 'math' ? 'Math' : 'Literacy'}</span>;
}

function dateRangeLabel(start: string, end: string) {
  const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return start === end ? short(start) : `${short(start)} to ${short(end)}`;
}

function StudentStack({ list }: { list: Student[] }) {
  return (
    <span className="acad-avatars" title={list.map((st) => st.name).join(', ')}>
      {list.slice(0, 5).map((st) => <AvatarGlyph key={st.id} value={st.avatar} size={22} />)}
      <span className="acad-muted">{list.length}</span>
    </span>
  );
}

// Academics redesign (direct teacher request: "clean, crisp. table format.
// very professional"): drafts, assignments and deleted plans are rows in
// one table rather than a grid of cards. Same actions as before.
function DraftRow({ template, onEdit }: { template: PlanTemplate; onEdit: () => void }) {
  const students = useStore((s) => s.students);
  const duplicateTemplate = useStore((s) => s.duplicateTemplate);
  const deleteTemplate = useStore((s) => s.deleteTemplate);
  const addStudentToAssignment = useStore((s) => s.addStudentToAssignment);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [published, setPublished] = useState(false);

  // One-click publish with sensible defaults (today, every student,
  // repeats daily). For anything more specific, use Edit instead.
  const quickPublish = () => {
    const today = todayISO();
    students.forEach((st) => addStudentToAssignment(st.id, template.subject, template.id, today, today, 'repeat'));
    setPublished(true);
  };

  return (
    <tr>
      <td><button type="button" className="acad-link" onClick={onEdit}>{template.name}</button></td>
      <td><SubjectCell subject={template.subject} /></td>
      <td>{template.activities.length}</td>
      <td className="acad-muted">Not assigned</td>
      <td className="acad-muted">None</td>
      <td>{published ? <span className="acad-status acad-status-active">Published today</span> : <span className="acad-status acad-status-draft">Draft</span>}</td>
      <td>
        <div className="acad-actions">
          <button className="btn btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn btn-sm btn-primary" disabled={students.length === 0 || published} onClick={quickPublish}>Publish today</button>
          <button className="btn btn-sm" onClick={() => duplicateTemplate(template.id)}>Duplicate</button>
          {confirmDelete ? (
            <>
              <button className="btn btn-sm btn-danger" onClick={() => deleteTemplate(template.id)}>Confirm</button>
              <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-sm" aria-label="Delete draft" onClick={() => setConfirmDelete(true)}>🗑️</button>
          )}
        </div>
      </td>
    </tr>
  );
}

function AssignmentRow({ group, onOpen, onDelete }: { group: AssignmentGroup; onOpen: () => void; onDelete: () => void }) {
  const planTemplates = useStore((s) => s.planTemplates);
  const students = useStore((s) => s.students);
  const progress = useStore((s) => s.progress);
  const duplicateTemplate = useStore((s) => s.duplicateTemplate);
  const template = planTemplates.find((t) => t.id === group.templateId);
  const today = todayISO();
  const isActiveToday = group.startDate <= today && today <= group.endDate;
  const isUpcoming = group.startDate > today;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [duplicated, setDuplicated] = useState(false);

  const studentList = uniqueRowsByStudent(group.rows)
    .map((r) => students.find((s) => s.id === r.studentId))
    .filter((s): s is Student => !!s);
  const doneToday = studentList.filter((st) => {
    const p = progress[st.id]?.[group.subject];
    return p?.date === today && p.subjectComplete;
  }).length;

  return (
    <tr>
      <td>
        <button type="button" className="acad-link" onClick={onOpen}>{template?.name ?? '(deleted plan)'}</button>
        <div className="acad-muted acad-small">{group.mode === 'repeat' ? 'Repeats daily' : 'One span'}</div>
      </td>
      <td><SubjectCell subject={group.subject} /></td>
      <td>{template?.activities.length ?? 0}</td>
      <td><StudentStack list={studentList} /></td>
      <td>{dateRangeLabel(group.startDate, group.endDate)}</td>
      <td>
        {isActiveToday ? (
          <div className="acad-progress-cell">
            <span className="acad-status acad-status-active">Active</span>
            {studentList.length > 0 && (
              <span className="acad-progress" title={`${doneToday} of ${studentList.length} done today`}>
                <span className="acad-progress-bar"><span style={{ width: `${(doneToday / studentList.length) * 100}%` }} /></span>
                <span className="acad-muted acad-small">{doneToday}/{studentList.length} today</span>
              </span>
            )}
          </div>
        ) : isUpcoming ? (
          <span className="acad-status acad-status-upcoming">Upcoming</span>
        ) : (
          <span className="acad-status acad-status-past">Past</span>
        )}
      </td>
      <td>
        <div className="acad-actions">
          <button className="btn btn-sm" onClick={onOpen}>{group.endDate < today ? 'View' : 'Edit'}</button>
          <button
            className="btn btn-sm"
            disabled={duplicated}
            onClick={() => {
              if (template) duplicateTemplate(template.id);
              setDuplicated(true);
            }}
            title="Copies this plan into Drafts"
          >
            {duplicated ? 'Copied to Drafts' : 'Duplicate'}
          </button>
          {confirmDelete ? (
            <>
              <button className="btn btn-sm btn-danger" onClick={onDelete}>Confirm</button>
              <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-sm" aria-label="Delete assignment" onClick={() => setConfirmDelete(true)}>🗑️</button>
          )}
        </div>
      </td>
    </tr>
  );
}

function DeletedAssignmentRow({ group, onRestore, onDeleteForever }: { group: AssignmentGroup; onRestore: () => void; onDeleteForever: () => void }) {
  const planTemplates = useStore((s) => s.planTemplates);
  const students = useStore((s) => s.students);
  const template = planTemplates.find((t) => t.id === group.templateId);
  const [confirmForever, setConfirmForever] = useState(false);
  const studentList = uniqueRowsByStudent(group.rows)
    .map((r) => students.find((s) => s.id === r.studentId))
    .filter((s): s is Student => !!s);

  return (
    <tr className="is-muted">
      <td>{template?.name ?? '(deleted plan)'}</td>
      <td><SubjectCell subject={group.subject} /></td>
      <td>{template?.activities.length ?? 0}</td>
      <td><StudentStack list={studentList} /></td>
      <td>{dateRangeLabel(group.startDate, group.endDate)}</td>
      <td><span className="acad-status acad-status-past">Deleted</span></td>
      <td>
        <div className="acad-actions">
          <button className="btn btn-sm btn-primary" onClick={onRestore}>Restore</button>
          {confirmForever ? (
            <>
              <button className="btn btn-sm btn-danger" onClick={onDeleteForever}>Delete forever</button>
              <button className="btn btn-sm" onClick={() => setConfirmForever(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn-sm" onClick={() => setConfirmForever(true)}>Delete forever</button>
          )}
        </div>
      </td>
    </tr>
  );
}

const TABLE_HEAD = (
  <thead>
    <tr>
      <th>Plan</th>
      <th>Subject</th>
      <th>Activities</th>
      <th>Students</th>
      <th>Dates</th>
      <th>Status</th>
      <th aria-label="Actions" />
    </tr>
  </thead>
);

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
            {group.mode === 'repeat' ? '🔁 Repeats every day in this range' : '📌 One assignment, progress carries forward'}
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
              <span style={{ fontSize: '0.85rem' }}>Remove this assignment for everyone? (You can restore it later from the Deleted tab.)</span>
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

// The Assignments view inside Academics (Academics.tsx owns the page
// shell, sidebar and subject filter; this is just the content). Creating
// or editing opens the stepped pop-up (1 Select students › 2 Build the
// plan › 3 Set dates); `?create=1` in the URL opens it, so Academics' own
// "Create assignment" button can open it from any section.
export function AssignmentsPanel({ subjectFilter = 'all' }: { subjectFilter?: Subject | 'all' }) {
  const assignments = useStore((s) => s.assignments);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const planTemplates = useStore((s) => s.planTemplates);
  const students = useStore((s) => s.students);
  const deleteAssignment = useStore((s) => s.deleteAssignment);
  const softDeleteAssignment = useStore((s) => s.softDeleteAssignment);
  const restoreAssignment = useStore((s) => s.restoreAssignment);

  const [searchParams, setSearchParams] = useSearchParams();
  const [subject, setSubject] = useState<Subject>(subjectFilter === 'all' ? 'math' : subjectFilter);
  const [planTasks, setPlanTasks] = useState<Task[]>([]);
  const [editRequest, setEditRequest] = useState<EditRequest | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('active');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const creating = searchParams.get('create') === '1' || !!editRequest;

  const bySubject = (a: { subject: Subject }) => subjectFilter === 'all' || a.subject === subjectFilter;
  const groups = useMemo(() => groupAssignments(assignments.filter((a) => !a.deletedAt)), [assignments]).filter(bySubject);
  const deletedGroups = useMemo(() => groupAssignments(assignments.filter((a) => !!a.deletedAt)), [assignments]).filter(bySubject);
  const detailGroup = groups.find((g) => g.key === detailKey) ?? null;
  const today = todayISO();
  const filteredGroups = groups.filter((g) => {
    if (filter === 'all' || filter === 'drafts' || filter === 'by-student' || filter === 'deleted') return filter === 'all';
    if (filter === 'active') return g.startDate <= today && today <= g.endDate;
    if (filter === 'upcoming') return g.startDate > today;
    return g.endDate < today;
  });
  const selectedStudent = students.find((st) => st.id === selectedStudentId) ?? null;

  // A template only counts as a "Draft" until the first time it's actually
  // published; once it has any assignment record it belongs in that tab.
  const everPublishedTemplateIds = new Set(useMemo(() => groupAssignments(assignments.filter((a) => !a.deletedAt)), [assignments]).map((g) => g.templateId));
  const draftTemplates = planTemplates.filter((t) => !everPublishedTemplateIds.has(t.id)).filter(bySubject);

  const closeBuilder = (message?: string) => {
    setEditRequest(null);
    setPlanTasks([]);
    if (searchParams.get('create')) {
      const next = new URLSearchParams(searchParams);
      next.delete('create');
      setSearchParams(next, { replace: true });
    }
    if (message) {
      setFlash(message);
      window.setTimeout(() => setFlash(null), 4000);
    }
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
  };

  const startEditGroup = (group: AssignmentGroup) => {
    const template = planTemplates.find((t) => t.id === group.templateId);
    // Self-heals any duplicate rows for the same student found on this
    // group by deleting the extras now, so editing never re-creates them.
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
  };

  const FILTER_LABELS: Record<Filter, string> = {
    active: 'Active',
    upcoming: 'Upcoming',
    past: 'Past',
    drafts: `Drafts (${draftTemplates.length})`,
    all: 'All',
    'by-student': 'By student',
    deleted: `Deleted (${deletedGroups.length})`,
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      {flash && <div className="acad-flash" role="status">✅ {flash}</div>}

      <div className="acad-card">
        <div className="acad-card-head">
          <div className="acad-tabs" role="tablist" aria-label="Assignment filter">
            {(['active', 'upcoming', 'past', 'drafts', 'all', 'by-student', 'deleted'] as Filter[]).map((f) => (
              <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {filter === 'by-student' ? (
          <div className="acad-card-body stack" style={{ gap: 12 }}>
            {students.length === 0 ? (
              <p className="acad-muted">No students yet. Add one from the Students page first.</p>
            ) : (
              <div className="row-wrap" style={{ gap: 6 }}>
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
              students.length > 0 && <p className="acad-muted">Pick a student above to see their plan.</p>
            )}
          </div>
        ) : (
          <div className="acad-table-wrap">
            <table className="acad-table">
              {TABLE_HEAD}
              <tbody>
                {filter === 'deleted'
                  ? deletedGroups.map((g) => (
                      <DeletedAssignmentRow
                        key={g.key}
                        group={g}
                        onRestore={() => g.rows.forEach((r) => restoreAssignment(r.id))}
                        onDeleteForever={() => g.rows.forEach((r) => deleteAssignment(r.id))}
                      />
                    ))
                  : filter === 'drafts'
                    ? draftTemplates.map((t) => <DraftRow key={t.id} template={t} onEdit={() => startEditDraft(t)} />)
                    : filteredGroups.map((g) => (
                        <AssignmentRow
                          key={g.key}
                          group={g}
                          onOpen={() => (g.endDate >= today ? startEditGroup(g) : setDetailKey(g.key))}
                          onDelete={() => g.rows.forEach((r) => softDeleteAssignment(r.id))}
                        />
                      ))}
              </tbody>
            </table>
            {((filter === 'deleted' && deletedGroups.length === 0) ||
              (filter === 'drafts' && draftTemplates.length === 0) ||
              (filter !== 'deleted' && filter !== 'drafts' && filteredGroups.length === 0)) && (
              <p className="acad-empty">
                {filter === 'deleted'
                  ? 'Nothing deleted right now.'
                  : filter === 'drafts'
                    ? 'No drafts yet. Use "Save as draft" in the last step of Create assignment.'
                    : `No ${filter === 'all' ? '' : `${filter} `}assignments. Use "Create assignment" above to build one.`}
              </p>
            )}
          </div>
        )}
      </div>

      {creating && (
        <div className="acad-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) closeBuilder(); }}>
          <div className="acad-modal acad-modal-wide" role="dialog" aria-modal="true" aria-labelledby="acad-create-title">
            <div className="acad-modal-head">
              <h2 id="acad-create-title">{editRequest ? 'Edit assignment' : 'Create assignment'}</h2>
              <div className="acad-segmented" role="group" aria-label="Subject">
                <button className={subject === 'math' ? 'active' : ''} disabled={!!editRequest} onClick={() => { setSubject('math'); setPlanTasks([]); }}>Math</button>
                <button className={subject === 'literacy' ? 'active' : ''} disabled={!!editRequest} onClick={() => { setSubject('literacy'); setPlanTasks([]); }}>Literacy</button>
              </div>
              <button className="acad-icon-btn" onClick={() => closeBuilder()} aria-label="Close">✕</button>
            </div>
            <NewDailyPlanBuilder
              key={`${editRequest?.editing.templateId ?? 'new'}:${subject}`}
              stepped
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
              onCancel={() => closeBuilder()}
              librarySlot={
                <ActivityLibraryBrowse
                  subject={subject}
                  compact
                  onAddActivity={(activityId) => {
                    const lib = activityLibrary.find((a) => a.id === activityId);
                    if (lib) setPlanTasks((prev) => [...prev, activityToTaskSnapshot(lib)]);
                  }}
                />
              }
            />
          </div>
        </div>
      )}

      {detailGroup && (
        <AssignmentDetailModal
          group={detailGroup}
          onClose={() => setDetailKey(null)}
          onDelete={() => {
            detailGroup.rows.forEach((r) => softDeleteAssignment(r.id));
            setDetailKey(null);
          }}
        />
      )}
    </div>
  );
}
