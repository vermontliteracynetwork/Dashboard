import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';

// Mine Cart Run (her native game list, 2026-09-30: "mine entrance; a Mario-style auto-runner where
// answers choose the track switch"). The cart rolls on its own; tap anywhere (or Space) to hop over
// rocks and grab gems. At every 🔀 track switch the cart stops and a question comes up: a right
// answer flips the switch into the sparkly Gem Cave (no rocks, a stream of gems). Choosing not to
// answer just keeps the cart on the plain track. Hitting a rock is gentle: the cart bumps, slows and
// spills a few gems, there is no game over. Five switches make one run.

const GROUND = 300; // logical units, the canvas is 400 tall
const CART_X = 130;
const GRAV = 1800, JUMP = 720, SPEED = 260;
const SWITCH_EVERY = 3400;

interface Thing { x: number; kind: 'rock' | 'gem' | 'switch'; h?: number; done?: boolean }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; icon: string }
interface Game { dist: number; cy: number; vy: number; things: Thing[]; nextRock: number; nextGem: number; nextSwitch: number; switches: number; cave: number; gems: number; bump: number; waiting: boolean; bits: Bit[]; endAt: number }
const fresh = (): Game => ({ dist: 0, cy: 0, vy: 0, things: [], nextRock: 700, nextGem: 450, nextSwitch: SWITCH_EVERY, switches: 0, cave: 0, gems: 0, bump: 0, waiting: false, bits: [], endAt: 0 });

