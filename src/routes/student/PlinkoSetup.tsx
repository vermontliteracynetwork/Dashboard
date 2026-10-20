import { Suspense, useEffect, useState } from 'react';
import { lazyFresh } from '../../lib/freshBuild';
import { speak } from '../../components/ReadAloud';
import type { NpcProfile } from '../../style/npcs';
import type { TTSSettings } from '../../types';
import { sfx } from '../../lib/miniSfx';

const NpcPortrait3D = lazyFresh(() => import('../../components/NpcPortrait3D'));

// Plinko's setup in simple pages (Build Queue 254, her words: "show the settings in more than one menu page so
// its easier for students to navigate independently. Thing rounds, players, then iput player names and have
// them select balls"). One question per page, big buttons, 🔊 on each page, Back and Next. Neighbors are
// invited, not picked from a list (255): their pictures, then "Inviting Roscoe..." with moving dots.

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
];

export interface SetupPlayer { key: string; name: string; kind: 'me' | 'irl' | 'npc'; npcId?: string; ball: number }

export default function PlinkoSetup({ studentName, profiles, rounds, perTurn, ranges, locked, onRounds, onPerTurn, preNpc, tts, onStart, onLeave }: {
  studentName: string; profiles: Record<string, NpcProfile>; rounds: number; perTurn: number;
  ranges: { rounds: { min: number; max: number }; per: { min: number; max: number } }; locked: boolean;
  onRounds: (n: number) => void; onPerTurn: (n: number) => void; preNpc?: string | null; tts?: TTSSettings;
  onStart: (players: SetupPlayer[]) => void; onLeave: () => void;
}) {
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(preNpc ? 2 : 1);
  const [others, setOthers] = useState<{ kind: 'irl' | 'npc' | null; name: string; npcId?: string }[]>(() => Array.from({ length: 4 }, (_, i) => (i === 0 && preNpc ? { kind: 'npc' as const, name: '', npcId: preNpc } : { kind: null, name: '' })));
  const [slot, setSlot] = useState(0); // which "other player" the who page is filling
  const [inviting, setInviting] = useState<string | null>(null);
  const [balls, setBalls] = useState<number[]>([0, 1, 2, 3, 4]);
  const [ballFor, setBallFor] = useState(0);
  const pages = ['rounds', 'players', ...(count > 1 ? ['who'] : []), 'balls'] as const;
  const cur = pages[Math.min(page, pages.length - 1)];
  const say = (t: string) => speak(t, tts);
  const SAY: Record<string, string> = {
    rounds: 'How many rounds, and how many questions each turn?',
    players: 'How many players?',
    who: 'Who is playing with you? Add a classmate or invite a Neighbor.',
    balls: 'Everyone picks a ball.',
  };
  useEffect(() => { say(SAY[cur]); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);
  const names = [studentName, ...others.slice(0, count - 1).map((o) => (o.kind === 'npc' ? profiles[o.npcId ?? '']?.name ?? 'Neighbor' : o.name || 'Player'))];
  const whoDone = others.slice(0, count - 1).every((o) => (o.kind === 'npc' && o.npcId) || (o.kind === 'irl' && o.name.trim()));
  const canNext = cur !== 'who' || whoDone;
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
  const next = () => { if (page < pages.length - 1) setPage(page + 1); else onStart(names.map((n, i) => ({ key: i === 0 ? 'me' : `p${i}`, name: n, kind: i === 0 ? 'me' : others[i - 1].kind ?? 'irl', npcId: i === 0 ? undefined : others[i - 1].npcId, ball: balls[i] }))); };

  const Stepper = ({ label, value, min, max, set }: { label: string; value: number; min: number; max: number; set: (n: number) => void }) => (
    <div className="pks-step">
      <b>{label}</b>
      <div className="pks-nums">
        {Array.from({ length: max - min + 1 }, (_, k) => min + k).map((n) => (
          <button key={n} type="button" className={`pks-num${value === n ? ' on' : ''}`} disabled={locked} onClick={() => set(n)}>{n}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="pf-overlay pks">
      <div className="pf-panel pks-card">
        <div className="pks-top">
          <div className="pks-dots" aria-label={`Step ${page + 1} of ${pages.length}`}>{pages.map((p, i) => <i key={p} className={i === page ? 'on' : i < page ? 'done' : ''} />)}</div>
          <button type="button" className="btn pks-say" onClick={() => say(SAY[cur])} aria-label="Listen">🔊</button>
        </div>
        {cur === 'rounds' && (
          <>
            <h2>Rounds</h2>
            <Stepper label="How many rounds?" value={rounds} min={ranges.rounds.min} max={ranges.rounds.max} set={onRounds} />
            <Stepper label="Questions each turn" value={perTurn} min={ranges.per.min} max={ranges.per.max} set={onPerTurn} />
            {locked && <p className="pks-note">Your teacher set these for your assignment.</p>}
          </>
        )}
        {cur === 'players' && (
          <>
            <h2>How many players?</h2>
            <div className="pks-nums big">
              {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={`pks-num${count === n ? ' on' : ''}`} onClick={() => { setCount(n); setSlot(0); }}>{n}</button>)}
            </div>
            <p className="pks-note">{count === 1 ? 'Just you.' : `You and ${count - 1} more: classmates here with you, or Neighbors.`}</p>
          </>
        )}
        {cur === 'who' && (
          <>
            <h2>Who is playing?</h2>
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
                <b>A classmate here with you</b>
                <input value={others[slot]?.kind === 'irl' ? others[slot].name : ''} placeholder="Type their name" aria-label={`Player ${slot + 2} name`} maxLength={18}
                  onChange={(e) => setOthers((o) => o.map((x, i) => (i === slot ? { kind: 'irl', name: e.target.value } : x)))} />
              </div>
              <div className="pks-npcs">
                <b>Or invite a Neighbor</b>
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
          </>
        )}
        {cur === 'balls' && (
          <>
            <h2>Pick your balls</h2>
            <div className="pks-slots">
              {names.map((n, i) => (
                <button key={i} type="button" className={`pks-chip${ballFor === i ? ' on' : ''}`} onClick={() => setBallFor(i)}>
                  <i className="pks-ball sm" style={{ background: BALLS[balls[i]].bg }} />{n}
                </button>
              ))}
            </div>
            <p className="pks-note">{names[ballFor]}, tap your ball.</p>
            <div className="pks-balls">
              {BALLS.map((b, k) => {
                const takenBy = balls.slice(0, count).findIndex((x, i) => x === k && i !== ballFor);
                return (
                  <button key={b.id} type="button" className={`pks-ballbtn${balls[ballFor] === k ? ' on' : ''}`} disabled={takenBy >= 0} onClick={() => { setBalls((bs) => bs.map((x, i) => (i === ballFor ? k : x))); sfx.pop(); if (ballFor < count - 1) setBallFor(ballFor + 1); }}>
                    <i className="pks-ball" style={{ background: b.bg }} /><span>{takenBy >= 0 ? names[takenBy] : b.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        <div className="pks-nav">
          <button type="button" className="btn btn-lg" onClick={() => (page ? setPage(page - 1) : onLeave())}>{page ? '← Back' : '← Leave'}</button>
          <button type="button" className="btn btn-primary btn-lg" disabled={!canNext} onClick={next}>{page === pages.length - 1 ? '▶ Start' : 'Next →'}</button>
        </div>
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
