import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import { dayOf, useQuestionLog, type QLogEntry } from '../../lib/questionLog';

// Question reports (teacher 2026-10-14: "ensure full reports can be pulled by game (all questions
// prompted to student in a game, their answers, time take to complete, attempts on same questions), and
// also by day (showing a comprehensive report of all questions answered within a day)"). Built from the
// question log every game writes (src/lib/questionLog.ts). By game: each question asked in that game,
// how many times it came up, every answer tapped, first-try rate and time. By day: every question that
// day in order, per student, with totals. Print and CSV on both.
type E = QLogEntry & { studentId: string };
const secs = (ms: number) => (ms < 60000 ? `${Math.max(1, Math.round(ms / 1000))}s` : `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`);
const OUT: Record<E['outcome'], string> = { right: '✅ Right', skipped: '⏭️ Skipped', left: '🚪 Left' };
const firstTry = (e: E) => e.outcome === 'right' && e.tries.length === 1;
const longDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

function Totals({ list }: { list: E[] }) {
  const right = list.filter((e) => e.outcome === 'right').length;
  const ft = list.filter(firstTry).length;
  const time = list.reduce((a, e) => a + e.ms, 0);
  return (
    <div className="qr-totals">
      <span><b>{list.length}</b> questions</span>
      <span><b>{right}</b> answered right</span>
      <span><b>{list.length ? Math.round((ft / list.length) * 100) : 0}%</b> right on the first try</span>
      <span><b>{list.reduce((a, e) => a + e.tries.length, 0)}</b> answers tapped</span>
      <span><b>{secs(time)}</b> total time</span>
      <span><b>{list.length ? secs(time / list.length) : '-'}</b> per question</span>
    </div>
  );
}
const Tries = ({ e }: { e: E }) => <>{e.tries.length ? e.tries.map((t, i) => <span key={i} className={`qr-try ${t === e.answer ? 'ok' : 'no'}`}>{t === e.answer ? '✓' : '✗'} {t}</span>) : <span className="qr-try none">no answer</span>}</>;

