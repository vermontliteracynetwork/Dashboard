import { useRef, useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { parseCSV, downloadCSV } from '../../lib/csv';
import { rowsToQuizQuestions, rowsToDrillCards, QUIZ_TEMPLATE_ROWS, DRILL_TEMPLATE_ROWS } from '../../lib/importQuestions';
import type { Subject, QuizQuestion, DrillCard } from '../../types';

function Importer({ kind }: { kind: 'quiz' | 'drill' }) {
  const addQuestionSet = useStore((s) => s.addQuestionSet);
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState<Subject>('math');
  const [parsed, setParsed] = useState<{ questions: QuizQuestion[]; cards: DrillCard[] } | null>(null);
  const [fileName, setFileName] = useState('');

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const rows = parseCSV(text);
      if (kind === 'quiz') setParsed({ questions: rowsToQuizQuestions(rows), cards: [] });
      else setParsed({ cards: rowsToDrillCards(rows), questions: [] });
    };
    reader.readAsText(file);
  };

  const save = () => {
    if (!parsed || !name.trim()) return;
    addQuestionSet({
      name: name.trim(),
      subject,
      kind,
      questions: parsed.questions,
      cards: parsed.cards,
    });
    setParsed(null);
    setName('');
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const count = kind === 'quiz' ? parsed?.questions.length ?? 0 : parsed?.cards.length ?? 0;

  return (
    <div className="content-well stack">
      <div className="row-wrap">
        <button
          className="btn btn-sm"
          onClick={() => downloadCSV(kind === 'quiz' ? 'question-set-template.csv' : 'drill-set-template.csv', kind === 'quiz' ? QUIZ_TEMPLATE_ROWS : DRILL_TEMPLATE_ROWS)}
        >
          ⬇️ Download template CSV
        </button>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </div>
      {fileName && <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>Loaded: {fileName} — found {count} {kind === 'quiz' ? 'question(s)' : 'card(s)'}</p>}

      {parsed && (
        <div className="row-wrap">
          <input placeholder="Set name" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)}>
            <option value="math">Math</option>
            <option value="literacy">Literacy</option>
          </select>
          <button className="btn btn-sm btn-primary" disabled={!name.trim() || count === 0} onClick={save}>
            💾 Save Set
          </button>
        </div>
      )}
    </div>
  );
}

export default function QuestionSets() {
  const questionSets = useStore((s) => s.questionSets);
  const deleteQuestionSet = useStore((s) => s.deleteQuestionSet);

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>📚 Question Sets</h1>
        <p style={{ opacity: 0.75 }}>
          Build a reusable set here, or make one in Google Sheets and export it as a CSV — download the template below
          to see the exact columns, fill it in, then upload it. Once saved, a set can be inserted into any quiz or
          flashcard drill task from the rotation builder.
        </p>

        <div className="row-wrap" style={{ alignItems: 'stretch' }}>
          <div style={{ flex: 1, minWidth: 320 }}>
            <h3>🧠 Quiz Question Sets</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              Columns: <code>Question, ChoiceA, ChoiceB, ChoiceC, ChoiceD, CorrectAnswer, ImageURL</code>. For
              multiple choice, put the letter (A–D) in CorrectAnswer. For fill-in-the-blank, leave choices blank (or
              use them as an optional word bank) and put the typed answer in CorrectAnswer.
            </p>
            <Importer kind="quiz" />
          </div>
          <div style={{ flex: 1, minWidth: 320 }}>
            <h3>🗂️ Flashcard Drill Sets</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
              Columns: <code>Front, Back, ImageURL</code>. Good for math facts, grapheme/morpheme review, or
              vocabulary &amp; etymology.
            </p>
            <Importer kind="drill" />
          </div>
        </div>

        <hr className="divider" />
        <h3>Saved Sets</h3>
        {questionSets.length === 0 && <p style={{ opacity: 0.7 }}>No sets saved yet.</p>}
        <div className="stack">
          {questionSets.map((set) => (
            <div key={set.id} className="chrome-frame space-between" style={{ padding: 14 }}>
              <span>
                {set.kind === 'quiz' ? '🧠' : '🗂️'} <strong>{set.name}</strong> — {set.subject} ·{' '}
                {set.kind === 'quiz' ? `${set.questions.length} question(s)` : `${set.cards.length} card(s)`}
              </span>
              <button className="btn btn-sm btn-danger" onClick={() => deleteQuestionSet(set.id)}>Delete</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
