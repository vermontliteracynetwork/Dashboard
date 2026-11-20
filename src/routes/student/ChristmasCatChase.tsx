import { useEffect, useMemo, useRef, useState } from 'react';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { SfxToggle, sfxOn, registerGameMusic } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';
import { MenuItems } from '../../lib/mainMenu';
import GameStartCard from '../../components/GameStartCard';
import './ChristmasCatChase.css';

// Christmas Cat Chase (Build Queue 764 to 766, her words 2026-11-19: "lets make a christmas cat maze chase game",
// "Christmas Cat Chase should be the game name", and "Christmas Cat Chase should have timed rounds ("Santa's coming!")
// cat must get the mouse before santa comes, each round should get longer"). Our own maze game: the student is a cat
// in a Santa hat in a snowy maze. Catch the mouse before Santa comes. Every round is longer, and the mouse gets a little
// quicker. Grab the snowflakes for points, and a candy cane makes the snowmen run away (touching one sends it back
// to its fort with a poof). A snowman that bumps the cat just sends the cat back to the start. Nobody gets hurt.
// Art: her XmasCatFree cat, the CatMaterials mouse, and the Willosuna Pixel Christmas pack (Santa, snowmen, candy cane,
// star, tree). Sounds: her Christmas SFX Lite and Christmas SFX packs.

const A = '/games/christmas-cat-chase/';
// The maze (our own layout; 773: wide and short, so everything is bigger on the screen). # wall, . snowflake, o candy cane, C cat, M mouse, S snowman fort, - fort door, space empty.
const MAZE = [
  '###########################',
  '#o.........#####.........o#',
  '#.###.###.........###.###.#',
  '#.###.###.###-###.###.###.#',
  '#.........#SSSSS#.........#',
  '###.#.###.#######.###.#.###',
  '   .#........M........#.   ',
  '###.#.###.#######.###.#.###',
  '#.........#.....#.........#',
  '#.###.###...###...###.###.#',
  '#o..#.......#C#.......#..o#',
  '###.#.#.###.#.#.###.#.#.###',
  '#.....#.............#.....#',
  '#.#######.#######.#######.#',
  '#.........................#',
  '###########################',
];
const COLS = MAZE[0].length, ROWS = MAZE.length;
type Dir = 'up' | 'down' | 'left' | 'right' | '';
const DV: Record<Exclude<Dir, ''>, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPP: Record<string, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left', '': '' };
const wrapX = (x: number) => (x + COLS) % COLS;
const wall = (x: number, y: number, door = false) => { if (y < 0 || y >= ROWS) return true; const c = MAZE[y][wrapX(x)]; return c === '#' || (!door && c === '-'); };
const find = (ch: string) => { const out: [number, number][] = []; MAZE.forEach((r, y) => [...r].forEach((c, x) => { if (c === ch) out.push([x, y]); })); return out; };
const CAT0 = find('C')[0], MOUSE0 = find('M')[0], FORT = find('S'), DOOR_X = find('-')[0][0];

// Every round is longer (her rule), and the mouse is a bit quicker each time.
export const roundSecs = (r: number) => 40 + (r - 1) * 10;
const mouseSpeed = (r: number) => Math.min(5.6, 3.9 + (r - 1) * 0.25);
const snowmenFor = (r: number) => Math.min(3, 1 + Math.floor((r - 1) / 2));
const CAT_SPEED = 5.6, SNOW_SPEED = 3.1;

interface Mover { x: number; y: number; tx: number; ty: number; dir: Dir; want: Dir; speed: number }
interface Snow extends Mover { home: [number, number]; out: number }
const mover = (p: [number, number], speed: number): Mover => ({ x: p[0], y: p[1], tx: p[0], ty: p[1], dir: '', want: '', speed });

