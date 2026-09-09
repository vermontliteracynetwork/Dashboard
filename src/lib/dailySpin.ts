import { AVATAR_CATALOG } from '../store/badges';
import { EMOTE_CATALOG } from './emoteCatalog';
import { formatMoney } from './money';
import type { MarketplaceItem } from '../types';

export type SpinItemKind = 'avatar' | 'emote' | 'font' | 'color' | 'voice' | 'prize';

export interface DailySpinSegment {
  id: string; // stable across the day, used as the React/canvas key and to match a result back to its segment
  kind: 'cents' | 'cashback' | 'skip' | SpinItemKind;
  label: string;
  amountCents?: number; // 'cents' kind only
  percent?: number; // 'cashback' kind only
  itemId?: string; // item kinds only
  imageUrl?: string; // item kinds only, when the item has real art (emotes, an uploaded prize icon)
}

// mulberry32 — tiny, fast, seedable PRNG so every student sees the SAME 10
// segments on a given date (deterministic from the date string alone), and
// a fresh 10 the next day, without any server-side state.
function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

const CASH_AMOUNTS_CENTS = [100, 200, 250, 300, 500, 1000]; // $1, $2, $2.50, $3, $5, $10

function isAvailableOn(item: MarketplaceItem, dateISO: string): boolean {
  if (item.availableFrom && dateISO < item.availableFrom) return false;
  if (item.availableUntil && dateISO > item.availableUntil) return false;
  return true;
}

// Every spin is a win — no empty outcome — so the 10 segments are always:
// 1 Skip Pass, 1 cashback tier (3% or 5%), 4 distinct cash amounts, and 4
// random marketplace items (avatar/emote/font/color/voice/teacher prize —
// power-ups are excluded since the dedicated Skip Pass segment already
// covers that). If a student already owns an item they land on,
// spinDailyWheel falls back to a small cash consolation so nothing is ever
// a dead spin. A seasonal/limited-time item only enters the pool on the
// days it's actually available.
export function getDailySpinSegments(dateISO: string, marketplaceItems: MarketplaceItem[]): DailySpinSegment[] {
  const rand = seededRandom(hashString(dateISO));

  const segments: DailySpinSegment[] = [];
  segments.push({ id: 'skip', kind: 'skip', label: '🎫 Skip Pass' });

  const cashbackPct = rand() < 0.5 ? 3 : 5;
  segments.push({ id: `cashback-${cashbackPct}`, kind: 'cashback', percent: cashbackPct, label: `💰 ${cashbackPct}% Cashback` });

  const cashPool = [...CASH_AMOUNTS_CENTS];
  for (let i = 0; i < 4 && cashPool.length > 0; i++) {
    const idx = Math.floor(rand() * cashPool.length);
    const amount = cashPool.splice(idx, 1)[0];
    segments.push({ id: `cash-${amount}`, kind: 'cents', amountCents: amount, label: formatMoney(amount) });
  }

  interface Candidate { kind: SpinItemKind; itemId: string; label: string; imageUrl?: string }
  const availableToday = marketplaceItems.filter((it) => it.price > 0 && isAvailableOn(it, dateISO));
  const candidates: Candidate[] = [
    ...AVATAR_CATALOG.map((a) => ({ kind: 'avatar' as const, itemId: a.id, label: a.name })),
    ...EMOTE_CATALOG.map((e) => ({ kind: 'emote' as const, itemId: e.id, label: e.name, imageUrl: e.src })),
    ...availableToday
      .filter((it) => it.kind === 'font' || it.kind === 'color' || it.kind === 'voice' || it.kind === 'prize')
      .map((it) => ({
        kind: it.kind as SpinItemKind,
        itemId: it.id,
        label: it.name,
        imageUrl: it.icon.startsWith('/') || it.icon.startsWith('http') ? it.icon : undefined,
      })),
  ];
  for (let i = 0; i < 4 && candidates.length > 0; i++) {
    const idx = Math.floor(rand() * candidates.length);
    const c = candidates.splice(idx, 1)[0];
    segments.push({ id: `item-${c.kind}-${c.itemId}`, kind: c.kind, itemId: c.itemId, label: c.label, imageUrl: c.imageUrl });
  }

  // Shuffle so Skip/Cashback don't always land in the same two wedges.
  for (let i = segments.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [segments[i], segments[j]] = [segments[j], segments[i]];
  }

  return segments;
}
