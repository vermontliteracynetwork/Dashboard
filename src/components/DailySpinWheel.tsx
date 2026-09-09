import { useEffect, useRef, useState } from 'react';
import { Wheel } from 'spin-wheel';
import { useStore, type DailySpinResult } from '../store/store';
import { todayISO } from '../lib/dates';
import { emoteById } from '../lib/emoteCatalog';

interface Props {
  studentId: string;
  onClose: () => void;
}

const SPIN_DURATION_MS = 3200;

// Kept in the same order as DAILY_SPIN_SEGMENTS in store.ts so the wheel's
// visual segments line up with what spinDailyWheel() can actually return.
// Cash segments show the real "cash prize" emote art; the two emote
// segments show the actual emote a student would win — real prize images
// on the wheel, not generic icons.
const SEGMENTS: { label: string; color: string; imageSrc?: string }[] = [
  { label: '$1.00', color: '#f7c948', imageSrc: '/emotes/emote_cash.png' },
  { label: '$2.50', color: '#4ade80', imageSrc: '/emotes/emote_cash.png' },
  { label: '$5.00', color: '#60a5fa', imageSrc: '/emotes/emote_cash.png' },
  { label: '🎫 Skip Pass', color: '#f472b6' },
  { label: '💰 5% Cashback', color: '#c084fc', imageSrc: '/emotes/emote_cash.png' },
  { label: emoteById('emote-laugh')?.name ?? 'LOL', color: '#fb923c', imageSrc: emoteById('emote-laugh')?.src },
  { label: emoteById('emote-stars')?.name ?? 'Sparkle', color: '#facc15', imageSrc: emoteById('emote-stars')?.src },
];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function DailySpinWheel({ studentId, onClose }: Props) {
  const students = useStore((s) => s.students);
  const spinDailyWheel = useStore((s) => s.spinDailyWheel);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<InstanceType<typeof Wheel> | null>(null);
  const [wheelReady, setWheelReady] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<DailySpinResult | null>(null);

  const student = students.find((s) => s.id === studentId);
  const alreadySpun = student?.lastSpinDate === todayISO();
  const showWheel = !!student && !alreadySpun;

  // Build the canvas wheel once, after every segment's real prize image has
  // loaded — a missing/broken image just falls back to no image for that
  // segment rather than blocking the whole wheel.
  useEffect(() => {
    if (!showWheel) return;
    let cancelled = false;

    (async () => {
      const images = await Promise.all(
        SEGMENTS.map((seg) => (seg.imageSrc ? loadImage(seg.imageSrc).catch(() => null) : Promise.resolve(null))),
      );
      if (cancelled || !containerRef.current) return;

      wheelRef.current = new Wheel(containerRef.current, {
        items: SEGMENTS.map((seg, i) => ({
          label: seg.label,
          backgroundColor: seg.color,
          image: images[i] ?? undefined,
          imageRadius: 0.62,
          imageScale: 1.3,
        })),
        isInteractive: false, // only our Spin button drives it — the winner is already decided server-side
        itemLabelRadius: 0.92,
        itemLabelRadiusMax: 0.32,
        itemLabelFont: "'Nunito', sans-serif",
        itemLabelFontSizeMax: 24,
        itemLabelColors: ['#1a1420'],
        itemLabelStrokeColor: '#fff',
        itemLabelStrokeWidth: 4,
        lineWidth: 2,
        lineColor: '#1a1420',
        borderColor: '#1a1420',
        borderWidth: 5,
        radius: 0.92,
      });
      setWheelReady(true);
    })();

    return () => {
      cancelled = true;
      wheelRef.current?.remove();
      wheelRef.current = null;
      setWheelReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showWheel]);

  if (!student) return null;

  const doSpin = () => {
    const outcome = spinDailyWheel(studentId);
    if (!outcome || !wheelRef.current) return;
    setSpinning(true);
    wheelRef.current.spinToItem(outcome.segmentIndex, SPIN_DURATION_MS, true, 5, 1, null);
    window.setTimeout(() => {
      setSpinning(false);
      setResult(outcome);
    }, SPIN_DURATION_MS + 100);
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
              {result.type === 'emote' && result.emoteId && (
                <img src={emoteById(result.emoteId)?.src} alt="" style={{ width: 96, height: 96 }} />
              )}
              <div style={{ fontSize: result.type === 'emote' && result.emoteId ? '2rem' : '3rem' }}>
                {result.type === 'emote' && result.emoteId ? '🎉 New emote!' : '🎉'}
              </div>
              <p style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>
                {result.type === 'emote' ? result.label : `You got ${result.label}!`}
              </p>
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} onClick={onClose}>
                Yay!
              </button>
            </>
          ) : (
            <>
              <p style={{ opacity: 0.75, marginTop: -8 }}>One free spin a day — every prize is a win!</p>
              <div style={{ position: 'relative', width: 240, height: 240 }}>
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
                <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
                {!wheelReady && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem',
                      opacity: 0.6,
                    }}
                  >
                    Loading wheel…
                  </div>
                )}
              </div>
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} disabled={spinning || !wheelReady} onClick={doSpin}>
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
