import { useState } from 'react';
import { useStore } from '../../store/store';
import ImageUploadField from '../../components/ImageUploadField';
import QuizEditor from './QuizEditor';
import DrillEditor from './DrillEditor';
import type { Subject } from '../../types';

// Every saved question/drill set in one place, independent of which
// activity (or activities) inserted a copy of it — editing a set here
// only changes the set itself, not any activity that already snapshotted
// its questions in, matching how "insert from a saved set" has always
// worked (a copy, not a live link).
export default function QuestionSetsManager() {
  const questionSets = useStore((s) => s.questionSets);
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const deleteQuestionSet = useStore((s) => s.deleteQuestionSet);
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCoverId, setEditingCoverId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const sets = questionSets.filter((s) => subjectFilter === 'all' || s.subject === subjectFilter);
  const editingSet = questionSets.find((s) => s.id === editingId);

  return (
    <div className="zone zone-library stack">
      <div className="zone-header-bar">🧠 Question Sets — every set used across your activities</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Edit a set's questions right here — this changes only the saved set, not any activity that already
          copied its questions in.
        </p>
        <div className="row-wrap">
          {(['all', 'math', 'literacy'] as const).map((f) => (
            <button key={f} className={`btn btn-sm ${subjectFilter === f ? 'btn-primary' : ''}`} onClick={() => setSubjectFilter(f)}>
              {f === 'all' ? 'All subjects' : f === 'math' ? '🔢 Math' : '📚 Literacy'}
            </button>
          ))}
        </div>

        {editingSet && (
          <div className="content-well stack" style={{ background: '#faf9ff' }}>
            <div className="space-between">
              <strong>✏️ Editing "{editingSet.name}"</strong>
              <button className="btn btn-sm" onClick={() => setEditingId(null)}>✕ Done</button>
            </div>
            {editingSet.kind === 'quiz' ? (
              <QuizEditor
                subject={editingSet.subject}
                questions={editingSet.questions}
                onChange={(questions) => updateQuestionSet(editingSet.id, { questions })}
              />
            ) : (
              <DrillEditor
                subject={editingSet.subject}
                cards={editingSet.cards}
                onChange={(cards) => updateQuestionSet(editingSet.id, { cards })}
              />
            )}
          </div>
        )}

        {sets.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No saved question/drill sets yet — add one from any quiz or drill activity's editor.</p>
        ) : (
          <div className="set-card-grid">
            {sets.map((set) => (
              <div className="set-card" key={set.id}>
                {set.coverImageUrl ? (
                  <img className="set-card-cover" src={set.coverImageUrl} alt="" />
                ) : (
                  <div className="set-card-cover-fallback">{set.kind === 'quiz' ? '🧠' : '🗂️'}</div>
                )}
                <div className="set-card-body">
                  <span className="tag-pill">{set.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>
                  <div className="set-card-title">{set.name}</div>
                  <div className="set-card-meta">
                    {set.kind === 'quiz' ? `${set.questions.length} question(s)` : `${set.cards.length} card(s)`}
                  </div>
                  {editingCoverId === set.id ? (
                    <div className="stack">
                      <ImageUploadField
                        label="Cover image"
                        value={set.coverImageUrl}
                        onChange={(url) => {
                          updateQuestionSet(set.id, { coverImageUrl: url || undefined });
                          if (url) setEditingCoverId(null);
                        }}
                      />
                      <button className="btn btn-sm" onClick={() => setEditingCoverId(null)}>Done</button>
                    </div>
                  ) : (
                    <div className="set-card-actions">
                      <button className="btn btn-sm btn-primary" onClick={() => setEditingId(set.id)}>✏️ Edit</button>
                      <button className="btn btn-sm" onClick={() => setEditingCoverId(set.id)}>🖼️ Cover</button>
                      {confirmDeleteId === set.id ? (
                        <>
                          <button className="btn btn-sm btn-danger" onClick={() => { deleteQuestionSet(set.id); setConfirmDeleteId(null); }}>
                            Confirm
                          </button>
                          <button className="btn btn-sm" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                        </>
                      ) : (
                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDeleteId(set.id)}>Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
