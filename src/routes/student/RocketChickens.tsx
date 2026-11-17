import { useEffect, useMemo, useRef, useState } from 'react';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';
import { MenuItems } from '../../lib/mainMenu';
import GameStartCard from '../../components/GameStartCard';
import { useStore } from '../../store/store';

// Rocket Chickens (Build Queue 642, 2026-11-17, her spec): launch a chicken from a farm cannon. Tap to aim, tap again
// to fire. In the air, tap above the chicken for a rocket boost up, below it to dive (rockets use fuel). Farther,
// higher and faster flights and broken crates and stone towers earn coins for upgrades (cannons, launch power, fuel
// tank, rocket power, helmet, chickens). Launch shows the speed in MPH; the flight shows distance in feet and
// altitude. Each round ends when the chicken stops, with a round report (Distance, Altitude, Speed, Destruction, each
// with its coins, and a Total) and a shop button. A day is the number of rounds the student picks (default 5), with
// questions before each launch (default 1). Settings: a Graphics meter (Low, Medium, High) and a Save button.
// Inspired lightly by gamedev-ariel/angrybirds (aim, launch, break the towers). Art: her Chicken Game Assets,
// the Breakable Physics Wall blocks and the rural parallax layers (public/games/rocket-chickens/).
// Nothing gets hurt: crates and stones break, the chicken bounces and is always fine.

const A = '/games/rocket-chickens/';
const G = 32; // gravity, feet per second squared
const DRAG = 0.00032;
const BLOCK = 5; // feet
const R = 2.4; // chicken radius, feet
const MPH = 0.6818;

type Gfx = 'low' | 'medium' | 'high';
type UpId = 'power' | 'fuel' | 'rocket' | 'helmet';
const UPS: { id: UpId; name: string; how: string; base: number; max: number }[] = [
  { id: 'power', name: 'Launch Power', how: 'Every level fires the chicken 6% faster.', base: 40, max: 10 },
  { id: 'fuel', name: 'Fuel Tank', how: 'Every level adds one more rocket boost.', base: 50, max: 10 },
  { id: 'rocket', name: 'Rocket Power', how: 'Every level makes each boost 12% stronger.', base: 60, max: 10 },
  { id: 'helmet', name: 'Crash Helmet', how: 'Every level breaks through blocks 15% easier.', base: 50, max: 8 },
];
const CANNONS: { id: string; name: string; mult: number; cost: number; color: string }[] = [
  { id: 'farm', name: 'Farm Cannon', mult: 1, cost: 0, color: '#6b4a2b' },
  { id: 'iron', name: 'Iron Cannon', mult: 1.25, cost: 300, color: '#5b6573' },
  { id: 'gold', name: 'Golden Cannon', mult: 1.5, cost: 900, color: '#d4a017' },
  { id: 'mega', name: 'Mega Cannon', mult: 1.85, cost: 2500, color: '#b0322a' },
  { id: 'space', name: 'Space Cannon', mult: 2.3, cost: 6000, color: '#3a4fb0' },
];
const CHICKENS: { id: string; name: string; cost: number }[] = [
  { id: 'rooster', name: 'Rooster', cost: 0 }, { id: 'brown-hen', name: 'Brown Hen', cost: 100 },
  { id: 'hen', name: 'Big Hen', cost: 150 }, { id: 'chick', name: 'Chick', cost: 200 }, { id: 'chick2', name: 'Baby Chick', cost: 250 },
];
const upCost = (id: UpId, lvl: number) => Math.round(UPS.find((u) => u.id === id)!.base * 1.55 ** lvl);

interface Save { coins: number; day: number; round: number; up: Record<UpId, number>; cannons: string[]; cannon: string; chickens: string[]; chicken: string; best: number; gfx: Gfx; at: string }
const fresh = (): Save => ({ coins: 0, day: 1, round: 1, up: { power: 0, fuel: 0, rocket: 0, helmet: 0 }, cannons: ['farm'], cannon: 'farm', chickens: ['rooster'], chicken: 'rooster', best: 0, gfx: 'medium', at: '' });

interface Block { x: number; col: number; row: number; y: number; mat: 'crate' | 'stone' | 'target'; hp: number; alive: boolean }
interface Bit { x: number; y: number; vx: number; vy: number; life: number; color: string; s: number }
interface Report { round: number; day: number; dist: number; alt: number; mph: number; broke: number; targets: number; coins: { dist: number; alt: number; mph: number; broke: number }; total: number; dayEnd: boolean }

