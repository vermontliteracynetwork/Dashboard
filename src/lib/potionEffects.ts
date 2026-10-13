// Supernature potions out in the world (Build Queue 104). Drinking Aero (float) or Veloaero (float
// and super speed) in the Cauldron saves a pending effect; it starts the moment the student is in
// Town Square and lasts 60 seconds. Town Square's player reads worldPotionNow() every frame.
const KEY = 'sn-world-potion';
export type WorldPotion = 'Aero' | 'Veloaero';
interface Saved { kind: WorldPotion; until?: number }
let cache: Saved | null | undefined;
function read(): Saved | null {
  if (cache !== undefined) return cache;
  try { cache = JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { cache = null; }
  return cache ?? null;
}
function write(v: Saved | null) {
  cache = v;
  try { if (v) localStorage.setItem(KEY, JSON.stringify(v)); else localStorage.removeItem(KEY); } catch { /* fine */ }
}
export function drinkWorldPotion(kind: WorldPotion) { write({ kind }); }
// Called when Town Square is showing: a pending potion starts its 60 seconds.
export function startPendingPotion() { const v = read(); if (v && !v.until) write({ ...v, until: Date.now() + 60000 }); }
export function worldPotionLeft(): { kind: WorldPotion; seconds: number } | null {
  const v = read(); if (!v?.until) return null;
  const s = Math.ceil((v.until - Date.now()) / 1000);
  if (s <= 0) { write(null); return null; }
  return { kind: v.kind, seconds: s };
}
export function pendingWorldPotion(): WorldPotion | null { const v = read(); return v && !v.until ? v.kind : null; }
export function worldPotionNow(): { lift: number; speed: number } {
  const v = cache === undefined ? read() : cache;
  if (!v?.until || v.until < Date.now()) return { lift: 0, speed: 1 };
  return { lift: 1.4 + Math.sin(Date.now() / 400) * 0.15, speed: v.kind === 'Veloaero' ? 1.9 : 1 };
}
