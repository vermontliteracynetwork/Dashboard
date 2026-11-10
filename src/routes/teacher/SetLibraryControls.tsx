import { useRef, useState } from 'react';
import { uploadImage } from '../../lib/upload';
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
  // Direct teacher instruction: a Question Set activity's authoring form
  // should offer only Upload a CSV / Get CSV template — no "insert from a
  // saved set" picker, no "save these as a set" (the set IS what's being
  // authored here already). Only affects the quiz-kind Create Activity
  // path; QuestionSetDetail.tsx's own real set editor keeps every control.
  minimal?: boolean;
  // Build Queue 523: pictures named with their question number (1.png, Question 1.jpg) go onto those questions.
  onPictures?: (byNumber: Record<number, string>) => void;
}
interface DrillProps {
  kind: 'drill';
  subject: Subject;
  current: DrillCard[];
  onInsert: (items: DrillCard[]) => void;
  minimal?: boolean;
}

export default function SetLibraryControls(props: QuizProps | DrillProps) {
  const questionSets = useStore((s) => s.questionSets);
  const addQuestionSet = useStore((s) => s.addQuestionSet);
  const [insertId, setInsertId] = useState('');
  const [savingName, setSavingName] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const picRef = useRef<HTMLInputElement>(null);
  const [picBusy, setPicBusy] = useState(false);

  // Build Queue 523 (her words: "add a button where i can easily upload images after uploading the csv. in images, they
  // should be numbered with question number (ex. 1.png) or labeled like question 1"): the first number in each file
  // name is the question number.
  const handlePictures = async (files: FileList) => {
    if (props.kind !== 'quiz' || !props.onPictures) return;
    const total = props.current.length;
    const byNumber: Record<number, string> = {};
    const skipped: string[] = [];
    setPicBusy(true);
    for (const f of Array.from(files)) {
      const n = Number(f.name.replace(/\.[^.]+$/, '').match(/\d+/)?.[0]);
      if (!n || n > total) { skipped.push(f.name); continue; }
      try { byNumber[n] = await uploadImage(f); } catch { skipped.push(f.name); }
    }
    setPicBusy(false);
    const got = Object.keys(byNumber).length;
    if (got) props.onPictures(byNumber);
    setUploadNotice(`Added ${got} picture${got === 1 ? '' : 's'}${got ? ` (question${got === 1 ? '' : 's'} ${Object.keys(byNumber).sort((a, b) => +a - +b).join(', ')})` : ''}.${skipped.length ? ` Not matched to a question: ${skipped.join(', ')}. Name each picture with its question number, like 1.png or Question 1.png.` : ''}`);
    if (picRef.current) picRef.current.value = '';
  };

  const matching = questionSets.filter((s) => s.kind === props.kind && s.subject === props.subject);

  // Upload a CSV straight into this activity — same file format as the
  // Content Sets importer. It only inserts here (Build Queue 528: it used to also save a copy as its own set, which
  // doubled her sets); the teacher saves explicitly.
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result ?? ''));
      if (props.kind === 'quiz') {
        const forInsert = rowsToQuizQuestions(rows);
        if (forInsert.length === 0) return;
        props.onInsert(forInsert);
        // Build Queue 528 (her words: "make sure question sets never double when i upload the csv. i need to explicitly
        // save"): the CSV only fills the questions here; nothing is saved until Create set or Save changes.
        setUploadNotice(`Added ${forInsert.length} question(s) from ${file.name}. Not saved yet: click Create set or Save changes.`);
      } else {
        const forInsert = rowsToDrillCards(rows);
        if (forInsert.length === 0) return;
        props.onInsert(forInsert);
        setUploadNotice(`Added ${forInsert.length} card(s) from ${file.name}. Not saved yet: remember to save.`);
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
        {!props.minimal && (
          <>
            <select value={insertId} onChange={(e) => setInsertId(e.target.value)}>
              <option value="">📥 Insert from a saved set...</option>
              {matching.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({props.kind === 'quiz' ? s.questions.length : s.cards.length})</option>
              ))}
            </select>
            <button className="btn btn-sm" disabled={!insertId} onClick={handleInsert}>Insert</button>
          </>
        )}

        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>📤 Upload a CSV</button>
        {props.kind === 'quiz' && props.onPictures && (
          <button className="btn btn-sm" disabled={picBusy || !props.current.length} title="Pick all the pictures at once. Name each one with its question number, like 1.png or Question 1.png." onClick={() => picRef.current?.click()}>
            {picBusy ? 'Uploading pictures...' : 'Upload pictures'}
          </button>
        )}
        <input ref={picRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files?.length && void handlePictures(e.target.files)} />
        <a
          className="btn btn-sm"
          href="https://docs.google.com/spreadsheets/d/1pCzJ-M00kcz4yfJ45Ma04f1I0GQV4tUiDtH03OYmoGw/copy"
          target="_blank"
          rel="noopener noreferrer"
        >
          📄 Get CSV template
        </a>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />

        {!props.minimal && (
          savingName === null ? (
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
          )
        )}
      </div>
      {uploadNotice && <p style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 700, margin: 0 }}>✅ {uploadNotice}</p>}
    </div>
  );
}
