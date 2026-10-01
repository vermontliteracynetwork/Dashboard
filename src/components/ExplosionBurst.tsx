import { useEffect, useRef, useState } from 'react';

// A short, real sprite-frame burst — direct teacher asset upload ("use
// these as assets for the castle defense and other pixel style mini games
// that may come in the future"), from a 10-frame Craftpix explosion
// sequence at public/pixel-ui/explosions/. Plays once from frame 1 to the
// last frame, then renders nothing forever after (stays mounted, not
// unmounted, so a parent that renders this for the lifetime of a dead/
// defeated game object — e.g. Castle Defense's enemies, which stay in the
// array after dying — doesn't accidentally restart it on every re-render).
export interface ExplosionBurstProps {
  x: number; // percent, left
  y: number; // percent, top
  frameCount?: number; // how many numbered frames exist (Explosion1.png..N.png)
  folder?: string; // public/pixel-ui/explosions/<folder>/<folder><n>.png
  frameMs?: number; // time per frame
  size?: number; // rendered width/height in px
}

export default function ExplosionBurst({
  x,
  y,
  frameCount = 10,
  folder = 'Explosion',
  frameMs = 35,
  size = 48,
}: ExplosionBurstProps) {
  const [frame, setFrame] = useState(1);
  const [done, setDone] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    intervalRef.current = window.setInterval(() => {
      setFrame((f) => {
        if (f >= frameCount) {
          if (intervalRef.current) window.clearInterval(intervalRef.current);
          setDone(true);
          return f;
        }
        return f + 1;
      });
    }, frameMs);
    return () => { if (intervalRef.current) window.clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return null;

  return (
    <img
      src={`/pixel-ui/explosions/${folder}/${folder}${frame}.png`}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 5,
        imageRendering: 'pixelated',
      }}
    />
  );
}
