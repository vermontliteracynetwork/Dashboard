import { useEffect, useRef } from 'react';

interface Props {
  remainingMs: number;
  totalMinutes: number | null;
  label: string;
  onExpire?: () => void;
}

function formatMMSS(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// A prominent, always-visible countdown for a timed break or Playground
// window. The parent re-renders this every second with a fresh remainingMs
// (recomputed from the real timestamps in playgroundAccess), so this stays
// accurate even if the tab was backgrounded — it never runs its own clock.
export default function BreakTimer({ remainingMs, totalMinutes, label, onExpire }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      onExpire?.();
    } else if (remainingMs > 1000) {
      firedRef.current = false;
    }
  }, [remainingMs, onExpire]);

  const totalMs = totalMinutes ? totalMinutes * 60_000 : null;
  const pct = totalMs ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 100;
  const urgent = remainingMs <= 30_000;

  return (
    <div className={`break-timer ${urgent ? 'break-timer-urgent' : ''}`}>
      <div className="break-timer-label">{urgent ? '⏰' : '⏳'} {label}</div>
      <div className="break-timer-clock">{formatMMSS(remainingMs)}</div>
      <div className="break-timer-bar">
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
