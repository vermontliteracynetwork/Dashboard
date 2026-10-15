import { useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY_FACE, SN, snSound, POTION_ICON, type Energy, type SnSave } from '../../lib/supernature';
import { CREATURES, art, byId, madeList, type Creature } from '../../lib/supernatureCreatures';
import { startSkills, type SkillSet } from '../../lib/supernatureSkills';
import {
  AFF, ENERGY_FX, attack, confWord, confidenceOf, healthOf, magicOf, makeFighter, npcFighter, preBattle, randomNpc, speedOf, affOf, type Aff, type Fighter, type Npc,
} from '../../lib/supernatureBattle';
import QuestionScreen from '../../components/QuestionScreen';
import { useStore } from '../../store/store';
import { drawQuestion } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import type { MCQuestion } from '../../types';
import { Icon } from './SupernatureWriting';
import { Fx, HIT_FX, ORB_FX } from './SupernatureFx';
import PopCard from './SupernaturePopCard';

// Creature Battles (Build Queue 137): pick one of your Habitat creatures (each family member can have
// its own name), pick a wild opponent (two cards with skill bars, or roll the dice), maybe drink a
// battle potion, then take turns. Every attack asks a question: a right answer powers it up. Energy and
// confidence change everything, and creatures remember who beat them. Nobody gets hurt: whoever runs
// out of stamina taps out and gets a high five.
type BattleSave = NonNullable<SnSave['battle']>;
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
// The three meters every creature has (Build Queue 139): Magic, Health, Confidence.
const METERS = (magic: number, health: number, conf: number) => (
  <div className="sb-meters">
    {([['✨ Magic', magic, 'magic'], ['💚 Health', health, 'health'], ['💪 Confidence', conf, 'conf']] as const).map(([l, v, k]) => (
      <div key={k} className={`sb-m ${k}`}><span>{l}</span><i><b style={{ width: `${v}%` }} /></i><em>{Math.round(v)}</em></div>
    ))}
  </div>
);
// Two questions a round (her words, 2026-10-14: "reduce questions needed for attacks in battle to two questions").
const QUESTIONS_PER_ROUND = 2;
const STEP_TO_RIGHT: Record<Energy, Energy> = { 'very high': 'high', high: 'just right', 'just right': 'just right', low: 'just right', 'very low': 'low' };
const BATTLE_POTIONS: Record<string, string> = {
  Aero: 'Flying for this battle: harder to hit', Velo: 'Speed for this battle: goes first more', Fort: 'Tough for this battle: takes less', Mega: 'Power for this battle: hits harder',
  Pyro: 'Adds a Fire move', Cryo: 'Adds an Ice move', Aqua: 'Adds a Water move', Calma: 'Confidence +25', Viv: 'Energy to just right', Dorm: 'Energy to just right',
};

