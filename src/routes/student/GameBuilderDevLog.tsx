import type { GameProject } from '../../lib/gameBuilder/model';
import { DEV_LABEL } from '../../lib/gameBuilder/devlog';

// A project's development log (Build Queue 679): the student sees it from the checklist ("My dev log"), and the
// teacher from Inbox, Game Builder requests, Projects. Download CSV keeps it for her records.
const cell = (v: string) => { const t = /^[=+\-@]/.test(v) ? `'${v}` : v; return `"${t.replace(/"/g, '""')}"`; };

export default function DevLogView({ p, who, onClose }: { p: GameProject; who?: string; onClose: () => void }) {
  const rows = [...(p.devlog ?? [])].reverse();
  const csv = () => {
    const lines = [['Date', 'Time', 'Student', 'Project', 'Kind', 'Who', 'What'].map(cell).join(','), ...[...(p.devlog ?? [])].map((e) => { const d = new Date(e.at); return [d.toLocaleDateString(), d.toLocaleTimeString(), who ?? '', p.name, DEV_LABEL[e.kind], e.by === 'azalea' ? 'Azalea' : 'Student', e.text].map(cell).join(','); })];
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' })); a.download = `${p.name.replace(/\W+/g, '-')}-dev-log.csv`; a.click();
  };
  return (
    <div className="gbl-modal" role="dialog" aria-label={`Development log for ${p.name}`}>
      <div className="gbl-modal-box">
        <div className="gbl-modal-head">
          <h2>Dev log: {p.name}{who ? ` (${who})` : ''}</h2>
          <button type="button" className="gbx-btn" onClick={csv} disabled={!rows.length}>Download CSV</button>
          <button type="button" className="gbx-btn gbx-primary" onClick={onClose}>Close</button>
        </div>
        <p className="gbx-muted">Everything added to this game, newest first.</p>
        <div className="gbd-list">
          {!rows.length && <p>Nothing yet.</p>}
          {rows.map((e, i) => (
            <div key={`${e.at}-${i}`} className={`gbd-row by-${e.by}`}>
              <small>{new Date(e.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small>
              <b>{DEV_LABEL[e.kind]}{e.by === 'azalea' ? ' (Azalea)' : ''}</b>
              <span>{e.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
