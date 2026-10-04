import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { formatMoney } from '../lib/money';
import { todayISO } from '../lib/dates';
import {
  freezePriceCents, streakGoal, buyFreeze, clearFreezeNotice, dayAfter, finishChests, freezeDay, freezesOf,
  markCardShown, openNextChest, reconcileStreak, restoreStreak, useStreak, weekView, type StreakRow,
} from '../lib/streak';
import GameDashboard from './GameDashboard';
import { NATIVE_GAME_CARDS, QUIZ_MODE_CARD } from '../lib/nativeGames';
import ReadAloud from './ReadAloud';

// Everything the student sees of the Daily Streak, mounted once for the
// whole app (teacher spec 2026-10-04, see src/lib/streak.ts):
// - the daily streak card on the first visit of the day, then the game grid
// - the 🔥 meter pill that follows them on every screen (drag it anywhere;
//   double tap the fire to shrink it to just the fire and again to open it)
// - the streak view (tap the pill, or 🔥 Streak in Town Square's menu)
// - the treasure chests when a day is saved, opened one at a time.

export const OPEN_STREAK_EVENT = 'open-streak-view';
export const openStreakView = () => window.dispatchEvent(new Event(OPEN_STREAK_EVENT));

const HIDE_ON = ['/', '/student/login'];
const POS_KEY = 'streak-pill-pos';
const MIN_KEY = 'streak-pill-min';
const HINT_KEY = 'streak-pill-hint-seen';

function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function store(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* private mode */ }
}

function Flame({ count, big }: { count: number; big?: boolean }) {
  return (
    <span className={`streak-flame${big ? ' big' : ''}`} aria-hidden="true">
      <span className="streak-flame-fire">🔥</span>
      <span className="streak-flame-num">{count}</span>
    </span>
  );
}

function Week({ r }: { r: StreakRow }) {
  return (
    <div className="streak-week" aria-label="This week">
      {weekView(r).map((d) => (
        <span key={d.day} className={`streak-day ${d.state}`} title={d.day}>
          <span className="streak-day-dot">{d.state === 'saved' ? '🔥' : d.state === 'frozen' ? '🧊' : ''}</span>
          <span className="streak-day-label">{d.label}</span>
        </span>
      ))}
    </div>
  );
}

