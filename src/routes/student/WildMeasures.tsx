import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { speak } from '../../components/ReadAloud';
import { playClip, preloadClips, sfx, SfxToggle } from '../../lib/miniSfx';
import { playCheer } from '../../lib/petSounds';
import { useAfterschoolGame } from '../../lib/afterschool';
import {
  BIOMES, BUILD, SPECIES, SP, addAnimal, areaOf, biomeAt, buildQuestion, canPlace, dailyCoins, eventQuestion, exploreQuestion, fitQuestion, h3, heightAt,
  holdsIn, newWorld, passDay, rectH, rectW, roomFor, score, sideFor, trainQuestion, unitShort, unitWords, usedSpace, wander, xy,
  type Animal, type BuildType, type Building, type Dir, type Question, type Rect, type Species, type World,
} from '../../lib/worldBox';

// World Box (Build Queue 369 to 392; her briefs in docs/measure-wilds/BRIEF.md and the Build Queue). Version 2 (391, 392):
// a top-down, blocky biome map with real wild and farm animals. The student builds fences, barns, coops, zoo enclosures
// and stone walls, explores more map, adds and names animals and tames wild ones. Every build, and every change the
// world makes on its own, pauses for one measurement question (perimeter, area, volume, a missing side, a ratio). The
// outcome happens whatever they answer; close answers earn coins, which buy farm animals.

const RIGHT = '/sounds/worldbox/right.mp3', WRONG = '/sounds/worldbox/wrong.mp3';
const TILE = 10;
type Saved = { world2?: World; coins?: number; right?: number; exact?: number; tries?: number };
type Ask = { q: Question; exactOnly?: boolean; then?: (w: World, right: boolean) => World; label?: string };
type Tool = BuildType | 'explore' | null;
const LISTEN = <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>;

// The map, drawn top down one block at a time in a blocky, Minecraft-like style.
function drawMap(ctx: CanvasRenderingContext2D, w: World) {
  const m = w.map, T = TILE;
  const f = (x: number, y: number, ww: number, hh: number, c: string) => { ctx.fillStyle = c; ctx.fillRect(x, y, ww, hh); };
  for (let y = m.y0; y <= m.y1; y++) for (let x = m.x0; x <= m.x1; x++) {
    const b = biomeAt(w, x, y), px = (x - m.x0) * T, py = (y - m.y0) * T, h = h3(x, y, w.seed), [r, g, bb] = BIOMES[b].color, j = (h - 0.5) * 16;
    f(px, py, T, T, `rgb(${r + j},${g + j},${bb + j})`);
    for (let k = 0; k < 3; k++) { const s = h3(x + k * 7, y - k * 3, w.seed + 3) > 0.5 ? 14 : -14; f(px + Math.floor(h3(x, y + k * 5, w.seed + 5) * 8), py + Math.floor(h3(x + k, y, w.seed + 9) * 8), 2, 2, `rgb(${r + s},${g + s},${bb + s})`); }
    if (b === 'forest' && h < 0.7) { f(px + 1, py + 1, 8, 8, '#2c6526'); f(px + 2, py + 2, 4, 3, '#4f9a3c'); f(px + 6, py + 6, 2, 2, '#1f4d1b'); }
    else if (b === 'meadow' && h < 0.12) { f(px + 4, py + 4, 2, 2, ['#ffe066', '#ff8fab', '#ffffff', '#b197fc'][Math.floor(h * 33) % 4]); }
    else if (b === 'meadow' && h > 0.95) { f(px + 2, py + 2, 6, 6, '#3f8a34'); f(px + 3, py + 3, 3, 2, '#5aa845'); }
    else if (b === 'desert' && h < 0.07) { f(px + 4, py + 2, 2, 6, '#3f8a3a'); f(px + 2, py + 4, 2, 2, '#3f8a3a'); f(px + 6, py + 3, 2, 2, '#3f8a3a'); }
    else if (b === 'snow' && h < 0.14) { f(px + 2, py + 2, 6, 6, '#2f5d3a'); f(px + 3, py + 3, 4, 2, '#f4f8fb'); }
    else if (b === 'wetland' && h < 0.4) { f(px + 2, py + 3, 6, 4, '#5a9ad6'); f(px + 3, py + 4, 2, 1, '#9cc4f0'); }
    else if (b === 'wetland' && h > 0.85) { f(px + 2, py + 1, 1, 6, '#6b4f2a'); f(px + 6, py + 2, 1, 6, '#6b4f2a'); }
    else if (b === 'hills' && h < 0.25) { f(px + 2, py + 3, 5, 4, '#8a8a86'); f(px + 3, py + 3, 2, 1, '#b0b0aa'); }
    else if (b === 'mountain') { const e = heightAt(w.seed, x, y); if (e > 0.84) { f(px, py, T, T, '#eef2f6'); f(px + Math.floor(h * 8), py + 6, 2, 2, '#b8c0c8'); } else { f(px, py + 7, T, 3, 'rgba(0,0,0,.16)'); f(px + 1, py + 1, 3, 2, 'rgba(255,255,255,.18)'); } }
    else if (b === 'lake' && h < 0.3) { f(px + 2, py + 4, 4, 1, '#9cc4f0'); }
  }
}
function Ground({ w, view }: { w: World; view: Rect }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const m = w.map, mw = rectW(m), mh = rectH(m), paintKey = Object.keys(w.paint).length;
  useEffect(() => { const ctx = ref.current?.getContext('2d'); if (ctx) drawMap(ctx, w); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.seed, m.x0, m.y0, mw, mh, paintKey]);
  const vw = rectW(view), vh = rectH(view);
  return <canvas ref={ref} className="wb-ground" width={mw * TILE} height={mh * TILE} aria-hidden
    style={{ left: `${((m.x0 - view.x0) / vw) * 100}%`, top: `${((m.y0 - view.y0) / vh) * 100}%`, width: `${(mw / vw) * 100}%`, height: `${(mh / vh) * 100}%` }} />;
}

