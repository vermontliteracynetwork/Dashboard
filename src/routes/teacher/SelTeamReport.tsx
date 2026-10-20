import { useMemo } from 'react';
import type { SelCheckIn, SelZone } from '../../types';
import { SEL_ZONES, SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../../lib/selZones';
import { FEELING_ROOTS, type FeelingNode } from '../../lib/feelingsWheel';
import { ENERGY_STEPS } from '../../lib/supernature';
import { QUEST1_NEIGHBORS } from '../../lib/worldQuest1';

// The SEL check-in report for her student's support team (Build Queue 268, her words: "a comprehensive, PDF
// downloadable, table format and line graph report to share with my students other support staff (therapists,
// SLP, OT) ... a very specific chart with a line graph at the top of the doc. i need all fields that were selected
// to be reported. if a note was added, it needs to be included. i need filters for creating reports in date ranges
// ... all the info id need to share for a behavior plan report aba as much detail as possible", graph: "Time of
// day, Selected choice and energy level"). Claudia's layout for a behavior plan team: the line graphs first, then
// the summary counts a BCBA reads (zone frequency and percent, time of day and weekday patterns, energy, feeling
// words, tools used, how often a re-check came back regulated), every note in full, then one row per check-in
// with every field, then a team review box. It prints as its own clean page (Save as PDF from the print dialog).

const FEEL = new Map<string, FeelingNode>();
const walk = (n: FeelingNode) => { FEEL.set(n.w.toLowerCase(), n); n.kids.forEach(walk); };
FEELING_ROOTS.forEach(walk);
const feelingFamily = (w: string) => { const n = FEEL.get(w.toLowerCase()); if (!n) return ''; const p: string[] = []; for (let x: FeelingNode | null = n; x; x = x.parent) p.unshift(x.w); return p.join(' > '); };

const ENERGY_Y: Record<string, number> = Object.fromEntries(ENERGY_STEPS.map((e, i) => [e, i]));
const LEVELS = [...ENERGY_STEPS, 'not given'];
const neighborName = (id?: string) => QUEST1_NEIGHBORS.find((n) => n.id === id)?.name ?? 'A Neighbor';
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = [
  { label: 'Before 9:00', from: 0, to: 9 }, { label: '9:00 to 11:00', from: 9, to: 11 }, { label: '11:00 to 1:00', from: 11, to: 13 },
  { label: '1:00 to 3:00', from: 13, to: 15 }, { label: 'After 3:00', from: 15, to: 24 },
];
const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const fmtTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '0%');
const hourOf = (d: Date) => d.getHours() + d.getMinutes() / 60;

function Legend() {
  return (
    <div className="selr-legend">
      {SEL_ZONES.map((z) => <span key={z}><i style={{ background: SEL_ZONE_COLORS[z] }} />{SEL_ZONE_LABELS[z]} Zone</span>)}
      <span><i className="hollow" />Neighbor re-check</span>
    </div>
  );
}

