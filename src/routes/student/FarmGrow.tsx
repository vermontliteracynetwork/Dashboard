import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import QuestionScreen from '../../components/QuestionScreen';
import RoundSettings from '../../components/RoundSettings';
import { useGameQuestions } from '../../games/mini/useAsk';
import { useRoundSettings } from '../../lib/gameRounds';
import { payForAnswers } from '../../lib/gameEarnings';
import { recordStreakCorrect } from '../../lib/streak';
import { speak } from '../../components/ReadAloud';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest, useVisitScore } from '../../components/MyBest';
import type { MCQuestion } from '../../types';

// Farm Grow, rebuilt 2026-10-12 as an isometric pixel farm on her art packs (Isometric Farm tiles and
// house, the autumn harvest crop sprites, Pixel Farm tools, the Septembit seed bag). Her words:
// "lets redo the farm grow game to be pixel theme and using these assets in an isometric theme. keep
// questions in original formats. allow farm activities (planting/watering). have a little pixel farmer
// walk around to each task, completing one at a time. the farmer should return back to their pixel home
// after the day has been completed. the sun should move in the sky from the left hand corner of the
// grass (where the grass meets the sky) in an arc motion to the right hand corner. the sun should move
// across the screen for 30 seconds, the color of the sky should get lighter as the sun moves toward the
// center and then darker again progressivelt when the sun moves the the righhand side. when the day is
// done (after the 30 seconds) the round is complete and the farmer should walk back to their house.
// questions are prompted to in sucession between the days/rounds. students should have slider
// selections when they start the game for number of rounds (min = 1, max = 20) and questions between
// rounds (min = 5, max = 10)".
// How it plays: during the day the student taps plots to give the farmer jobs (plant, water, harvest);
// the farmer walks to each job and does them one at a time. At sunset the farmer walks home, watered
// crops grow one stage overnight (seeds, sprout, growing, ripe), then the day's questions come in a row
// in the usual full-screen question view. The farm is saved, so crops keep growing across visits.

const ART = '/games/farm/';
const DAY_S = 30;
const N = 9; // the map is N by N iso tiles
const OX = N * 16, OY = 50; // art-pixel origin of cell (0,0)
const MAP_W = N * 32, MAP_H = OY + N * 16 + 4;
const iso = (c: number, r: number) => ({ x: OX + (c - r) * 16, y: OY + (c + r) * 8 + 8 }); // a cell's center
// Nine plots in a 3 by 3 field, front right of the house.
const PLOT_CELLS: [number, number][] = [];
for (let r = 4; r <= 6; r++) for (let c = 5; c <= 7; c++) PLOT_CELLS.push([c, r]);
const PLOTS = PLOT_CELLS.map(([c, r]) => iso(c, r));
// The house covers cells 0 to 3; its picture is 128 by 112 with the door low on its left face.
const HOUSE = { x: OX - 64, y: OY - 47 };
const HOME = { x: HOUSE.x + 60, y: HOUSE.y + 104 };

interface Crop { id: string; name: string; fact: string }
const CROPS: Crop[] = [
  { id: 'corn', name: 'Corn', fact: 'One ear of corn has about 800 kernels in rows.' },
  { id: 'pumpkin', name: 'Pumpkin', fact: 'Pumpkins grow on long vines that creep along the ground.' },
  { id: 'wheat', name: 'Wheat', fact: 'Wheat is ground into flour to make bread.' },
  { id: 'sunflower', name: 'Sunflower', fact: 'Young sunflowers turn to follow the sun across the sky.' },
  { id: 'tomato', name: 'Tomato', fact: 'A tomato is really a fruit because it has seeds inside.' },
  { id: 'grapes', name: 'Grapes', fact: 'Grapes grow in bunches on vines that climb.' },
  { id: 'apple', name: 'Apple Tree', fact: 'An apple tree can grow apples for 100 years.' },
];
const cropOf = (id: string) => CROPS.find((c) => c.id === id) ?? CROPS[0];
const STAGE_NAME = ['Seeds', 'Sprout', 'Growing', 'Ripe'];

