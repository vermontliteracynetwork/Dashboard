import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { playCoinDrop } from '../lib/chime';

interface FallingCoin {
  key: number;
  left: number; // vw
  delay: number; // seconds
  duration: number; // seconds
  size: number; // px
}

const COIN_COUNT = 8;

function makeCoins(): FallingCoin[] {
  return Array.from({ length: COIN_COUNT }, (_, i) => ({
    key: i,
    left: 30 + Math.random() * 40, // cluster roughly center-screen, not edge to edge
    delay: Math.random() * 0.35,
    duration: 0.9 + Math.random() * 0.5,
    size: 28 + Math.random() * 18,
  }));
}

// Mounted once at the app root, same pattern as StudentChatAlert — reacts
// to store.lastCoinEarn (bumped by recordTransaction any time Class Cash
// actually lands: spin win, task reward, streak bonus, achievement, teacher
// bonus...) with a brief, non-blocking cascade of falling coins + a real
// coin-drop sound, instead of the money just silently updating a number.
export default function CoinDropOverlay() {
  const role = useStore((s) => s.role);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const lastCoinEarn = useStore((s) => s.lastCoinEarn);
  const [coins, setCoins] = useState<FallingCoin[] | null>(null);
  const seenId = useRef<string | null>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    if (role !== 'student' || !currentStudentId || !lastCoinEarn) return;
    if (lastCoinEarn.studentId !== currentStudentId) return;
    if (seenId.current === lastCoinEarn.id) return;
    seenId.current = lastCoinEarn.id;

    playCoinDrop();
    setCoins(makeCoins());
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setCoins(null), 1600);

    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [lastCoinEarn, role, currentStudentId]);

  if (!coins) return null;

  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 95, pointerEvents: 'none', overflow: 'hidden' }}>
      {coins.map((c) => (
        <img
          key={c.key}
          src="/coins/coin.png"
          alt=""
          style={{
            position: 'absolute',
            top: -60,
            left: `${c.left}vw`,
            width: c.size,
            height: c.size,
            animation: `coin-drop-fall ${c.duration}s ease-in ${c.delay}s 1 both`,
          }}
        />
      ))}
    </div>
  );
}
