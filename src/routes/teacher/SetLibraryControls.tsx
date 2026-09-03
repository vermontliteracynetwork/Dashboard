import { useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { makeId } from '../../lib/id';
import { parseCSV } from '../../lib/csv';
import { rowsToQuizQuestions, rowsToDrillCards } from '../../lib/importQuestions';
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
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const matching = questionSets.filter((s) => s.kind === props.kind && s.subject === props.subject);

  // Upload a CSV straight into this activity — same file format as the
  // Content Sets importer, but it both inserts here immediately AND saves
  // as a named set, so it shows up in Content Sets too without a second trip.
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result ?? ''));
      const baseName = file.name.replace(/\.csv$/i, '');
      if (props.kind === 'quiz') {
        const forInsert = rowsToQuizQuestions(rows);
        if (forInsert.length === 0) return;
        props.onInsert(forInsert);
        addQuestionSet({ name: baseName, subject: props.subject, kind: 'quiz', questions: rowsToQuizQuestions(rows), cards: [] });
        setUploadNotice(`Added ${forInsert.length} question(s) and saved as "${baseName}".`);
      } else {
        const forInsert = rowsToDrillCards(rows);
        if (forInsert.length === 0) return;
        props.onInsert(forInsert);
        addQuestionSet({ name: baseName, subject: props.subject, kind: 'drill', questions: [], cards: rowsToDrillCards(rows) });
        setUploadNotice(`Added ${forInsert.length} card(s) and saved as "${baseName}".`);
      }
      if (fileRef.current) fileRef.current.value = '';
    };
    reader.readAsText(file);
  };

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
    <div className="stack" style={{ padding: '8px 0', gap: 6 }}>
      <div className="row-wrap">
        <select value={insertId} onChange={(e) => setInsertId(e.target.value)}>
          <option value="">📥 Insert from a saved set...</option>
          {matching.map((s) => (
            <option key={s.id} value={s.id}>{s.name} ({props.kind === 'quiz' ? s.questions.length : s.cards.length})</option>
          ))}
        </select>
        <button className="btn btn-sm" disabled={!insertId} onClick={handleInsert}>Insert</button>

        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>📤 Upload a CSV</button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />

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
      {uploadNotice && <p style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700, margin: 0 }}>✅ {uploadNotice}</p>}
    </div>
  );
}