function NumPad({ value, unit, onChange, onCheck }: { value: string; unit: string; onChange: (v: string) => void; onCheck: () => void }) {
  const press = (d: string) => { sfx.tick(); onChange((value + d).replace(/^0+(?=\d)/, '').slice(0, 5)); };
  return (
    <div className="wm-pad">
      <div className="wm-pad-read" aria-live="polite"><b>{value || ' '}</b><span>{unit}</span></div>
      <div className="wm-pad-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" onClick={() => press(d)}>{d}</button>)}
        <button type="button" onClick={() => { sfx.tick(); onChange(value.slice(0, -1)); }} aria-label="Delete">⌫</button>
        <button type="button" onClick={() => press('0')}>0</button>
        <button type="button" className="go" onClick={onCheck} disabled={!value}>Check</button>
      </div>
    </div>
  );
}
// A small drawing of the rectangle or box a question is about.
function Shape({ w, h, d }: { w: number; h: number; d?: number }) {
  const c = Math.min(22, 200 / Math.max(w, h + (d ?? 0)));
  if (d) {
    const ox = d * c * 0.5, oy = d * c * 0.5;
    return (
      <svg className="wm-pen" viewBox={`-2 -2 ${w * c + ox + 4} ${h * c + oy + 4}`} aria-label={`A box ${w} by ${h} by ${d}`}>
        <path d={`M0 ${oy} L${ox} 0 L${w * c + ox} 0 L${w * c} ${oy}Z`} fill="#d8e9b8" stroke="#6b8a3a" />
        <path d={`M${w * c} ${oy} L${w * c + ox} 0 L${w * c + ox} ${h * c} L${w * c} ${h * c + oy}Z`} fill="#a9c97f" stroke="#6b8a3a" />
        {Array.from({ length: w * h }, (_, i) => <rect key={i} x={(i % w) * c} y={oy + Math.floor(i / w) * c} width={c} height={c} fill="#c3dc9a" stroke="#6b8a3a" />)}
      </svg>
    );
  }
  return (
    <svg className="wm-pen" viewBox={`-2 -2 ${w * c + 4} ${h * c + 4}`} aria-label={`${w} blocks long and ${h} blocks wide`}>
      {Array.from({ length: w * h }, (_, i) => <rect key={i} x={(i % w) * c} y={Math.floor(i / w) * c} width={c} height={c} fill="#b5d38a" stroke="#6b8a3a" strokeWidth="1" />)}
      <rect x="0" y="0" width={w * c} height={h * c} fill="none" stroke="#7a4b22" strokeWidth="3" />
    </svg>
  );
}

