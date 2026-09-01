import { useState } from 'react';
import { makeId } from '../../lib/id';
import type { QuizQuestion, MCQuestion, MatchingQuestion, FillBlankQuestion } from '../../types';

interface Props {
  questions: QuizQuestion[];
  onChange: (questions: QuizQuestion[]) => void;
}

const blankMC = (): MCQuestion => ({ id: makeId(), kind: 'mc', prompt: '', choices: ['', ''], correctIndex: 0 });
const blankMatching = (): MatchingQuestion => ({ id: makeId(), kind: 'matching', prompt: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] });
const blankFill = (): FillBlankQuestion => ({ id: makeId(), kind: 'fill', prompt: '', answer: '', wordBank: [] });

function QuestionRow({ q, onUpdate, onDelete }: { q: QuizQuestion; onUpdate: (q: QuizQuestion) => void; onDelete: () => void }) {
  return (
    <div className="content-well stack">
      <div className="space-between">
        <span className="tag-pill">{q.kind === 'mc' ? 'Multiple choice' : q.kind === 'matching' ? 'Matching' : 'Fill in the blank'}</span>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete question</button>
      </div>
      <div>
        <label>Question / prompt</label>
        <input
          value={q.prompt}
          onChange={(e) => onUpdate({ ...q, prompt: e.target.value })}
          style={{ width: '100%' }}
          placeholder="Type the question here"
        />
      </div>
      <div>
        <label>Image URL (optional)</label>
        <input value={q.imageUrl ?? ''} onChange={(e) => onUpdate({ ...q, imageUrl: e.target.value })} style={{ width: '100%' }} />
      </div>

      {q.kind === 'mc' && (
        <div className="stack">
          <label>Choices — pick the correct one</label>
          {q.choices.map((c, i) => (
            <div className="row" key={i}>
              <input
                type="radio"
                name={`correct-${q.id}`}
                checked={q.correctIndex === i}
                onChange={() => onUpdate({ ...q, correctIndex: i })}
              />
              <input
                value={c}
                onChange={(e) => {
                  const choices = [...q.choices];
                  choices[i] = e.target.value;
                  onUpdate({ ...q, choices });
                }}
                style={{ flex: 1 }}
                placeholder={`Choice ${i + 1}`}
              />
              <button
                className="btn btn-sm btn-danger"
                disabled={q.choices.length <= 2}
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
          <button className="btn btn-sm" onClick={() => onUpdate({ ...q, choices: [...q.choices, ''] })}>
            ➕ Add choice
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
  );
}

export default function QuizEditor({ questions, onChange }: Props) {
  const [addingKind, setAddingKind] = useState<'mc' | 'matching' | 'fill'>('mc');

  const update = (id: string, q: QuizQuestion) => onChange(questions.map((existing) => (existing.id === id ? q : existing)));
  const remove = (id: string) => onChange(questions.filter((q) => q.id !== id));
  const add = () => {
    const blank = addingKind === 'mc' ? blankMC() : addingKind === 'matching' ? blankMatching() : blankFill();
    onChange([...questions, blank]);
  };

  return (
    <div className="stack">
      {questions.map((q) => (
        <QuestionRow key={q.id} q={q} onUpdate={(nq) => update(q.id, nq)} onDelete={() => remove(q.id)} />
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
