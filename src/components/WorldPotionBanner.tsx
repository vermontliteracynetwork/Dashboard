import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { startPendingPotion, worldPotionLeft } from '../lib/potionEffects';

// Shows a Supernature potion working in Town Square (Build Queue 104): "Aero: floating, 42s".
export default function WorldPotionBanner() {
  const { pathname } = useLocation();
  const [left, setLeft] = useState(worldPotionLeft());
  useEffect(() => {
    if (pathname !== '/world/town') return;
    startPendingPotion();
    setLeft(worldPotionLeft());
    const t = window.setInterval(() => setLeft(worldPotionLeft()), 1000);
    return () => window.clearInterval(t);
  }, [pathname]);
  if (pathname !== '/world/town' || !left) return null;
  return (
    <div className="world-potion" role="status">
      🪽 {left.kind === 'Veloaero' ? 'Veloaero: super speed flying' : 'Aero: floating'}, {left.seconds}s
    </div>
  );
}
