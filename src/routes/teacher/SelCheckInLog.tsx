import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { StylePortrait } from '../../style/StylePortrait';
import { SEL_ZONE_LABELS, SEL_ZONE_FACE } from '../../lib/selZones';
import { QUEST1_NEIGHBORS } from '../../lib/worldQuest1';
import type { SelCheckIn } from '../../types';

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
                    {nameFor(c.studentId)}: {SEL_ZONE_FACE[c.zone]} {SEL_ZONE_LABELS[c.zone]} — {c.emotion}
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
