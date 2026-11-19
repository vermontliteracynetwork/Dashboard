// Battle a classmate (Build Queue 735, her words: "for creaturemon battles, allow students to join and share a code to
// their fellow student (add a screen for join battles). they also want to do team battles where they would have
// multiple battles in a row of one species (one at a time)"). One student taps Make a battle and gets a 4 digit code;
// the other taps Join a battle and types it. Each picks one creature, or up to 3 for a team battle (one at a time:
// when one taps out, the next comes in). Every round both pick a move at the same time (fueled by a question in Learn
// mode), then the faster creature goes first. The maker's iPad keeps the score and sends it to the other one, through
// a Supabase Realtime room (nothing is stored). Nobody gets hurt: a creature that runs out of hearts taps out.
import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { speak } from '../../components/ReadAloud';
import { sfx } from '../../lib/miniSfx';
import { Sprite } from './Card';
import { Fx, XpBar, uiSound, type CmApi } from './shared';
import { IMG, STRONG, TYPE_COLOR, battleXp, displayName, form, line, type AbilityId, type Mon } from './data';
import { makeBF, nap, resolveMove, moveName, type BF, type MoveId } from './engine';

const UI = `${IMG}ui/`;
interface Side { name: string; team: BF[]; idx: number }
interface VState { sides: [Side, Side]; round: number; log: string[]; fx?: { side: 0 | 1; name: string; key: number }[]; done?: 0 | 1 | null; waiting: [boolean, boolean] }
type Join = { name: string; team: { formId: string; level: number; name: string; abs: AbilityId[]; uid: string }[] };

