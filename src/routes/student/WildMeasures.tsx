import { memo, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { speak } from '../../components/ReadAloud';
import { playClip, preloadClips } from '../../lib/miniSfx';
import { playCheer } from '../../lib/petSounds';
import { useAfterschoolGame } from '../../lib/afterschool';
import { payForAnswers } from '../../lib/gameEarnings';
import { ambience, setWorldMusic, setWorldSfx, startWorldMusic, stopWorldMusic, worldSfx } from '../../lib/worldSound';
import {
  BIOMES, BUILD, DESIGN_ICONS, GOALS, SEASON_ICON, SPECIES, SP, XP_FOR, XP_TIERS, addAnimal, addCustomSpecies, alphaOf, areaOf, biomeAt, buildQuestion, canPlace,
  designQuestion, eventQuestion, exploreQuestion, fitQuestion, h3, heightAt, holdsIn, levelOf, makeSpecies, newWorld, passDay, rectH, rectW, repairQuestion,
  roomFor, score, seasonOf, sideFor, spawnDesigned, trainQuestion, unitShort, unitWords, usedSpace, wander, xy,
  type Animal, type BiomeId, type BuildType, type Building, type Dir, type Question, type Rect, type Species, type World,
} from '../../lib/worldBox';

// World Box (Build Queue 369 to 407; her briefs in docs/measure-wilds/BRIEF.md, the plan in docs/WORLD_BOX_PLAN.md).
// A top-down, blocky biome map with real wild and farm animals. The student builds fences, barns, coops, zoo enclosures,
// stone walls and dens, explores more map, adds and names animals, tames wild ones and designs new ones. Every build,
// and every change the world makes on its own (seasons, storms, migrations, rival packs, evolution), pauses for one
// measurement question. Build Queue 407 (her answers): no coins; each right answer pays $1 Class Cash to the bank when
// the student leaves, and earns XP, with XP bonuses at 10, 25 and 45 right answers. Kept 2D.

const RIGHT = '/sounds/worldbox/right.mp3', WRONG = '/sounds/worldbox/wrong.mp3';
const TILE = 10;
type Saved = { world2?: World; right?: number; exact?: number; tries?: number; xp?: number };
type Ask = { q: Question; exactOnly?: boolean; then?: (w: World, right: boolean) => World };
type Tool = BuildType | 'explore' | null;
const LISTEN = <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>;
const lsGet = (k: string, d: number) => { try { const v = localStorage.getItem(k); return v === null ? d : Number(v); } catch { return d; } };
const lsSet = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private mode */ } };

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

