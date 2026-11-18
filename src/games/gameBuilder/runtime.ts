import { makeArtist, spriteCanvas, isSprite } from './art';
import { SOUND_FILES, heroEmoji, type Action, type GameProject, type Rule, type Settings } from '../../lib/gameBuilder/model';

// The Game Builder runtime (Build Queue 658): plays a student's project. One small rules engine reads the same
// hat-and-action rules the blocks and Azalea edit, and four game engines (platformer, match three, clicker, maze)
// draw the world and tell the rules what happened ("the hero touched a coin"). Built here from scratch for the
// dashboard; nothing is copied from Scratch, it only looks and reads like it.

export type EndResult = 'win' | 'lose';
export interface RunHooks { onEnd: (r: EndResult, score: number) => void; onNote?: (t: string) => void; sound: boolean }
export interface RunHandle { stop: () => void; press: (key: string, down: boolean) => void; tap: (x: number, y: number) => void }

// ---------- sounds (made in the browser, no files) ----------
let ac: AudioContext | null = null;
const files = new Map<string, HTMLAudioElement>();
export function tone(kind: string) {
  const file = SOUND_FILES[kind];
  if (file) { try { const a = files.get(file) ?? new Audio(file); files.set(file, a); a.currentTime = 0; a.volume = 0.6; void a.play().catch(() => {}); } catch { /* no sound */ } return; }
  try {
    ac = ac ?? new AudioContext();
    const o = ac.createOscillator(); const g = ac.createGain(); o.connect(g); g.connect(ac.destination);
    const t = ac.currentTime;
    const f: Record<string, [number, number, OscillatorType, number]> = {
      coin: [880, 1320, 'square', 0.12], boing: [220, 520, 'sine', 0.25], pop: [600, 300, 'triangle', 0.08],
      zap: [1200, 200, 'sawtooth', 0.15], win: [523, 1046, 'triangle', 0.5], oops: [300, 120, 'square', 0.3], buy: [660, 990, 'triangle', 0.15],
    };
    const [a, b, type, d] = f[kind] ?? f.pop;
    o.type = type; o.frequency.setValueAtTime(a, t); o.frequency.exponentialRampToValueAtTime(b, t + d);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.start(t); o.stop(t + d + 0.02);
  } catch { /* no sound on this device */ }
}

// ---------- the rules engine ----------
export interface Ctx { remove?: () => void; spawn?: (thing: string, n: number) => void; bounce?: () => void; restart?: () => void; num?: number }