export default function WildMeasures() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = `wm:${student?.id ?? ''}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as Saved | undefined) ?? {};
  const free = useAfterschoolGame(student?.id, 'world-box');
  const [world, setWorld] = useState<World>(() => (saved.world2?.v === 2 ? saved.world2 : newWorld()));
  const [stats, setStats] = useState({ coins: saved.coins ?? 0, right: saved.right ?? 0, exact: saved.exact ?? 0, tries: saved.tries ?? 0 });
  const [ask, setAsk] = useState<Ask | null>(null);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<{ label: 'exact' | 'close' | 'miss'; coins: number; guess: number } | null>(null);
  const [news, setNews] = useState<string | null>('Welcome to World Box! Build fences, barns and zoos, explore the map, and look after real animals. Every build is a math question.');
  const [tab, setTab] = useState<'build' | 'animals'>('build');
  const [tool, setTool] = useState<Tool>(null);
  const [size, setSize] = useState({ w: 4, h: 3, high: 2, vertical: false });
  const [ghostAt, setGhostAt] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<'world' | 'close'>('world');
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [adding, setAdding] = useState<{ s: Species; name: string; wildAnimal?: Animal } | null>(null);
  const [cellPx, setCellPx] = useState(24);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const tts = student?.ttsSettings;
  const save = (w: World, s: typeof stats) => mergeStyleRow(owner, { world2: w, ...s });
  useEffect(() => { preloadClips([RIGHT, WRONG]); return () => timers.current.forEach(clearTimeout); }, []);

  // The view: the whole map, or a close-up that can be panned.
  const m = world.map;
  const view: Rect = zoom === 'world' ? m : (() => {
    const vw = Math.min(24, rectW(m)), vh = Math.min(15, rectH(m));
    const x0 = Math.max(m.x0, Math.min(m.x1 - vw + 1, center.x - Math.floor(vw / 2))), y0 = Math.max(m.y0, Math.min(m.y1 - vh + 1, center.y - Math.floor(vh / 2)));
    return { x0, y0, x1: x0 + vw - 1, y1: y0 + vh - 1 };
  })();
  const vw = rectW(view), vh = rectH(view);
  useEffect(() => {
    const el = gridRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setCellPx(el.clientWidth / vw));
    ro.observe(el); setCellPx(el.clientWidth / vw);
    return () => ro.disconnect();
  }, [vw]);

  // Animals wander.
  useEffect(() => { const t = window.setInterval(() => setWorld((w) => ({ ...w, animals: wander(w) })), 2600); return () => clearInterval(t); }, []);

  // The world changes on its own every so often, and pauses for a question (in Afterschool mode it just happens).
  const busy = !!ask || !!tool || !!adding;
  useEffect(() => {
    if (busy || !student) return;
    const t = window.setTimeout(() => {
      const w = { ...world, side: sideFor(stats.exact) };
      const q = eventQuestion(w);
      if (free) { const d = passDay(q.apply(w)); setWorld(d.world); save(d.world, stats); const line = `${q.story} ${q.after}${d.news ? ` ${d.news}` : ''}`; setNews(line); speak(line, tts); return; }
      open({ q });
    }, free ? 9000 : 16000);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [busy, free, world.day]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;

  function open(a: Ask) {
    setAsk(a); setGuess(''); setResult(null); setNews(null);
    speak(`${a.q.story} ${a.q.ask}`, tts);
  }
  // Afterschool mode: the outcome happens with no question.
  function doNow(a: Ask) {
    let w = a.q.apply(world); if (a.then) w = a.then(w, true);
    setWorld(w); save(w, stats); playCheer(); setNews(a.q.after); speak(a.q.after, tts);
  }
  const run = (a: Ask) => (free ? doNow(a) : open(a));

  const check = () => {
    if (!ask || !guess) return;
    const g = Number(guess), r = score(g, ask.q.answer.value);
    const ok = ask.exactOnly ? r.label === 'exact' : true;
    let w = ok ? ask.q.apply(world) : world;
    if (ask.then) w = ask.then(w, r.label !== 'miss');
    const s = { coins: stats.coins + r.coins, right: stats.right + (r.label !== 'miss' ? 1 : 0), exact: stats.exact + (r.label === 'exact' ? 1 : 0), tries: stats.tries + 1 };
    setStats(s); setWorld(w); setResult({ ...r, guess: g }); save(w, s);
    playClip(r.label === 'miss' ? WRONG : RIGHT);
    const said = r.label === 'exact' ? `Spot on! ${ask.q.answer.value} ${unitWords(ask.q.answer.unit)}. Plus 3 coins.` : r.label === 'close' ? `So close! It was ${ask.q.answer.value} ${unitWords(ask.q.answer.unit)}. Plus 1 coin.` : `It was ${ask.q.answer.value} ${unitWords(ask.q.answer.unit)}. ${ask.q.hint}`;
    speak(`${said} ${ok ? ask.q.after : 'Try another one to make it happen.'}`, tts);
  };
  const done = () => {
    const { world: w0, news: n0 } = passDay(world);
    const dc = dailyCoins(w0), s = dc ? { ...stats, coins: stats.coins + dc } : stats;
    const n = [n0, dc ? `Zoo visitors and farm sales: +${dc} ${dc === 1 ? 'coin' : 'coins'}.` : null].filter(Boolean).join(' ') || null;
    setWorld(w0); setStats(s); save(w0, s); setAsk(null); setResult(null); setNews(n); if (n) speak(n, tts);
  };

  // ---- building ----
  const ghost: Rect | null = tool && tool !== 'explore' && ghostAt ? (() => {
    const len = tool === 'wall' ? size.w : size.w, ht = tool === 'wall' ? 1 : size.h;
    const [bw, bh] = tool === 'wall' && size.vertical ? [1, len] : [len, ht];
    return { x0: ghostAt.x, y0: ghostAt.y, x1: ghostAt.x + bw - 1, y1: ghostAt.y + bh - 1 };
  })() : null;
  const ghostWhy = ghost ? canPlace(world, ghost) : null;
  const pickTool = (t: Tool) => { sfx.tick(); setTool(t); setGhostAt(null); if (t && t !== 'explore') { const b = BUILD[t]; setSize((z) => ({ ...z, w: Math.max(b.minW, Math.min(b.maxW, z.w)), h: Math.max(b.minH, Math.min(b.maxH, z.h)) })); setNews(`Tap the map where the ${b.name.toLowerCase()} goes.`); } };
  const step = (k: 'w' | 'h' | 'high', d: number) => {
    if (!tool || tool === 'explore') return; const b = BUILD[tool]; sfx.tick();
    setSize((z) => ({ ...z, [k]: k === 'w' ? Math.max(b.minW, Math.min(b.maxW, z.w + d)) : k === 'h' ? Math.max(b.minH, Math.min(b.maxH, z.h + d)) : Math.max(1, Math.min(4, z.high + d)) }));
  };
  const build = () => {
    if (!tool || tool === 'explore' || !ghost || ghostWhy) return;
    const q = buildQuestion({ ...world, side: sideFor(stats.exact) }, tool, ghost, size.high);
    setTool(null); setGhostAt(null); run({ q });
  };
  const explore = (d: Dir) => {
    const q = exploreQuestion(world, d);
    if (!q) { setNews(`The map cannot grow any more to the ${d}.`); sfx.pop(); return; }
    setTool(null); run({ q });
  };

  // ---- animals ----
  const homesFor = (s: Species) => world.buildings.filter((b) => holdsIn(b.type, s));
  const place = (s: Species, b: Building | null, name: string, wildAnimal?: Animal) => {
    const first = !!b && !world.animals.some((a) => a.at === b.id && a.kind === s.id);
    const cost = s.wild || free ? 0 : s.price;
    if (cost > stats.coins) { setNews(`A ${s.name.toLowerCase()} costs ${cost} coins. You have ${stats.coins}. Answer questions to earn more.`); sfx.pop(); return; }
    const put = (w: World) => addAnimal(w, s, b, name, wildAnimal);
    setAdding(null);
    if (cost) { const st = { ...stats, coins: stats.coins - cost }; setStats(st); }
    if (b && first && !free) { open({ q: fitQuestion(world, b, s), then: (w) => put(w) }); return; }
    const w = put(world); setWorld(w); save(w, cost ? { ...stats, coins: stats.coins - cost } : stats); sfx.coin();
    setNews(`${name || 'A new'} ${s.name.toLowerCase()} ${s.icon} ${wildAnimal ? 'moved into the zoo' : b ? `moved into the ${b.name.toLowerCase()}` : `is roaming the ${s.home.map((h) => BIOMES[h].word).join(' and ')}`}. ${s.fact}`);
  };
  const tapMap = (e: React.PointerEvent) => {
    const r = gridRef.current!.getBoundingClientRect();
    const x = view.x0 + Math.floor(((e.clientX - r.left) / r.width) * vw), y = view.y0 + Math.floor(((e.clientY - r.top) / r.height) * vh);
    if (tool && tool !== 'explore') { setGhostAt({ x, y }); sfx.tick(); return; }
    const a = world.animals.find((z) => !z.at && Math.abs(z.x - x) <= 0 && Math.abs(z.y - y) <= 0 && SP(z.kind).wild);
    if (a) { sfx.tick(); setTab('animals'); setAdding({ s: SP(a.kind), name: '', wildAnimal: a }); setNews(`A wild ${SP(a.kind).name.toLowerCase()} ${SP(a.kind).icon}. ${SP(a.kind).fact} You can tame it if a zoo enclosure has room.`); return; }
    if (zoom === 'world') { setCenter({ x, y }); setZoom('close'); sfx.tick(); }
  };

  const L = (x: number) => `${((x - view.x0) / vw) * 100}%`, T = (y: number) => `${((y - view.y0) / vh) * 100}%`;
  const box = (r: Rect) => ({ left: L(r.x0), top: T(r.y0), width: `${(rectW(r) / vw) * 100}%`, height: `${(rectH(r) / vh) * 100}%` });
  const mark = ask && !result ? ask.q.mark : undefined;
  const wild = world.animals.filter((a) => !a.at).length, tame = world.animals.filter((a) => a.at).length;
  const q = ask?.q;

  return (
    <div className="wm wb">
      <header className="wm-head">
        <LeaveButton plain onLeave={() => back.go()} note="Your world, buildings and coins are saved." />
        <h1>World Box</h1>
        {free && <span className="wm-chip as" title="Afterschool mode is on in Settings">🏠 Afterschool</span>}
        <SfxToggle plain />
        <span className="wm-chip" aria-label={`${stats.coins} coins`}>🪙 {stats.coins}</span>
      </header>

      <main className="wm-main">
        <section className="wm-board" aria-label="The World Box map">
          <div ref={gridRef} className={`wb-grid${tool && tool !== 'explore' ? ' placing' : ''}`} onPointerUp={tapMap}
            style={{ aspectRatio: `${vw} / ${vh}`, width: `min(100%, calc((100dvh - 150px) * ${(vw / vh).toFixed(3)}))`, ['--cell' as string]: `${cellPx}px` }}>
            <Ground w={world} view={view} />
            <div className="wb-lines" style={{ backgroundSize: `${100 / vw}% ${100 / vh}%` }} />
            {world.buildings.map((b) => (
              <span key={b.id} className={`wb-b ${b.type}`} style={box(b.r)} title={b.name}>
                {b.type !== 'wall' && cellPx * rectW(b.r) > 50 && <b>{BUILD[b.type].icon} {b.name}</b>}
              </span>
            ))}
            {mark && (Array.isArray(mark) ? mark.map((c) => { const [x, y] = xy(c); return <i key={c} className="wb-mark" style={box({ x0: x, y0: y, x1: x, y1: y })} />; })
              : <i className="wb-mark box" style={box(mark)} />)}
            {ghost && <i className={`wb-ghost${ghostWhy ? ' bad' : ''}`} style={box(ghost)} />}
            {world.animals.filter((a) => a.x >= view.x0 && a.x <= view.x1 && a.y >= view.y0 && a.y <= view.y1).map((a) => (
              <span key={a.id} className={`wb-animal${a.at ? ' tame' : ''}`} style={{ left: L(a.x + 0.5), top: T(a.y + 0.5) }} aria-hidden>
                {SP(a.kind).icon}{a.lv ? <em>★{a.lv}</em> : null}
                {a.name && cellPx > 18 && <small>{a.name}</small>}
              </span>
            ))}
          </div>
          <div className="wm-scale">
            <span><span className="wm-scale-bar" style={{ width: `${100 / vw}%` }} /> 1 block = {sideFor(stats.exact)} {unitShort(world.unit)} on each side</span>
            {zoom === 'close' && <span className="wb-pan" role="group" aria-label="Move the map">
              {([['◀', -6, 0, 'left'], ['▲', 0, -4, 'up'], ['▼', 0, 4, 'down'], ['▶', 6, 0, 'right']] as const).map(([t, dx, dy, lab]) => <button key={lab} type="button" aria-label={`Move ${lab}`} onClick={() => { sfx.tick(); setCenter((c) => ({ x: c.x + dx, y: c.y + dy })); }}>{t}</button>)}
            </span>}
            <button type="button" className="wm-zoom" onClick={() => { sfx.tick(); setZoom(zoom === 'world' ? 'close' : 'world'); }}>{zoom === 'world' ? '🔍 Close up' : `🌍 Whole map (${rectW(m)} × ${rectH(m)})`}</button>
          </div>
        </section>

        <aside className="wm-side">
          <div className="wm-stats">
            <span><b>Day {world.day}</b> · map {rectW(m)} × {rectH(m)} = {rectW(m) * rectH(m)} blocks</span>
            <span>🐾 {wild} wild · 🏡 {tame} in buildings · {world.buildings.length} buildings</span>
            <span className="wm-biomes" aria-label="Biomes found">{world.found.map((b) => <em key={b}><i style={{ background: `rgb(${BIOMES[b].color.join(',')})` }} />{BIOMES[b].name}</em>)}</span>
          </div>

          {q ? (
            <div className={`wm-card${result ? ` reveal ${result.label}` : ''}`}>
              <button type="button" className="wm-say" onClick={() => speak(result ? `${q.after} ${q.hint}` : `${q.story} ${q.ask}`, tts)} aria-label="Listen">{LISTEN}</button>
              <p className="wm-story">{q.story}</p>
              {q.shape && <Shape {...q.shape} />}
              {!result ? <>
                <p className="wm-ask"><b>Solve:</b> {q.ask}</p>
                <NumPad value={guess} unit={unitShort(q.answer.unit)} onChange={setGuess} onCheck={check} />
              </> : <>
                <p className="wm-result">{result.label === 'exact' ? 'Spot on! +3 coins' : result.label === 'close' ? 'So close! +1 coin' : 'Good try.'}</p>
                <p>You said <b>{result.guess} {unitShort(q.answer.unit)}</b>. It was <b>{q.answer.value} {unitShort(q.answer.unit)}</b>.</p>
                <p className="wm-hint">{q.hint}</p>
                <p>{ask!.exactOnly && result.label !== 'exact' ? 'It needs an exact answer. Try another one.' : q.after}</p>
                <button type="button" className="wm-go" onClick={done}>Keep playing</button>
              </>}
            </div>
          ) : adding ? (
            <div className="wm-card">
              <h2>{adding.s.icon} {adding.wildAnimal ? `Tame this ${adding.s.name.toLowerCase()}` : `Add a ${adding.s.name.toLowerCase()}`}</h2>
              <p className="wm-story">{adding.s.fact} {adding.s.wild ? `Each one needs ${adding.s.space} square ${adding.s.space === 1 ? 'block' : 'blocks'} in a zoo enclosure.` : `It lives in a ${adding.s.lives}, and needs ${adding.s.space} square ${adding.s.space === 1 ? 'block' : 'blocks'}. Cost: ${free ? 'free' : `${adding.s.price} coins`}.`}</p>
              <label className="wb-name">Name it: <input id="wb-name" value={adding.name} maxLength={16} onChange={(e) => setAdding({ ...adding, name: e.target.value.replace(/[^A-Za-z' -]/g, '') })} placeholder="Type a name" /></label>
              <div className="wb-list">
                {homesFor(adding.s).map((b) => { const ok = roomFor(world, b, adding.s); return (
                  <button key={b.id} type="button" disabled={!ok} onClick={() => place(adding.s, b, adding.name.trim(), adding.wildAnimal)}>
                    {BUILD[b.type].icon} {b.name} · {usedSpace(world, b)} of {areaOf(b)} blocks used{ok ? '' : ' (full)'}
                  </button>
                ); })}
                {adding.s.wild && !adding.wildAnimal && <button type="button" onClick={() => place(adding.s, null, adding.name.trim())}>🌿 Let it roam the {adding.s.home.map((h) => BIOMES[h].word).join(' and ')}</button>}
                {!homesFor(adding.s).length && <p className="wm-hint">{adding.s.wild ? 'Build a zoo enclosure first (Build tab).' : `Build a ${adding.s.lives === 'pasture' ? 'fenced pasture' : adding.s.lives === 'coop' ? 'chicken coop' : 'barn'} first (Build tab).`}</p>}
              </div>
              <button type="button" className="wm-go" onClick={() => setAdding(null)}>Back</button>
            </div>
          ) : (
            <div className="wm-card wb-tools">
              <span className="sn-seg wb-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'build'} className={tab === 'build' ? 'on' : ''} onClick={() => { sfx.tick(); setTab('build'); }}>🔨 Build</button>
                <button type="button" role="tab" aria-selected={tab === 'animals'} className={tab === 'animals' ? 'on' : ''} onClick={() => { sfx.tick(); setTab('animals'); setTool(null); }}>🐄 Animals</button>
              </span>
              {news && <p className="wm-news">{news} <button type="button" className="wb-mini" onClick={() => speak(news, tts)} aria-label="Listen">🔊</button></p>}
              {tab === 'build' && <>
                <div className="wb-toolgrid">
                  {(Object.keys(BUILD) as BuildType[]).map((t) => <button key={t} type="button" className={tool === t ? 'on' : ''} onClick={() => pickTool(tool === t ? null : t)}><span>{BUILD[t].icon}</span>{BUILD[t].name}</button>)}
                  <button type="button" className={tool === 'explore' ? 'on' : ''} onClick={() => pickTool(tool === 'explore' ? null : 'explore')}><span>🧭</span>Explore the map</button>
                </div>
                {tool === 'explore' && <div className="wb-dirs">{(['north', 'west', 'east', 'south'] as Dir[]).map((d) => <button key={d} type="button" onClick={() => explore(d)}>{d === 'north' ? '⬆️' : d === 'south' ? '⬇️' : d === 'east' ? '➡️' : '⬅️'} {d}</button>)}</div>}
                {tool && tool !== 'explore' && <div className="wb-size">
                  <p className="wm-hint">Holds {BUILD[tool].holds}.</p>
                  <div><span>{tool === 'wall' ? 'Length' : 'Long'}</span><button type="button" onClick={() => step('w', -1)} aria-label="Shorter">−</button><b>{size.w}</b><button type="button" onClick={() => step('w', 1)} aria-label="Longer">+</button></div>
                  {tool === 'wall'
                    ? <><div><span>High</span><button type="button" onClick={() => step('high', -1)} aria-label="Lower">−</button><b>{size.high}</b><button type="button" onClick={() => step('high', 1)} aria-label="Higher">+</button></div>
                      <button type="button" className="wb-mini wide" onClick={() => { sfx.tick(); setSize((z) => ({ ...z, vertical: !z.vertical })); }}>{size.vertical ? '↕️ Up and down' : '↔️ Side to side'}</button></>
                    : <div><span>Wide</span><button type="button" onClick={() => step('h', -1)} aria-label="Narrower">−</button><b>{size.h}</b><button type="button" onClick={() => step('h', 1)} aria-label="Wider">+</button></div>}
                  <p className={ghostWhy ? 'wb-bad' : ''}>{!ghost ? 'Tap the map to place it.' : ghostWhy ?? 'Looks good!'}</p>
                  <button type="button" className="wm-go" disabled={!ghost || !!ghostWhy} onClick={build}>{free ? 'Build it' : 'Build it (answer a question)'}</button>
                </div>}
              </>}
              {tab === 'animals' && <>
                <h3>Farm animals</h3>
                <div className="wb-species">{SPECIES.filter((s) => !s.wild).map((s) => <button key={s.id} type="button" onClick={() => { sfx.tick(); setAdding({ s, name: '' }); }}><span>{s.icon}</span>{s.name}<small>{free ? 'free' : `${s.price} coins`}</small></button>)}</div>
                <h3>Wild animals</h3>
                <div className="wb-species">{SPECIES.filter((s) => s.wild).map((s) => <button key={s.id} type="button" onClick={() => { sfx.tick(); setAdding({ s, name: '' }); }}><span>{s.icon}</span>{s.name}</button>)}</div>
                <p className="wm-hint">Tap a wild animal on the map to tame it into a zoo enclosure.</p>
                {world.animals.some((a) => a.at) && <><h3>Your animals</h3>
                  <ul className="wb-mine">{world.animals.filter((a) => a.at).map((a) => (
                    <li key={a.id}><span>{SP(a.kind).icon}</span><b>{a.name}</b><small>level {a.lv ?? 0} of 3</small>
                      <button type="button" disabled={(a.lv ?? 0) >= 3} onClick={() => run({ q: trainQuestion({ ...world, side: sideFor(stats.exact) }, a), exactOnly: true })}>⭐ Train</button></li>
                  ))}</ul></>}
              </>}
            </div>
          )}
          <p className="wm-foot">{stats.right} right · tap the whole map to zoom in there</p>
        </aside>
      </main>
    </div>
  );
}

