import type { Transaction } from '../types';
import { formatMoney } from '../lib/money';

interface Props {
  transactions: Transaction[]; // this student's only, any order
  currentBalanceCents: number;
  streak: number;
}

const CHART_W = 320;
const CHART_H = 160;
const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;
const PLOT_W = CHART_W - PAD_L - PAD_R;
const PLOT_H = CHART_H - PAD_T - PAD_B;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(v));
  const norm = v / magnitude;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * magnitude;
}

// A real, labeled line graph of the student's balance over time, with a
// dashed 7-day projection based on their current streak-interest rate — and
// a bar chart of income by month. Built as plain SVG (no charting library)
// since these are simple, hand-legible shapes, and the point is for
// students to be able to read them, not admire them.
export default function PiggyBankCharts({ transactions, currentBalanceCents, streak }: Props) {
  if (transactions.length === 0) {
    return <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Charts show up once you've earned or spent some Class Cash!</p>;
  }

  const sorted = [...transactions].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  // Running balance at the end of each day that had activity.
  const dayTotals: { date: string; balance: number }[] = [];
  let running = 0;
  const byDay = new Map<string, number>();
  sorted.forEach((t) => {
    const day = t.createdAt.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + t.amountCents);
  });
  [...byDay.keys()].sort().forEach((day) => {
    running += byDay.get(day)!;
    dayTotals.push({ date: day, balance: running });
  });

  // 7-day projection: current streak's interest rate (capped 20%),
  // compounded once per day forward from today's real balance.
  const pct = Math.min(streak, 20) / 100;
  const projection: { day: number; balance: number }[] = [{ day: 0, balance: currentBalanceCents }];
  for (let d = 1; d <= 7; d++) {
    projection.push({ day: d, balance: Math.round(projection[d - 1].balance * (1 + pct)) });
  }

  const maxBalance = niceMax(Math.max(...dayTotals.map((d) => d.balance), ...projection.map((p) => p.balance), 100));
  const totalPoints = dayTotals.length - 1 + 7; // real points span + projected span, on one shared x-axis
  const xForIndex = (i: number) => PAD_L + (totalPoints === 0 ? 0 : (i / totalPoints) * PLOT_W);
  const yForBalance = (cents: number) => PAD_T + PLOT_H - (cents / maxBalance) * PLOT_H;

  const linePoints = dayTotals.map((d, i) => `${xForIndex(i)},${yForBalance(d.balance)}`).join(' ');
  const lastRealIndex = dayTotals.length - 1;
  const projectionPoints = projection.map((p) => `${xForIndex(lastRealIndex + p.day)},${yForBalance(p.balance)}`).join(' ');

  // Monthly income (positive transactions only) for the bar chart.
  const monthTotals = new Map<string, number>();
  sorted.forEach((t) => {
    if (t.amountCents <= 0) return;
    const month = t.createdAt.slice(0, 7); // YYYY-MM
    monthTotals.set(month, (monthTotals.get(month) ?? 0) + t.amountCents);
  });
  const months = [...monthTotals.keys()].sort().slice(-6);
  const maxMonth = niceMax(Math.max(...months.map((m) => monthTotals.get(m)!), 100));
  const barW = months.length > 0 ? PLOT_W / months.length : PLOT_W;

  const yTicks = [0, 0.5, 1].map((f) => Math.round(maxBalance * f));
  const yTicksMonth = [0, 0.5, 1].map((f) => Math.round(maxMonth * f));

  return (
    <div className="stack" style={{ gap: 18 }}>
      <div>
        <strong style={{ fontSize: '0.85rem' }}>📈 Your balance over time</strong>
        <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '2px 0 6px' }}>
          Dashed line = what your money could grow to if your {streak}-day streak keeps earning {Math.round(pct * 100)}% interest each day.
        </p>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', maxWidth: 420 }} role="img" aria-label="Line chart of balance over time">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={CHART_W - PAD_R} y1={yForBalance(v)} y2={yForBalance(v)} stroke="var(--content-border)" strokeWidth={1} />
              <text x={PAD_L - 6} y={yForBalance(v) + 3} fontSize={8} textAnchor="end" fill="currentColor" opacity={0.7}>
                {formatMoney(v)}
              </text>
            </g>
          ))}
          <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={CHART_H - PAD_B} stroke="var(--ink)" strokeWidth={1.5} />
          <line x1={PAD_L} x2={CHART_W - PAD_R} y1={CHART_H - PAD_B} y2={CHART_H - PAD_B} stroke="var(--ink)" strokeWidth={1.5} />
          <polyline points={linePoints} fill="none" stroke="var(--purple)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={projectionPoints} fill="none" stroke="var(--teal)" strokeWidth={2.5} strokeDasharray="5,4" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={xForIndex(lastRealIndex)} cy={yForBalance(dayTotals[lastRealIndex].balance)} r={3.5} fill="var(--purple)" />
          <text x={PAD_L} y={CHART_H - 6} fontSize={8} fill="currentColor" opacity={0.7}>{dayTotals[0]?.date.slice(5)}</text>
          <text x={CHART_W - PAD_R} y={CHART_H - 6} fontSize={8} textAnchor="end" fill="currentColor" opacity={0.7}>+7 days</text>
        </svg>
      </div>

      {months.length > 0 && (
        <div>
          <strong style={{ fontSize: '0.85rem' }}>📊 Money earned by month</strong>
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', maxWidth: 420, marginTop: 6 }} role="img" aria-label="Bar chart of income by month">
            {yTicksMonth.map((v) => (
              <g key={v}>
                <line x1={PAD_L} x2={CHART_W - PAD_R} y1={PAD_T + PLOT_H - (v / maxMonth) * PLOT_H} y2={PAD_T + PLOT_H - (v / maxMonth) * PLOT_H} stroke="var(--content-border)" strokeWidth={1} />
                <text x={PAD_L - 6} y={PAD_T + PLOT_H - (v / maxMonth) * PLOT_H + 3} fontSize={8} textAnchor="end" fill="currentColor" opacity={0.7}>
                  {formatMoney(v)}
                </text>
              </g>
            ))}
            <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={CHART_H - PAD_B} stroke="var(--ink)" strokeWidth={1.5} />
            <line x1={PAD_L} x2={CHART_W - PAD_R} y1={CHART_H - PAD_B} y2={CHART_H - PAD_B} stroke="var(--ink)" strokeWidth={1.5} />
            {months.map((m, i) => {
              const value = monthTotals.get(m)!;
              const h = (value / maxMonth) * PLOT_H;
              const x = PAD_L + i * barW + barW * 0.15;
              const w = barW * 0.7;
              const label = new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, { month: 'short' });
              return (
                <g key={m}>
                  <rect x={x} y={PAD_T + PLOT_H - h} width={w} height={h} fill="var(--teal)" rx={3} />
                  <text x={x + w / 2} y={CHART_H - 6} fontSize={8} textAnchor="middle" fill="currentColor" opacity={0.7}>{label}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
