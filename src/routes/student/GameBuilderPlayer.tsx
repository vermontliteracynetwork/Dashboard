import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProject } from '../../lib/gameBuilder/model';
import { runGame, type RunHandle } from '../../games/gameBuilder/runtime';
import { startMusic } from '../../games/gameBuilder/music';
import { speak } from '../../components/ReadAloud';
import './GameBuilder.css';

// Plays a Game Builder project full screen (Build Queue 658): the student's play test, and the teacher's Play button
// in the Inbox (666). Kept apart from the editor so the teacher's page does not load the blocks library.
// ---------- Play ----------
// How to play, for each kind (Claudia's review, Build Queue 668).
const HOW: Record<string, string> = {
  platformer: 'Hold the arrow buttons to run. Tap Jump to jump. Keyboard: arrow keys and the space bar.',
  match3: 'Tap a tile, then tap the tile next to it to swap them. Line up 3 of the same color.',
  clicker: 'Tap the big button to earn points. Tap an upgrade when you have enough points.',
  maze: 'Use the arrow buttons or swipe to steer. Eat the dots and stay away from the ghosts.',
  custom: 'Play the game Azalea built with you.',
};

export function Player({ p, onClose }: { p: GameProject; onClose: (r: 'win' | 'lose' | null) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const h = useRef<RunHandle | null>(null);
  const [end, setEnd] = useState<{ r: 'win' | 'lose'; score: number } | null>(null);
  const [round, setRound] = useState(0);
  const [sound, setSound] = useState(true);
  useEffect(() => {
    if (p.kind === 'custom' || !cv.current) return;
    setEnd(null);
    const stopMusic = sound ? startMusic(p.design.music) : () => {};
    const handle = runGame(cv.current, p, { sound, onEnd: (r, score) => { stopMusic(); setEnd({ r, score: Math.floor(score) }); } }); h.current = handle;
    const keyMap: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: p.kind === 'platformer' ? 'jump' : 'up', ArrowDown: 'down', ' ': 'jump', a: 'left', d: 'right', w: 'up', s: 'down' };
    const kd = (e: KeyboardEvent) => { const k = keyMap[e.key]; if (k) { e.preventDefault(); handle.press(k, true); } };
    const ku = (e: KeyboardEvent) => { const k = keyMap[e.key]; if (k) handle.press(k, false); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { stopMusic(); handle.stop(); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, sound]);
  const tap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = cv.current; if (!c || !h.current) return; const b = c.getBoundingClientRect();
    h.current.tap((e.clientX - b.left) * (c.width / b.width), (e.clientY - b.top) * (c.height / b.height));
  };
  // Swipes steer the maze.
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); h.current?.press(k, true); },
    onPointerUp: () => h.current?.press(k, false), onPointerLeave: () => h.current?.press(k, false), onPointerCancel: () => h.current?.press(k, false),
  });
  const customDoc = useMemo(() => p.code ?? '', [p.code]);
  return (
    <div className="gb-player" role="dialog" aria-label={`Playing ${p.name}`}>
      <div className="gb-player-top">
        <b>{p.name}</b>
        {p.kind !== 'custom' && <button type="button" className="gb-btn" onClick={() => setSound((s) => !s)}>{sound ? 'Sound on' : 'Sound off'}</button>}
        <button type="button" className="gb-btn" onClick={() => setRound((r) => r + 1)}>Start over</button>
        <button type="button" className="gb-btn gb-primary" onClick={() => onClose(end?.r ?? null)}>Back to building</button>
      </div>
      <div className="gb-how"><button type="button" className="gb-btn gb-icon" onClick={() => speak(HOW[p.kind])} aria-label="Read how to play">Listen</button><span>{HOW[p.kind]}</span></div>
      <div className="gb-stage">
        {p.kind === 'custom'
          ? (customDoc ? <iframe key={round} title={p.name} sandbox="allow-scripts" srcDoc={customDoc} className="gb-frame" /> : <p className="gb-empty">There is no game yet. Tell Azalea your idea and ask her to build it.</p>)
          : <canvas ref={cv} width={960} height={540} onPointerDown={(e) => { swipe.current = { x: e.clientX, y: e.clientY }; tap(e); }}
              onPointerUp={(e) => { const s = swipe.current; swipe.current = null; if (!s || p.kind !== 'maze') return; const dx = e.clientX - s.x, dy = e.clientY - s.y; if (Math.hypot(dx, dy) < 24) return; h.current?.press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'), true); }} />}
        {end && (
          <div className="gb-end">
            <h2>{end.r === 'win' ? 'You won!' : 'Game over'}</h2>
            <p>Score: {end.score}</p>
            <button type="button" className="gb-btn gb-primary" onClick={() => setRound((r) => r + 1)}>Play again</button>
            <button type="button" className="gb-btn" onClick={() => onClose(end.r)}>Back to building</button>
          </div>
        )}
      </div>
      {p.kind === 'platformer' && (
        <div className="gb-pad">
          <div><button type="button" {...hold('left')} aria-label="Left">◀</button><button type="button" {...hold('right')} aria-label="Right">▶</button></div>
          <button type="button" className="gb-jump" {...hold('jump')}>Jump</button>
        </div>
      )}
      {p.kind === 'maze' && (
        <div className="gb-pad gb-dpad">
          <button type="button" {...hold('up')} aria-label="Up">▲</button>
          <div><button type="button" {...hold('left')} aria-label="Left">◀</button><button type="button" {...hold('down')} aria-label="Down">▼</button><button type="button" {...hold('right')} aria-label="Right">▶</button></div>
        </div>
      )}
    </div>
  );
}

// The live game preview (Build Queue 688, her words 2026-11-18: "have the main screen be a game preview of what they
// currently have created so it is always most updated on what they can see and interact with"). It always shows the
// newest version of the game, but (693, Claudia's review: no autoplay, low stimulation) it waits on a still picture
// until the student taps Test it. After a change it goes back to the still picture with "Changed". A game that ends
// counts as a play test.
export function LivePreview({ p, onPlayed }: { p: GameProject; onPlayed?: (r: 'win' | 'lose') => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const h = useRef<RunHandle | null>(null);
  const [end, setEnd] = useState<'win' | 'lose' | null>(null);
  // 695 (her words: "preview should always be most up to date with exactly what the student has added"): it runs
  // and restarts with every change, so students always see what their inputs did.
  const [running, setRunning] = useState(true);
  const [round, setRound] = useState(0);
  const [sound, setSound] = useState(false);
  const [changed, setChanged] = useState(false);
  const [pp, setPp] = useState(p);
  const played = useRef(onPlayed); played.current = onPlayed;
  const sig = JSON.stringify([p.rules, p.settings, p.design, p.code]);
  const first = useRef(true);
  useEffect(() => {
    const t = window.setTimeout(() => { setPp(p); if (first.current) { first.current = false; return; } setChanged(true); window.setTimeout(() => setChanged(false), 1500); }, 400);
    return () => window.clearTimeout(t);
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (pp.kind === 'custom' || !cv.current) return;
    setEnd(null);
    const handle = runGame(cv.current, pp, { sound: running && sound, onEnd: (r) => { setEnd(r); played.current?.(r); } }); h.current = handle;
    if (!running) { const t = window.setTimeout(() => handle.stop(), 120); return () => { window.clearTimeout(t); handle.stop(); }; }
    return () => handle.stop();
  }, [pp, round, sound, running]);
  const start = () => { setChanged(false); setEnd(null); setRunning(true); setRound((r) => r + 1); window.setTimeout(() => box.current?.focus(), 0); };
  const keyMap: Record<string, string> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: pp.kind === 'platformer' ? 'jump' : 'up', ArrowDown: 'down', ' ': 'jump' };
  const hold = (k: string) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); box.current?.focus(); h.current?.press(k, true); },
    onPointerUp: () => h.current?.press(k, false), onPointerLeave: () => h.current?.press(k, false), onPointerCancel: () => h.current?.press(k, false),
  });
  return (
    <div className="gbp" ref={box} tabIndex={0} aria-label="Live game"
      onKeyDown={(e) => { const k = keyMap[e.key]; if (k && running) { e.preventDefault(); h.current?.press(k, true); } }}
      onKeyUp={(e) => { const k = keyMap[e.key]; if (k) h.current?.press(k, false); }}>
      <div className="gbp-head">
        <b>Live game</b>
        <span className="gbp-grow" />
        {running && pp.kind !== 'custom' && <button type="button" className="gbx-link" onClick={() => setSound((s) => !s)}>{sound ? 'Sound on' : 'Sound off'}</button>}
        {changed && running && <span className="gbp-updated">Updated</span>}
        {running ? <button type="button" className="gbx-link" onClick={() => { setRunning(false); }}>Pause</button> : null}
        <button type="button" className="gbx-link" onClick={start}>Restart</button>
      </div>
      <div className="gbp-stage">
        {pp.kind === 'custom'
          ? (pp.code ? (running ? <iframe key={round} title="Live game" sandbox="allow-scripts" srcDoc={pp.code} className="gbp-frame" /> : null) : <p className="gbp-empty">Your game shows up here after Azalea builds it.</p>)
          : <canvas ref={cv} width={960} height={540} onPointerDown={(e) => { if (!running) return; box.current?.focus(); const c = cv.current; if (!c || !h.current) return; const b = c.getBoundingClientRect(); const k = Math.min(b.width / c.width, b.height / c.height); const ox = (b.width - c.width * k) / 2, oy = (b.height - c.height * k) / 2; h.current.tap((e.clientX - b.left - ox) / k, (e.clientY - b.top - oy) / k); }} />}
        {!running && (pp.kind !== 'custom' || pp.code) && <div className="gbp-end"><b>Paused</b><button type="button" className="gbx-btn gbx-primary gbx-big" onClick={start}>Keep playing</button></div>}
        {running && end && <div className="gbp-end"><b>{end === 'win' ? 'You won!' : 'Game over'}</b><button type="button" className="gbx-btn gbx-primary" onClick={start}>Test it again</button></div>}
      </div>
      {running && pp.kind === 'platformer' && <div className="gbp-pad"><button type="button" {...hold('left')} aria-label="Left">Left</button><button type="button" {...hold('right')} aria-label="Right">Right</button><span className="gbp-grow" /><button type="button" {...hold('jump')}>Jump</button></div>}
      {running && pp.kind === 'maze' && <div className="gbp-pad"><button type="button" {...hold('left')}>Left</button><button type="button" {...hold('up')}>Up</button><button type="button" {...hold('down')}>Down</button><button type="button" {...hold('right')}>Right</button></div>}
    </div>
  );
}