const imgs: Record<string, HTMLImageElement> = {};
const img = (n: string) => { if (!imgs[n]) { const i = new Image(); i.src = `${A}${n}.png`; imgs[n] = i; } return imgs[n]; };
const ok = (i: HTMLImageElement) => i.complete && i.naturalWidth > 0;
const sounds: Record<string, HTMLAudioElement> = {};
const play = (n: string, vol = 0.6) => { if (!sfxOn()) return; try { const base = (sounds[n] ??= new Audio(`${A}${n}.mp3`)); const a = base.cloneNode() as HTMLAudioElement; a.volume = vol; void a.play().catch(() => {}); } catch { /* fine */ } };

// Distance to every open tile from one tile (for the mouse running away, and snowmen chasing).
function distMap(sx: number, sy: number): number[][] {
  const d = Array.from({ length: ROWS }, () => Array(COLS).fill(1e9) as number[]);
  const q: [number, number][] = [[sx, sy]]; d[sy][sx] = 0;
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of Object.values(DV)) { const nx = wrapX(x + dx), ny = y + dy; if (!wall(nx, ny) && d[ny][nx] > d[y][x] + 1) { d[ny][nx] = d[y][x] + 1; q.push([nx, ny]); } }
  }
  return d;
}
const openDirs = (x: number, y: number, door = false) => (Object.keys(DV) as Exclude<Dir, ''>[]).filter((k) => !wall(x + DV[k][0], y + DV[k][1], door));

type Phase = 'ready' | 'play' | 'caught' | 'santa';
type Save = { best: number; bestScore: number };

