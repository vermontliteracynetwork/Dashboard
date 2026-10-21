import { Suspense, useEffect, useState } from 'react';
import { lazyFresh } from '../../lib/freshBuild';
import { speak } from '../../components/ReadAloud';
import type { NpcProfile } from '../../style/npcs';
import type { TTSSettings } from '../../types';
import { sfx } from '../../lib/miniSfx';
import type { PlinkoTheme } from '../../lib/plinkoThemes';

const NpcPortrait3D = lazyFresh(() => import('../../components/NpcPortrait3D'));

// Plinko's setup, modeled on Baamboozle's Plink-oh menus (Build Queue 283, her words: "i want the menus for plinko
// to be more like this. studetns should have sliders, the title image of the game should be on the main menu page
// like image 2. image 3 and 4 should be used to model selecting players and also selecting their balls").
// 1 Main menu: the big game title (a theme's own title picture when one is picked) over chunky sliders for Players,
// Rounds and Questions each turn, plus the theme row. 2 Who is playing (only with 2 or more): a classmate's name or
// a Neighbor invite ("Inviting Roscoe..." with their picture, Build Queue 255). 3 The ball grid: "Ava, pick your
// ball" over every ball, numbered; a picked ball wears its player's name tag; it moves on to the next player by
// itself. 4 Players: each player's ball and name, with Back, Random and Start. The speaker button reads every page.
// Build Queue 288 (her words: "no emojis in plinko, lessen the word length for titles, remove unneccary subtitles. dont
// completely model the visual design, but rather the layout"): Plink-oh's layout, her own look (Inclusive Sans and her
// pastel palette, see .pkx in index.css), short titles, no emojis.

// Her Ball Collection (Build Queue 295, her words: "use this for plinko"): 30 balls, sports, billiards, planets, bowling and colors.
const B = '/games/plinko/balls/';
export const BALLS = [
  { id: 'basket-ball', name: 'Basket Ball', bg: `center / contain no-repeat url("${B}basket-ball.png")` },
  { id: 'white-soccer-ball', name: 'White Soccer Ball', bg: `center / contain no-repeat url("${B}white-soccer-ball.png")` },
  { id: 'tennis-ball', name: 'Tennis Ball', bg: `center / contain no-repeat url("${B}tennis-ball.png")` },
  { id: 'baseball-ball', name: 'Baseball Ball', bg: `center / contain no-repeat url("${B}baseball-ball.png")` },
  { id: 'volley-ball', name: 'Volley Ball', bg: `center / contain no-repeat url("${B}volley-ball.png")` },
  { id: 'beach-ball', name: 'Beach Ball', bg: `center / contain no-repeat url("${B}beach-ball.png")` },
  { id: '8-billiard-ball', name: 'Eight Ball', bg: `center / contain no-repeat url("${B}8-billiard-ball.png")` },
  { id: '1-billiard-ball', name: 'One Ball', bg: `center / contain no-repeat url("${B}1-billiard-ball.png")` },
  { id: 'earth-america', name: 'Earth America', bg: `center / contain no-repeat url("${B}earth-america.png")` },
  { id: 'earth-europe', name: 'Earth Europe', bg: `center / contain no-repeat url("${B}earth-europe.png")` },
  { id: 'earth-africa', name: 'Earth Africa', bg: `center / contain no-repeat url("${B}earth-africa.png")` },
  { id: 'earth-asia', name: 'Earth Asia', bg: `center / contain no-repeat url("${B}earth-asia.png")` },
  { id: 'moon', name: 'Moon', bg: `center / contain no-repeat url("${B}moon.png")` },
  { id: 'mars', name: 'Mars', bg: `center / contain no-repeat url("${B}mars.png")` },
  { id: 'jupiter', name: 'Jupiter', bg: `center / contain no-repeat url("${B}jupiter.png")` },
  { id: 'magenta-bowlling', name: 'Magenta Bowling', bg: `center / contain no-repeat url("${B}magenta-bowlling.png")` },
  { id: 'cyan-bowlling', name: 'Cyan Bowling', bg: `center / contain no-repeat url("${B}cyan-bowlling.png")` },
  { id: 'yellow-bowlling', name: 'Yellow Bowling', bg: `center / contain no-repeat url("${B}yellow-bowlling.png")` },
  { id: 'grey-soccer-ball', name: 'Grey Soccer Ball', bg: `center / contain no-repeat url("${B}grey-soccer-ball.png")` },
  { id: 'coin', name: 'Coin', bg: `center / contain no-repeat url("${B}coin.png")` },
  { id: 'spike-ball', name: 'Spike Ball', bg: `center / contain no-repeat url("${B}spike-ball.png")` },
  { id: 'red', name: 'Red', bg: `center / contain no-repeat url("${B}red.png")` },
  { id: 'orange', name: 'Orange', bg: `center / contain no-repeat url("${B}orange.png")` },
  { id: 'green', name: 'Green', bg: `center / contain no-repeat url("${B}green.png")` },
  { id: 'blue', name: 'Blue', bg: `center / contain no-repeat url("${B}blue.png")` },
  { id: 'purple', name: 'Purple', bg: `center / contain no-repeat url("${B}purple.png")` },
  { id: 'brown', name: 'Brown', bg: `center / contain no-repeat url("${B}brown.png")` },
  { id: 'black', name: 'Black', bg: `center / contain no-repeat url("${B}black.png")` },
  { id: 'grey', name: 'Grey', bg: `center / contain no-repeat url("${B}grey.png")` },
  { id: 'white', name: 'White', bg: `center / contain no-repeat url("${B}white.png")` },
];

