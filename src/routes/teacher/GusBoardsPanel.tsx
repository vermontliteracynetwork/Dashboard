import { useState } from 'react';
import { useStore } from '../../store/store';
import { boardsNow, saveBoards, sendBoardCopy, useBoards, type GusBoard } from '../../games/grammarGus/boards';

// Academics, under Activities: Grammar Gus boards (teacher 2026-10-08). Open
// a board in a new tab, share it live by its 4-number code, or send each
// student their own copy to work on by themselves.

const openBoard = (id: string, live = false) => window.open(`${window.location.pathname}#/teacher/grammar-gus?board=${id}${live ? '&live=1' : ''}`, '_blank', 'noopener');

export default function GusBoardsPanel() {
  const boards = useBoards();
  const students = useStore((s) => s.students);
  const [open, setOpen] = useState(false);
  const [sendFor, setSendFor] = useState<GusBoard | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState('');

  const newBoard = () => {
    const b: GusBoard = { id: `gb-${Date.now().toString(36)}`, name: `Grammar board ${boards.length + 1}`, lines: [], updatedAt: new Date().toISOString() };
    saveBoards([b, ...boardsNow()]);
    openBoard(b.id);
  };
  const rename = (b: GusBoard) => { const name = window.prompt('Name this board', b.name)?.trim(); if (name) saveBoards(boardsNow().map((x) => (x.id === b.id ? { ...x, name } : x))); };
  const remove = (b: GusBoard) => { if (window.confirm(`Delete "${b.name}"? Copies already sent to students stay with them.`)) saveBoards(boardsNow().filter((x) => x.id !== b.id)); };
  const send = () => {
    const b = sendFor && boardsNow().find((x) => x.id === sendFor.id);
    if (!b || !picked.length) return;
    if (!b.lines.length) { setMsg('That board is empty. Open it and build something first.'); return; }
    sendBoardCopy(picked, b);
    setMsg(`Sent "${b.name}" to ${picked.length} student${picked.length === 1 ? '' : 's'}. It waits at the top of their Workboard.`);
    setSendFor(null); setPicked([]);
  };

  return (
    <div className="chrome-frame stack" style={{ padding: 14 }}>
      <button className="space-between" style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', minHeight: 44 }} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span style={{ fontWeight: 800, fontSize: '1rem' }}>⚙️ Grammar Gus boards{boards.length ? ` (${boards.length})` : ''}</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="stack" style={{ gap: 10, marginTop: 10 }}>
          <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>Build a grammar board in its own tab. Share it live (students tap Join and type the code to build with you), or send each student a copy to do by themselves.</p>
          <button type="button" className="btn btn-primary" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={newBoard}>➕ New board (opens a new tab)</button>
          {boards.length === 0 && <p style={{ opacity: 0.7, margin: 0 }}>No boards yet.</p>}
          {boards.map((b) => (
            <div key={b.id} className="row-wrap" style={{ gap: 8, alignItems: 'center', padding: 8, border: '2px solid var(--content-border, #ddd)', borderRadius: 12 }}>
              <span style={{ flex: '1 1 220px' }}><strong>{b.name}</strong><br /><small style={{ opacity: 0.7 }}>{b.lines.length} machine{b.lines.length === 1 ? '' : 's'} · saved {new Date(b.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></span>
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => openBoard(b.id)}>🚀 Open in a new tab</button>
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => openBoard(b.id, true)}>📡 Share live</button>
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => { setSendFor(b); setPicked([]); setMsg(''); }}>📤 Send a copy</button>
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => rename(b)}>✏️ Rename</button>
              <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => remove(b)}>🗑️ Delete</button>
            </div>
          ))}
          {sendFor && (
            <div className="stack" style={{ gap: 8, padding: 12, border: '2px solid var(--purple, #6b5bd6)', borderRadius: 12 }}>
              <strong>Send a copy of "{sendFor.name}" to:</strong>
              <div className="row-wrap" style={{ gap: 6 }}>
                <button type="button" className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setPicked(picked.length === students.length ? [] : students.map((s) => s.id))}>{picked.length === students.length ? 'Nobody' : 'Everyone'}</button>
                {students.map((s) => (
                  <button key={s.id} type="button" className={`btn btn-sm${picked.includes(s.id) ? ' btn-primary' : ''}`} style={{ minHeight: 44 }} aria-pressed={picked.includes(s.id)} onClick={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))}>{s.name}</button>
                ))}
              </div>
              <div className="row-wrap" style={{ gap: 8 }}>
                <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} disabled={!picked.length} onClick={send}>📤 Send</button>
                <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => setSendFor(null)}>Cancel</button>
              </div>
            </div>
          )}
          {msg && <p role="status" style={{ margin: 0 }}>{msg}</p>}
        </div>
      )}
    </div>
  );
}