export class Rules {
  score = 0; lives = 3; time = 0; perTap = 1; perSecond = 0; over: EndResult | null = null;
  msg = ''; msgUntil = 0; powers = new Map<string, number>(); settings: Settings;
  private fired = new Set<string>(); private every = new Map<string, number>(); private now = 0;
  costs = new Map<string, number>(); endTimer = 0;
  p: GameProject; private hooks: RunHooks;
  constructor(p: GameProject, hooks: RunHooks) {
    this.p = p; this.hooks = hooks;
    this.settings = { ...p.settings };
    this.lives = p.settings.lives; this.time = p.settings.timer;
  }
  has(power: string) { return (this.powers.get(power) ?? 0) > this.now; }
  rulesFor(when: string, arg = '') { return this.p.rules.filter((r) => r.when === when && (!arg || r.whenArg === arg || r.whenArg === 'any' || !r.whenArg)); }
  fire(when: string, arg = '', ctx: Ctx = {}): boolean {
    if (this.over) return false;
    const rules = this.rulesFor(when, arg);
    rules.forEach((r) => this.run(r, ctx));
    return rules.length > 0;
  }
  run(r: Rule, ctx: Ctx) { for (const a of r.actions) { if (this.over) return; this.act(a, ctx, r); } }
  private act(a: Action, ctx: Ctx, r: Rule) {
    const s = this.settings;
    switch (a.do) {
      case 'addScore': this.addScore(a.num * (this.has('double') ? 2 : 1)); break;
      case 'setScore': this.score = a.num; this.checkScore(); break;
      case 'perTap': this.perTap += a.num; break;
      case 'perSecond': this.perSecond += a.num; break;
      case 'cost': break; // read by the clicker before the rule runs
      case 'remove': ctx.remove?.(); break;
      case 'spawn': ctx.spawn?.(a.arg, Math.max(1, Math.min(20, a.num || 1))); break;
      case 'loseLife': if (!this.has('shield')) { this.lives -= 1; if (this.lives <= 0) { if (!this.fire('nolives')) this.end('lose'); } } break;
      case 'addLife': this.lives = Math.max(0, this.lives + a.num); break;
      case 'set': if (a.arg in s) (s as unknown as Record<string, number>)[a.arg] = a.num; if (a.arg === 'lives') this.lives = a.num; if (a.arg === 'timer') this.time = a.num; break;
      case 'power': this.powers.set(a.arg, this.now + Math.max(1, a.num || 5) * 1000); this.note(`Power up: ${a.arg === 'double' ? 'double points' : a.arg}!`); break;
      case 'sound': if (this.hooks.sound) tone(a.arg); break;
      case 'say': this.note(a.arg); break;
      case 'addTime': this.time = Math.max(0, this.time + a.num); break;
      case 'bounce': ctx.bounce?.(); break;
      case 'restart': ctx.restart?.(); break;
      case 'win': this.end('win'); break;
      case 'lose': this.end('lose'); break;
    }
    void r;
  }
  addScore(n: number) { this.score += n; this.checkScore(); }
  private checkScore() {
    for (const r of this.p.rules) if (r.when === 'score' && this.score >= r.whenNum && !this.fired.has(r.id)) { this.fired.add(r.id); this.run(r, {}); }
  }
  note(t: string) { this.msg = t; this.msgUntil = this.now + 2600; this.hooks.onNote?.(t); }
  end(r: EndResult) {
    if (this.over) return; this.over = r;
    if (this.hooks.sound) tone(r === 'win' ? 'win' : 'oops');
    this.endTimer = window.setTimeout(() => this.hooks.onEnd(r, this.score), 700);
  }
  start() { this.fire('start'); }
  tick(now: number, dt: number) {
    this.now = now;
    if (this.over) return;
    if (this.perSecond) this.addScore(this.perSecond * dt * (this.has('double') ? 2 : 1));
    if (this.settings.timer > 0 || this.p.settings.timer > 0) {
      const before = this.time; this.time = Math.max(0, this.time - dt);
      if (before > 0 && this.time === 0) { if (!this.fire('timeup')) this.end('lose'); }
    }
    for (const r of this.p.rules) if (r.when === 'every' && r.whenNum > 0) {
      const t = (this.every.get(r.id) ?? 0) + dt;
      if (t >= r.whenNum) { this.every.set(r.id, 0); this.run(r, {}); } else this.every.set(r.id, t);
    }
  }
  hud(ctx: CanvasRenderingContext2D, w: number, ink: string) {
    ctx.save(); ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillStyle = ink; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    const bits = [`Score ${Math.floor(this.score)}`];
    if (this.p.kind === 'platformer' || this.p.kind === 'maze') bits.push(`Lives ${'♥'.repeat(Math.max(0, Math.min(9, this.lives)))}`);
    if (this.time > 0 || this.p.settings.timer > 0) bits.push(`Time ${Math.ceil(this.time)}`);
    const active = [...this.powers.entries()].filter(([, t]) => t > this.now).map(([k]) => k);
    if (active.length) bits.push(`Power: ${active.join(', ')}`);
    ctx.fillText(bits.join('    '), 12, 10);
    if (this.msg && this.now < this.msgUntil) {
      ctx.font = 'bold 22px system-ui, sans-serif'; ctx.textAlign = 'center';
      const tw = ctx.measureText(this.msg).width + 28;
      ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fillRect(w / 2 - tw / 2, 44, tw, 38);
      ctx.fillStyle = '#2b1d55'; ctx.fillText(this.msg, w / 2, 52);
    }
    ctx.restore();
  }
}

// A steady random number from the project id, so a level looks the same every play.
function seeded(seedText: string) {
  let h = 2166136261; for (const c of seedText) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; };
}

const THING_ICON: Record<string, string> = { coin: '🪙', enemy: '🐌', spike: '🔺', star: '⭐', flag: '🚩', dot: '•', power: '●', ghost: '👻', fruit: '🍒' };