export interface SetupPlayer { key: string; name: string; kind: 'me' | 'irl' | 'npc'; npcId?: string; ball: number }

export const SpeakerIcon = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></svg>;

// The column count that makes every row of a grid even (10 balls: 2 rows of 5; 30: 5 rows of 6).
export const gridCols = (n: number) => (n <= 5 ? n : n <= 10 ? Math.ceil(n / 2) : [6, 5, 8, 7, 4].find((c) => n % c === 0) ?? 6);

export function Slider({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className="pkx-slider">
      <div className="pkx-slider-label"><b>{label}</b></div>
      <div className="pkx-track-wrap">
        <span className="pkx-value" style={{ left: `calc(${pct}% + ${24 - pct * 0.48}px)` }}>{value}</span>
        <input type="range" min={min} max={max} step={1} value={value} disabled={disabled} aria-label={label}
          style={{ ['--pct' as string]: `${pct}%` }} onChange={(e) => { onChange(Number(e.target.value)); sfx.tick(); }} />
      </div>
    </div>
  );
}

export default function PlinkoSetup({ studentName, profiles, rounds, perTurn, ranges, locked, onRounds, onPerTurn, preNpc, tts, onStart, onLeave, themes = [], theme = null, onTheme }: {
  studentName: string; profiles: Record<string, NpcProfile>; rounds: number; perTurn: number;
  ranges: { rounds: { min: number; max: number }; per: { min: number; max: number } }; locked: boolean;
  onRounds: (n: number) => void; onPerTurn: (n: number) => void; preNpc?: string | null; tts?: TTSSettings;
  onStart: (players: SetupPlayer[]) => void; onLeave: () => void;
  // Build Queue 246: approved themes; a theme brings its own title picture and balls.
  themes?: PlinkoTheme[]; theme?: PlinkoTheme | null; onTheme?: (id: string | null) => void;
}) {
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(preNpc ? 2 : 1);
  const [others, setOthers] = useState<{ kind: 'irl' | 'npc' | null; name: string; npcId?: string }[]>(() => Array.from({ length: 4 }, (_, i) => (i === 0 && preNpc ? { kind: 'npc' as const, name: '', npcId: preNpc } : { kind: null, name: '' })));
  const [slot, setSlot] = useState(0);
  const [inviting, setInviting] = useState<string | null>(null);
  const [balls, setBalls] = useState<(number | null)[]>([null, null, null, null, null]);
  const [ballFor, setBallFor] = useState(0);
  const pages = ['menu', ...(count > 1 ? ['who'] : []), 'balls', 'players'] as const;
  const cur = pages[Math.min(page, pages.length - 1)];
  const ballList = theme ? theme.balls.map((src, i) => ({ id: `t${i}`, name: `Ball ${i + 1}`, bg: `center / cover no-repeat url("${src}")` })) : BALLS;
  const say = (t: string) => speak(t, tts);
  const names = [studentName, ...others.slice(0, count - 1).map((o) => (o.kind === 'npc' ? profiles[o.npcId ?? '']?.name ?? 'Neighbor' : o.name || 'Player'))];
  const SAY: Record<string, string> = {
    menu: 'Plinko! Slide to pick players, rounds and questions.',
    who: 'Who is playing with you? Add a classmate or invite a Neighbor.',
    balls: `${names[ballFor]}, pick a ball.`,
    players: 'Ready? Tap Start.',
  };
  useEffect(() => { say(SAY[cur]); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, ballFor]);
  // Neighbors pick their own ball, so only people in the room choose on the grid.
  const pickers = names.map((_, i) => i).filter((i) => i === 0 || others[i - 1]?.kind !== 'npc');
  const whoDone = others.slice(0, count - 1).every((o) => (o.kind === 'npc' && o.npcId) || (o.kind === 'irl' && o.name.trim()));
  const invite = (id: string) => {
    setInviting(id); sfx.pop();
    say(`Inviting ${profiles[id]?.name ?? 'your Neighbor'}`);
    window.setTimeout(() => {
      setOthers((o) => o.map((x, i) => (i === slot ? { kind: 'npc', name: '', npcId: id } : x)));
      setInviting(null); sfx.coin();
      say(`${profiles[id]?.name ?? 'Your Neighbor'} said yes!`);
      if (slot < count - 2) setSlot(slot + 1);
    }, 2200);
  };
  const chosenNpcs = new Set(others.slice(0, count - 1).map((o) => o.npcId).filter(Boolean));
  const freeBall = (taken: (number | null)[]) => { const free = ballList.map((_, k) => k).filter((k) => !taken.includes(k)); return free[Math.floor(Math.random() * free.length)] ?? 0; };
  // Neighbors get a ball of their own; anyone left without one gets a free one.
  const fillBalls = (bs: (number | null)[]) => { const out = bs.slice(0, count); for (let i = 0; i < count; i++) if (out[i] == null) out[i] = freeBall(out); return out; };
  const pickBall = (k: number) => {
    const bs = balls.map((x, i) => (i === ballFor ? k : x === k ? null : x)); setBalls(bs); sfx.pop();
    const nextPicker = pickers.find((i) => i > ballFor && bs[i] == null);
    if (nextPicker !== undefined) setBallFor(nextPicker);
    else window.setTimeout(() => { setBalls(fillBalls(bs)); setPage(pages.indexOf('players')); }, 450);
  };
  const random = () => { const pool = ballList.map((_, k) => k).sort(() => Math.random() - 0.5); setBalls(names.map((_, i) => pool[i % pool.length])); sfx.coin(); };
  const start = () => onStart(names.map((n, i) => ({ key: i === 0 ? 'me' : `p${i}`, name: n, kind: i === 0 ? 'me' : others[i - 1].kind ?? 'irl', npcId: i === 0 ? undefined : others[i - 1].npcId, ball: balls[i] ?? i })));
  const go = (to: typeof pages[number]) => setPage(pages.indexOf(to));
  const nextFromMenu = () => { setBallFor(0); go(count > 1 ? 'who' : 'balls'); };

  return (
    <div className="pkx">
      <div className="pkx-card">
        <button type="button" className="pkx-say" onClick={() => say(SAY[cur])} aria-label="Listen"><SpeakerIcon /></button>
        {cur === 'menu' && (
          <>
            <div className="pkx-title">{theme?.title ? <img src={theme.title} alt={`Plinko: ${theme.name}`} /> : <h1 aria-label="Plinko">Plink<b className="pkx-o" aria-hidden /></h1>}</div>
            <div className="pkx-sliders">
              <Slider label="Players" value={count} min={1} max={5} onChange={(n) => { setCount(n); setSlot(0); }} />
              <Slider label="Rounds" value={rounds} min={ranges.rounds.min} max={ranges.rounds.max} onChange={onRounds} disabled={locked} />
              <Slider label="Questions" value={perTurn} min={ranges.per.min} max={ranges.per.max} onChange={onPerTurn} disabled={locked} />
            </div>
            {locked && <p className="pkx-note">Set by your teacher</p>}
            {themes.length > 0 && (
              <div className="pkx-themes" aria-label="Theme">
                <button type="button" className={`pkx-theme${!theme || theme.id === 'default' ? ' on' : ''}`} onClick={() => { onTheme?.(null); sfx.pop(); }}><span className="pkx-theme-main" />Classic</button>
                {themes.map((t) => (
                  <button key={t.id} type="button" className={`pkx-theme${theme?.id === t.id ? ' on' : ''}`} onClick={() => { onTheme?.(t.id); setBalls([null, null, null, null, null]); sfx.pop(); say(t.name); }}>
                    <span style={{ background: t.cover ? `center / cover url("${t.cover}")` : t.background ? `center / cover url("${t.background}")` : t.colors.primary ?? '#5a3d9e' }} />{t.name}
                  </button>
                ))}
              </div>
            )}
            <div className="pkx-nav">
              <button type="button" className="pkx-btn" onClick={onLeave}>Leave</button>
              <button type="button" className="pkx-btn go" onClick={nextFromMenu}>Next</button>
            </div>
          </>
        )}

        {cur === 'who' && (
          <>
            <h2 className="pkx-h">Players</h2>
            <div className="pks-slots">
              <span className="pks-chip me">{studentName} (you)</span>
              {others.slice(0, count - 1).map((o, i) => (
                <button key={i} type="button" className={`pks-chip${slot === i ? ' on' : ''}${o.kind ? ' filled' : ''}`} onClick={() => setSlot(i)}>
                  {o.kind === 'npc' ? profiles[o.npcId ?? '']?.name : o.kind === 'irl' && o.name ? o.name : `Player ${i + 2}`}
                </button>
              ))}
            </div>
            <div className="pks-who">
              <div className="pks-irl">
                <b>Classmate</b>
                <input value={others[slot]?.kind === 'irl' ? others[slot].name : ''} placeholder="Type their name" aria-label={`Player ${slot + 2} name`} maxLength={18}
                  onChange={(e) => setOthers((o) => o.map((x, i) => (i === slot ? { kind: 'irl', name: e.target.value } : x)))} />
              </div>
              <div className="pks-npcs">
                <b>Neighbor</b>
                <div className="pks-npc-grid">
                  {Object.values(profiles).map((p) => {
                    const taken = chosenNpcs.has(p.id) && others[slot]?.npcId !== p.id;
                    return (
                      <button key={p.id} type="button" className={`pks-npc${others[slot]?.npcId === p.id ? ' on' : ''}`} disabled={taken || !!inviting} onClick={() => invite(p.id)} aria-label={`Invite ${p.name}`}>
                        <div className="pks-face"><Suspense fallback={<span className="pks-face-ph" />}><NpcPortrait3D look={p.look} framing="bust" /></Suspense></div>
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="pkx-nav">
              <button type="button" className="pkx-btn" onClick={() => go('menu')}>Back</button>
              <button type="button" className="pkx-btn go" disabled={!whoDone} onClick={() => { setBallFor(0); go('balls'); }}>Next</button>
            </div>
          </>
        )}

        {cur === 'balls' && (
          <>
            <h2 className="pkx-h">{names[ballFor]}</h2>
            {/* Build Queue 339 (her words: "put balls in rows of 5"): even rows for the real ball count, never a stranded last row. */}
            <div className="pkx-grid" style={{ gridTemplateColumns: `repeat(${gridCols(ballList.length)}, minmax(0, 1fr))`, maxWidth: gridCols(ballList.length) * 128, marginInline: 'auto' }}>
              {ballList.map((b, k) => {
                const owner = balls.slice(0, count).findIndex((x) => x === k);
                return (
                  <button key={b.id} type="button" className={`pkx-cell${owner === ballFor ? ' mine' : ''}`} disabled={owner >= 0 && owner !== ballFor} onClick={() => pickBall(k)} aria-label={owner >= 0 ? `${b.name}, ${names[owner]}'s ball` : `${b.name}, ball ${k + 1}`}>
                    <i className="pkx-ball" style={{ background: b.bg }} />
                    <span className={`pkx-tag${owner >= 0 ? ' who' : ''}`}>{owner >= 0 ? names[owner] : k + 1}</span>
                  </button>
                );
              })}
            </div>
            <div className="pkx-nav">
              <button type="button" className="pkx-btn" onClick={() => go(count > 1 ? 'who' : 'menu')}>Back</button>
              <button type="button" className="pkx-btn" onClick={() => { random(); go('players'); }}>Random</button>
            </div>
          </>
        )}

        {cur === 'players' && (
          <>
            <h2 className="pkx-h">Ready?</h2>
            <div className="pkx-team">
              {names.map((n, i) => (
                <div key={i} className="pkx-member">
                  <i className="pkx-ball big" style={{ background: (ballList[balls[i] ?? i] ?? ballList[0]).bg }} />
                  <span className="pkx-tag who">{n}</span>
                </div>
              ))}
            </div>
            <div className="pkx-nav four">
              <button type="button" className="pkx-btn" onClick={() => { setBallFor(0); go('balls'); }}>Back</button>
              <button type="button" className="pkx-btn" onClick={random}>Random</button>
              <button type="button" className="pkx-btn go" onClick={start}>Start</button>
            </div>
          </>
        )}
      </div>
      {inviting && (
        <div className="pks-inviting" role="status">
          <div className="pks-face big"><Suspense fallback={null}><NpcPortrait3D look={profiles[inviting].look} framing="bust" /></Suspense></div>
          <b>Inviting {profiles[inviting]?.name}<span className="pks-ell"><i>.</i><i>.</i><i>.</i></span></b>
        </div>
      )}
    </div>
  );
}
