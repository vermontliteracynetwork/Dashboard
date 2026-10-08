import { useState } from 'react';
import { unzipSync } from 'fflate';
import { useStore } from '../../store/store';
import { parseCSV, downloadCSV } from '../../lib/csv';
import { rowsToQuizQuestions, QUIZ_TEMPLATE_ROWS } from '../../lib/importQuestions';
import { uploadImage } from '../../lib/upload';
import QuizEditor, { getQuestionIssue } from './QuizEditor';
import type { QuestionSet, QuizQuestion, Subject } from '../../types';

// Question Sets: CSV in and out, plus a zip of pictures (teacher, 2026-10-08:
// "allow me in this view to download csv file and uplaod a csv. when i
// upload a csv, give me option to upload a zip file of images. take the file
// and assume that the order the images are saved are the corresponsiding
// quesions in order. apply one image to each question. allow me to preview
// all questions with images (editing as needed) before i save the question
// set"). Pictures stay on this computer until Save, then upload.

const IMG = /\.(png|jpe?g|gif|webp|svg)$/i;
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// One question set as rows in the same layout as the template.
export function setToRows(set: QuestionSet): string[][] {
  const rows: string[][] = [QUIZ_TEMPLATE_ROWS[0]];
  for (const q of set.questions) {
    if (q.kind === 'mc') { const c = [...q.choices, '', '', '', ''].slice(0, 4); rows.push([q.prompt, ...c, String.fromCharCode(65 + q.correctIndex), q.imageUrl ?? '']); }
    else if (q.kind === 'fill') { const c = [...(q.wordBank ?? []), '', '', '', ''].slice(0, 4); rows.push([q.prompt, ...c, q.answer, q.imageUrl ?? '']); }
    else if (q.kind === 'speak') rows.push([q.prompt, '', '', '', '', q.targetWord, q.imageUrl ?? '']);
    else rows.push([q.prompt, ...q.pairs.slice(0, 4).map((p) => `${p.left} = ${p.right}`), '', q.imageUrl ?? '']);
  }
  return rows;
}

