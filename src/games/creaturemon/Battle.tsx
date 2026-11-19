// Creaturemon battles (Build Queue 715, her words: "the students have requested separate battles for their
// creaturemons, similar to pokemon battles and similar to our pet battle format"). Turn based, in the same steps as the
// Supernature creature battles: 1 pick your creature, 2 pick an opponent (two cards; a wild creature is already
// picked), 3 battle. Each round: tap one move, answer a question to fuel it, then the other creature answers with its own
// move (Learn mode, 718). One clear "do this now" line at the top, read aloud, with a Listen. Nobody gets hurt: the
// creature that runs out of health taps out and gets a high five. Health bars, buttons, banners and icons are from
// her Pixel UI pack 3 and IconGodotNode packs (716).
import { useEffect, useRef, useState } from 'react';
import { speak } from '../../components/ReadAloud';
import { sfx } from '../../lib/miniSfx';
import { CreatureCard, Sprite } from './Card';
import { XpBar, type CmApi } from './shared';
import { IMG, LINES, STRONG, TYPE_COLOR, battleXp, displayName, form, line, statsAt, typeMult, type CType, type Mon } from './data';

type MoveId = 'tackle' | 'special' | 'guard' | 'berry';
interface F { name: string; formId: string; level: number; type: CType; hp: number; max: number; atk: number; def: number; guard: boolean; berry: boolean }
const UI = `${IMG}ui/`;
const fighter = (formId: string, level: number, name: string): F => {
  const s = statsAt(form(formId), level); const max = Math.round(s.hp * 1.5);
  return { name, formId, level, type: line(formId).type, hp: max, max, atk: s.atk, def: s.def, guard: false, berry: true };
};
// An opponent about the student's level, in the right evolution stage for that level.
export function foeAt(level: number) {
  const l = LINES[Math.floor(Math.random() * LINES.length)]; const lv = Math.max(1, level + Math.floor(Math.random() * 3) - 1);
  let f = l.forms[0]; for (let i = 1; i < l.forms.length; i++) if ((l.forms[i - 1].evolvesAt ?? 99) <= lv) f = l.forms[i];
  return { formId: f.id, level: lv };
}
export type BattleEnd = { won: boolean; foe: { formId: string; level: number } } | null;

