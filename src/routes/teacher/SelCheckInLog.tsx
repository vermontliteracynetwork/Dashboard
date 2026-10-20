import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { StylePortrait } from '../../style/StylePortrait';
import { SEL_ZONE_LABELS, SEL_ZONE_FACE } from '../../lib/selZones';
import { QUEST1_NEIGHBORS } from '../../lib/worldQuest1';
import type { SelCheckIn, SelZone } from '../../types';
import SelTeamReport from './SelTeamReport';
import { SEL_ZONES } from '../../lib/selZones';

// Clinical-grade log of every Zones of Regulation check-in
// (docs/ZONES_OF_REGULATION_CHECKIN.md §6) — a dedicated page rather than a
// row tacked onto the quiz-score-shaped ScoreHistory table, since this data
// (zone, emotion, note, tools, Neighbor re-check outcome) has no numeric
// score and reads better in its own plain-language layout, especially for
// the OT/SLP/psychologist/psychiatrist audience this spec calls out by name.
export default function SelCheckInLog() {
  const students = useStore((s) => s.students);
  const selCheckIns = useStore((s) => s.selCheckIns);
  const [studentFilter, setStudentFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [printing, setPrinting] = useState<SelCheckIn[] | null>(null);
  // Build Queue 268: the team report, built from a student, a date range and the zones to show.
  const [repStudent, setRepStudent] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [zones, setZones] = useState<SelZone[]>([...SEL_ZONES]);
  const [report, setReport] = useState(false);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const quick = (days: number | 'month' | 'all') => {
    const now = new Date();
    if (days === 'all') { setFrom(''); setTo(''); return; }
    if (days === 'month') { setFrom(iso(new Date(now.getFullYear(), now.getMonth(), 1))); setTo(iso(now)); return; }
    const f = new Date(now); f.setDate(f.getDate() - (days - 1)); setFrom(iso(f)); setTo(iso(now));
  };
  const inRange = (c: SelCheckIn) => {
    const t = new Date(c.timestamp);
    if (from && t < new Date(`${from}T00:00`)) return false;
    if (to && t > new Date(`${to}T23:59:59.999`)) return false;
    return zones.includes(c.zone);
  };
  const reportRows = selCheckIns.filter((c) => c.studentId === repStudent && inRange(c));

  const nameFor = (id: string) => students.find((st) => st.id === id)?.name ?? 'Unknown';
  const neighborNameFor = (id?: string) => QUEST1_NEIGHBORS.find((n) => n.id === id)?.name ?? '—';

  const rows = useMemo(
    () =>
      selCheckIns
        .filter((c) => studentFilter === 'all' || c.studentId === studentFilter)
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)),
    [selCheckIns, studentFilter],
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (report && repStudent) {
    return <SelTeamReport studentName={nameFor(repStudent)} rows={reportRows} from={from} to={to} zones={zones} onClose={() => setReport(false)} />;
  }
  if (printing) {
    return (
      <div className="sel-print-area">
        <div className="sel-print-toolbar">
          <button className="btn" onClick={() => window.print()}>🖨️ Print / Save as PDF</button>
          <button className="btn" onClick={() => setPrinting(null)}>✕ Close</button>
        </div>
        {printing.map((c) => (
          <div key={c.id} className="sel-print-record">
            <h2>{nameFor(c.studentId)} — Zones of Regulation Check-In</h2>
            <p><strong>Date/time:</strong> {new Date(c.timestamp).toLocaleString()}</p>
            <p><strong>Zone:</strong> {SEL_ZONE_LABELS[c.zone]}</p>
            <p><strong>Feeling word:</strong> {c.emotion}</p>
            {c.energy && <p><strong>Energy level:</strong> {c.energy}</p>}
            <p><strong>Tools used:</strong> {c.toolsUsedLabels.length > 0 ? c.toolsUsedLabels.join(', ') : 'None recorded'}</p>
            <p><strong>Note to teacher:</strong> {c.noteText ?? 'None'}</p>
            {c.recheckDueAt && (
              <>
                <h3>Neighbor Re-Check</h3>
                <p><strong>Neighbor:</strong> {neighborNameFor(c.neighborId)}</p>
                <p><strong>Scheduled delay:</strong> {c.recheckDelayMin ?? '—'} minutes</p>
                <p><strong>Completed:</strong> {c.recheckCompleted ? 'Yes' : 'Not yet'}</p>
                {c.recheckCompleted && c.recheckZone && (
                  <>
                    <p><strong>Re-check time:</strong> {c.recheckTimestamp ? new Date(c.recheckTimestamp).toLocaleString() : '—'}</p>
                    <p><strong>Re-check zone:</strong> {SEL_ZONE_LABELS[c.recheckZone]} ({c.recheckEmotion})</p>
                    <p><strong>Tool used at re-check:</strong> {c.recheckToolUsedLabel ?? 'None recorded'}</p>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🌈 Zones of Regulation Check-Ins</h1>
        <p style={{ opacity: 0.75, marginTop: -8 }}>
          Every zone/emotion check-in, including any automatic Neighbor re-check that followed it. Select records below to print or export as PDF.
        </p>

        <div className="content-well stack selr-builder" style={{ gap: 10 }}>
          <h2 style={{ margin: 0 }}>📈 Team report (PDF)</h2>
          <p style={{ margin: 0, opacity: 0.8 }}>Line graphs on top, then the zone, time of day, energy, feeling and tool counts, every note word for word, and one row per check-in with every field. For the student's therapists, SLP, OT and BCBA.</p>
          <div className="row-wrap" style={{ gap: 10, alignItems: 'flex-end' }}>
            <label className="stack" style={{ gap: 4 }}>Student
              <select value={repStudent} onChange={(e) => setRepStudent(e.target.value)}>
                <option value="">Pick a student</option>
                {students.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </label>
            <label className="stack" style={{ gap: 4 }}>From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="stack" style={{ gap: 4 }}>To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            <div className="row-wrap" style={{ gap: 6 }}>
              <button type="button" className="btn btn-sm" onClick={() => quick(7)}>Last 7 days</button>
              <button type="button" className="btn btn-sm" onClick={() => quick(30)}>Last 30 days</button>
              <button type="button" className="btn btn-sm" onClick={() => quick('month')}>This month</button>
              <button type="button" className="btn btn-sm" onClick={() => quick('all')}>All dates</button>
            </div>
          </div>
          <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
            <b>Zones:</b>
            {SEL_ZONES.map((z) => (
              <label key={z} className="row-wrap" style={{ gap: 4, alignItems: 'center' }}>
                <input type="checkbox" checked={zones.includes(z)} onChange={(e) => setZones(e.target.checked ? [...zones, z] : zones.filter((x) => x !== z))} /> {SEL_ZONE_LABELS[z]}
              </label>
            ))}
          </div>
          <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
            <button type="button" className="btn btn-primary" disabled={!repStudent || !zones.length} onClick={() => setReport(true)} style={{ minHeight: 44 }}>📈 Make the report</button>
            {repStudent && <span style={{ opacity: 0.8 }}>{reportRows.length} check-in{reportRows.length === 1 ? '' : 's'} match</span>}
          </div>
        </div>

        <div className="row-wrap" style={{ alignItems: 'center' }}>
          <select value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
            <option value="all">All students</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>{st.name}</option>
            ))}
          </select>
          <button className="btn btn-sm" disabled={selectedIds.length === 0} onClick={() => setPrinting(rows.filter((r) => selectedIds.includes(r.id)))}>
            🖨️ Print selected ({selectedIds.length})
          </button>
        </div>

        {rows.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No check-ins recorded yet.</p>
        ) : (
          <div className="score-list">
            {rows.map((c) => (
              <div key={c.id} className="score-row">
                <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleSelect(c.id)} style={{ width: 20, height: 20 }} />
                <span className="score-avatar"><StylePortrait studentId={c.studentId} size={40} /></span>
                <div className="score-body">
                  <div className="score-title">
                    {nameFor(c.studentId)}: {SEL_ZONE_FACE[c.zone]} {SEL_ZONE_LABELS[c.zone]} — {c.emotion}{c.energy ? `, ${c.energy} energy` : ''}
                  </div>
                  <div className="score-meta">
                    {new Date(c.timestamp).toLocaleString()}
                    {c.noteText ? ' · ✏️ note attached' : ''}
                    {c.recheckDueAt ? (c.recheckCompleted ? ` · re-check done (${c.recheckZone ? SEL_ZONE_LABELS[c.recheckZone] : '—'})` : ' · re-check pending') : ''}
                  </div>
                </div>
                <button className="btn btn-sm" onClick={() => setPrinting([c])}>🖨️ View / Print</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