function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function makeWorld(seed: number): Block[] {
  const r = rng(seed); const out: Block[] = [];
  let x = 110 + r() * 60;
  while (x < 6000) {
    const cols = 1 + Math.floor(r() * 3); const far = Math.min(1, x / 2500);
    for (let c = 0; c < cols; c++) {
      const h = 1 + Math.floor(r() * (2 + far * 4));
      for (let row = 0; row < h; row++) {
        const mat = r() < 0.25 + far * 0.45 ? 'stone' : 'crate';
        out.push({ x: x + c * BLOCK, col: Math.round(x / BLOCK) + c, row, y: row * BLOCK, mat, hp: mat === 'stone' ? 3 : 1, alive: true });
      }
      if (r() < 0.35) out.push({ x: x + c * BLOCK, col: Math.round(x / BLOCK) + c, row: h, y: h * BLOCK, mat: 'target', hp: 1, alive: true });
    }
    x += 120 + r() * 170 + far * 120;
  }
  return out;
}

const imgs: Record<string, HTMLImageElement> = {};
const img = (n: string) => { if (!imgs[n]) { const i = new Image(); i.src = `${A}${n}.webp`; imgs[n] = i; } return imgs[n]; };
const ready = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
const LAYERS: { n: string; f: number }[] = [{ n: 'sky', f: 0.01 }, { n: 'clouds', f: 0.04 }, { n: 'hills-far', f: 0.08 }, { n: 'mountain', f: 0.16 }, { n: 'village', f: 0.32 }];