function StreakView({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const r = useStreak(studentId);
  const coins = useStore((s) => s.students.find((st) => st.id === studentId)?.coins ?? 0);
  const [msg, setMsg] = useState<string | null>(null);
  const today = todayISO();
  const correct = r.today?.day === today ? r.today.correct : 0;
  const saved = r.lastSavedDay === today;
  const upcoming = [1, 2, 3].map((n) => { let d = today; for (let i = 0; i < n; i++) d = dayAfter(d); return d; });
  const frozen = new Set(r.frozenDays ?? []);
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="My streak" onClick={onClose} style={{ zIndex: 320 }}>
      <div className="overlay-panel chrome-frame streak-view" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="streak-x" onClick={onClose} aria-label="Close">✕</button>
        <Flame count={r.count ?? 0} big />
        <h2>{r.count ?? 0} day streak</h2>
        <p className="streak-sub">Best ever: {r.best ?? 0} day{(r.best ?? 0) === 1 ? '' : 's'}</p>
        <Week r={r} />
        <div className="streak-progress">
          <div className="streak-bar"><span style={{ width: `${Math.min(100, (correct / streakGoal()) * 100)}%` }} /></div>
          <strong>{saved ? '✅ Today is saved!' : `${Math.min(correct, streakGoal())} of ${streakGoal()} right answers today`}</strong>
        </div>
        {r.lost && r.lost.day === today && (
          <div className="streak-box warn">
            <strong>Oh no! Your {r.lost.count} day streak ended.</strong>
            {freezesOf(r) > 0
              ? <button className="btn btn-lg btn-primary" onClick={() => { if (restoreStreak(studentId)) setMsg('🧊 Phew! Your streak is back.'); }}>🧊 Use a freeze to get it back</button>
              : <span>Buy a Streak Freeze below, then come back here to get it back.</span>}
          </div>
        )}
        <div className="streak-box">
          <strong>🧊 Streak Freezes: {freezesOf(r)}</strong>
          <span>A freeze keeps your streak safe on a day you can't play. If you miss a day, one is used for you.</span>
          <button className="btn btn-lg" disabled={coins < freezePriceCents()} onClick={() => setMsg(buyFreeze(studentId) ? '🧊 You bought a Streak Freeze!' : "You don't have enough money yet.")}>
            Buy a freeze for {formatMoney(freezePriceCents())}
          </button>
          <span>Going to miss a day? Freeze it ahead of time:</span>
          <div className="row-wrap" style={{ gap: 8 }}>
            {upcoming.map((d) => (
              <button key={d} className={`btn${frozen.has(d) ? ' btn-primary' : ''}`} style={{ minHeight: 48 }} disabled={frozen.has(d) || freezesOf(r) <= 0} onClick={() => { if (freezeDay(studentId, d)) setMsg('🧊 That day is frozen. Your streak is safe!'); }}>
                {frozen.has(d) ? '🧊 ' : ''}{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}
              </button>
            ))}
          </div>
        </div>
        {msg && <p className="streak-msg" role="status">{msg}</p>}
        <button className="btn btn-lg btn-primary" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}

function Chests({ studentId, r }: { studentId: string; r: StreakRow }) {
  const c = r.chestsPending!;
  const [opening, setOpening] = useState<number | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const total = c.amounts.reduce((a, b) => a + b, 0);
  const allOpen = c.opened >= c.amounts.length;
  const tap = (i: number) => {
    if (i !== c.opened || opening !== null) return;
    setOpening(i);
    timer.current = window.setTimeout(() => { openNextChest(studentId); setOpening(null); }, 650);
  };
  return (
    <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Streak treasure chests" style={{ zIndex: 330 }}>
      <div className="overlay-panel chrome-frame streak-chests">
        <Flame count={c.day} big />
        <h2>Day {c.day} streak saved!</h2>
        <p className="streak-sub">{allOpen ? `You won ${formatMoney(total)}!` : c.amounts.length === 1 ? 'Tap the treasure chest to open it!' : 'Tap each treasure chest to open it, one at a time!'}</p>
        <div className="chest-row">
          {c.amounts.map((amt, i) => {
            const open = i < c.opened;
            const next = i === c.opened && !allOpen;
            return (
              <button
                key={i}
                type="button"
                className={`chest${open ? ' open' : ''}${next ? ' next' : ''}${opening === i ? ' opening' : ''}`}
                onClick={() => tap(i)}
                disabled={!next}
                aria-label={open ? `Chest ${i + 1}: ${formatMoney(amt)}` : next ? `Open chest ${i + 1}` : `Chest ${i + 1}, locked`}
              >
                <span className="chest-lid" />
                <span className="chest-base"><span className="chest-lock" /></span>
                {open && <span className="chest-prize">{formatMoney(amt)}</span>}
              </button>
            );
          })}
        </div>
        {allOpen && <button className="btn btn-lg btn-primary" onClick={() => finishChests(studentId)}>Collect {formatMoney(total)}</button>}
      </div>
    </div>
  );
}

function DailyCard({ studentId, r, onDone }: { studentId: string; r: StreakRow; onDone: () => void }) {
  const navigate = useNavigate();
  const [grid, setGrid] = useState(false);
  const count = r.count ?? 0;
  const text = r.lost && r.lost.day === todayISO()
    ? `Your ${r.lost.count} day streak ended, but you can start a new one today! (Or use a freeze in your streak view to get it back.)`
    : count === 0 ? 'Start your streak today!' : `You have a ${count} day streak!`;
  const froze = r.noticeFroze ?? 0;
  if (grid) {
    return (
      <GameDashboard
        title="Pick a game!"
        subtitle={`Every right answer counts toward your ${streakGoal()} for today.`}
        games={[...NATIVE_GAME_CARDS, QUIZ_MODE_CARD]}
        onClose={onDone}
        onPick={(g) => { onDone(); navigate(g.route, { state: { from: 'town' } }); }}
      />
    );
  }
  return (
    <div className="streak-card-screen" role="dialog" aria-modal="true" aria-label="Daily streak">
      <div className="streak-card">
        <Flame count={count} big />
        <h1>{count} day streak</h1>
        <p className="streak-card-text">{text}</p>
        {froze > 0 && <p className="streak-card-note">🧊 A Streak Freeze saved your streak while you were away!</p>}
        <Week r={r} />
        <p className="streak-card-goal">To keep your streak, answer <strong>{streakGoal()} questions</strong> right today.</p>
        <ReadAloud text={`${count} day streak. ${text} To keep your streak, answer ${streakGoal()} questions right today.`} small />
        <button className="btn btn-lg btn-primary streak-go" onClick={() => { markCardShown(studentId); if (froze) clearFreezeNotice(studentId); setGrid(true); }}>I got this! 💪</button>
      </div>
    </div>
  );
}

function Meter({ r, onOpen }: { r: StreakRow; onOpen: () => void }) {
  const today = todayISO();
  const correct = r.today?.day === today ? r.today.correct : 0;
  const saved = r.lastSavedDay === today;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => load(POS_KEY, null));
  const [min, setMin] = useState<boolean>(() => load(MIN_KEY, false));
  const [hint, setHint] = useState<boolean>(() => !load(HINT_KEY, false));
  const drag = useRef<{ dx: number; dy: number; moved: boolean; startX: number; startY: number } | null>(null);
  const lastFireTap = useRef(0);
  const el = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (hint) { const t = window.setTimeout(() => { setHint(false); store(HINT_KEY, true); }, 7000); return () => window.clearTimeout(t); } }, [hint]);
  const clamp = (x: number, y: number) => {
    const w = el.current?.offsetWidth ?? 200;
    const h = el.current?.offsetHeight ?? 50;
    return { x: Math.max(4, Math.min(window.innerWidth - w - 4, x)), y: Math.max(4, Math.min(window.innerHeight - h - 4, y)) };
  };
  const down = (e: React.PointerEvent) => {
    const rect = el.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top, moved: false, startX: e.clientX, startY: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 6) d.moved = true;
    if (d.moved) setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  };
  const up = (e: React.PointerEvent, onFire: boolean) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.moved) { store(POS_KEY, clamp(e.clientX - d.dx, e.clientY - d.dy)); return; }
    if (onFire) {
      const now = performance.now();
      if (now - lastFireTap.current < 450) { lastFireTap.current = 0; setMin((m) => { store(MIN_KEY, !m); return !m; }); setHint(false); store(HINT_KEY, true); return; }
      lastFireTap.current = now;
      return;
    }
    onOpen();
  };
  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y } : { left: '50%', top: 8, transform: 'translateX(-50%)' };
  return (
    <div ref={el} className={`streak-pill${min ? ' min' : ''}${saved ? ' saved' : ''}`} style={style} onPointerMove={move}>
      <button
        type="button"
        className="streak-pill-fire"
        aria-label={min ? 'Daily streak. Double tap to open the meter' : 'Daily streak. Double tap to shrink the meter'}
        onPointerDown={down}
        onPointerUp={(e) => up(e, true)}
      >
        🔥<span className="streak-pill-count">{r.count ?? 0}</span>
      </button>
      {!min && (
        <button type="button" className="streak-pill-body" onPointerDown={down} onPointerUp={(e) => up(e, false)} aria-label={saved ? 'Today is saved. Open my streak' : `${correct} of ${streakGoal()} right answers today. Open my streak`}>
          <span className="streak-pill-bar"><span style={{ width: `${Math.min(100, (correct / streakGoal()) * 100)}%` }} /></span>
          <span className="streak-pill-text">{saved ? '✅ Saved!' : `${Math.min(correct, streakGoal())}/${streakGoal()}`}</span>
        </button>
      )}
      {hint && !min && <span className="streak-pill-hint">Drag me anywhere. Double tap the 🔥 to shrink me.</span>}
    </div>
  );
}

