import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { AvatarGlyph } from '../../components/AvatarGlyph';
import { sundayToSundayRange, todayISO } from '../../lib/dates';
import { ACTIVE_FOCUS_SUBJECTS } from '../../lib/focus';
import type { QuizAttemptRecord, Subject } from '../../types';
import { AssignmentsPanel } from './AssignmentsIndex';
import { ActivitiesPanel } from './ActivitiesPanel';
import { FocusesPanel } from './FocusesPanel';

// Academics: the teacher's one place for Focuses, Assignments, Activities
// and Reports. Redesigned from the teacher's own UI references (Boddle
// and Prodigy teacher dashboards): a slim left sidebar where every section
// is its own page, Math/Literacy chips that filter everything, an action
// bar, and a Dashboard of stat tiles plus a weekly activity chart. Direct
// style instruction: "clean, crisp. table format. very professional
// layout that is card-based and easy to navigate with lots of spacing and
// adequate text sizing. doesnt need to match regular kid-facing site" —
// so this page is scoped under .acad with its own quieter look instead of
// the student-facing chunky style.
//
// Section, subject filter, and the create pop-up all live in the URL
// (?view=, ?subject=, ?create=1) so old links, the browser back button,
// and a refresh all land in the same place.

type Section = 'dashboard' | 'focuses' | 'assignments' | 'activities' | 'reports';
type SubjectFilter = Subject | 'all';