export default function QuestionReports() {
  const students = useStore((s) => s.students);
  const all = useQuestionLog();
  const nameFor = (id: string) => students.find((s) => s.id === id)?.name ?? 'Unknown';
  const [view, setView] = useState<'game' | 'day'>('game');
  const [who, setWho] = useState('all');
  const days = useMemo(() => [...new Set(all.map((e) => dayOf(e.at)))].sort().reverse(), [all]);
  const games = useMemo(() => [...new Set(all.map((e) => e.game))].sort(), [all]);
  const [day, setDay] = useState('');
  const [game, setGame] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const dayPick = day || days[0] || '';
  const gamePick = game || games[0] || '';
  const mine = all.filter((e) => who === 'all' || e.studentId === who);
  const inRange = (e: E) => (!from || dayOf(e.at) >= from) && (!to || dayOf(e.at) <= to);
  const list = view === 'day' ? mine.filter((e) => dayOf(e.at) === dayPick) : mine.filter((e) => e.game === gamePick && inRange(e));
  const people = [...new Set(list.map((e) => e.studentId))];

  const csv = () => {
    const q = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const head = ['Date', 'Time', 'Student', 'Game', 'Question', 'Right answer', 'Answers tapped (in order)', 'Number of tries', 'Right on first try', 'Outcome', 'Seconds'];
    const rows = list.map((e) => [dayOf(e.at), new Date(e.at).toLocaleTimeString(), nameFor(e.studentId), e.game, e.prompt, e.answer, e.tries.join(' | '), e.tries.length, firstTry(e) ? 'Yes' : 'No', e.outcome, Math.round(e.ms / 1000)].map(q).join(','));
    const blob = new Blob([[head.map(q).join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = view === 'day' ? `questions-${dayPick}.csv` : `questions-${gamePick.replace(/\W+/g, '-').toLowerCase()}.csv`; a.click();
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack qr">
        <h1>📝 Question reports</h1>
        <p style={{ margin: 0, opacity: 0.75 }}>Every question students see in every game: their answers in order, how many tries, and how long each took. Logging started October 14, 2026.</p>
        <div className="qr-controls">
          <div className="az-log-tabs big" role="tablist">
            <button type="button" role="tab" aria-selected={view === 'game'} className={view === 'game' ? 'on' : ''} onClick={() => setView('game')}>🎮 By game</button>
            <button type="button" role="tab" aria-selected={view === 'day'} className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>📅 By day</button>
          </div>
          <label>Student <select id="qr-who" value={who} onChange={(e) => setWho(e.target.value)}><option value="all">Every student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          {view === 'game' ? (
            <>
              <label>Game <select id="qr-game" value={gamePick} onChange={(e) => setGame(e.target.value)}>{games.length ? games.map((g) => <option key={g} value={g}>{g}</option>) : <option value="">No games yet</option>}</select></label>
              <label>From <input id="qr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>To <input id="qr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </>
          ) : (
            <label>Day <select id="qr-day" value={dayPick} onChange={(e) => setDay(e.target.value)}>{days.length ? days.map((d) => <option key={d} value={d}>{longDay(d)}</option>) : <option value="">No days yet</option>}</select></label>
          )}
          <span style={{ flex: 1 }} />
          <button type="button" className="btn" onClick={csv} disabled={!list.length}>⬇️ Download CSV</button>
          <button type="button" className="btn" onClick={() => window.print()} disabled={!list.length}>🖨️ Print</button>
        </div>

        {!list.length && <p style={{ opacity: 0.7 }}>No questions here yet. They show up as soon as a student answers questions in a game.</p>}

        {list.length > 0 && view === 'game' && people.map((sid) => {
          const mineHere = list.filter((e) => e.studentId === sid);
          // Questions grouped, so repeated questions show every attempt together.
          const byQ = new Map<string, E[]>();
          for (const e of mineHere) byQ.set(e.prompt, [...(byQ.get(e.prompt) ?? []), e]);
          const sessions = [...new Set(mineHere.map((e) => dayOf(e.at)))].length;
          return (
            <section key={sid} className="qr-block">
              <h2>{nameFor(sid)} · {gamePick} <small>{sessions} {sessions === 1 ? 'day' : 'days'} played</small></h2>
              <Totals list={mineHere} />
              <div className="az-log-scroll">
                <table className="az-log-table qr-table">
                  <thead><tr><th>Question</th><th>Right answer</th><th>Times asked</th><th>Every attempt (answers tapped in order)</th><th>First try</th><th>Time</th></tr></thead>
                  <tbody>
                    {[...byQ.entries()].map(([prompt, es]) => (
                      <tr key={prompt} className={es.some(firstTry) ? '' : 'urgent'}>
                        <td className="said">{prompt}</td>
                        <td>{es[0].answer}</td>
                        <td>{es.length}</td>
                        <td className="det">{es.map((e, i) => <div key={i} className="qr-attempt"><small>{new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} {new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {OUT[e.outcome]}</small> <Tries e={e} /></div>)}</td>
                        <td>{es.filter(firstTry).length} of {es.length}</td>
                        <td>{secs(es.reduce((a, e) => a + e.ms, 0) / es.length)} avg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        {list.length > 0 && view === 'day' && (
          <>
            <h2 style={{ margin: 0 }}>{longDay(dayPick)}</h2>
            <Totals list={list} />
            {people.map((sid) => {
              const es = list.filter((e) => e.studentId === sid);
              const gamesToday = [...new Set(es.map((e) => e.game))];
              return (
                <section key={sid} className="qr-block">
                  <h2>{nameFor(sid)} <small>{gamesToday.join(', ')}</small></h2>
                  <Totals list={es} />
                  <div className="az-log-scroll">
                    <table className="az-log-table qr-table">
                      <thead><tr><th>Time</th><th>Game</th><th>Question</th><th>Right answer</th><th>Answers tapped (in order)</th><th>Tries</th><th>Result</th><th>Time taken</th></tr></thead>
                      <tbody>
                        {es.map((e, i) => (
                          <tr key={i} className={firstTry(e) ? '' : e.outcome === 'right' ? '' : 'urgent'}>
                            <td>{new Date(e.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</td>
                            <td>{e.game}</td>
                            <td className="said">{e.prompt}</td>
                            <td>{e.answer}</td>
                            <td className="det"><Tries e={e} /></td>
                            <td>{e.tries.length}</td>
                            <td>{OUT[e.outcome]}{firstTry(e) ? ' (first try)' : ''}</td>
                            <td>{secs(e.ms)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
