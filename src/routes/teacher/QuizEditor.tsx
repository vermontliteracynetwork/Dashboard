import { useState } from 'react';
import { makeId } from '../../lib/id';
import SetLibraryControls from './SetLibraryControls';
import ImageUploadField from '../../components/ImageUploadField';
import type { QuizQuestion, MCQuestion, MatchingQuestion, FillBlankQuestion, Subject } from '../../types';

interface Props {
  subject: Subject;
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}

const blankMC = (): MCQuestion => ({ id: makeId(), kind: 'mc', prompt: '', choices: ['', ''], correctIndex: 0 });
const blankMatching = (): MatchingQuestion => ({ id: makeId(), kind: 'matching', prompt: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] });
const blankFill = (): FillBlankQuestion => ({ id: makeId(), kind: 'fill', prompt: '', answer: '', wordBank: [] });

const ANSWER_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];
// A Blooket-style quadrant palette for the answer tiles — bold, distinct
// colors so a student scanning a live game/preview can tell answers apart
// at a glance, not just by reading text.
const ANSWER_TILE_COLORS = ['#f4a300', '#2a6df4', '#2fae5d', '#e63946', '#8b5cf6', '#14b8a6'];

function QuestionRow({
  index,
  q,
  onUpdate,
  onDelete,
}: {
  index: number;
  q: QuizQuestion;
  onUpdate: (q: QuizQuestion) => void;
  onDelete: () => void;
}) {
  return (
    <div className="stack quiz-question-row" style={{ gap: 0, borderRadius: 16, overflow: 'hidden', border: '3px solid var(--content-border)' }}>
      <div className="quiz-question-header space-between">
        <div className="row" style={{ gap: 10 }}>
          <span className="quiz-question-number">Question {index + 1}</span>
          <span className="tag-pill" style={{ background: '#fff' }}>{q.kind === 'mc' ? '☑️ Multiple choice' : q.kind === 'matching' ? '🔗 Matching' : '✏️ Fill in the blank'}</span>
        </div>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete question</button>
      </div>
      <div className="stack" style={{ padding: 16, background: '#fff' }}>
      <div>
        <label>Question</label>
        <input
          value={q.prompt}
          onChange={(e) => onUpdate({ ...q, prompt: e.target.value })}
          style={{ width: '100%' }}
          placeholder="Type the question here"
        />
      </div>
      <ImageUploadField label="Image (optional)" value={q.imageUrl} onChange={(imageUrl) => onUpdate({ ...q, imageUrl: imageUrl || undefined })} />

      {q.kind === 'mc' && (
        <div className="stack">
          <label>Answers — tap ✓ to mark the correct one</label>
          <div className="quiz-tile-grid">
            {q.choices.map((c, i) => (
              <div
                key={i}
                className="quiz-answer-tile"
                style={{ background: ANSWER_TILE_COLORS[i % ANSWER_TILE_COLORS.length] }}
              >
                <button
                  type="button"
                  className={`quiz-tile-check ${q.correctIndex === i ? 'correct' : ''}`}
                  onClick={() => onUpdate({ ...q, correctIndex: i })}
                  title="Mark as the correct answer"
                  aria-label={q.correctIndex === i ? 'Correct answer' : 'Mark as the correct answer'}
                >
                  {q.correctIndex === i ? '✓' : ANSWER_LETTERS[i] ?? i + 1}
                </button>
                <input
                  className="quiz-tile-input"
                  value={c}
                  onChange={(e) => {
                    const choices = [...q.choices];
                    choices[i] = e.target.value;
                    onUpdate({ ...q, choices });
                  }}
                  placeholder={i < 2 ? `Answer ${ANSWER_LETTERS[i]}` : `(Optional)`}
                />
                <button
                  className="quiz-tile-remove"
                  disabled={q.choices.length <= 2}
                  aria-label="Remove this answer"
                  onClick={() => {
                    const choices = q.choices.filter((_, idx) => idx !== i);
                    const correctIndex = q.correctIndex >= choices.length ? 0 : q.correctIndex;
                    onUpdate({ ...q, choices, correctIndex });
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn btn-sm"
            style={{ alignSelf: 'flex-start' }}
            disabled={q.choices.length >= ANSWER_LETTERS.length}
            onClick={() => onUpdate({ ...q, choices: [...q.choices, ''] })}
          >
            ➕ Add more answers
          </button>
        </div>
      )}

      {q.kind === 'matching' && (
        <div className="stack">
          <label>Pairs</label>
          {q.pairs.map((p, i) => (
            <div className="row" key={i}>
              <input
                placeholder="Left"
                value={p.left}
                onChange={(e) => {
                  const pairs = [...q.pairs];
                  pairs[i] = { ...pairs[i], left: e.target.value };
                  onUpdate({ ...q, pairs });
                }}
              />
              <span>↔</span>
              <input
                placeholder="Right"
                value={p.right}
                onChange={(e) => {
                  const pairs = [...q.pairs];
                  pairs[i] = { ...pairs[i], right: e.target.value };
                  onUpdate({ ...q, pairs });
                }}
              />
              <button
                className="btn btn-sm btn-danger"
                disabled={q.pairs.length <= 2}
                onClick={() => onUpdate({ ...q, pairs: q.pairs.filter((_, idx) => idx !== i) })}
              >
                ✕
              </button>
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => onUpdate({ ...q, pairs: [...q.pairs, { left: '', right: '' }] })}>
            ➕ Add pair
          </button>
        </div>
      )}

      {q.kind === 'fill' && (
        <div className="stack">
          <div>
            <label>Correct answer</label>
            <input value={q.answer} onChange={(e) => onUpdate({ ...q, answer: e.target.value })} />
          </div>
          <div>
            <label>Word bank (optional — comma separated; lets student tap instead of type)</label>
            <input
              value={(q.wordBank ?? []).join(', ')}
              onChange={(e) => onUpdate({ ...q, wordBank: e.target.value.split(',').map((w) => w.trim()).filter(Boolean) })}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default function QuizEditor({ subject, questions, onChange }: Props) {
  const [addingKind, setAddingKind] = useState<'mc' | 'matching' | 'fill'>('mc');

  const update = (id: string, q: QuizQuestion) => onChange(questions.map((existing) => (existing.id === id ? q : existing)));
  const remove = (id: string) => onChange(questions.filter((q) => q.id !== id));
  const add = () => {
    const blank = addingKind === 'mc' ? blankMC() : addingKind === 'matching' ? blankMatching() : blankFill();
    onChange([...questions, blank]);
  };

  return (
    <div className="stack">
      <SetLibraryControls kind="quiz" subject={subject} current={questions} onInsert={(items) => onChange([...questions, ...items])} />
      {questions.map((q, i) => (
        <QuestionRow key={q.id} index={i} q={q} onUpdate={(nq) => update(q.id, nq)} onDelete={() => remove(q.id)} />
      ))}
      <div className="row">
        <select value={addingKind} onChange={(e) => setAddingKind(e.target.value as typeof addingKind)}>
          <option value="mc">Multiple choice</option>
          <option value="matching">Matching</option>
          <option value="fill">Fill in the blank</option>
        </select>
        <button className="btn btn-sm btn-primary" onClick={add}>➕ Add question</button>
      </div>
    </div>
  );
}