const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" /> },
  { key: 'focuses', label: 'Focuses', icon: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.8" /></> },
  { key: 'assignments', label: 'Assignments', icon: <><path d="M7 4h10v16H7z" /><path d="M10 9h4M10 13h4M10 17h2" /></> },
  { key: 'activities', label: 'Activities', icon: <><path d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5z" /><path d="M16 13v6M13 16h6" /></> },
  { key: 'reports', label: 'Reports', icon: <path d="M4 20h16M7 16v-5M12 16V7M17 16v-8" /> },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SUBJECT_LABEL: Record<Subject, string> = { math: 'Math', literacy: 'Literacy' };

function localISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// This week, Sunday through Saturday — the same week a default focus covers.
function currentWeekDays(): string[] {
  const { start } = sundayToSundayRange(todayISO());
  const d = new Date(`${start}T00:00:00`);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return localISO(x);
  });
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

function attemptsThisWeek(quizAttempts: QuizAttemptRecord[], days: string[], filter: SubjectFilter) {
  const set = new Set(days);
  return quizAttempts.filter((a) => set.has(localISO(new Date(a.completedAt))) && (filter === 'all' || a.subject === filter));
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Dashboard

type Metric = 'questions' | 'tasks';

function WeeklyChart({ series, days }: { series: { key: Subject; values: number[] }[]; days: string[] }) {
  const W = 640;
  const H = 240;
  const pad = { l: 40, r: 16, t: 16, b: 32 };
  const max = Math.max(4, ...series.flatMap((s) => s.values));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const niceMax = Math.ceil(max / step) * step;
  const x = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / 6;
  const y = (v: number) => pad.t + (1 - v / niceMax) * (H - pad.t - pad.b);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(niceMax * f));
  const today = todayISO();
  const summary = series
    .map((s) => `${SUBJECT_LABEL[s.key]}: ${s.values.map((v, i) => `${WEEKDAYS[i]} ${v}`).join(', ')}`)
    .join('. ');

  return (
    <svg className="acad-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} className="acad-chart-grid" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" className="acad-chart-label">{t}</text>
        </g>
      ))}
      {days.map((d, i) => (
        <text key={d} x={x(i)} y={H - 10} textAnchor="middle" className={`acad-chart-label${d === today ? ' is-today' : ''}`}>{WEEKDAYS[i]}</text>
      ))}
      {series.map((s) => (
        <g key={s.key} className={`acad-series acad-series-${s.key}`}>
          <polyline points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" strokeWidth="2.5" />
          {s.values.map((v, i) => (
            <circle key={i} cx={x(i)} cy={y(v)} r="4">
              <title>{`${SUBJECT_LABEL[s.key]}, ${WEEKDAYS[i]} ${shortDate(days[i])}: ${v}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  );
}

function DashboardSection({ filter }: { filter: SubjectFilter }) {
  const assignments = useStore((s) => s.assignments);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const [metric, setMetric] = useState<Metric>('questions');
  const today = todayISO();
  const days = useMemo(() => currentWeekDays(), []);
  const subjects: Subject[] = filter === 'all' ? ['math', 'literacy'] : [filter];

  const active = assignments.filter((a) => !a.deletedAt && a.startDate <= today && today <= a.endDate && (filter === 'all' || a.subject === filter));
  const activePlans = new Set(active.map((a) => `${a.templateId}:${a.subject}:${a.startDate}:${a.endDate}:${a.mode}`)).size;
  const studentsAssigned = new Set(active.map((a) => a.studentId)).size;

  const week = attemptsThisWeek(quizAttempts, days, filter);
  const answered = week.reduce((n, a) => n + a.totalCount, 0);
  const firstTry = week.reduce((n, a) => n + a.correctCount, 0);
  const pct = answered > 0 ? Math.round((firstTry / answered) * 100) : null;

  // "Tasks completed" counts quiz/drill tasks finished (one per student per
  // task per day) — the only task type the app logs with a date and a
  // subject today. Flagged under the chart rather than silently passed off
  // as every task type.
  const series = subjects.map((subj) => ({
    key: subj,
    values: days.map((d) => {
      const rows = week.filter((a) => a.subject === subj && localISO(new Date(a.completedAt)) === d);
      return metric === 'questions'
        ? rows.reduce((n, a) => n + a.totalCount, 0)
        : new Set(rows.map((a) => `${a.studentId}:${a.taskId}`)).size;
    }),
  }));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="acad-tiles">
        <div className="acad-tile">
          <span className="acad-tile-label">Active assignments</span>
          <span className="acad-tile-value">{activePlans}</span>
          <span className="acad-muted">{studentsAssigned} student{studentsAssigned === 1 ? '' : 's'} assigned today</span>
        </div>
        <div className="acad-tile">
          <span className="acad-tile-label">Questions answered this week</span>
          <span className="acad-tile-value">{answered.toLocaleString()}</span>
          <span className="acad-muted">{pct === null ? 'No answers yet this week' : `${pct}% right on the first try`}</span>
        </div>
      </div>

      <div className="acad-card">
        <div className="acad-card-head">
          <div>
            <h2 className="acad-card-title">Weekly activity</h2>
            <span className="acad-muted">{shortDate(days[0])} to {shortDate(days[6])}</span>
          </div>
          <label className="acad-select-label">
            <span className="acad-visually-hidden">Chart shows</span>
            <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
              <option value="questions">Questions answered</option>
              <option value="tasks">Tasks completed</option>
            </select>
          </label>
        </div>
        <div className="acad-card-body">
          <div className="acad-legend">
            {series.map((s) => (
              <span key={s.key}><span className={`acad-swatch acad-swatch-${s.key}`} /> {SUBJECT_LABEL[s.key]} ({s.values.reduce((a, b) => a + b, 0)})</span>
            ))}
          </div>
          <WeeklyChart series={series} days={days} />
          {metric === 'tasks' && (
            <p className="acad-muted acad-small" style={{ margin: '8px 0 0' }}>
              Counts quiz and drill tasks finished. Other task types aren't logged by day yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reports

function ReportsSection({ filter }: { filter: SubjectFilter }) {
  const students = useStore((s) => s.students);
  const quizAttempts = useStore((s) => s.quizAttempts);
  const days = useMemo(() => currentWeekDays(), []);
  const week = attemptsThisWeek(quizAttempts, days, filter);

  const rows = students.map((st) => {
    const mine = week.filter((a) => a.studentId === st.id);
    const answered = mine.reduce((n, a) => n + a.totalCount, 0);
    const correct = mine.reduce((n, a) => n + a.correctCount, 0);
    const minutes = Math.round(mine.reduce((n, a) => n + a.durationMs, 0) / 60000);
    const last = mine.reduce<string | null>((l, a) => (!l || a.completedAt > l ? a.completedAt : l), null);
    return { st, answered, pct: answered ? Math.round((correct / answered) * 100) : null, tasks: new Set(mine.map((a) => a.taskId)).size, minutes, last };
  });

  return (
    <div className="acad-card">
      <div className="acad-card-head">
        <div>
          <h2 className="acad-card-title">This week by student</h2>
          <span className="acad-muted">{shortDate(days[0])} to {shortDate(days[6])} · quiz and drill work</span>
        </div>
        <Link className="btn btn-sm" to="/teacher/scores">Full score history</Link>
      </div>
      <div className="acad-table-wrap">
        <table className="acad-table">
          <thead>
            <tr>
              <th>Student</th>
              <th className="num">Questions answered</th>
              <th className="num">Right first try</th>
              <th className="num">Tasks finished</th>
              <th className="num">Time</th>
              <th>Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ st, answered, pct, tasks, minutes, last }) => (
              <tr key={st.id}>
                <td><span className="acad-person"><AvatarGlyph value={st.avatar} size={22} /> {st.name}</span></td>
                <td className="num">{answered}</td>
                <td className="num">{pct === null ? <span className="acad-muted">None</span> : `${pct}%`}</td>
                <td className="num">{tasks}</td>
                <td className="num">{minutes} min</td>
                <td>{last ? new Date(last).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : <span className="acad-muted">None this week</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {students.length === 0 && <p className="acad-empty">No students yet.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page

export default function Academics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawView = searchParams.get('view');
  const section: Section = SECTIONS.some((s) => s.key === rawView) ? (rawView as Section) : 'dashboard';
  const rawSubject = searchParams.get('subject');
  const filter: SubjectFilter = rawSubject === 'math' || rawSubject === 'literacy' ? rawSubject : 'all';

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
    setSearchParams(next);
  };

  const title = SECTIONS.find((s) => s.key === section)!.label;

  return (
    <div className="app-shell acad-page">
      <TeacherNav />
      <div className="acad">
        <nav className="acad-side" aria-label="Academics">
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={section === s.key ? 'active' : ''}
              aria-current={section === s.key ? 'page' : undefined}
              onClick={() => go({ view: s.key, create: null })}
            >
              <Icon>{s.icon}</Icon>
              <span>{s.label}</span>
            </button>
          ))}
        </nav>

        <main className="acad-main">
          <header className="acad-top">
            <div>
              <span className="acad-eyebrow">Academics</span>
              <h1>{title}</h1>
            </div>
            <div className="acad-chips" role="group" aria-label="Subject">
              {(['all', 'math', 'literacy'] as SubjectFilter[]).map((f) => (
                <button key={f} type="button" className={filter === f ? 'active' : ''} aria-pressed={filter === f} onClick={() => go({ subject: f === 'all' ? null : f })}>
                  {f === 'all' ? 'All subjects' : SUBJECT_LABEL[f]}
                </button>
              ))}
            </div>
          </header>

          <div className="acad-actionbar">
            <button type="button" className="btn btn-primary" onClick={() => go({ view: 'assignments', create: '1' })}>+ Create assignment</button>
            <button type="button" className="btn" onClick={() => go({ view: 'focuses', create: null })}>Set focus</button>
            <button type="button" className="btn" onClick={() => go({ view: 'activities', create: null })}>Add activity</button>
          </div>

          {section === 'dashboard' && <DashboardSection filter={filter} />}
          {section === 'focuses' && <FocusesPanel subjects={filter === 'all' ? ACTIVE_FOCUS_SUBJECTS : [filter]} />}
          {section === 'assignments' && <AssignmentsPanel subjectFilter={filter} />}
          {section === 'activities' && <ActivitiesPanel subjectFilter={filter} />}
          {section === 'reports' && <ReportsSection filter={filter} />}
        </main>
      </div>
    </div>
  );
}
