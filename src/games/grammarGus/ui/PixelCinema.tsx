import { useEffect, useRef } from 'react';
import { FB, W, H } from '../render/fb';
import { FPS, renderVideoFrame, renderWaiting } from '../render/stage';
import type { SceneScript } from '../director/director';
import { gusSound } from './sound';

// The Pixel Cinema (plan 3.17): a 160 x 90 pixel stage, upscaled with
// crisp pixels, that plays a scene script. Red curtains open first and
// close at the end; the whole video is 10 seconds or less.
export default function PixelCinema({ script, playKey, speed = 1, calm = false, question = false, onEnd }: {
  script: SceneScript | null; playKey: number; speed?: number; calm?: boolean; question?: boolean; onEnd?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    const fb = new FB();
    const img = g.createImageData(W, H);
    const paint = () => { fb.toRGBA(img.data); g.putImageData(img, 0, 0); };
    if (!script) { renderWaiting(fb, question); paint(); return; }
    let raf = 0; let last = performance.now(); let t = 0; let lastFrame = -1; let dinged = false;
    gusSound.swish();
    const total = script.timing.total;
    const stampAt = total - script.timing.stamp;
    const tick = (now: number) => {
      t += ((now - last) / 1000) * speed; last = now;
      const frame = Math.floor(Math.min(t, total) * FPS);
      if (frame !== lastFrame) { lastFrame = frame; renderVideoFrame(fb, script, Math.min(t, total), { calm }); paint(); }
      if (!dinged && t >= stampAt) { dinged = true; gusSound.ding(); }
      if (t < total) raf = requestAnimationFrame(tick); else endRef.current?.();
    };
    raf = requestAnimationFrame(tick);
    const onHide = () => { if (document.hidden) cancelAnimationFrame(raf); };
    document.addEventListener('visibilitychange', onHide);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onHide); };
  }, [script, playKey, speed, calm, question]);
  return <canvas ref={canvas} width={W} height={H} className="gus-cinema-canvas" aria-label={script ? `Video: ${script.scenes[0].caption}` : 'The cinema curtains are closed'} role="img" />;
}
