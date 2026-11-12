import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { SEL_ZONES, SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../../lib/selZones';
import { splitSelEmotion } from '../../lib/feelingsWheel';
import { diaryOwner, textOfHtml, type DiaryEntry } from '../../lib/diaryBook';
import { isLocked, useDiaryLock } from '../../lib/diaryLock';
import { DiaryPrint, diaryEntriesOf } from '../../components/DiaryTeacherTools';
import DiaryPage from '../../components/DiaryPage';
import type { QLogEntry } from '../../lib/questionLog';
import type { SelCheckIn, SelZone } from '../../types';

// The Service Provider View (Build Queue 625, her words: "we are going to make another view like student and teacher
// that would be a really simplistic dashboard for other service providers (SLP, OT, therapists) to pull reports and
// data from the students. specifically, reports on their feelings and the diary component. we need the charts to be
// simple, very wide space layout with clear buttons and cards. no emojis or em dashes. make it clear that this is for
// service providers, everything should be able to pull to a pdf for download and print").
// Build Queue 635 (her words: "make sure pdf reports are not just what is shown, but also tables of the full
// comprehensive logs with dates, timestamp, answer, etc. so they can use the pdfs in report righting and for data
// analysis. remove azalea from service provider view entirely. the overveiw pdf should be a long, all data point, full
// view of all reports that can be pulled for that student. allow time/date ranges to filter what they are selecting in
// the pdf preview mode"): every Download PDF opens a PDF preview where the provider picks the dates and the sections;
// each section prints its chart AND its full log table (date, time and every field), every table can also be saved as
// a spreadsheet (CSV), and the Overview PDF holds every section. Azalea (the students' talk-it-out cat) never appears:
// her lines are taken out of the notes and she is left out of the tools.
// Read only. Behind the same sign in as the Teacher Area.

type Range = { from: string; to: string };
type SectionId = 'summary' | 'zones' | 'feelings' | 'days' | 'energy' | 'tools' | 'notes' | 'checkins' | 'questions' | 'diary' | 'diarypics';
const SECTIONS: { id: SectionId; name: string }[] = [
  { id: 'summary', name: 'Overview' },
  { id: 'zones', name: 'Zones of Regulation' },
  { id: 'feelings', name: 'Feeling words chosen' },
  { id: 'days', name: 'Check-ins by day' },
  { id: 'energy', name: 'Energy level' },
  { id: 'tools', name: 'Calming tools used' },
  { id: 'notes', name: 'Notes the student wrote' },
  { id: 'checkins', name: 'Every check-in (full log)' },
  { id: 'questions', name: 'Questions answered (full log)' },
  { id: 'diary', name: 'Diary pages (log)' },
  { id: 'diarypics', name: 'Diary pages with pictures' },
];
const ALL_IDS = SECTIONS.map((s) => s.id);

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (d: string | Date) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const dateOf = (t: string) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
const timeOf = (t: string) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const count = <T,>(list: T[], key: (x: T) => string) => {
  const m = new Map<string, number>();
  list.forEach((x) => { const k = key(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const ENERGY_ORDER = ['very high', 'high', 'just right', 'low', 'very low'];
const pct = (n: number, d: number) => `${Math.round((n / Math.max(1, d)) * 100)}%`;

// Azalea is never shown here: notes keep only the student's own words, and her name never appears as a tool.
const AZ = /azalea/i;
const studentWords = (note?: string): { words: string; safety: boolean } => {
  if (!note) return { words: '', safety: false };
  const safety = /Safety words/i.test(note);
  const lines = note.split('\n').filter((l) => l.trim() && !/^\W*Safety words/i.test(l) && !/^Talked with Azalea:?$/i.test(l.trim()) && !/^Azalea:/i.test(l.trim()));
  return { words: lines.map((l) => l.replace(/^[^:]{1,40}:\s*/, '')).join(' / ').trim(), safety };
};
const toolsOf = (c: SelCheckIn) => c.toolsUsedLabels.filter((t) => !AZ.test(t));
const energyOf = (c: SelCheckIn) => c.energy ?? splitSelEmotion(c.emotion).energy ?? '';
const feelOf = (c: SelCheckIn) => splitSelEmotion(c.emotion).emotion;

function saveCsv(name: string, head: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = [head, ...rows].map((r) => r.map(esc).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `${name.replace(/[^\w -]/g, '').replace(/\s+/g, '-')}.csv`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function Bars({ rows, color, total, unit = 'check-ins' }: { rows: [string, number][]; color: (k: string) => string; total: number; unit?: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  if (!rows.length) return <p className="pv-empty">Nothing recorded in these dates.</p>;
  return (
    <div className="pv-bars" role="table" aria-label="Counts">
      {rows.map(([k, n]) => (
        <div key={k} className="pv-bar-row" role="row" title={`${k}: ${n} ${unit} (${pct(n, total)})`}>
          <span className="pv-bar-label" role="cell">{k}</span>
          <span className="pv-bar-track" role="cell"><span className="pv-bar-fill" style={{ width: `${(n / max) * 100}%`, background: color(k) }} /></span>
          <span className="pv-bar-num" role="cell">{n} <small>({pct(n, total)})</small></span>
        </div>
      ))}
    </div>
  );
}

// A full log table with its own spreadsheet button (the button never prints).
function LogTable({ title, head, rows, file, empty = 'Nothing recorded in these dates.' }: { title?: string; head: string[]; rows: (string | number)[][]; file: string; empty?: string }) {
  return (
    <div className="pv-log">
      <div className="pv-log-head">
        {title && <h3>{title}</h3>}
        <span className="pv-log-n">{rows.length} row{rows.length === 1 ? '' : 's'}</span>
        <button type="button" className="pv-btn pv-small" disabled={!rows.length} onClick={() => saveCsv(file, head, rows)} title="Save this table for Excel, Google Sheets or other data tools">Save as spreadsheet (CSV)</button>
      </div>
      {rows.length ? (
        <table className="pv-table">
          <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}</tbody>
        </table>
      ) : <p className="pv-empty">{empty}</p>}
    </div>
  );
}

function RangePicker({ range, setRange }: { range: Range; setRange: (r: Range) => void }) {
  const quick = (k: 7 | 30 | 90 | 'month' | 'all') => {
    const now = new Date();
    if (k === 'all') { setRange({ from: '', to: '' }); return; }
    if (k === 'month') { setRange({ from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }); return; }
    const f = new Date(now); f.setDate(f.getDate() - (k - 1)); setRange({ from: iso(f), to: iso(now) });
  };
  return (
    <div className="pv-range">
      <button type="button" className="pv-btn" onClick={() => quick(7)}>Last 7 days</button>
      <button type="button" className="pv-btn" onClick={() => quick(30)}>Last 30 days</button>
      <button type="button" className="pv-btn" onClick={() => quick(90)}>Last 90 days</button>
      <button type="button" className="pv-btn" onClick={() => quick('month')}>This month</button>
      <button type="button" className="pv-btn" onClick={() => quick('all')}>All dates</button>
      <label>From <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
      <label>To <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
    </div>
  );
}

// Build Queue 636 (her words: "add a password to the provider view "care" in all lowercase"). Asked once per browser
// tab; exactly "care", lower case.
const PROVIDER_PASSWORD = 'care';
const PASS_KEY = 'provider-view-ok';

function ProviderGate({ onOk }: { onOk: () => void }) {
  const navigate = useNavigate();
  const [pw, setPw] = useState('');
  const [bad, setBad] = useState(false);
  const go = () => {
    if (pw === PROVIDER_PASSWORD) { try { sessionStorage.setItem(PASS_KEY, '1'); } catch { /* fine */ } onOk(); return; }
    setBad(true); setPw('');
  };
  return (
    <div className="pv pv-gate">
      <form className="pv-card pv-gate-card" onSubmit={(e) => { e.preventDefault(); go(); }}>
        <h1>Service Provider View</h1>
        <p className="pv-sub">For speech language pathologists, occupational therapists, therapists and counselors. Type the password to see student reports.</p>
        <label className="pv-gate-label">Password
          <input type="password" autoFocus autoComplete="off" value={pw} onChange={(e) => { setPw(e.target.value); setBad(false); }} aria-invalid={bad} />
        </label>
        {bad && <p className="pv-gate-bad" role="alert">That password is not right. Try again.</p>}
        <div className="pv-row-btns" style={{ display: 'flex', gap: 10 }}>
          <button type="submit" className="pv-btn pv-primary" disabled={!pw}>Open reports</button>
          <button type="button" className="pv-btn" onClick={() => navigate('/')}>Back</button>
        </div>
      </form>
    </div>
  );
}

export default function ProviderView() {
  const [ok, setOk] = useState(() => { try { return sessionStorage.getItem(PASS_KEY) === '1'; } catch { return false; } });
  return ok ? <ProviderReports onLock={() => { try { sessionStorage.removeItem(PASS_KEY); } catch { /* fine */ } setOk(false); }} /> : <ProviderGate onOk={() => setOk(true)} />;
}

function ProviderReports({ onLock }: { onLock: () => void }) {
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const selCheckIns = useStore((s) => s.selCheckIns);
  const styleLooks = useStore((s) => s.styleLooks);
  const [sid, setSid] = useState('');
  const [range, setRange] = useState<Range>(() => { const f = new Date(); f.setDate(f.getDate() - 29); return { from: iso(f), to: iso(new Date()) }; });
  const [preview, setPreview] = useState<SectionId[] | null>(null);
  const [diaryPdf, setDiaryPdf] = useState(false);
  const lock = useDiaryLock(sid);

  useEffect(() => { window.scrollTo(0, 0); }, [preview]);

  const inRange = (t: string) => (!range.from || t >= `${range.from}T00:00`) && (!range.to || new Date(t) <= new Date(`${range.to}T23:59:59.999`));
  const student = students.find((s) => s.id === sid);
  const rows: SelCheckIn[] = useMemo(() => selCheckIns.filter((c) => c.studentId === sid && inRange(c.timestamp)).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selCheckIns, sid, range]);
  const pages: [string, DiaryEntry][] = sid ? diaryEntriesOf(styleLooks.find((r) => r.ownerId === diaryOwner(sid))?.look).filter(([, e]) => inRange(e.at)) : [];
  const questions: QLogEntry[] = useMemo(() => !sid ? [] : styleLooks
    .filter((r) => r.ownerId.startsWith(`qlog:${sid}:`))
    .flatMap((r) => ((r.look as { items?: QLogEntry[] } | undefined)?.items ?? []))
    .filter((q) => q?.at && inRange(q.at))
    .sort((a, b) => (a.at < b.at ? -1 : 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styleLooks, sid, range]);

  if (diaryPdf && student) return <DiaryPrint studentId={sid} studentName={student.name} from={range.from} to={range.to} title={`${student.name}: Diary pages`} note="Prepared for service providers." onClose={() => setDiaryPdf(false)} />;

  const topBar = (
    <header className="pv-top">
      <div>
        <h1>Service Provider View</h1>
        <p>Read only reports for speech language pathologists, occupational therapists, therapists and counselors. Everything here can be downloaded as a PDF or printed, and every log can be saved as a spreadsheet.</p>
      </div>
      <div className="pv-top-btns">
        {sid && <button type="button" className="pv-btn" onClick={() => { setSid(''); setPreview(null); }}>All students</button>}
        <button type="button" className="pv-btn" onClick={() => { onLock(); navigate('/'); }}>Sign out of this view</button>
      </div>
    </header>
  );

  if (!student) {
    return (
      <div className="pv">
        {topBar}
        <section className="pv-card">
          <h2>Pick a student</h2>
          <p className="pv-sub">Choose a student to see their feelings check-ins, Diary pages and answered questions.</p>
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

  // ---------- everything computed once, for the dashboard and the PDF ----------
  const n = rows.length;
  const days = new Set(rows.map((c) => c.timestamp.slice(0, 10))).size;
  const feelings = count(rows, feelOf);
  const zones = SEL_ZONES.map((z) => [SEL_ZONE_LABELS[z], rows.filter((c) => c.zone === z).length] as [string, number]);
  const zoneColor = (label: string) => SEL_ZONE_COLORS[(SEL_ZONES.find((z) => SEL_ZONE_LABELS[z] === label) ?? 'green') as SelZone];
  const energy = ENERGY_ORDER.map((e) => [e.charAt(0).toUpperCase() + e.slice(1), rows.filter((c) => energyOf(c) === e).length] as [string, number]).filter((r) => r[1] > 0);
  const toolUses = rows.flatMap((c) => [
    ...toolsOf(c).map((t) => ({ c, t, when: 'Check-in' })),
    ...(c.recheckToolUsedLabel && !AZ.test(c.recheckToolUsedLabel) ? [{ c, t: c.recheckToolUsedLabel, when: 'Re-check' }] : []),
  ]);
  const tools = count(toolUses, (u) => u.t);
  const notes = rows.map((c) => ({ c, ...studentWords(c.noteText) })).filter((x) => x.words || x.safety);
  const topZone = [...zones].sort((a, b) => b[1] - a[1])[0];
  const rangeText = range.from || range.to ? `${range.from ? fmt(`${range.from}T12:00`) : 'the start'} to ${range.to ? fmt(`${range.to}T12:00`) : 'today'}` : 'All dates';
  const dayList = [...new Set(rows.map((c) => c.timestamp.slice(0, 10)))];
  const byDay = dayList.map((d) => ({ d, z: SEL_ZONES.map((z) => rows.filter((c) => c.timestamp.slice(0, 10) === d && c.zone === z).length) }));
  const shownDays = byDay.slice(-31);
  const dayMax = Math.max(1, ...shownDays.map((x) => x.z.reduce((a, b) => a + b, 0)));
  const rechecks = rows.filter((c) => c.recheckDueAt);
  const rechecksDone = rechecks.filter((c) => c.recheckCompleted);
  const qRight = questions.filter((q) => q.outcome === 'right').length;
  const firstTry = questions.filter((q) => q.outcome === 'right' && q.tries.length <= 1).length;
  const byGame = count(questions, (q) => q.game);
  const file = (what: string) => `${student.name} ${what} ${range.from || 'start'} to ${range.to || 'today'}`;

  const chartDays = shownDays.length ? (
    <div>
      <div className="pv-cols" role="img" aria-label={`Check-ins on ${shownDays.length} days`}>
        {shownDays.map(({ d, z }) => (
          <div key={d} className="pv-col" title={`${fmt(`${d}T12:00`)}: ${SEL_ZONES.map((zz, i) => `${SEL_ZONE_LABELS[zz]} ${z[i]}`).join(', ')}`}>
            <span className="pv-col-stack">
              {SEL_ZONES.map((zz, i) => z[i] ? <i key={zz} style={{ height: `${(z[i] / dayMax) * 100}%`, background: SEL_ZONE_COLORS[zz] }} /> : null)}
            </span>
            <small>{new Date(`${d}T12:00`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</small>
          </div>
        ))}
      </div>
      <div className="pv-legend">{SEL_ZONES.map((z) => <span key={z}><i style={{ background: SEL_ZONE_COLORS[z] }} />{SEL_ZONE_LABELS[z]} zone</span>)}</div>
      {byDay.length > shownDays.length && <p className="pv-sub">The chart shows the last 31 days with check-ins; the table has every day.</p>}
    </div>
  ) : <p className="pv-empty">No check-ins in these dates.</p>;

  const stats = (
    <div className="pv-stats">
      <div><b>{n}</b><span>Feelings check-ins</span></div>
      <div><b>{days}</b><span>Days with a check-in</span></div>
      <div><b>{feelings[0]?.[0] ?? 'None'}</b><span>Most common feeling</span></div>
      <div><b>{topZone && topZone[1] ? topZone[0] : 'None'}</b><span>Most common zone</span></div>
      <div><b>{rechecks.length ? `${rechecksDone.length} of ${rechecks.length}` : 'None'}</b><span>Re-checks finished</span></div>
      <div><b>{pages.length}</b><span>Diary pages</span></div>
      <div><b>{questions.length}</b><span>Questions answered</span></div>
      <div><b>{questions.length ? pct(qRight, questions.length) : 'None'}</b><span>Questions right</span></div>
    </div>
  );

  // Each section: what shows on screen, and (in the PDF preview) its full log tables too.
  const body = (id: SectionId, full: boolean): React.ReactNode => {
    switch (id) {
      case 'summary': return <>{stats}{full && (
        <LogTable title="Summary numbers" file={file('summary')} head={['Measure', 'Value']} rows={[
          ['Student', student.name], ['Dates', rangeText], ['Feelings check-ins', n], ['Days with a check-in', days],
          ...zones.map(([z, k]) => [`${z} zone check-ins`, `${k} (${pct(k, n)})`] as [string, string]),
          ['Most common feeling', feelings[0] ? `${feelings[0][0]} (${feelings[0][1]})` : 'None'],
          ['Re-checks scheduled', rechecks.length], ['Re-checks finished', rechecksDone.length],
          ['Re-checks that ended in the Green zone', rechecksDone.filter((c) => c.recheckZone === 'green').length],
          ['Notes the student wrote', notes.length], ['Safety word flags', notes.filter((x) => x.safety).length],
          ['Calming tools used (times)', toolUses.length], ['Diary pages', pages.length], ['Diary pages the student locked', pages.filter(([pid]) => isLocked(lock, pid)).length],
          ['Questions answered', questions.length], ['Questions right', `${qRight} (${pct(qRight, questions.length)})`], ['Right on the first try', `${firstTry} (${pct(firstTry, questions.length)})`],
          ['Questions skipped', questions.filter((q) => q.outcome === 'skipped').length], ['Questions left unanswered', questions.filter((q) => q.outcome === 'left').length],
          ['Average seconds per question', questions.length ? Math.round(questions.reduce((a, q) => a + q.ms, 0) / questions.length / 100) / 10 : 'None'],
        ]} />
      )}</>;
      case 'zones': return <><Bars rows={zones} color={zoneColor} total={n} />{full && (
        <LogTable title="Zone log" file={file('zones')} head={['Date', 'Time', 'Zone', 'Feeling', 'Energy']} rows={rows.map((c) => [dateOf(c.timestamp), timeOf(c.timestamp), SEL_ZONE_LABELS[c.zone], feelOf(c), energyOf(c)])} />
      )}</>;
      case 'feelings': return <><Bars rows={feelings.slice(0, full ? 999 : 12)} color={() => '#6d4bd3'} total={n} />{full && (
        <LogTable title="Feeling words, with first and last time chosen" file={file('feelings')} head={['Feeling', 'Times', 'Percent', 'Zones', 'First time', 'Last time']} rows={feelings.map(([f, k]) => {
          const list = rows.filter((c) => feelOf(c) === f);
          return [f, k, pct(k, n), [...new Set(list.map((c) => SEL_ZONE_LABELS[c.zone]))].join(', '), `${dateOf(list[0].timestamp)} ${timeOf(list[0].timestamp)}`, `${dateOf(list[list.length - 1].timestamp)} ${timeOf(list[list.length - 1].timestamp)}`];
        })} />
      )}</>;
      case 'days': return <>{chartDays}{full && (
        <LogTable title="Every day" file={file('by-day')} head={['Date', 'Check-ins', 'Blue', 'Green', 'Yellow', 'Red', 'Feelings chosen']} rows={byDay.map(({ d, z }) => [
          dateOf(`${d}T12:00`), z.reduce((a, b) => a + b, 0), ...z, rows.filter((c) => c.timestamp.slice(0, 10) === d).map(feelOf).join(', '),
        ])} />
      )}</>;
      case 'energy': return <><Bars rows={energy} color={() => '#2f8f8a'} total={n} />{full && (
        <LogTable title="Energy log" file={file('energy')} head={['Date', 'Time', 'Energy', 'Zone', 'Feeling']} rows={rows.filter((c) => energyOf(c)).map((c) => [dateOf(c.timestamp), timeOf(c.timestamp), energyOf(c), SEL_ZONE_LABELS[c.zone], feelOf(c)])} />
      )}</>;
      case 'tools': return <><Bars rows={tools.slice(0, full ? 999 : 12)} color={() => '#b26a1f'} total={toolUses.length} unit="times" />{full && (
        <LogTable title="Tool log" file={file('tools')} head={['Date', 'Time', 'Tool', 'Used at', 'Zone', 'Feeling']} rows={toolUses.map((u) => [dateOf(u.c.timestamp), timeOf(u.c.timestamp), u.t, u.when, SEL_ZONE_LABELS[u.c.zone], feelOf(u.c)])} />
      )}</>;
      case 'notes': return (
        <LogTable file={file('notes')} head={['Date', 'Time', 'Zone', 'Feeling', 'Student\'s words', 'Safety words flagged']} empty="No notes in these dates."
          rows={notes.map((x) => [dateOf(x.c.timestamp), timeOf(x.c.timestamp), SEL_ZONE_LABELS[x.c.zone], feelOf(x.c), x.words, x.safety ? 'Yes' : 'No'])} />
      );
      case 'checkins': return (
        <LogTable file={file('check-ins')} empty="No check-ins in these dates."
          head={['Date', 'Time', 'Zone', 'Feeling', 'Energy', 'Tools used', 'Student\'s words', 'Re-check due', 'Re-check done', 'Re-check time', 'Re-check zone', 'Re-check feeling', 'Re-check tool', 'Minutes to re-check']}
          rows={rows.map((c) => [
            dateOf(c.timestamp), timeOf(c.timestamp), SEL_ZONE_LABELS[c.zone], feelOf(c), energyOf(c), toolsOf(c).join(', '), studentWords(c.noteText).words,
            c.recheckDueAt ? `${dateOf(c.recheckDueAt)} ${timeOf(c.recheckDueAt)}` : '', c.recheckDueAt ? (c.recheckCompleted ? 'Yes' : 'No') : '',
            c.recheckTimestamp ? `${dateOf(c.recheckTimestamp)} ${timeOf(c.recheckTimestamp)}` : '', c.recheckZone ? SEL_ZONE_LABELS[c.recheckZone] : '', c.recheckEmotion ?? '',
            c.recheckToolUsedLabel && !AZ.test(c.recheckToolUsedLabel) ? c.recheckToolUsedLabel : '',
            c.recheckTimestamp ? Math.round((+new Date(c.recheckTimestamp) - +new Date(c.timestamp)) / 60000) : '',
          ])} />
      );
      case 'questions': return <>
        <Bars rows={byGame.slice(0, full ? 999 : 10)} color={() => '#3f6fb5'} total={questions.length} unit="questions" />
        {full && <>
          <LogTable title="By game" file={file('questions-by-game')} head={['Game', 'Questions', 'Right', 'Right on first try', 'Skipped', 'Left', 'Average seconds']} rows={byGame.map(([gm, k]) => {
            const list = questions.filter((q) => q.game === gm);
            return [gm, k, list.filter((q) => q.outcome === 'right').length, list.filter((q) => q.outcome === 'right' && q.tries.length <= 1).length, list.filter((q) => q.outcome === 'skipped').length, list.filter((q) => q.outcome === 'left').length, Math.round(list.reduce((a, q) => a + q.ms, 0) / list.length / 100) / 10];
          })} />
          <LogTable title="Every question" file={file('questions')} head={['Date', 'Time', 'Game', 'Question', 'Right answer', 'Student\'s answers in order', 'Tries', 'Result', 'Seconds']}
            rows={questions.map((q) => [dateOf(q.at), timeOf(q.at), q.game, q.prompt, q.answer, q.tries.join(' | '), q.tries.length, q.outcome === 'right' ? 'Right' : q.outcome === 'skipped' ? 'Skipped' : 'Left without answering', Math.round(q.ms / 100) / 10])} />
        </>}
      </>;
      case 'diary': return (
        <>
          {!full && <div className="pv-row-btns"><button type="button" className="pv-btn pv-primary" disabled={!pages.length} onClick={() => setDiaryPdf(true)}>Download the Diary pages with pictures (PDF)</button></div>}
          <LogTable file={file('diary')} head={['Date', 'Time', 'Feeling', 'Locked by student', 'Words on the page']} empty="No Diary pages in these dates."
            rows={pages.map(([pid, e]) => [dateOf(e.at), timeOf(e.at), e.feeling ?? '', isLocked(lock, pid) ? 'Yes' : 'No', textOfHtml(e.page?.html) || e.caption || ''])} />
        </>
      );
      case 'diarypics': return pages.length ? (
        <div className="pv-pics">
          {pages.map(([pid, e]) => (
            <div key={pid} className="pv-pic">
              <p><b>{fmt(e.at)}</b>, {timeOf(e.at)}{e.feeling ? `. Feeling: ${e.feeling}` : ''}{isLocked(lock, pid) ? '. Locked by the student.' : ''}</p>
              {e.page ? <DiaryPage page={e.page} className="dprint-dp" lite studentId={sid} day={e.at.slice(0, 10)} /> : e.photo ? <img className="dprint-photo" src={e.photo} alt="" /> : null}
            </div>
          ))}
        </div>
      ) : <p className="pv-empty">No Diary pages in these dates.</p>;
    }
  };

  // ---------- the PDF preview: pick dates and sections, then print or save as PDF ----------
  if (preview) {
    const on = (id: SectionId) => preview.includes(id);
    const toggle = (id: SectionId) => setPreview(on(id) ? preview.filter((x) => x !== id) : ALL_IDS.filter((x) => x === id || preview.includes(x)));
    return (
      <div className="pv pv-preview">
        <div className="pv-preview-bar">
          <div className="pv-preview-row">
            <h2>PDF preview</h2>
            <span className="pv-sub">Pick the dates and the parts to include. What you see below is what prints.</span>
            <span className="pv-grow" />
            <button type="button" className="pv-btn" onClick={() => setPreview(null)}>Back to the dashboard</button>
            <button type="button" className="pv-btn pv-primary" disabled={!preview.length} onClick={() => window.print()}>Print or save as PDF</button>
          </div>
          <RangePicker range={range} setRange={setRange} />
          <div className="pv-checks">
            <button type="button" className="pv-btn pv-small" onClick={() => setPreview([...ALL_IDS])}>Include everything</button>
            <button type="button" className="pv-btn pv-small" onClick={() => setPreview([])}>Clear</button>
            {SECTIONS.map((s) => <label key={s.id}><input type="checkbox" checked={on(s.id)} onChange={() => toggle(s.id)} /> {s.name}</label>)}
          </div>
        </div>
        <article className="pv-doc">
          <header className="pv-doc-head">
            <h1>Service Provider Report</h1>
            <p><b>{student.name}</b>. {rangeText}. Printed {fmt(new Date())} at {timeOf(new Date().toISOString())}.</p>
            <p className="pv-sub">From the Independent Work Dashboard. Feelings come from the student's Zones of Regulation check-ins; times are the student's local time.</p>
          </header>
          {!preview.length && <p className="pv-empty">Pick at least one part above.</p>}
          {SECTIONS.filter((s) => on(s.id)).map((s) => (
            <section key={s.id} className="pv-doc-sec">
              <h2>{s.name}</h2>
              {body(s.id, true)}
            </section>
          ))}
        </article>
      </div>
    );
  }

  const card = (id: SectionId, title: string, wide = false, pdfIds: SectionId[] = [id]) => (
    <section className={`pv-card${wide ? ' wide' : ''}`}>
      <div className="pv-card-head">
        <h2>{title}</h2>
        <button type="button" className="pv-btn pv-small" onClick={() => setPreview(pdfIds)}>Download PDF</button>
      </div>
      {body(id, false)}
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
        <RangePicker range={range} setRange={setRange} />
        <button type="button" className="pv-btn pv-primary" onClick={() => setPreview([...ALL_IDS])}>Download the full report (PDF)</button>
      </section>

      <div className="pv-grid">
        {card('summary', 'Overview', true, [...ALL_IDS])}
        {card('zones', 'Zones of Regulation')}
        {card('feelings', 'Feeling words chosen')}
        {card('days', 'Check-ins by day', true)}
        {card('energy', 'Energy level')}
        {card('tools', 'Calming tools used')}
        {card('notes', 'Notes the student wrote', true)}
        {card('checkins', 'Every check-in', true)}
        {card('questions', 'Questions answered', true)}
        {card('diary', 'Diary pages', true, ['diary', 'diarypics'])}
      </div>
    </div>
  );
}
