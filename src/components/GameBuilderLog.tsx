import { useMemo, useState } from 'react';
import { saveProject, useAllBuildRequests, useAllProjects, type Specificity } from '../lib/gameBuilder/store';
import { applyAnswer, askAzalea, fixOps, problems } from '../lib/gameBuilder/azalea';
import { setTeacherEdit, withLog } from '../lib/gameBuilder/devlog';
import { Editor } from '../routes/student/GameBuilder';
import { Player } from '../routes/student/GameBuilderPlayer';
import DevLogView from '../routes/student/GameBuilderDevLog';
import type { GameProject } from '../lib/gameBuilder/model';
import { KIND_INFO, STEPS } from '../lib/gameBuilder/model';

// The Game Builder speech goal log (Build Queue 658, her words 2026-11-18): "a large part of me making this is so i
// can track the requests from my students for their speech goals. One goal i need to track is the specific
// requests, changes, details, full thought and i want to use this to make it so i can have reports similar to the
// game bug report for azalea", and "a student prompt --> ai response, what was done --> if student continued to
// revise". One row per request, word for word, newest first, with a summary per student, CSV and print.

const SPEC_LABEL: Record<Specificity, string> = { specific: 'Specific', partly: 'Partly specific', vague: 'Not specific yet' };
// Cells starting with = + - @ are quoted so a spreadsheet never runs them as formulas.
const csvCell = (v: string) => { const t = /^[=+\-@]/.test(v) ? `'${v}` : v; return `"${t.replace(/"/g, '""')}"`; };

