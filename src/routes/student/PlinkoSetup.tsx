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

export const BALLS = [
  { id: 'sunset', name: 'Sunset', bg: 'radial-gradient(circle at 35% 30%, #ffd2a6, #ff7a1a 55%, #c94a00)' },
  { id: 'lime', name: 'Lime', bg: 'radial-gradient(circle at 35% 30%, #d9ffd0, #22c55e 55%, #137a3a)' },
  { id: 'grape', name: 'Grape', bg: 'radial-gradient(circle at 35% 30%, #eadcff, #8b5cf6 55%, #5427b8)' },
  { id: 'bubblegum', name: 'Bubblegum', bg: 'radial-gradient(circle at 35% 30%, #ffd9ec, #ec4899 55%, #a3175d)' },
  { id: 'ocean', name: 'Ocean', bg: 'radial-gradient(circle at 35% 30%, #d4fbff, #06b6d4 55%, #036c80)' },
  { id: 'gold', name: 'Gold', bg: 'radial-gradient(circle at 35% 30%, #fff6c2, #f5b800 55%, #a87600)' },
  { id: 'stripes', name: 'Stripes', bg: 'repeating-linear-gradient(45deg, #ef4444 0 8px, #ffffff 8px 16px)' },
  { id: 'galaxy', name: 'Galaxy', bg: 'radial-gradient(circle at 30% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 65% 60%, #fff 0 1.5px, transparent 2.5px), radial-gradient(circle at 40% 40%, #6d5ce8, #1e1660 70%)' },
  { id: 'dots', name: 'Polka Dots', bg: 'radial-gradient(circle, #fff 22%, transparent 24%) 0 0 / 33% 33%, #2f8cf0' },
  { id: 'rainbow', name: 'Rainbow', bg: 'conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #8b5cf6, #ef4444)' },
  { id: 'orange', name: 'Orange Slice', bg: 'radial-gradient(circle, #fff3c4 0 9%, transparent 10%), repeating-conic-gradient(#ffb02e 0 26deg, #fff1c9 26deg 30deg), #ff9a1f' },
  { id: 'eight', name: 'Eight Ball', bg: 'radial-gradient(circle at 50% 42%, #fff 0 22%, transparent 23%), radial-gradient(circle at 35% 30%, #5b5f8a, #1b1d33 70%)' },
  { id: 'basket', name: 'Basketball', bg: 'linear-gradient(90deg, transparent 47%, #3a1a06 47% 53%, transparent 53%), linear-gradient(0deg, transparent 47%, #3a1a06 47% 53%, transparent 53%), radial-gradient(circle at 35% 30%, #ffb26b, #e8661a 60%, #a8410a)' },
  { id: 'melon', name: 'Watermelon', bg: 'radial-gradient(circle at 40% 45%, #1d1d1d 0 4%, transparent 5%), radial-gradient(circle at 62% 40%, #1d1d1d 0 4%, transparent 5%), radial-gradient(circle at 52% 62%, #1d1d1d 0 4%, transparent 5%), radial-gradient(circle, #ff5a6e 0 62%, #f2f7e6 63% 68%, #2f9a43 69%)' },
  { id: 'mint', name: 'Mint Swirl', bg: 'repeating-conic-gradient(#e9fff6 0 20deg, #3ccf9a 20deg 40deg)' },
  { id: 'lava', name: 'Lava', bg: 'radial-gradient(circle at 30% 30%, #fff1a8, transparent 30%), radial-gradient(circle at 65% 70%, #ffcf3a, transparent 35%), radial-gradient(circle at 50% 50%, #ff5a1f, #b81a00 75%)' },
];

export interface SetupPlayer { key: string; name: string; kind: 'me' | 'irl' | 'npc'; npcId?: string; ball: number }

export const SpeakerIcon = () => <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></svg>;

function Slider({ label, value, min, max, onChange, disabled }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void; disabled?: boolean }) {
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
                <button type="button" className={`pkx-theme${!theme ? ' on' : ''}`} onClick={() => { onTheme?.(null); sfx.pop(); }}><span className="pkx-theme-main" />Classic</button>
                {themes.map((t) => (
                  <button key={t.id} type="button" className={`pkx-theme${theme?.id === t.id ? ' on' : ''}`} onClick={() => { onTheme?.(t.id); setBalls([null, null, null, null, null]); sfx.pop(); say(t.name); }}>
                    <span style={{ background: t.background ? `center / cover url("${t.background}")` : t.colors.primary ?? '#5a3d9e' }} />{t.name}
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
            <div className="pkx-grid">
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
