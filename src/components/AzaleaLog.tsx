import { useMemo, useState } from 'react';
import { useStore } from '../store/store';

// Azalea's running log (teacher 2026-10-14: "azalea should keep a running of all of these submitted by
// day in inbox. think of it like a growing table so i can keep running updates and have an easy view").
// Every bug report and idea students sent through Azalea, newest day first, one row each, with the
// game, what they said, the memo (and its transcript), photos, and a Fixed button. Filters and a CSV
// download keep it easy to scan as it grows.
const BUG = 'Glitch / Bug Found', IDEA = 'Feature to Add';
interface Row { id: string; studentId: string; at: string; game: string; bug: boolean; fields: Record<string, string>; memo?: string; transcript?: string; photos: string[]; done: boolean }

function parse(text: string) {
  const fields: Record<string, string> = {}; const photos: string[] = []; let memo: string | undefined; let transcript: string | undefined;
  for (const line of text.split('\n')) {
    const m = line.match(/🎙️ Voice memo \(\d+ seconds\): (\S+)/); if (m) { memo = m[1]; continue; }
    const t = line.match(/📝 Memo transcript: "?(.*?)"?$/); if (t) { transcript = t[1]; continue; }
    const p = line.match(/📷 Photo: (\S+)/); if (p) { photos.push(p[1]); continue; }
    const kv = line.match(/^([A-Za-z ]+): (.*)$/);
    if (kv) fields[kv[1].trim()] = kv[2].trim(); else if (line.trim()) fields.Said = fields.Said ? `${fields.Said} ${line.trim()}` : line.trim();
  }
  return { fields, photos, memo, transcript };
}
const DETAIL_ORDER = ['Part', 'Kind', 'Doing', 'How often', 'Can still play', 'Like this game', 'Why', 'Device'];
const dayKey = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export default function AzaleaLog({ nameFor, onPhoto }: { nameFor: (id: string) => string; onPhoto: (url: string) => void }) {
  const feedback = useStore((s) => s.studentFeedback);
  const resolveFeedback = useStore((s) => s.resolveFeedback);
  const [show, setShow] = useState<'all' | 'bug' | 'idea'>('all');
  const [openOnly, setOpenOnly] = useState(false);
  const [game, setGame] = useState('all');
  const rows: Row[] = useMemo(() => feedback
    .filter((f) => f.category === 'gameplay' && (f.subcategoryLabel === BUG || f.subcategoryLabel === IDEA))
    .map((f) => { const p = parse(f.text); return { id: f.id, studentId: f.studentId, at: f.createdAt, game: f.customLabel ?? 'Unknown game', bug: f.subcategoryLabel === BUG, done: f.resolved, ...p }; })
    .sort((a, b) => (a.at < b.at ? 1 : -1)), [feedback]);
  const games = [...new Set(rows.map((r) => r.game))].sort();
  const shown = rows.filter((r) => (show === 'all' || (show === 'bug') === r.bug) && (!openOnly || !r.done) && (game === 'all' || r.game === game));
  const days: [string, Row[]][] = [];
  for (const r of shown) { const k = dayKey(r.at); const d = days.find((x) => x[0] === k); if (d) d[1].push(r); else days.push([k, [r]]); }

  const csv = () => {
    const cols = ['Date', 'Time', 'Student', 'Game', 'Bug or idea', 'Said', ...DETAIL_ORDER, 'Memo transcript', 'Voice memo', 'Photos', 'Fixed'];
    const q = (v: string) => `"${(v ?? '').replace(/"/g, '""')}"`;
    const lines = shown.map((r) => [new Date(r.at).toLocaleDateString(), new Date(r.at).toLocaleTimeString(), nameFor(r.studentId), r.game, r.bug ? 'Bug' : 'Idea', r.fields.Said ?? '', ...DETAIL_ORDER.map((k) => r.fields[k] ?? ''), r.transcript ?? '', r.memo ?? '', r.photos.join(' '), r.done ? 'Yes' : 'No'].map(q).join(','));
    const blob = new Blob([[cols.map(q).join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `azalea-log-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <section className="az-log">
      <div className="az-log-head">
        <img src="/characters/azalea-head.png" alt="" />
        <div><h2>Azalea's log</h2><p>{rows.length} reports · {rows.filter((r) => r.bug && !r.done).length} bugs open · {rows.filter((r) => !r.bug && !r.done).length} ideas open</p></div>
        <span style={{ flex: 1 }} />
        <select id="az-log-game" value={game} onChange={(e) => setGame(e.target.value)} aria-label="Game"><option value="all">Every game</option>{games.map((g) => <option key={g} value={g}>{g}</option>)}</select>
        <div className="az-log-tabs" role="tablist">
          {(['all', 'bug', 'idea'] as const).map((k) => <button key={k} type="button" role="tab" aria-selected={show === k} className={show === k ? 'on' : ''} onClick={() => setShow(k)}>{k === 'all' ? 'All' : k === 'bug' ? '🐞 Bugs' : '💡 Ideas'}</button>)}
        </div>
        <label className="az-log-open"><input id="az-log-open" type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} /> Open only</label>
        <button type="button" className="btn" onClick={csv} disabled={!shown.length}>⬇️ Download CSV</button>
      </div>
      {days.length === 0 ? <p style={{ opacity: 0.7 }}>No reports yet. When a student talks to Azalea, it shows up here.</p> : days.map(([day, list]) => (
        <div key={day} className="az-log-day">
          <h3>{day} <small>{list.filter((r) => r.bug).length} bugs · {list.filter((r) => !r.bug).length} ideas</small></h3>
          <div className="az-log-scroll">
            <table className="az-log-table">
              <thead><tr><th>Time</th><th>Student</th><th>Game</th><th>Type</th><th>What they said</th><th>Details</th><th>Voice memo</th><th>Photos</th><th>Status</th></tr></thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id} className={r.done ? 'done' : r.bug && r.fields['Can still play']?.startsWith('No') ? 'urgent' : ''}>
                    <td>{new Date(r.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                    <td>{nameFor(r.studentId)}</td>
                    <td>{r.game}</td>
                    <td>{r.bug ? '🐞 Bug' : '💡 Idea'}</td>
                    <td className="said">{r.fields.Said ?? '(voice memo only)'}{r.transcript && <div className="tx">📝 Memo said: "{r.transcript}"</div>}</td>
                    <td className="det">{DETAIL_ORDER.filter((k) => r.fields[k]).map((k) => <div key={k}><b>{k}:</b> {r.fields[k]}</div>)}</td>
                    <td>{r.memo ? <audio controls preload="none" src={r.memo} /> : '-'}</td>
                    <td>{r.photos.length ? r.photos.map((u) => <button key={u} type="button" className="az-log-photo" onClick={() => onPhoto(u)}><img src={u} alt="Student's photo" /></button>) : '-'}</td>
                    <td>{r.done ? '✅ Fixed' : <button type="button" className="btn" onClick={() => resolveFeedback(r.id)}>{r.bug ? 'Mark fixed' : 'Mark done'}</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </section>
  );
}