export default function QuestionSetImport() {
  const questionSets = useStore((s) => s.questionSets);
  const addQuestionSet = useStore((s) => s.addQuestionSet);
  const [exportId, setExportId] = useState('');
  const [draft, setDraft] = useState<{ name: string; subject: Subject; questions: QuizQuestion[] } | null>(null);
  const [images, setImages] = useState<{ name: string; url: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const onCsv = async (file: File) => {
    setMsg('');
    const questions = rowsToQuizQuestions(parseCSV(await file.text()));
    if (!questions.length) { setMsg('No questions found in that file. Start from the template so the columns line up.'); return; }
    setImages([]);
    setDraft({ name: file.name.replace(/\.csv$/i, ''), subject: 'literacy', questions });
    setMsg(`Read ${questions.length} questions. Add a zip of pictures next, or go straight to checking them below.`);
  };

  // The pictures go on the questions in order: the first picture on question 1, and so on.
  const onZip = async (file: File) => {
    if (!draft) return;
    try {
      const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
      const names = Object.keys(files).filter((n) => IMG.test(n) && !n.startsWith('__MACOSX') && !n.split('/').pop()!.startsWith('.')).sort(natural);
      if (!names.length) { setMsg('That zip has no pictures in it (png, jpg, gif, webp or svg).'); return; }
      const imgs = names.map((n) => ({ name: n.split('/').pop()!, url: URL.createObjectURL(new Blob([files[n]], { type: MIME[n.split('.').pop()!.toLowerCase()] ?? 'image/png' })) }));
      setImages(imgs);
      setDraft({ ...draft, questions: draft.questions.map((q, i) => (imgs[i] ? { ...q, imageUrl: imgs[i].url } : q)) });
      const n = Math.min(imgs.length, draft.questions.length);
      setMsg(`Put ${n} picture${n === 1 ? '' : 's'} on questions 1 to ${n}, in file name order (${imgs[0].name} on question 1).${imgs.length !== draft.questions.length ? ` Heads up: ${imgs.length} pictures and ${draft.questions.length} questions.` : ''} Check each one below.`);
    } catch { setMsg('Could not open that zip file.'); }
  };

  const save = async () => {
    if (!draft) return;
    const bad = draft.questions.map((q, i) => ({ i, issue: getQuestionIssue(q) })).find((x) => x.issue);
    if (bad) { setMsg(`Question ${bad.i + 1}: ${bad.issue}`); return; }
    if (!draft.name.trim()) { setMsg('Give the set a name first.'); return; }
    setSaving(true); setMsg('Saving the pictures...');
    try {
      const questions: QuizQuestion[] = [];
      for (const q of draft.questions) {
        if (q.imageUrl?.startsWith('blob:')) { const blob = await (await fetch(q.imageUrl)).blob(); questions.push({ ...q, imageUrl: await uploadImage(blob) }); }
        else questions.push(q);
      }
      addQuestionSet({ name: draft.name.trim(), subject: draft.subject, kind: 'quiz', questions, cards: [], tags: [] });
      images.forEach((im) => URL.revokeObjectURL(im.url));
      setDraft(null); setImages([]); setMsg(`Saved "${draft.name.trim()}" with ${questions.length} questions.`);
    } catch (e) { setMsg(`Saving stopped: ${(e as Error).message}`); }
    setSaving(false);
  };

  const exportSet = questionSets.find((s) => s.id === exportId);
  return (
    <div className="stack" style={{ gap: 10, padding: 12, border: '2px dashed var(--content-border, #ccc)', borderRadius: 12 }}>
      <strong>⬆️⬇️ CSV files</strong>
      <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
        <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => downloadCSV('question-set-template.csv', QUIZ_TEMPLATE_ROWS)}>⬇️ Download the template</button>
        <select value={exportId} onChange={(e) => setExportId(e.target.value)} style={{ minHeight: 44 }} aria-label="Pick a set to download">
          <option value="">Download a set as CSV…</option>
          {questionSets.filter((s) => s.kind === 'quiz').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} disabled={!exportSet} onClick={() => exportSet && downloadCSV(`${exportSet.name}.csv`, setToRows(exportSet))}>⬇️ Download</button>
        <label className="btn btn-sm btn-primary" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
          ⬆️ Upload a CSV
          <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); e.target.value = ''; }} />
        </label>
      </div>
      {draft && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="row-wrap" style={{ gap: 8, alignItems: 'center' }}>
            <label className="btn btn-sm" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
              🖼️ Upload a zip of pictures (optional)
              <input type="file" accept=".zip,application/zip" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void onZip(f); e.target.value = ''; }} />
            </label>
            <small style={{ opacity: 0.75 }}>Pictures go on the questions in file name order: 1.png on question 1, 2.png on question 2...</small>
          </div>
          <div className="row-wrap" style={{ gap: 8 }}>
            <label className="stack" style={{ gap: 4, flex: '1 1 260px' }}><strong>Set name</strong>
              <input className="input" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label className="stack" style={{ gap: 4 }}><strong>Subject</strong>
              <select value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value as Subject })} style={{ minHeight: 44 }}>
                <option value="literacy">📚 Literacy</option><option value="math">🔢 Math</option>
              </select>
            </label>
          </div>
          <strong>Preview: check and edit every question before saving ({draft.questions.length})</strong>
          <QuizEditor subject={draft.subject} questions={draft.questions} onChange={(questions) => setDraft({ ...draft, questions })} />
          <div className="row-wrap" style={{ gap: 8 }}>
            <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : '💾 Save question set'}</button>
            <button type="button" className="btn" style={{ minHeight: 44 }} disabled={saving} onClick={() => { images.forEach((im) => URL.revokeObjectURL(im.url)); setDraft(null); setImages([]); setMsg(''); }}>Cancel</button>
          </div>
        </div>
      )}
      {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
    </div>
  );
}
