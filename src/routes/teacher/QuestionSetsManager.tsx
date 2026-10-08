import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { Subject } from '../../types';
import QuestionSetImport from './QuestionSetImport';

// Every saved question/drill set in one place, independent of which
// activity (or activities) inserted a copy of it. Each set is a card
// (cover image, title, subject, tags) — click it to open the full-page
// editor (QuestionSetDetail) where it can be edited, duplicated, or deleted.
export default function QuestionSetsManager() {
  const questionSets = useStore((s) => s.questionSets);
  const updateQuestionSet = useStore((s) => s.updateQuestionSet);
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  // Collapsed by default, same reasoning as FocusesPanel — this is the
  // top of the Assignments screen now (the academic content a teacher
  // references while building assignments), so it shouldn't dump every
  // set on screen before anything's been asked for.
  const [open, setOpen] = useState(false);

  const allTags = useMemo(
    () => Array.from(new Set(questionSets.flatMap((s) => s.tags ?? []))).sort(),
    [questionSets],
  );

  const q = search.trim().toLowerCase();
  const sets = questionSets.filter((s) => {
    if (subjectFilter !== 'all' && s.subject !== subjectFilter) return false;
    if (tagFilter && !(s.tags ?? []).includes(tagFilter)) return false;
    if (q && !s.name.toLowerCase().includes(q) && !(s.tags ?? []).some((t) => t.toLowerCase().includes(q))) return false;
    return true;
  });

  return (
    <div className="chrome-frame stack" style={{ padding: 14 }}>
      <button
        className="space-between"
        style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', minHeight: 44 }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={{ fontWeight: 800, fontSize: '1rem' }}>
          Question Sets{questionSets.length > 0 ? ` (${questionSets.length})` : ''}
        </span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="stack" style={{ marginTop: 10 }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
            The real content behind every quiz and drill activity. Click a set to open, edit, duplicate, or delete it.
          </p>
          <QuestionSetImport />
          <input
            className="input"
            placeholder="Search by name or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="row-wrap" style={{ gap: 6 }}>
            {(['all', 'math', 'literacy'] as const).map((f) => (
              <button key={f} className={`btn chip-filter-sm ${subjectFilter === f ? 'btn-primary' : ''}`} onClick={() => setSubjectFilter(f)}>
                {f === 'all' ? 'All subjects' : f === 'math' ? '🔢 Math' : '📚 Literacy'}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="row-wrap" style={{ gap: 6 }}>
              {allTags.map((t) => (
                <button
                  key={t}
                  className={`btn chip-filter-sm ${tagFilter === t ? 'btn-primary' : ''}`}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {sets.length === 0 ? (
            <p style={{ opacity: 0.7 }}>
              {questionSets.length === 0
                ? 'No saved question/drill sets yet. Add one from any quiz or drill activity\'s editor.'
                : 'No sets match your search/filters.'}
            </p>
          ) : (
            <div className="set-card-grid">
              {sets.map((set) => (
                <div key={set.id} className="set-card" style={{ position: 'relative', padding: 0 }}>
                  {/* No cover image — direct teacher instruction: "remove
                      cover images entirely." Type (quiz vs. drill) and
                      starred-as-focus are shown as two small corner badges
                      instead, same size/position pattern on opposite
                      corners, so the card leads with real content
                      (title/description) rather than a decorative banner. */}
                  <span
                    className="tag-pill"
                    aria-hidden="true"
                    title={set.kind === 'quiz' ? 'Quiz set' : 'Drill set'}
                    style={{ position: 'absolute', top: 6, left: 6, zIndex: 1, minHeight: 36, minWidth: 36, width: 36, height: 36, padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', background: '#fff' }}
                  >
                    {set.kind === 'quiz' ? '🧠' : '🗂️'}
                  </span>
                  {/* Starring is the new Focus system, direct teacher
                      instruction: "allow me to star/favorite certain
                      question sets to become the focus question sets that
                      should be embedded everywhere within the game" — see
                      FocusBanner.tsx/getFocusQuestionSet. A separate button
                      (not nested inside the card's own open-button) so
                      starring never also navigates into the set. */}
                  <button
                    className="btn btn-sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateQuestionSet(set.id, { isFocus: !set.isFocus, focusedAt: !set.isFocus ? new Date().toISOString() : set.focusedAt });
                    }}
                    aria-label={set.isFocus ? `Unstar ${set.name} as a focus set` : `Star ${set.name} as a focus set`}
                    title={set.isFocus ? 'Focus set — shown around the game. Tap to unstar.' : 'Star as a focus set — shown around the game'}
                    style={{ position: 'absolute', top: 6, right: 6, zIndex: 1, minHeight: 36, minWidth: 36, padding: 0, borderRadius: '50%' }}
                  >
                    {set.isFocus ? '⭐' : '☆'}
                  </button>
                  <button
                    style={{ all: 'unset', display: 'contents', cursor: 'pointer' }}
                    onClick={() => navigate(`/teacher/question-sets/${set.id}`)}
                  >
                    <div className="set-card-body" style={{ paddingTop: 34 }}>
                      <span className="tag-pill">{set.subject === 'math' ? '🔢 Math' : '📚 Literacy'}</span>
                      {set.isFocus && <span className="tag-pill" style={{ background: 'var(--purple)', color: '#fff' }}>⭐ Focus</span>}
                      <div className="set-card-title">{set.name}</div>
                      {set.description && <div className="set-card-meta">{set.description}</div>}
                      <div className="set-card-meta">
                        {set.kind === 'quiz' ? `${set.questions.length} question(s)` : `${set.cards.length} card(s)`}
                      </div>
                      {(set.tags ?? []).length > 0 && (
                        <div className="row-wrap" style={{ marginTop: 4, gap: 4 }}>
                          {(set.tags ?? []).map((t) => (
                            <span key={t} className="tag-pill tag-pill-sm">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
