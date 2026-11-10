import { useState } from 'react';
import type { MCQuestion, QuizQuestion, Subject } from '../../types';
import ImageUploadField from '../../components/ImageUploadField';
import SetLibraryControls from './SetLibraryControls';
import { makeId } from '../../lib/id';
import { blankMC, getQuestionIssue } from './QuizEditor';
import { SetHintField } from './SetHintField';

// Multiple choice as a compact table (Build Queue 253, her words: "making things smaller, making it more of a
// table view"). One row per question: the question, four answers, a circle to mark the right one, a picture.
const L = ['A', 'B', 'C', 'D'];
export default function McTableEditor({ subject, questions, onChange }: { subject: Subject; questions: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void }) {
  const mcs = questions.filter((q): q is MCQuestion => q.kind === 'mc');
  // Build Queue 526 (her words: "when i click an image in question set creation, open it in a pop up view so i can see it
  // larger"): the picture opens big in a pop up, with change, remove and the description under it.
  const [picId, setPicId] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  const picQ = mcs.find((q) => q.id === picId);
  const upd = (id: string, patch: Partial<MCQuestion>) => onChange(mcs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <SetLibraryControls kind="quiz" subject={subject} current={questions} onInsert={(items) => onChange([...mcs, ...items.filter((q): q is MCQuestion => q.kind === 'mc')])} onPictures={(byN) => onChange(mcs.map((q, i) => (byN[i + 1] ? { ...q, imageUrl: byN[i + 1] } : q)))} />
      <SetHintField questions={mcs} onChange={onChange} />
      <div className="mct-wrap">
        <table className="mct">
          <thead><tr><th>#</th><th>Question</th>{L.map((l) => <th key={l}>Answer {l}</th>)}<th title="Optional. A hint just for this question; it replaces the set hint.">Hint</th><th>Picture</th><th /></tr></thead>
          <tbody>
            {mcs.map((q, i) => {
              const issue = getQuestionIssue(q);
              const choices = [...q.choices, '', '', '', ''].slice(0, 4);
              return (
                <tr key={q.id} className={issue && (q.prompt || q.choices.some(Boolean)) ? 'bad' : ''} title={issue ?? ''}>
                  <td className="mct-n">{i + 1}</td>
                  <td><input value={q.prompt} placeholder="Type the question" aria-label={`Question ${i + 1}`} onChange={(e) => upd(q.id, { prompt: e.target.value })} /></td>
                  {choices.map((c, k) => (
                    <td key={k} className={q.correctIndex === k ? 'right' : ''}>
                      <div className="mct-choice">
                        <button type="button" className="mct-mark" aria-label={`Mark answer ${L[k]} as right`} aria-pressed={q.correctIndex === k} onClick={() => upd(q.id, { correctIndex: k })}>{q.correctIndex === k ? '✓' : L[k]}</button>
                        <input value={c} placeholder={k < 2 ? `Answer ${L[k]}` : 'Optional'} aria-label={`Question ${i + 1} answer ${L[k]}`}
                          onChange={(e) => { const ch = choices.slice(); ch[k] = e.target.value; let end = 4; while (end > 2 && !ch[end - 1].trim() && q.correctIndex < end - 1) end--; upd(q.id, { choices: ch.slice(0, end) }); }} />
                      </div>
                    </td>
                  ))}
                  <td className="mct-hint"><input value={q.hint ?? ''} placeholder="Optional" aria-label={`Question ${i + 1} hint`} title="A hint just for this question. Leave empty to use the set hint." onChange={(e) => upd(q.id, { hint: e.target.value || undefined })} /></td>
                  <td className="mct-pic">
                    <button type="button" className="mct-thumb" title={q.imageUrl ? 'See the picture big' : 'Add a picture'} aria-label={q.imageUrl ? `See question ${i + 1}'s picture` : `Add a picture to question ${i + 1}`} onClick={() => setPicId(q.id)}>
                      {q.imageUrl ? <img src={q.imageUrl} alt="" /> : '＋'}
                    </button>
                  </td>
                  <td className="mct-acts"><button type="button" className="btn btn-sm" aria-label={`Duplicate question ${i + 1}`} title="Duplicate" onClick={() => onChange([...mcs.slice(0, i + 1), { ...q, id: makeId(), choices: [...q.choices] }, ...mcs.slice(i + 1)])}>⧉</button> <button type="button" className="btn btn-sm btn-danger" aria-label={`Delete question ${i + 1}`} onClick={() => onChange(mcs.filter((x) => x.id !== q.id))}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => onChange([...mcs, blankMC()])}>➕ Add a question</button>
      {picQ && (
        <div className="pf-overlay mct-lightbox" onClick={() => { setPicId(null); setBroken(false); }}>
          <div className="pf-panel" role="dialog" aria-label={`Question ${mcs.indexOf(picQ) + 1} picture`} onClick={(e) => e.stopPropagation()}>
            <div className="mct-lb-head"><b>Question {mcs.indexOf(picQ) + 1}: {picQ.prompt || 'Picture'}</b><button type="button" className="btn btn-sm" aria-label="Close" onClick={() => { setPicId(null); setBroken(false); }}>✕</button></div>
            {picQ.imageUrl && (broken
              ? <p className="mct-lb-broken">This picture did not load. Its link may be wrong or the file was moved. Upload it again below.</p>
              : <img className="mct-lb-img" src={picQ.imageUrl} alt={picQ.imageAlt ?? ''} onError={() => setBroken(true)} />)}
            <ImageUploadField label={picQ.imageUrl ? 'Change the picture' : 'Picture'} value={picQ.imageUrl} onChange={(imageUrl) => { setBroken(false); upd(picQ.id, { imageUrl: imageUrl || undefined }); }} altValue={picQ.imageAlt} onAltChange={(imageAlt) => upd(picQ.id, { imageAlt: imageAlt || undefined })} />
          </div>
        </div>
      )}
    </div>
  );
}
