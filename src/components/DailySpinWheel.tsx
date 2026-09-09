import { useEffect, useMemo, useRef, useState } from 'react';
import { Wheel } from 'spin-wheel';
import { useStore, type DailySpinResult } from '../store/store';
import { todayISO } from '../lib/dates';
import { getDailySpinSegments, type DailySpinSegment } from '../lib/dailySpin';
import { emoteById } from '../lib/emoteCatalog';
import { avatarById } from '../lib/avatarCatalog';
import { fontById } from '../lib/fontCatalog';
import { colorById } from '../lib/colorCatalog';
import { voiceOptionById } from '../lib/voiceCatalog';

interface Props {
  studentId: string;
  onClose: () => void;
}

const SPIN_DURATION_MS = 3200;
const SEGMENT_COLORS = ['#f7c948', '#4ade80', '#60a5fa', '#f472b6', '#c084fc', '#fb923c', '#facc15', '#22d3ee', '#a3e635', '#f87171'];

function segmentImageSrc(seg: DailySpinSegment): string | undefined {
  if (seg.imageUrl) return seg.imageUrl;
  if (seg.kind === 'cents' || seg.kind === 'cashback') return '/emotes/emote_cash.png';
  return undefined;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// A little "what did I actually win" lookup so the result screen can show
// the real name/art of an item prize, not just its catalog id.
function itemDisplay(itemKind: string, itemId: string): { name: string; imageUrl?: string } | null {
  switch (itemKind) {
    case 'avatar': { const a = avatarById(itemId); return a ? { name: a.name } : null; }
    case 'emote': { const e = emoteById(itemId); return e ? { name: e.name, imageUrl: e.src } : null; }
    case 'font': { const f = fontById(itemId); return f ? { name: f.name } : null; }
    case 'color': { const c = colorById(itemId); return c ? { name: c.name } : null; }
    case 'voice': { const v = voiceOptionById(itemId); return v ? { name: v.name } : null; }
    default: return null;
  }
}

export default function DailySpinWheel({ studentId, onClose }: Props) {
  const students = useStore((s) => s.students);
  const customPrizes = useStore((s) => s.customPrizes);
  const spinDailyWheel = useStore((s) => s.spinDailyWheel);
  const containerRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<InstanceType<typeof Wheel> | null>(null);
  const [wheelReady, setWheelReady] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<DailySpinResult | null>(null);

  const student = students.find((s) => s.id === studentId);
  const alreadySpun = student?.lastSpinDate === todayISO();
  const showWheel = !!student && !alreadySpun;

  // Today's 10 segments — deterministic from the date, same for every
  // student, fresh again tomorrow.
  const segments = useMemo(() => getDailySpinSegments(todayISO(), customPrizes), [customPrizes]);

  useEffect(() => {
    if (!showWheel) return;
    let cancelled = false;

    (async () => {
      const images = await Promise.all(
        segments.map((seg) => {
          const src = segmentImageSrc(seg);
          return src ? loadImage(src).catch(() => null) : Promise.resolve(null);
        }),
      );
      if (cancelled || !containerRef.current) return;

      wheelRef.current = new Wheel(containerRef.current, {
        items: segments.map((seg, i) => ({
          label: seg.label,
          backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
          image: images[i] ?? undefined,
          imageRadius: 0.62,
          imageScale: 1.3,
        })),
        isInteractive: false, // only our Spin button drives it — the winner is already decided server-side
        itemLabelRadius: 0.92,
        itemLabelRadiusMax: 0.28,
        itemLabelFont: "'Nunito', sans-serif",
        itemLabelFontSizeMax: 20,
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
  }, [showWheel, segments]);

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

  const won = result?.type === 'item' && result.itemKind && result.itemId ? itemDisplay(result.itemKind, result.itemId) : null;

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
              {won?.imageUrl && <img src={won.imageUrl} alt="" style={{ width: 96, height: 96 }} />}
              <div style={{ fontSize: won ? '2rem' : '3rem' }}>{won ? '🎉 New prize!' : '🎉'}</div>
              <p style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>
                {result.type === 'item' ? result.label : `You got ${result.label}!`}
              </p>
              <button className="btn btn-primary btn-lg" style={{ minHeight: 44 }} onClick={onClose}>
                Yay!
              </button>
            </>
          ) : (
            <>
              <p style={{ opacity: 0.75, marginTop: -8 }}>One free spin a day — every prize is a win! New prizes tomorrow.</p>
              <div style={{ position: 'relative', width: 260, height: 260 }}>
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