export default function RocketChickens() {
  const back = useBack();
  const { ask, element, pay, student, asking, settingsPanel, rounds } = useAsk('Rocket Chickens', '🐔', 'rocketChickens', { startCard: false, rounds: { min: 1, max: 10, def: 5 }, roundsLabel: 'Rounds each day', perLabel: 'Questions each round' });
  const studentId = student?.id ?? '';
  const owner = studentId ? `rocketchickens:${studentId}` : '';
  const localKey = `rocketchickens:${studentId}`;
  const serverSave = useStore((s) => s.styleLooks.find((r) => r.ownerId === owner)?.look as Save | undefined);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const calm = !!student?.worldReduceMotion;

  const [S, setS] = useState<Save>(() => {
    try { const v = JSON.parse(localStorage.getItem(localKey) ?? 'null') as Save | null; if (v && typeof v.coins === 'number') return { ...fresh(), ...v }; } catch { /* fresh */ }
    return fresh();
  });
  const sRef = useRef(S); sRef.current = S;
  const put = (p: Partial<Save>) => { const n = { ...sRef.current, ...p }; sRef.current = n; setS(n); try { localStorage.setItem(localKey, JSON.stringify(n)); } catch { /* fine */ } };
  // A newer save on the class server (another iPad) wins once, when the game opens.
  const loadedServer = useRef(false);
  useEffect(() => {
    if (loadedServer.current || !serverSave?.at) return;
    loadedServer.current = true;
    if (!S.at || serverSave.at > S.at) put({ ...fresh(), ...serverSave });
  });
  const [savedMsg, setSavedMsg] = useState('');
  const saveNow = () => {
    const n = { ...sRef.current, at: new Date().toISOString() }; put(n);
    if (owner) mergeStyleRow(owner, n as unknown as Record<string, unknown>);
    sfx.chime(); setSavedMsg('Saved!'); window.setTimeout(() => setSavedMsg(''), 1800);
  };

  const [started, setStarted] = useState(false);
  const [phase, setPhase] = useState<'ready' | 'aim' | 'fly' | 'report'>('ready');
  const [hud, setHud] = useState({ mph: 0, dist: 0, alt: 0, fuel: 0 });
  const [launchMsg, setLaunchMsg] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [shop, setShop] = useState(false);
  const [gear, setGear] = useState(false);
  const [help, setHelp] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = useRef({
    blocks: [] as Block[], bits: [] as Bit[], x: 0, y: 4, vx: 0, vy: 0, aim: 0.75, aimed: false, flying: false, rest: 0,
    fuel: 0, boost: 0, boostDir: 1, maxAlt: 0, maxMph: 0, broke: 0, targets: 0, scale: 8, camX: -20, groundY: 0, shake: 0, landed: false, t: 0,
  });

  const cannon = CANNONS.find((c) => c.id === S.cannon) ?? CANNONS[0];
  const launchSpeed = () => 95 * cannon.mult * (1 + 0.06 * S.up.power);
  const fuelMax = 3 + S.up.fuel;

  const newRound = () => {
    const w = W.current;
    w.blocks = makeWorld((sRef.current.day * 97 + sRef.current.round * 13 + 7) | 0); w.bits = [];
    Object.assign(w, { x: 0, y: 4, vx: 0, vy: 0, aimed: false, flying: false, rest: 0, fuel: fuelMax, boost: 0, maxAlt: 0, maxMph: 0, broke: 0, targets: 0, landed: false });
    setHud({ mph: 0, dist: 0, alt: 0, fuel: fuelMax }); setLaunchMsg('');
  };
  const loadCannon = () => {
    newRound(); setPhase('ready'); setReport(null);
    ask(`Rocket Chickens: answer to load the cannon (round ${sRef.current.round} of ${rounds})`, () => { setPhase('aim'); sfx.pop(); }, () => setPhase('ready'));
  };

  const fire = () => {
    const w = W.current; const v = launchSpeed();
    w.vx = Math.cos(w.aim) * v; w.vy = Math.sin(w.aim) * v; w.x = Math.cos(w.aim) * 7; w.y = 4 + Math.sin(w.aim) * 7;
    w.flying = true; w.shake = calm ? 0 : 8;
    sfx.thud(); sfx.whoosh();
    setLaunchMsg(`Launched at ${Math.round(v * MPH)} MPH!`); window.setTimeout(() => setLaunchMsg(''), 2600);
    setPhase('fly');
  };
  const boost = (up: boolean) => {
    const w = W.current; if (w.fuel <= 0 || w.landed) { sfx.click(); return; }
    w.fuel -= 1; w.boost = 0.45; w.boostDir = up ? 1 : -1; sfx.whoosh();
    setHud((h) => ({ ...h, fuel: w.fuel }));
  };

  const endRound = () => {
    const w = W.current; const s = sRef.current;
    const dist = Math.max(0, Math.round(w.x)), alt = Math.round(w.maxAlt), mph = Math.round(w.maxMph * MPH);
    const coins = { dist: Math.round(dist / 8), alt: Math.round(alt / 6), mph: Math.round(mph / 3), broke: w.broke * 4 + w.targets * 15 };
    const total = coins.dist + coins.alt + coins.mph + coins.broke;
    const dayEnd = s.round >= rounds;
    if (dist > s.best && studentId) recordBestGame(studentId, 'rocketChickens', dist, `${alt} ft high, ${mph} MPH`);
    put({ coins: s.coins + total, best: Math.max(s.best, dist), round: dayEnd ? 1 : s.round + 1, day: dayEnd ? s.day + 1 : s.day });
    setReport({ round: s.round, day: s.day, dist, alt, mph, broke: w.broke + w.targets, targets: w.targets, coins, total, dayEnd });
    setPhase('report'); sfx.coin();
  };
  const endRef = useRef(endRound); endRef.current = endRound;

  // The game loop: physics in feet, drawn on a canvas.
  const gfx = S.gfx;
  useEffect(() => {
    if (!started) return;
    const cv = canvasRef.current; if (!cv) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    LAYERS.forEach((l) => img(l.n)); CHICKENS.forEach((c) => img(c.id)); ['crate', 'stone', 'target', 'earth'].forEach(img);
    let raf = 0; let last = performance.now(); let hudT = 0;
    const dpr = gfx === 'low' ? 1 : gfx === 'medium' ? Math.min(1.5, window.devicePixelRatio || 1) : Math.min(2, window.devicePixelRatio || 1);
    const size = () => { const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); };
    size(); window.addEventListener('resize', size);
    const helmet = 1 + 0.15 * sRef.current.up.helmet; const thrust = 70 * (1 + 0.12 * sRef.current.up.rocket);

    const step = (dt: number) => {
      const w = W.current; if (!w.flying) return;
      w.t += dt;
      let ax = 0, ay = -G;
      if (w.boost > 0) { w.boost -= dt; ax += thrust * 0.45; ay += thrust * w.boostDir * (w.boostDir > 0 ? 1.3 : 1); if (gfx !== 'low' && Math.random() < 0.6) w.bits.push({ x: w.x - 1.5, y: w.y, vx: w.vx * 0.3 - 20, vy: (Math.random() - 0.5) * 10, life: 0.4, color: Math.random() < 0.5 ? '#ffb22e' : '#ff6a1f', s: 0.9 }); }
      const sp = Math.hypot(w.vx, w.vy);
      ax -= DRAG * sp * w.vx; ay -= DRAG * sp * w.vy;
      w.vx += ax * dt; w.vy += ay * dt; w.x += w.vx * dt; w.y += w.vy * dt;
      // blocks
      for (const b of w.blocks) {
        if (!b.alive || Math.abs(b.x + BLOCK / 2 - w.x) > BLOCK + R) continue;
        const cx = Math.max(b.x, Math.min(w.x, b.x + BLOCK)), cy = Math.max(b.y, Math.min(w.y, b.y + BLOCK));
        const dx = w.x - cx, dy = w.y - cy, d = Math.hypot(dx, dy);
        if (d >= R) continue;
        const speed = Math.hypot(w.vx, w.vy);
        if (b.mat === 'target' || speed * helmet > b.hp * 32) {
          b.alive = false; if (b.mat === 'target') { w.targets += 1; sfx.coin(); } else { w.broke += 1; sfx.bonk(); }
          const keep = b.mat === 'target' ? 0.97 : Math.max(0.5, 1 - b.hp * 0.13); w.vx *= keep; w.vy *= keep;
          if (gfx !== 'low') for (let i = 0; i < (gfx === 'high' ? 14 : 6); i++) w.bits.push({ x: b.x + BLOCK / 2, y: b.y + BLOCK / 2, vx: (Math.random() - 0.3) * 40, vy: Math.random() * 40, life: 1.2, color: b.mat === 'stone' ? '#8fa3a8' : b.mat === 'target' ? '#ffd23f' : '#b97a3c', s: 0.7 + Math.random() });
          w.shake = calm ? 0 : Math.max(w.shake, b.mat === 'stone' ? 6 : 3);
        } else {
          const nx = d > 0.001 ? dx / d : -1, ny = d > 0.001 ? dy / d : 0;
          w.x = cx + nx * R; w.y = cy + ny * R;
          const vn = w.vx * nx + w.vy * ny;
          if (vn < 0) { w.vx -= 1.4 * vn * nx; w.vy -= 1.4 * vn * ny; w.vx *= 0.7; w.vy *= 0.7; sfx.thud(); }
        }
      }
      // blocks above a broken one drop down
      for (const b of w.blocks) {
        if (!b.alive) continue;
        const below = w.blocks.filter((o) => o.alive && o.col === b.col && o.row < b.row).length;
        const target = below * BLOCK;
        if (b.y > target) b.y = Math.max(target, b.y - 40 * dt);
      }
      // ground
      if (w.y < R) {
        w.y = R;
        if (w.vy < 0) { if (w.vy < -25) { sfx.thud(); w.shake = calm ? 0 : 3; } w.vy = -w.vy * 0.42; w.vx *= 0.72; if (w.vy < 4) w.vy = 0; }
        w.vx *= 1 - 1.6 * dt;
        w.landed = Math.abs(w.vy) < 1;
      } else w.landed = false;
      w.maxAlt = Math.max(w.maxAlt, w.y - R); w.maxMph = Math.max(w.maxMph, Math.hypot(w.vx, w.vy));
      if (Math.hypot(w.vx, w.vy) < 5 && w.y < R + 0.5) { w.rest += dt; if (w.rest > 0.7) { w.flying = false; window.setTimeout(() => endRef.current(), 500); } } else w.rest = 0;
      if (w.t > 120) { w.flying = false; endRef.current(); }
      for (const p of w.bits) { p.vy -= G * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y < 0) { p.y = 0; p.vy *= -0.3; p.vx *= 0.6; } p.life -= dt; }
      w.bits = w.bits.filter((p) => p.life > 0);
    };

    const draw = () => {
      const w = W.current; const Wd = cv.width, Hd = cv.height;
      const base = Hd / 70;
      const want = w.y + 12 > 70 * 0.62 ? Math.max(base / 10, (Hd * 0.62) / (w.y + 12)) : base;
      w.scale += (want - w.scale) * 0.08;
      const sc = w.scale; const camX = (w.flying || w.x > 0) ? w.x - (Wd * 0.33) / sc : -14;
      w.camX = camX;
      const shake = w.shake > 0 ? (Math.random() - 0.5) * w.shake * dpr : 0; w.shake = Math.max(0, w.shake - 0.6);
      const gy = Hd * 0.86 + shake; w.groundY = gy;
      const X = (x: number) => (x - camX) * sc, Y = (y: number) => gy - y * sc;
      // sky
      const g = ctx.createLinearGradient(0, 0, 0, gy);
      g.addColorStop(0, w.y > 400 ? '#1d2a6b' : '#5b8fe0'); g.addColorStop(1, '#bfe3ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, Wd, Hd);
      if (gfx !== 'low') {
        const lh = Hd * 1.05; const lw = lh * (1900 / 600);
        const zoom = sc / base;
        for (const l of LAYERS) {
          const im = img(l.n); if (!ready(im)) continue;
          const off = ((camX * base * l.f) % lw + lw) % lw;
          const top = gy - lh * 0.73 + (1 - zoom) * lh * 0.25 * l.f * 3;
          for (let x = -off; x < Wd; x += lw) ctx.drawImage(im, x, top, lw, lh);
        }
      }
      // ground
      ctx.fillStyle = '#7cc04a'; ctx.fillRect(0, gy, Wd, Hd - gy);
      ctx.fillStyle = '#9b6a3a'; ctx.fillRect(0, gy + 10 * dpr, Wd, Hd - gy);
      const earth = img('earth');
      if (gfx === 'high' && ready(earth)) { const t = 40 * dpr; const o = ((camX * sc) % t + t) % t; for (let x = -o; x < Wd; x += t) for (let y = gy + 10 * dpr; y < Hd; y += t) ctx.drawImage(earth, 0, 40, 128, 88, x, y, t, t); }
      // distance signs every 100 feet
      ctx.font = `${Math.round(13 * dpr)}px system-ui, sans-serif`; ctx.textAlign = 'center';
      const step100 = sc * 100 < 60 * dpr ? 500 : 100;
      for (let f = Math.ceil(camX / step100) * step100; X(f) < Wd; f += step100) {
        if (f <= 0) continue;
        ctx.fillStyle = '#6b4a2b'; ctx.fillRect(X(f) - 2 * dpr, gy - 26 * dpr, 4 * dpr, 26 * dpr);
        ctx.fillStyle = '#fff8e0'; ctx.fillRect(X(f) - 26 * dpr, gy - 40 * dpr, 52 * dpr, 18 * dpr);
        ctx.fillStyle = '#3a2a1a'; ctx.fillText(`${f} ft`, X(f), gy - 26 * dpr);
      }
      // best distance flag
      const best = sRef.current.best;
      if (best > 0 && X(best) > 0 && X(best) < Wd) { ctx.fillStyle = '#d6336c'; ctx.fillRect(X(best), gy - 50 * dpr, 3 * dpr, 50 * dpr); ctx.fillText('My best', X(best) + 30 * dpr, gy - 52 * dpr); }
      // blocks
      for (const b of w.blocks) {
        if (!b.alive || X(b.x + BLOCK) < 0 || X(b.x) > Wd) continue;
        const im = img(b.mat); const s = BLOCK * sc;
        if (ready(im)) { if (b.mat === 'stone') ctx.drawImage(im, 0, 0, 128, 128, X(b.x), Y(b.y + BLOCK), s, s); else ctx.drawImage(im, X(b.x), Y(b.y + BLOCK), s, s); }
        else { ctx.fillStyle = b.mat === 'stone' ? '#8fa3a8' : '#b97a3c'; ctx.fillRect(X(b.x), Y(b.y + BLOCK), s, s); }
      }
      // cannon
      const cx = X(0), cy = Y(4); const cs = sc;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-w.aim);
      ctx.fillStyle = cannon.color; ctx.strokeStyle = '#2b1d10'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.roundRect(-2 * cs, -2.2 * cs, 10 * cs, 4.4 * cs, 1.4 * cs); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b1d10'; ctx.fillRect(7.4 * cs, -2.6 * cs, 1.4 * cs, 5.2 * cs);
      ctx.restore();
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(cx - 1 * cs, Y(1.8), 1.8 * cs, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(cx + 2.5 * cs, Y(1.8), 1.8 * cs, 0, Math.PI * 2); ctx.fill();
      // aim preview
      if (!w.flying && w.x === 0 && phaseRef.current === 'aim') {
        const v = launchSpeedRef.current(); let px = Math.cos(w.aim) * 7, py = 4 + Math.sin(w.aim) * 7, vx = Math.cos(w.aim) * v, vy = Math.sin(w.aim) * v;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        for (let i = 0; i < 60 && py > 0; i++) { for (let k = 0; k < 4; k++) { const sp = Math.hypot(vx, vy); vx -= DRAG * sp * vx * 0.02; vy += (-G - DRAG * sp * vy) * 0.02; px += vx * 0.02; py += vy * 0.02; } if (i % 2 === 0) { ctx.beginPath(); ctx.arc(X(px), Y(py), 3 * dpr, 0, Math.PI * 2); ctx.fill(); } }
      }
      // particles
      for (const p of w.bits) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillStyle = p.color; ctx.fillRect(X(p.x), Y(p.y), p.s * sc, p.s * sc); }
      ctx.globalAlpha = 1;
      // chicken (with its rocket pack)
      if (w.flying || w.x > 0) {
        const ch = img(sRef.current.chicken); const hs = R * 2.6 * sc;
        ctx.save(); ctx.translate(X(w.x), Y(w.y));
        const ang = w.landed ? 0 : Math.atan2(w.vy, Math.max(1, w.vx)) * 0.5; ctx.rotate(-ang);
        ctx.fillStyle = '#c0c6cf'; ctx.strokeStyle = '#3a3f48'; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.roundRect(-hs * 0.62, -hs * 0.18, hs * 0.3, hs * 0.5, hs * 0.08); ctx.fill(); ctx.stroke();
        if (w.boost > 0) { ctx.fillStyle = Math.random() < 0.5 ? '#ffb22e' : '#ff6a1f'; ctx.beginPath(); ctx.moveTo(-hs * 0.6, hs * 0.32); ctx.lineTo(-hs * 0.47, hs * (0.32 + 0.35 + Math.random() * 0.2)); ctx.lineTo(-hs * 0.34, hs * 0.32); ctx.fill(); }
        if (ready(ch)) { const ar = ch.naturalWidth / ch.naturalHeight; ctx.drawImage(ch, -hs * ar / 2, -hs / 2, hs * ar, hs); } else { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, R * sc, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
      } else {
        const ch = img(sRef.current.chicken); const hs = R * 2.2 * sc;
        if (ready(ch)) { const ar = ch.naturalWidth / ch.naturalHeight; ctx.drawImage(ch, X(-6) - hs * ar / 2, Y(0) - hs, hs * ar, hs); }
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const sub = 6; for (let i = 0; i < sub; i++) step(dt / sub);
      draw();
      hudT += dt;
      if (hudT > 0.1) { hudT = 0; const w = W.current; if (w.flying) setHud({ mph: Math.round(Math.hypot(w.vx, w.vy) * MPH), dist: Math.max(0, Math.round(w.x)), alt: Math.max(0, Math.round(w.y - R)), fuel: w.fuel }); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, [started, gfx, calm, cannon.color]);

  const phaseRef = useRef(phase); phaseRef.current = phase;
  const launchSpeedRef = useRef(launchSpeed); launchSpeedRef.current = launchSpeed;
  const aimAt = useRef<{ x: number; y: number } | null>(null);

  const onTap = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = canvasRef.current; if (!cv) return;
    const r = cv.getBoundingClientRect(); const k = cv.width / r.width;
    const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    const w = W.current;
    if (phase === 'aim') {
      // Tap to aim; tap again near the same spot to fire.
      const near = aimAt.current && Math.hypot(e.clientX - aimAt.current.x, e.clientY - aimAt.current.y) < 70;
      if (near && w.aimed) { aimAt.current = null; fire(); return; }
      const wx = px / w.scale + w.camX, wy = (w.groundY - py) / w.scale;
      w.aim = Math.max(0.08, Math.min(1.45, Math.atan2(wy - 4, Math.max(0.5, wx))));
      w.aimed = true; aimAt.current = { x: e.clientX, y: e.clientY }; sfx.tick();
      return;
    }
    if (phase === 'fly') {
      const chY = w.groundY - w.y * w.scale;
      boost(py < chY);
    }
  };

  const buy = (kind: 'up' | 'cannon' | 'chicken', id: string) => {
    const s = sRef.current;
    if (kind === 'up') { const u = id as UpId; const lvl = s.up[u]; const c = upCost(u, lvl); if (lvl >= UPS.find((x) => x.id === u)!.max || s.coins < c) return; put({ coins: s.coins - c, up: { ...s.up, [u]: lvl + 1 } }); sfx.coin(); return; }
    if (kind === 'cannon') { if (s.cannons.includes(id)) { put({ cannon: id }); sfx.click(); return; } const c = CANNONS.find((x) => x.id === id)!; if (s.coins < c.cost) return; put({ coins: s.coins - c.cost, cannons: [...s.cannons, id], cannon: id }); sfx.coin(); return; }
    if (s.chickens.includes(id)) { put({ chicken: id }); sfx.click(); return; }
    const c = CHICKENS.find((x) => x.id === id)!; if (s.coins < c.cost) return; put({ coins: s.coins - c.cost, chickens: [...s.chickens, id], chicken: id }); sfx.coin();
  };
  const canAfford = useMemo(() => UPS.some((u) => S.up[u.id] < u.max && S.coins >= upCost(u.id, S.up[u.id])) || CANNONS.some((c) => !S.cannons.includes(c.id) && S.coins >= c.cost), [S]);

  const reportWords = (r: Report) => `${r.dayEnd ? `End of day ${r.day}.` : `Round ${r.round} report.`} Distance ${r.dist} feet, ${r.coins.dist} coins. Altitude ${r.alt} feet, ${r.coins.alt} coins. Speed ${r.mph} miles per hour, ${r.coins.mph} coins. Destruction ${r.broke} blocks, ${r.coins.broke} coins. Total ${r.total} coins.`;
  const menu = useMemo(() => [{ id: 'rc-help', icon: '❓', label: 'How to play', bg: '#3a4fb0', order: 5, onSelect: () => setHelp(true) }], []);
  const howTo = 'Answer a question to load the cannon. Tap the sky to aim: the white dots show where the chicken will fly. Tap the same spot again to fire. In the air, tap above the chicken for a rocket boost up, or below it to dive. Boosts use fuel. Fly far, fly high, go fast and break crates and stones to earn coins, then spend them in the shop.';

  if (!student) return null;
  const leave = () => { pay(); back.go(); };

  return (
    <div className="rc">
      <MenuItems items={menu} />
      <header className="fd-head rc-head">
        <LeaveButton onLeave={leave} note="Your coins and upgrades are kept on this iPad (tap Save to keep them everywhere), and your right answers are paid." />
        <strong className="rc-title">Rocket Chickens</strong>
        <span className="rc-pill">Day {S.day} · Round {S.round} of {rounds}</span>
        <span className="rc-pill rc-coins"><i className="rc-coin" aria-hidden />{S.coins.toLocaleString()} coins</span>
        <SfxToggle />
        <button type="button" className="btn" onClick={() => setShop(true)}>Shop{canAfford ? <span className="rc-bang" aria-label="You can buy something">!</span> : null}</button>
        <button type="button" className="btn game-settings-btn" onClick={() => setGear(true)} aria-label="Settings">⚙️</button>
        <MyBest game="rocketChickens" unit="feet" />
      </header>
      <div className="rc-stage">
        <canvas ref={canvasRef} className="rc-canvas" onPointerDown={onTap} aria-label="Rocket Chickens launch field" />
        {phase === 'fly' && (
          <div className="rc-hud" aria-live="off">
            <span><small>Speed</small><b>{hud.mph}</b> MPH</span>
            <span><small>Distance</small><b>{hud.dist.toLocaleString()}</b> ft</span>
            <span><small>Altitude</small><b>{hud.alt.toLocaleString()}</b> ft</span>
            <span><small>Fuel</small><b className="rc-fuel">{Array.from({ length: fuelMax }, (_, i) => <i key={i} className={i < hud.fuel ? 'on' : ''} />)}</b></span>
          </div>
        )}
        {launchMsg && <div className="rc-launch" role="status">{launchMsg}</div>}
        {phase === 'aim' && <div className="rc-tip">{W.current.aimed ? 'Tap the same spot again to FIRE, or tap somewhere else to aim again.' : 'Tap the sky to aim the cannon.'}</div>}
        {phase === 'fly' && hud.fuel > 0 && <div className="rc-tip small">Tap above the chicken to boost up, below to dive.</div>}
        {phase === 'ready' && started && !asking && (
          <div className="rc-center"><button type="button" className="btn btn-primary btn-lg" onClick={loadCannon}>Load the cannon</button></div>
        )}
      </div>

      {report && phase === 'report' && (
        <div className="rc-report-wrap">
          <div className="rc-report" role="dialog" aria-label="Round report">
            <div className="rc-row dist"><span>Distance</span><b>{report.dist.toLocaleString()} ft</b><em>{report.coins.dist}</em></div>
            <div className="rc-row alt"><span>Altitude</span><b>{report.alt.toLocaleString()} ft</b><em>{report.coins.alt}</em></div>
            <div className="rc-row spd"><span>Speed</span><b>{report.mph} MPH</b><em>{report.coins.mph}</em></div>
            <div className="rc-row dst"><span>Destruction</span><b>{report.broke}</b><em>{report.coins.broke}</em></div>
            <div className="rc-row last"><span className="rc-day">{report.dayEnd ? `End of Day ${report.day}` : `Round ${report.round} of ${rounds}`}</span><span className="rc-total">Total <i className="rc-coin" aria-hidden />{report.total}</span></div>
            <button type="button" className="btn rc-say" onClick={() => speak(reportWords(report), student.ttsSettings)} aria-label="Read the report aloud">🔊</button>
          </div>
          <div className="rc-report-btns">
            <button type="button" className="rc-big shop" onClick={() => setShop(true)} aria-label="Shop">
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><path d="M6 12h8l8 30h28l6-22H18" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" /><circle cx="26" cy="52" r="4" fill="#fff" /><circle cx="46" cy="52" r="4" fill="#fff" /></svg>
              {canAfford && <span className="rc-bang big" aria-hidden>!</span>}
            </button>
            <button type="button" className="rc-big play" onClick={loadCannon} aria-label="Play the next round">
              <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden><path d="M20 10l34 22-34 22z" fill="#2a8fd6" stroke="#fff" strokeWidth="5" strokeLinejoin="round" /></svg>
            </button>
          </div>
        </div>
      )}

      {shop && (
        <div className="pf-overlay" onClick={() => setShop(false)}>
          <div className="pf-panel rc-shop" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Shop">
            <h2 style={{ marginTop: 0 }}>Shop <span className="rc-pill rc-coins"><i className="rc-coin" aria-hidden />{S.coins.toLocaleString()} coins</span></h2>
            <h3>Upgrades</h3>
            <div className="rc-shop-grid">
              {UPS.map((u) => { const lvl = S.up[u.id]; const maxed = lvl >= u.max; const c = upCost(u.id, lvl); return (
                <button key={u.id} type="button" className="rc-item" disabled={maxed || S.coins < c} onClick={() => buy('up', u.id)}>
                  <b>{u.name}</b><small>{u.how}</small>
                  <span className="rc-lvl">{Array.from({ length: u.max }, (_, i) => <i key={i} className={i < lvl ? 'on' : ''} />)}</span>
                  <span className="rc-cost">{maxed ? 'Maxed out' : <><i className="rc-coin" aria-hidden />{c}</>}</span>
                </button>
              ); })}
            </div>
            <h3>Cannons</h3>
            <div className="rc-shop-grid">
              {CANNONS.map((c) => { const own = S.cannons.includes(c.id); return (
                <button key={c.id} type="button" className={`rc-item${S.cannon === c.id ? ' sel' : ''}`} disabled={!own && S.coins < c.cost} onClick={() => buy('cannon', c.id)}>
                  <span className="rc-swatch" style={{ background: c.color }} aria-hidden /><b>{c.name}</b><small>{Math.round(c.mult * 100)}% launch power</small>
                  <span className="rc-cost">{S.cannon === c.id ? 'Using' : own ? 'Use' : <><i className="rc-coin" aria-hidden />{c.cost}</>}</span>
                </button>
              ); })}
            </div>
            <h3>Chickens</h3>
            <div className="rc-shop-grid">
              {CHICKENS.map((c) => { const own = S.chickens.includes(c.id); return (
                <button key={c.id} type="button" className={`rc-item${S.chicken === c.id ? ' sel' : ''}`} disabled={!own && S.coins < c.cost} onClick={() => buy('chicken', c.id)}>
                  <img src={`${A}${c.id}.webp`} alt="" className="rc-chick" /><b>{c.name}</b>
                  <span className="rc-cost">{S.chicken === c.id ? 'Flying' : own ? 'Use' : <><i className="rc-coin" aria-hidden />{c.cost}</>}</span>
                </button>
              ); })}
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShop(false)}>Done</button>
          </div>
        </div>
      )}

      {gear && (
        <div className="pf-overlay" onClick={() => setGear(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
            <h2 style={{ marginTop: 0 }}>Settings</h2>
            <GraphicsMeter value={S.gfx} onChange={(g) => put({ gfx: g })} />
            {settingsPanel}
            <div className="row-wrap" style={{ gap: 10, alignItems: 'center' }}>
              <button type="button" className="btn btn-lg" onClick={saveNow}>Save</button>
              <span role="status">{savedMsg}</span>
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setGear(false)}>Done</button>
          </div>
        </div>
      )}

      {help && (
        <div className="pf-overlay" onClick={() => setHelp(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How to play">
            <h2 style={{ marginTop: 0 }}>How to play <button type="button" className="btn" onClick={() => speak(howTo, student.ttsSettings)} aria-label="Listen">🔊</button></h2>
            <p>{howTo}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setHelp(false)}>Got it</button>
          </div>
        </div>
      )}

      {!started && (
        <GameStartCard title="Rocket Chickens" intro={howTo} ttsSettings={student.ttsSettings} onStart={() => { setStarted(true); window.setTimeout(loadCannon, 50); }}>
          <GraphicsMeter value={S.gfx} onChange={(g) => put({ gfx: g })} />
          {settingsPanel}
        </GameStartCard>
      )}
      {element}
    </div>
  );
}

function GraphicsMeter({ value, onChange }: { value: Gfx; onChange: (g: Gfx) => void }) {
  const opts: { id: Gfx; label: string; how: string }[] = [
    { id: 'low', label: 'Low', how: 'Fastest. Plain sky, no flying bits.' },
    { id: 'medium', label: 'Medium', how: 'Farm scenery and some flying bits.' },
    { id: 'high', label: 'High', how: 'Everything, sharpest picture. Best on newer iPads.' },
  ];
  return (
    <div className="rc-gfx" role="radiogroup" aria-label="Graphics">
      <span className="rc-gfx-label">Graphics</span>
      <div className="rc-gfx-meter">
        {opts.map((o, i) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.how} className={`rc-gfx-btn${opts.findIndex((x) => x.id === value) >= i ? ' on' : ''}${value === o.id ? ' sel' : ''}`} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
      <small>{opts.find((o) => o.id === value)?.how}</small>
    </div>
  );
}
