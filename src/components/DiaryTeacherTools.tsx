import { useState } from 'react';
import { useStore } from '../store/store';
import DiaryPage from './DiaryPage';
import { diaryOwner, textOfHtml, type DiaryEntry } from '../lib/diaryBook';
import { isLocked, setDiaryCode, useDiaryLock, validCode } from '../lib/diaryLock';

// Teacher side of Diary locks (Build Queue 624): every page is always readable here, locked or not; the teacher can
// see and change a student's 4 digit code at any time, and download the whole diary as a PDF (the print dialog's
// Save as PDF). Laptop first, no emojis.
export const diaryEntriesOf = (look: unknown) => Object.entries((look ?? {}) as Record<string, DiaryEntry | null>)
  .filter((x): x is [string, DiaryEntry] => !!x[1]?.at)
  .sort((a, b) => (a[1].at < b[1].at ? -1 : 1));

// The whole diary as printable pages: one diary page per sheet, with its date, feeling, any lock, and the typed words.
export function DiaryPrint({ studentId, studentName, from, to, title, note, onClose }: {
  studentId: string; studentName: string; from?: string; to?: string; title?: string; note?: string; onClose: () => void;
}) {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === diaryOwner(studentId)));
  const lock = useDiaryLock(studentId);
  const pages = diaryEntriesOf(row?.look).filter(([, e]) => (!from || e.at >= `${from}T00:00`) && (!to || new Date(e.at) <= new Date(`${to}T23:59:59.999`)));
  return (
    <div className="sel-print-area dprint">
      <div className="sel-print-toolbar">
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>Download PDF (choose Save as PDF)</button>
        <button type="button" className="btn" onClick={onClose}>Close</button>
      </div>
      <h1 className="dprint-title">{title ?? `${studentName}'s Diary`}</h1>
      <p className="dprint-sub">{pages.length} page{pages.length === 1 ? '' : 's'}{from || to ? `, ${from || 'the start'} to ${to || 'today'}` : ''}. Printed {new Date().toLocaleDateString()}.{note ? ` ${note}` : ''}</p>
      {pages.length === 0 && <p>No diary pages yet.</p>}
      {pages.map(([id, e]) => {
        const words = textOfHtml(e.page?.html) || e.caption || '';
        return (
          <section key={id} className="dprint-page">
            <h2>{new Date(e.at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
            <p className="dprint-meta">{e.feeling ? `Feeling: ${e.feeling}` : 'No feeling picked'}{isLocked(lock, id) ? '. The student locked this page.' : ''}</p>
            {e.page ? <DiaryPage page={e.page} className="dprint-dp" lite studentId={studentId} day={e.at.slice(0, 10)} /> : e.photo ? <img className="dprint-photo" src={e.photo} alt="" /> : null}
            {words && <p className="dprint-words"><b>Written on the page:</b> {words}</p>}
          </section>
        );
      })}
    </div>
  );
}

export default function DiaryTeacherTools() {
  const students = useStore((s) => s.students);
  const styleLooks = useStore((s) => s.styleLooks);
  const [sid, setSid] = useState('');
  const [show, setShow] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [msg, setMsg] = useState('');
  const [printing, setPrinting] = useState(false);
  const lock = useDiaryLock(sid);
  const pages = sid ? diaryEntriesOf(styleLooks.find((r) => r.ownerId === diaryOwner(sid))?.look) : [];
  const lockedN = pages.filter(([id]) => isLocked(lock, id)).length;
  const name = students.find((s) => s.id === sid)?.name ?? '';
  if (printing && sid) return <DiaryPrint studentId={sid} studentName={name} onClose={() => setPrinting(false)} />;
  const save = () => {
    if (!validCode(newCode)) { setMsg('A code is exactly 4 numbers.'); return; }
    setDiaryCode(sid, newCode); setNewCode(''); setShow(true); setMsg(`Saved. ${name.split(' ')[0]}'s new code is ${newCode}.`);
  };
  return (
    <div className="content-well stack dtt" style={{ gap: 10 }}>
      <h2 style={{ margin: 0 }}>Diaries: locked pages, codes and PDF</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>Students can lock a Diary page with a 4 number code so other students cannot see it. You can always read every page here, change a forgotten code, and download a whole diary as a PDF.</p>
      <div className="row-wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
        <label className="stack" style={{ gap: 4 }}>Student
          <select value={sid} onChange={(e) => { setSid(e.target.value); setShow(false); setMsg(''); setNewCode(''); }}>
            <option value="">Pick a student</option>
            {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        </label>
        {sid && <span style={{ opacity: 0.85 }}>{pages.length} page{pages.length === 1 ? '' : 's'}, {lockedN} locked</span>}
        {sid && <button type="button" className="btn btn-primary" disabled={!pages.length} onClick={() => setPrinting(true)}>Download whole diary (PDF)</button>}
      </div>
      {sid && (
        <div className="row-wrap" style={{ gap: 12, alignItems: 'center' }}>
          <span>Code: <b className="dtt-code">{lock.code ? (show ? lock.code : '••••') : 'Not made yet'}</b></span>
          {lock.code && <button type="button" className="btn btn-sm" onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>}
          <label className="row-wrap" style={{ gap: 6, alignItems: 'center' }} title="Type 4 numbers. The student uses the new code from now on.">
            New code
            <input inputMode="numeric" maxLength={4} pattern="\d{4}" value={newCode} onChange={(e) => { setNewCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setMsg(''); }} style={{ width: 90, letterSpacing: 4 }} aria-label="New 4 number code" />
          </label>
          <button type="button" className="btn btn-sm" onClick={save} disabled={newCode.length !== 4}>Change code</button>
          {msg && <span role="status">{msg}</span>}
        </div>
      )}
    </div>
  );
}