interface Plot { crop: string; stage: 0 | 1 | 2 | 3; watered: boolean }
interface Farm { plots9?: (Plot | null)[]; harvested?: Record<string, number> }
type Kind = 'plant' | 'water' | 'harvest';
interface Job { plot: number; kind: Kind; crop?: string }
const JOB_ICON: Record<Kind, string> = { plant: 'seeds', water: 'can', harvest: 'hoe' };
const JOB_WORD: Record<Kind, string> = { plant: 'Plant', water: 'Water', harvest: 'Harvest' };
type Stage = 'start' | 'day' | 'dusk' | 'night' | 'questions' | 'end';

const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a), B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
};
const grassTile = (c: number, r: number) => { const h = (c * 7 + r * 13) % 11; return h < 6 ? 'grass1' : h < 8 ? 'grass2' : h === 8 ? 'grass3' : h === 9 ? 'grass4' : 'grass5'; };

export default function FarmGrow() {
  const back = useBack();
  const { next, right: countRight, notice, assignment, student } = useGameQuestions('farmGrow');
  const ranges = { rounds: { min: 1, max: 20, def: 5 }, per: { min: 5, max: 10, def: 5 } };
  const rs = useRoundSettings('farmGrow', ranges, assignment?.task);
  const visit = useVisitScore('farmGrow');
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = student ? `farm:${student.id}` : '';
  const farm = (styleLooks.find((r) => r.ownerId === owner)?.look as Farm | undefined) ?? {};
  const [, setFrame] = useState(0);
  const [say, setSay] = useState('Pick how many days to farm and how many questions come between days.');
  const [picker, setPicker] = useState<number | null>(null);
  const [book, setBook] = useState(false);
  const [block, setBlock] = useState<{ q: MCQuestion; left: number; total: number } | null>(null);
  const [fit, setFit] = useState(2);
  const G = useRef({
    stage: 'start' as Stage, round: 1, dayT: 0, paused: false,
    plots: Array.from({ length: PLOTS.length }, (_, i) => farm.plots9?.[i] ?? null) as (Plot | null)[],
    harvested: { ...(farm.harvested ?? {}) } as Record<string, number>,
    queue: [] as Job[], cur: null as null | { job: Job; phase: 'walk' | 'work'; t: number },
    me: { x: HOME.x, y: HOME.y, face: 1, walking: false, inside: true, anim: 0 },
    stats: { harvested: 0, right: 0, days: 0 }, unpaid: 0, loaded: !!farm.plots9,
  });
  const g = G.current;
  // A saved farm that arrives after the screen opened replaces the empty one.
  if (!g.loaded && farm.plots9) { g.plots = Array.from({ length: PLOTS.length }, (_, i) => farm.plots9?.[i] ?? null); g.harvested = { ...(farm.harvested ?? {}) }; g.loaded = true; }

  const save = () => { if (owner) mergeStyleRow(owner, { plots9: g.plots, harvested: g.harvested }); };
  const pay = () => { if (student && g.unpaid > 0) payForAnswers(student.id, g.unpaid, 'Farm Grow', '🌱'); g.unpaid = 0; };
  const tell = (text: string) => setSay(text);

  // Fit the farm to the iPad screen, both ways round.
  useEffect(() => {
    const onResize = () => setFit(Math.max(1, Math.min((window.innerWidth - 24) / MAP_W, (window.innerHeight - 260) / MAP_H)));
    onResize(); window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const startQuestions = () => { g.stage = 'questions'; setBlock({ q: next(), left: rs.perRound, total: rs.perRound }); };
  const nightfall = () => {
    g.me.inside = true; g.stage = 'night'; g.stats.days += 1;
    let grew = 0;
    g.plots = g.plots.map((p) => { if (!p) return p; if (p.watered && p.stage < 3) { grew += 1; return { ...p, stage: (p.stage + 1) as Plot['stage'], watered: false }; } return { ...p, watered: false }; });
    save(); sfx.chime();
    tell(grew ? `Goodnight! ${grew} watered ${grew === 1 ? 'crop grew' : 'crops grew'} overnight. Answer the questions to start the next day.` : 'Goodnight! Water your crops in the day so they grow at night. Answer the questions to start the next day.');
    window.setTimeout(startQuestions, 2200);
  };
  const finishJob = (job: Job) => {
    const p = g.plots[job.plot];
    if (job.kind === 'plant' && !p && job.crop) { g.plots[job.plot] = { crop: job.crop, stage: 0, watered: false }; sfx.thud(); tell(`Planted ${cropOf(job.crop).name} seeds. Tap them to water them!`); }
    else if (job.kind === 'water' && p && !p.watered) { g.plots[job.plot] = { ...p, watered: true }; sfx.splash(); tell(`Watered the ${cropOf(p.crop).name}. It will grow tonight.`); }
    else if (job.kind === 'harvest' && p && p.stage === 3) {
      g.plots[job.plot] = null; g.harvested[p.crop] = (g.harvested[p.crop] ?? 0) + 1; g.stats.harvested += 1; visit.add();
      sfx.coin(); playCheer(); tell(`Harvested ${cropOf(p.crop).name}! ${cropOf(p.crop).fact}`);
    }
    save();
  };

  // The farm's clock and the farmer, every animation frame.
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const s = G.current, me = s.me;
      if (s.stage === 'day' && !s.paused) {
        s.dayT += dt;
        if (s.dayT >= DAY_S) { s.dayT = DAY_S; s.stage = 'dusk'; s.queue = []; s.cur = null; sfx.horn(); setPicker(null); tell('The sun is setting. The farmer is heading home.'); }
      }
      if (s.stage === 'day' && !s.cur && s.queue.length) s.cur = { job: s.queue.shift()!, phase: 'walk', t: 0 };
      const target = s.stage === 'dusk' ? HOME : s.cur?.phase === 'walk' ? { x: PLOTS[s.cur.job.plot].x - 9, y: PLOTS[s.cur.job.plot].y + 3 } : null;
      me.walking = false;
      if (s.cur?.phase === 'work') {
        s.cur.t -= dt;
        if (s.cur.t <= 0) { finishJob(s.cur.job); s.cur = null; }
      } else if (target && !me.inside) {
        const dx = target.x - me.x, dy = target.y - me.y, d = Math.hypot(dx, dy), step = 42 * dt;
        if (d <= step) {
          me.x = target.x; me.y = target.y;
          if (s.stage === 'dusk') nightfall();
          else if (s.cur) { s.cur.phase = 'work'; s.cur.t = 1.2; if (s.cur.job.kind === 'water') sfx.splash(); else sfx.pop(); }
        } else { me.x += (dx / d) * step; me.y += (dy / d) * step; me.walking = true; if (Math.abs(dx) > 0.5) me.face = dx > 0 ? 1 : -1; }
      }
      me.anim += dt;
      setFrame((f) => (f + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { const s = G.current; if (s.unpaid > 0 && student) payForAnswers(student.id, s.unpaid, 'Farm Grow', '🌱'); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tiles = useMemo(() => {
    const out: ReactElement[] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const p = iso(c, r);
      out.push(<img key={`${c}-${r}`} src={`${ART}tiles/${grassTile(c, r)}.png`} alt="" className="fgx-px fgx-tile" style={{ left: p.x - 16, top: p.y - 8 }} />);
    }
    return out;
  }, []);

  if (!student) return null;

  const startDay = (first: boolean) => {
    if (first) { g.round = 1; g.stats = { harvested: 0, right: 0, days: 0 }; }
    g.stage = 'day'; g.dayT = 0; g.queue = []; g.cur = null;
    g.me = { ...g.me, x: HOME.x, y: HOME.y, inside: false, face: 1 };
    sfx.chime();
    tell(`Good morning! Day ${g.round} of ${rs.rounds}. Tap a plot: plant seeds, water crops, or harvest ripe ones.`);
  };
  const endGame = () => {
    g.stage = 'end'; setBlock(null); setPicker(null); pay(); playCheer();
    tell(`What a farm! You farmed ${g.stats.days} ${g.stats.days === 1 ? 'day' : 'days'}, harvested ${g.stats.harvested} ${g.stats.harvested === 1 ? 'crop' : 'crops'} and got ${g.stats.right} right answers.`);
  };
  const blockDone = () => {
    setBlock(null);
    if (g.round < rs.rounds) { g.round += 1; startDay(false); } else endGame();
  };
  const tap = (i: number) => {
    if (g.stage !== 'day') return;
    if (g.queue.some((j) => j.plot === i) || g.cur?.job.plot === i) { sfx.bonk(); tell('That plot already has a job. The farmer will get to it!'); return; }
    if (g.queue.length >= 6) { tell('The job list is full. Let the farmer catch up!'); return; }
    const p = g.plots[i];
    if (!p) { g.paused = true; setPicker(i); return; }
    if (p.stage === 3) { g.queue.push({ plot: i, kind: 'harvest' }); sfx.pop(); tell(`Job added: harvest the ${cropOf(p.crop).name}.`); return; }
    if (!p.watered) { g.queue.push({ plot: i, kind: 'water' }); sfx.pop(); tell(`Job added: water the ${cropOf(p.crop).name}.`); return; }
    tell(`The ${cropOf(p.crop).name} is watered for today. It will grow tonight.`);
  };
  const pickSeed = (crop: Crop) => {
    if (picker !== null) { g.queue.push({ plot: picker, kind: 'plant', crop: crop.id }); sfx.pop(); tell(`Job added: plant ${crop.name}.`); }
    g.paused = false; setPicker(null);
  };

  // Sky, sun and light follow the day: dark at sunrise, brightest at noon, dark again at sunset.
  const t = g.stage === 'day' ? g.dayT / DAY_S : g.stage === 'dusk' ? 1 : 0;
  const daylight = g.stage === 'day' ? Math.sin(Math.PI * t) : g.stage === 'dusk' ? 0.05 : g.stage === 'start' || g.stage === 'end' ? 0.8 : 0;
  const night = g.stage === 'night' || g.stage === 'questions';
  const skyTop = night ? '#0f1230' : mix('#2a2f62', '#5fb8f5', daylight);
  const skyLow = night ? '#2a2d5c' : mix('#f0a060', '#cdeeff', daylight);
  const light = night ? 0.5 : 0.6 + 0.4 * daylight;
  const HORIZON = 34; // percent from the top, where the grass meets the sky
  const sunLeft = t * 100, sunTop = HORIZON - Math.sin(Math.PI * t) * (HORIZON - 9);
  const me = g.me;
  const frameName = g.cur?.phase === 'work' ? `walk1${Math.floor(me.anim * 6) % 3}` : me.walking ? `walk0${Math.floor(me.anim * 8) % 3}` : `idle0${Math.floor(me.anim * 2) % 2}`;
  const jobs = [...(g.cur ? [g.cur.job] : []), ...g.queue];
  const harvestedKinds = CROPS.filter((c) => g.harvested[c.id]).length;

  return (
    <div className="fgx">
      <div className="fgx-sky" style={{ background: `linear-gradient(${skyTop}, ${skyLow})`, bottom: `${100 - HORIZON}%` }}>
        {night && <div className="fgx-stars" aria-hidden />}
      </div>
      {(g.stage === 'day' || g.stage === 'dusk') && <div className="fgx-sun" aria-hidden style={{ left: `${sunLeft}%`, top: `${sunTop}%` }} />}
      <div className="fgx-ground" style={{ top: `${HORIZON}%`, filter: `brightness(${light})` }} />
      <div className="fgx-mapwrap" style={{ width: MAP_W * fit, height: MAP_H * fit, filter: `brightness(${light})` }}>
        <div className="fgx-map" style={{ width: MAP_W, height: MAP_H, transform: `scale(${fit})` }}>
          {tiles}
          <img src={`${ART}tiles/rocks-big.png`} alt="" className="fgx-px fgx-sprite" style={{ left: iso(8, 1).x - 32, top: iso(8, 1).y - 22, zIndex: iso(8, 1).y }} />
          <img src={`${ART}tiles/rock1.png`} alt="" className="fgx-px fgx-tile" style={{ left: iso(1, 7).x - 16, top: iso(1, 7).y - 8 }} />
          <img src={`${ART}house.png`} alt="The farmer's house" className="fgx-px fgx-sprite" style={{ left: HOUSE.x, top: HOUSE.y, zIndex: HOUSE.y + 100 }} />
          {PLOTS.map((p, i) => {
            const pl = g.plots[i];
            const tile = !pl ? 'plot' : pl.watered ? 'wet' : pl.stage === 0 ? 'seeded' : 'tilled';
            return <img key={`t${i}`} src={`${ART}tiles/${tile}.png`} alt="" className="fgx-px fgx-tile" style={{ left: p.x - 16, top: p.y - 8 }} />;
          })}
          {PLOTS.map((p, i) => {
            const pl = g.plots[i];
            return pl && pl.stage > 0 ? (
              <img key={`c${i}`} src={`${ART}crops/${pl.crop}${pl.stage}.png`} alt="" className={`fgx-px fgx-crop${pl.stage === 3 ? ' ripe' : ''}`} style={{ left: p.x, top: p.y + 4, zIndex: p.y + 4 }} />
            ) : null;
          })}
          {jobs.map((j, k) => (
            <span key={`j${j.plot}`} className={`fgx-job${k === 0 && g.cur ? ' now' : ''}`} style={{ left: PLOTS[j.plot].x, top: PLOTS[j.plot].y - 30, zIndex: 900 }} aria-hidden>
              <img src={`${ART}ui/${JOB_ICON[j.kind]}.png`} alt="" className="fgx-px" /><b>{k + 1}</b>
            </span>
          ))}
          {!me.inside && (
            <img src={`${ART}farmer/${frameName}.png`} alt="The farmer" className="fgx-px fgx-farmer" style={{ left: me.x - 8, top: me.y - 15, zIndex: Math.round(me.y) + 5, transform: me.face < 0 ? 'scaleX(-1)' : undefined }} />
          )}
          {g.cur?.phase === 'work' && <span className="fgx-work" style={{ left: me.x, top: me.y - 24, zIndex: 950 }} aria-hidden><img src={`${ART}ui/${JOB_ICON[g.cur.job.kind]}.png`} alt="" className="fgx-px" /></span>}
          {PLOTS.map((p, i) => {
            const pl = g.plots[i];
            const label = !pl ? 'Empty plot. Tap to plant seeds.' : `${cropOf(pl.crop).name}, ${STAGE_NAME[pl.stage]}${pl.watered ? ', watered' : ''}. ${pl.stage === 3 ? 'Tap to harvest.' : pl.watered ? '' : 'Tap to water.'}`;
            return <button key={`b${i}`} type="button" className="fgx-hit" style={{ left: p.x - 16, top: p.y - 18, zIndex: 1000 }} onClick={() => tap(i)} aria-label={label} disabled={g.stage !== 'day'} />;
          })}
        </div>
      </div>
      <header className="fd-head fgx-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} />
        <h1 className="fgx-title">Farm Grow</h1>
        <SfxToggle />
        <MyBest game="farmGrow" unit="crops harvested" />
        <button type="button" className="btn fgx-btn" onClick={() => setBook(true)}><img src={`${ART}ui/seeds.png`} alt="" className="fgx-px" /> Harvest Book ({harvestedKinds} / {CROPS.length})</button>
        {g.stage !== 'start' && g.stage !== 'end' && <span className="fgx-day">☀️ Day {g.round} of {rs.rounds}</span>}
      </header>
      <div className="fgx-bar">
        <p aria-live="polite">{say}</p>
        <button type="button" className="btn fgx-listen" onClick={() => speak(say, student.ttsSettings)} aria-label="Listen">🔊</button>
        {jobs.length > 0 && (
          <div className="fgx-jobs" aria-label="The farmer's job list">
            {jobs.map((j, k) => (
              <span key={k} className={k === 0 && g.cur ? 'now' : ''}><img src={`${ART}ui/${JOB_ICON[j.kind]}.png`} alt="" className="fgx-px" />{JOB_WORD[j.kind]}</span>
            ))}
          </div>
        )}
      </div>
      {g.stage === 'start' && (
        <div className="pf-overlay fgx-overlay">
          <div className="pf-panel fgx-panel">
            <h2>Farm Grow</h2>
            <img src={`${ART}farmer/idle00.png`} alt="" className="fgx-px fgx-hero" />
            <p>Tap plots to give the farmer jobs: plant, water and harvest. When the sun sets, the farmer goes home and watered crops grow overnight. Questions come between the days.</p>
            <RoundSettings ranges={ranges} rounds={rs.rounds} perRound={rs.perRound} onRounds={rs.setRounds} onPerRound={rs.setPerRound} locked={rs.locked} roundsLabel="Days to farm" perLabel="Questions between days" />
            <button type="button" className="btn btn-primary btn-lg fd-big" onClick={() => startDay(true)}>🌅 Start day 1</button>
          </div>
        </div>
      )}
      {g.stage === 'end' && (
        <div className="pf-overlay fgx-overlay">
          <div className="pf-panel fgx-panel">
            <h2>Harvest time is over!</h2>
            <p>{say}</p>
            <button type="button" className="btn fgx-listen" onClick={() => speak(say, student.ttsSettings)} aria-label="Listen">🔊</button>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-lg" onClick={() => back.go()}>🏠 Leave</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { g.stage = 'start'; tell('Pick how many days to farm and how many questions come between days.'); }}>🌱 Farm again</button>
            </div>
          </div>
        </div>
      )}
      {picker !== null && (
        <div className="pf-overlay fgx-overlay" onClick={() => { g.paused = false; setPicker(null); }}>
          <div className="pf-panel fgx-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Pick seeds to plant</h2>
            <div className="fgx-seeds">
              {CROPS.map((c) => (
                <button key={c.id} type="button" className="fgx-seed" onClick={() => pickSeed(c)}>
                  <img src={`${ART}crops/${c.id}-item.png`} alt="" className="fgx-px" />{c.name}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => { g.paused = false; setPicker(null); }}>Close</button>
          </div>
        </div>
      )}
      {book && (
        <div className="pf-overlay fgx-overlay" onClick={() => setBook(false)}>
          <div className="pf-panel fgx-panel" onClick={(e) => e.stopPropagation()}>
            <h2>Harvest Book</h2>
            <div className="fgx-seeds">
              {CROPS.map((c) => (
                <button key={c.id} type="button" className={`fgx-seed${g.harvested[c.id] ? '' : ' locked'}`} onClick={() => g.harvested[c.id] && speak(`${c.name}. ${c.fact}`, student.ttsSettings)}>
                  <img src={`${ART}crops/${c.id}-item.png`} alt="" className="fgx-px" style={{ filter: g.harvested[c.id] ? undefined : 'brightness(0) opacity(0.3)' }} />
                  <b>{g.harvested[c.id] ? c.name : '???'}</b>
                  <small>{g.harvested[c.id] ? `Harvested ${g.harvested[c.id]}` : 'Grow one to find out!'}</small>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-lg" onClick={() => setBook(false)}>Close</button>
          </div>
        </div>
      )}
      {block && g.stage === 'questions' && (
        <QuestionScreen
          key={`${block.q.id}-${block.left}`}
          whoLabel={`🌙 Night ${g.round} questions${assignment ? ' · 📋 counts for your assignment' : ''}`}
          prompt={block.q.prompt}
          choices={block.q.choices}
          correctIndex={block.q.correctIndex}
          imageUrl={block.q.imageUrl}
          imageAlt={block.q.imageAlt}
          done={block.total - block.left}
          total={block.total}
          onCorrectAnswer={() => {
            countRight(block.q); recordStreakCorrect(student.id); g.unpaid += 1; g.stats.right += 1;
            if (block.left > 1) setBlock({ ...block, q: next(block.q.id), left: block.left - 1 }); else blockDone();
          }}
          onSkip={() => setBlock((b) => (b ? { ...b, q: next(b.q.id) } : b))}
          onExit={endGame}
          ttsSettings={student.ttsSettings}
        />
      )}
      {notice}
    </div>
  );
}