export function pathAt(pa: { pts: number[][]; secs: number }, t: number): [number, number] {
  const pts = pa.pts; if (pts.length < 2) return [0, 0];
  const f = ((t / Math.max(0.5, pa.secs)) % 1 + 1) % 1 * (pts.length - 1); const i = Math.floor(f), k = f - i;
  const a = pts[i], b = pts[Math.min(pts.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * k - pts[0][0], a[1] + (b[1] - a[1]) * k - pts[0][1]];
}

function loop(step: (now: number, dt: number) => void) {
  let raf = 0; let last = performance.now(); let on = true;
  const f = (now: number) => { if (!on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; step(now, dt); raf = requestAnimationFrame(f); };
  raf = requestAnimationFrame(f);
  return () => { on = false; cancelAnimationFrame(raf); };
}

// ---------- Platformer ----------
interface Obj { kind: string; x: number; y: number; w: number; h: number; vx?: number; gone?: boolean; minX?: number; maxX?: number; cool?: number; hx?: number; hy?: number; phase?: number }
function platformer(cv: HTMLCanvasElement, p: GameProject, hooks: RunHooks): RunHandle {
  const g = cv.getContext('2d')!; const W = cv.width, H = cv.height; const A = makeArtist(p); const th = A.colors;
  const R = new Rules(p, hooks); const rnd = seeded(p.id);
  const len = 1400 + p.settings.level * 900; const groundY = H - 50;
  const solids: { x: number; y: number; w: number; h: number }[] = []; const objs: Obj[] = [];
  let x = 0;
  while (x < len) {
    const w = 260 + rnd() * 420; solids.push({ x, y: groundY, w, h: 60 });
    if (x > 300 && rnd() < 0.7) objs.push({ kind: 'enemy', x: x + w / 2, y: groundY - 26, w: 26, h: 26, vx: 1, minX: x + 10, maxX: x + w - 36 });
    if (x > 200 && rnd() < 0.45) objs.push({ kind: 'spike', x: x + 40 + rnd() * (w - 80), y: groundY - 18, w: 22, h: 18 });
    for (let i = 0; i < 3; i++) objs.push({ kind: 'coin', x: x + 30 + i * 34 + rnd() * 40, y: groundY - 70, w: 20, h: 20 });
    if (rnd() < 0.6) { const px = x + rnd() * w; const py = groundY - 110 - rnd() * 60; solids.push({ x: px, y: py, w: 120, h: 16 }); objs.push({ kind: 'coin', x: px + 50, y: py - 28, w: 20, h: 20 }); if (rnd() < 0.25) objs.push({ kind: 'star', x: px + 10, y: py - 30, w: 22, h: 22 }); }
    x += w + 70 + rnd() * 70;
  }
  solids.push({ x, y: groundY, w: 400, h: 60 });
  objs.push({ kind: 'flag', x: x + 200, y: groundY - 60, w: 30, h: 60 });
  const hero = { x: 40, y: groundY - 40, w: 30, h: 30, vx: 0, vy: 0, ground: false, inv: 0 };
  const keys: Record<string, boolean> = {};
  let cam = 0;
  const restart = () => { hero.x = 40; hero.y = groundY - 40; hero.vx = 0; hero.vy = 0; hero.inv = 1.2; };
  const counts = () => { const c: Record<string, number> = {}; objs.forEach((o) => { if (!o.gone) c[o.kind] = (c[o.kind] ?? 0) + 1; }); return c; };
  const spawn = (kind: string, n: number) => { for (let i = 0; i < n; i++) { const sx = hero.x + 160 + Math.random() * 500; objs.push({ kind, x: sx, y: kind === 'enemy' ? groundY - 26 : groundY - 70 - Math.random() * 80, w: 24, h: 24, vx: 1, minX: sx - 120, maxX: sx + 120 }); } };
  const hit = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // A path the student drew (Build Queue 664): that kind of thing follows it, over and over, from where it starts.
  const paths = p.design.paths ?? {};
  objs.forEach((o, i) => { o.hx = o.x; o.hy = o.y; o.phase = (i * 0.37) % 1; });
  R.start();
  const stop = loop((now, dt) => {
    R.tick(now, dt); const s = R.settings;
    for (const o of objs) { const pa = paths[o.kind]; if (!pa || o.gone || (o.kind === 'enemy' && R.has('freeze'))) continue; const [dx, dy] = pathAt(pa, now / 1000 + (o.phase ?? 0) * pa.secs); o.x = (o.hx ?? o.x) + dx; o.y = (o.hy ?? o.y) + dy; }
    if (!R.over) {
      const speed = 60 + s.heroSpeed * 32 * (R.has('speed') ? 1.6 : 1);
      hero.vx = (keys.right ? speed : 0) - (keys.left ? speed : 0);
      hero.vy += (400 + s.gravity * 140) * dt;
      if (keys.jump && hero.ground) { hero.vy = -(260 + s.jumpHeight * 45); hero.ground = false; if (!R.fire('key', 'jump') && hooks.sound) tone('boing'); }
      const size = R.has('giant') ? 1.6 : 1; hero.w = 30 * size; hero.h = 30 * size;
      hero.x = Math.max(0, hero.x + hero.vx * dt); hero.y += hero.vy * dt; hero.ground = false;
      for (const b of solids) if (hit(hero, b) && hero.vy >= 0 && hero.y + hero.h - hero.vy * dt <= b.y + 4) { hero.y = b.y - hero.h; hero.vy = 0; hero.ground = true; }
      if (hero.y > H + 40) { R.fire('touch', 'fall'); if (!R.over) { if (!R.has('shield')) { R.lives -= 1; if (R.lives <= 0 && !R.fire('nolives')) R.end('lose'); } restart(); } }
      hero.inv = Math.max(0, hero.inv - dt);
      for (const o of objs) {
        if (o.gone) continue;
        if (o.kind === 'enemy' && !R.has('freeze') && !paths.enemy) { o.x += (o.vx ?? 1) * (20 + s.enemySpeed * 18) * dt; if (o.x < (o.minX ?? 0) || o.x > (o.maxX ?? 1e9)) o.vx = -(o.vx ?? 1); }
        o.cool = Math.max(0, (o.cool ?? 0) - dt);
        if (o.cool > 0 || !hit(hero, o)) continue;
        if ((o.kind === 'enemy' || o.kind === 'spike') && hero.inv > 0) continue;
        o.cool = 1;
        const before = counts()[o.kind] ?? 0;
        const did = R.fire('touch', o.kind, { remove: () => { o.gone = true; }, spawn, bounce: () => { hero.vy = -420; }, restart });
        if (!did && o.kind === 'star') { o.gone = true; R.powers.set('speed', now + 6000); }
        if ((o.kind === 'enemy' || o.kind === 'spike') && !o.gone) hero.inv = 1;
        if (o.gone && before === 1) R.fire('allgone', o.kind);
      }
      cam = Math.max(0, Math.min(hero.x - W / 3, x + 400 - W));
    }
    // draw
    A.sky(g, W, H, cam);
    g.save(); g.translate(-cam, 0);
    for (const b of solids) A.block(g, b.x, b.y, b.w, b.h);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
    for (const o of objs) { if (o.gone || o.x < cam - 60 || o.x > cam + W + 60) continue; A.thing(g, o.kind, THING_ICON[o.kind] ?? '❓', o.x + o.w / 2, o.y + o.h / 2, o.h + 4); }
    g.globalAlpha = hero.inv > 0 && Math.floor(now / 100) % 2 ? 0.4 : 1;
    if (R.has('shield')) { g.strokeStyle = '#6cf'; g.lineWidth = 3; g.beginPath(); g.arc(hero.x + hero.w / 2, hero.y + hero.h / 2, hero.w * 0.85, 0, 7); g.stroke(); }
    A.thing(g, 'hero', heroEmoji(p.design.hero), hero.x + hero.w / 2, hero.y + hero.h / 2, hero.h + 6);
    g.globalAlpha = 1; g.restore();
    R.hud(g, W, th.ink);
  });
  return { stop: () => { stop(); window.clearTimeout(R.endTimer); }, press: (k, d) => { keys[k] = d; }, tap: () => {} };
}

// ---------- Maze chase ----------
const MAZES = [
  ['###############', '#o....#.#....o#', '#.##.#...#.##.#', '#.#..#.#.#..#.#', '#...........  #', '#.##.##G##.##.#', '#....#GGG#....#', '#.##.#####.##.#', '#......P......#', '#.#.###.###.#.#', '#o#....F....#o#', '#...##...##...#', '###############'],
  ['###############', '#o...........o#', '#.###.###.###.#', '#.............#', '###.#.#G#.#.###', '#...#.GGG.#...#', '#.#.#.###.#.#.#', '#.#....P....#.#', '#.###.#.#.###.#', '#....F#.#.....#', '#.##.......##.#', '#o..#.###.#..o#', '###############'],
];
function maze(cv: HTMLCanvasElement, p: GameProject, hooks: RunHooks): RunHandle {
  const g = cv.getContext('2d')!; const W = cv.width, H = cv.height; const A = makeArtist(p); const th = A.colors;
  const R = new Rules(p, hooks);
  const map = MAZES[(p.settings.level - 1) % MAZES.length].map((row) => row.split(''));
  const rows = map.length, cols = map[0].length; const cell = Math.floor(Math.min(W / cols, (H - 40) / rows)); const ox = (W - cell * cols) / 2, oy = 36 + (H - 36 - cell * rows) / 2;
  const items = new Map<string, string>(); let start = { c: 7, r: 8 }; const ghosts: { c: number; r: number; x: number; y: number; d: [number, number]; home: { c: number; r: number } }[] = [];
  map.forEach((row, r) => row.forEach((ch, c) => {
    if (ch === '.') items.set(`${c},${r}`, 'dot'); else if (ch === 'o') items.set(`${c},${r}`, 'power'); else if (ch === 'F') items.set(`${c},${r}`, 'fruit');
    else if (ch === 'P') start = { c, r }; else if (ch === 'G' && ghosts.length < 1 + p.settings.level) ghosts.push({ c, r, x: c, y: r, d: [0, -1], home: { c, r } });
  }));
  const wall = (c: number, r: number) => map[r]?.[c] === '#' || map[r]?.[c] === undefined;
  const hero = { x: start.c, y: start.r, d: [0, 0] as [number, number], want: [0, 0] as [number, number], inv: 0 };
  const restart = () => { hero.x = start.c; hero.y = start.r; hero.d = [0, 0]; hero.inv = 1.5; ghosts.forEach((gh) => { gh.x = gh.home.c; gh.y = gh.home.r; }); };
  const count = (k: string) => [...items.values()].filter((v) => v === k).length;
  const spawn = (kind: string, n: number) => { const open: string[] = []; map.forEach((row, r) => row.forEach((ch, c) => { if (ch !== '#' && !items.has(`${c},${r}`)) open.push(`${c},${r}`); })); for (let i = 0; i < n && open.length; i++) items.set(open.splice(Math.floor(Math.random() * open.length), 1)[0], kind === 'ghost' ? 'fruit' : kind); if (kind === 'ghost') for (let i = 0; i < n; i++) ghosts.push({ ...ghosts[0], x: ghosts[0]?.home.c ?? 7, y: ghosts[0]?.home.r ?? 6, d: [0, -1], home: ghosts[0]?.home ?? { c: 7, r: 6 } }); };
  const step = (o: { x: number; y: number; d: [number, number] }, sp: number, want?: [number, number]) => {
    const cx = Math.round(o.x), cy = Math.round(o.y); const near = Math.abs(o.x - cx) < sp && Math.abs(o.y - cy) < sp;
    if (near && want && (want[0] || want[1]) && !wall(cx + want[0], cy + want[1])) { o.x = cx; o.y = cy; o.d = want; }
    if (near && wall(cx + o.d[0], cy + o.d[1])) { o.x = cx; o.y = cy; return false; }
    o.x += o.d[0] * sp; o.y += o.d[1] * sp; return true;
  };
  R.start();
  const stop = loop((now, dt) => {
    R.tick(now, dt); const s = R.settings;
    if (!R.over) {
      step(hero, dt * (2.5 + s.heroSpeed * 0.45) * (R.has('speed') ? 1.5 : 1), hero.want);
      hero.inv = Math.max(0, hero.inv - dt);
      const k = `${Math.round(hero.x)},${Math.round(hero.y)}`; const it = items.get(k);
      if (it) {
        let removed = false;
        const did = R.fire('touch', it, { remove: () => { items.delete(k); removed = true; }, spawn, restart });
        if (!did) { items.delete(k); removed = true; if (it === 'power') R.powers.set('scare', now + 7000); if (it === 'fruit') R.addScore(100); }
        else if (!removed && it !== 'ghost') items.delete(k); // rules ran; a dot never sits under the hero forever
        if (count(it) === 0) R.fire('allgone', it);
        if (it === 'power' && did && !R.p.rules.some((r) => r.whenArg === 'power' && r.actions.some((a) => a.do === 'power'))) R.powers.set('scare', now + 7000);
      }
      for (const gh of ghosts) {
        if (!R.has('freeze')) {
          const sp = dt * (1.2 + s.enemySpeed * 0.35) * (R.has('scare') ? 0.6 : 1);
          const cx = Math.round(gh.x), cy = Math.round(gh.y);
          if (Math.abs(gh.x - cx) < sp && Math.abs(gh.y - cy) < sp) {
            const opts = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]).filter(([a, b]) => !wall(cx + a, cy + b) && !(a === -gh.d[0] && b === -gh.d[1]));
            if (opts.length) {
              const toward = R.has('scare') ? -1 : 1;
              opts.sort((a, b) => toward * (Math.hypot(cx + a[0] - hero.x, cy + a[1] - hero.y) - Math.hypot(cx + b[0] - hero.x, cy + b[1] - hero.y)));
              gh.d = Math.random() < 0.6 ? opts[0] : opts[Math.floor(Math.random() * opts.length)];
            } else gh.d = [-gh.d[0], -gh.d[1]] as [number, number];
          }
          step(gh, sp);
        }
        if (Math.hypot(gh.x - hero.x, gh.y - hero.y) < 0.6 && hero.inv <= 0) {
          if (R.has('scare')) { gh.x = gh.home.c; gh.y = gh.home.r; R.addScore(50); if (hooks.sound) tone('zap'); continue; }
          hero.inv = 1.5;
          if (!R.fire('touch', 'ghost', { restart, spawn })) { R.lives -= 1; if (R.lives <= 0 && !R.fire('nolives')) R.end('lose'); else restart(); }
        }
      }
    }
    A.sky(g, W, H);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (map[r][c] === '#') A.block(g, ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
    items.forEach((v, k) => { const [c, r] = k.split(',').map(Number); const px = ox + c * cell + cell / 2, py = oy + r * cell + cell / 2; if (v === 'dot') { g.fillStyle = th.ink; g.beginPath(); g.arc(px, py, cell * 0.1, 0, 7); g.fill(); } else if (v === 'power') { g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(px, py, cell * 0.24 + Math.sin(now / 200) * 2, 0, 7); g.fill(); } else A.thing(g, v, THING_ICON[v] ?? '❓', px, py, cell * 0.7); });
    g.fillStyle = "#000"; g.font = `${cell * 0.85}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui`;
    for (const gh of ghosts) { g.globalAlpha = R.has('scare') ? 0.55 : 1; A.thing(g, 'ghost', R.has('scare') ? '😱' : '👻', ox + gh.x * cell + cell / 2, oy + gh.y * cell + cell / 2, cell * 0.85); }
    g.globalAlpha = hero.inv > 0 && Math.floor(now / 100) % 2 ? 0.4 : 1;
    A.thing(g, 'hero', heroEmoji(p.design.hero), ox + hero.x * cell + cell / 2, oy + hero.y * cell + cell / 2, cell * 0.85); g.globalAlpha = 1;
    R.hud(g, W, th.ink);
  });
  const dirs: Record<string, [number, number]> = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  return { stop: () => { stop(); window.clearTimeout(R.endTimer); }, press: (k, d) => { if (d && dirs[k]) { hero.want = dirs[k]; R.fire('key', k); } }, tap: () => {} };
}

// ---------- Match three ----------
const TILE_COLORS: [string, string][] = [['red', '#ff5a5f'], ['blue', '#4c97ff'], ['green', '#3fbf6f'], ['yellow', '#ffcc33'], ['purple', '#9966ff']];
function match3(cv: HTMLCanvasElement, p: GameProject, hooks: RunHooks): RunHandle {
  const g = cv.getContext('2d')!; const W = cv.width, H = cv.height; const A = makeArtist(p); const th = A.colors;
  const R = new Rules(p, hooks); const N = 7; const nc = Math.max(3, Math.min(5, p.settings.tileColors));
  const cell = Math.floor(Math.min(W - 40, H - 60) / N); const ox = (W - cell * N) / 2, oy = 44 + (H - 44 - cell * N) / 2;
  const rand = () => Math.floor(Math.random() * nc);
  const grid: number[][] = Array.from({ length: N }, () => Array.from({ length: N }, rand));
  const findRuns = () => { const hit = new Set<string>(); const groups: { color: number; n: number }[] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; ) { let e = c; while (e < N && grid[r][e] === grid[r][c]) e++; if (e - c >= 3 && grid[r][c] >= 0) { groups.push({ color: grid[r][c], n: e - c }); for (let i = c; i < e; i++) hit.add(`${r},${i}`); } c = e; }
    for (let c = 0; c < N; c++) for (let r = 0; r < N; ) { let e = r; while (e < N && grid[e][c] === grid[r][c]) e++; if (e - r >= 3 && grid[r][c] >= 0) { groups.push({ color: grid[r][c], n: e - r }); for (let i = r; i < e; i++) hit.add(`${i},${c}`); } r = e; }
    return { hit, groups }; };
  while (findRuns().hit.size) for (const k of findRuns().hit) { const [r, c] = k.split(',').map(Number); grid[r][c] = rand(); }
  // No swap makes a match: reshuffle so a student is never stuck (Claudia's review, 668).
  const hasMove = () => { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) { const r2 = r + dr, c2 = c + dc; if (r2 >= N || c2 >= N) continue; [grid[r][c], grid[r2][c2]] = [grid[r2][c2], grid[r][c]]; const ok = findRuns().hit.size > 0; [grid[r][c], grid[r2][c2]] = [grid[r2][c2], grid[r][c]]; if (ok) return true; } return false; };
  const reshuffle = () => { let tries = 0; do { for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) grid[r][c] = rand(); while (findRuns().hit.size) for (const k of findRuns().hit) { const [r, c] = k.split(',').map(Number); grid[r][c] = rand(); } } while (!hasMove() && ++tries < 20); };
  if (!hasMove()) reshuffle();
  let sel: { r: number; c: number } | null = null; let busy = 0; const pops: { r: number; c: number; t: number }[] = [];
  const resolve = (first: boolean): boolean => {
    const { hit, groups } = findRuns(); if (!hit.size) return false;
    for (const gr of groups) { const name = TILE_COLORS[gr.color][0]; const did = R.fire('match', name, { num: gr.n }); if (!did) R.addScore(gr.n * 10); }
    hit.forEach((k) => { const [r, c] = k.split(',').map(Number); grid[r][c] = -1; pops.push({ r, c, t: performance.now() }); });
    for (let c = 0; c < N; c++) { const col = []; for (let r = N - 1; r >= 0; r--) if (grid[r][c] >= 0) col.push(grid[r][c]); for (let r = N - 1, i = 0; r >= 0; r--, i++) grid[r][c] = i < col.length ? col[i] : rand(); }
    void first; busy = 0.25; return true;
  };
  R.start();
  const stop = loop((now, dt) => {
    R.tick(now, dt);
    if (busy > 0) { busy -= dt; if (busy <= 0 && !resolve(false) && !hasMove()) { reshuffle(); R.note('No more matches, so I mixed the tiles.'); } }
    A.sky(g, W, H);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const v = grid[r][c]; if (v < 0) continue; const x = ox + c * cell, y = oy + r * cell;
      g.fillStyle = TILE_COLORS[v][1]; g.beginPath(); g.roundRect(x + 4, y + 4, cell - 8, cell - 8, 10); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.roundRect(x + 9, y + 8, cell - 18, (cell - 16) / 3, 6); g.fill();
      const own = p.design.sprites?.[TILE_COLORS[v][0]]; if (isSprite(own)) { g.imageSmoothingEnabled = false; g.drawImage(spriteCanvas(own), x + cell * 0.18, y + cell * 0.18, cell * 0.64, cell * 0.64); }
      if (sel && sel.r === r && sel.c === c) { g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(x + 3, y + 3, cell - 6, cell - 6); }
    }
    for (const pp of pops) { const a = 1 - (now - pp.t) / 300; if (a <= 0) continue; g.globalAlpha = a; g.fillStyle = '#fff'; g.beginPath(); g.arc(ox + pp.c * cell + cell / 2, oy + pp.r * cell + cell / 2, cell * (0.5 - a * 0.3), 0, 7); g.fill(); g.globalAlpha = 1; }
    R.hud(g, W, th.ink);
  });
  const tap = (x: number, y: number) => {
    if (R.over || busy > 0) return; const c = Math.floor((x - ox) / cell), r = Math.floor((y - oy) / cell); if (r < 0 || c < 0 || r >= N || c >= N) return;
    if (!sel) { sel = { r, c }; return; }
    if (Math.abs(sel.r - r) + Math.abs(sel.c - c) !== 1) { sel = { r, c }; return; }
    const a = sel; sel = null; [grid[a.r][a.c], grid[r][c]] = [grid[r][c], grid[a.r][a.c]];
    if (!resolve(true)) { [grid[a.r][a.c], grid[r][c]] = [grid[r][c], grid[a.r][a.c]]; if (hooks.sound) tone('oops'); }
  };
  return { stop: () => { stop(); window.clearTimeout(R.endTimer); }, press: () => {}, tap };
}

