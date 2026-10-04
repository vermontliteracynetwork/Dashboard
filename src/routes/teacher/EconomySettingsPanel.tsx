import { useState } from 'react';
import { useStore } from '../../store/store';
import { ECONOMY_DEFAULTS, ECONOMY_OWNER, useEconomy, type EconomySettings } from '../../lib/economy';

// Economy Settings (teacher, Game tab): the numbers behind game pay, the
// Daily Streak and the Daily Spin, each pre-filled with what the app does
// today. Plain teacher styling, no student theme.
const dollars = (c: number) => (c / 100).toFixed(2).replace(/\.00$/, '');
const toCents = (v: string) => Math.round(Math.max(0, Number(v) || 0) * 100);

export default function EconomySettingsPanel() {
  const econ = useEconomy();
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [draft, setDraft] = useState<EconomySettings>(econ);
  const [cashText, setCashText] = useState(econ.spinCashCents.map(dollars).join(', '));
  const [cashbackText, setCashbackText] = useState(econ.cashbackPcts.join(', '));
  const [saved, setSaved] = useState(false);
  const set = (patch: Partial<EconomySettings>) => { setDraft((d) => ({ ...d, ...patch })); setSaved(false); };
  const save = () => {
    const spinCashCents = cashText.split(',').map((x) => toCents(x.trim())).filter((c) => c > 0);
    const cashbackPcts = cashbackText.split(',').map((x) => Number(x.trim())).filter((n) => n > 0 && n <= 100);
    mergeStyleRow(ECONOMY_OWNER, { ...draft, spinCashCents: spinCashCents.length ? spinCashCents : ECONOMY_DEFAULTS.spinCashCents, cashbackPcts: cashbackPcts.length ? cashbackPcts : ECONOMY_DEFAULTS.cashbackPcts } as unknown as Record<string, unknown>);
    setSaved(true);
  };
  const reset = () => {
    setDraft(ECONOMY_DEFAULTS);
    setCashText(ECONOMY_DEFAULTS.spinCashCents.map(dollars).join(', '));
    setCashbackText(ECONOMY_DEFAULTS.cashbackPcts.join(', '));
    setSaved(false);
  };
  const row = (label: string, hint: string, input: React.ReactNode) => (
    <label className="stack" style={{ gap: 2 }}>
      <strong style={{ fontSize: '0.9rem' }}>{label}</strong>
      {input}
      <span style={{ fontSize: '0.78rem', opacity: 0.7 }}>{hint}</span>
    </label>
  );
  const money = (v: number, on: (c: number) => void) => (
    <span className="row" style={{ gap: 4, alignItems: 'center' }}>$<input type="number" min={0} step={0.5} value={dollars(v)} onChange={(e) => on(toCents(e.target.value))} style={{ width: 100 }} /></span>
  );
  const count = (v: number, on: (n: number) => void, min = 1) => (
    <input type="number" min={min} value={v} onChange={(e) => on(Math.max(min, Math.round(Number(e.target.value) || min)))} style={{ width: 100 }} />
  );
  return (
    <section className="chrome-frame stack" style={{ padding: 16, gap: 12 }}>
      <h2 style={{ margin: 0 }}>💰 Economy Settings</h2>
      <p style={{ margin: 0, opacity: 0.8 }}>The numbers behind game pay, the Daily Streak and the Daily Spin. Each one starts at what the app does today. Changes reach students right away.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
        {row('Game pay per right answer', 'Every native game, Quiz Mode and the Gas Pump.', money(draft.perCorrectCents, (c) => set({ perCorrectCents: c })))}
        {row('Daily Streak goal', 'Right answers a day to keep the streak.', count(draft.streakGoal, (n) => set({ streakGoal: n })))}
        {row('Streak Freeze price', 'In the Marketplace.', money(draft.freezePriceCents, (c) => set({ freezePriceCents: c })))}
        {row('Day 1 streak chest', 'The one chest on a 1-day streak.', money(draft.dayOneChestCents, (c) => set({ dayOneChestCents: c })))}
        {row('Most chests per day', 'Money caps per day stay the same.', count(draft.maxChests, (n) => set({ maxChests: n })))}
        {row('Daily Spin: Streak Freeze chance', 'Percent of spins that land on the freeze.', <span className="row" style={{ gap: 4, alignItems: 'center' }}><input type="number" min={0} max={100} value={draft.freezeSpinPct} onChange={(e) => set({ freezeSpinPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} style={{ width: 80 }} />%</span>)}
        {row('Daily Spin: cash amounts', 'Dollars, comma separated. Each day 4 of these become wedges.', <input value={cashText} onChange={(e) => { setCashText(e.target.value); setSaved(false); }} />)}
        {row('Daily Spin: cashback percents', 'Comma separated. Each day one is picked.', <input value={cashbackText} onChange={(e) => { setCashbackText(e.target.value); setSaved(false); }} />)}
      </div>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn btn-primary" style={{ minHeight: 44 }} onClick={save}>Save</button>
        <button className="btn" style={{ minHeight: 44 }} onClick={reset}>Back to defaults</button>
        {saved && <span role="status" style={{ alignSelf: 'center', fontWeight: 700, color: 'var(--success)' }}>Saved ✓</span>}
      </div>
    </section>
  );
}