export default function StreakLayer() {
  const role = useStore((s) => s.role);
  const studentId = useStore((s) => s.currentStudentId);
  const location = useLocation();
  const r = useStreak(role === 'student' ? studentId : null);
  const [view, setView] = useState(false);
  const [cardDone, setCardDone] = useState(false);
  const reconciled = useRef<string | null>(null);
  // Once per student per day: walk missed days (freezes, broken streaks).
  useEffect(() => {
    if (role !== 'student' || !studentId) return;
    const key = `${studentId}:${todayISO()}`;
    if (reconciled.current === key) return;
    reconciled.current = key;
    reconcileStreak(studentId);
  }, [role, studentId]);
  useEffect(() => {
    const open = () => setView(true);
    window.addEventListener(OPEN_STREAK_EVENT, open);
    return () => window.removeEventListener(OPEN_STREAK_EVENT, open);
  }, []);
  useEffect(() => { setCardDone(false); }, [studentId]);
  if (role !== 'student' || !studentId || HIDE_ON.includes(location.pathname)) return null;
  const cardDue = r.cardShownDay !== todayISO() && !cardDone && location.pathname === '/world/town';
  return (
    <>
      {cardDue ? <DailyCard studentId={studentId} r={r} onDone={() => setCardDone(true)} /> : <Meter r={r} onOpen={() => setView(true)} />}
      {view && <StreakView studentId={studentId} onClose={() => setView(false)} />}
      {r.chestsPending && <Chests studentId={studentId} r={r} />}
    </>
  );
}

// True while today's streak card hasn't been shown yet, so Town Square
// holds its own pop-ups (arrival card, What's New, Daily Spin, Bawk) until
// the student has seen it.
export function useStreakCardDue(): boolean {
  const role = useStore((s) => s.role);
  const studentId = useStore((s) => s.currentStudentId);
  const r = useStreak(role === 'student' ? studentId : null);
  return role === 'student' && !!studentId && r.cardShownDay !== todayISO();
}
