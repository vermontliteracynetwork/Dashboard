import { lazy, type ComponentType } from 'react';

// Keeping every student iPad on the newest build (direct teacher report,
// 2026-10-01: talking to a Neighbor about feelings went to a blank screen
// with "Failed to fetch dynamically imported module", and "the full SEL
// overhaul from earlier is also not showing to my students").
//
// Two causes, both from a tab that stays open across a deploy:
// 1. Each deploy renames the code files. A tab still running the old
//    build asks for an old file name the first time it opens a lazily
//    loaded screen (3D Neighbor scene, Town Square, Slime Chess...), gets
//    a 404, and the whole app crashed to blank. Now it reloads instead,
//    which picks up the new build (at most once every 30 seconds, so a
//    real outage can't cause a reload loop).
// 2. A tab that never reloads never sees anything new. Every few minutes
//    (and whenever the tab comes back into view) this checks whether a
//    newer build is live; if so, the next time the student moves to a
//    calm screen (never mid-game or mid-task) the page quietly reloads
//    onto it. The student stays logged in (the session is persisted).

const RELOAD_KEY = 'iwd-fresh-build-reload-at';
const CHECK_EVERY_MS = 3 * 60 * 1000;
const CALM_PATHS = new Set([
  '/', '/student/login', '/student/home', '/world/town', '/world/home-room',
  '/student/mailbox', '/student/piggy-bank', '/student/marketplace', '/student/passport', '/student/pet-journal',
]);

export function reloadForNewBuild(): void {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage blocked: still reload once */ }
  window.location.reload();
}

// React.lazy that reloads onto the new build instead of crashing when the
// old chunk is gone. The never-settling promise keeps the Suspense
// fallback up while the reload happens.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyFresh<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() => load().catch(() => {
    reloadForNewBuild();
    return new Promise<{ default: T }>(() => {});
  }));
}

const STALE_CHUNK_RE = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;

function currentEntry(): string | null {
  const s = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/index-"]');
  return s ? new URL(s.src, location.href).pathname : null;
}

let newBuildWaiting = false;

async function checkForNewBuild(): Promise<void> {
  const mine = currentEntry();
  if (!mine || newBuildWaiting) return;
  try {
    const res = await fetch(`/index.html?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const html = await res.text();
    const m = html.match(/\/assets\/index-[^"']+\.js/);
    if (m && m[0] !== mine) newBuildWaiting = true;
  } catch { /* offline: try again later */ }
}

const routePath = () => (location.hash.replace(/^#/, '').split('?')[0] || '/');

export function installFreshBuildWatch(): void {
  if (import.meta.env.DEV) return;
  window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); reloadForNewBuild(); });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e.reason as { message?: string } | undefined)?.message ?? e.reason ?? '');
    if (STALE_CHUNK_RE.test(msg)) reloadForNewBuild();
  });
  window.addEventListener('error', (e) => { if (STALE_CHUNK_RE.test(e.message ?? '')) reloadForNewBuild(); });

  window.setInterval(() => { void checkForNewBuild(); }, CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    void checkForNewBuild().then(() => { if (newBuildWaiting && CALM_PATHS.has(routePath())) reloadForNewBuild(); });
  });
  window.addEventListener('hashchange', () => {
    if (newBuildWaiting && CALM_PATHS.has(routePath())) reloadForNewBuild();
  });
}