export default function GameBuilderLog({ nameFor }: { nameFor: (id: string) => string }) {
  const all = useAllBuildRequests();
  const projects = useAllProjects();
  const [view, setView] = useState<'requests' | 'projects'>('requests');
  const [playing, setPlaying] = useState<GameProject | null>(null);
  const [logOf, setLogOf] = useState<(GameProject & { studentId: string }) | null>(null);
  // Build Queue 768 (her words: "for game builder, give me on the teacher side the way to fix and edit all projects in
  // an overhaul manner"): open any project in the full editor, or pick many and fix or change them all at once, with
  // an Undo for the last batch.
  const [editing, setEditing] = useState<(GameProject & { studentId: string }) | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [change, setChange] = useState('');
  const [working, setWorking] = useState('');
  const [undo, setUndo] = useState<(GameProject & { studentId: string })[] | null>(null);
  const keyOf = (p: { studentId: string; id: string }) => `${p.studentId}:${p.id}`;
  const bulk = async (label: string, f: (p: GameProject) => Promise<{ next: GameProject; note: string }>) => {
    const list = projects.filter((p) => picked.has(keyOf(p)));
    if (!list.length) return;
    setUndo(list); setTeacherEdit(true);
    let n = 0; const notes: string[] = [];
    try {
      for (const p of list) {
        setWorking(`${label}: ${++n} of ${list.length}`);
        const { next, note } = await f(p);
        if (next !== p) saveProject(p.studentId, withLog(next, [{ kind: 'change', by: 'azalea', text: `${label}: ${note}` }]));
        notes.push(`${nameFor(p.studentId)}, ${p.name}: ${note}`);
      }
    } finally { setTeacherEdit(false); }
    setWorking(`Done. ${notes.join(' | ')}`);
  };
  const fixAll = () => bulk('Fixed by the teacher', async (p) => { const fx = fixOps(p); if (!fx.ops.length) return { next: p, note: 'nothing to fix' }; return { next: applyAnswer(p, { ops: fx.ops, design: {}, next_step: '', code: '' }), note: fx.changes.join('; ') }; });
  const changeAll = () => { const said = change.trim(); if (!said) return; void bulk(`Teacher change "${said}"`, async (p) => { const a = await askAzalea(p, said, 0); const did = a.changes.length > 0 || a.ops.length > 0 || !!a.code; return { next: did ? { ...applyAnswer(p, { ...a, next_step: '' }), azNote: p.azNote } : p, note: did ? (a.changes.join('; ') || 'changed') : `not changed (${a.reply})` }; }); };
  const undoAll = () => { if (!undo) return; undo.forEach((p) => saveProject(p.studentId, p)); setUndo(null); setWorking(`Undid the last change on ${undo.length} project${undo.length === 1 ? '' : 's'}.`); };
  const [who, setWho] = useState('');
  const [spec, setSpec] = useState<'' | Specificity>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const rows = all.filter((r) => (!who || r.studentId === who) && (!spec || r.specificity === spec) && (!from || r.at.slice(0, 10) >= from) && (!to || r.at.slice(0, 10) <= to));
  const students = [...new Set(all.map((r) => r.studentId))];

  const summary = useMemo(() => {
    const by = new Map<string, typeof rows>();
    rows.forEach((r) => by.set(r.studentId, [...(by.get(r.studentId) ?? []), r]));
    return [...by.entries()].map(([id, rs]) => {
      const n = rs.length;
      const pct = (k: Specificity) => Math.round((rs.filter((r) => r.specificity === k).length / n) * 100);
      const week = rs.filter((r) => Date.now() - new Date(r.at).getTime() < 7 * 864e5);
      const weekSpecific = week.length ? `${Math.round((week.filter((r) => r.specificity === 'specific').length / week.length) * 100)}%` : 'none';
      return { id, n, weekSpecific, specific: pct('specific'), partly: pct('partly'), vague: pct('vague'), words: Math.round(rs.reduce((a, r) => a + r.words, 0) / n), details: (rs.reduce((a, r) => a + r.details.length, 0) / n).toFixed(1), revised: rs.filter((r) => r.revisedLater || r.revisionOf || r.undone).length, voice: rs.filter((r) => r.voice).length, own: rs.filter((r) => !r.usedFrame).length, after: rs.filter((r) => r.afterTest).length };
    });
  }, [rows]);

  const download = () => {
    const head = ['Date', 'Time', 'Student', 'Project', 'Game kind', 'Step', 'Typed or voice', 'What they said', 'Words', 'Azalea answered', 'What was done', 'How specific', 'Details they gave', 'Azalea asked for', 'Changes an earlier request', 'Changed again later', 'Undid it', 'Used a starter or choice', 'Azalea had asked', 'Scored by', 'Microphone transcript', 'After play testing'];
    const lines = rows.map((r) => { const d = new Date(r.at); return [d.toLocaleDateString(), d.toLocaleTimeString(), nameFor(r.studentId), r.projectName, KIND_INFO[r.kind]?.label ?? r.kind, STEPS.find((s) => s.id === r.step)?.label ?? r.step, r.voice ? 'Voice' : 'Typed', r.said, String(r.words), r.reply, r.changes.join('; '), SPEC_LABEL[r.specificity], r.details.join('; '), r.missing.join('; '), r.revisionOf ? 'Yes' : 'No', r.revisedLater ? 'Yes' : 'No', r.undone ? 'Yes' : 'No', r.usedFrame ? 'Yes' : 'No', r.prompt ?? '', r.source === 'ai' ? 'AI' : 'Built-in guide', r.transcript ?? '', r.afterTest ? 'Yes' : 'No'].map(csvCell).join(','); });
    const blob = new Blob([[head.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `game-builder-requests-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (view === 'projects') return (
    <section className="gbl">
      <div className="gbl-bar">
        <div className="az-log-tabs" role="tablist"><button type="button" role="tab" aria-selected={false} onClick={() => setView('requests')}>Requests</button><button type="button" role="tab" aria-selected className="on">Projects</button></div>
        <label>Student <select value={who} onChange={(e) => setWho(e.target.value)}><option value="">All students</option>{[...new Set(projects.map((p) => p.studentId))].map((s) => <option key={s} value={s}>{nameFor(s)}</option>)}</select></label>
      </div>
      <div className="gbl-bar gbl-bulk" aria-label="Change many projects at once">
        <b>{picked.size} picked</b>
        <button type="button" className="btn btn-sm" disabled={!picked.size || !!working && !working.startsWith('Done') && !working.startsWith('Undid')} onClick={() => void fixAll()} title="Azalea's game check fixes what she can in each picked game: empty rules, no way to win, a score or timer rule set to 0, a free upgrade, a jump too low">Fix problems</button>
        <input value={change} onChange={(e) => setChange(e.target.value)} placeholder='One change for every picked game, like "make the enemy speed 3"' onKeyDown={(e) => { if (e.key === 'Enter') changeAll(); }} style={{ minWidth: 320 }} />
        <button type="button" className="btn btn-sm" disabled={!picked.size || !change.trim()} onClick={changeAll} title="Azalea makes this change in every picked game, the same way she does when a student asks">Apply to picked</button>
        <button type="button" className="btn btn-sm" disabled={!undo} onClick={undoAll} title="Put the picked games back the way they were before the last Fix or Apply">Undo last</button>
        {working && <small className="gbl-working" role="status">{working}</small>}
      </div>
      {!projects.length ? <p className="gbl-empty">No projects yet.</p> : (
        <table className="gbl-table">
          <thead><tr><th><input type="checkbox" aria-label="Pick every project" checked={picked.size > 0 && projects.filter((p) => !who || p.studentId === who).every((p) => picked.has(keyOf(p)))} onChange={(e) => setPicked(e.target.checked ? new Set(projects.filter((p) => !who || p.studentId === who).map(keyOf)) : new Set())} /></th><th>Student</th><th>Project</th><th>Idea and how you win</th><th>Step</th><th title="Rules made of blocks">Rules</th><th title="Sprites the student drew">Drawn sprites</th><th>Play tests</th><th title="Changes to rules, design or assets made after play testing (from the dev log)">Changes after testing</th><th title="What would stop the game from working, found by Azalea's game check">Problems</th><th>Saved</th><th /></tr></thead>
          <tbody>{projects.filter((p) => !who || p.studentId === who).map((p) => (
            <tr key={`${p.studentId}-${p.id}`}>
              <td><input type="checkbox" aria-label={`Pick ${p.name}`} checked={picked.has(keyOf(p))} onChange={(e) => setPicked((s) => { const n = new Set(s); if (e.target.checked) n.add(keyOf(p)); else n.delete(keyOf(p)); return n; })} /></td>
              <td><b>{nameFor(p.studentId)}</b></td>
              <td>{p.name}<br /><small>{KIND_INFO[p.kind]?.label}{p.design.style ? ` · ${p.design.style === 'lowpoly' ? 'Low poly' : p.design.style === 'pixel' ? 'Pixel' : 'Classic'} art` : ''}</small></td>
              <td>{p.design.idea || <small>No idea saved yet</small>}{p.design.goal && <><br /><small>Win: {p.design.goal}</small></>}</td>
              <td>{STEPS.find((s) => s.id === p.step)?.label}</td>
              <td>{p.kind === 'custom' ? <small>{p.code ? 'Written by Azalea' : 'None yet'}</small> : p.rules.length}</td>
              <td>{Object.keys(p.design.sprites ?? {}).length}</td>
              <td>{p.plays}</td><td>{(p.devlog ?? []).filter((e) => e.text.includes('(after play testing)')).length}</td>
              <td>{(() => { const pr = problems(p); return pr.length ? <small title={pr.join('\n')}>{pr.length}: {pr[0]}</small> : <small>None</small>; })()}</td>
              <td><small>{new Date(p.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></td>
              <td><button type="button" className="btn btn-sm" onClick={() => setEditing(p)} title="Open this game in the full Game Builder editor. Your changes save to the student's game.">Edit</button> <button type="button" className="btn btn-sm" onClick={() => setPlaying(p)}>Play</button> <button type="button" className="btn btn-sm" onClick={() => setLogOf(p)}>Dev log ({(p.devlog ?? []).length})</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {playing && <Player p={playing} onClose={() => setPlaying(null)} />}
      {editing && <div className="gbl-edit"><Editor key={keyOf(editing)} initial={editing} studentId={editing.studentId} tts={undefined} teacher onClose={() => setEditing(null)} /></div>}
      {logOf && <DevLogView p={logOf} who={nameFor(logOf.studentId)} onClose={() => setLogOf(null)} />}
    </section>
  );

  return (
    <section className="gbl">
      <div className="gbl-bar">
        <div className="az-log-tabs" role="tablist"><button type="button" role="tab" aria-selected className="on">Requests</button><button type="button" role="tab" aria-selected={false} onClick={() => setView('projects')}>Projects</button></div>
        <label>Student <select value={who} onChange={(e) => setWho(e.target.value)}><option value="">All students</option>{students.map((s) => <option key={s} value={s}>{nameFor(s)}</option>)}</select></label>
        <label>How specific <select value={spec} onChange={(e) => setSpec(e.target.value as '' | Specificity)}><option value="">All</option><option value="specific">Specific</option><option value="partly">Partly specific</option><option value="vague">Not specific yet</option></select></label>
        <label>From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label>To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <span className="gbl-grow" />
        <button type="button" className="btn btn-sm" onClick={download} disabled={!rows.length}>Download CSV</button>
        <button type="button" className="btn btn-sm" onClick={() => window.print()} disabled={!rows.length} title="Print, or save as a PDF from the print window">Print or PDF</button>
      </div>
      {!rows.length ? <p className="gbl-empty">No Game Builder requests yet. Every message a student sends Azalea in Game Builder shows up here, word for word.</p> : <>
        <table className="gbl-sum">
          <thead><tr><th>Student</th><th title="Messages sent to Azalea">Requests</th><th title="Named what to change plus how much or when">Specific</th><th title="Percent specific in the last 7 days, to compare with the whole range">Specific, last 7 days</th><th>Partly</th><th>Not yet</th><th title="Average words per request">Avg words</th><th title="Average details per request (what, how much, when, where, looks)">Avg details</th><th title="Requests that changed an earlier request, or were changed again later">Revisions</th><th>By voice</th><th title="Requests written without a sentence starter or tap-in choice">On their own</th><th title="Requests made after play testing: going back to change the game">After testing</th></tr></thead>
          <tbody>{summary.map((s) => <tr key={s.id}><td>{nameFor(s.id)}</td><td>{s.n}</td><td>{s.specific}%</td><td>{s.weekSpecific}</td><td>{s.partly}%</td><td>{s.vague}%</td><td>{s.words}</td><td>{s.details}</td><td>{s.revised}</td><td>{s.voice}</td><td>{s.own}</td><td>{s.after}</td></tr>)}</tbody>
        </table>
        <table className="gbl-table">
          <thead><tr><th>When and who</th><th>Project</th><th>What they said</th><th>Azalea answered</th><th>What was done</th><th>How specific</th><th>Revised?</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`gbl-${r.specificity}`}>
                <td><b>{nameFor(r.studentId)}</b><br /><small>{new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></td>
                <td>{r.projectName}<br /><small>{KIND_INFO[r.kind]?.label} · {STEPS.find((s) => s.id === r.step)?.label}</small></td>
                <td>"{r.said}"<br /><small>{r.voice ? 'Voice' : 'Typed'} · {r.words} word{r.words === 1 ? '' : 's'}{r.usedFrame ? ' · used a starter' : ' · on their own'}{r.afterTest ? ' · after play testing' : ''}</small>{r.transcript && r.transcript !== r.said && <><br /><small>Microphone heard: "{r.transcript}"</small></>}{r.prompt && <><br /><small title={r.prompt}>After Azalea asked: {r.prompt.length > 90 ? `${r.prompt.slice(0, 90)}...` : r.prompt}</small></>}</td>
                <td>{r.reply}</td>
                <td>{r.changes.length ? r.changes.join('; ') : <small>No change (Azalea asked a question)</small>}</td>
                <td><b>{SPEC_LABEL[r.specificity]}</b>{r.details.length > 0 && <><br /><small>Gave: {r.details.join(', ')}</small></>}{r.missing.length > 0 && <><br /><small>Asked for: {r.missing.join(', ')}</small></>}</td>
                <td>{r.revisionOf ? 'Changes an earlier request' : ''}{r.revisionOf && r.revisedLater ? '; ' : ''}{r.revisedLater ? 'Changed again later' : ''}{!r.revisionOf && !r.revisedLater && !r.undone ? <small>No</small> : ''}{r.undone ? <><br /><b>Undid it</b></> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>}
    </section>
  );
}
