import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import ReadAloud from '../../components/ReadAloud';
import { checkDiaryTask, diaryOwner, type DiaryEntry } from '../../lib/diaryBook';
import { todayISO } from '../../lib/dates';
import type { Student, Task } from '../../types';

// Build Queue 582: a Diary entry as an assignment. The student opens their Diary, makes today's page, and the list ticks
// itself off (a page made today, the word count, the things that must be on it); then "I did it!" opens up.
export default function DiaryTask({ student, task, onDone }: { student: Student; task: Task; onDone: () => void }) {
  const navigate = useNavigate();
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === diaryOwner(student.id)));
  const req = task.diary ?? { instructions: '' };
  const today = todayISO();
  const pages = Object.values((row?.look ?? {}) as Record<string, DiaryEntry | null>).filter((e): e is DiaryEntry => !!e?.at && new Date(e.at).toLocaleDateString('en-CA') === today && !!e.page);
  // The best of today's pages counts.
  const results = pages.map((e) => checkDiaryTask(e.page!, req)).sort((a, b) => b.rows.filter((r) => r.ok).length - a.rows.filter((r) => r.ok).length);
  const res = results[0] ?? checkDiaryTask(null, req);
  const title = task.studentTitle || task.title;
  return (
    <div className="content-well stack diary-task">
      <div className="row"><h3 style={{ margin: 0 }}>{title}</h3><ReadAloud text={`${title}. ${req.instructions ?? ''}`} settings={student.ttsSettings} /></div>
      {req.instructions && <p>{req.instructions}</p>}
      <ul className="diary-task-list">
        {res.rows.map((r) => <li key={r.label} className={r.ok ? 'ok' : ''}><span aria-hidden>{r.ok ? '✓' : ''}</span>{r.label}</li>)}
      </ul>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-lg" onClick={() => navigate('/student/diary', { state: { diaryTask: { title, instructions: req.instructions, minWords: req.minWords, needs: req.needs } } })}>Open my Diary</button>
        <button type="button" className="btn btn-primary btn-lg pulse-cta" disabled={!res.done} onClick={onDone}>I did it!</button>
      </div>
      {!res.done && <p style={{ fontSize: '0.85rem', opacity: 0.75, textAlign: 'center' }}>Finish the list in your Diary, then come back here.</p>}
    </div>
  );
}
