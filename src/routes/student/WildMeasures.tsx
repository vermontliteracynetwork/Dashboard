import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { speak } from '../../components/ReadAloud';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { playCheer } from '../../lib/petSounds';
import { useAfterschoolGame } from '../../lib/afterschool';
import {
  BIOMES, COLS, ROWS, FENCE_IQ, MAX_LV, SPECIES, TIERS, TRAITS, alphaOf, areaBlocks, biomeAt, bounds, fenceWhole, foodNeed, foodPerDay, lvOf, migrate, newWorld,
  nextQuestion, passDay, penSize, perimeterBlocks, score, sideFor, stressed, tameQuestion, unitShort, unitWords, xy, zooCoins,
  type BiomeId, type Cell, type Creature, type Question, type Rect, type TameQuestion, type Trait, type World,
} from '../../lib/wildMeasures';

// World Box (Build Queue 369 to 371; first built as "Wild Measures", then "Creator"; her brief in docs/measure-wilds/BRIEF.md). The Burrowbacks run their own world: they
// scout, claim land, grow their pack, learn fire and tools, and fence their turf. Before each outcome the game pauses
// and the student predicts a measurement (area, perimeter, fence blocks, food). The outcome then plays out the same
// whatever they guessed, the true value is shown with how to work it out, and close guesses earn coins.

// Build Queue 370 and 372: her Stylized Nature Mega Kit, rendered from its 3D models into pictures
// (scripts/worldbox-render). Every map square gets the same plant or rock each visit (a hash of where it is).
// Build Queue 379: each biome has its own plants and rocks (cactus and dead trees in the desert, snowy pines on the
// snowfield, cattails in the wetland), with only small things on the pack's turf, so claiming land clears it.
const NATURE = '/games/worldbox/nature/';
type Deco = [string, number];
const DECO: Record<BiomeId, { wild: Deco[]; small: Deco[]; wildAt: number; smallAt: number }> = {
  meadow: { wildAt: 0.16, smallAt: 0.36,
    wild: [['commontree_1', 1.5], ['commontree_3', 1.5], ['commontree_5', 1.5], ['t_tree_oak_1', 1.1], ['t_tree_oak_2', 1.1], ['bush_common', 1], ['bush_common_flowers', 1], ['t_bush_1', 0.8], ['t_bush_2', 0.8], ['rock_medium_1', 0.9], ['t_boulder_1', 0.9]],
    small: [['flower_3_group', 0.55], ['flower_4_group', 0.55], ['clover_1', 0.4], ['grass_common_tall', 0.5], ['t_flower_daisy', 0.4], ['t_flower_sunflower', 0.4], ['t_flower_tulip', 0.4], ['t_flower_rose', 0.4], ['t_grass_clump_1', 0.45]] },
  forest: { wildAt: 0.42, smallAt: 0.6,
    wild: [['commontree_1', 1.5], ['commontree_2', 1.5], ['commontree_4', 1.5], ['commontree_2_autumn', 1.5], ['commontree_4_red', 1.5], ['commontree_5_gold', 1.5], ['pine_1', 1.3], ['pine_2', 1.3], ['pine_3', 1.3], ['pine_4', 1.3], ['pine_5', 1.3], ['twistedtree_1', 1.6], ['twistedtree_3', 1.6]],
    small: [['fern_1', 0.7], ['mushroom_common', 0.45], ['mushroom_laetiporus', 0.45], ['plant_1_big', 0.7], ['t_branch_1', 0.5], ['bush_common', 0.9]] },
  desert: { wildAt: 0.16, smallAt: 0.3,
    wild: [['b_cactus', 0.62], ['b_cactus', 0.55], ['b_cactus', 0.7], ['deadtree_1', 1.3], ['deadtree_3', 1.2], ['r_sand', 0.8], ['r_orange', 0.7], ['t_boulder_2', 1], ['t_ruins_pillar_1', 0.6], ['t_ruins_pillar_3', 0.45]],
    small: [['pebble_round_1', 0.35], ['r_sand', 0.45], ['t_rock_1', 0.5], ['r_orange', 0.4]] },
  wetland: { wildAt: 0.24, smallAt: 0.46,
    wild: [['p_cattail', 0.6], ['p_calla', 0.55], ['p_longgrass', 0.6], ['twistedtree_2', 1.5], ['plant_7_big', 0.7], ['r_green', 0.7]],
    small: [['p_mint', 0.45], ['p_longgrass', 0.5], ['grass_wispy_tall', 0.5], ['clover_1', 0.4]] },
  snow: { wildAt: 0.22, smallAt: 0.3,
    wild: [['b_snowpine', 1.2], ['b_snowpine_half', 1.2], ['b_snowpine', 1.1], ['deadtree_2', 1.2], ['r_grey', 0.8]],
    small: [['pebble_round_1', 0.35], ['t_rock_2', 0.5]] },
  hills: { wildAt: 0.3, smallAt: 0.45,
    wild: [['r_grey', 0.8], ['rock_medium_1', 0.9], ['rock_medium_2', 0.9], ['rock_medium_3', 0.8], ['t_boulder_1', 0.9], ['t_boulder_3', 0.8], ['t_rock_1', 0.7], ['t_rock_2', 0.7], ['pine_2', 1.2]],
    small: [['pebble_round_1', 0.35], ['t_stepping_stones_1', 0.6], ['grass_common_tall', 0.5]] },
};
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function decoFor(biome: BiomeId, x: number, y: number, turf: boolean): Deco | null {
  const h = hash(x, y), k = hash(y + 31, x + 7), d = DECO[biome];
  if (turf) return h < 0.12 ? d.small[Math.floor(k * d.small.length)] : null;
  if (h < d.wildAt) return d.wild[Math.floor(k * d.wild.length)];
  if (h < d.smallAt) return d.small[Math.floor(k * d.small.length)];
  return null;
}

