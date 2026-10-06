import { useStore } from '../store/store';

// Economy Settings (Weekly Planning Phase 1, item 4: game numbers as real
// teacher settings with sensible defaults, instead of decided in code).
// Saved as the `economy` row in style_looks (no new SQL). Every value
// starts at exactly what the app did before this screen existed.
export interface EconomySettings {
  perCorrectCents: number; // native games: pay per right answer
  streakGoal: number; // right answers a day to save the Daily Streak
  freezePriceCents: number; // Streak Freeze in the Marketplace
  maxChests: number; // treasure chests per saved day, at most
  dayOneChestCents: number; // the single chest on a 1-day streak
  spinCashCents: number[]; // Daily Spin cash wedges are picked from these
  cashbackPcts: number[]; // Daily Spin cashback wedge (one is picked each day)
  freezeSpinPct: number; // chance the Daily Spin lands on a Streak Freeze
}

export const ECONOMY_DEFAULTS: EconomySettings = {
  perCorrectCents: 100,
  streakGoal: 10,
  freezePriceCents: 2000,
  maxChests: 7,
  dayOneChestCents: 500,
  spinCashCents: [100, 200, 250, 300, 500, 1000],
  cashbackPcts: [3, 5],
  freezeSpinPct: 5,
};

export const ECONOMY_OWNER = 'economy';

function clean(raw: Partial<EconomySettings> | undefined): EconomySettings {
  const r = raw ?? {};
  const num = (v: unknown, d: number, min = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= min ? v : d);
  const list = (v: unknown, d: number[]) => (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === 'number' && x > 0) ? (v as number[]) : d);
  return {
    perCorrectCents: num(r.perCorrectCents, ECONOMY_DEFAULTS.perCorrectCents),
    streakGoal: Math.round(num(r.streakGoal, ECONOMY_DEFAULTS.streakGoal, 1)),
    freezePriceCents: num(r.freezePriceCents, ECONOMY_DEFAULTS.freezePriceCents),
    maxChests: Math.round(num(r.maxChests, ECONOMY_DEFAULTS.maxChests, 1)),
    dayOneChestCents: num(r.dayOneChestCents, ECONOMY_DEFAULTS.dayOneChestCents),
    spinCashCents: list(r.spinCashCents, ECONOMY_DEFAULTS.spinCashCents),
    cashbackPcts: list(r.cashbackPcts, ECONOMY_DEFAULTS.cashbackPcts),
    freezeSpinPct: Math.min(100, num(r.freezeSpinPct, ECONOMY_DEFAULTS.freezeSpinPct)),
  };
}

export function getEconomy(): EconomySettings {
  const row = useStore.getState().styleLooks.find((r) => r.ownerId === ECONOMY_OWNER)?.look as Partial<EconomySettings> | undefined;
  return clean(row);
}
export function useEconomy(): EconomySettings {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === ECONOMY_OWNER));
  return clean(row?.look as Partial<EconomySettings> | undefined);
}
