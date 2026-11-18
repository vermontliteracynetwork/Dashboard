import { useMemo, useState } from 'react';
import { useAllBuildRequests, useAllProjects, type Specificity } from '../lib/gameBuilder/store';
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
      return { id, n, weekSpecific, specific: pct('specific'), partly: pct('partly'), vague: pct('vague'), words: Math.round(rs.reduce((a, r) => a + r.words, 0) / n), details: (rs.reduce((a, r) => a + r.details.length, 0) / n).toFixed(1), revised: rs.filter((r) => r.revisedLater || r.revisionOf || r.undone).length, voice: rs.filter((r) => r.voice).length, own: rs.filter((r) => !r.usedFrame).length };
    });
  }, [rows]);

  const download = () => {
    const head = ['Date', 'Time', 'Student', 'Project', 'Game kind', 'Step', 'Typed or voice', 'What they said', 'Words', 'Azalea answered', 'What was done', 'How specific', 'Details they gave', 'Azalea asked for', 'Changes an earlier request', 'Changed again later', 'Undid it', 'Used a starter or choice', 'Azalea had asked', 'Scored by'];
    const lines = rows.map((r) => { const d = new Date(r.at); return [d.toLocaleDateString(), d.toLocaleTimeString(), nameFor(r.studentId), r.projectName, KIND_INFO[r.kind]?.label ?? r.kind, STEPS.find((s) => s.id === r.step)?.label ?? r.step, r.voice ? 'Voice' : 'Typed', r.said, String(r.words), r.reply, r.changes.join('; '), SPEC_LABEL[r.specificity], r.details.join('; '), r.missing.join('; '), r.revisionOf ? 'Yes' : 'No', r.revisedLater ? 'Yes' : 'No', r.undone ? 'Yes' : 'No', r.usedFrame ? 'Yes' : 'No', r.prompt ?? '', r.source === 'ai' ? 'AI' : 'Built-in guide'].map(csvCell).join(','); });
    const blob = new Blob([[head.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `game-builder-requests-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (view === 'projects') return (
    <section className="gbl">
      <div className="gbl-bar">
        <div className="az-log-tabs" role="tablist"><button type="button" role="tab" aria-selected={false} onClick={() => setView('requests')}>Requests</button><button type="button" role="tab" aria-selected className="on">Projects</button></div>
        <label>Student <select value={who} onChange={(e) => setWho(e.target.value)}><option value="">All students</option>{[...new Set(projects.map((p) => p.studentId))].map((s) => <option key={s} value={s}>{nameFor(s)}</option>)}</select></label>
      </div>
      {!projects.length ? <p className="gbl-empty">No projects yet.</p> : (
        <table className="gbl-table">
          <thead><tr><th>Student</th><th>Project</th><th>Idea and how you win</th><th>Step</th><th title="Rules made of blocks">Rules</th><th title="Sprites the student drew">Drawn sprites</th><th>Play tests</th><th>Saved</th><th /></tr></thead>
          <tbody>{projects.filter((p) => !who || p.studentId === who).map((p) => (
            <tr key={`${p.studentId}-${p.id}`}>
              <td><b>{nameFor(p.studentId)}</b></td>
              <td>{p.name}<br /><small>{KIND_INFO[p.kind]?.label}{p.design.style ? ` · ${p.design.style === 'lowpoly' ? 'Low poly' : p.design.style === 'pixel' ? 'Pixel' : 'Classic'} art` : ''}</small></td>
              <td>{p.design.idea || <small>No idea saved yet</small>}{p.design.goal && <><br /><small>Win: {p.design.goal}</small></>}</td>
              <td>{STEPS.find((s) => s.id === p.step)?.label}</td>
              <td>{p.kind === 'custom' ? <small>{p.code ? 'Written by Azalea' : 'None yet'}</small> : p.rules.length}</td>
              <td>{Object.keys(p.design.sprites ?? {}).length}</td>
              <td>{p.plays}</td>
              <td><small>{new Date(p.updatedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></td>
              <td><button type="button" className="btn btn-sm" onClick={() => setPlaying(p)}>Play</button> <button type="button" className="btn btn-sm" onClick={() => setLogOf(p)}>Dev log ({(p.devlog ?? []).length})</button></td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {playing && <Player p={playing} onClose={() => setPlaying(null)} />}
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
          <thead><tr><th>Student</th><th title="Messages sent to Azalea">Requests</th><th title="Named what to change plus how much or when">Specific</th><th title="Percent specific in the last 7 days, to compare with the whole range">Specific, last 7 days</th><th>Partly</th><th>Not yet</th><th title="Average words per request">Avg words</th><th title="Average details per request (what, how much, when, where, looks)">Avg details</th><th title="Requests that changed an earlier request, or were changed again later">Revisions</th><th>By voice</th><th title="Requests written without a sentence starter or tap-in choice">On their own</th></tr></thead>
          <tbody>{summary.map((s) => <tr key={s.id}><td>{nameFor(s.id)}</td><td>{s.n}</td><td>{s.specific}%</td><td>{s.weekSpecific}</td><td>{s.partly}%</td><td>{s.vague}%</td><td>{s.words}</td><td>{s.details}</td><td>{s.revised}</td><td>{s.voice}</td><td>{s.own}</td></tr>)}</tbody>
        </table>
        <table className="gbl-table">
          <thead><tr><th>When and who</th><th>Project</th><th>What they said</th><th>Azalea answered</th><th>What was done</th><th>How specific</th><th>Revised?</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`gbl-${r.specificity}`}>
                <td><b>{nameFor(r.studentId)}</b><br /><small>{new Date(r.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></td>
                <td>{r.projectName}<br /><small>{KIND_INFO[r.kind]?.label} · {STEPS.find((s) => s.id === r.step)?.label}</small></td>
                <td>"{r.said}"<br /><small>{r.voice ? 'Voice' : 'Typed'} · {r.words} word{r.words === 1 ? '' : 's'}{r.usedFrame ? ' · used a starter' : ' · on their own'}</small>{r.prompt && <><br /><small title={r.prompt}>After Azalea asked: {r.prompt.length > 90 ? `${r.prompt.slice(0, 90)}...` : r.prompt}</small></>}</td>
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