// Build Queue 378: the part of the land on screen. Close up follows the pack's turf (never smaller than 16 by 10);
// Whole world shows all the land found so far.
function viewOf(w: World, zoom: 'close' | 'world'): Rect {
  const m = w.map;
  if (zoom === 'world') return m;
  const b = bounds([...w.turf, ...w.pack.filter((c) => c.pen).flatMap((c) => [`${c.pen!.x0},${c.pen!.y0}`, `${c.pen!.x1},${c.pen!.y1}`])]);
  const fit = (a0: number, a1: number, min: number, lo: number, hi: number): [number, number] => {
    a0 = Math.max(a0, lo); a1 = Math.min(a1, hi);
    while (a1 - a0 + 1 < min && (a0 > lo || a1 < hi)) { if (a0 > lo) a0--; if (a1 - a0 + 1 < min && a1 < hi) a1++; }
    return [a0, a1];
  };
  let [x0, x1] = fit(b.x0 - 4, b.x1 + 4, COLS, m.x0, m.x1);
  let [y0, y1] = fit(b.y0 - 3, b.y1 + 3, ROWS, m.y0, m.y1);
  const r = (x1 - x0 + 1) / (y1 - y0 + 1);
  if (r < 1.4) [x0, x1] = fit(x0, x1, Math.ceil((y1 - y0 + 1) * 1.6), m.x0, m.x1);
  else if (r > 1.9) [y0, y1] = fit(y0, y1, Math.ceil((x1 - x0 + 1) / 1.6), m.y0, m.y1);
  return { x0, y0, x1, y1 };
}

