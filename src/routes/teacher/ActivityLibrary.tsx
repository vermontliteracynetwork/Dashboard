import { useState } from 'react';
import { useStore } from '../../store/store';
import QuizEditor from './QuizEditor';
import DrillEditor from './DrillEditor';
import StepsEditor from './StepsEditor';
import ImageUploadField from '../../components/ImageUploadField';
import { makeId } from '../../lib/id';
import type { Subject, Task, TaskType, ActivityLibraryItem } from '../../types';
import { TASK_TYPE_LABELS } from '../../types';

export const ICON_CHOICES = ['📘', '✏️', '🔤', '🔢', '➗', '🧩', '🎧', '🌍', '🖐️', '🎯', '🧠', '📐', '🗣️', '🎨', '▶️', '📖', '⛓️', '🩹'];

export const blankTask = (): Task => ({
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
// anywhere an activity is copied into a plan/backlog entry so later edits
// or deletes in the library never reach back into what was already handed out.
export const activityToTaskSnapshot = (a: ActivityLibraryItem): Task => ({
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
  isDaily: a.isDaily,
});

export function TaskEditor({
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
      <label>
        <input
          type="checkbox"
          checked={task.isDaily ?? false}
          onChange={(e) => setTask({ ...task, isDaily: e.target.checked })}
          style={{ marginRight: 6 }}
        />
        ⭐ This is a daily/recurring activity
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
          💾 Save Activity
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export function PlaygroundPool() {
  const [open, setOpen] = useState(true);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const updateLibraryActivity = useStore((s) => s.updateLibraryActivity);

  const entries = activityLibrary.filter((a) => a.inPlayground);

  return (
    <div className="zone zone-playground stack">
      <button className="zone-header-btn" onClick={() => setOpen((o) => !o)}>
        {open ? '▾' : '▸'} 🎪 Playground Pool ({entries.length}) — shared across all students
      </button>
      {open && (
        entries.length === 0 ? (
          <p className="zone-empty-note">Nothing here yet — tap the 🎪 button on any card in the Activity Library.</p>
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

export function ActivityLibraryPanel({
  subject,
  tasks,
  defaultStudentId,
}: {
  subject: Subject;
  tasks?: Task[];
  defaultStudentId?: string;
}) {
  const students = useStore((s) => s.students);
  const activityLibrary = useStore((s) => s.activityLibrary);
  const addLibraryActivity = useStore((s) => s.addLibraryActivity);
  const updateLibraryActivity = useStore((s) => s.updateLibraryActivity);
  const deleteLibraryActivity = useStore((s) => s.deleteLibraryActivity);
  const addActivityToPlanForStudents = useStore((s) => s.addActivityToPlanForStudents);

  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [addTargetId, setAddTargetId] = useState<string | null>(null);
  const [addToIds, setAddToIds] = useState<string[]>([]);

  const allForSubject = activityLibrary.filter((a) => a.subject === subject);
  const activities = allForSubject.filter(
    (a) => !search.trim() || a.title.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const editingActivity = activities.find((a) => a.id === editingId);
  const titlesOnTodaysPlan = new Set((tasks ?? []).map((t) => t.title.trim().toLowerCase()));

  const toggleAddTarget = (id: string) =>
    setAddToIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="zone zone-library stack">
      <div className="zone-header-bar">🗂️ Activity Library — build it once, use it everywhere</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Create an activity here, then drag its card down into "Today's Plan," tap "➕ Add to plan" to send it to
          any student(s), or tap 🎪 to put it in the shared Playground. ⭐ marks activities you use every day.
          Typing a title that matches an existing activity auto-fills the rest for you.
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
                          {a.isDaily && <span className="badge-pill badge-daily">⭐ Daily</span>}
                          {a.inPlayground && <span className="badge-pill badge-playground">🎪 Playground</span>}
                          {onTodaysPlan && <span className="badge-pill badge-onplan">📌 On today's plan</span>}
                        </div>
                        <div className="set-card-title">{a.title || '(untitled)'}</div>
                        <div className="set-card-meta">{TASK_TYPE_LABELS[a.type]}</div>

                        {addTargetId === a.id ? (
                          <div className="content-well stack" style={{ background: '#faf9ff' }}>
                            <strong style={{ fontSize: '0.8rem' }}>Add to plan for:</strong>
                            <div className="row-wrap">
                              {students.map((st) => (
                                <label key={st.id} className="row" style={{ gap: 4, fontWeight: 700, fontSize: '0.85rem' }}>
                                  <input type="checkbox" checked={addToIds.includes(st.id)} onChange={() => toggleAddTarget(st.id)} />
                                  {st.avatar} {st.name}
                                </label>
                              ))}
                            </div>
                            <div className="row-wrap">
                              <button
                                className="btn btn-sm btn-success"
                                disabled={addToIds.length === 0}
                                onClick={() => {
                                  addActivityToPlanForStudents(addToIds, subject, a.id);
                                  setAddTargetId(null);
                                }}
                              >
                                Add for {addToIds.length}
                              </button>
                              <button className="btn btn-sm" onClick={() => setAddTargetId(null)}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="row-wrap">
                            <button
                              className={`btn btn-sm ${a.isDaily ? 'btn-primary' : ''}`}
                              onClick={() => updateLibraryActivity(a.id, { isDaily: !a.isDaily })}
                              title="Mark as daily/recurring"
                            >
                              ⭐
                            </button>
                            <button
                              className={`btn btn-sm ${a.inPlayground ? 'btn-primary' : ''}`}
                              onClick={() => updateLibraryActivity(a.id, { inPlayground: !a.inPlayground })}
                              title="Add to / remove from the Playground"
                            >
                              🎪
                            </button>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => {
                                setAddTargetId(a.id);
                                setAddToIds(defaultStudentId ? [defaultStudentId] : []);
                              }}
                            >
                              ➕ Add to plan
                            </button>
                            <button className="btn btn-sm" onClick={() => setEditingId(a.id)}>Edit</button>
                            <button className="btn btn-sm btn-danger" onClick={() => deleteLibraryActivity(a.id)}>Delete</button>
                          </div>
                        )}
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
