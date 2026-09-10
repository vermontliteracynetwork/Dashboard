import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { Subject } from '../../types';

// Every saved question/drill set in one place, independent of which
// activity (or activities) inserted a copy of it. Each set is a card
// (cover image, title, subject, tags) — click it to open the full-page
// editor (QuestionSetDetail) where it can be edited, duplicated, or deleted.
export default function QuestionSetsManager() {
  const questionSets = useStore((s) => s.questionSets);
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    <div className="zone zone-library stack">
      <div className="zone-header-bar">🧠 Question Sets — every set used across your activities</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Click a set to open, edit, duplicate, or delete it.
        </p>
        <input
          className="input"
          placeholder="🔍 Search by name or tag…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="row-wrap">
          {(['all', 'math', 'literacy'] as const).map((f) => (
            <button key={f} className={`btn btn-sm ${subjectFilter === f ? 'btn-primary' : ''}`} onClick={() => setSubjectFilter(f)}>
              {f === 'all' ? 'All subjects' : f === 'math' ? '🔢 Math' : '📚 Literacy'}
            </button>
          ))}
        </div>
        {allTags.length > 0 && (
          <div className="row-wrap">
            {allTags.map((t) => (
              <button
                key={t}
                className={`btn btn-sm ${tagFilter === t ? 'btn-primary' : ''}`}
                onClick={() => setTagFilter(tagFilter === t ? null : t)}
              >
                🏷️ {t}
              </button>
            ))}
          </div>
        )}

        {sets.length === 0 ? (
          <p style={{ opacity: 0.7 }}>
            {questionSets.length === 0
              ? 'No saved question/drill sets yet — add one from any quiz or drill activity\'s editor.'
              : 'No sets match your search/filters.'}
          </p>
        ) : (
          <div className="set-card-grid">
            {sets.map((set) => (
              <button
                key={set.id}
                className="set-card"
                style={{ textAlign: 'left', cursor: 'pointer', border: 'none', padding: 0 }}
                onClick={() => navigate(`/teacher/question-sets/${set.id}`)}
              >
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
                  {(set.tags ?? []).length > 0 && (
                    <div className="row-wrap" style={{ marginTop: 4 }}>
                      {(set.tags ?? []).map((t) => (
                        <span key={t} className="tag-pill" style={{ fontSize: '0.7rem' }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