// Line graph 1: every check-in in time order. Up and down is the energy level she picked; the dot color is the
// zone of the feeling word; the word is written on the dot.
function TimelineChart({ rows }: { rows: SelCheckIn[] }) {
  const W = 1000, H = 330, L = 92, R = 16, T = 26, B = 46;
  const lv = (c: SelCheckIn) => (c.energy && c.energy in ENERGY_Y ? ENERGY_Y[c.energy] : 5);
  const pts = rows.map((c) => ({ t: +new Date(c.timestamp), y: lv(c), zone: c.zone, word: c.emotion,
    re: c.recheckCompleted && c.recheckZone && c.recheckTimestamp ? { t: +new Date(c.recheckTimestamp), zone: c.recheckZone } : null })).sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  const t0 = pts[0].t, t1 = Math.max(...pts.map((p) => p.re?.t ?? p.t), t0 + 3600e3);
  const x = (t: number) => L + ((t - t0) / (t1 - t0)) * (W - L - R);
  const y = (lvl: number) => T + (lvl / (LEVELS.length - 1)) * (H - T - B);
  const days: number[] = [];
  for (let d = new Date(t0); +d <= t1; d.setDate(d.getDate() + 1)) { const s = new Date(d); s.setHours(0, 0, 0, 0); days.push(+s); }
  const step = Math.max(1, Math.ceil(days.length / 10));
  const labels = pts.length <= 45;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="selr-chart" role="img" aria-label="Line graph of energy level and zone at each check-in over time">
      {LEVELS.map((lv, i) => (
        <g key={lv}>
          <line x1={L} x2={W - R} y1={y(i)} y2={y(i)} stroke="#e6e2f0" />
          <text x={L - 8} y={y(i) + 4} textAnchor="end" fontSize="12" fill="#3b3355">{lv === 'just right' ? 'just right' : lv}</text>
        </g>
      ))}
      <text x={14} y={T + (H - T - B) / 2} fontSize="12" fill="#3b3355" transform={`rotate(-90 14 ${T + (H - T - B) / 2})`} textAnchor="middle">Energy level</text>
      {days.filter((_, i) => i % step === 0).map((d) => (
        <g key={d}>
          <line x1={x(Math.max(d, t0))} x2={x(Math.max(d, t0))} y1={T} y2={H - B} stroke="#f1eef7" />
          <text x={x(Math.max(d, t0))} y={H - B + 18} fontSize="11" textAnchor="middle" fill="#3b3355">{new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</text>
        </g>
      ))}
      <polyline fill="none" stroke="#6b5fa0" strokeWidth="2" points={pts.map((p) => `${x(p.t)},${y(p.y)}`).join(' ')} />
      {pts.map((p, i) => p.re && (
        <g key={`re${i}`}>
          <line x1={x(p.t)} y1={y(p.y)} x2={x(p.re.t)} y2={y(p.y) + 9} stroke={SEL_ZONE_COLORS[p.re.zone]} strokeDasharray="3 3" />
          <circle cx={x(p.re.t)} cy={y(p.y) + 9} r={4.5} fill="#fff" stroke={SEL_ZONE_COLORS[p.re.zone]} strokeWidth={2.5} />
        </g>
      ))}
      {pts.map((p, i) => {
        // Words alternate above and below the dot, and a word is skipped when it would sit on the one before it.
        const prev = pts[i - 1], close = prev && prev.y === p.y && x(p.t) - x(prev.t) < 34;
        return (
          <g key={i}>
            <circle cx={x(p.t)} cy={y(p.y)} r={6.5} fill={SEL_ZONE_COLORS[p.zone]} stroke="#fff" strokeWidth={1.5} />
            {labels && !close && <text x={x(p.t)} y={i % 2 ? y(p.y) + 20 : y(p.y) - 11} fontSize="10.5" textAnchor="middle" fill="#241c3d">{p.word}</text>}
          </g>
        );
      })}
      <text x={(L + W - R) / 2} y={H - 6} fontSize="12" textAnchor="middle" fill="#3b3355">Date and time of each check-in</text>
    </svg>
  );
}

// Line graph 2: time of day. One thin line per school day from morning to afternoon, so a pattern by hour shows.
function TimeOfDayChart({ rows }: { rows: SelCheckIn[] }) {
  const W = 1000, H = 300, L = 92, R = 16, T = 20, B = 46;
  if (!rows.length) return null;
  const hours = rows.map((c) => hourOf(new Date(c.timestamp)));
  const h0 = Math.min(7, Math.floor(Math.min(...hours))), h1 = Math.max(16, Math.ceil(Math.max(...hours)));
  const x = (h: number) => L + ((h - h0) / (h1 - h0)) * (W - L - R);
  const y = (lvl: number) => T + (lvl / (LEVELS.length - 1)) * (H - T - B);
  const byDay = new Map<string, SelCheckIn[]>();
  for (const c of rows) { const k = new Date(c.timestamp).toDateString(); byDay.set(k, [...(byDay.get(k) ?? []), c]); }
  const lv = (c: SelCheckIn) => (c.energy && c.energy in ENERGY_Y ? ENERGY_Y[c.energy] : 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="selr-chart" role="img" aria-label="Line graph of energy level by time of day, one line per day">
      {LEVELS.map((l, i) => (
        <g key={l}>
          <line x1={L} x2={W - R} y1={y(i)} y2={y(i)} stroke="#e6e2f0" />
          <text x={L - 8} y={y(i) + 4} textAnchor="end" fontSize="12" fill="#3b3355">{l}</text>
        </g>
      ))}
      {Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i).map((h) => (
        <g key={h}>
          <line x1={x(h)} x2={x(h)} y1={T} y2={H - B} stroke="#f1eef7" />
          <text x={x(h)} y={H - B + 18} fontSize="11" textAnchor="middle" fill="#3b3355">{`${((h + 11) % 12) + 1}:00 ${h < 12 ? 'am' : 'pm'}`}</text>
        </g>
      ))}
      {[...byDay.values()].map((list, i) => {
        const s = list.slice().sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
        return <polyline key={i} fill="none" stroke="#b9b0d8" strokeWidth="1.5" points={s.map((c) => `${x(hourOf(new Date(c.timestamp)))},${y(lv(c))}`).join(' ')} />;
      })}
      {rows.map((c) => <circle key={c.id} cx={x(hourOf(new Date(c.timestamp)))} cy={y(lv(c))} r={6} fill={SEL_ZONE_COLORS[c.zone]} stroke="#fff" strokeWidth="1.5" />)}
      <text x={(L + W - R) / 2} y={H - 6} fontSize="12" textAnchor="middle" fill="#3b3355">Time of day (each gray line is one day)</text>
    </svg>
  );
}