export default function Battle({ cm, wildFoe, ask, onClose }: {
  cm: CmApi; wildFoe?: { formId: string; level: number }; ask: (label: string, onRight: () => void, onCancel?: () => void, count?: number) => void;
  onClose: (r: BattleEnd) => void;
}) {
  const tts = cm.student?.ttsSettings;
  const [readOn, setReadOn] = useState(true);
  const readRef = useRef(readOn); readRef.current = readOn;
  const say = (t: string) => { if (readRef.current) speak(t, tts); };
  const [phase, setPhase] = useState<'pick' | 'foe' | 'fight' | 'done'>('pick');
  const [mine, setMine] = useState<Mon | null>(null);
  const [cards, setCards] = useState(() => { const lv = Math.max(1, ...cm.team.map((m) => m.level)); return [foeAt(lv), foeAt(lv)]; });
  const [foePick, setFoePick] = useState(wildFoe ?? null);
  const [me, setMe] = useState<F | null>(null);
  const [foe, setFoe] = useState<F | null>(null);
  const [stage, setStage] = useState<'choose' | 'mine' | 'theirs' | 'power'>('choose');
  const [round, setRound] = useState(1);
  const focusRef = useRef(0.6);
  const [lines, setLines] = useState<string[]>([]);
  const [fx, setFx] = useState<{ side: 'me' | 'foe'; hit: boolean; type: CType } | null>(null);
  const [shot, setShot] = useState<{ from: 'me' | 'foe'; type: CType } | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [xp, setXp] = useState(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const wait = (ms: number, fn: () => void) => { timer.current = window.setTimeout(fn, cm.calm ? ms * 0.7 : ms); };
  const add = (t: string, read = true) => { setLines((l) => [...l.slice(-2), t]); if (read) say(t); };

  const begin = (m: Mon, f: { formId: string; level: number }) => {
    const a = fighter(m.formId, m.level, displayName(m)), b = fighter(f.formId, f.level, `${wildFoe ? 'Wild ' : ''}${form(f.formId).name}`);
    setMe(a); setFoe(b); setPhase('fight'); setStage('choose'); setRound(1); focusRef.current = 0.6; sfx.chime();
    add(`${a.name} faces ${b.name}! Round 1. Tap one move for ${a.name}.`);
  };
  const pickMine = (m: Mon) => { setMine(m); sfx.pop(); if (foePick) begin(m, foePick); else setPhase('foe'); };
  const pickFoe = (f: { formId: string; level: number }) => { setFoePick(f); if (mine) begin(mine, f); };

  const moveName = (f: F, m: MoveId) => (m === 'special' ? line(f.formId).special.name : m === 'tackle' ? 'Tackle' : m === 'guard' ? 'Guard' : 'Berry snack');
  // One move. Hits: power, type, focus (right answers), the other creature's guard, a little luck.
  const doMove = (a: F, d: F, m: MoveId, side: 'me' | 'foe', foc: number): { a: F; d: F; text: string } => {
    if (m === 'guard') { sfx.tick(); return { a: { ...a, guard: true, hp: Math.min(a.max, a.hp + Math.round(a.max * 0.06)) }, d, text: `${a.name} uses Guard! It gets ready to block.` }; }
    if (m === 'berry') { sfx.coin(); return { a: { ...a, berry: false, hp: Math.min(a.max, a.hp + Math.round(a.max * 0.4)) }, d, text: `${a.name} eats a berry and gets health back!` }; }
    const special = m === 'special'; const other = side === 'me' ? 'foe' : 'me';
    const miss = Math.random() > (special ? 0.88 : 0.96);
    setFx({ side: other, hit: !miss, type: a.type }); window.setTimeout(() => setFx(null), 900);
    if (miss) { sfx.boing(); return { a, d: { ...d, guard: false }, text: `${a.name} uses ${moveName(a, m)}, but ${d.name} dodges!` }; }
    const mult = special ? typeMult(a.type, d.type) : 1;
    let dmg = (special ? 1.45 : 1) * a.atk * mult * (0.75 + 0.5 * foc) * (9 / (d.def + 9)) * (0.85 + Math.random() * 0.3) * 1.3;
    if (d.guard) dmg *= 0.45;
    const n = Math.max(1, Math.round(dmg)); sfx.bonk();
    const extra = mult > 1 ? ' It is super strong!' : mult < 1 ? ' It is not very strong.' : '';
    return { a, d: { ...d, hp: Math.max(0, d.hp - n), guard: false }, text: `${a.name} uses ${moveName(a, m)}!${extra} ${d.name} loses ${n} health.` };
  };
  const finish = (iWon: boolean, a: F, b: F) => {
    setWon(iWon); setPhase('done'); setShot(null);
    const gain = battleXp(b.level, iWon); setXp(gain);
    if (mine) cm.train(mine.uid, gain);
    cm.put({ wins: cm.sRef.current.wins + (iWon ? 1 : 0), orbs: cm.sRef.current.orbs + (iWon ? 2 : 0) });
    sfx.chime();
    say(iWon ? `${b.name} taps out. ${a.name} wins! High fives! ${a.name} gets ${gain} XP.${wildFoe ? ' It is tired now. Throw an orb!' : ''}` : `${a.name} taps out. ${b.name} wins this time. That is okay, every battle is practice. ${a.name} still gets ${gain} XP.`);
  };
  // Build Queue 718 (her words: "creaturemon, battles should be fueled by questions in learn mode"): in Learn mode every
  // move starts with a question. A right answer fuels the move to full power; skipping it makes a weak move. Play mode
  // skips the questions.
  const act = (m: MoveId) => {
    if (stage !== 'choose' || !me || !foe || (m === 'berry' && !me.berry)) return;
    setStage('power'); sfx.pop();
    ask(`Creaturemon: answer to fuel ${moveName(me, m)}`, () => { focusRef.current = 1; perform(m, true); }, () => { focusRef.current = 0.35; perform(m, false); });
  };
  const perform = (m: MoveId, fueled: boolean) => {
    if (!me || !foe) return;
    setStage('mine');
    if (!fueled && m !== 'guard' && m !== 'berry') add(`${me.name} has no fuel, so the move is weak.`, false);
    if (m === 'special') setShot({ from: 'me', type: me.type });
    wait(m === 'special' ? 900 : 500, () => {
      setShot(null);
      const r = doMove({ ...me, guard: false }, foe, m, 'me', focusRef.current);
      setMe(r.a); setFoe(r.d); add(r.text);
      if (r.d.hp <= 0) { wait(1300, () => finish(true, r.a, r.d)); return; }
      wait(1800, () => foeTurn(r.a, r.d));
    });
  };
  const foeTurn = (a: F, b: F) => {
    setStage('theirs');
    const strong = typeMult(b.type, a.type) > 1;
    const m: MoveId = b.hp < b.max * 0.35 && b.berry && Math.random() < 0.5 ? 'berry' : Math.random() < 0.12 ? 'guard' : strong || Math.random() < 0.5 ? 'special' : 'tackle';
    if (m === 'special') setShot({ from: 'foe', type: b.type });
    wait(m === 'special' ? 900 : 500, () => {
      setShot(null);
      const r = doMove({ ...b, guard: false }, a, m, 'foe', 0.55);
      setFoe(r.a); setMe(r.d); add(r.text);
      if (r.d.hp <= 0) { wait(1300, () => finish(false, r.d, r.a)); return; }
      wait(1800, () => next(r.d));
    });
  };
  const next = (a: F) => {
    setStage('choose'); setRound((x) => x + 1);
    add(`Your turn. Tap one move for ${a.name}.`);
  };
  const again = () => { setPhase('pick'); setMe(null); setFoe(null); setWon(null); setLines([]); setMine(null); if (!wildFoe) setFoePick(null); };

  const step = phase === 'pick' ? 1 : phase === 'foe' ? 2 : 3;
  const doNow = phase === 'pick' ? 'Tap the creature you want to battle with.'
    : phase === 'foe' ? 'Tap Battle under the creature you want to battle. Or tap New opponents.'
    : phase === 'done' ? (won ? (wildFoe ? 'You won! Tap Throw orb to catch it.' : 'You won! Tap Battle again or Done.') : 'Good try! Tap Battle again or Done.')
    : stage === 'choose' ? `Your turn! Tap one move for ${me?.name ?? 'your creature'}.`
    : stage === 'mine' ? `Just watch. ${me?.name ?? ''} is moving.`
    : stage === 'theirs' ? `Just watch. ${foe?.name ?? ''} is moving.`
    : 'Answer the question to fuel your move.';
  useEffect(() => { if (phase === 'pick' || phase === 'foe') say(doNow); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [phase]);

  // Build Queue 719 (her words: "battles should be heart related and xp bar. show health meters on left and right sides.
  // left for the player, right for the opponent"): health is a column of her AXIALE hearts on each side of the screen,
  // each heart filling in quarters; the student's side also shows the XP bar to the next level.
  const meter = (f: F, s: 'me' | 'foe') => {
    const hearts = Math.max(4, Math.min(10, Math.round(f.max / 12))); const per = f.max / hearts;
    const hitNow = fx?.side === s && fx.hit;
    const mon = s === 'me' && mine ? cm.sRef.current.mons.find((m) => m.uid === mine.uid) ?? mine : null;
    return (
      <div className={`cmb-meter ${s}`} style={{ borderColor: TYPE_COLOR[f.type] }} aria-label={`${f.name}: ${f.hp} of ${f.max} health`}>
        <b>{f.name}</b><small>Lv {f.level} · {f.type}{f.guard ? ' · guarding' : ''}</small>
        <div className={`cmb-hearts${hitNow ? ' hit' : ''}`}>
          {Array.from({ length: hearts }, (_, i) => {
            const left = Math.max(0, Math.min(1, (f.hp - i * per) / per)); const q = Math.ceil(left * 4); // 0 to 4 quarters
            const col = q >= 4 ? 0 : q === 3 ? 3 : q === 2 ? 1 : q === 1 ? 2 : 4; // her sheet: full, half, quarter, three quarters, empty
            return <i key={i} className="cmb-heart" style={{ backgroundImage: `url(${UI}heart_spritesheet_32x32.png)`, backgroundPosition: `${-col * 32}px 0` }} />;
          })}
        </div>
        <small className="cmb-hpnum">{f.hp} / {f.max}</small>
        {mon && <span className="cmb-xp"><small>XP</small><XpBar m={mon} /></span>}
      </div>
    );
  };
  const side = (f: F, s: 'me' | 'foe') => {
    const ff = form(f.formId); const back = s === 'me' && !!ff.sprite.back;
    return (
      <div className={`cmb-side ${s}${fx?.side === s ? (fx.hit ? ' hit' : ' miss') : ''}`}>
        <div className="cmb-stand">
          {back ? <img className="cmb-back" src={`${IMG}forms/${ff.id}_back.png`} alt="" style={{ height: Math.min(170, ff.sprite.fh * Math.max(1, Math.floor(150 / ff.sprite.fh))) }} />
            : <Sprite f={ff} px={Math.min(150, 60 + ff.stage * 26)} anim={fx?.side === s && fx.hit ? 'hurt' : 'idle'} style={s === 'me' ? { transform: 'scaleX(-1)' } : undefined} />}
          <span className="cmb-plat" />
          {fx?.side === s && !fx.hit && <span className="cmb-boom">Dodged!</span>}
          {fx?.side === s && fx.hit && <span className="cmb-spark" style={{ color: TYPE_COLOR[fx.type] }} />}
        </div>
      </div>
    );
  };
  const MOVES: { id: MoveId; icon: string; name: (f: F) => string; how: (f: F) => string; cls: string }[] = [
    { id: 'tackle', icon: 'sword', name: () => 'Tackle', how: () => 'A strong bump', cls: 'blue' },
    { id: 'special', icon: 'thunder', name: (f) => line(f.formId).special.name, how: (f) => `${f.type} move. Strong vs ${STRONG[f.type].join(' and ')}`, cls: 'orange' },
    { id: 'guard', icon: 'shield', name: () => 'Guard', how: () => 'Block most of the next hit', cls: 'grey' },
    { id: 'berry', icon: 'meat', name: () => 'Berry snack', how: (f) => (f.berry ? 'Get health back (once)' : 'Eaten'), cls: 'grey' },
  ];

  return (
    <div className="cmb" role="dialog" aria-label="Creaturemon battle">
      <div className="cmb-guide" role="status">
        <ol className="cmb-steps" aria-label={`Step ${step} of 3`}>
          {['Your creature', 'Opponent', 'Battle'].map((t, i) => <li key={t} className={i + 1 === step ? 'on' : i + 1 < step ? 'done' : ''}>{i + 1 < step ? '✓' : i + 1}<span>{t}</span></li>)}
        </ol>
        <p className="cmb-now">{doNow}</p>
        <button type="button" className="btn" onClick={() => speak(doNow, tts)} aria-label="Listen">🔊</button>
        <button type="button" className="btn" onClick={() => setReadOn((x) => !x)}>{readOn ? 'Read aloud: on' : 'Read aloud: off'}</button>
        {phase !== 'fight' && <button type="button" className="btn" onClick={() => onClose(won === null || !foePick ? null : { won, foe: foePick })}>{phase === 'done' ? 'Done' : 'Leave'}</button>}
      </div>

      {phase === 'pick' && (
        <div className="cmb-pick">
          {!cm.team.length && <p className="cmb-empty">Catch a creature first! Turn on Creaturemon and walk around Town Square.</p>}
          {cm.team.map((m) => (
            <button key={m.uid} type="button" className="cm-mon pick" style={{ borderColor: TYPE_COLOR[line(m.formId).type] }} onClick={() => pickMine(m)}>
              <Sprite f={form(m.formId)} px={64} />
              <div className="cm-mon-txt"><b>{displayName(m)}</b><small>Lv {m.level} · {line(m.formId).type} · {line(m.formId).special.name}</small><XpBar m={m} /></div>
            </button>
          ))}
        </div>
      )}
      {phase === 'foe' && (
        <div className="cmb-foes">
          {cards.map((c, i) => (
            <div key={i} className="cmb-foecard">
              <CreatureCard f={form(c.formId)} level={c.level} scale={0.95} />
              <b>Lv {c.level}</b>
              <button type="button" className="cm-big fight" onClick={() => pickFoe(c)}>Battle</button>
            </div>
          ))}
          <button type="button" className="btn btn-lg" onClick={() => { const lv = mine?.level ?? 5; setCards([foeAt(lv), foeAt(lv)]); sfx.pop(); }}>New opponents</button>
        </div>
      )}
      {(phase === 'fight' || phase === 'done') && me && foe && (
        <div className="cmb-arena" style={{ backgroundImage: `url(${IMG}sky/demo01.png)` }}>
          <span className="cmb-round">Round {round}</span>
          {meter(me, 'me')}
          {meter(foe, 'foe')}
          {side(foe, 'foe')}
          {side(me, 'me')}
          {shot && <span className={`cmb-shot from-${shot.from}`} style={{ background: TYPE_COLOR[shot.type], boxShadow: `0 0 24px ${TYPE_COLOR[shot.type]}` }} />}
          <div className="cmb-log" aria-live="polite">{lines.map((l, i) => <p key={i}>{l}</p>)}</div>
          {phase === 'fight' && (
            <div className="cmb-moves">
              {MOVES.map((mv) => (
                <button key={mv.id} type="button" className={`cmb-move ${mv.cls}`} disabled={stage !== 'choose' || (mv.id === 'berry' && !me.berry)} onClick={() => act(mv.id)}
                  style={mv.id === 'special' ? { background: TYPE_COLOR[me.type] } : undefined}>
                  <img src={`${UI}i_${mv.icon}.png`} alt="" /><span><b>{mv.name(me)}</b><small>{mv.how(me)}</small></span>
                </button>
              ))}
            </div>
          )}
          {phase === 'done' && (
            <div className="cmb-done">
              <div className="cmb-banner" style={{ backgroundImage: `url(${UI}${won ? 'wing_blue' : 'wing_silver'}.png)` }}><h2>{won ? 'You won!' : 'Good try!'}</h2></div>
              <p>{me.name} got <b>{xp} XP</b>{won ? <> and you found <b>2 orbs</b></> : null}.</p>
              <div className="cm-row">
                {won && wildFoe ? <button type="button" className="cm-big orb" onClick={() => onClose({ won: true, foe: foePick! })}>Throw orb</button>
                  : <button type="button" className="cm-big fight" onClick={again}>Battle again</button>}
                <button type="button" className="btn btn-lg" onClick={() => onClose(wildFoe ? { won: false, foe: foePick! } : { won: !!won, foe: foePick! })}>{won && wildFoe ? 'Let it go' : 'Done'}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
