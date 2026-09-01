import { useState } from 'react';
import { useStore } from '../../store/store';
import { makeId } from '../../lib/id';
import type { Subject, QuizQuestion, DrillCard } from '../../types';

interface QuizProps {
  kind: 'quiz';
  subject: Subject;
  current: QuizQuestion[];
  onInsert: (items: QuizQuestion[]) => void;
}
interface DrillProps {
  kind: 'drill';
  subject: Subject;
  current: DrillCard[];
  onInsert: (items: DrillCard[]) => void;
}

export default function SetLibraryControls(props: QuizProps | DrillProps) {
  const questionSets = useStore((s) => s.questionSets);
  const addQuestionSet = useStore((s) => s.addQuestionSet);
  const [insertId, setInsertId] = useState('');
  const [savingName, setSavingName] = useState<string | null>(null);

  const matching = questionSets.filter((s) => s.kind === props.kind && s.subject === props.subject);

  const handleInsert = () => {
    const set = matching.find((s) => s.id === insertId);
    if (!set) return;
    if (props.kind === 'quiz') {
      const items = set.questions.map((q) => ({ ...q, id: makeId() }));
      props.onInsert(items);
    } else {
      const items = set.cards.map((c) => ({ ...c, id: makeId() }));
      props.onInsert(items);
    }
    setInsertId('');
  };

  const handleSave = () => {
    if (!savingName?.trim()) return;
    if (props.kind === 'quiz') {
      addQuestionSet({ name: savingName.trim(), subject: props.subject, kind: 'quiz', questions: props.current, cards: [] });
    } else {
      addQuestionSet({ name: savingName.trim(), subject: props.subject, kind: 'drill', questions: [], cards: props.current });
    }
    setSavingName(null);
  };

  return (
    <div className="row-wrap" style={{ padding: '8px 0' }}>
      <select value={insertId} onChange={(e) => setInsertId(e.target.value)}>
        <option value="">📥 Insert from a saved set...</option>
        {matching.map((s) => (
          <option key={s.id} value={s.id}>{s.name} ({props.kind === 'quiz' ? s.questions.length : s.cards.length})</option>
        ))}
      </select>
      <button className="btn btn-sm" disabled={!insertId} onClick={handleInsert}>Insert</button>

      {savingName === null ? (
        <button
          className="btn btn-sm"
          disabled={props.current.length === 0}
          onClick={() => setSavingName('')}
        >
          💾 Save these as a set
        </button>
      ) : (
        <>
          <input placeholder="Set name" value={savingName} onChange={(e) => setSavingName(e.target.value)} />
          <button className="btn btn-sm btn-primary" disabled={!savingName.trim()} onClick={handleSave}>Save</button>
          <button className="btn btn-sm" onClick={() => setSavingName(null)}>Cancel</button>
        </>
      )}
    </div>
  );
}