function NumPad({ value, unit, onChange, onCheck, tap }: { value: string; unit: string; onChange: (v: string) => void; onCheck: () => void; tap: () => void }) {
  const press = (d: string) => { tap(); if (d === '.' && value.includes('.')) return; onChange((value + d).replace(/^0+(?=\d)/, '').slice(0, 7)); };
  return (
    <div className="wm-pad">
      <div className="wm-pad-read" aria-live="polite"><b>{value || ' '}</b><span>{unit}</span></div>
      <div className="wm-pad-keys wb-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((d) => <button key={d} type="button" onClick={() => press(d)} aria-label={d === '.' ? 'Decimal point' : d}>{d}</button>)}
        <button type="button" onClick={() => { tap(); onChange(value.slice(0, -1)); }} aria-label="Delete">⌫</button>
        <button type="button" className="go wb-check" onClick={onCheck} disabled={!value}>Check</button>
      </div>
    </div>
  );
}
// A small drawing of the rectangle, box or stepped mountain a question is about.
function Shape({ w, h, d, layers }: { w: number; h: number; d?: number; layers?: [number, number][] }) {
  if (layers) {
    const c = 18, top = layers.length * c + 4;
    return (
      <svg className="wm-pen" viewBox={`-2 -2 ${layers[0][0] * c + 4} ${top + 4}`} aria-label={`A stepped mountain with ${layers.length} layers`}>
        {layers.map(([lw], i) => { const x = ((layers[0][0] - lw) * c) / 2, y = top - (i + 1) * c; return <rect key={i} x={x} y={y} width={lw * c} height={c} fill={['#9a9aa0', '#b0b0b6', '#e8edf2'][i] ?? '#ccc'} stroke="#55555a" strokeWidth="2" />; })}
      </svg>
    );
  }
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

// Build Queue 409 (her words: "the game has becomre very laggy"): the animals are their own layer, drawn again only
// when the animals or the view change (not on every key press or panel change), and they move with transforms, which
// the iPad's graphics chip animates without re-laying out the page.
const AnimalLayer = memo(function AnimalLayer({ w, view, cellPx, alphas, winter }: { w: World; view: Rect; cellPx: number; alphas: Set<string>; winter: boolean }) {
  return (
    <div className="wb-animals" aria-hidden>
      {w.animals.filter((a) => a.x >= view.x0 && a.x <= view.x1 && a.y >= view.y0 && a.y <= view.y1).map((a) => {
        const b = biomeAt(w, a.x, a.y), ev = (w.evolved?.[a.kind] ?? []).length;
        return (
          <span key={a.id} className={`wb-animal${a.at ? ' tame' : ''}${b === 'lake' && !winter ? ' swim' : ''}`} style={{ ['--x' as string]: a.x - view.x0 + 0.5, ['--y' as string]: a.y - view.y0 + 0.5 }}>
            <i key={`${a.x},${a.y}`} className={`wb-body${(a.dir ?? -1) > 0 ? ' flip' : ''}`}>{SP(a.kind).icon}</i>
            {alphas.has(a.id) && cellPx > 14 && <u className="wb-crown">👑</u>}
            {ev > 0 && cellPx > 18 && <u className="wb-evo">✨</u>}
            {a.lv ? <em>★{a.lv}</em> : null}
            {a.name && cellPx > 18 && <small>{a.name}</small>}
          </span>
        );
      })}
    </div>
  );
}, (p, n) => p.w.animals === n.w.animals && p.w.evolved === n.w.evolved && p.view.x0 === n.view.x0 && p.view.y0 === n.view.y0 && p.view.x1 === n.view.x1 && p.view.y1 === n.view.y1 && p.cellPx === n.cellPx && p.winter === n.winter && p.alphas.size === n.alphas.size);

export default function WildMeasures() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = `wm:${student?.id ?? ''}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as Saved | undefined) ?? {};
  const free = useAfterschoolGame(student?.id, 'world-box');
  const [world, setWorld] = useState<World>(() => { const w = saved.world2?.v === 2 ? saved.world2 : newWorld(); addCustomSpecies(w.custom); return w; });
  const [stats, setStats] = useState({ right: saved.right ?? 0, exact: saved.exact ?? 0, tries: saved.tries ?? 0, xp: saved.xp ?? 0 });
  const [ask, setAsk] = useState<Ask | null>(null);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<{ label: 'exact' | 'close' | 'miss'; guess: number; xp: number } | null>(null);
  const [news, setNews] = useState<string | null>('Welcome to World Box! Build, explore and look after real animals. Every build is a math question, and every right answer earns XP and $1 for your bank.');
  const [tab, setTab] = useState<'build' | 'animals' | 'world'>('build');
  const [tool, setTool] = useState<Tool>(null);
  const [size, setSize] = useState({ w: 4, h: 3, high: 2, vertical: false });
  const [ghostAt, setGhostAt] = useState<{ x: number; y: number } | null>(null);
  const [zoom, setZoom] = useState<'world' | 'close'>('world');
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [adding, setAdding] = useState<{ s: Species; name: string; wildAnimal?: Animal } | null>(null);
  const [design, setDesign] = useState<{ name: string; icon: string; home: BiomeId; size: number } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [soundOpen, setSoundOpen] = useState(false);
  const [sfxVol, setSfxVol] = useState(() => lsGet('wb-sfx', 4));
  const [musicVol, setMusicVol] = useState(() => lsGet('wb-music', 3));
  const [cellPx, setCellPx] = useState(24);
  const [flock, setFlock] = useState(0);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<number[]>([]);
  const visitRight = useRef(0);
  const tts = student?.ttsSettings;
  const save = (w: World, s: typeof stats) => mergeStyleRow(owner, { world2: w, ...s });
  const tap = () => worldSfx.tap();
  useEffect(() => { preloadClips([RIGHT, WRONG]); startWorldMusic(); return () => { timers.current.forEach(clearTimeout); stopWorldMusic(); }; }, []);
  useEffect(() => { setWorldSfx(sfxVol); lsSet('wb-sfx', sfxVol); }, [sfxVol]);
  useEffect(() => { setWorldMusic(musicVol); lsSet('wb-music', musicVol); }, [musicVol]);

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

  // Animals wander, and the biome in the middle of the view makes its sounds. Day and night run on a 4 minute clock.
  const night = () => ((Date.now() / 240000) % 1) > 0.72;
  const midBiome = biomeAt(world, Math.floor((view.x0 + view.x1) / 2), Math.floor((view.y0 + view.y1) / 2));
  const midRef = useRef(midBiome); midRef.current = midBiome;
  useEffect(() => {
    const t = window.setInterval(() => setWorld((w) => ({ ...w, animals: wander(w) })), 2600);
    const a = window.setInterval(() => ambience(midRef.current, night()), 4500);
    const f = window.setInterval(() => { if (Math.random() < 0.35) setFlock(Date.now()); }, 20000);
    return () => { clearInterval(t); clearInterval(a); clearInterval(f); };
  }, []);

  // The world changes on its own every so often, and pauses for a question (in Afterschool mode it just happens).
  const busy = !!ask || !!tool || !!adding || !!design;
  useEffect(() => {
    if (busy || !student) return;
    const t = window.setTimeout(() => {
      const w = { ...world, side: sideFor(stats.exact) };
      const q = eventQuestion(w);
      if (q.kind === 'rival' || q.kind === 'perimeter' && q.story.startsWith('A windstorm')) worldSfx.storm();
      if (free) { const d = passDay(q.apply(w)); setWorld(d.world); save(d.world, stats); const line = `${q.story} ${q.after}${d.news ? ` ${d.news}` : ''}`; setNews(line); speak(line, tts); return; }
      open({ q });
    }, free ? 9000 : 16000);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [busy, free, world.day]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;

  function open(a: Ask) {
    setAsk(a); setGuess(''); setResult(null); setNews(null);
    speak(`${a.q.story} ${a.q.ask}${a.q.choices ? ` ${a.q.choices.join('. ')}.` : ''}`, tts);
  }
  const celebrate = (w: World, before: World) => {
    const nb = w.buildings.find((b) => !before.buildings.some((x) => x.id === b.id));
    if (nb) { setFresh(nb.id); window.setTimeout(() => setFresh(null), 2600); worldSfx.build(nb.type === 'wall' ? rectW(nb.r) * rectH(nb.r) * (nb.high ?? 1) : nb.type === 'den' ? areaOf(nb) * (nb.depth ?? 1) : 4); }
  };
  // Afterschool mode: the outcome happens with no question.
  function doNow(a: Ask) {
    let w = a.q.apply(world); if (a.then) w = a.then(w, true);
    celebrate(w, world); setWorld(w); save(w, stats); playCheer(); setNews(a.q.after); speak(a.q.after, tts);
  }
  const run = (a: Ask) => (free ? doNow(a) : open(a));

  const answer = (g: number) => {
    if (!ask) return;
    const r = score(g, ask.q.answer.value, !!ask.q.choices);
    const ok = ask.exactOnly ? r.label === 'exact' : true;
    let w = ok ? ask.q.apply(world) : world;
    if (ask.then) w = ask.then(w, r.label !== 'miss');
    celebrate(w, world);
    const gain = r.label === 'exact' ? XP_FOR.exact : r.label === 'close' ? XP_FOR.close : 0;
    const right = stats.right + (r.label !== 'miss' ? 1 : 0);
    const tier = XP_TIERS.find((t) => stats.right < t.at && right >= t.at);
    const xp = stats.xp + gain + (tier?.xp ?? 0);
    const s = { right, exact: stats.exact + (r.label === 'exact' ? 1 : 0), tries: stats.tries + 1, xp };
    if (r.label !== 'miss') visitRight.current += 1;
    // Goals: the next step on screen.
    const g0 = world.goal ?? 0, goal = GOALS[g0];
    if (goal && goal.done(w, right)) { w = { ...w, goal: g0 + 1 }; s.xp += 25; window.setTimeout(() => { worldSfx.chime(); setNews(`Goal done: ${goal.text}! +25 XP.`); }, 900); }
    if (levelOf(s.xp) > levelOf(stats.xp)) window.setTimeout(() => worldSfx.chime(), 400);
    setStats(s); setWorld(w); setResult({ ...r, guess: g, xp: gain + (tier?.xp ?? 0) }); save(w, s);
    playClip(r.label === 'miss' ? WRONG : RIGHT);
    const said = ask.q.choices ? (r.label === 'exact' ? 'Good prediction!' : `Good try. ${ask.q.hint}`)
      : r.label === 'exact' ? `Spot on! ${ask.q.answer.value} ${unitWords(ask.q.answer.unit)}.` : r.label === 'close' ? `So close! It was ${ask.q.answer.value} ${unitWords(ask.q.answer.unit)}.` : `It was ${ask.q.answer.value} ${unitWords(ask.q.answer.unit)}. ${ask.q.hint}`;
    speak(`${said} ${ok ? ask.q.after : 'Try another one to make it happen.'}${tier ? ` You are now a ${tier.title}! Plus ${tier.xp} XP.` : ''}`, tts);
  };
  const check = () => { if (guess) answer(Number(guess)); };
  const done = () => {
    tap();
    const before = seasonOf(world.day);
    const { world: w0, news: n } = passDay(world);
    if (seasonOf(w0.day) !== before) worldSfx.season();
    setWorld(w0); save(w0, stats); setAsk(null); setResult(null); setNews(n); if (n) speak(n, tts);
  };
  const leave = () => { if (student && visitRight.current > 0) payForAnswers(student.id, visitRight.current, 'World Box', '📏'); visitRight.current = 0; save(world, stats); back.go(); };

  // ---- building ----
  const ghost: Rect | null = tool && tool !== 'explore' && ghostAt ? (() => {
    const [bw, bh] = tool === 'wall' && size.vertical ? [1, size.w] : tool === 'wall' ? [size.w, 1] : [size.w, size.h];
    return { x0: ghostAt.x, y0: ghostAt.y, x1: ghostAt.x + bw - 1, y1: ghostAt.y + bh - 1 };
  })() : null;
  const ghostWhy = ghost ? canPlace(world, ghost) : null;
  const pickTool = (t: Tool) => { tap(); setTool(t); setGhostAt(null); if (t && t !== 'explore') { const b = BUILD[t]; setSize((z) => ({ ...z, w: Math.max(b.minW, Math.min(b.maxW, z.w)), h: Math.max(b.minH, Math.min(b.maxH, z.h)) })); setNews(`Tap the map where the ${b.name.toLowerCase()} goes.`); } };
  const step = (k: 'w' | 'h' | 'high', d: number) => {
    if (!tool || tool === 'explore') return; const b = BUILD[tool]; tap();
    setSize((z) => ({ ...z, [k]: k === 'w' ? Math.max(b.minW, Math.min(b.maxW, z.w + d)) : k === 'h' ? Math.max(b.minH, Math.min(b.maxH, z.h + d)) : Math.max(1, Math.min(4, z.high + d)) }));
  };
  const build = () => {
    if (!tool || tool === 'explore' || !ghost || ghostWhy) return;
    tap(); const q = buildQuestion({ ...world, side: sideFor(stats.exact) }, tool, ghost, size.high);
    setTool(null); setGhostAt(null); run({ q });
  };
  const explore = (d: Dir) => {
    const q = exploreQuestion(world, d);
    if (!q) { setNews(`The map cannot grow any more to the ${d}.`); return; }
    tap(); setTool(null); run({ q });
  };

  // ---- animals ----
  const homesFor = (s: Species) => world.buildings.filter((b) => holdsIn(b.type, s));
  const place = (s: Species, b: Building | null, name: string, wildAnimal?: Animal) => {
    tap();
    const first = !!b && !world.animals.some((a) => a.at === b.id && a.kind === s.id);
    const put = (w: World) => addAnimal(w, s, b, name, wildAnimal);
    setAdding(null);
    if (b && first && !free) { open({ q: fitQuestion(world, b, s), then: (w) => put(w) }); return; }
    const w = put(world); setWorld(w); save(w, stats); worldSfx.chime();
    setNews(`${name || 'A new'} ${s.name.toLowerCase()} ${s.icon} ${wildAnimal ? 'moved into the zoo' : b ? `moved into the ${b.name.toLowerCase()}` : `is roaming the ${s.home.map((h) => BIOMES[h].word).join(' and ')}`}. ${s.fact}`);
  };
  const finishDesign = () => {
    if (!design || !design.name.trim()) return;
    const sp = makeSpecies(design.name.trim(), design.icon, design.home, design.size);
    const q = designQuestion(design.size, (['courage', 'wings', 'energy'] as const)[Math.floor(Math.random() * 3)], 2 + Math.floor(Math.random() * 3));
    setDesign(null); addCustomSpecies([sp]);
    run({ q, then: (w) => spawnDesigned(w, sp) });
  };
  const tapMap = (e: React.PointerEvent) => {
    const r = gridRef.current!.getBoundingClientRect();
    const x = view.x0 + Math.floor(((e.clientX - r.left) / r.width) * vw), y = view.y0 + Math.floor(((e.clientY - r.top) / r.height) * vh);
    if (tool && tool !== 'explore') { setGhostAt({ x, y }); tap(); return; }
    const a = world.animals.find((z) => !z.at && z.x === x && z.y === y && SP(z.kind).wild);
    if (a) { tap(); setTab('animals'); setAdding({ s: SP(a.kind), name: '', wildAnimal: a }); setNews(`A wild ${SP(a.kind).name.toLowerCase()} ${SP(a.kind).icon}. ${SP(a.kind).fact} You can tame it if a zoo enclosure has room.`); return; }
    if (zoom === 'world') { setCenter({ x, y }); setZoom('close'); tap(); }
  };

  const L = (x: number) => `${((x - view.x0) / vw) * 100}%`, T = (y: number) => `${((y - view.y0) / vh) * 100}%`;
  const box = (r: Rect) => ({ left: L(r.x0), top: T(r.y0), width: `${(rectW(r) / vw) * 100}%`, height: `${(rectH(r) / vh) * 100}%` });
  const mark = ask && !result ? ask.q.mark : undefined;
  const season = seasonOf(world.day);
  const wild = world.animals.filter((a) => !a.at).length, kept = world.animals.filter((a) => a.at).length;
  const q = ask?.q;
  const goal = GOALS[world.goal ?? 0];
  const level = levelOf(stats.xp), tierNext = XP_TIERS.find((t) => stats.right < t.at), title = [...XP_TIERS].reverse().find((t) => stats.right >= t.at)?.title ?? 'Newcomer';
  const alphas = new Set(SPECIES.filter((sp) => sp.wild).map((sp) => alphaOf(world, sp.id)?.id).filter(Boolean) as string[]);
  const gapped = world.buildings.filter((b) => b.gaps);

  return (
    <div className={`wm wb season-${season.toLowerCase()}`}>
      <header className="wm-head">
        <LeaveButton plain onLeave={leave} note="Your world is saved, and every right answer pays $1 to your bank." />
        <h1>World Box</h1>
        {free && <span className="wm-chip as" title="Afterschool mode is on in Settings">🏠 Afterschool</span>}
        <button type="button" className="btn wb-sound" onClick={() => { tap(); setSoundOpen(true); }} aria-label="Sound and music">🔊</button>
        <span className="wm-chip wb-xp" aria-label={`Level ${level}, ${stats.xp} XP`}>⭐ Lv {level} · {stats.xp} XP</span>
      </header>

      <main className="wm-main">
        <section className="wm-board" aria-label="The World Box map">
          <div ref={gridRef} className={`wb-grid${tool && tool !== 'explore' ? ' placing' : ''}`} onPointerUp={tapMap}
            style={{ aspectRatio: `${vw} / ${vh}`, width: `min(100%, calc((100dvh - 150px) * ${(vw / vh).toFixed(3)}))`, ['--cell' as string]: `${cellPx}px` }}>
            <Ground w={world} view={view} />
            <div className="wb-lines" style={{ backgroundSize: `${100 / vw}% ${100 / vh}%` }} />
            {season === 'Winter' && <div className="wb-winter" aria-hidden />}
            {world.buildings.map((b) => (
              <span key={b.id} className={`wb-b ${b.type}${fresh === b.id ? ' fresh' : ''}${b.gaps ? ' gapped' : ''}`} style={box(b.r)} title={b.name}>
                {b.type !== 'wall' && b.type !== 'den' && cellPx * rectW(b.r) > 50 && <b>{BUILD[b.type].icon} {b.name}</b>}
                {!!b.gaps && <em className="wb-gap" aria-hidden>⚠️ {b.gaps}</em>}
              </span>
            ))}
            {mark && (Array.isArray(mark) ? mark.map((c) => { const [x, y] = xy(c); return <i key={c} className="wb-mark" style={box({ x0: x, y0: y, x1: x, y1: y })} />; })
              : <i className="wb-mark box" style={box(mark)} />)}
            {ghost && <i className={`wb-ghost${ghostWhy ? ' bad' : ''}`} style={box(ghost)} />}
            <AnimalLayer w={world} view={view} cellPx={cellPx} alphas={alphas} winter={season === 'Winter'} />
            <div className="wb-sky" aria-hidden><i /><i /><i /></div>
            {flock > 0 && <div key={flock} className="wb-flock" aria-hidden>🐦 🐦 🐦</div>}
            {(season === 'Winter' || season === 'Spring') && <div className={`wb-weather ${season === 'Winter' ? 'snow' : 'rain'}`} aria-hidden />}
            <div className="wb-daynight" aria-hidden />
          </div>
          <div className="wm-scale">
            <span><span className="wm-scale-bar" style={{ width: `${100 / vw}%` }} /> 1 block = {sideFor(stats.exact)} {unitShort(world.unit)}</span>
            {zoom === 'close' && <span className="wb-pan" role="group" aria-label="Move the map">
              {([['◀', -6, 0, 'left'], ['▲', 0, -4, 'up'], ['▼', 0, 4, 'down'], ['▶', 6, 0, 'right']] as const).map(([t, dx, dy, lab]) => <button key={lab} type="button" aria-label={`Move ${lab}`} onClick={() => { tap(); setCenter((c) => ({ x: c.x + dx, y: c.y + dy })); }}>{t}</button>)}
            </span>}
            <button type="button" className="wm-zoom" onClick={() => { tap(); setZoom(zoom === 'world' ? 'close' : 'world'); }}>{zoom === 'world' ? '🔍 Close up' : `🌍 Whole map (${rectW(m)} × ${rectH(m)})`}</button>
          </div>
        </section>

        <aside className="wm-side">
          {goal && !q && <div className="wb-goal"><b>🎯 Goal:</b> {goal.text} <button type="button" className="wb-mini" onClick={() => speak(`Goal: ${goal.text}`, tts)} aria-label="Listen">🔊</button></div>}
          <div className="wm-stats">
            <span><b>{SEASON_ICON[season]} {season}, day {world.day}</b> · map {rectW(m)} × {rectH(m)}</span>
            <span>🐾 {wild} wild · 🏡 {kept} in buildings · {world.buildings.length} buildings</span>
            <span className="wb-tierbar"><i style={{ width: `${tierNext ? (stats.right / tierNext.at) * 100 : 100}%` }} /><em>{title}{tierNext ? ` · ${stats.right} of ${tierNext.at} right to ${tierNext.title} (+${tierNext.xp} XP)` : ' · every tier done!'}</em></span>
          </div>

          {q ? (
            <div className={`wm-card${result ? ` reveal ${result.label}` : ''}`}>
              <button type="button" className="wm-say" onClick={() => speak(result ? `${q.after} ${q.hint}` : `${q.story} ${q.ask}${q.choices ? ` ${q.choices.join('. ')}.` : ''}`, tts)} aria-label="Listen">{LISTEN}</button>
              <p className="wm-story">{q.story}</p>
              {q.shape && <Shape {...q.shape} />}
              {!result ? <>
                <p className="wm-ask"><b>{q.choices ? 'Predict:' : 'Solve:'}</b> {q.ask}</p>
                {q.choices ? <div className="wb-choices">{q.choices.map((c, i) => <button key={c} type="button" onClick={() => { tap(); answer(i); }}>{c}</button>)}</div>
                  : <NumPad value={guess} unit={unitShort(q.answer.unit)} onChange={setGuess} onCheck={check} tap={tap} />}
              </> : <>
                <p className="wm-result">{result.label === 'exact' ? `Spot on! +${result.xp} XP` : result.label === 'close' ? `So close! +${result.xp} XP` : 'Good try.'}</p>
                {q.choices ? <p>The answer: <b>{q.choices[q.answer.value]}</b>.</p>
                  : <p>You said <b>{result.guess} {unitShort(q.answer.unit)}</b>. It was <b>{q.answer.value} {unitShort(q.answer.unit)}</b>.</p>}
                <p className="wm-hint">{q.hint}</p>
                <p>{ask!.exactOnly && result.label !== 'exact' ? 'It needs an exact answer. Try another one.' : q.after}</p>
                <button type="button" className="wm-go" onClick={done}>Keep playing</button>
              </>}
            </div>
          ) : design ? (
            <div className="wm-card">
              <h2>🧬 Design an animal</h2>
              <label className="wb-name">Name: <input id="wb-design-name" value={design.name} maxLength={16} onChange={(e) => setDesign({ ...design, name: e.target.value.replace(/[^A-Za-z' -]/g, '') })} placeholder="Type a name" /></label>
              <div className="wb-icons">{DESIGN_ICONS.map((ic) => <button key={ic} type="button" className={design.icon === ic ? 'on' : ''} onClick={() => { tap(); setDesign({ ...design, icon: ic }); }}>{ic}</button>)}</div>
              <div className="wb-icons">{world.found.filter((b) => b !== 'mountain').map((b) => <button key={b} type="button" className={design.home === b ? 'on' : ''} onClick={() => { tap(); setDesign({ ...design, home: b }); }}>{BIOMES[b].name}</button>)}</div>
              <div className="wb-size"><div><span>Size</span><button type="button" onClick={() => { tap(); setDesign({ ...design, size: Math.max(1, design.size - 1) }); }} aria-label="Smaller">−</button><b>{design.size}</b><button type="button" onClick={() => { tap(); setDesign({ ...design, size: Math.min(4, design.size + 1) }); }} aria-label="Bigger">+</button></div></div>
              <p className="wm-hint">Bigger animals need more of every trait. You will work out how much!</p>
              <div className="wb-row2"><button type="button" className="wm-go" disabled={!design.name.trim()} onClick={finishDesign}>Make it</button><button type="button" className="wm-go ghost" onClick={() => { tap(); setDesign(null); }}>Back</button></div>
            </div>
          ) : adding ? (
            <div className="wm-card">
              <h2>{adding.s.icon} {adding.wildAnimal ? `Tame this ${adding.s.name.toLowerCase()}` : `Add a ${adding.s.name.toLowerCase()}`}</h2>
              <p className="wm-story">{adding.s.fact} {adding.s.wild ? `Each one needs ${adding.s.space} square ${adding.s.space === 1 ? 'block' : 'blocks'} in a zoo enclosure.` : `It lives in a ${adding.s.lives}, and needs ${adding.s.space} square ${adding.s.space === 1 ? 'block' : 'blocks'}.`}</p>
              <label className="wb-name">Name it: <input id="wb-name" value={adding.name} maxLength={16} onChange={(e) => setAdding({ ...adding, name: e.target.value.replace(/[^A-Za-z' -]/g, '') })} placeholder="Type a name" /></label>
              <div className="wb-list">
                {homesFor(adding.s).map((b) => { const okRoom = roomFor(world, b, adding.s); return (
                  <button key={b.id} type="button" disabled={!okRoom} onClick={() => place(adding.s, b, adding.name.trim(), adding.wildAnimal)}>
                    {BUILD[b.type].icon} {b.name} · {usedSpace(world, b)} of {areaOf(b)} blocks used{okRoom ? '' : ' (full)'}
                  </button>
                ); })}
                {adding.s.wild && !adding.wildAnimal && <button type="button" onClick={() => place(adding.s, null, adding.name.trim())}>🌿 Let it roam the {adding.s.home.map((h) => BIOMES[h].word).join(' and ')}</button>}
                {!homesFor(adding.s).length && <p className="wm-hint">{adding.s.wild ? 'Build a zoo enclosure first (Build tab).' : `Build a ${adding.s.lives === 'pasture' ? 'fenced pasture' : adding.s.lives === 'coop' ? 'chicken coop' : 'barn'} first (Build tab).`}</p>}
              </div>
              <button type="button" className="wm-go" onClick={() => { tap(); setAdding(null); }}>Back</button>
            </div>
          ) : (
            <div className="wm-card wb-tools">
              <span className="sn-seg wb-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={tab === 'build'} className={tab === 'build' ? 'on' : ''} onClick={() => { tap(); setTab('build'); }}>🔨 Build</button>
                <button type="button" role="tab" aria-selected={tab === 'animals'} className={tab === 'animals' ? 'on' : ''} onClick={() => { tap(); setTab('animals'); setTool(null); }}>🐄 Animals</button>
                <button type="button" role="tab" aria-selected={tab === 'world'} className={tab === 'world' ? 'on' : ''} onClick={() => { tap(); setTab('world'); setTool(null); }}>📖 World</button>
              </span>
              {news && <p className="wm-news">{news} <button type="button" className="wb-mini" onClick={() => speak(news, tts)} aria-label="Listen">🔊</button></p>}
              {tab === 'build' && <>
                {gapped.map((b) => <button key={b.id} type="button" className="wb-fix" onClick={() => { tap(); run({ q: repairQuestion({ ...world, side: sideFor(stats.exact) }, b) }); }}>🔧 Fix the fence: {b.name} ({b.gaps} missing)</button>)}
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
                      <button type="button" className="wb-mini wide" onClick={() => { tap(); setSize((z) => ({ ...z, vertical: !z.vertical })); }}>{size.vertical ? '↕️ Up and down' : '↔️ Side to side'}</button></>
                    : <div><span>Wide</span><button type="button" onClick={() => step('h', -1)} aria-label="Narrower">−</button><b>{size.h}</b><button type="button" onClick={() => step('h', 1)} aria-label="Wider">+</button></div>}
                  {tool === 'den' && <div><span>Deep</span><button type="button" onClick={() => step('high', -1)} aria-label="Shallower">−</button><b>{size.high}</b><button type="button" onClick={() => step('high', 1)} aria-label="Deeper">+</button></div>}
                  <p className={ghostWhy ? 'wb-bad' : ''}>{!ghost ? 'Tap the map to place it.' : ghostWhy ?? 'Looks good!'}</p>
                  <button type="button" className="wm-go" disabled={!ghost || !!ghostWhy} onClick={build}>{free ? 'Build it' : 'Build it (answer a question)'}</button>
                </div>}
              </>}
              {tab === 'animals' && <>
                <button type="button" className="wb-fix design" onClick={() => { tap(); setDesign({ name: '', icon: DESIGN_ICONS[0], home: 'meadow', size: 2 }); }}>🧬 Design your own animal</button>
                <h3>Farm animals</h3>
                <div className="wb-species">{SPECIES.filter((s) => !s.wild).map((s) => <button key={s.id} type="button" onClick={() => { tap(); setAdding({ s, name: '' }); }}><span>{s.icon}</span>{s.name}</button>)}</div>
                <h3>Wild animals</h3>
                <div className="wb-species">{SPECIES.filter((s) => s.wild).map((s) => <button key={s.id} type="button" onClick={() => { tap(); setAdding({ s, name: '' }); }}><span>{s.icon}</span>{s.name}</button>)}</div>
                <p className="wm-hint">Tap a wild animal on the map to tame it into a zoo enclosure.</p>
                {world.animals.some((a) => a.at) && <><h3>Your animals</h3>
                  <ul className="wb-mine">{world.animals.filter((a) => a.at).map((a) => (
                    <li key={a.id}><span>{SP(a.kind).icon}</span><b>{a.name}</b><small>level {a.lv ?? 0} of 3</small>
                      <button type="button" disabled={(a.lv ?? 0) >= 3} onClick={() => { tap(); run({ q: trainQuestion({ ...world, side: sideFor(stats.exact) }, a), exactOnly: true }); }}>⭐ Train</button></li>
                  ))}</ul></>}
              </>}
              {tab === 'world' && <div className="wb-world">
                <h3>Biomes found ({world.found.length} of 8)</h3>
                <span className="wm-biomes">{world.found.map((b) => <em key={b}><i style={{ background: `rgb(${BIOMES[b].color.join(',')})` }} />{BIOMES[b].name}</em>)}</span>
                <h3>Wild packs</h3>
                <ul className="wb-packs">{SPECIES.filter((sp) => sp.wild && world.animals.some((a) => a.kind === sp.id && !a.at)).map((sp) => { const p = world.packs?.[sp.id]; const n = world.animals.filter((a) => a.kind === sp.id && !a.at).length; return (
                  <li key={sp.id}><span>{sp.icon}</span><b>{sp.many}</b> ×{n}<small>{p ? `🧠 ${p.iq} smarts${p.skills.length ? ` · ${p.skills.join(', ')}` : ''}` : '🧠 0 smarts'}{(world.evolved?.[sp.id] ?? []).length ? ` · ✨ ${(world.evolved?.[sp.id] ?? []).join(', ')}` : ''}</small></li>
                ); })}</ul>
                <h3>XP tiers</h3>
                <ul className="wb-packs">{XP_TIERS.map((t) => <li key={t.title}><span>{stats.right >= t.at ? '🏅' : '⬜'}</span><b>{t.title}</b><small>{t.at} right answers · +{t.xp} XP</small></li>)}</ul>
              </div>}
            </div>
          )}
          <p className="wm-foot">{visitRight.current} right this visit = ${visitRight.current} for your bank</p>
        </aside>
      </main>
      {soundOpen && (
        <div className="pf-overlay" onClick={() => setSoundOpen(false)}>
          <div className="pf-panel ty3-menu" onClick={(e) => e.stopPropagation()}>
            <h2>🔊 Sound</h2>
            <label className="ty3-slider">Sound effects <input type="range" min={0} max={5} step={1} value={sfxVol} onChange={(e) => setSfxVol(Number(e.target.value))} onPointerUp={tap} /> <b>{sfxVol}</b></label>
            <label className="ty3-slider">Music <input type="range" min={0} max={5} step={1} value={musicVol} onChange={(e) => setMusicVol(Number(e.target.value))} /> <b>{musicVol}</b></label>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => { tap(); setSoundOpen(false); }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
