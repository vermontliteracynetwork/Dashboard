import { useState } from 'react';
import { useStore, type DailySpinResult } from '../store/store';
import { todayISO } from '../lib/dates';

interface Props {
  studentId: string;
  onClose: () => void;
}

// Kept in the same order as DAILY_SPIN_SEGMENTS in store.ts so the wheel's
// visual segments line up with what spinDailyWheel() can actually return.
const SEGMENTS = [
  { icon: '💵', label: '$1.00', color: '#f7c948' },
  { icon: '💵', label: '$2.50', color: '#4ade80' },
  { icon: '💵', label: '$5.00', color: '#60a5fa' },
  { icon: '🎫', label: 'Skip Pass', color: '#f472b6' },
  { icon: '💰', label: '5% Cashback', color: '#c084fc' },
];

export default function DailySpinWheel({ studentId, onClose }: Props) {
  const students = useStore((s) => s.students);
  const spinDailyWheel = useStore((s) => s.spinDailyWheel);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<DailySpinResult | null>(null);

  const student = students.find((s) => s.id === studentId);
  if (!student) return null;
  const alreadySpun = student.lastSpinDate === todayISO();

  const doSpin = () => {
    const outcome = spinDailyWheel(studentId);
    if (!outcome) return;
    const index = outcome.segmentIndex;
    const segmentAngle = 360 / SEGMENTS.length;
    // Land the winning segment's center under the top pointer, plus several
    // full spins so it actually feels like a spin rather than a snap.
    const target = 360 * 5 + (360 - (index * segmentAngle + segmentAngle / 2));
    setSpinning(true);
    setRotation(target);
    window.setTimeout(() => {
      setSpinning(false);
      setResult(outcome);
    }, 2200);
  };

  return (
    <div className="overlay-backdrop" onClick={spinning ? undefined : onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>🎡 Daily Spin</h2>

          {alreadySpun && !result ? (
            <>
              <p>You already spun today — come back tomorrow for another spin!</p>
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} onClick={onClose}>
                Okay
              </button>
            </>
          ) : result ? (
            <>
              <div style={{ fontSize: '3rem' }}>🎉</div>
              <p style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>You got {result.label}!</p>
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} onClick={onClose}>
                Yay!
              </button>
            </>
          ) : (
            <>
              <p style={{ opacity: 0.75, marginTop: -8 }}>One free spin a day — every prize is a win!</p>
              <div style={{ position: 'relative', width: 220, height: 220 }}>
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -6,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '1.6rem',
                    zIndex: 2,
                  }}
                >
                  🔻
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    border: '5px solid var(--ink)',
                    background: `conic-gradient(${SEGMENTS.map((seg, i) => `${seg.color} ${(i * 360) / SEGMENTS.length}deg ${((i + 1) * 360) / SEGMENTS.length}deg`).join(', ')})`,
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? 'transform 2.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none',
                    position: 'relative',
                  }}
                >
                  {SEGMENTS.map((seg, i) => {
                    const segmentAngle = 360 / SEGMENTS.length;
                    const angle = i * segmentAngle + segmentAngle / 2;
                    return (
                      <div
                        key={seg.label}
                        aria-hidden
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: 62,
                          textAlign: 'center',
                          transform: `translate(-50%, -50%) rotate(${angle}deg) translate(0, -72px) rotate(${-angle}deg)`,
                          fontSize: '0.62rem',
                          fontWeight: 800,
                          color: '#1a1420',
                        }}
                      >
                        <div style={{ fontSize: '1.2rem' }}>{seg.icon}</div>
                        {seg.label}
                      </div>
                    );
                  })}
                </div>
              </div>
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} disabled={spinning} onClick={doSpin}>
                {spinning ? 'Spinning…' : 'Spin!'}
              </button>
              <button className="btn btn-sm" style={{ minHeight: 44 }} disabled={spinning} onClick={onClose}>
                Not now
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