// ---------- Clicker ----------
function clicker(cv: HTMLCanvasElement, p: GameProject, hooks: RunHooks): RunHandle {
  const g = cv.getContext('2d')!; const W = cv.width, H = cv.height; const A = makeArtist(p); const th = A.colors;
  const R = new Rules(p, hooks); let squish = 0; const floats: { x: number; y: number; t: number; n: number }[] = [];
  const ups = ['up1', 'up2', 'up3'].filter((u) => R.rulesFor('tap', u).some((r) => r.whenArg === u));
  ups.forEach((u) => R.costs.set(u, R.rulesFor('tap', u).flatMap((r) => r.actions).find((a) => a.do === 'cost')?.num ?? 10));
  const btn = { x: W * 0.35, y: H * 0.55, r: Math.min(W, H) * 0.22 };
  const upBox = (i: number) => ({ x: W * 0.68, y: 70 + i * 86, w: W * 0.29, h: 72 });
  const upLabel = (u: string) => R.rulesFor('tap', u).flatMap((r) => r.actions).filter((a) => a.do !== 'cost' && a.do !== 'sound').map((a) => a.do === 'perTap' ? `+${a.num} per tap` : a.do === 'perSecond' ? `+${a.num} every second` : a.do === 'power' ? `${a.arg} power` : a.do === 'addScore' ? `+${a.num} points` : a.do).join(', ') || 'upgrade';
  R.start();
  const stop = loop((now, dt) => {
    R.tick(now, dt); squish = Math.max(0, squish - dt * 4);
    A.sky(g, W, H);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#000';
    g.fillStyle = th.ground; g.beginPath(); g.arc(btn.x, btn.y, btn.r * (1 - squish * 0.12), 0, 7); g.fill();
    A.thing(g, 'hero', heroEmoji(p.design.hero), btn.x, btn.y + 4, btn.r * 1.1 * (1 - squish * 0.12)); g.fillStyle = th.ink; g.textAlign = 'center';
    g.font = 'bold 20px system-ui'; g.fillStyle = th.ink; g.fillText(`${R.perTap} per tap${R.perSecond ? `, ${R.perSecond} per second` : ''}`, btn.x, btn.y + btn.r + 26);
    for (const f of floats) { const a = 1 - (now - f.t) / 800; if (a <= 0) continue; g.globalAlpha = a; g.font = 'bold 24px system-ui'; g.fillText(`+${f.n}`, f.x, f.y - (1 - a) * 60); g.globalAlpha = 1; }
    ups.forEach((u, i) => { const b = upBox(i); const cost = R.costs.get(u) ?? 10; const can = R.score >= cost;
      g.fillStyle = can ? '#ffffff' : 'rgba(255,255,255,0.5)'; g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, 12); g.fill();
      g.fillStyle = '#2b1d55'; g.font = 'bold 16px system-ui'; g.textAlign = 'left'; g.fillText(upLabel(u), b.x + 12, b.y + 24); g.font = '15px system-ui'; g.fillText(`costs ${Math.ceil(cost)}`, b.x + 12, b.y + 50); g.textAlign = 'center'; });
    R.hud(g, W, th.ink);
  });
  const tap = (x: number, y: number) => {
    if (R.over) return;
    if (Math.hypot(x - btn.x, y - btn.y) < btn.r) {
      squish = 1; const before = R.score;
      if (!R.fire('tap', 'big')) R.addScore(R.perTap); else if (R.perTap > 1) R.addScore(R.perTap - 1);
      floats.push({ x, y, t: performance.now(), n: Math.round((R.score - before) * 10) / 10 }); if (floats.length > 20) floats.shift();
      return;
    }
    ups.forEach((u, i) => { const b = upBox(i); if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) return; const cost = R.costs.get(u) ?? 10;
      if (R.score < cost) { R.note(`You need ${Math.ceil(cost)} points for that.`); return; }
      R.score -= cost; R.costs.set(u, Math.ceil(cost * 1.5)); if (hooks.sound) tone('buy'); R.fire('tap', u); });
  };
  return { stop: () => { stop(); window.clearTimeout(R.endTimer); }, press: () => {}, tap };
}

export function runGame(cv: HTMLCanvasElement, p: GameProject, hooks: RunHooks): RunHandle {
  if (p.kind === 'platformer') return platformer(cv, p, hooks);
  if (p.kind === 'maze') return maze(cv, p, hooks);
  if (p.kind === 'match3') return match3(cv, p, hooks);
  return clicker(cv, p, hooks);
}