const countBy = <T,>(list: T[], key: (x: T) => string) => { const m = new Map<string, number>(); list.forEach((x) => { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); };

export default function SelTeamReport({ studentName, rows, from, to, zones, memories = {}, diary = [], onClose }: {
  studentName: string; rows: SelCheckIn[]; from: string; to: string; zones: SelZone[];
  // Build Queue 269: the memory of the day saved before each check-in, by check-in id.
  memories?: Record<string, { caption?: string; photo?: string }>;
  // Build Queue 290: pages from the student's Diary app in these dates.
  diary?: { caption?: string; photo?: string; at: string }[];
  onClose: () => void;
}) {
  const sorted = useMemo(() => rows.slice().sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)), [rows]);
  const n = sorted.length;
  const daysWith = new Set(sorted.map((c) => new Date(c.timestamp).toDateString())).size;
  const zoneCount = (z: SelZone, list = sorted) => list.filter((c) => c.zone === z).length;
  const rechecks = sorted.filter((c) => c.recheckDueAt);
  const doneRe = rechecks.filter((c) => c.recheckCompleted && c.recheckZone);
  const toGreen = doneRe.filter((c) => c.recheckZone === 'green').length;
  const minsToRe = doneRe.filter((c) => c.recheckTimestamp).map((c) => (+new Date(c.recheckTimestamp!) - +new Date(c.timestamp)) / 60000).sort((a, b) => a - b);
  const median = minsToRe.length ? Math.round(minsToRe[Math.floor(minsToRe.length / 2)]) : null;
  const notes = sorted.filter((c) => c.noteText?.trim());
  const mems = sorted.filter((c) => memories[c.id]?.caption || memories[c.id]?.photo);
  const tools = countBy(sorted.flatMap((c) => [...c.toolsUsedLabels, ...(c.recheckToolUsedLabel ? [c.recheckToolUsedLabel] : [])]), (t) => t);
  const feelings = countBy(sorted, (c) => c.emotion);
  const rangeText = `${from ? fmtDate(new Date(`${from}T00:00`)) : sorted[0] ? fmtDate(new Date(sorted[0].timestamp)) : ''} to ${to ? fmtDate(new Date(`${to}T00:00`)) : sorted[n - 1] ? fmtDate(new Date(sorted[n - 1].timestamp)) : ''}`;

  return (
    <div className="sel-print-area selr">
      <style>{'@page { size: letter landscape; margin: 0.45in; }'}</style>
      <div className="sel-print-toolbar">
        <button className="btn btn-primary" onClick={() => window.print()}>⬇️ Download PDF (choose Save as PDF)</button>
        <button className="btn" onClick={onClose}>✕ Close</button>
      </div>

      <header className="selr-head">
        <div>
          <h1>SEL Check-In Report: {studentName}</h1>
          <p><b>Dates:</b> {rangeText} · <b>Zones shown:</b> {zones.length === 4 ? 'all four' : zones.map((z) => SEL_ZONE_LABELS[z]).join(', ')} · <b>Made:</b> {new Date().toLocaleString()}</p>
          <p className="selr-small">Student self-report on the iPad: the Feelings Wheel (feeling word and its zone), then an energy level, then the tools the student tapped. A Neighbor re-check follows Blue, Yellow and Red check-ins. Shared with the student's support team (teacher, therapists, SLP, OT, BCBA). Confidential.</p>
        </div>
      </header>

      {n === 0 ? <p>No check-ins in these dates.</p> : (
        <>
          <section className="selr-block">
            <h2>Check-ins over time</h2>
            <Legend />
            <TimelineChart rows={sorted} />
          </section>
          <section className="selr-block">
            <h2>By time of day</h2>
            <TimeOfDayChart rows={sorted} />
          </section>

          <section className="selr-block selr-grid">
            <div>
              <h2>Summary</h2>
              <table className="selr-table">
                <tbody>
                  <tr><th>Check-ins</th><td>{n} on {daysWith} day{daysWith === 1 ? '' : 's'} ({(n / Math.max(1, daysWith)).toFixed(1)} a day)</td></tr>
                  <tr><th>In the Green Zone</th><td>{zoneCount('green')} of {n} ({pct(zoneCount('green'), n)})</td></tr>
                  <tr><th>Neighbor re-checks</th><td>{rechecks.length} scheduled, {doneRe.length} done{doneRe.length ? `, ${toGreen} came back Green (${pct(toGreen, doneRe.length)})` : ''}</td></tr>
                  <tr><th>Time to re-check</th><td>{median !== null ? `about ${median} minutes (median)` : 'none done'}</td></tr>
                  <tr><th>Notes written</th><td>{notes.length}</td></tr>
                  <tr><th>Diary pages</th><td>{diary.length}{mems.length ? ` (plus ${mems.length} memories from earlier check-ins)` : ''}</td></tr>
                  <tr><th>Energy not given</th><td>{sorted.filter((c) => !c.energy).length}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h2>Zones</h2>
              <table className="selr-table">
                <thead><tr><th>Zone</th><th>Count</th><th>Percent</th><th>Feeling words picked</th></tr></thead>
                <tbody>{SEL_ZONES.map((z) => (
                  <tr key={z}><td><i className="selr-dot" style={{ background: SEL_ZONE_COLORS[z] }} />{SEL_ZONE_LABELS[z]}</td><td>{zoneCount(z)}</td><td>{pct(zoneCount(z), n)}</td>
                    <td>{countBy(sorted.filter((c) => c.zone === z), (c) => c.emotion).map(([w, k]) => `${w} (${k})`).join(', ') || 'None'}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </section>

          <section className="selr-block selr-grid">
            <div>
              <h2>Time of day by zone</h2>
              <table className="selr-table">
                <thead><tr><th>Time</th>{SEL_ZONES.map((z) => <th key={z}>{SEL_ZONE_LABELS[z]}</th>)}<th>All</th></tr></thead>
                <tbody>{SLOTS.map((s) => { const list = sorted.filter((c) => { const h = hourOf(new Date(c.timestamp)); return h >= s.from && h < s.to; }); return (
                  <tr key={s.label}><td>{s.label}</td>{SEL_ZONES.map((z) => <td key={z}>{zoneCount(z, list) || ''}</td>)}<td>{list.length}</td></tr>
                ); })}</tbody>
              </table>
            </div>
            <div>
              <h2>Day of the week by zone</h2>
              <table className="selr-table">
                <thead><tr><th>Day</th>{SEL_ZONES.map((z) => <th key={z}>{SEL_ZONE_LABELS[z]}</th>)}<th>All</th></tr></thead>
                <tbody>{DAYS.map((d, i) => { const list = sorted.filter((c) => new Date(c.timestamp).getDay() === i); return list.length ? (
                  <tr key={d}><td>{d}</td>{SEL_ZONES.map((z) => <td key={z}>{zoneCount(z, list) || ''}</td>)}<td>{list.length}</td></tr>
                ) : null; })}</tbody>
              </table>
            </div>
          </section>

          <section className="selr-block selr-grid3">
            <div>
              <h2>Energy levels</h2>
              <table className="selr-table"><tbody>{LEVELS.map((l) => { const k = sorted.filter((c) => (c.energy ?? 'not given') === l).length; return <tr key={l}><td>{l}</td><td>{k}</td><td>{pct(k, n)}</td></tr>; })}</tbody></table>
            </div>
            <div>
              <h2>Feeling words</h2>
              <table className="selr-table"><tbody>{feelings.map(([w, k]) => <tr key={w}><td>{w}</td><td className="selr-small">{feelingFamily(w)}</td><td>{k}</td></tr>)}</tbody></table>
            </div>
            <div>
              <h2>Tools used</h2>
              <table className="selr-table"><tbody>{tools.length ? tools.map(([t, k]) => <tr key={t}><td>{t}</td><td>{k}</td></tr>) : <tr><td>No tools tapped</td></tr>}</tbody></table>
            </div>
          </section>

          {notes.length > 0 && (
            <section className="selr-block">
              <h2>Notes from the student ({notes.length})</h2>
              <table className="selr-table">
                <thead><tr><th>Date and time</th><th>Zone and feeling</th><th>Note, word for word</th></tr></thead>
                <tbody>{notes.map((c) => <tr key={c.id}><td>{fmtDate(new Date(c.timestamp))} {fmtTime(new Date(c.timestamp))}</td><td>{SEL_ZONE_LABELS[c.zone]}, {c.emotion}</td><td className="selr-note">{c.noteText}</td></tr>)}</tbody>
              </table>
            </section>
          )}

          {diary.length > 0 && (
            <section className="selr-block">
              <h2>Diary pages ({diary.length})</h2>
              <p className="selr-small">Pictures and captions the student added to the Diary app on the computer (memory recall of daily events).</p>
              <div className="selr-mems">{diary.map((d, i) => (
                <figure key={i}>
                  {d.photo ? <img src={d.photo} alt="" /> : <span className="selr-nopic">No picture</span>}
                  <figcaption><b>{fmtDate(new Date(d.at))} {fmtTime(new Date(d.at))}</b><br />"{d.caption || 'No caption'}"</figcaption>
                </figure>
              ))}</div>
            </section>
          )}

          {mems.length > 0 && (
            <section className="selr-block">
              <h2>Memories of the day ({mems.length})</h2>
              <p className="selr-small">The picture and caption the student chose just before checking in (memory recall of daily events).</p>
              <div className="selr-mems">{mems.map((c) => (
                <figure key={c.id}>
                  {memories[c.id].photo ? <img src={memories[c.id].photo} alt="" /> : <span className="selr-nopic">No picture</span>}
                  <figcaption><b>{fmtDate(new Date(c.timestamp))} {fmtTime(new Date(c.timestamp))}</b> · {SEL_ZONE_LABELS[c.zone]}, {c.emotion}<br />"{memories[c.id].caption || 'No caption'}"</figcaption>
                </figure>
              ))}</div>
            </section>
          )}

          <section className="selr-block">
            <h2>Every check-in ({n})</h2>
            <table className="selr-table selr-full">
              <thead><tr><th>#</th><th>Date</th><th>Day</th><th>Time</th><th>Zone</th><th>Feeling word (wheel path)</th><th>Energy</th><th>Memory of the day</th><th>Tools tapped</th><th>Note</th><th>Neighbor re-check</th><th>Teacher seen</th></tr></thead>
              <tbody>{sorted.map((c, i) => { const d = new Date(c.timestamp); return (
                <tr key={c.id}>
                  <td>{i + 1}</td><td>{fmtDate(d)}</td><td>{DAYS[d.getDay()].slice(0, 3)}</td><td>{fmtTime(d)}</td>
                  <td><i className="selr-dot" style={{ background: SEL_ZONE_COLORS[c.zone] }} />{SEL_ZONE_LABELS[c.zone]}</td>
                  <td>{c.emotion}{feelingFamily(c.emotion) && feelingFamily(c.emotion) !== c.emotion ? <div className="selr-small">{feelingFamily(c.emotion)}</div> : null}</td>
                  <td>{c.energy ?? 'not given'}</td>
                  <td className="selr-note">{memories[c.id]?.caption ? `"${memories[c.id].caption}"` : memories[c.id]?.photo ? 'Picture only' : 'None'}{memories[c.id]?.photo ? ' (picture above)' : ''}</td>
                  <td>{c.toolsUsedLabels.length ? c.toolsUsedLabels.join('; ') : 'None'}</td>
                  <td className="selr-note">{c.noteText?.trim() || 'None'}</td>
                  <td>{!c.recheckDueAt ? 'Not needed (Green)' : c.recheckCompleted && c.recheckZone ? `${neighborName(c.neighborId)}, ${c.recheckTimestamp ? fmtTime(new Date(c.recheckTimestamp)) : ''}: ${SEL_ZONE_LABELS[c.recheckZone]}, ${c.recheckEmotion ?? ''}${c.recheckToolUsedLabel ? `; tool: ${c.recheckToolUsedLabel}` : ''}` : `${neighborName(c.neighborId)}, set for ${c.recheckDelayMin ?? '?'} min, not done`}</td>
                  <td>{c.zone === 'red' ? 'Alert sent' : c.inboxResolved ? 'Yes' : c.zone === 'green' ? 'n/a' : 'Not yet'}</td>
                </tr>
              ); })}</tbody>
            </table>
          </section>

          <section className="selr-block selr-review">
            <h2>Team review</h2>
            <div className="selr-lines">
              <p><b>Patterns the team sees (time of day, days, triggers):</b></p><i /><i />
              <p><b>Tools that help most:</b></p><i />
              <p><b>Next steps for the behavior plan:</b></p><i /><i />
              <p><b>Reviewed by (name, role, date):</b></p><i /><i />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