export default function SupernatureBattle({ bar, say, save, patch, potions, usePotion }: {
  bar: (o?: { extra?: React.ReactNode }) => React.ReactNode; say: (t: string) => void; save: SnSave; patch: (p: Partial<SnSave>) => void;
  potions: string[]; usePotion: (name: string) => void;
}) {
  const hab = save.habitat ?? {};
  const bs: BattleSave = save.battle ?? { npcs: [], log: [] };
  const setBs = (b: BattleSave) => patch({ battle: b });
  const ttsSettings = useStore((st) => st.students.find((x) => x.id === st.currentStudentId)?.ttsSettings);
  const questionSets = useStore((st) => st.questionSets);
  const [readOn, setReadOn] = useState(true);
  const speak = (t: string) => { if (readOn) say(t); };

  // Your fighters: every Habitat creature in play, one card per named family member.
  const fighters = useMemo(() => {
    const all = [...madeList().slice(-6).map((m) => m.id), ...(save.found ?? []).slice(-12)].map((id) => byId(id)).filter((c): c is Creature => !!c).slice(0, 16)
      .filter((c) => !(hab.out ?? []).includes(c.id) && hab.faded?.[c.id] === undefined && !(hab.gone ?? []).includes(c.id));
    return all.flatMap((c) => {
      const n = Math.max(1, Math.min(3, hab.groups?.[c.id] ?? 3));
      const k = ((hab.skills?.[c.id] as SkillSet | undefined) ?? startSkills(c));
      const health = healthOf(hab.health?.[c.id] ?? 5, hab.levels?.[c.id] ?? 1, (hab.seen?.[c.id] ?? []).length);
      return Array.from({ length: n }, (_, i) => ({ key: `${c.id}#${i}`, c, name: hab.names?.[c.id]?.[i] || (n > 1 ? `${c.name} ${i + 1}` : c.name), k, health }));
    });
  }, [save.found, hab]);
  const [phase, setPhase] = useState<'pick' | 'foe' | 'prep' | 'fight' | 'done'>('pick');
  const [mine, setMine] = useState<(typeof fighters)[number] | null>(null);
  const [cards, setCards] = useState<Npc[]>(() => [randomNpc(), randomNpc()]);
  const [foeNpc, setFoeNpc] = useState<Npc | null>(null);
  const [me, setMe] = useState<Fighter | null>(null);
  const [foe, setFoe] = useState<Fighter | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  // A round (her order): the student's action, the opponent's action back, a 3 to 5 second pause, then
  // three questions, then the next round.
  const [stage, setStage] = useState<'choose' | 'mine' | 'theirs' | 'pause' | 'questions'>('choose');
  const [round, setRound] = useState(1);
  const [focus, setFocus] = useState(0.5);
  const [proj, setProj] = useState<{ from: 'me' | 'foe'; aff: Aff | 'tackle' | 'breath' | 'vita' } | null>(null);
  const [qs, setQs] = useState<{ q: MCQuestion; n: number; right: number; wrong: boolean } | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [drank, setDrank] = useState<string[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [fx, setFx] = useState<{ side: 'me' | 'foe'; kind: 'hit' | 'miss'; aff: Aff | 'tackle' } | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const timer = useRef<number | null>(null);
  const quiet = useRef(false); // the next guide line was already said as part of a longer line
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);
  const custom = (id: string) => (bs.aff?.[id] as Aff[] | undefined);
  const accuracy = (fk: string) => { const a = bs.acc?.[fk]; return a && a.total ? a.right / a.total : null; };
  const totals = (fk: string) => { const l = bs.log.filter((x) => x.fighter === fk); return { w: l.filter((x) => x.won).length, l: l.filter((x) => !x.won).length }; };
  const confFor = (f: (typeof fighters)[number]) => { const t = totals(f.key); return confidenceOf(magicOf(f.k, affOf(f.c, custom(f.c.id))), f.health, t.w, t.l, accuracy(f.key)); };
  const record = (fk: string, npcId: string) => {
    const l = bs.log.filter((x) => x.fighter === fk && x.npc === npcId);
    return { w: l.filter((x) => x.won).length, l: l.filter((x) => !x.won).length };
  };
  const add = (t: string, read = true) => { setLines((ls) => [...ls.slice(-5), t]); if (read) speak(t); };

  const choose = (n: Npc) => {
    if (!mine) return;
    snSound('open');
    const myF = makeFighter(mine.key, mine.name, mine.c, mine.k, mine.c.energy, mine.health, confFor(mine), custom(mine.c.id));
    const foeF = npcFighter(n);
    const pre = preBattle(myF, foeF, record(mine.key, n.id));
    myF.confidence = pre.conf;
    const foePre = preBattle(foeF, myF, undefined);
    foeF.confidence = foePre.conf;
    setFoeNpc(n); setMe(myF); setFoe(foeF); setDrank([]);
    const intro = [`${myF.name} faces ${foeF.name}!`, ...pre.lines, `${myF.name} feels ${confWord(myF.confidence)} and ${ENERGY_FX[myF.energy].line}`];
    const skip = !Object.keys(BATTLE_POTIONS).some((p) => potions.includes(p));
    setLines(intro); speak(`${intro.join(' ')} ${skip ? `Your turn! Tap one move for ${myF.name}.` : 'You can tap a potion to drink it. Then tap Start the battle.'}`); quiet.current = true;
    // No battle potions to drink: skip the potion step and go straight to the fight.
    if (!Object.keys(BATTLE_POTIONS).some((p) => potions.includes(p))) { startWith(myF, foeF); return; }
    setPhase('prep');
  };
  const drink = (name: string) => {
    if (!me || drank.length >= 2 || !potions.includes(name) || drank.includes(name)) return;
    usePotion(name); snSound('done'); setDrank((d) => [...d, name]);
    const f = { ...me, extra: [...me.extra, name] };
    if (name === 'Pyro' && !f.aff.includes('fire')) f.aff = [...f.aff, 'fire'];
    if (name === 'Cryo' && !f.aff.includes('ice')) f.aff = [...f.aff, 'ice'];
    if (name === 'Aqua' && !f.aff.includes('water')) f.aff = [...f.aff, 'water'];
    if (name === 'Calma') f.confidence = Math.min(100, f.confidence + 25);
    if (name === 'Viv' || name === 'Dorm') f.energy = 'just right';
    setMe(f); add(`${f.name} drank ${name}: ${BATTLE_POTIONS[name]}.`);
  };
  const startWith = (m: Fighter, f: Fighter) => {
    setPhase('fight'); setStage('choose'); setRound(1); setFocus(0.5);
    add(`Round 1! ${speedOf(m) >= speedOf(f) ? `${m.name} is quick and ready.` : `${f.name} looks quick. Stay calm!`}`, false);
  };
  const start = () => { if (me && foe) startWith(me, foe); };
  const end = (iWon: boolean, a: Fighter, b: Fighter) => {
    setWon(iWon); setPhase('done'); setProj(null); snSound(iWon ? 'learned' : 'close');
    const npcs = bs.npcs.some((x) => x.id === foeNpc!.id) ? bs.npcs : [...bs.npcs, foeNpc!];
    setBs({ ...bs, npcs, log: [...bs.log, { npc: foeNpc!.id, fighter: mine!.key, fighterName: mine!.name, won: iWon, at: new Date().toISOString() }] });
    quiet.current = true;
    speak(iWon ? `${b.name} tapped out. ${a.name} wins! High fives all around. ${a.name} will remember this and feel braver next time. Tap Rematch to battle again.` : `${a.name} tapped out. ${b.name} wins this time. It is okay to lose: every battle is practice. ${a.name} might feel a little nervous next time, and that is a normal feeling. Tap Rematch to try again.`);
  };
  const wait = (ms: number, fn: () => void) => { timer.current = window.setTimeout(fn, ms); };
  // The opponent answers the student's action with one of its own.
  const foeAct = (m: Fighter, f: Fighter) => {
    setStage('theirs');
    if (f.confidence < 30 && Math.random() < 0.5) {
      setProj({ from: 'foe', aff: 'breath' });
      wait(1300, () => { const nf = { ...f, confidence: Math.min(100, f.confidence + 15), energy: STEP_TO_RIGHT[f.energy] }; setFoe(nf); setProj(null); add(`${f.name} feels nervous, so it takes a deep breath. Its confidence goes up!`); toPause(m, nf); });
      return;
    }
    const best = [...f.aff].sort((x, y) => (m.aff.some((d) => AFF[x].beats.includes(d)) ? -1 : 0) - (m.aff.some((d) => AFF[y].beats.includes(d)) ? -1 : 0))[0];
    setProj({ from: 'foe', aff: best });
    wait(1300, () => {
      const r = attack(f, m, best, 0.3 + 0.1 * f.smarts);
      const nm = { ...m, health: Math.max(0, m.health - r.dmg), confidence: Math.max(5, m.confidence - (r.hit ? 4 : 0)) };
      const nf = { ...f, confidence: Math.min(100, Math.max(5, f.confidence + (r.hit ? 4 : -4))) };
      setProj(null); setFx({ side: 'me', kind: r.hit ? 'hit' : 'miss', aff: best }); window.setTimeout(() => setFx(null), 1300);
      snSound(r.hit ? 'poof' : 'tap'); setMe(nm); setFoe(nf);
      add(`${r.text}${r.hit ? ` ${m.name} loses ${r.dmg} health.` : ''}`);
      if (nm.health <= 0) { end(false, nm, nf); return; }
      if (nm.confidence < 30) add(`${nm.name}'s tail is tucked. Next round, try Deep breath to feel braver!`, false);
      toPause(nm, nf);
    });
  };
  // A 3 to 5 second pause to watch, then three questions in the regular question view.
  const toPause = (m: Fighter, f: Fighter) => {
    setStage('pause'); const secs = 3 + Math.floor(Math.random() * 3); setCountdown(secs);
    void m;
    let left = secs; const tickDown = () => { left -= 1; setCountdown(left); if (left <= 0) { setStage('questions'); setQs({ q: nextQ(), n: 0, right: 0, wrong: false }); } else wait(1000, tickDown); };
    wait(1000, tickDown); void f;
  };
  const nextQ = (avoid?: string) => drawQuestion(questionSets, avoid) ?? generateAutoQuestion();
  // One try per question (Build Queue 209): a wrong answer locks and moves on, and never counts as right.
  const answered = (gotIt = true) => {
    if (!qs || !me) return;
    const right = qs.right + (gotIt && !qs.wrong ? 1 : 0); const n = qs.n + 1;
    if (n < QUESTIONS_PER_ROUND) { setQs({ q: nextQ(qs.q.id), n, right, wrong: false }); return; }
    // Question accuracy feeds focus and confidence (her rule: "confidence also comes from question accuracy").
    const f = right / QUESTIONS_PER_ROUND;
    const nm = { ...me, confidence: Math.min(100, Math.max(5, me.confidence + right * 5 - (QUESTIONS_PER_ROUND - right) * 3)) };
    const acc = bs.acc?.[me.key] ?? { right: 0, total: 0 };
    setBs({ ...bs, acc: { ...(bs.acc ?? {}), [me.key]: { right: acc.right + right, total: acc.total + QUESTIONS_PER_ROUND } } });
    setQs(null); setFocus(f); setMe(nm); setStage('choose'); setRound((r) => r + 1); snSound(right === QUESTIONS_PER_ROUND ? 'learned' : 'chime');
    add(`${right} of ${QUESTIONS_PER_ROUND} right on the first try! ${right === QUESTIONS_PER_ROUND ? `${nm.name} is fully powered up and feels confident!` : right >= 1 ? `${nm.name} feels good.` : `${nm.name} feels a little unsure, but it keeps trying.`}`, false);
  };
  const act = (aff: Aff | 'tackle' | 'breath' | 'vita') => {
    if (stage !== 'choose' || !me || !foe) return;
    snSound('tap'); setStage('mine'); setProj({ from: 'me', aff });
    wait(1300, () => {
      setProj(null);
      if (aff === 'breath') { const nm = { ...me, confidence: Math.min(100, me.confidence + 15), energy: STEP_TO_RIGHT[me.energy] }; setMe(nm); snSound('chime'); add(`${me.name} takes three deep breaths. Its confidence goes up${me.energy !== 'just right' ? `, and its energy moves toward just right (${nm.energy})` : ''}. Calm creatures aim better!`); wait(900, () => foeAct(nm, foe)); return; }
      if (aff === 'vita') { if (!potions.includes('Vita')) return; usePotion('Vita'); const nm = { ...me, health: Math.min(me.maxHealth, me.health + 20) }; setMe(nm); snSound('done'); add(`${me.name} drank Vita and got 20 health back.`); wait(900, () => foeAct(nm, foe)); return; }
      const r = attack(me, foe, aff, focus);
      const nf = { ...foe, health: Math.max(0, foe.health - r.dmg), confidence: Math.max(5, foe.confidence - (r.hit ? 4 : 0)) };
      const nm = { ...me, confidence: Math.min(100, Math.max(5, me.confidence + (r.hit ? 5 : -5))) };
      setFx({ side: 'foe', kind: r.hit ? 'hit' : 'miss', aff }); window.setTimeout(() => setFx(null), 1300);
      snSound(r.hit ? 'poof' : 'fizzle'); setFoe(nf); setMe(nm);
      add(`${r.text}${r.hit ? ` ${foe.name} loses ${r.dmg} health.` : ''}`);
      if (Math.random() < 0.3 && nm.energy !== 'just right') add(`${nm.name} ${ENERGY_FX[nm.energy].line}`, false);
      if (nf.health <= 0) { end(true, nm, nf); return; }
      wait(1000, () => foeAct(nm, nf));
    });
  };
  const reset = (to: 'pick' | 'foe') => { if (timer.current) window.clearTimeout(timer.current); setPhase(to); setMe(null); setFoe(null); setLines([]); setWon(null); setQs(null); setProj(null); if (to === 'foe') setCards([randomNpc(), randomNpc()]); };

  // One clear next step on every screen (Build Queue 147, her words 2026-10-14: "the screens to navigate in
  // the battles are hard to do. student has said "what do i do? do i click here? what is it telling me to
  // do?""). The guide says it, reads it aloud, and the one thing to tap glows.
  const stepNo = phase === 'pick' ? 1 : phase === 'foe' ? 2 : phase === 'prep' ? 3 : 4;
  const doNow = phase === 'pick' ? (mine && mine.c.chapter === 'mine' ? `Pick 1 or 2 powers for ${mine.name}, then tap Next.` : 'Tap the creature you want to battle with.')
    : phase === 'foe' ? 'Tap ⚔️ Battle under the opponent you want. Or tap 🎲 for a surprise.'
    : phase === 'prep' ? 'You can tap a potion to drink it. Then tap ⚔️ Start the battle.'
    : phase === 'done' ? (won ? 'You won! Tap 🔁 Rematch to battle again.' : 'Good try! Tap 🔁 Rematch to try again.')
    : stage === 'choose' ? `Your turn! Tap one move for ${me?.name ?? 'your creature'}.`
    : stage === 'mine' ? `Just watch. ${me?.name ?? ''} is doing its move.`
    : stage === 'theirs' ? `Just watch. ${foe?.name ?? ''} is moving now.`
    : stage === 'pause' ? `Questions are coming. Right answers power up ${me?.name ?? 'your creature'}.`
    : 'Answer the question.';
  useEffect(() => {
    if (quiet.current) { quiet.current = false; return; }
    if (phase !== 'fight' || stage === 'choose') speak(doNow);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doNow]);
  const MOVE_TIP = (a: Aff) => `Strong vs ${AFF[a].beats.map((b) => AFF[b].label).join(' and ')}`;

  const fighterCard = (f: Fighter, side: 'me' | 'foe') => (
    <div className={`sb-side ${side}${fx?.side === side ? ` ${fx.kind}` : ''}`}>
      <div className="sb-plate">
        <b>{f.name}</b>
        <span className="sb-aff">{f.aff.map((a) => <i key={a} title={AFF[a].label}>{AFF[a].icon}</i>)}</span>
        {METERS(f.magic, f.health, f.confidence)}
        <small className="sb-confword">Feels {confWord(f.confidence)}</small>
        <span className="sb-energy"><img src={ENERGY_FACE[f.energy]} alt="" className="sn-smooth" />Energy: {f.energy}</span>
      </div>
      <div className="sb-stand"><img className="sb-mon" src={art(f.id)} alt={f.species} /><img className="sb-plat" src={`${SN}battle/platform.png`} alt="" />{fx?.side === side && <Fx k={fx.kind === 'hit' ? HIT_FX[fx.aff] : 'miss'} size={fx.kind === 'hit' ? 210 : 150} className="sb-hitfx" />}</div>
    </div>
  );
  const npcCard = (n: Npc) => {
    const c = CREATURES.find((x) => x.id === n.species)!; const r = mine ? record(mine.key, n.id) : { w: 0, l: 0 };
    return (
      <div key={n.id} className="sb-card">
        <img src={art(c.id)} alt="" />
        <b>{n.name}</b>
        <small>{c.name} · {affOf(c).map((a) => AFF[a].icon).join(' ')}</small>
        {METERS(n.magic ?? 50, n.health ?? 60, n.confidence)}
        <small><img src={ENERGY_FACE[n.energy]} alt="" className="sn-smooth" style={{ width: 22, verticalAlign: 'middle' }} /> {n.energy} energy · {confWord(n.confidence)}</small>
        {(r.w > 0 || r.l > 0) && <small>Your record: {r.w} wins, {r.l} losses</small>}
        <button type="button" className="sn-btn sbx-go" onClick={() => choose(n)}>⚔️ Battle</button>
      </div>
    );
  };

  return (
    <div className="sn-room sb">
      {bar({ extra: <span className="sn-chip">{phase === 'pick' ? 'Pick your fighter' : phase === 'foe' ? 'Pick an opponent' : phase === 'prep' ? 'Get ready' : phase === 'fight' ? `Round ${round}`  : 'Battle over'}</span> })}
      <div className="sb-arena">
        <div className="sb-sky" /><div className="sb-ground" />
        <div className="sbx-guide" role="status">
          <ol className="sbx-steps" aria-label={`Step ${stepNo} of 4`}>
            {['Your fighter', 'Opponent', 'Get ready', 'Battle'].map((t, i) => <li key={t} className={i + 1 === stepNo ? 'on' : i + 1 < stepNo ? 'done' : ''}>{i + 1 < stepNo ? '✓' : i + 1}<span>{t}</span></li>)}
          </ol>
          <p className="sbx-now"><span aria-hidden>👉</span>{doNow}</p>
          <button type="button" className="sn-ib small light" onClick={() => say(doNow)} aria-label="Listen">🔊</button>
          <button type="button" className="sn-ib small light" onClick={() => setLogOpen(true)} aria-label="Battle log" title="Battle log">📖</button>
          <button type="button" className="sn-ib small light" onClick={() => setReadOn(!readOn)} aria-label={readOn ? 'Read aloud is on' : 'Read aloud is off'} title="Read aloud">{readOn ? '🔔' : '🔕'}</button>
        </div>

        {phase === 'pick' && (
          <div className="sb-panel">
            <h2>Who will battle?</h2>
            <p className="sn-small">Its skills, speed and energy decide how it battles.</p>
            {fighters.length === 0 ? <p>Find creatures on the Globe first. They live in your Habitat, and then they can battle.</p> : (
              <div className="sb-grid">{fighters.map((f) => { return (
                <button key={f.key} type="button" className={`sb-pick${mine?.key === f.key ? ' on' : ''}`} onClick={() => { snSound('tap'); setMine(f); if (f.c.chapter !== 'mine') { setCards([randomNpc(), randomNpc()]); setPhase('foe'); } }}>
                  <img src={art(f.c.id)} alt="" /><b>{f.name}</b><small>{f.c.name} · {affOf(f.c, custom(f.c.id)).map((a) => AFF[a].icon).join(' ')}</small>
                  {METERS(magicOf(f.k, affOf(f.c, custom(f.c.id))), f.health, confFor(f))}
                </button>
              ); })}</div>
            )}
            {mine && mine.c.chapter === 'mine' && (
              <div className="sb-affpick"><b>Powers for {mine.c.name} (pick 1 or 2):</b>{(Object.keys(AFF) as Aff[]).map((a) => { const cur = affOf(mine.c, custom(mine.c.id)); const on = cur.includes(a); return (
                <button key={a} type="button" className={`sn-chip-btn${on ? ' on' : ''}`} onClick={() => { const next = on ? cur.filter((x) => x !== a) : [...cur, a].slice(-2); setBs({ ...bs, aff: { ...(bs.aff ?? {}), [mine.c.id]: next.length ? next : cur } }); }}>{AFF[a].icon} {AFF[a].label}</button>
              ); })}</div>
            )}
            {mine && mine.c.chapter === 'mine' && <button type="button" className="sn-btn sbx-go" onClick={() => { snSound('page'); setPhase('foe'); }}>Next: pick an opponent</button>}
          </div>
        )}

        {phase === 'foe' && mine && (
          <div className="sb-panel">
            <h2>Who will {mine.name} battle?</h2>
            <div className="sb-cards">
              {cards.map(npcCard)}
              <div className="sb-card dice">
                <span className="sb-dice">🎲</span><b>Random opponent</b><small>Roll the dice for a surprise creature with surprise skills!</small>
                <button type="button" className="sn-btn sbx-go" onClick={() => { snSound('poof'); choose(randomNpc()); }}>🎲 Roll and battle</button>
              </div>
            </div>
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => { snSound('page'); setCards([randomNpc(), randomNpc()]); }}>🔄 Show two new ones</button>
              <button type="button" className="sn-btn2" onClick={() => setPhase('pick')}>Back</button>
            </div>
          </div>
        )}

        {(phase === 'prep' || phase === 'fight' || phase === 'done') && me && foe && (
          <>
            {fighterCard(me, 'me')}
            {fighterCard(foe, 'foe')}
            <div className="sb-center">
              {phase === 'prep' && (
                <div className="sb-moves">
                  <b>Battle potions (up to 2, they last this battle only):</b>
                  <div className="sb-potions">{Object.keys(BATTLE_POTIONS).map((p) => { const n = potions.filter((x) => x === p).length; return (
                    <button key={p} type="button" className="sb-pot" disabled={!n || drank.includes(p) || drank.length >= 2} onClick={() => drink(p)} title={BATTLE_POTIONS[p]}>
                      <img src={POTION_ICON[p]} alt="" /><small>{p} ({n})</small>
                    </button>
                  ); })}</div>
                  <button type="button" className="sn-btn sbx-go" onClick={start}>⚔️ Start the battle</button>
                </div>
              )}
              {phase === 'fight' && (
                <div className="sb-moves">
                  {stage === 'choose' && <>
                    <b className="sb-turn">Round {round}: your turn</b>
                    <div className="sb-movegrid">
                      {me.aff.map((a) => <button key={a} type="button" className={`sb-move sbx-go ${a}`} onClick={() => act(a)}>{AFF[a].icon} {AFF[a].move}<small>{MOVE_TIP(a)}</small></button>)}
                      <button type="button" className="sb-move sbx-go" onClick={() => act('tackle')}>💥 Tackle<small>A simple bump</small></button>
                      <button type="button" className="sb-move sbx-go calm" onClick={() => act('breath')}>🌬️ Deep breath<small>Calmer and braver</small></button>
                      {potions.includes('Vita') && <button type="button" className="sb-move sbx-go" onClick={() => act('vita')}>❤️ Drink Vita<small>Gets 20 health back</small></button>}
                    </div>
                    <small>{focus >= 0.99 ? '⚡ Fully powered up from last round!' : focus >= 0.6 ? 'Powered up from last round.' : 'Answer questions well to power up the next round.'}</small>
                  </>}
                  {(stage === 'mine' || stage === 'theirs') && <b className="sb-turn">👀 {stage === 'mine' ? `${me.name} is moving. Watch!` : `${foe.name} is moving. Watch!`}</b>}
                  {stage === 'pause' && <><b className="sb-turn">Get ready: {QUESTIONS_PER_ROUND} questions!</b><span className="sb-count">{countdown}</span><small>Right answers power up {me.name} and build its confidence.</small></>}
                  {stage === 'questions' && <b className="sb-turn">Question {(qs?.n ?? 0) + 1} of {QUESTIONS_PER_ROUND}</b>}
                </div>
              )}
              {phase === 'done' && (
                <div className="sb-moves">
                  <b className="sb-turn">{won ? `🏆 ${me.name} wins!` : `🤝 ${foe.name} wins this time`}</b>
                  <small>{won ? 'High fives all around! Winning makes it braver next time.' : 'It is okay to lose. Every battle is practice, and feeling nervous next time is normal.'}</small>
                  <div className="sn-row center">
                    <button type="button" className="sn-btn sbx-go" onClick={() => { const n = foeNpc!; reset('foe'); window.setTimeout(() => choose(n), 0); }}>🔁 Rematch</button>
                    <button type="button" className="sn-btn2" onClick={() => reset('foe')}>New opponent</button>
                    <button type="button" className="sn-btn2" onClick={() => reset('pick')}>New fighter</button>
                  </div>
                </div>
              )}
            </div>
            {proj && <span className={`sb-proj from-${proj.from} ${proj.aff}`} aria-hidden="true">{proj.aff === 'breath' ? <Fx k="breath" size={150} loop /> : proj.aff === 'vita' ? <Fx k="heal" size={150} loop /> : proj.aff === 'nature' ? <i className="sb-vine" style={{ backgroundImage: `url(${SN}plants/pack/vinewhip.png)` }} /> : <Fx k={ORB_FX[proj.aff]} size={proj.aff === 'mind' || proj.aff === 'shadow' || proj.aff === 'storm' ? 110 : 120} loop />}</span>}
            <div className="sb-log" role="status">
              {lines.slice(-3).map((l, i) => <p key={i}>{l}</p>)}
              <button type="button" className="sn-listen" onClick={() => say(lines.slice(-3).join(' '))} aria-label="Listen"><Icon d={LISTEN} /></button>
            </div>
          </>
        )}
      </div>

      {qs && me && phase === 'fight' && stage === 'questions' && (
        <QuestionScreen key={`${qs.q.id}-${qs.n}`} whoLabel={`Power up ${me.name}: question ${qs.n + 1} of ${QUESTIONS_PER_ROUND}`} whoIcon="⚡"
          prompt={qs.q.prompt} choices={qs.q.choices} correctIndex={qs.q.correctIndex} imageUrl={qs.q.imageUrl} imageAlt={qs.q.imageAlt} done={qs.n} total={QUESTIONS_PER_ROUND}
          onWrongAnswer={() => setQs((x) => (x ? { ...x, wrong: true } : x))}
          onCorrectAnswer={() => answered(true)} onSkip={() => answered(false)}
          onExit={() => { reset('foe'); }} ttsSettings={ttsSettings} />
      )}
      {logOpen && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Battle log" onClick={() => setLogOpen(false)}>
          <PopCard className="sn-modal-card paper wide" title="Battle log" onClose={() => setLogOpen(false)}>
            <h2>📖 Battle Log</h2>
            {bs.npcs.length === 0 ? <p>No battles yet. Every creature you battle is saved here, so you can battle it again.</p> : (
              <div className="sb-logtable">
                {bs.npcs.map((n) => { const games = bs.log.filter((x) => x.npc === n.id); const w = games.filter((g) => g.won).length; const c = CREATURES.find((x) => x.id === n.species); return (
                  <div key={n.id} className="sb-logrow">
                    <img src={art(n.species)} alt="" />
                    <div><b>{n.name}</b><small>{c?.name} · {games.length} {games.length === 1 ? 'battle' : 'battles'} · {w} won, {games.length - w} lost</small>
                      <small>{games.slice(-4).map((g) => `${g.won ? '🏆' : '🤝'} ${g.fighterName}`).join('  ')}</small></div>
                    <button type="button" className="sn-btn2 small" disabled={!mine} onClick={() => { setLogOpen(false); reset('foe'); window.setTimeout(() => choose(n), 0); }} title={mine ? 'Battle again' : 'Pick your fighter first'}>⚔️ Battle again</button>
                  </div>
                ); })}
              </div>
            )}
            {!mine && bs.npcs.length > 0 && <p className="sn-small">Pick your fighter first, then you can battle any of them again.</p>}
            <button type="button" className="sn-btn" onClick={() => setLogOpen(false)}>Close</button>
          </PopCard>
        </div>
      )}
    </div>
  );
}
