import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { Subject } from '../../types';

// Every saved question/drill set in one place, independent of which
// activity (or activities) inserted a copy of it. Each set is a simple
// title + subject button — click it to open the full-page editor
// (QuestionSetDetail) where it can be edited, duplicated, or deleted.
export default function QuestionSetsManager() {
  const questionSets = useStore((s) => s.questionSets);
  const navigate = useNavigate();
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'all'>('all');

  const sets = questionSets.filter((s) => subjectFilter === 'all' || s.subject === subjectFilter);

  return (
    <div className="zone zone-library stack">
      <div className="zone-header-bar">🧠 Question Sets — every set used across your activities</div>
      <div style={{ padding: 14 }} className="stack">
        <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
          Click a set to open, edit, duplicate, or delete it.
        </p>
        <div className="row-wrap">
          {(['all', 'math', 'literacy'] as const).map((f) => (
            <button key={f} className={`btn btn-sm ${subjectFilter === f ? 'btn-primary' : ''}`} onClick={() => setSubjectFilter(f)}>
              {f === 'all' ? 'All subjects' : f === 'math' ? '🔢 Math' : '📚 Literacy'}
            </button>
          ))}
        </div>

        {sets.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No saved question/drill sets yet — add one from any quiz or drill activity's editor.</p>
        ) : (
          <div className="row-wrap">
            {sets.map((set) => (
              <button
                key={set.id}
                className="btn"
                onClick={() => navigate(`/teacher/question-sets/${set.id}`)}
              >
                {set.subject === 'math' ? '🔢' : '📚'} {set.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