export default function MineCartRun() {
  const back = useBack();
  const { settings, rounds, ask, element, pay, asking, student } = useAsk('Mine Cart Run', '🛤️', 'mineCart', { rounds: { min: 3, max: 10, def: 5 }, roundsLabel: 'Track switches each ride' });
  const SWITCHES = rounds; // her rounds setting (kids choose; an assignment locks it)
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(fresh());
  const [phase, setPhase] = useState<'intro' | 'run' | 'end'>('intro');
  const [hud, setHud] = useState({ gems: 0, switches: 0, cave: false });
  const [result, setResult] = useState<{ gems: number; best: boolean } | null>(null);
  const live = useRef({ asking, ask, phase });
  live.current = { asking, ask, phase };
  const owner = student ? `minecart:${student.id}` : '';
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as { best?: number; runs?: number; total?: number } | undefined) ?? {};
  const savedRef = useRef(saved);
  savedRef.current = saved;

  const jump = () => {
    const g = game.current;
    if (live.current.phase !== 'run' || g.waiting || live.current.asking || g.cy > 0.5) return;
    g.vy = JUMP; sfx.boing();
  };

  useEffect(() => {
    if (phase !== 'run') return;
    const cv = canvas.current!;
    const ctx = cv.getContext('2d')!;
    const fit = () => { const d = Math.min(window.devicePixelRatio || 1, 2); cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d; };
    fit(); window.addEventListener('resize', fit);
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); } };
    window.addEventListener('keydown', onKey);
    let raf = 0, last = performance.now();
    const shown = { gems: -1, switches: -1, cave: false };
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      const g = game.current;
      const s = cv.height / 400, W = cv.width / s;
      const paused = g.waiting || live.current.asking;
      if (!paused) {
        // Move.
        g.bump = Math.max(0, g.bump - dt);
        g.cave = Math.max(0, g.cave - dt);
        const speed = SPEED * (g.bump > 0 ? 0.5 : 1) * (g.cave > 0 ? 1.15 : 1);
        g.dist += speed * dt;
        g.vy -= GRAV * dt; g.cy = Math.max(0, g.cy + g.vy * dt); if (g.cy === 0) g.vy = Math.max(0, g.vy);
        // Spawn ahead of the screen.
        const ahead = g.dist + W;
        if (g.switches < SWITCHES && g.nextSwitch < ahead) { g.things.push({ x: g.nextSwitch, kind: 'switch' }); g.nextSwitch += SWITCH_EVERY; }
        const nearSwitch = (x: number) => g.things.some((t) => t.kind === 'switch' && !t.done && Math.abs(t.x - x) < 260);
        if (g.nextRock < ahead) {
          if (g.cave <= 0 && !nearSwitch(g.nextRock) && !g.endAt) g.things.push({ x: g.nextRock, kind: 'rock' });
          g.nextRock += 520 + Math.random() * 520;
        }
        if (g.nextGem < ahead) {
          if (g.cave > 0) { g.things.push({ x: g.nextGem, kind: 'gem', h: 30 + Math.abs(Math.sin(g.nextGem / 90)) * 110 }); g.nextGem += 55; }
          else { const high = Math.random() < 0.4; for (let i = 0; i < 3; i++) g.things.push({ x: g.nextGem + i * 46, kind: 'gem', h: high ? 140 : 30 }); g.nextGem += 380 + Math.random() * 300; }
        }
        // Hits.
        const cartBottom = GROUND - g.cy, cartTop = cartBottom - 44;
        for (const t of g.things) {
          if (t.done) continue;
          const sx = t.x - g.dist + CART_X;
          if (t.kind === 'switch' && sx <= CART_X) {
            t.done = true; g.waiting = true; g.vy = 0; g.cy = 0;
            live.current.ask('🔀 Answer to flip the switch into the Gem Cave!', () => {
              g.waiting = false; g.cave = 6; sfx.chime();
              g.things = g.things.filter((o) => o.kind !== 'rock' || o.x > g.dist + 2000);
              g.nextGem = g.dist + 160;
              playCheer();
            }, () => { g.waiting = false; });
            g.switches += 1;
            if (g.switches >= SWITCHES) g.endAt = t.x + 1900;
          } else if (t.kind === 'rock' && Math.abs(sx - CART_X) < 44 && cartBottom > GROUND - 34) {
            t.done = true; g.bump = 1; sfx.thud();
            const lose = Math.min(3, g.gems); g.gems -= lose;
            for (let i = 0; i < lose; i++) g.bits.push({ x: CART_X, y: cartTop, vx: -60 + Math.random() * 160, vy: -260 - Math.random() * 120, life: 1, icon: '💎' });
          } else if (t.kind === 'gem') {
            const gy = GROUND - (t.h ?? 30);
            if (Math.abs(sx - CART_X) < 40 && gy > cartTop - 22 && gy < cartBottom + 10) {
              t.done = true; g.gems += 1; sfx.tick();
              g.bits.push({ x: sx, y: gy, vx: 0, vy: -120, life: 0.6, icon: '✨' });
            }
          }
        }
        g.things = g.things.filter((t) => t.x - g.dist + CART_X > -80 && !(t.done && t.kind !== 'switch'));
        for (const b of g.bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 900 * dt; b.life -= dt; }
        g.bits = g.bits.filter((b) => b.life > 0);
        if (g.endAt && g.dist > g.endAt) {
          const best = g.gems > (savedRef.current.best ?? 0);
          mergeStyleRow(owner, { best: Math.max(g.gems, savedRef.current.best ?? 0), runs: (savedRef.current.runs ?? 0) + 1, total: (savedRef.current.total ?? 0) + g.gems });
          pay(); if (best) playCheer();
          if (student) recordBestGame(student.id, 'mineCart', g.gems, 'in one ride');
          setResult({ gems: g.gems, best }); setPhase('end');
          return;
        }
      }
      // Draw.
      ctx.setTransform(s, 0, 0, s, 0, 0);
      const cave = g.cave > 0;
      const bg = ctx.createLinearGradient(0, 0, 0, 400);
      bg.addColorStop(0, cave ? '#2a0f4a' : '#1d140e'); bg.addColorStop(1, cave ? '#5a2a8a' : '#3b2a1e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, 400);
      // Stalactites and lanterns, slower than the track for depth.
      ctx.fillStyle = cave ? '#3f1d66' : '#2a1d14';
      for (let i = -1; i < W / 120 + 2; i++) {
        const x = i * 120 - ((g.dist * 0.3) % 120);
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 30, 40 + ((i * 37) % 50)); ctx.lineTo(x + 60, 0); ctx.fill();
      }
      for (let i = -1; i < W / 380 + 2; i++) {
        const x = i * 380 - ((g.dist * 0.6) % 380) + 60;
        ctx.fillStyle = 'rgba(255,200,90,0.18)'; ctx.beginPath(); ctx.arc(x, 150, 34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd27a'; ctx.beginPath(); ctx.arc(x, 150, 8, 0, Math.PI * 2); ctx.fill();
      }
      if (cave) for (let i = 0; i < 10; i++) { ctx.font = '18px serif'; ctx.fillText('✨', (i * 97 + g.dist * 0.2) % W, 60 + ((i * 53 + Math.floor(g.dist / 40)) % 200)); }
      // Ground and rails.
      ctx.fillStyle = cave ? '#3a1f5c' : '#4a3424'; ctx.fillRect(0, GROUND + 14, W, 400 - GROUND);
      ctx.fillStyle = '#7a5a3a';
      for (let x = -((g.dist) % 34); x < W; x += 34) ctx.fillRect(x, GROUND + 4, 14, 12);
      ctx.fillStyle = '#b8bcc6'; ctx.fillRect(0, GROUND, W, 5);
      // Things.
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const t of g.things) {
        const sx = t.x - g.dist + CART_X;
        if (t.kind === 'rock') {
          ctx.fillStyle = '#6d6a72'; ctx.beginPath(); ctx.moveTo(sx - 22, GROUND); ctx.lineTo(sx - 14, GROUND - 26); ctx.lineTo(sx + 4, GROUND - 34); ctx.lineTo(sx + 20, GROUND - 18); ctx.lineTo(sx + 22, GROUND); ctx.fill();
          ctx.fillStyle = '#8b8892'; ctx.beginPath(); ctx.moveTo(sx - 12, GROUND - 22); ctx.lineTo(sx + 2, GROUND - 30); ctx.lineTo(sx + 8, GROUND - 20); ctx.fill();
        } else if (t.kind === 'gem') {
          ctx.font = '28px serif'; ctx.fillText('💎', sx, GROUND - (t.h ?? 30));
        } else {
          ctx.fillStyle = '#8a6a3a'; ctx.fillRect(sx - 4, GROUND - 110, 8, 110);
          ctx.fillStyle = t.done ? '#2fa36b' : '#ffd23f'; ctx.fillRect(sx - 34, GROUND - 140, 68, 40);
          ctx.font = '26px serif'; ctx.fillText('🔀', sx, GROUND - 120);
        }
      }
      // Cart.
      const cy = GROUND - g.cy;
      const flash = g.bump > 0 && Math.floor(g.bump * 10) % 2 === 0;
      ctx.globalAlpha = flash ? 0.45 : 1;
      ctx.font = '34px serif'; ctx.fillText('👷', CART_X, cy - 58);
      ctx.fillStyle = '#6b6f7a'; ctx.strokeStyle = '#3a3d45'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(CART_X - 36, cy - 44); ctx.lineTo(CART_X + 36, cy - 44); ctx.lineTo(CART_X + 28, cy - 12); ctx.lineTo(CART_X - 28, cy - 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (g.gems > 0) { ctx.font = '16px serif'; ctx.fillText('💎', CART_X - 14, cy - 48); if (g.gems > 3) ctx.fillText('💎', CART_X + 10, cy - 50); }
      const spin = g.dist / 12;
      for (const wx of [CART_X - 20, CART_X + 20]) {
        ctx.fillStyle = '#2b2d33'; ctx.beginPath(); ctx.arc(wx, cy - 8, 9, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#b8bcc6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(wx + Math.cos(spin) * 7, cy - 8 + Math.sin(spin) * 7); ctx.lineTo(wx - Math.cos(spin) * 7, cy - 8 - Math.sin(spin) * 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const b of g.bits) { ctx.globalAlpha = Math.max(0, Math.min(1, b.life * 2)); ctx.font = '22px serif'; ctx.fillText(b.icon, b.x, b.y); }
      ctx.globalAlpha = 1;
      if (shown.gems !== g.gems || shown.switches !== g.switches || shown.cave !== cave) {
        shown.gems = g.gems; shown.switches = g.switches; shown.cave = cave;
        setHud({ gems: g.gems, switches: g.switches, cave });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', fit); window.removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!student) return null;
  const start = () => { game.current = fresh(); setResult(null); setHud({ gems: 0, switches: 0, cave: false }); setPhase('run'); };

  return (
    <div className="mc" onPointerDown={(e) => { if (!(e.target as HTMLElement).closest('button, .pf-overlay')) jump(); }}>
      <canvas ref={canvas} className="mc-canvas" aria-label="Mine cart track. Tap to jump." />
      <header className="fd-head mc-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} note="Your best rides are saved. This ride stops here, and your right answers are paid." />
        <h1>🛤️ Mine Cart Run</h1>
        <SfxToggle />
        {settings}
        <MyBest game="mineCart" unit="gems" />
        <span className="mc-hud" aria-live="polite">💎 {hud.gems} · 🔀 {hud.switches} / {SWITCHES}{hud.cave ? ' · ✨ Gem Cave!' : ''}</span>
      </header>
      {phase === 'run' && <button type="button" className="btn btn-primary btn-lg mc-jump" onClick={jump} aria-label="Jump">⬆️ Jump</button>}
      {phase === 'intro' && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🛤️</div>
            <h2>All aboard the mine cart!</h2>
            <p>Tap anywhere to hop over rocks and grab 💎 gems. At every 🔀 switch, answer a question to send your cart into the sparkly Gem Cave!</p>
            <p>Best run: 💎 {saved.best ?? 0}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>🚀 Start the ride</button>
          </div>
        </div>
      )}
      {phase === 'end' && result && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            {result.best && <span className="fd-new">🏆 New best run!</span>}
            <div className="fd-fish" aria-hidden>💎</div>
            <h2>End of the line!</h2>
            <p>You collected <b>{result.gems}</b> gems this ride. Best run: 💎 {Math.max(result.gems, saved.best ?? 0)}.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>🛤️ Ride again</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
