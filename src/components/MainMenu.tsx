import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { OPEN_AZALEA, OPEN_MAIN_MENU, useRegisteredMenuItems, type MenuItem } from '../lib/mainMenu';
import { openStreakView } from './StreakLayer';
import { useStreak } from '../lib/streak';
import { Icon } from './Icon';
import AfterschoolSettings from './AfterschoolSettings';

// The one main menu (Build Queue 224, 225): a single draggable button on every student screen (drag it like the
// streak meter; a tap opens it). It opens a pie menu with Town Square, the computer, My Streak, Report (Azalea),
// the Arcade and the Piggy Bank, plus whatever the current screen adds (Help, What now?, My Tools, Town Square's
// map, compass and to-do list...). Seven per page, then More.

const POS_KEY = 'main-menu-pos';
const PER_PAGE = 7;
const load = (): { x: number; y: number } | null => { try { const v = localStorage.getItem(POS_KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
const store = (p: { x: number; y: number }) => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };

export default function MainMenu() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const role = useStore((s) => s.role);
  const studentId = useStore((s) => s.currentStudentId);
  const streak = useStreak(role === 'student' ? studentId : null);
  const registered = useRegisteredMenuItems();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [page, setPage] = useState(0);
  const [pos, setPos] = useState(load);
  const el = useRef<HTMLButtonElement | null>(null);
  const drag = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const tapHandled = useRef(false);

  const show = role === 'student' && !!studentId && (pathname.startsWith('/student') || pathname.startsWith('/world'))
    && pathname !== '/student/login' && !pathname.startsWith('/student/grammar-gus');

  useEffect(() => {
    const on = () => { setPage(0); setOpen(true); };
    window.addEventListener(OPEN_MAIN_MENU, on);
    return () => window.removeEventListener(OPEN_MAIN_MENU, on);
  }, []);
  useEffect(() => { setOpen(false); }, [pathname]);
  // Games that keep a bottom bar clear of the old Report bubble keep it clear of the menu too.
  useEffect(() => {
    if (!show) return;
    document.body.classList.add('has-report-bubble');
    return () => document.body.classList.remove('has-report-bubble');
  }, [show]);
  const clamp = (x: number, y: number) => {
    const w = el.current?.offsetWidth ?? 64, h = el.current?.offsetHeight ?? 64;
    return { x: Math.max(4, Math.min(window.innerWidth - w - 4, x)), y: Math.max(4, Math.min(window.innerHeight - h - 4, y)) };
  };
  useEffect(() => {
    const fit = () => setPos((p) => (p ? clamp(p.x, p.y) : p));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!show) return null;

  const go = (to: string) => () => navigate(to, { state: { from: pathname.startsWith('/world/town') ? 'town' : undefined } });
  const base: MenuItem[] = [
    { id: 'report', icon: '🐱', label: 'Report', bg: '#5b6bd6', order: 1, onSelect: () => window.dispatchEvent(new Event(OPEN_AZALEA)) },
    { id: 'streak', icon: '🔥', label: `My Streak (${streak.count ?? 0})`, bg: '#e0611a', order: 2, onSelect: () => openStreakView() },
    ...(pathname.startsWith('/world/town') ? [] : [{ id: 'town', icon: '🌳', label: 'Town Square', bg: '#2f8f6b', order: 0, onSelect: go('/world/town') }]),
    { id: 'arcade', icon: '🕹️', label: 'Arcade', bg: '#7c3aed', order: 13, onSelect: go('/student/games') },
    { id: 'piggybank', icon: '🐷', label: 'Piggy Bank', bg: '#e0709a', order: 14, onSelect: go('/student/piggy-bank') },
    // Build Queue 381: Settings, with Afterschool mode (Town Square keeps its own Settings, which also has it).
    ...(pathname.startsWith('/world/town') ? [] : [{ id: 'settings', icon: '⚙️', label: 'Settings', bg: '#5b6b8a', order: 15, onSelect: () => setSettings(true) }]),
    ...(pathname === '/student/home' ? [] : [{ id: 'computer', icon: '💻', label: 'Computer', bg: '#3e6b7c', order: pathname.startsWith('/world') ? 21 : 3, onSelect: go('/student/home') }]),
  ];
  const ids = new Set(base.map((b) => b.id));
  const all = [...base, ...registered.filter((r) => !ids.has(r.id))].sort((a, b) => a.order - b.order);
  const pages = Math.max(1, Math.ceil(all.length / PER_PAGE));
  const p = Math.min(page, pages - 1);
  const wedges = all.slice(p * PER_PAGE, p * PER_PAGE + PER_PAGE);
  const ring = pages > 1 ? [...wedges, { id: 'more', icon: p === pages - 1 ? '↩️' : '⚙️', label: 'More', bg: '#5b6b8a', order: 99, onSelect: () => setPage((p + 1) % pages) }] : wedges;

  const down = (e: React.PointerEvent) => {
    const r = el.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    el.current!.setPointerCapture?.(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.abs(e.clientX - d.sx) + Math.abs(e.clientY - d.sy) > 6) d.moved = true;
    if (d.moved) setPos(clamp(e.clientX - d.dx, e.clientY - d.dy));
  };
  const up = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    tapHandled.current = true;
    window.setTimeout(() => { tapHandled.current = false; }, 400);
    if (d.moved) { store(clamp(e.clientX - d.dx, e.clientY - d.dy)); return; }
    setPage(0); setOpen(true);
  };
  const style: React.CSSProperties = pos ? { left: pos.x, top: pos.y } : { right: 'max(12px, env(safe-area-inset-right))', bottom: 'max(12px, env(safe-area-inset-bottom))' };
  const radius = ring.length > 6 ? 118 : 100;

  return (
    <>
      <button
        ref={el}
        type="button"
        className="main-menu-btn"
        style={style}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { drag.current = null; }}
        onClick={() => { if (!tapHandled.current) { setPage(0); setOpen(true); } }}
        aria-label="Main menu. Drag me anywhere."
      >
        <span className="main-menu-ico" aria-hidden="true">☰</span>
        <small>Menu</small>
        <span className="main-menu-streak" aria-hidden="true">🔥{streak.count ?? 0}</span>
      </button>
      {open && (
        <div className="main-menu-back" onClick={() => setOpen(false)} role="dialog" aria-label="Main menu">
          <div className="main-menu-pie" style={{ width: radius * 2 + 80, height: radius * 2 + 80 }} onClick={(e) => e.stopPropagation()}>
            <div className="main-menu-center">Menu{pages > 1 ? <small>{p + 1} of {pages}</small> : null}</div>
            {ring.map((w, i) => {
              const a = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
              return (
                <button key={w.id} type="button" className="main-menu-wedge" title={w.label}
                  style={{ left: `calc(50% + ${Math.cos(a) * radius}px)`, top: `calc(50% + ${Math.sin(a) * radius}px)`, background: w.bg }}
                  onClick={() => { if (w.id !== 'more') setOpen(false); w.onSelect(); }}>
                  <span className="main-menu-wedge-ico">{w.icon}</span>
                  <span className="main-menu-wedge-label">{w.label}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="main-menu-cancel" onClick={() => setOpen(false)}><Icon name="close" size={14} fallback="✕" /> Close</button>
        </div>
      )}
      {settings && studentId && (
        <div className="overlay-backdrop" role="dialog" aria-modal="true" aria-label="Settings" onClick={() => setSettings(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ gap: 16 }}>
              <h2 style={{ margin: 0 }}>⚙️ Settings</h2>
              <AfterschoolSettings studentId={studentId} />
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setSettings(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