// The ground: one pixel a block, stretched smooth by the browser, so neighboring biomes blend into each other.
function Ground({ w, view }: { w: World; view: Rect }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const m = w.map, mw = m.x1 - m.x0 + 1, mh = m.y1 - m.y0 + 1;
  useEffect(() => {
    const ctx = ref.current?.getContext('2d'); if (!ctx) return;
    const img = ctx.createImageData(mw, mh);
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const [r, g, b] = BIOMES[biomeAt(w.seed, x + m.x0, y + m.y0)].ground;
      const j = (hash(x + m.x0, y + m.y0) - 0.5) * 12, i = (y * mw + x) * 4;
      img.data[i] = r + j; img.data[i + 1] = g + j; img.data[i + 2] = b + j; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [w.seed, m.x0, m.y0, mw, mh]);
  const vw = view.x1 - view.x0 + 1, vh = view.y1 - view.y0 + 1;
  return <canvas ref={ref} className="wm-ground" width={mw} height={mh} aria-hidden
    style={{ left: `${((m.x0 - view.x0) / vw) * 100}%`, top: `${((m.y0 - view.y0) / vh) * 100}%`, width: `${(mw / vw) * 100}%`, height: `${(mh / vh) * 100}%` }} />;
}

// The corners of the fence line: both ends of every edge between fenced turf and the outside.
function fencePosts(fenced: Set<string>): [number, number][] {
  const pts = new Map<string, [number, number]>();
  const add = (x: number, y: number) => pts.set(`${x},${y}`, [x, y]);
  for (const c of fenced) {
    const [x, y] = c.split(',').map(Number);
    if (!fenced.has(`${x},${y - 1}`)) { add(x, y); add(x + 1, y); }
    if (!fenced.has(`${x},${y + 1}`)) { add(x, y + 1); add(x + 1, y + 1); }
    if (!fenced.has(`${x - 1},${y}`)) { add(x, y); add(x, y + 1); }
    if (!fenced.has(`${x + 1},${y}`)) { add(x + 1, y); add(x + 1, y + 1); }
  }
  return [...pts.values()];
}

type Saved = { world?: World; coins?: number; right?: number; exact?: number; tries?: number };
type Phase = 'watch' | 'predict' | 'reveal' | 'tame';
const LISTEN = <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>;
const TRAIT_IDS: Trait[] = ['speed', 'strength', 'smarts'];
const levels = (c: Creature) => TRAIT_IDS.reduce((n, t) => n + lvOf(c, t), 0);

// An invented burrowing creature, drawn soft and anime-like: big shiny eyes, round body, wide digging claws.
// Build Queue 380: a tamed one wears a red bandana.
function Burrowback({ alpha, young, tame, dir }: { alpha?: boolean; young?: boolean; tame?: boolean; dir: number }) {
  return (
    <svg viewBox="0 0 64 52" className="wm-bb" style={{ transform: `scaleX(${dir})` }} aria-hidden>
      <path d="M8 34 Q0 30 4 22 Q10 28 16 30Z" fill="#8a5a3c" />
      <ellipse cx="30" cy="34" rx="20" ry="13" fill={young ? '#c99a6e' : '#a8734c'} />
      <ellipse cx="32" cy="38" rx="12" ry="7" fill="#e8c9a4" />
      <circle cx="46" cy="24" r="12" fill={young ? '#d3a77b' : '#b5805a'} />
      <path d="M38 14 l2 -7 l4 6Z M48 13 l4 -6 l2 8Z" fill="#8a5a3c" />
      <ellipse cx="50" cy="23" rx="3.4" ry="4.4" fill="#2a1e2e" /><circle cx="51.3" cy="21.4" r="1.4" fill="#fff" /><circle cx="49.2" cy="24.8" r=".7" fill="#fff" />
      <ellipse cx="42" cy="23" rx="3" ry="4" fill="#2a1e2e" /><circle cx="43.2" cy="21.6" r="1.2" fill="#fff" />
      <ellipse cx="47" cy="29.5" rx="2.2" ry="1.4" fill="#5b3a2c" />
      <ellipse cx="45" cy="31" rx="4" ry="1.6" fill="#f2a7a0" opacity=".55" />
      {tame && <><path d="M35 32 Q45 39 56 32 L55 36 Q45 43 36 36Z" fill="#e0453a" /><path d="M37 34 l-5 6 l7 -1Z" fill="#c2352b" /></>}
      <path d="M40 44 l-2 6 M43 44 l0 6 M46 44 l2 6" stroke="#f1e6d2" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M16 44 l-2 5 M20 45 l0 5" stroke="#f1e6d2" strokeWidth="2" strokeLinecap="round" />
      {alpha && <path d="M40 9 l3 -6 l3 4 l3 -5 l2 7Z" fill="#ffcf3f" stroke="#a07800" strokeWidth=".8" />}
    </svg>
  );
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

// The pen, track, den or garden a taming question is about, drawn block by block.
function Pen({ w, h }: { w: number; h: number }) {
  return (
    <svg className="wm-pen" viewBox={`-2 -2 ${w * 20 + 4} ${h * 20 + 4}`} aria-label={`${w} blocks long and ${h} blocks wide`}>
      {Array.from({ length: w * h }, (_, i) => <rect key={i} x={(i % w) * 20} y={Math.floor(i / w) * 20} width="20" height="20" fill="#b5d38a" stroke="#6b8a3a" strokeWidth="1" />)}
      <rect x="0" y="0" width={w * 20} height={h * 20} fill="none" stroke="#7a4b22" strokeWidth="3" />
    </svg>
  );
}

type Tame = { id: string; trait: Trait | null; q: TameQuestion; guess: string; result: { label: 'exact' | 'close' | 'miss'; guess: number } | null };

export default function WildMeasures() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = `wm:${student?.id ?? ''}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as Saved | undefined) ?? {};
  // Build Queue 381: in Afterschool mode the creatures live on their own, with no prediction pauses.
  const free = useAfterschoolGame(student?.id, 'world-box');
  const [world, setWorld] = useState<World>(() => migrate(saved.world ?? newWorld()));
  const [stats, setStats] = useState({ coins: saved.coins ?? 0, right: saved.right ?? 0, exact: saved.exact ?? 0, tries: saved.tries ?? 0 });
  const [phase, setPhase] = useState<Phase>('watch');
  const [q, setQ] = useState<Question | null>(null);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<{ label: 'exact' | 'close' | 'miss'; coins: number; guess: number } | null>(null);
  const [news, setNews] = useState<string | null>(`Meet the ${SPECIES.many}. They run this land. Watch what they do, and predict the measurements.`);
  const [pos, setPos] = useState<Record<string, { x: number; y: number; dir: number }>>({});
  const [zoom, setZoom] = useState<'close' | 'world'>('close');
  const [tame, setTame] = useState<Tame | null>(null);
  const [flash, setFlash] = useState<Cell[]>([]);
  const [tick, setTick] = useState(0);
  const timers = useRef<number[]>([]);
  const tts = student?.ttsSettings;
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const save = (w: World, s: typeof stats) => mergeStyleRow(owner, { world: w, ...s });

  // The creatures roam their own turf.
  useEffect(() => {
    const move = () => setPos((old) => {
      const out: typeof old = {};
      for (const c of world.pack) {
        // Build Queue 385: a tame creature walks around its zoo pen; the wild pack roams the turf.
        const pn = c.tame ? c.pen : undefined;
        const [cx, cy] = pn ? [pn.x0 + Math.floor(Math.random() * penSize(pn).w), pn.y0 + Math.floor(Math.random() * penSize(pn).h)] : xy(world.turf[Math.floor(Math.random() * world.turf.length)]);
        const x = cx + 0.15 + Math.random() * 0.7, y = cy + 0.15 + Math.random() * 0.7;
        const prev = old[c.id];
        out[c.id] = { x, y, dir: prev ? (x >= prev.x ? 1 : -1) : 1 };
      }
      return out;
    });
    move();
    const id = window.setInterval(move, 2400);
    return () => clearInterval(id);
  }, [world.turf, world.pack]);

  // Watching: a moment of the creatures living, then they decide what to do next and the game pauses for a prediction.
  // In Afterschool mode the outcome just happens and the next day starts.
  useEffect(() => {
    if (phase !== 'watch' || !student) return;
    const t = window.setTimeout(() => {
      const w = { ...world, side: sideFor(stats.exact) };
      const nq = nextQuestion(w);
      if (free) {
        const { world: d, news: n } = passDay(nq.apply(w));
        const line = `${nq.story} ${nq.after}${n ? ` ${n}` : ''}`;
        setWorld(d); save(d, stats); setNews(line); speak(line, tts);
        setFlash(nq.ghost ?? []); timers.current.push(window.setTimeout(() => setFlash([]), 2400));
        setTick((k) => k + 1);
        return;
      }
      setWorld(w); setQ(nq); setGuess(''); setResult(null); setPhase('predict'); setNews(null);
      speak(`${nq.story} ${nq.ask}`, tts);
    }, free ? 7000 : news ? 4200 : 2600);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [phase, tick, free]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!student) return null;

  const check = () => {
    if (!q || !guess) return;
    const g = Number(guess);
    const r = score(g, q.answer.value);
    const nextWorld = q.apply(world);
    const s = { coins: stats.coins + r.coins, right: stats.right + (r.label !== 'miss' ? 1 : 0), exact: stats.exact + (r.label === 'exact' ? 1 : 0), tries: stats.tries + 1 };
    const tier = TIERS.find((t) => stats.right < t.at && s.right >= t.at);
    setResult({ ...r, guess: g }); setStats(s); setWorld(nextWorld); setPhase('reveal'); save(nextWorld, s);
    if (r.label === 'exact') { sfx.coin(); playCheer(); } else if (r.label === 'close') sfx.coin(); else sfx.pop();
    const said = r.label === 'exact' ? `Spot on! ${q.answer.value} ${unitWords(q.answer.unit)}. Plus 3 coins.` : r.label === 'close' ? `So close! It was ${q.answer.value} ${unitWords(q.answer.unit)}. Plus 1 coin.` : `It was ${q.answer.value} ${unitWords(q.answer.unit)}. ${q.hint}`;
    speak(`${said} ${q.after}${tier ? ` You unlocked ${tier.name}!` : ''}`, tts);
    if (tier) setNews(`You unlocked ${tier.name}! ${tier.does}`);
  };
  const keepWatching = () => {
    const { world: w, news: n0 } = passDay(world);
    // Build Queue 385: zoo visitors pay to see the tame creatures each day.
    const zc = zooCoins(w);
    const s2 = zc ? { ...stats, coins: stats.coins + zc } : stats;
    const n = [n0, zc ? `Zoo visitors came to see your tame ${SPECIES.many}: +${zc} ${zc === 1 ? 'coin' : 'coins'}.` : null].filter(Boolean).join(' ') || null;
    if (zc) { setStats(s2); sfx.coin(); }
    setWorld(w); save(w, s2); setQ(null); setResult(null);
    setNews(n ?? (stressed(w) ? `The ${SPECIES.many} are hungry and stressed. They will scout for more land.` : null));
    if (n) speak(n, tts);
    setPhase('watch');
  };

  // ---- Build Queue 380: taming and upgrading ----
  const openTame = () => { sfx.tick(); setTame(null); setPhase('tame'); };
  const closeTame = () => { setTame(null); setPhase(q && result ? 'reveal' : 'watch'); };
  const startTame = (c: Creature, trait: Trait | null) => {
    sfx.tick();
    if (free) {
      const w = tameQuestion(world, c, trait).apply(world);
      setWorld(w); save(w, stats); playCheer();
      speak(trait ? `${c.name} ${TRAITS[trait].does}. ${TRAITS[trait].name} is now level ${lvOf(c, trait) + 1}.` : `${c.name} is tamed!`, tts);
      return;
    }
    const tq = tameQuestion({ ...world, side: sideFor(stats.exact) }, c, trait);
    setTame({ id: c.id, trait, q: tq, guess: '', result: null });
    speak(`${tq.story} ${tq.ask}`, tts);
  };
  const checkTame = () => {
    if (!tame || !tame.guess) return;
    const g = Number(tame.guess), r = score(g, tame.q.answer.value);
    const exact = r.label === 'exact';
    const s = { ...stats, coins: stats.coins + (exact ? 3 : 0), right: stats.right + (exact ? 1 : 0), exact: stats.exact + (exact ? 1 : 0), tries: stats.tries + 1 };
    const w = exact ? tame.q.apply(world) : world;
    setStats(s); setWorld(w); save(w, s);
    setTame({ ...tame, result: { label: r.label, guess: g } });
    if (exact) { sfx.coin(); playCheer(); speak(`Spot on! Plus 3 coins. ${tame.q.after}`, tts); }
    else { sfx.pop(); speak(`It was ${tame.q.answer.value} ${unitWords(tame.q.answer.unit)}. ${tame.q.hint} Try another one.`, tts); }
  };

  const view = viewOf(world, zoom);
  const vw = view.x1 - view.x0 + 1, vh = view.y1 - view.y0 + 1;
  const L = (x: number) => `${((x - view.x0) / vw) * 100}%`, T = (y: number) => `${((y - view.y0) / vh) * 100}%`;
  const inView = (x: number, y: number) => x >= view.x0 && x <= view.x1 && y >= view.y0 && y <= view.y1;
  const turf = new Set(world.turf);
  const ghost = new Set(phase === 'predict' ? q?.ghost ?? [] : flash);
  const showFence = world.fenced !== null;
  const fencedSet = new Set(world.fenced ? world.fenced.split('|') : []);
  const alpha = alphaOf(world);
  const food = foodPerDay(world), need = foodNeed(world);
  const nextTier = TIERS.find((t) => stats.right < t.at);
  const prevAt = [...TIERS].reverse().find((t) => stats.right >= t.at)?.at ?? 0;
  const marked = [...new Set([...world.turf, ...ghost])].filter((c) => inView(...xy(c)));
  const edge = (c: Cell) => {
    if (!showFence || !fencedSet.has(c)) return '';
    const [x, y] = xy(c);
    return ['n', 'e', 's', 'w'].filter((_d, i) => !fencedSet.has(`${x + [0, 1, 0, -1][i]},${y + [-1, 0, 1, 0][i]}`)).map((d) => ` f${d}`).join('');
  };
  const decos: { x: number; y: number; d: [string, number]; c: Cell }[] = [];
  for (let y = view.y0; y <= view.y1; y++) for (let x = view.x0; x <= view.x1; x++) {
    const c = `${x},${y}`, d = decoFor(biomeAt(world.seed, x, y), x, y, turf.has(c));
    if (d) decos.push({ x, y, d, c });
  }
  const say = () => speak(q ? `${q.story} ${q.ask}` : news ?? '', tts);
  const mapW = world.map.x1 - world.map.x0 + 1, mapH = world.map.y1 - world.map.y0 + 1;
  const ratio = vw / vh;
  const tamed = tame ? world.pack.find((c) => c.id === tame.id) : null;

  return (
    <div className="wm">
      <header className="wm-head">
        <LeaveButton plain onLeave={() => back.go()} note="Your creatures keep their world, and your coins are saved." />
        <h1>World Box</h1>
        {free && <span className="wm-chip as" title="Afterschool mode is on in Settings">🏠 Afterschool</span>}
        <SfxToggle plain />
        <span className="wm-chip" aria-label={`${stats.coins} coins`}>🪙 {stats.coins}</span>
      </header>

      <main className="wm-main">
        <section className="wm-board" aria-label={`The ${SPECIES.many}' land`}>
          <div className="wm-grid" style={{ aspectRatio: `${vw} / ${vh}`, width: `min(100%, calc((100dvh - 150px) * ${ratio.toFixed(3)}))` }}>
            <Ground w={world} view={view} />
            <div className="wm-lines" style={{ backgroundSize: `${100 / vw}% ${100 / vh}%` }} />
            {marked.map((c) => {
              const [x, y] = xy(c);
              return <i key={c} className={`${turf.has(c) ? 'turf' : ''}${ghost.has(c) ? ' ghost' : ''}${edge(c)}`} style={{ left: L(x), top: T(y), width: `${100 / vw}%`, height: `${100 / vh}%` }} />;
            })}
            {/* Build Queue 385: each tame creature's zoo pen, fenced, with its name sign. */}
            {world.pack.filter((c) => c.tame && c.pen).map((c) => { const p = c.pen!; const { w: pw, h: ph } = penSize(p); return (
              <span key={`pen${c.id}`} className="wm-pen-zone" style={{ left: L(p.x0), top: T(p.y0), width: `${(pw / vw) * 100}%`, height: `${(ph / vh) * 100}%`, zIndex: (p.y0 - view.y0) * 10 }}>
                <b>{c.name}</b>
              </span>
            ); })}
            {decos.filter(({ x, y }) => !world.pack.some((c) => c.tame && c.pen && x >= c.pen.x0 && x <= c.pen.x1 && y >= c.pen.y0 && y <= c.pen.y1)).map(({ x, y, d, c }) => (
              <img key={`d${c}`} className={`wm-deco${ghost.has(c) && !turf.has(c) ? ' fade' : ''}`} src={`${NATURE}${d[0]}.webp`} alt="" draggable={false}
                style={{ left: L(x + 0.5), top: T(y + 0.92), width: `${(d[1] * 100) / vw}%`, zIndex: (y - view.y0) * 10 + 1 }} />
            ))}
            {/* Build Queue 373: a wooden fence post (from her terrain pack) at every corner of the fence line. */}
            {showFence && fencePosts(fencedSet).filter(([x, y]) => inView(x, y) || inView(x - 1, y - 1)).map(([x, y]) => (
              <img key={`p${x},${y}`} className="wm-deco wm-post" src={`${NATURE}t_fence_post_1.webp`} alt="" draggable={false}
                style={{ left: L(x), top: T(y), width: `${22 / vw}%`, zIndex: (y - view.y0) * 10 + 3 }} />
            ))}
            {world.pack.map((c) => {
              const p = pos[c.id]; if (!p) return null;
              const lv = levels(c), sp = lvOf(c, 'speed');
              return (
                <span key={c.id} className={`wm-critter${c.young ? ' young' : ''}`} title={c.name}
                  style={{ left: L(p.x), top: T(p.y), width: `${(c.size * (1 + 0.08 * lvOf(c, 'strength')) * 140) / vw}%`, zIndex: Math.floor(p.y - view.y0) * 10 + 5, transitionDuration: `${2.2 - sp * 0.5}s` }}>
                  <Burrowback alpha={c.id === alpha.id} young={c.young} tame={c.tame} dir={p.dir} />
                  {lv > 0 && <b className="wm-lv" aria-hidden>★{lv}</b>}
                </span>
              );
            })}
          </div>
          <div className="wm-scale">
            <span><span className="wm-scale-bar" style={{ width: `${100 / vw}%` }} /> 1 block = {world.side} {unitShort(world.unit)} on each side</span>
            <button type="button" className="wm-zoom" onClick={() => { sfx.tick(); setZoom(zoom === 'close' ? 'world' : 'close'); }}>
              {zoom === 'close' ? `🌍 Whole world (${mapW} × ${mapH})` : '🔍 Close up'}
            </button>
          </div>
        </section>

        <aside className="wm-side">
          <div className="wm-stats">
            <span><b>Day {world.day}</b></span>
            <span>{world.pack.length} {SPECIES.many} · alpha {alpha.name}</span>
            <span className={`wm-mood${stressed(world) ? ' bad' : ''}`}>{stressed(world) ? 'Stressed: not enough food' : 'Calm and fed'}</span>
            <span>Food: {food} a day · they eat {need}</span>
            <span className="wm-biomes" aria-label="Biomes found">{world.biomes.map((b: BiomeId) => (
              <em key={b}><i style={{ background: `rgb(${BIOMES[b].ground.join(',')})` }} />{BIOMES[b].name} {BIOMES[b].food} food</em>
            ))}</span>
            <span className="wm-iq" aria-label={`Intelligence ${world.iq}`}>Smarts {world.iq}{world.iq < FENCE_IQ ? ` · fences at ${FENCE_IQ}` : fenceWhole(world) ? ' · fenced' : ' · can fence'}</span>
            {nextTier && !free && <span className="wm-tier"><i style={{ width: `${((stats.right - prevAt) / (nextTier.at - prevAt)) * 100}%` }} /><em>{stats.right - prevAt} of {nextTier.at - prevAt} to {nextTier.name}</em></span>}
          </div>

          {phase === 'watch' && (
            <div className="wm-card watch">
              <button type="button" className="wm-say" onClick={say} aria-label="Listen">{LISTEN}</button>
              <p>{news ?? `The ${SPECIES.many} are busy. Watch what they decide to do...`}</p>
              <button type="button" className="wm-tamebtn" onClick={openTame}>🦓 My zoo</button>
            </div>
          )}

          {phase === 'predict' && q && (
            <div className="wm-card">
              <button type="button" className="wm-say" onClick={say} aria-label="Listen">{LISTEN}</button>
              <p className="wm-story">{q.story}</p>
              <p className="wm-ask"><b>Predict:</b> {q.ask}</p>
              <NumPad value={guess} unit={unitShort(q.answer.unit)} onChange={setGuess} onCheck={check} />
            </div>
          )}

          {phase === 'reveal' && q && result && (
            <div className={`wm-card reveal ${result.label}`}>
              <button type="button" className="wm-say" onClick={() => speak(`${q.after} ${q.hint}`, tts)} aria-label="Listen">{LISTEN}</button>
              <p className="wm-result">{result.label === 'exact' ? 'Spot on! +3 coins' : result.label === 'close' ? 'So close! +1 coin' : 'Good try.'}</p>
              <p>You predicted <b>{result.guess} {unitShort(q.answer.unit)}</b>. It was <b>{q.answer.value} {unitShort(q.answer.unit)}</b>.</p>
              <p className="wm-hint">{q.hint}</p>
              <p>{q.after}</p>
              {news && <p className="wm-news">{news}</p>}
              <div className="wm-row">
                <button type="button" className="wm-tamebtn" onClick={openTame}>🦓 Zoo</button>
                <button type="button" className="wm-go" onClick={keepWatching}>Keep watching</button>
              </div>
            </div>
          )}

          {phase === 'tame' && !tame && (
            <div className="wm-card tame">
              <h2>🦓 My zoo</h2>
              <p>{free ? 'Afterschool mode: tap to bring a creature into the zoo or upgrade it.' : 'Build a zoo pen to tame a creature, then upgrade it (up to level 3). Answer each measuring question exactly. Visitors pay coins every day to see your zoo.'}</p>
              <ul className="wm-tame-list">
                {world.pack.map((c) => (
                  <li key={c.id}>
                    <span className="wm-tame-pic"><Burrowback alpha={c.id === alpha.id} young={c.young} tame={c.tame} dir={1} /></span>
                    <div>
                      <b>{c.name}</b> <small>{c.tame ? (c.pen ? `In the zoo · pen ${penSize(c.pen).w} × ${penSize(c.pen).h}` : 'Tame') : 'Wild'}</small>
                      <div className="wm-traits">
                        {!c.tame ? <button type="button" onClick={() => startTame(c, null)}>🦓 Build a pen for {c.name}</button>
                          : TRAIT_IDS.map((t) => (
                            <button key={t} type="button" disabled={lvOf(c, t) >= MAX_LV} onClick={() => startTame(c, t)} aria-label={`${TRAITS[t].name} level ${lvOf(c, t)} of ${MAX_LV}`}>
                              {TRAITS[t].icon} {TRAITS[t].name} {lvOf(c, t)}/{MAX_LV}
                            </button>
                          ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <button type="button" className="wm-go" onClick={closeTame}>Back to the world</button>
            </div>
          )}

          {phase === 'tame' && tame && tamed && (
            <div className={`wm-card${tame.result ? ` reveal ${tame.result.label}` : ''}`}>
              <button type="button" className="wm-say" onClick={() => speak(tame.result ? `${tame.q.after} ${tame.q.hint}` : `${tame.q.story} ${tame.q.ask}`, tts)} aria-label="Listen">{LISTEN}</button>
              <p className="wm-story">{tame.q.story}</p>
              <Pen w={tame.q.pen.w} h={tame.q.pen.h} />
              {!tame.result && <>
                <p className="wm-ask"><b>Solve:</b> {tame.q.ask}</p>
                <NumPad value={tame.guess} unit={unitShort(tame.q.answer.unit)} onChange={(v) => setTame({ ...tame, guess: v })} onCheck={checkTame} />
              </>}
              {tame.result && <>
                <p className="wm-result">{tame.result.label === 'exact' ? 'Spot on! +3 coins' : 'Not yet.'}</p>
                <p>You said <b>{tame.result.guess} {unitShort(tame.q.answer.unit)}</b>. It was <b>{tame.q.answer.value} {unitShort(tame.q.answer.unit)}</b>.</p>
                {tame.result.label === 'exact' ? <p className="wm-news">{tame.q.after}</p> : <p className="wm-hint">{tame.q.hint}</p>}
                <div className="wm-row">
                  {tame.result.label !== 'exact' && <button type="button" className="wm-tamebtn" onClick={() => startTame(tamed, tame.trait)}>Try another</button>}
                  <button type="button" className="wm-go" onClick={() => { setTame(null); sfx.tick(); }}>Back to the pack</button>
                </div>
              </>}
            </div>
          )}

          {phase !== 'predict' && phase !== 'tame' && <p className="wm-foot">Area {areaBlocks(world.turf)} blocks · around {perimeterBlocks(world.turf)} edges</p>}
        </aside>
      </main>
    </div>
  );
}