export default function Versus({ cm, ask, onClose }: { cm: CmApi; ask: (label: string, onRight: () => void, onCancel?: () => void) => void; onClose: () => void }) {
  const tts = cm.student?.ttsSettings; const myName = cm.student?.name ?? 'Me';
  const [step, setStep] = useState<'menu' | 'code' | 'team' | 'wait' | 'fight'>('menu');
  const [role, setRole] = useState<'host' | 'guest'>('host');
  const [teamMode, setTeamMode] = useState(false);
  const [code, setCode] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [friend, setFriend] = useState<string>('');
  const [st, setSt] = useState<VState | null>(null);
  const [myMove, setMyMove] = useState<MoveId | null>(null);
  const [note, setNote] = useState('');
  const ch = useRef<RealtimeChannel | null>(null);
  const joins = useRef<[Join | null, Join | null]>([null, null]);
  const moves = useRef<[{ m: MoveId; foc: number } | null, { m: MoveId; foc: number } | null]>([null, null]);
  const stRef = useRef(st); stRef.current = st;
  const rewarded = useRef(false);
  const me: 0 | 1 = role === 'host' ? 0 : 1;
  // the room's handlers are made once, so they read these refs (not old state)
  const roleRef = useRef<'host' | 'guest'>('host'); const teamRef = useRef(false);
  useEffect(() => () => { if (ch.current) void supabase.removeChannel(ch.current); }, []);

  const send = (event: string, payload: Record<string, unknown>) => { void ch.current?.send({ type: 'broadcast', event, payload }); };
  const open = (c: string, r: 'host' | 'guest') => {
    if (!isSupabaseConfigured) { setNote('Battles with a friend need the class server. Ask your teacher.'); return; }
    if (ch.current) void supabase.removeChannel(ch.current);
    const c2 = supabase.channel(`cmv-${c}`, { config: { broadcast: { self: false }, presence: { key: `${r}-${cm.student?.id}` } } });
    c2.on('broadcast', { event: 'join' }, ({ payload }) => { if (r !== 'host') return; joins.current[1] = payload as Join; setFriend((payload as Join).name); sfx.chime(); maybeStart(); })
      .on('broadcast', { event: 'hello' }, () => { if (r === 'host') send('hosthere', { name: myName, team: teamRef.current }); })
      .on('broadcast', { event: 'hosthere' }, ({ payload }) => { if (r === 'guest') { setFriend((payload as { name: string }).name); setTeamMode(!!(payload as { team: boolean }).team); teamRef.current = !!(payload as { team: boolean }).team; setStep((s) => (s === 'code' ? 'team' : s)); } })
      .on('broadcast', { event: 'move' }, ({ payload }) => { if (r !== 'host') return; const p = payload as { m: MoveId; foc: number }; moves.current[1] = p; resolveIfReady(); })
      .on('broadcast', { event: 'state' }, ({ payload }) => { if (r === 'guest') { show(payload as VState); } })
      .on('presence', { event: 'leave' }, () => { setNote('Your friend left the battle.'); })
      .subscribe((status) => { if (status === 'SUBSCRIBED') { void c2.track({ role: r }); if (r === 'guest') send('hello', {}); } });
    ch.current = c2;
  };
  const makeBattle = (team: boolean) => {
    const c = String(Math.floor(1000 + Math.random() * 9000)); setCode(c); setRole('host'); roleRef.current = 'host'; setTeamMode(team); teamRef.current = team; setStep('team'); uiSound('popup-open-1');
    open(c, 'host'); speak(`Your battle code is ${c.split('').join(' ')}. Tell your friend.`, tts);
  };
  const joinBattle = () => { if (!/^\d{4}$/.test(code)) return; setRole('guest'); roleRef.current = 'guest'; open(code, 'guest'); uiSound('select-1'); setNote('Looking for the battle...'); window.setTimeout(() => setNote((n) => (n === 'Looking for the battle...' ? 'No battle with that code yet. Check the code with your friend.' : n)), 6000); };
  const myJoin = (): Join => ({ name: myName, team: picked.map((u) => cm.S.mons.find((m) => m.uid === u)!).filter(Boolean).map((m) => ({ formId: m.formId, level: m.level, name: displayName(m), abs: m.abilities ?? [], uid: m.uid })) });
  const ready = () => {
    if (!picked.length) return; setStep('wait'); uiSound('select-1');
    if (role === 'host') { joins.current[0] = myJoin(); maybeStart(); } else send('join', myJoin());
  };
  const maybeStart = () => {
    const [a, b] = joins.current; if (!a || !b) return;
    const side = (j: Join): Side => ({ name: j.name, team: j.team.map((t) => makeBF(t.formId, t.level, t.name, t.abs, t.uid)), idx: 0 });
    const s: VState = { sides: [side(a), side(b)], round: 1, log: [`${a.name} and ${b.name} are battling! Round 1. Pick a move.`], waiting: [true, true], done: null };
    broadcast(s);
  };
  const broadcast = (s: VState) => { show(s); send('state', s as unknown as Record<string, unknown>); };
  const show = (s: VState) => {
    setSt(s); setStep('fight');
    if (s.waiting[0] && s.waiting[1]) setMyMove(null);
    const last = s.log[s.log.length - 1]; if (last) speak(last, tts);
    if (s.done != null && !rewarded.current) reward(s);
  };
  // the maker's iPad: when both moves are in, the faster creature goes first
  const resolveIfReady = () => {
    const s = stRef.current; const [m0, m1] = moves.current; if (!s || !m0 || !m1 || s.done != null) return;
    moves.current = [null, null];
    const sides: [Side, Side] = [{ ...s.sides[0], team: [...s.sides[0].team] }, { ...s.sides[1], team: [...s.sides[1].team] }];
    const cur = (i: 0 | 1) => sides[i].team[sides[i].idx]; const setCur = (i: 0 | 1, f: BF) => { sides[i].team[sides[i].idx] = f; };
    const order: (0 | 1)[] = cur(0).spd === cur(1).spd ? (Math.random() < 0.5 ? [0, 1] : [1, 0]) : cur(0).spd > cur(1).spd ? [0, 1] : [1, 0];
    const log: string[] = []; const fx: VState['fx'] = []; let done: 0 | 1 | null = null;
    for (const i of order) {
      const o = (1 - i) as 0 | 1; const mv = i === 0 ? m0 : m1;
      if (cur(i).hp <= 0) continue;
      const r = resolveMove(cur(i), cur(o), mv.m, mv.foc); setCur(i, r.a); setCur(o, r.d); log.push(r.text);
      if (r.fx) fx.push({ side: r.hit ? o : i, name: r.fx, key: Math.random() });
      if (cur(o).hp <= 0) {
        log.push(`${cur(o).name} taps out. High five!`);
        if (sides[o].idx < sides[o].team.length - 1) { sides[o].idx += 1; log.push(`${sides[o].name} sends in ${cur(o).name}!`); }
        else { done = i; log.push(`${sides[i].name} wins the battle!`); }
        break;
      }
      const n = nap(cur(i)); if (n.text) { setCur(i, n.f); log.push(n.text); fx.push({ side: i, name: 'heal', key: Math.random() }); }
    }
    if (done == null) log.push(`Round ${s.round + 1}. Pick a move.`);
    broadcast({ sides, round: s.round + 1, log: [...s.log, ...log].slice(-6), fx, done, waiting: [true, true] });
  };
  const pick = (m: MoveId) => {
    if (!st || myMove || st.done != null) return;
    const mine = st.sides[me].team[st.sides[me].idx]; if (m === 'berry' && !mine.berry) return;
    setMyMove(m); uiSound('select-1');
    const go = (foc: number) => { if (role === 'host') { moves.current[0] = { m, foc }; resolveIfReady(); } else send('move', { m, foc }); };
    ask(`Creaturemon: answer to fuel ${moveName(mine, m)}`, () => go(1), () => go(0.35));
  };
  // XP and stats for my own creatures when the battle ends
  const reward = (s: VState) => {
    rewarded.current = true; const mine = roleRef.current === 'host' ? 0 : 1; const won = s.done === mine; const foeSide = s.sides[1 - mine];
    const lv = Math.max(...foeSide.team.map((f) => f.level));
    for (const f of s.sides[mine].team) {
      if (!f.uid) continue; const gain = Math.round(battleXp(lv, won) * (f.abs.includes('cheerful') ? 1.2 : 1));
      cm.train(f.uid, gain); cm.stat(f.uid, (x) => ({ ...x, battles: x.battles + 1, wins: x.wins + (won ? 1 : 0), losses: x.losses + (won ? 0 : 1) }));
    }
    cm.put({ wins: cm.sRef.current.wins + (won ? 1 : 0), orbs: cm.sRef.current.orbs + (won ? 2 : 0) });
    sfx.chime();
  };

  const max = teamMode ? 3 : 1;
  const togglePick = (m: Mon) => setPicked((p) => (p.includes(m.uid) ? p.filter((x) => x !== m.uid) : p.length >= max ? (max === 1 ? [m.uid] : p) : [...p, m.uid]));
  const doNow = step === 'menu' ? 'Make a battle and share the code, or join a friend\'s battle with their code.'
    : step === 'code' ? 'Type the 4 numbers your friend sees, then tap Join.'
    : step === 'team' ? (teamMode ? 'Pick up to 3 creatures for your team, then tap Ready.' : 'Pick the creature you want to battle with, then tap Ready.')
    : step === 'wait' ? (role === 'host' && !friend ? `Waiting for your friend. Your code is ${code}.` : 'Waiting for your friend to be ready...')
    : st?.done != null ? (st.done === me ? 'You won! Tap Done.' : 'Good try! Tap Done.') : myMove ? `Waiting for ${friend || 'your friend'} to pick a move...` : 'Pick a move!';

  const meter = (sd: Side, who: 'me' | 'foe') => {
    const f = sd.team[sd.idx]; const hearts = Math.max(4, Math.min(10, Math.round(f.max / 12))); const per = f.max / hearts;
    return (
      <div className={`cmb-meter ${who}`} style={{ borderColor: TYPE_COLOR[f.type] }}>
        <b>{sd.name}</b><small>{f.name} · Lv {f.level} · {f.type}</small>
        <div className="cmb-hearts">{Array.from({ length: hearts }, (_, i) => { const q = Math.ceil(Math.max(0, Math.min(1, (f.hp - i * per) / per)) * 4); const col = q >= 4 ? 0 : q === 3 ? 3 : q === 2 ? 1 : q === 1 ? 2 : 4; return <i key={i} className="cmb-heart" style={{ backgroundImage: `url(${UI}heart_spritesheet_32x32.png)`, backgroundPosition: `${-col * 32}px 0` }} />; })}</div>
        <small className="cmb-hpnum">{f.hp} / {f.max}</small>
        {sd.team.length > 1 && <small>Team: {sd.team.map((_, i) => (i < sd.idx ? '○' : '●')).join(' ')}</small>}
      </div>
    );
  };
  const stand = (sd: Side, who: 'me' | 'foe', idx: 0 | 1) => {
    const f = form(sd.team[sd.idx].formId); const fx = st?.fx?.find((x) => x.side === idx);
    return (
      <div className={`cmb-side ${who}`}>
        <div className="cmb-stand">
          <Sprite f={f} px={Math.min(150, 60 + f.stage * 26)} style={who === 'me' ? { transform: 'scaleX(-1)' } : undefined} />
          <span className="cmb-plat"><img src={`${UI}grass_basic_01.png`} alt="" className="cmb-tuft l" /><img src={`${UI}grass_basic_03.png`} alt="" className="cmb-tuft r" /></span>
          {fx && <span className="cmb-fxat" key={fx.key}><Fx name={fx.name} size={170} /></span>}
        </div>
      </div>
    );
  };
  const mineNow = st ? st.sides[me].team[st.sides[me].idx] : null;

  return (
    <div className="cmb" role="dialog" aria-label="Battle a friend">
      <div className="cmb-guide" role="status">
        <p className="cmb-now">{doNow}</p>
        <button type="button" className="btn" onClick={() => speak(doNow, tts)} aria-label="Listen">🔊</button>
        {(step !== 'fight' || st?.done != null) && <button type="button" className="btn" onClick={() => { uiSound('popup-close-1'); onClose(); }}>{st?.done != null ? 'Done' : 'Leave'}</button>}
      </div>
      {note && <p className="cmv-note" role="status">{note}</p>}
      {step === 'menu' && (
        <div className="cmv-menu">
          <button type="button" className="cmv-big" onClick={() => makeBattle(false)}><img src={`${UI}i_sword.png`} alt="" /><b>Make a battle</b><small>One creature each</small></button>
          <button type="button" className="cmv-big" onClick={() => makeBattle(true)}><img src={`${UI}i_trophy.png`} alt="" /><b>Make a team battle</b><small>Up to 3 creatures each, one at a time</small></button>
          <button type="button" className="cmv-big join" onClick={() => { setStep('code'); setCode(''); uiSound('popup-open-1'); }}><img src={`${UI}i_unlock.png`} alt="" /><b>Join a battle</b><small>Type your friend's code</small></button>
        </div>
      )}
      {step === 'code' && (
        <div className="cmv-pad">
          <div className="cmv-code" aria-label={`Code ${code.split('').join(' ')}`}>{[0, 1, 2, 3].map((i) => <span key={i}>{code[i] ?? ''}</span>)}</div>
          <div className="cmv-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'go'].map((k) => (
              <button key={k} type="button" className={`cmv-key ${k}`} disabled={k === 'go' && code.length !== 4}
                onClick={() => { uiSound('cursor-1'); if (k === 'del') setCode((c) => c.slice(0, -1)); else if (k === 'go') joinBattle(); else setCode((c) => (c.length < 4 ? c + k : c)); }}>
                {k === 'del' ? 'Back' : k === 'go' ? 'Join' : k}
              </button>
            ))}
          </div>
        </div>
      )}
      {(step === 'team' || step === 'wait') && (
        <div className="cmb-pick">
          {role === 'host' && <div className="cmv-share"><small>Your battle code</small><b>{code}</b><small>{friend ? `${friend} joined!` : 'Tell your friend this code.'}</small></div>}
          {role === 'guest' && friend && <div className="cmv-share"><small>Battle with</small><b className="name">{friend}</b><small>{teamMode ? 'Team battle: up to 3 creatures' : 'One creature each'}</small></div>}
          {cm.team.map((m) => (
            <button key={m.uid} type="button" className={`cm-mon pick${picked.includes(m.uid) ? ' on' : ''}`} disabled={step === 'wait'} style={{ borderColor: TYPE_COLOR[line(m.formId).type] }} onClick={() => togglePick(m)} aria-pressed={picked.includes(m.uid)}>
              <Sprite f={form(m.formId)} px={56} />
              <div className="cm-mon-txt"><b>{displayName(m)}{picked.includes(m.uid) ? ` (${picked.indexOf(m.uid) + 1})` : ''}</b><small>Lv {m.level} · {line(m.formId).type}</small><XpBar m={m} /></div>
            </button>
          ))}
          {step === 'team' && <button type="button" className="cm-big fight" disabled={!picked.length} onClick={ready}>Ready</button>}
        </div>
      )}
      {step === 'fight' && st && mineNow && (
        <div className="cmb-arena" style={{ backgroundImage: `url(${IMG}sky/demo06.png)` }}>
          <span className="cmb-round">Round {st.round}</span>
          {meter(st.sides[me], 'me')}
          {meter(st.sides[1 - me], 'foe')}
          {stand(st.sides[1 - me], 'foe', (1 - me) as 0 | 1)}
          {stand(st.sides[me], 'me', me)}
          <div className="cmb-log" aria-live="polite">{st.log.slice(-3).map((l, i) => <p key={i}>{l}</p>)}</div>
          {st.done == null ? (
            <div className="cmb-moves">
              {([['tackle', 'sword', 'Tackle', 'A strong bump'], ['special', 'thunder', line(mineNow.formId).special.name, `${mineNow.type} move. Strong vs ${STRONG[mineNow.type].join(' and ')}`], ['guard', 'shield', 'Guard', 'Block most of the next hit'], ['berry', 'meat', 'Berry snack', mineNow.berry ? 'Get health back (once)' : 'Eaten']] as [MoveId, string, string, string][]).map(([id, icon, name, how]) => (
                <button key={id} type="button" className={`cmb-move ${id === 'tackle' ? 'blue' : 'grey'}${myMove === id ? ' chosen' : ''}`} style={id === 'special' ? { background: TYPE_COLOR[mineNow.type] } : undefined}
                  disabled={!!myMove || (id === 'berry' && !mineNow.berry)} onClick={() => pick(id)}>
                  <img src={`${UI}i_${icon}.png`} alt="" /><span><b>{name}</b><small>{how}</small></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="cmb-done">
              <div className="cmb-banner" style={{ backgroundImage: `url(${UI}${st.done === me ? 'wing_blue' : 'wing_silver'}.png)` }}><h2>{st.done === me ? 'You won!' : 'Good try!'}</h2></div>
              <p>Your creatures got XP{st.done === me ? ' and you found 2 orbs' : ''}. High fives, {friend || 'friend'}!</p>
              <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>Done</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
