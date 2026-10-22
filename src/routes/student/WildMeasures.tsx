import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { speak } from '../../components/ReadAloud';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { playCheer } from '../../lib/petSounds';
import {
  COLS, ROWS, FENCE_IQ, SPECIES, TIERS, alphaOf, areaBlocks, fenceWhole, foodNeed, foodPerDay, newWorld, nextQuestion, passDay, perimeterBlocks,
  score, sideFor, stressed, unitShort, unitWords, type Cell, type Question, type World,
} from '../../lib/wildMeasures';

// World Box (Build Queue 369 to 371; first built as "Wild Measures", then "Creator"; her brief in docs/measure-wilds/BRIEF.md). The Burrowbacks run their own world: they
// scout, claim land, grow their pack, learn fire and tools, and fence their turf. Before each outcome the game pauses
// and the student predicts a measurement (area, perimeter, fence blocks, food). The outcome then plays out the same
// whatever they guessed, the true value is shown with how to work it out, and close guesses earn coins.

type Saved = { world?: World; coins?: number; right?: number; exact?: number; tries?: number };
type Phase = 'watch' | 'predict' | 'reveal';
const LISTEN = <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>;

// An invented burrowing creature, drawn soft and anime-like: big shiny eyes, round body, wide digging claws.
function Burrowback({ alpha, young, dir }: { alpha?: boolean; young?: boolean; dir: number }) {
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

export default function WildMeasures() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const owner = `wm:${student?.id ?? ''}`;
  const saved = (styleLooks.find((r) => r.ownerId === owner)?.look as Saved | undefined) ?? {};
  const [world, setWorld] = useState<World>(() => saved.world ?? newWorld());
  const [stats, setStats] = useState({ coins: saved.coins ?? 0, right: saved.right ?? 0, exact: saved.exact ?? 0, tries: saved.tries ?? 0 });
  const [phase, setPhase] = useState<Phase>('watch');
  const [q, setQ] = useState<Question | null>(null);
  const [guess, setGuess] = useState('');
  const [result, setResult] = useState<{ label: 'exact' | 'close' | 'miss'; coins: number; guess: number } | null>(null);
  const [news, setNews] = useState<string | null>(`Meet the ${SPECIES.many}. They run this land. Watch what they do, and predict the measurements.`);
  const [pos, setPos] = useState<Record<string, { x: number; y: number; dir: number }>>({});
  const timers = useRef<number[]>([]);
  const tts = student?.ttsSettings;
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const save = (w: World, s: typeof stats) => mergeStyleRow(owner, { world: w, ...s });

  // The creatures roam their own turf.
  useEffect(() => {
    const move = () => setPos((old) => {
      const out: typeof old = {};
      for (const c of world.pack) {
        const cell = world.turf[Math.floor(Math.random() * world.turf.length)];
        const [cx, cy] = cell.split(',').map(Number);
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
  useEffect(() => {
    if (phase !== 'watch' || !student) return;
    const t = window.setTimeout(() => {
      const w = { ...world, side: sideFor(stats.exact) };
      const nq = nextQuestion(w);
      setWorld(w); setQ(nq); setGuess(''); setResult(null); setPhase('predict'); setNews(null);
      speak(`${nq.story} ${nq.ask}`, tts);
    }, news ? 4200 : 2600);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

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
    const { world: w, news: n } = passDay(world);
    setWorld(w); save(w, stats); setQ(null); setResult(null);
    setNews(n ?? (stressed(w) ? `The ${SPECIES.many} are hungry and stressed. They will scout for more land.` : null));
    if (n) speak(n, tts);
    setPhase('watch');
  };

  const turf = new Set(world.turf);
  const ghost = new Set(phase === 'predict' ? q?.ghost ?? [] : []);
  const showFence = world.fenced !== null;
  const fencedSet = new Set(world.fenced ? world.fenced.split('|') : []);
  const alpha = alphaOf(world);
  const food = foodPerDay(world), need = foodNeed(world);
  const nextTier = TIERS.find((t) => stats.right < t.at);
  const prevAt = [...TIERS].reverse().find((t) => stats.right >= t.at)?.at ?? 0;
  const cells: Cell[] = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) cells.push(`${x},${y}`);
  const edge = (c: Cell) => {
    if (!showFence || !fencedSet.has(c)) return '';
    const [x, y] = c.split(',').map(Number);
    return ['n', 'e', 's', 'w'].filter((_d, i) => !fencedSet.has(`${x + [0, 1, 0, -1][i]},${y + [-1, 0, 1, 0][i]}`)).map((d) => ` f${d}`).join('');
  };
  const say = () => speak(q ? `${q.story} ${q.ask}` : news ?? '', tts);

  return (
    <div className="wm">
      <header className="wm-head">
        <LeaveButton plain onLeave={() => back.go()} note="Your creatures keep their world, and your coins are saved." />
        <h1>World Box</h1>
        <SfxToggle plain />
        <span className="wm-chip" aria-label={`${stats.coins} coins`}>🪙 {stats.coins}</span>
      </header>

      <main className="wm-main">
        <section className="wm-board" aria-label={`The ${SPECIES.many}' land`}>
          <div className="wm-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}>
            {cells.map((c) => <i key={c} className={`${turf.has(c) ? 'turf' : ''}${ghost.has(c) ? ' ghost' : ''}${edge(c)}`} />)}
            {world.pack.map((c) => {
              const p = pos[c.id]; if (!p) return null;
              return (
                <span key={c.id} className={`wm-critter${c.young ? ' young' : ''}`} style={{ left: `${(p.x / COLS) * 100}%`, top: `${(p.y / ROWS) * 100}%`, width: `${(c.size * 140) / COLS}%` }} title={c.name}>
                  <Burrowback alpha={c.id === alpha.id} young={c.young} dir={p.dir} />
                </span>
              );
            })}
          </div>
          <div className="wm-scale"><span className="wm-scale-bar" style={{ width: `${100 / COLS}%` }} /> 1 block = {world.side} {unitShort(world.unit)} on each side</div>
        </section>

        <aside className="wm-side">
          <div className="wm-stats">
            <span><b>Day {world.day}</b></span>
            <span>{world.pack.length} {SPECIES.many} · alpha {alpha.name}</span>
            <span className={`wm-mood${stressed(world) ? ' bad' : ''}`}>{stressed(world) ? 'Stressed: not enough food' : 'Calm and fed'}</span>
            <span>Food: {food} a day · they eat {need}</span>
            <span className="wm-iq" aria-label={`Intelligence ${world.iq}`}>Smarts {world.iq}{world.iq < FENCE_IQ ? ` · fences at ${FENCE_IQ}` : fenceWhole(world) ? ' · fenced' : ' · can fence'}</span>
            {nextTier && <span className="wm-tier"><i style={{ width: `${((stats.right - prevAt) / (nextTier.at - prevAt)) * 100}%` }} /><em>{stats.right - prevAt} of {nextTier.at - prevAt} to {nextTier.name}</em></span>}
          </div>

          {phase === 'watch' && (
            <div className="wm-card watch">
              <button type="button" className="wm-say" onClick={say} aria-label="Listen">{LISTEN}</button>
              <p>{news ?? `The ${SPECIES.many} are busy. Watch what they decide to do...`}</p>
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
              <button type="button" className="wm-go" onClick={keepWatching}>Keep watching</button>
            </div>
          )}

          {phase !== 'predict' && <p className="wm-foot">Area {areaBlocks(world.turf)} blocks · around {perimeterBlocks(world.turf)} edges</p>}
        </aside>
      </main>
    </div>
  );
}