export default function ChristmasCatChase() {
  const back = useBack();
  const { ask, element, pay, student, asking, settingsPanel, learn } = useAsk('Christmas Cat Chase', '🎄', 'christmasCatChase', { startCard: false, perLabel: 'Questions each round' });
  const studentId = student?.id ?? '';
  const tts = student?.ttsSettings;
  const calm = !!student?.worldReduceMotion;
  const key = `xmascat:${studentId}`;
  const [save, setSave] = useState<Save>(() => { try { return { best: 0, bestScore: 0, ...JSON.parse(localStorage.getItem(key) || '{}') }; } catch { return { best: 0, bestScore: 0 }; } });
  const [started, setStarted] = useState(false);
  const [round, setRound] = useState(1);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(roundSecs(1));
  const [msg, setMsg] = useState('');
  const [help, setHelp] = useState(false);
  const [music, setMusic] = useState(true);
  const [readOn, setReadOn] = useState(true);
  const readRef = useRef(readOn); readRef.current = readOn;
  const say = (t: string) => { if (readRef.current) speak(t, tts); };
  const cv = useRef<HTMLCanvasElement>(null);
  const G = useRef({
    cat: mover(CAT0, CAT_SPEED), mouse: mover(MOUSE0, mouseSpeed(1)), snow: [] as Snow[], dots: new Set<string>(), canes: new Set<string>(),
    super: 0, t: 0, left: roundSecs(1), warned: false, paused: false, score: 0, face: 1, mface: 1, poofs: [] as { x: number; y: number; t: number }[], bonk: 0, round: 1, live: false,
  });

  // 773 (her words: "flash messages like getting bonked in a 3:4 message in the middle for 5 seconds or until clicked
  // (message or anywhere/any key)"): a big card in the middle; the game (and Santa) waits while it shows.
  const [flash, setFlash] = useState<{ text: string; pic: string } | null>(null);
  const flashT = useRef(0);
  const closeFlash = () => { window.clearTimeout(flashT.current); G.current.paused = false; setFlash(null); };
  const showFlash = (text: string, pic: string) => { G.current.paused = true; setFlash({ text, pic }); say(text); window.clearTimeout(flashT.current); flashT.current = window.setTimeout(closeFlash, 5000); };
  const flashRef = useRef(showFlash); flashRef.current = showFlash;
  useEffect(() => {
    if (!flash) return;
    const shut = () => closeFlash();
    const t = window.setTimeout(() => { window.addEventListener('keydown', shut); window.addEventListener('pointerdown', shut); }, 250);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', shut); window.removeEventListener('pointerdown', shut); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);
  useEffect(() => () => window.clearTimeout(flashT.current), []);

  const persist = (s: Save) => { setSave(s); try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* fine */ } };

  const setupRound = (r: number) => {
    const g = G.current;
    g.cat = mover(CAT0, CAT_SPEED); g.mouse = mover(MOUSE0, mouseSpeed(r));
    g.snow = Array.from({ length: snowmenFor(r) }, (_, i) => ({ ...mover(FORT[i % FORT.length], SNOW_SPEED), home: FORT[i % FORT.length], out: 1.5 + i * 2.5 }));
    g.dots = new Set(); g.canes = new Set();
    // 774 (her words: "further space out the dots that you collect so they are more sparse"): about one path tile in three.
    MAZE.forEach((row, y) => [...row].forEach((c, x) => { if (c === '.' && (x + 2 * y) % 3 === 0) g.dots.add(`${x},${y}`); if (c === 'o') g.canes.add(`${x},${y}`); }));
    g.super = 0; g.t = 0; g.left = roundSecs(r); g.warned = false; g.poofs = []; g.bonk = 0; g.round = r;
    setLeft(g.left); setRound(r); setMsg('');
  };
  const go = () => { G.current.live = true; setPhase('play'); play('bells', 0.5); say(`Round ${G.current.round}. Catch the mouse before Santa comes! You have ${roundSecs(G.current.round)} seconds.`); };
  const startRound = (r: number) => {
    setupRound(r); setPhase('ready');
    ask(`Christmas Cat Chase: answer to start round ${r}`, go, () => setPhase('ready'));
  };

  // music
  const song = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!started || !music || phase !== 'play') { song.current?.pause(); return; }
    if (!song.current) { song.current = registerGameMusic(new Audio(`${A}music.mp3`)); song.current.loop = true; song.current.volume = 0.35; }
    void song.current.play().catch(() => {});
  }, [started, music, phase]);
  useEffect(() => () => { song.current?.pause(); song.current = null; }, []);

  const endCaught = () => {
    const g = G.current; g.live = false;
    const bonus = Math.round(g.left) * 5; g.score += 100 + bonus; setScore(g.score);
    play('win', 0.6); play('gift', 0.5);
    const best = Math.max(save.best, g.round), bestScore = Math.max(save.bestScore, g.score);
    if (g.round > save.best && studentId) recordBestGame(studentId, 'christmasCatChase', g.round, `${g.score} points`);
    persist({ best, bestScore });
    setPhase('caught');
    const t = `You caught the mouse with ${Math.round(g.left)} seconds left! 100 points, plus ${bonus} for the time left. Next round is ${roundSecs(g.round + 1)} seconds long.`;
    setMsg(t); say(t);
  };
  const endSanta = () => {
    const g = G.current; g.live = false;
    play('santa-laugh', 0.7); setPhase('santa');
    const t = 'Ho ho ho! Santa is here, so the mouse got away this time. Try the round again!';
    setMsg(t); say(t);
  };

  // the game loop
  useEffect(() => {
    if (!started) return;
    const c = cv.current; if (!c) return; const ctx = c.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    let raf = 0, last = performance.now(), hudT = 0;
    const T = 32; c.width = COLS * T; c.height = ROWS * T;
    const step = (m: Mover, dt: number, choose: (m: Mover) => Dir, door = false) => {
      let move = m.speed * dt;
      while (move > 0) {
        if (m.x === m.tx && m.y === m.ty) {
          const d = choose(m);
          if (d) m.dir = d;
          if (!m.dir || wall(m.x + DV[m.dir as Exclude<Dir, ''>][0], m.y + DV[m.dir as Exclude<Dir, ''>][1], door)) { m.dir = ''; return; }
          const [dx, dy] = DV[m.dir as Exclude<Dir, ''>]; m.tx = m.x + dx; m.ty = m.y + dy;
        }
        const dx = m.tx - m.x, dy = m.ty - m.y, dist = Math.abs(dx) + Math.abs(dy);
        if (dist <= move) { m.x = m.tx; m.y = m.ty; move -= dist; if (m.x < 0 || m.x >= COLS) { m.x = wrapX(m.x); m.tx = m.x; } }
        else { m.x += Math.sign(dx) * move; m.y += Math.sign(dy) * move; move = 0; }
      }
    };
    const catChoose = (m: Mover): Dir => { if (m.want && !wall(m.x + DV[m.want as Exclude<Dir, ''>][0], m.y + DV[m.want as Exclude<Dir, ''>][1])) return m.want; return m.dir; };
    const tick = (dt: number) => {
      const g = G.current; if (!g.live || g.paused) return;
      g.t += dt; g.left -= dt; if (g.super > 0) g.super -= dt; if (g.bonk > 0) g.bonk -= dt;
      if (!g.warned && g.left <= 10) { g.warned = true; play('buildup', 0.55); say("Santa's coming! Hurry!"); }
      if (g.left <= 0) { g.left = 0; endSanta(); return; }
      // cat (a reverse is allowed any time, like a real chase)
      const cat = g.cat;
      if (cat.dir && cat.want && cat.want === OPP[cat.dir] && (cat.x !== cat.tx || cat.y !== cat.ty)) { const [dx, dy] = DV[cat.dir]; cat.tx -= dx; cat.ty -= dy; cat.dir = cat.want; }
      if (g.bonk <= 0) step(cat, dt, catChoose);
      if (cat.dir === 'left') g.face = -1; if (cat.dir === 'right') g.face = 1;
      const cx = Math.round(cat.x), cy = Math.round(cat.y), ck = `${wrapX(cx)},${cy}`;
      if (g.dots.delete(ck)) { g.score += 20; play('jingle', 0.5); } // 774: her jingle bells sound
      if (g.canes.delete(ck)) { g.super = calm ? 8 : 7; g.score += 50; play('star', 0.6); flashRef.current('Candy cane! The snowmen run away. Bump them to poof them home!', 'candy'); }
      // mouse: runs to the open tile farthest from the cat, with a little wobble so it is catchable
      const dc = distMap(wrapX(cx), cy);
      step(g.mouse, dt, (m) => {
        const opts = openDirs(m.x, m.y); const back = OPP[m.dir];
        const choices = opts.filter((d) => d !== back); const list = choices.length ? choices : opts;
        let best: Dir = list[0] ?? '', bv = -1;
        for (const d of list) { const nx = wrapX(m.x + DV[d][0]), ny = m.y + DV[d][1]; const v = dc[ny][nx] + Math.random() * (g.round < 3 ? 3 : 2); if (v > bv) { bv = v; best = d; } }
        return best;
      });
      if (g.mouse.dir === 'left') g.mface = -1; if (g.mouse.dir === 'right') g.mface = 1;
      // snowmen: leave the fort one by one, then wander toward the cat (or away during a candy cane)
      for (const s of g.snow) {
        if (s.out > 0) { s.out -= dt; continue; }
        s.speed = g.super > 0 ? SNOW_SPEED * 0.6 : SNOW_SPEED + g.round * 0.08;
        step(s, dt, (m) => {
          const opts = openDirs(m.x, m.y, true); const back = OPP[m.dir];
          const list = opts.filter((d) => d !== back).length ? opts.filter((d) => d !== back) : opts;
          if (MAZE[m.y][m.x] === 'S' || MAZE[m.y][m.x] === '-') return m.x < DOOR_X ? 'right' : m.x > DOOR_X ? 'left' : 'up';
          if (Math.random() < 0.35) return list[Math.floor(Math.random() * list.length)];
          let best: Dir = list[0], bv = g.super > 0 ? -1 : 1e9;
          for (const d of list) { const v = dc[m.y + DV[d][1]][wrapX(m.x + DV[d][0])]; if (g.super > 0 ? v > bv : v < bv) { bv = v; best = d; } }
          return best;
        }, true);
        if (Math.abs(s.x - cat.x) + Math.abs(s.y - cat.y) < 0.7) {
          if (g.super > 0) { g.poofs.push({ x: s.x, y: s.y, t: 0.6 }); Object.assign(s, mover(s.home, SNOW_SPEED), { out: 3 }); g.score += 60; play('poof', 0.6); }
          else if (g.bonk <= 0) { play('bonk', 0.6); g.poofs.push({ x: cat.x, y: cat.y, t: 0.6 }); Object.assign(cat, mover(CAT0, CAT_SPEED)); g.bonk = 0.8; flashRef.current('Bonk! A snowman threw a snowball. Back to the start!', 'snowman'); }
        }
      }
      for (const p of g.poofs) p.t -= dt; g.poofs = g.poofs.filter((p) => p.t > 0);
      if (Math.abs(g.mouse.x - cat.x) + Math.abs(g.mouse.y - cat.y) < 0.75) endCaught();
    };
    const draw = () => {
      const g = G.current; const t = performance.now() / 1000;
      ctx.fillStyle = '#16233f'; ctx.fillRect(0, 0, c.width, c.height);
      // walls: icy hedges with snow on top
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const ch = MAZE[y][x];
        if (ch === '#') { ctx.fillStyle = '#2f6b55'; ctx.fillRect(x * T + 1, y * T + 1, T - 2, T - 2); ctx.fillStyle = '#3f8a6c'; ctx.fillRect(x * T + 3, y * T + 8, T - 6, T - 11); ctx.fillStyle = '#eef6ff'; ctx.fillRect(x * T + 1, y * T + 1, T - 2, 7); ctx.fillStyle = '#c9def5'; ctx.fillRect(x * T + 1, y * T + 7, T - 2, 2); }
        if (ch === '-') { ctx.fillStyle = '#ff6fa3'; ctx.fillRect(x * T + 2, y * T + T / 2 - 3, T - 4, 6); }
        if (ch === 'S') { ctx.fillStyle = '#20345c'; ctx.fillRect(x * T, y * T, T, T); }
      }
      // snowflakes and candy canes
      for (const k of g.dots) { const [x, y] = k.split(',').map(Number); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x * T + T / 2, y * T + T / 2, 3.2, 0, 7); ctx.fill(); }
      const cane = img('candy');
      for (const k of g.canes) { const [x, y] = k.split(',').map(Number); const bob = calm ? 0 : Math.sin(t * 4) * 2; if (ok(cane)) ctx.drawImage(cane, x * T + 4, y * T + 3 + bob, T - 8, T - 8); }
      // snowmen
      const sn = img('snowman');
      for (const s of g.snow) {
        const fr = Math.floor(t * 6) % 6;
        ctx.save(); if (g.super > 0) { ctx.globalAlpha = g.super < 2 && Math.floor(t * 8) % 2 ? 0.5 : 0.85; ctx.filter = 'hue-rotate(180deg) saturate(1.6)'; }
        if (ok(sn)) ctx.drawImage(sn, fr * 32, 0, 32, 32, s.x * T - 2, s.y * T - 4, T + 4, T + 4);
        ctx.restore();
      }
      // mouse
      const ms = img('mouse');
      if (ok(ms)) { const fr = Math.floor(t * 10) % 4; ctx.save(); ctx.translate(g.mouse.x * T + T / 2, g.mouse.y * T + T / 2); ctx.scale(g.mface, 1); ctx.drawImage(ms, fr * 42, 0, 32, 32, -T / 2, -T / 2 - 2, T, T); ctx.restore(); }
      // cat
      const ct = img('cat-run');
      if (ok(ct)) { const moving = !!g.cat.dir && g.live; const fr = moving ? Math.floor(t * 12) % 7 : 0; ctx.save(); ctx.translate(g.cat.x * T + T / 2, g.cat.y * T + T / 2); ctx.scale(g.face, 1); if (g.super > 0) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 12; } ctx.drawImage(ct, fr * 32, 0, 32, 32, -T * 0.6, -T * 0.7, T * 1.2, T * 1.2); ctx.restore(); }
      // poofs
      for (const p of g.poofs) { ctx.fillStyle = `rgba(255,255,255,${p.t})`; for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.28, r = (0.6 - p.t) * 40 + 4; ctx.beginPath(); ctx.arc(p.x * T + T / 2 + Math.cos(a) * r, p.y * T + T / 2 + Math.sin(a) * r, 4, 0, 7); ctx.fill(); } }
      // falling snow
      if (!calm) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < 40; i++) { const x = (i * 97 + t * 18 * (1 + (i % 3))) % c.width, y = (i * 53 + t * 30 * (1 + (i % 4) * 0.3)) % c.height; ctx.fillRect(x, y, 2, 2); } }
    };
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      tick(dt); draw();
      hudT += dt; if (hudT > 0.2) { hudT = 0; setLeft(G.current.left); setScore(G.current.score); }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, calm]);

  // controls: arrow keys or W A S D, swiping on the maze, or the big arrow buttons
  const steer = (d: Dir) => { G.current.cat.want = d; };
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const m: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right' };
      const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA)$/.test(t.tagName)) return;
      if (m[e.key] && G.current.live) { e.preventDefault(); steer(m[e.key]); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, []);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { swipe.current = { x: e.clientX, y: e.clientY }; };
  const onMove = (e: React.PointerEvent) => {
    const s = swipe.current; if (!s) return; const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.hypot(dx, dy) < 24) return;
    steer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); swipe.current = { x: e.clientX, y: e.clientY };
  };

  const total = roundSecs(round);
  const santaAt = Math.max(0, Math.min(1, 1 - left / total));
  const howTo = `You are a cat in a Santa hat. Catch the mouse before Santa comes! Steer the cat with the arrow buttons, by swiping on the maze, or with the arrow keys. Every round has a timer. When Santa reaches the end of the snowy path at the top, the round is over. Each round is 10 seconds longer, and the mouse gets a little quicker. Grab snowflakes for points. A candy cane makes the snowmen run away, and bumping one then poofs it home. If a snowman bumps you, you go back to the start.${learn ? ' In Learn mode, answer a question to start each round.' : ''}`;
  const menu = useMemo(() => [{ id: 'xc-help', icon: '❓', label: 'How to play', bg: '#3a4fb0', order: 5, onSelect: () => setHelp(true) }], []);
  const leave = () => { pay(); back.go(); };

  return (
    <div className="xc">
      <MenuItems items={menu} />
      <header className="fd-head xc-head">
        <LeaveButton onLeave={leave} note="Your best round is kept on this iPad, and your right answers are paid." />
        <strong className="xc-title">Christmas Cat Chase</strong>
        <span className="xc-pill">Round {round}</span>
        <span className="xc-pill">{score.toLocaleString()} points</span>
        <span className={`xc-pill${learn ? ' xc-learn' : ''}`}>{learn ? 'Learn mode' : 'Play mode'}</span>
        <SfxToggle />
        <button type="button" className="btn" onClick={() => setMusic((m) => !m)}>{music ? 'Music: on' : 'Music: off'}</button>
        <button type="button" className="btn" onClick={() => setReadOn((r) => !r)}>{readOn ? 'Read aloud: on' : 'Read aloud: off'}</button>
        <MyBest game="christmasCatChase" unit="round" />
      </header>
      {started && (
        <div className="xc-santa" aria-label={`${Math.ceil(left)} seconds until Santa comes`}>
          <span className="xc-path"><i style={{ width: `${santaAt * 100}%` }} /></span>
          <img className="xc-santa-walk" src={`${A}santa.png`} alt="" style={{ left: `calc(${santaAt * 100}% - 24px)`, animationPlayState: phase === 'play' ? 'running' : 'paused' }} />
          <img className="xc-tree" src={`${A}tree.png`} alt="" />
          <b className={left <= 10 && phase === 'play' ? 'xc-hurry' : ''}>{left <= 10 && phase === 'play' ? `Santa's coming! ${Math.ceil(left)}` : `${Math.ceil(left)} seconds`}</b>
        </div>
      )}
      <div className="xc-stage">
        <canvas ref={cv} className="xc-canvas" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { swipe.current = null; }} onPointerCancel={() => { swipe.current = null; }} aria-label="The snowy maze" />
        {msg && phase === 'play' && <div className="xc-msg" role="status">{msg}</div>}
        {flash && phase === 'play' && (
          <div className="xc-flash-wrap" role="alertdialog" aria-label={flash.text}>
            <div className="xc-flash">
              <img src={`${A}${flash.pic}.png`} alt="" />
              <p>{flash.text}</p>
              <small>Tap anywhere or press any key</small>
            </div>
          </div>
        )}
        {started && phase === 'ready' && !asking && (
          <div className="xc-center"><div className="xc-card">
            <h2>Round {round}</h2>
            <p>Catch the mouse before Santa comes. This round is {roundSecs(round)} seconds.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => startRound(round)}>Start round {round}</button>
          </div></div>
        )}
        {(phase === 'caught' || phase === 'santa') && (
          <div className="xc-center"><div className="xc-card" role="dialog" aria-label={phase === 'caught' ? 'You caught the mouse' : 'Santa is here'}>
            <img src={`${A}${phase === 'caught' ? 'gift' : 'santa'}.png`} alt="" className="xc-card-pic" />
            <h2>{phase === 'caught' ? 'You caught the mouse!' : 'Santa is here!'}</h2>
            <p>{msg} <button type="button" className="btn" onClick={() => speak(msg, tts)} aria-label="Listen">🔊</button></p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => startRound(phase === 'caught' ? round + 1 : round)}>{phase === 'caught' ? `Round ${round + 1}` : 'Try again'}</button>
            <p className="xc-best">Best round: {Math.max(save.best, phase === 'caught' ? round : 0)} · Best points: {save.bestScore.toLocaleString()}</p>
          </div></div>
        )}
      </div>
      {started && (
        <div className="xc-pad" aria-label="Steer the cat">
          <button type="button" className="xc-btn up" onPointerDown={(e) => { e.preventDefault(); steer('up'); }} aria-label="Up">▲</button>
          <button type="button" className="xc-btn left" onPointerDown={(e) => { e.preventDefault(); steer('left'); }} aria-label="Left">◀</button>
          <button type="button" className="xc-btn right" onPointerDown={(e) => { e.preventDefault(); steer('right'); }} aria-label="Right">▶</button>
          <button type="button" className="xc-btn down" onPointerDown={(e) => { e.preventDefault(); steer('down'); }} aria-label="Down">▼</button>
        </div>
      )}
      {help && (
        <div className="xc-center xc-over" onClick={() => setHelp(false)}><div className="xc-card" onClick={(e) => e.stopPropagation()}>
          <h2>How to play <button type="button" className="btn" onClick={() => speak(howTo, tts)} aria-label="Listen">🔊</button></h2>
          <p>{howTo}</p>
          <button type="button" className="btn btn-primary" onClick={() => setHelp(false)}>Got it</button>
        </div></div>
      )}
      {!started && (
        <GameStartCard title="Christmas Cat Chase" intro={howTo} ttsSettings={tts} onStart={() => { setStarted(true); setupRound(1); window.setTimeout(() => startRound(1), 60); }}>
          {settingsPanel}
        </GameStartCard>
      )}
      {element}
    </div>
  );
}
