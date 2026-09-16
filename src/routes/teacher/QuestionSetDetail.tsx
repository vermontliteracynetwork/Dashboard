import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useStore } from '../../store/store';
import ImageUploadField from '../../components/ImageUploadField';
import TeacherNav from '../../components/TeacherNav';
import QuizEditor from './QuizEditor';
import DrillEditor from './DrillEditor';

// Full-page editor for one saved question/drill set, opened by clicking
// its card on the Activities tab's Question Sets list. Editing here only
// changes the saved set, not any activity that already copied its
// questions in (same "copy, not a live link" rule as everywhere else).
export default function QuestionSetDetail() {
  const { setId } = useParams<{ setId: string }>();
  const navigate = useNavigate();
  const questionSets = useStore((s) => s.questionSets);
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const duplicateQuestionSet = useStore((s) => s.duplicateQuestionSet);
  const deleteQuestionSet = useStore((s) => s.deleteQuestionSet);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = questionSets.find((qs) => qs.id === setId);

  // The name field is a local draft with an explicit Save button, instead
  // of pushing a write on every keystroke — re-synced whenever a different
  // set is opened. Tags save immediately since adding/removing one is
  // already a discrete, deliberate action (a click or an Enter key), not
  // continuous typing.
  const [nameDraft, setNameDraft] = useState(set?.name ?? '');
  const [justSaved, setJustSaved] = useState(false);
  const [tagInput, setTagInput] = useState('');
  // Tags and cover image already write to the store the instant they
  // change (see the comment above) — this button/indicator doesn't defer
  // anything, it's just a visible confirmation to match the Set name
  // panel's own pattern, since a teacher asked for one here too.
  const [justSavedExtras, setJustSavedExtras] = useState(false);
  useEffect(() => {
    setNameDraft(set?.name ?? '');
    setJustSaved(false);
    setJustSavedExtras(false);
  }, [set?.id]);

  if (!set) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container stack">
          <p>That question set couldn't be found. It may have been deleted.</p>
          <Link className="btn btn-sm" to="/teacher/activities">← Back to Activities</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <Link className="btn btn-sm" to="/teacher/activities">← Back to Activities</Link>

        <div className="space-between">
          <div>
            <span className="tag-pill">{set.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>
            <h1 style={{ margin: '6px 0 0' }}>{set.name}</h1>
          </div>
          <div className="row-wrap">
            <button
              className="btn btn-sm"
              onClick={() => {
                const newId = duplicateQuestionSet(set.id);
                if (newId) navigate(`/teacher/question-sets/${newId}`);
              }}
            >
              📄 Duplicate
            </button>
            {confirmDelete ? (
              <>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    deleteQuestionSet(set.id);
                    navigate('/teacher/activities');
                  }}
                >
                  Confirm delete
                </button>
                <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
              </>
            ) : (
              <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>🗑️ Delete</button>
            )}
          </div>
        </div>

        <div className="content-well stack">
          <strong>Set name</strong>
          <div className="row" style={{ alignItems: 'center' }}>
            <input className="input" value={nameDraft} onChange={(e) => { setNameDraft(e.target.value); setJustSaved(false); }} />
            <button
              className="btn btn-primary btn-sm"
              disabled={!nameDraft.trim() || nameDraft === set.name}
              onClick={() => {
                updateQuestionSet(set.id, { name: nameDraft.trim() });
                setJustSaved(true);
              }}
            >
              💾 Save
            </button>
            {justSaved && <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>✅ Saved</span>}
          </div>
        </div>

        <div className="content-well stack">
          <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
            <strong>Tags &amp; cover image</strong>
            <div className="row" style={{ alignItems: 'center', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={() => setJustSavedExtras(true)}>💾 Save</button>
              {justSavedExtras && <span style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700 }}>✅ Saved</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            <div className="stack" style={{ gap: 6 }}>
              <div className="row-wrap" style={{ gap: 4 }}>
                {(set.tags ?? []).map((t) => (
                  <span key={t} className="tag-pill tag-pill-sm">
                    {t}{' '}
                    <button
                      aria-label={`Remove tag ${t}`}
                      onClick={() => updateQuestionSet(set.id, { tags: (set.tags ?? []).filter((x) => x !== t) })}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 0 0 4px' }}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <div className="row" style={{ gap: 6 }}>
                <input
                  className="input"
                  style={{ fontSize: '0.82rem', padding: '5px 8px' }}
                  placeholder="Add a tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const t = tagInput.trim();
                    if (!t || (set.tags ?? []).includes(t)) return;
                    updateQuestionSet(set.id, { tags: [...(set.tags ?? []), t] });
                    setTagInput('');
                  }}
                />
                <button
                  className="btn chip-filter-sm"
                  disabled={!tagInput.trim()}
                  onClick={() => {
                    const t = tagInput.trim();
                    if (!t || (set.tags ?? []).includes(t)) return;
                    updateQuestionSet(set.id, { tags: [...(set.tags ?? []), t] });
                    setTagInput('');
                  }}
                >
                  + Add
                </button>
              </div>
            </div>
            <ImageUploadField
              label="Cover image"
              value={set.coverImageUrl}
              onChange={(url) => updateQuestionSet(set.id, { coverImageUrl: url || undefined })}
            />
          </div>
        </div>

        <div className="content-well stack">
          <strong>{set.kind === 'quiz' ? '🧠 Questions' : '🗂️ Cards'}</strong>
          {set.kind === 'quiz' ? (
            <QuizEditor
              subject={set.subject}
              questions={set.questions}
              onChange={(questions) => updateQuestionSet(set.id, { questions })}
            />
          ) : (
            <DrillEditor
              subject={set.subject}
              cards={set.cards}
              onChange={(cards) => updateQuestionSet(set.id, { cards })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
