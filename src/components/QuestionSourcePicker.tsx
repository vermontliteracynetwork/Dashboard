import type { QuestionSet } from '../types';

// Direct teacher instruction: "for question sets and in-game play,
// students have a few options 1) they can select a dice icon and have a
// dice spin random and the student knows they will have questions between
// each move that are drawing randomly from all of their assigned question
// sets 2) they can select from a dropdown menu for their questions to draw
// from their current focuses." A small reusable control, first used by
// Bakery Match, meant to be reused by any future question-set-gated game.
export type QuestionSourceMode = { mode: 'random' } | { mode: 'set'; setId: string };

export default function QuestionSourcePicker({
  questionSets,
  value,
  onChange,
}: {
  questionSets: QuestionSet[]; // caller filters to real, usable sets (kind 'quiz', at least one MC question)
  value: QuestionSourceMode;
  onChange: (mode: QuestionSourceMode) => void;
}) {
  return (
    <div className="row-wrap" style={{ gap: 12, alignItems: 'center', justifyContent: 'center' }}>
      <button
        className="btn btn-lg"
        aria-pressed={value.mode === 'random'}
        style={{ minHeight: 44, ...(value.mode === 'random' ? { background: 'var(--purple, #9877B9)', color: '#fff' } : {}) }}
        onClick={() => onChange({ mode: 'random' })}
      >
        🎲 Random, from all my question sets
      </button>
      {questionSets.length > 0 && (
        <label className="row" style={{ gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>📋 Or just one:</span>
          <select
            value={value.mode === 'set' ? value.setId : ''}
            onChange={(e) => { if (e.target.value) onChange({ mode: 'set', setId: e.target.value }); }}
            style={{ minHeight: 44, borderRadius: 8, padding: '4px 8px', fontSize: '0.9rem' }}
          >
            <option value="" disabled>Choose a question set…</option>
            {questionSets.map((qs) => (
              <option key={qs.id} value={qs.id}>{qs.name}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
