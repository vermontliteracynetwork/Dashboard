import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { SEL_ZONES, SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../../lib/selZones';
import { splitSelEmotion } from '../../lib/feelingsWheel';
import { diaryOwner, textOfHtml } from '../../lib/diaryBook';
import { isLocked, useDiaryLock } from '../../lib/diaryLock';
import { DiaryPrint, diaryEntriesOf } from '../../components/DiaryTeacherTools';
import type { SelCheckIn, SelZone } from '../../types';

// The Service Provider View (Build Queue 625, her words: "we are going to make another view like student and teacher
// that would be a really simplistic dashboard for other service providers (SLP, OT, therapists) to pull reports and
// data from the students. specifically, reports on their feelings and the diary component. we need the charts to be
// simple, very wide space layout with clear buttons and cards. no emojis or em dashes. make it clear that this is for
// service providers, everything should be able to pull to a pdf for download and print").
// Read only. Behind the same sign in as the Teacher Area. Every card has its own Download PDF button, and the whole
// report prints as one PDF. Charts are plain bars with the number written beside every bar, so nothing is color only.

type Range = { from: string; to: string };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const count = <T,>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  list.forEach((x) => { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const ENERGY_ORDER = ['very high', 'high', 'just right', 'low', 'very low'];

function Bars({ rows, color, total, unit = 'check-ins' }: { rows: [string, number][]; color: (k: string) => string; total: number; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="pv-empty">Nothing recorded in these dates.</p>;
  return (
    <div className="pv-bars" role="table" aria-label="Counts">
      {rows.map(([k, n]) => (
        <div key={k} className="pv-bar-row" role="row" title={`${k}: ${n} ${unit} (${Math.round((n / Math.max(1, total)) * 100)}%)`}>
          <span className="pv-bar-label" role="cell">{k}</span>
          <span className="pv-bar-track" role="cell"><span className="pv-bar-fill" style={{ width: `${(n / max) * 100}%`, background: color(k) }} /></span>
          <span className="pv-bar-num" role="cell">{n} <small>({Math.round((n / Math.max(1, total)) * 100)}%)</small></span>
        </div>
      ))}
    </div>
  );
}

export default function ProviderView() {
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const selCheckIns = useStore((s) => s.selCheckIns);
  const styleLooks = useStore((s) => s.styleLooks);
  const [sid, setSid] = useState('');
  const [range, setRange] = useState<Range>(() => { const f = new Date(); f.setDate(f.getDate() - 29); return { from: iso(f), to: iso(new Date()) }; });
  const [printOnly, setPrintOnly] = useState<string | null>(null);
  const [diaryPdf, setDiaryPdf] = useState(false);
  const lock = useDiaryLock(sid);

  // Print one card (or "all"): mark it, print, then clear the mark.
  useEffect(() => {
    if (!printOnly) return;
    const done = () => setPrintOnly(null);
    window.addEventListener('afterprint', done);
    const t = window.setTimeout(() => window.print(), 50);
    return () => { window.clearTimeout(t); window.removeEventListener('afterprint', done); };
  }, [printOnly]);

  const quick = (k: 7 | 30 | 'month' | 'all') => {
    const now = new Date();
    if (k === 'all') { setRange({ from: '', to: '' }); return; }
    if (k === 'month') { setRange({ from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }); return; }
    const f = new Date(now); f.setDate(f.getDate() - (k - 1)); setRange({ from: iso(f), to: iso(now) });
  };
  const inRange = (t: string) => (!range.from || t >= `${range.from}T00:00`) && (!range.to || new Date(t) <= new Date(`${range.to}T23:59:59.999`));

  const student = students.find((s) => s.id === sid);
  const rows: SelCheckIn[] = useMemo(() => selCheckIns.filter((c) => c.studentId === sid && inRange(c.timestamp)).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selCheckIns, sid, range]);
  const pages = sid ? diaryEntriesOf(styleLooks.find((r) => r.ownerId === diaryOwner(sid))?.look).filter(([, e]) => inRange(e.at)) : [];

  if (diaryPdf && student) return <DiaryPrint studentId={sid} studentName={student.name} from={range.from} to={range.to} title={`${student.name}: Diary pages`} note="Prepared for service providers." onClose={() => setDiaryPdf(false)} />;

  const topBar = (
    <header className="pv-top">
      <div>
        <h1>Service Provider View</h1>
        <p>Read only reports for speech language pathologists, occupational therapists, therapists and counselors. Everything here can be downloaded as a PDF or printed.</p>
      </div>
      <div className="pv-top-btns">
        {sid && <button type="button" className="pv-btn" onClick={() => setSid('')}>All students</button>}
        <button type="button" className="pv-btn" onClick={() => navigate('/')}>Sign out of this view</button>
      </div>
    </header>
  );

  if (!student) {
    return (
      <div className="pv">
        {topBar}
        <section className="pv-card">
          <h2>Pick a student</h2>
          <p className="pv-sub">Choose a student to see their feelings check-ins and Diary pages.</p>
          <div className="pv-students">
            {students.map((s) => {
              const mine = selCheckIns.filter((c) => c.studentId === s.id);
              const last = mine.reduce((a, c) => (c.timestamp > a ? c.timestamp : a), '');
              const nPages = diaryEntriesOf(styleLooks.find((r) => r.ownerId === diaryOwner(s.id))?.look).length;
              return (
                <button key={s.id} type="button" className="pv-student" onClick={() => setSid(s.id)}>
                  <span className="pv-initial" aria-hidden>{s.name.trim().charAt(0).toUpperCase()}</span>
                  <b>{s.name}</b>
                  <small>{mine.length} check-ins, {nPages} Diary pages</small>
                  <small>{last ? `Last check-in ${fmt(last)}` : 'No check-ins yet'}</small>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  const n = rows.length;
  const days = new Set(rows.map((c) => c.timestamp.slice(0, 10))).size;
  const feelings = count(rows, (c) => splitSelEmotion(c.emotion).emotion);
  const zones = SEL_ZONES.map((z) => [SEL_ZONE_LABELS[z], rows.filter((c) => c.zone === z).length] as [string, number]);
  const zoneColor = (label: string) => SEL_ZONE_COLORS[(SEL_ZONES.find((z) => SEL_ZONE_LABELS[z] === label) ?? 'green') as SelZone];
  const energy = ENERGY_ORDER.map((e) => [e.charAt(0).toUpperCase() + e.slice(1), rows.filter((c) => (c.energy ?? splitSelEmotion(c.emotion).energy) === e).length] as [string, number]).filter((r) => r[1] > 0);
  const tools = count(rows.flatMap((c) => [...c.toolsUsedLabels, ...(c.recheckToolUsedLabel ? [c.recheckToolUsedLabel] : [])]), (t) => t);
  const notes = rows.filter((c) => c.noteText?.trim());
  const topZone = [...zones].sort((a, b) => b[1] - a[1])[0];
  const rangeText = range.from || range.to ? `${range.from ? fmt(`${range.from}T12:00`) : 'the start'} to ${range.to ? fmt(`${range.to}T12:00`) : 'today'}` : 'All dates';
  // Check-ins per day, split by zone (most recent 31 days that have check-ins).
  const byDay = [...new Set(rows.map((c) => c.timestamp.slice(0, 10)))].slice(-31).map((d) => ({ d, z: SEL_ZONES.map((z) => rows.filter((c) => c.timestamp.slice(0, 10) === d && c.zone === z).length) }));
  const dayMax = Math.max(1, ...byDay.map((x) => x.z.reduce((a, b) => a + b, 0)));

  const card = (id: string, title: string, body: React.ReactNode, wide = false) => (
    <section className={`pv-card${wide ? ' wide' : ''}${printOnly && printOnly !== 'all' && printOnly !== id ? ' pv-noprint' : ''}`}>
      <div className="pv-card-head">
        <h2>{title}</h2>
        <button type="button" className="pv-btn pv-small" onClick={() => setPrintOnly(id)}>Download PDF</button>
      </div>
      <p className="pv-print-only">{student.name}. {rangeText}.</p>
      {body}
    </section>
  );

  return (
    <div className="pv">
      {topBar}
      <section className="pv-card pv-controls">
        <div className="pv-who">
          <span className="pv-initial big" aria-hidden>{student.name.trim().charAt(0).toUpperCase()}</span>
          <div><h2>{student.name}</h2><p className="pv-sub">{rangeText}</p></div>
        </div>
        <div className="pv-range">
          <button type="button" className="pv-btn" onClick={() => quick(7)}>Last 7 days</button>
          <button type="button" className="pv-btn" onClick={() => quick(30)}>Last 30 days</button>
          <button type="button" className="pv-btn" onClick={() => quick('month')}>This month</button>
          <button type="button" className="pv-btn" onClick={() => quick('all')}>All dates</button>
          <label>From <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>To <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
        </div>
        <button type="button" className="pv-btn pv-primary" onClick={() => setPrintOnly('all')}>Download the full report (PDF)</button>
      </section>
      <p className="pv-print-only pv-print-title">Service Provider Report: {student.name}, {rangeText}. Printed {fmt(new Date())}.</p>

      <div className="pv-grid">
        {card('overview', 'Overview', (
          <div className="pv-stats">
            <div><b>{n}</b><span>Feelings check-ins</span></div>
            <div><b>{days}</b><span>Days with a check-in</span></div>
            <div><b>{feelings[0]?.[0] ?? 'None'}</b><span>Most common feeling</span></div>
            <div><b>{topZone && topZone[1] ? topZone[0] : 'None'}</b><span>Most common zone</span></div>
            <div><b>{pages.length}</b><span>Diary pages</span></div>
          </div>
        ), true)}
        {card('zones', 'Zones of Regulation', <Bars rows={zones} color={zoneColor} total={n} />)}
        {card('feelings', 'Feeling words chosen', <Bars rows={feelings.slice(0, 12)} color={() => '#6d4bd3'} total={n} />)}
        {card('days', 'Check-ins by day', byDay.length ? (
          <div>
            <div className="pv-cols" role="img" aria-label={`Check-ins on ${byDay.length} days`}>
              {byDay.map(({ d, z }) => (
                <div key={d} className="pv-col" title={`${fmt(`${d}T12:00`)}: ${SEL_ZONES.map((zz, i) => `${SEL_ZONE_LABELS[zz]} ${z[i]}`).join(', ')}`}>
                  <span className="pv-col-stack">
                    {SEL_ZONES.map((zz, i) => z[i] ? <i key={zz} style={{ height: `${(z[i] / dayMax) * 100}%`, background: SEL_ZONE_COLORS[zz] }} /> : null)}
                  </span>
                  <small>{new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</small>
                </div>
              ))}
            </div>
            <div className="pv-legend">{SEL_ZONES.map((z) => <span key={z}><i style={{ background: SEL_ZONE_COLORS[z] }} />{SEL_ZONE_LABELS[z]} zone</span>)}</div>
          </div>
        ) : <p className="pv-empty">No check-ins in these dates.</p>, true)}
        {card('energy', 'Energy level', <Bars rows={energy} color={() => '#2f8f8a'} total={n} />)}
        {card('tools', 'Calming tools used', <Bars rows={tools.slice(0, 12)} color={() => '#b26a1f'} total={tools.reduce((a, t) => a + t[1], 0)} unit="times" />)}
        {card('notes', 'Notes the student wrote', notes.length ? (
          <table className="pv-table">
            <thead><tr><th>Date and time</th><th>Zone</th><th>Feeling</th><th>Note</th></tr></thead>
            <tbody>{notes.map((c) => <tr key={c.id}><td>{new Date(c.timestamp).toLocaleString()}</td><td>{SEL_ZONE_LABELS[c.zone]}</td><td>{splitSelEmotion(c.emotion).emotion}</td><td>{c.noteText}</td></tr>)}</tbody>
          </table>
        ) : <p className="pv-empty">No notes in these dates.</p>, true)}
        {card('checkins', 'Every check-in', n ? (
          <table className="pv-table">
            <thead><tr><th>Date and time</th><th>Zone</th><th>Feeling</th><th>Energy</th><th>Tools used</th><th>Re-check</th></tr></thead>
            <tbody>{rows.map((c) => <tr key={c.id}><td>{new Date(c.timestamp).toLocaleString()}</td><td>{SEL_ZONE_LABELS[c.zone]}</td><td>{splitSelEmotion(c.emotion).emotion}</td><td>{c.energy ?? splitSelEmotion(c.emotion).energy ?? ''}</td><td>{c.toolsUsedLabels.join(', ')}</td><td>{c.recheckCompleted && c.recheckZone ? `${SEL_ZONE_LABELS[c.recheckZone]} (${c.recheckEmotion ?? ''})` : c.recheckDueAt ? 'Not done' : ''}</td></tr>)}</tbody>
          </table>
        ) : <p className="pv-empty">No check-ins in these dates.</p>, true)}
        {card('diary', 'Diary pages', (
          <div>
            <div className="pv-row-btns"><button type="button" className="pv-btn pv-primary" disabled={!pages.length} onClick={() => setDiaryPdf(true)}>Download the Diary pages with pictures (PDF)</button></div>
            {pages.length ? (
              <table className="pv-table">
                <thead><tr><th>Date</th><th>Feeling</th><th>Locked by student</th><th>Words on the page</th></tr></thead>
                <tbody>{[...pages].reverse().map(([id, e]) => <tr key={id}><td>{fmt(e.at)}</td><td>{e.feeling ?? ''}</td><td>{isLocked(lock, id) ? 'Yes' : 'No'}</td><td>{textOfHtml(e.page?.html) || e.caption || ''}</td></tr>)}</tbody>
              </table>
            ) : <p className="pv-empty">No Diary pages in these dates.</p>}
          </div>
        ), true)}
      </div>
    </div>
  );
}
