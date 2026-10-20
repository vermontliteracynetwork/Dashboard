import { useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { uploadImage } from '../../lib/upload';
import { makeId } from '../../lib/id';
import { speak } from '../../components/ReadAloud';
import SelMemoryStep from '../../components/SelMemoryStep';

// The Diary app on the student computer (Build Queue 290, her words: "remove this from login. instead add a
// \"Diary\" in computer"). The "What happened in your day?" page (a picture and a small caption, memory recall of
// daily events) moved here from the login check-in. Pages are saved in the student's diary:<studentId> style row
// (no new database column), newest first, and the SEL team report shows the ones in its dates.
export interface DiaryEntry { caption: string; photo?: string; at: string }
export const diaryOwner = (studentId: string) => `diary:${studentId}`;

export default function Diary() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === (student ? diaryOwner(student.id) : '')));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  if (!student) return null;
  const entries = Object.entries((row?.look ?? {}) as Record<string, DiaryEntry>).filter(([, e]) => e && e.at).sort((a, b) => (a[1].at < b[1].at ? 1 : -1));
  const first = student.name.split(' ')[0];

  if (writing) {
    return <SelMemoryStep name={first} tts={student.ttsSettings} submitLabel={saving ? 'Saving...' : 'Save to my diary'} skipLabel="Cancel"
      onNext={async (m) => {
        if (!m) { setWriting(false); return; }
        setSaving(true);
        const id = makeId(), at = new Date().toISOString(), owner = diaryOwner(student.id);
        mergeStyleRow(owner, { [id]: { caption: m.caption, at } });
        if (m.file) { try { const photo = await uploadImage(m.file); mergeStyleRow(owner, { [id]: { caption: m.caption, at, photo } }); } catch { /* the caption is still saved */ } }
        setSaving(false); setWriting(false);
        speak('Saved in your diary.', student.ttsSettings);
      }} />;
  }

  return (
    <div className="diary">
      <header className="diary-head">
        <button type="button" className="btn" onClick={() => back.go()}>← Back</button>
        <h1>My Diary</h1>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setWriting(true)}>New page</button>
      </header>
      {entries.length === 0 ? (
        <div className="diary-empty">
          <p>Your diary is empty. Tap <b>New page</b> to add a picture and a caption about your day.</p>
        </div>
      ) : (
        <div className="diary-pages">
          {entries.map(([id, e]) => (
            <article key={id} className="diary-page">
              {e.photo ? <img src={e.photo} alt="My diary picture" /> : <div className="diary-nopic" aria-hidden />}
              <time>{new Date(e.at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</time>
              <p>{e.caption || 'A picture from my day.'}</p>
              {e.caption && <button type="button" className="btn btn-sm" onClick={() => speak(e.caption, student.ttsSettings)} aria-label="Listen">🔊</button>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
