import type { MCQuestion, QuizQuestion, Subject } from '../../types';
import ImageUploadField from '../../components/ImageUploadField';
import SetLibraryControls from './SetLibraryControls';
import { blankMC, getQuestionIssue } from './QuizEditor';

// Multiple choice as a compact table (Build Queue 253, her words: "making things smaller, making it more of a
// table view"). One row per question: the question, four answers, a circle to mark the right one, a picture.
const L = ['A', 'B', 'C', 'D'];
export default function McTableEditor({ subject, questions, onChange }: { subject: Subject; questions: QuizQuestion[]; onChange: (q: QuizQuestion[]) => void }) {
  const mcs = questions.filter((q): q is MCQuestion => q.kind === 'mc');
  const upd = (id: string, patch: Partial<MCQuestion>) => onChange(mcs.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <SetLibraryControls kind="quiz" subject={subject} current={questions} onInsert={(items) => onChange([...mcs, ...items.filter((q): q is MCQuestion => q.kind === 'mc')])} />
      <div className="mct-wrap">
        <table className="mct">
          <thead><tr><th>#</th><th>Question</th>{L.map((l) => <th key={l}>Answer {l}</th>)}<th>Picture</th><th /></tr></thead>
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
                  <td className="mct-pic">
                    <details>
                      <summary>{q.imageUrl ? <img src={q.imageUrl} alt="" /> : '＋'}</summary>
                      <div className="mct-pop"><ImageUploadField label="Picture" value={q.imageUrl} onChange={(imageUrl) => upd(q.id, { imageUrl: imageUrl || undefined })} altValue={q.imageAlt} onAltChange={(imageAlt) => upd(q.id, { imageAlt: imageAlt || undefined })} /></div>
                    </details>
                  </td>
                  <td><button type="button" className="btn btn-sm btn-danger" aria-label={`Delete question ${i + 1}`} onClick={() => onChange(mcs.filter((x) => x.id !== q.id))}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => onChange([...mcs, blankMC()])}>➕ Add a question</button>
    </div>
  );
}
