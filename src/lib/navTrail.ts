import { useEffect, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// One back trail for every student screen (teacher, 2026-10-08: "back
// button, breadcrumbing trails dont exist and run well ... they want to be
// returned to the main computer menu screen, not always town square").
// Every place a student goes is remembered in order. Back always returns to
// the screen they actually came from, the breadcrumb shows the whole path,
// and the Computer is always one tap away. Kept for the browser tab only.

export interface TrailStep { path: string; label: string; state?: unknown }

const KEY = 'nav-trail';
const ROOTS = ['/student/home', '/world/town'];
const LABELS: Record<string, string> = {
  '/student/home': '🖥️ Computer',
  '/world/town': '🌳 Town Square',
  '/world/home-room': '🏠 My Home',
  '/world/island': '🏝️ Creative Island',
  '/student/games': '🎮 Games',
  '/student/marketplace': '🛍️ Marketplace',
  '/student/piggy-bank': '🏦 Bank',
  '/student/mailbox': '📬 Mail',
  '/student/cinema': '🎬 Cinema',
  '/student/arcade': '🕹️ Arcade',
  '/student/grammar-gus': '⚙️ Grammar Gus',
  '/student/library': '📚 Library',
  '/student/alchemy': '⚗️ Alchemy',
  '/student/math': '➗ Math',
  '/student/literacy': '📖 Literacy',
  '/student/style': '👗 Seamstress',
  '/student/shape-dash': '🟦 Shape Dash',
  '/student/space-bowling': '🎳 Space Bowling',
  '/student/bakery': '🧁 Bakery Match',
  '/student/grammar': '✏️ Grammar',
  '/student/castle-defense': '🏰 Castle Defense',
  '/student/chess': '♟️ Slime Chess',
  '/student/quiz-mode': '❓ Quiz Mode',
  '/student/farmers-market': '🌾 Farmers Market',
  '/student/pet-shelter': '🐾 Pet Shelter',
  '/student/pet-journal': '📓 Pet Journal',
  '/student/passport': '🛂 Passport',
};
export const labelFor = (path: string) =>
  LABELS[path] ?? path.split('/').filter(Boolean).pop()!.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
const tracked = (path: string) => (path.startsWith('/student/') || path.startsWith('/world/')) && path !== '/student/login';

let trail: TrailStep[] = (() => { try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') as TrailStep[]; } catch { return []; } })();
const subs = new Set<() => void>();
const save = (t: TrailStep[]) => { trail = t; try { sessionStorage.setItem(KEY, JSON.stringify(t)); } catch { /* fine */ } subs.forEach((f) => f()); };

// Mounted once inside the router: records every student screen.
export function TrailTracker() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    if (!tracked(path)) return;
    const step: TrailStep = { path, label: labelFor(path), state: location.state ?? undefined };
    if (ROOTS.includes(path)) { save([step]); return; }
    const at = trail.findIndex((s) => s.path === path);
    if (at >= 0) save([...trail.slice(0, at), step]);
    else save([...(trail.length ? trail : [{ path: '/student/home', label: LABELS['/student/home'] }]), step].slice(-8));
  }, [location.pathname, location.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function useTrail(): TrailStep[] {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => trail);
}

// A screen can ask before the student leaves it (teacher 2026-10-08, Alchemy: "make sure there is a
// confirmation menu that appears before they leave to confirm delete"). The guard gets the move to
// make and returns true when it is asking first; Back and the breadcrumbs go through it.
let leaveGuard: ((go: () => void) => boolean) | null = null;
export function setLeaveGuard(g: ((go: () => void) => boolean) | null) { leaveGuard = g; }
export function guardLeave(go: () => void) { if (leaveGuard?.(go)) return; go(); }

// Where Back goes from this screen: the screen before it, or the Computer.
export function useBack(): { label: string; go: () => void; path: string } {
  const navigate = useNavigate();
  const location = useLocation();
  const t = useTrail();
  const here = t.findIndex((s) => s.path === location.pathname);
  const prev = here > 0 ? t[here - 1] : t.length > 1 && here < 0 ? t[t.length - 1] : null;
  const target = prev ?? { path: '/student/home', label: LABELS['/student/home'] };
  return { label: target.label, path: target.path, go: () => navigate(target.path, { state: target.state ?? null }) };
}
