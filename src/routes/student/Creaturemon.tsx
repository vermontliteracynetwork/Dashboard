import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';
import { MenuItems } from '../../lib/mainMenu';
import GameStartCard from '../../components/GameStartCard';
import { useStore } from '../../store/store';
import World, { SKY_OF, type Target, type Wild, type WorldCtl } from '../../games/creaturemon/World';
import Battle from '../../games/creaturemon/Battle';
import { CreatureCard, Sprite } from '../../games/creaturemon/Card';
import {
  FORMS, HABITAT_NAME, IMG, LINES, STARTERS, TYPE_COLOR, battleXp, catchChance, displayName, form, freshSave, giveXp, line, nextForm,
  uid, xpToNext, type Form, type Habitat, type Mon, type Save,
} from '../../games/creaturemon/data';
import '../../games/creaturemon/creaturemon.css';

// Creaturemon (Build Queue 700 to 702, 2026-11-19, her words in the dev plan): a creature catching game in the style
// of the classic open world creature games and Smash style creature battles (her biggest influence), in 3D pixel art
// seen from behind the player. Explore six habitats, throw orbs to catch wild creatures, battle them, train them, and
// watch them evolve (her top priority for the students: evolutions and battles). 61 creatures in 20 evolution lines,
// each named from its body shape (701), each evolution with its own card (702). Potions from harvested ingredients
// are the next part (700b in the dev plan).

type Gfx = 'low' | 'medium' | 'high';
const PIXEL: Record<Gfx, number> = { low: 0.3, medium: 0.4, high: 0.55 };
interface Save2 extends Save { gfx?: Gfx }
interface Evo { uid: string; from: string; to: string }

export default function Creaturemon() {
  const back = useBack();
  const { ask, element, pay, student, settingsPanel, learn } = useAsk('Creaturemon', '🐉', 'creaturemon', { startCard: false, perLabel: 'Questions for each orb or training' });
  const studentId = student?.id ?? '';
  const owner = studentId ? `creaturemon:${studentId}` : '';
  const localKey = `creaturemon:${studentId}`;
  const serverSave = useStore((s) => s.styleLooks.find((r) => r.ownerId === owner)?.look as Save2 | undefined);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const calm = !!student?.worldReduceMotion;

  const [S, setS] = useState<Save2>(() => {
    try { const v = JSON.parse(localStorage.getItem(localKey) ?? 'null') as Save2 | null; if (v && Array.isArray(v.mons)) return { ...freshSave(), ...v }; } catch { /* fresh */ }
    return freshSave();
  });
  const sRef = useRef(S); sRef.current = S;
  const serverT = useRef(0);
  const put = useCallback((p: Partial<Save2>) => {
    const n = { ...sRef.current, ...p, at: new Date().toISOString() }; sRef.current = n; setS(n);
    try { localStorage.setItem(localKey, JSON.stringify(n)); } catch { /* fine */ }
    window.clearTimeout(serverT.current);
    serverT.current = window.setTimeout(() => { if (owner) mergeStyleRow(owner, sRef.current as unknown as Record<string, unknown>); }, 4000);
  }, [localKey, owner, mergeStyleRow]);
  const loadedServer = useRef(false);
  useEffect(() => {
    if (loadedServer.current || !serverSave?.at) return;
    loadedServer.current = true;
    if (!sRef.current.at || serverSave.at > sRef.current.at) { const n = { ...freshSave(), ...serverSave }; sRef.current = n; setS(n); }
  });

  const [started, setStarted] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [habitat, setHabitat] = useState<Habitat>('meadow');
  const [battle, setBattle] = useState<{ me: Mon; foe: { formId: string; level: number }; wildId?: string } | null>(null);
  const [result, setResult] = useState<{ won: boolean; xp: number; mon: Mon; foe: { formId: string; level: number }; wildId?: string; orbs: number } | null>(null);
  const [catching, setCatching] = useState<{ id?: string; formId: string; level: number; ok: boolean; shakes: number } | null>(null);
  const [reveal, setReveal] = useState<{ formId: string; isNew: boolean; title: string } | null>(null);
  const [evoQ, setEvoQ] = useState<Evo[]>([]);
  const [panel, setPanel] = useState<'' | 'team' | 'cards' | 'train' | 'help' | 'gear' | 'pick' | 'practice'>('');
  const [cardOpen, setCardOpen] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [trainRun, setTrainRun] = useState<{ uid: string; left: number; hits: number; spot: number } | null>(null);
  const ctl = useRef<WorldCtl>({ throwOrb: () => {}, catchResult: () => {}, removeWild: () => {}, input: { mx: 0, mz: 0, yawV: 0, run: false } });
  const wilds = useRef<Wild[]>([]);
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2600); };

  const team = useMemo(() => S.team.map((u) => S.mons.find((m) => m.uid === u)).filter(Boolean) as Mon[], [S]);
  const lead = team[0] ?? null;
  const avgLevel = team.length ? Math.round(team.reduce((a, m) => a + m.level, 0) / team.length) : 3;
  const gfx: Gfx = S.gfx ?? 'medium';

  // seen: any creature you get close to
  useEffect(() => { if (target && !sRef.current.seen.includes(target.formId)) put({ seen: [...sRef.current.seen, target.formId] }); }, [target, put]);

  const addMon = (formId: string, level: number): Mon => {
    const s = sRef.current; const m: Mon = { uid: uid(), formId, level, xp: 0, caughtAt: new Date().toISOString() };
    const caught = s.caught.includes(formId) ? s.caught : [...s.caught, formId];
    const seen = s.seen.includes(formId) ? s.seen : [...s.seen, formId];
    put({ mons: [...s.mons, m], team: s.team.length < 6 ? [...s.team, m.uid] : s.team, caught, seen });
    if (studentId && caught.length > s.caught.length) recordBestGame(studentId, 'creaturemon', caught.length, `${caught.length} of ${FORMS.length} cards`);
    return m;
  };
  const updateMon = (m: Mon) => { const s = sRef.current; put({ mons: s.mons.map((x) => (x.uid === m.uid ? m : x)) }); };
  // XP for a creature; queues its evolution when it reaches the level.
  const train = (m: Mon, xp: number) => {
    const r = giveXp(m, xp); updateMon(r.mon);
    if (r.evolveTo) setEvoQ((q) => [...q, { uid: m.uid, from: m.formId, to: r.evolveTo!.id }]);
    return r;
  };

  // ---- catching ----
  const throwOrb = () => {
    if (!target) return;
    if (S.orbs <= 0) { say('Out of orbs! Tap Make orbs.'); sfx.click(); return; }
    put({ orbs: S.orbs - 1 }); sfx.whoosh(); ctl.current.throwOrb();
  };
  useEffect(() => {
    const land = (e: Event) => {
      const id = (e as CustomEvent<string>).detail; const w = wilds.current.find((q) => q.id === id); if (!w) return;
      const ok = Math.random() < catchChance(form(w.formId), w.level, false, !!target?.sneaky && target.id === id);
      w.gone = true; w.t = 0; // it goes into the orb
      setCatching({ id, formId: w.formId, level: w.level, ok, shakes: ok ? 3 : 1 + Math.floor(Math.random() * 2) });
    };
    window.addEventListener('cm-orb-land', land); return () => window.removeEventListener('cm-orb-land', land);
  }, [target]);
  useEffect(() => {
    if (!catching) return;
    const t = window.setTimeout(() => {
      const c = catching; setCatching(null);
      if (c.ok) {
        const isNew = !sRef.current.caught.includes(c.formId); addMon(c.formId, c.level); sfx.chime();
        const nm = form(c.formId).name; setReveal({ formId: c.formId, isNew, title: `You caught ${nm}!` });
        speak(`You caught ${nm}!${isNew ? ' A new card for your collection!' : ''}`, student?.ttsSettings);
      } else {
        const w = wilds.current.find((q) => q.id === c.id); if (w) { w.gone = false; w.flee = 1.5; }
        sfx.boing(); say(`${form(c.formId).name} popped out! Try again, or battle it first.`);
      }
    }, 700 + catching.shakes * 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catching]);

  // ---- battles ----
  const startBattle = (me: Mon) => {
    if (!target) return; setPanel('');
    setBattle({ me, foe: { formId: target.formId, level: target.level }, wildId: target.id });
  };
  const practice = (me: Mon) => {
    setPanel('');
    const l = LINES[Math.floor(Math.random() * LINES.length)]; const lv = Math.max(1, me.level + Math.floor(Math.random() * 3) - 1);
    let f = l.forms[0]; for (let i = 1; i < l.forms.length; i++) if ((l.forms[i - 1].evolvesAt ?? 99) <= lv) f = l.forms[i];
    setBattle({ me, foe: { formId: f.id, level: lv } });
  };
  const endBattle = (won: boolean) => {
    const b = battle; if (!b) return; setBattle(null);
    const fresh = sRef.current.mons.find((m) => m.uid === b.me.uid) ?? b.me;
    const xp = battleXp(b.foe.level, won); const r = train(fresh, xp);
    const orbs = won ? 2 : 0;
    put({ wins: sRef.current.wins + (won ? 1 : 0), orbs: sRef.current.orbs + orbs });
    setResult({ won, xp, mon: r.mon, foe: b.foe, wildId: b.wildId, orbs });
    if (won) { sfx.chime(); speak(`You won! ${displayName(fresh)} got ${xp} XP.`, student?.ttsSettings); } else speak(`${displayName(fresh)} is tired and needs a rest. Train and try again!`, student?.ttsSettings);
  };
  const catchTired = () => {
    const r = result; if (!r) return; setResult(null);
    const w = wilds.current.find((q) => q.id === r.wildId); if (w) { w.gone = true; w.t = 0; }
    put({ orbs: Math.max(0, sRef.current.orbs - 1) });
    setCatching({ id: r.wildId, formId: r.foe.formId, level: r.foe.level, ok: Math.random() < catchChance(form(r.foe.formId), r.foe.level, true, false), shakes: 3 });
  };

  // ---- evolution ----
  const evo = evoQ[0];
  const [evoStep, setEvoStep] = useState<'glow' | 'done'>('glow');
  useEffect(() => {
    if (!evo) return; setEvoStep('glow');
    speak(`What? ${form(evo.from).name} is evolving!`, student?.ttsSettings);
    const t = window.setTimeout(() => {
      setEvoStep('done'); sfx.chime();
      const s = sRef.current; const m = s.mons.find((x) => x.uid === evo.uid);
      if (m) {
        const caught = s.caught.includes(evo.to) ? s.caught : [...s.caught, evo.to]; const seen = s.seen.includes(evo.to) ? s.seen : [...s.seen, evo.to];
        put({ mons: s.mons.map((x) => (x.uid === m.uid ? { ...x, formId: evo.to } : x)), caught, seen });
        if (studentId && caught.length > s.caught.length) recordBestGame(studentId, 'creaturemon', caught.length, `${caught.length} of ${FORMS.length} cards`);
      }
      speak(`${form(evo.from).name} evolved into ${form(evo.to).name}! A new card!`, student?.ttsSettings);
    }, calm ? 2600 : 4200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evo?.uid, evo?.to]);

  // ---- training and orbs ----
  const startTraining = (m: Mon) => {
    setPanel('');
    ask(`Creaturemon: answer to train ${displayName(m)}`, () => { setTrainRun({ uid: m.uid, left: 12, hits: 0, spot: Math.floor(Math.random() * 9) }); sfx.pop(); });
  };
  const trainTap = (hit: boolean) => {
    const t = trainRun; if (!t) return;
    if (hit) sfx.pop(); else sfx.click();
    const n = { ...t, left: t.left - 1, hits: t.hits + (hit ? 1 : 0), spot: Math.floor(Math.random() * 9) };
    if (n.left > 0) { setTrainRun(n); return; }
    setTrainRun(null);
    const m = sRef.current.mons.find((x) => x.uid === t.uid); if (!m) return;
    const xp = Math.round(xpToNext(m.level) * (0.35 + n.hits * 0.09));
    const r = train(m, xp); say(`${displayName(m)} got ${xp} XP${r.levels ? ` and grew ${r.levels} level${r.levels > 1 ? 's' : ''}` : ''}!`);
  };
  const makeOrbs = () => ask('Creaturemon: answer to make 3 orbs', () => { put({ orbs: sRef.current.orbs + 3 }); sfx.coin(); say('3 new orbs!'); });

  const pickStarter = (formId: string) => {
    const m = addMon(formId, 5); put({ starterPicked: true, team: [m.uid] });
    setReveal({ formId, isNew: true, title: `${form(formId).name} is your partner!` });
    speak(`${form(formId).name} is your partner! Explore, catch, battle and evolve!`, student?.ttsSettings);
  };

  const menu = useMemo(() => [
    { id: 'cm-help', icon: '❓', label: 'How to play', bg: '#3a4fb0', order: 5, onSelect: () => setPanel('help') },
    { id: 'cm-cards', icon: '🃏', label: 'My cards', bg: '#6b4fa0', order: 6, onSelect: () => setPanel('cards') },
    { id: 'cm-team', icon: '🐉', label: 'My team', bg: '#2aa198', order: 7, onSelect: () => setPanel('team') },
  ], []);
  const howTo = 'Explore the land with the move pad (or the W A S D keys). Drag the screen to turn. Walk up to a wild creature: tap Throw orb to catch it, or Battle to battle it first. A creature tired out from a battle is easy to catch. Sneak up behind a creature for a better chance. In battles, every hit adds damage. The more damage, the farther a hit knocks a creature. Knock the other creature off the island to win its stars. Battles and training give XP. At the right level your creature evolves, and every evolution is a new card!';

  if (!student) return null;
  const leave = () => { pay(); back.go(); };
  const tf = target ? form(target.formId) : null;
  const caughtSet = new Set(S.caught); const seenSet = new Set(S.seen);
  const pixel = PIXEL[gfx];

  return (
    <div className="cm">
      <MenuItems items={menu} />
      <header className="rc-head cm-head">
        <LeaveButton onLeave={leave} note="Your creatures and cards are saved, and your right answers are paid." />
        <strong className="cm-title">Creaturemon</strong>
        <span className="rc-pill">{HABITAT_NAME[habitat]}</span>
        <span className="rc-pill cm-orbs"><i className="cm-orb-i" aria-hidden />{S.orbs} orbs</span>
        <button type="button" className="btn" onClick={makeOrbs}>Make orbs</button>
        <button type="button" className="btn" onClick={() => setPanel('team')}>Team</button>
        <button type="button" className="btn" onClick={() => setPanel('cards')}>Cards {S.caught.length}/{FORMS.length}</button>
        <button type="button" className="btn" onClick={() => setPanel('train')} disabled={!team.length}>Train</button>
        <button type="button" className="btn" onClick={() => setPanel('practice')} disabled={!team.length} title="Battle a creature at your level">Practice battle</button>
        <span className={`rc-pill${learn ? ' rc-learn' : ''}`}>{learn ? 'Learn mode' : 'Play mode'}</span>
        <SfxToggle />
        <button type="button" className="btn game-settings-btn" onClick={() => setPanel('gear')} aria-label="Settings">⚙️</button>
        <MyBest game="creaturemon" unit="cards" />
      </header>
      <div className="cm-stage">
        {started && (
          <div className={battle ? 'cm-hide' : 'cm-fill'}>
            <World ctl={ctl} lead={lead?.formId ?? null} wilds={wilds} avgLevel={avgLevel} onTarget={setTarget} onHabitat={setHabitat}
              paused={!!battle || !!panel || !!evo} pixel={pixel} calm={calm} sky={SKY_OF[habitat]} />
          </div>
        )}
        {started && !battle && (
          <>
            <MovePad ctl={ctl} />
            <button type="button" className="cm-run"
              onPointerDown={(e) => { e.preventDefault(); ctl.current.input.run = true; }} onPointerUp={() => { ctl.current.input.run = false; }}
              onPointerCancel={() => { ctl.current.input.run = false; }} onContextMenu={(e) => e.preventDefault()}>Run<small>hold</small></button>
            {target && tf && !catching && (
              <div className="cm-target" style={{ borderColor: TYPE_COLOR[line(tf.id).type] }}>
                <Sprite f={tf} px={44} anim="idle" />
                <div className="cm-target-txt">
                  <b>{seenSet.has(tf.id) || caughtSet.has(tf.id) ? tf.name : 'A wild creature'}</b>
                  <small>Lv {target.level} · {line(tf.id).type}{caughtSet.has(tf.id) ? ' · card caught' : ' · new card!'}</small>
                  {target.sneaky && <small className="cm-sneak">It has not seen you. Sneaky throw!</small>}
                </div>
                <button type="button" className="cm-big orb" onClick={throwOrb} disabled={target.dist > 10}>Throw orb</button>
                <button type="button" className="cm-big fight" onClick={() => (team.length > 1 ? setPanel('pick') : lead && startBattle(lead))} disabled={!lead}>Battle</button>
              </div>
            )}
            {!target && team.length > 0 && <p className="cm-hint">Walk up to a wild creature to catch it or battle it.</p>}
          </>
        )}
        {battle && (
          <Battle me={{ formId: battle.me.formId, level: battle.me.level, name: displayName(battle.me) }} foe={battle.foe} wild={!!battle.wildId}
            onEnd={endBattle} calm={calm} pixel={pixel} sky={battle.wildId ? 'demo06' : 'demo02'} />
        )}
        {toast && <div className="cm-toast" role="status">{toast}</div>}
      </div>

      {catching && (
        <div className="cm-over cm-catch" aria-live="polite">
          <div className={`cm-orb-big shake${catching.shakes}${catching.ok ? ' ok' : ''}`} />
          <p>The orb is wobbling...</p>
        </div>
      )}

      {reveal && (
        <div className="cm-over" onClick={() => setReveal(null)}>
          <div className="cm-reveal" onClick={(e) => e.stopPropagation()}>
            <h2>{reveal.title}</h2>
            {reveal.isNew && <span className="cm-new">New card!</span>}
            <div className="cm-pack"><img src={`${IMG}cards/booster.png`} alt="" className="cm-pack-img" /><div className="cm-pack-card"><CreatureCard f={form(reveal.formId)} scale={1.25} /></div></div>
            <div className="cm-row">
              <button type="button" className="btn" onClick={() => speak(`${form(reveal.formId).name}. ${form(reveal.formId).desc}`, student.ttsSettings)} aria-label="Listen">🔊</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setReveal(null)}>Keep exploring</button>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div className="cm-over">
          <div className="pf-panel cm-result">
            <h2>{result.won ? 'You won!' : 'Nice try!'}</h2>
            <Sprite f={form(result.mon.formId)} px={80} anim={result.won ? 'move' : 'idle'} />
            <p>{displayName(result.mon)} got <b>{result.xp} XP</b>{result.orbs ? <> and you found <b>{result.orbs} orbs</b></> : null}.</p>
            <XpBar m={result.mon} />
            {!result.won && <p>{displayName(result.mon)} is tired and needs a rest. Train it, then try again.</p>}
            <div className="cm-row">
              {result.won && result.wildId && <button type="button" className="cm-big orb" onClick={catchTired} disabled={S.orbs <= 0}>Throw orb (it is tired!)</button>}
              <button type="button" className="btn btn-lg" onClick={() => setResult(null)}>{result.won && result.wildId ? 'Let it go' : 'OK'}</button>
            </div>
          </div>
        </div>
      )}

      {evo && (
        <div className={`cm-over cm-evo ${evoStep}`} onClick={() => { if (evoStep === 'done') setEvoQ((q) => q.slice(1)); }}>
          <h2>{evoStep === 'glow' ? `What? ${form(evo.from).name} is evolving!` : `${form(evo.from).name} evolved into ${form(evo.to).name}!`}</h2>
          <div className="cm-evo-stage">
            {evoStep === 'glow' ? (
              <>
                <Sprite f={form(evo.from)} px={120} className="cm-evo-a" />
                <Sprite f={form(evo.to)} px={120} className="cm-evo-b" />
              </>
            ) : <CreatureCard f={form(evo.to)} scale={1.3} />}
          </div>
          {evoStep === 'done' && <button type="button" className="btn btn-primary btn-lg" onClick={() => setEvoQ((q) => q.slice(1))}>Awesome!</button>}
        </div>
      )}

      {trainRun && (
        <div className="cm-over">
          <div className="pf-panel cm-train">
            <h2>Training: tap the berry! <small>{trainRun.left} left</small></h2>
            <div className="cm-train-grid">
              {Array.from({ length: 9 }, (_, i) => (
                <button key={`${trainRun.left}-${i}`} type="button" className={`cm-train-cell${i === trainRun.spot ? ' hot' : ''}`} onClick={() => trainTap(i === trainRun.spot)} aria-label={i === trainRun.spot ? 'Berry' : 'Empty grass'}>
                  {i === trainRun.spot && <img src={`${IMG}cards/apple.png`} alt="" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {panel === 'team' && (
        <Panel title="My team" onClose={() => setPanel('')} wide>
          <p className="cm-note">Your first creature leads and follows you. Up to 6 on your team; the rest wait in the box.</p>
          <div className="cm-team">
            {[...team, ...S.mons.filter((m) => !S.team.includes(m.uid))].map((m) => {
              const f = form(m.formId); const inTeam = S.team.includes(m.uid); const nx = nextForm(m.formId);
              return (
                <div key={m.uid} className={`cm-mon${inTeam ? '' : ' boxed'}`} style={{ borderColor: TYPE_COLOR[line(f.id).type] }}>
                  <Sprite f={f} px={56} />
                  <div className="cm-mon-txt">
                    <b>{displayName(m)}</b><small>Lv {m.level} · {line(f.id).type}{S.team[0] === m.uid ? ' · Leader' : ''}</small>
                    <XpBar m={m} />
                    <small>{nx ? `Evolves into ? ? ? at Lv ${f.evolvesAt}` : 'Final form'}</small>
                  </div>
                  <div className="cm-mon-btns">
                    {inTeam && S.team[0] !== m.uid && <button type="button" className="btn" onClick={() => put({ team: [m.uid, ...S.team.filter((u) => u !== m.uid)] })}>Lead</button>}
                    {inTeam && S.team.length > 1 && <button type="button" className="btn" onClick={() => put({ team: S.team.filter((u) => u !== m.uid) })}>To box</button>}
                    {!inTeam && S.team.length < 6 && <button type="button" className="btn" onClick={() => put({ team: [...S.team, m.uid] })}>To team</button>}
                    <button type="button" className="btn" onClick={() => setCardOpen(m.formId)}>Card</button>
                  </div>
                </div>
              );
            })}
            {!S.mons.length && <p>No creatures yet.</p>}
          </div>
        </Panel>
      )}

      {(panel === 'train' || panel === 'pick' || panel === 'practice') && (
        <Panel title={panel === 'train' ? 'Who will train?' : panel === 'pick' ? 'Who will battle?' : 'Practice battle: who will battle?'} onClose={() => setPanel('')}>
          <p className="cm-note">{panel === 'train' ? (learn ? 'Answer, then tap the berries for XP.' : 'Tap the berries for XP.') : 'Pick your fighter.'}</p>
          <div className="cm-team">
            {team.map((m) => (
              <button key={m.uid} type="button" className="cm-mon pick" style={{ borderColor: TYPE_COLOR[line(m.formId).type] }}
                onClick={() => (panel === 'train' ? startTraining(m) : panel === 'pick' ? startBattle(m) : practice(m))}>
                <Sprite f={form(m.formId)} px={56} />
                <div className="cm-mon-txt"><b>{displayName(m)}</b><small>Lv {m.level} · {line(m.formId).type}</small><XpBar m={m} /></div>
              </button>
            ))}
          </div>
        </Panel>
      )}

      {panel === 'cards' && (
        <Panel title={`My cards: ${S.caught.length} of ${FORMS.length}`} onClose={() => setPanel('')} wide>
          <p className="cm-note">Every evolution has its own card. Catch a creature or evolve one to fill its card.</p>
          <div className="cm-lines">
            {LINES.map((l) => (
              <div key={l.id} className="cm-line">
                {l.forms.map((f, i) => (
                  <div key={f.id} className="cm-line-step">
                    {i > 0 && <span className="cm-arrow" aria-label={`evolves at level ${l.forms[i - 1].evolvesAt}`}>Lv {l.forms[i - 1].evolvesAt} ▶</span>}
                    <CreatureCard f={f} scale={0.62} state={caughtSet.has(f.id) ? 'caught' : seenSet.has(f.id) ? 'seen' : 'unknown'} onClick={() => caughtSet.has(f.id) && setCardOpen(f.id)} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {cardOpen && <CardView f={form(cardOpen)} onClose={() => setCardOpen(null)} tts={student.ttsSettings} level={S.mons.filter((m) => m.formId === cardOpen).reduce((a, m) => Math.max(a, m.level), 1)} />}

      {panel === 'help' && (
        <Panel title="How to play" onClose={() => setPanel('')}>
          <p>{howTo} <button type="button" className="btn" onClick={() => speak(howTo, student.ttsSettings)} aria-label="Listen">🔊</button></p>
          <p className="cm-note">Types: {Object.keys(TYPE_COLOR).join(', ')}. A creature's special move is extra strong against some types: Fire beats Leaf and Frost, Water beats Fire and Stone, Leaf beats Water and Stone, and Light and Shadow beat each other.</p>
        </Panel>
      )}

      {panel === 'gear' && (
        <Panel title="Settings" onClose={() => setPanel('')}>
          <GfxMeter value={gfx} onChange={(g) => put({ gfx: g })} />
          {settingsPanel}
        </Panel>
      )}

      {started && !S.starterPicked && !reveal && (
        <div className="cm-over">
          <div className="pf-panel cm-starters">
            <h2>Pick your partner <button type="button" className="btn" onClick={() => speak('Pick your partner: Kindlit, a fire puff. Cubbloop, a water jelly. Or Sprotato, a leaf tater.', student.ttsSettings)} aria-label="Listen">🔊</button></h2>
            <div className="cm-row">{STARTERS.map((id) => <CreatureCard key={id} f={form(id)} scale={0.9} onClick={() => pickStarter(id)} />)}</div>
          </div>
        </div>
      )}

      {!started && (
        <GameStartCard title="Creaturemon" intro={howTo} ttsSettings={student.ttsSettings} onStart={() => setStarted(true)}>
          <GfxMeter value={gfx} onChange={(g) => put({ gfx: g })} />
          {settingsPanel}
        </GameStartCard>
      )}
      {element}
    </div>
  );
}

function XpBar({ m }: { m: Mon }) {
  const need = xpToNext(m.level);
  return <span className="cm-xp" aria-label={`${m.xp} of ${need} XP to the next level`}><i style={{ width: `${Math.min(100, (m.xp / need) * 100)}%` }} /></span>;
}

function Panel({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className={`pf-panel cm-panel${wide ? ' wide' : ''}`} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="cm-panel-head"><h2>{title}</h2><button type="button" className="btn btn-primary" onClick={onClose}>Done</button></div>
        {children}
      </div>
    </div>
  );
}

function CardView({ f, onClose, tts, level }: { f: Form; onClose: () => void; tts: Parameters<typeof speak>[1]; level: number }) {
  const [flip, setFlip] = useState(false); const l = line(f.id);
  const words = `${f.name}. ${l.type} type, stage ${f.stage} of ${l.forms.length}. ${f.desc} Its name comes from ${f.nameFrom}. Its special move is ${l.special.name}.`;
  return (
    <div className="pf-overlay" onClick={onClose}>
      <div className="cm-cardview" onClick={(e) => e.stopPropagation()}>
        <div className={`cm-flip${flip ? ' back' : ''}`} onClick={() => setFlip((x) => !x)}>
          {flip ? (
            <div className="cm-card-backside">
              <h3>{f.name}</h3>
              <p>{f.desc}</p>
              <p><b>Name:</b> {f.nameFrom}.</p>
              <p><b>Special move:</b> {l.special.name}</p>
              <p><b>Lives in:</b> {HABITAT_NAME[l.habitat]}</p>
            </div>
          ) : <CreatureCard f={f} scale={1.5} level={level} />}
        </div>
        <div className="cm-row">
          <button type="button" className="btn" onClick={() => speak(words, tts)} aria-label="Listen">🔊</button>
          <button type="button" className="btn" onClick={() => setFlip((x) => !x)}>Flip card</button>
          <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function GfxMeter({ value, onChange }: { value: Gfx; onChange: (g: Gfx) => void }) {
  const opts: { id: Gfx; label: string; how: string }[] = [
    { id: 'low', label: 'Big pixels', how: 'Chunky pixels. Fastest on older iPads.' },
    { id: 'medium', label: 'Medium', how: 'The usual 3D pixel look.' },
    { id: 'high', label: 'Small pixels', how: 'Sharper. Best on newer iPads.' },
  ];
  return (
    <div className="rc-gfx" role="radiogroup" aria-label="Pixel size">
      <span className="rc-gfx-label">Pixels</span>
      <div className="rc-gfx-meter">
        {opts.map((o, i) => (
          <button key={o.id} type="button" role="radio" aria-checked={value === o.id} title={o.how} className={`rc-gfx-btn${opts.findIndex((x) => x.id === value) >= i ? ' on' : ''}${value === o.id ? ' sel' : ''}`} onClick={() => onChange(o.id)}>{o.label}</button>
        ))}
      </div>
      <small>{opts.find((o) => o.id === value)?.how}</small>
    </div>
  );
}

// The move pad: drag the knob to walk (iPad first; W A S D on a keyboard).
function MovePad({ ctl }: { ctl: React.MutableRefObject<WorldCtl> }) {
  const ref = useRef<HTMLDivElement>(null); const [k, setK] = useState({ x: 0, y: 0 });
  const go = (e: React.PointerEvent) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
    setK({ x: dx, y: dy }); ctl.current.input.mx = dx; ctl.current.input.mz = dy;
  };
  const end = () => { setK({ x: 0, y: 0 }); ctl.current.input.mx = 0; ctl.current.input.mz = 0; };
  return (
    <div ref={ref} className="cm-movepad" role="slider" aria-label="Move" aria-valuenow={0}
      onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); go(e); }}
      onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) go(e); }} onPointerUp={end} onPointerCancel={end}>
      <span className="cm-knob" style={{ transform: `translate(${k.x * 38}px, ${k.y * 38}px)` }} />
    </div>
  );
}
