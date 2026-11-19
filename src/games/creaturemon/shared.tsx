// Creaturemon pieces shared by the Computer app (the menu, cards, team, battles) and the live world (Pokemon GO style
// catching in Town Square, Build Queue 725): the save, catching, the card reveal and the evolution scene.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { speak } from '../../components/ReadAloud';
import { sfx } from '../../lib/miniSfx';
import { recordBestGame } from '../../lib/personalBoard';
import { CreatureCard, Sprite } from './Card';
import { ABILITIES, AB_GROW, FORMS, IMG, abName, abTier, displayName, form, freshSave, freshStats, giveXp, rollAbility, uid, xpToNext, type AbilityId, type Mon, type MonStats, type Save } from './data';
import './creaturemon.css';

export interface CmSave extends Save { active?: boolean; gfx?: 'low' | 'medium' | 'high' }
export interface Evo { uid: string; from: string; to: string }
// Creaturemon is "on" in the live world (her words: "if they've clicked on the creaturemon app on their computer ...
// they should see a border around their regular world view. then, they have activated the creaturemon").
export const CM_EVENT = 'creaturemon-change';

export function useCmSave() {
  const student = useStore((s) => s.students.find((x) => x.id === s.currentStudentId));
  const studentId = student?.id ?? '';
  const owner = studentId ? `creaturemon:${studentId}` : '';
  const localKey = `creaturemon:${studentId}`;
  const serverSave = useStore((s) => s.styleLooks.find((r) => r.ownerId === owner)?.look as CmSave | undefined);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const read = useCallback((): CmSave => {
    try { const v = JSON.parse(localStorage.getItem(localKey) ?? 'null') as CmSave | null; if (v && Array.isArray(v.mons)) return { ...freshSave(), ...v }; } catch { /* fresh */ }
    return freshSave();
  }, [localKey]);
  const [S, setS] = useState<CmSave>(read);
  const sRef = useRef(S); sRef.current = S;
  useEffect(() => { const n = read(); sRef.current = n; setS(n); }, [read]);
  // another screen (the app or the world) changed the save
  useEffect(() => {
    const on = () => { const n = read(); sRef.current = n; setS(n); };
    window.addEventListener(CM_EVENT, on); return () => window.removeEventListener(CM_EVENT, on);
  }, [read]);
  const serverT = useRef(0);
  const put = useCallback((p: Partial<CmSave>) => {
    const n = { ...sRef.current, ...p, at: new Date().toISOString() }; sRef.current = n; setS(n);
    try { localStorage.setItem(localKey, JSON.stringify(n)); } catch { /* fine */ }
    window.dispatchEvent(new Event(CM_EVENT));
    window.clearTimeout(serverT.current);
    serverT.current = window.setTimeout(() => { if (owner) mergeStyleRow(owner, sRef.current as unknown as Record<string, unknown>); }, 4000);
  }, [localKey, owner, mergeStyleRow]);
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !serverSave?.at) return;
    loaded.current = true;
    if (!sRef.current.at || serverSave.at > sRef.current.at) { const n = { ...freshSave(), ...serverSave }; sRef.current = n; setS(n); try { localStorage.setItem(localKey, JSON.stringify(n)); } catch { /* fine */ } }
  });

  const [evoQ, setEvoQ] = useState<Evo[]>([]);
  const record = (caught: string[]) => { if (studentId) recordBestGame(studentId, 'creaturemon', caught.length, `${caught.length} of ${FORMS.length} cards`); };
  // A new ability to show (732): "Kindlit learned Lazy!"
  const [abQ, setAbQ] = useState<{ uid: string; ab: AbilityId; why: string; grew?: number }[]>([]);
  const addMon = (formId: string, level: number, how: MonStats['how'] = 'orb', abilities: AbilityId[] = []): { mon: Mon; isNew: boolean } => {
    // a wild creature sometimes already knows one ability (each individual is different)
    const abs = [...abilities]; if (how === 'orb' && Math.random() < 0.25) { const a = rollAbility({ abilities: abs }); if (a) abs.push(a); }
    const s = sRef.current; const m: Mon = { uid: uid(), formId, level, xp: 0, caughtAt: new Date().toISOString(), abilities: abs, stats: freshStats(how) };
    const isNew = !s.caught.includes(formId);
    const caught = isNew ? [...s.caught, formId] : s.caught; const seen = s.seen.includes(formId) ? s.seen : [...s.seen, formId];
    put({ mons: [...s.mons, m], team: s.team.length < 6 ? [...s.team, m.uid] : s.team, caught, seen });
    if (isNew) record(caught);
    return { mon: m, isNew };
  };
  const see = (formId: string) => { const s = sRef.current; if (!s.seen.includes(formId)) put({ seen: [...s.seen, formId] }); };
  // XP for one creature; queues its evolution when it reaches the level.
  const train = (monUid: string, xp: number) => {
    const s = sRef.current; const m = s.mons.find((x) => x.uid === monUid); if (!m) return null;
    const r = giveXp(m, xp); put({ mons: s.mons.map((x) => (x.uid === m.uid ? r.mon : x)) });
    if (r.evolveTo) setEvoQ((q) => (q.some((e) => e.uid === m.uid) ? q : [...q, { uid: m.uid, from: m.formId, to: r.evolveTo!.id }]));
    return r;
  };
  const applyEvo = (e: Evo) => {
    const s = sRef.current; const m = s.mons.find((x) => x.uid === e.uid); if (!m) return;
    const isNew = !s.caught.includes(e.to);
    const caught = isNew ? [...s.caught, e.to] : s.caught; const seen = s.seen.includes(e.to) ? s.seen : [...s.seen, e.to];
    // every evolution teaches one new ability while there is room (732)
    const ab = rollAbility(m);
    const st = { ...(m.stats ?? freshStats('orb')), evolutions: (m.stats?.evolutions ?? 0) + 1 };
    put({ mons: s.mons.map((x) => (x.uid === m.uid ? { ...x, formId: e.to, stats: st, abilities: ab ? [...(x.abilities ?? []), ab] : x.abilities } : x)), caught, seen });
    if (ab) setAbQ((q) => [...q, { uid: m.uid, ab, why: 'by evolving' }]);
    // 738: the abilities it already has grow with it (Super at stage 2, Mega at stage 3)
    const to = form(e.to).stage;
    if (abTier(to) > abTier(form(m.formId).stage)) (m.abilities ?? []).forEach((a) => setAbQ((q) => [...q, { uid: m.uid, ab: a, why: 'by evolving', grew: to }]));
    if (isNew) record(caught);
  };
  // Stats for one creature (732), and a chance to learn an ability.
  const stat = (monUid: string, f: (st: MonStats) => MonStats) => {
    const s = sRef.current; put({ mons: s.mons.map((x) => (x.uid === monUid ? { ...x, stats: f(x.stats ?? freshStats('orb')) } : x)) });
  };
  const learn = (monUid: string, why: string, prefer?: AbilityId) => {
    const s = sRef.current; const m = s.mons.find((x) => x.uid === monUid); if (!m) return null;
    const ab = rollAbility(m, prefer); if (!ab) return null;
    put({ mons: s.mons.map((x) => (x.uid === m.uid ? { ...x, abilities: [...(x.abilities ?? []), ab] } : x)) });
    setAbQ((q) => [...q, { uid: m.uid, ab, why }]);
    return ab;
  };
  const team = S.team.map((u) => S.mons.find((m) => m.uid === u)).filter(Boolean) as Mon[];
  return { S, sRef, put, addMon, see, train, team, evoQ, popEvo: () => setEvoQ((q) => q.slice(1)), applyEvo, stat, learn, abQ, popAb: () => setAbQ((q) => q.slice(1)), student, calm: !!student?.worldReduceMotion };
}
export type CmApi = ReturnType<typeof useCmSave>;

export function XpBar({ m }: { m: Mon }) {
  const need = xpToNext(m.level);
  return <span className="cm-xp" aria-label={`${m.xp} of ${need} XP to the next level`}><i style={{ width: `${Math.min(100, (m.xp / need) * 100)}%` }} /></span>;
}

// The orb wobbles one to three times, then the creature is caught or pops out.
export function CatchScene({ shakes, onDone }: { shakes: number; onDone: () => void }) {
  useEffect(() => { const t = window.setTimeout(onDone, 700 + shakes * 650); return () => window.clearTimeout(t); }, [shakes, onDone]);
  return (
    <div className="cm-over cm-catch" aria-live="polite">
      <div className={`cm-orb-big shake${shakes}`} />
      <p>The orb is wobbling...</p>
    </div>
  );
}

// A booster pack opens to show the card.
export function RevealScene({ formId, title, isNew, onClose, tts }: { formId: string; title: string; isNew: boolean; onClose: () => void; tts?: Parameters<typeof speak>[1] }) {
  const f = form(formId);
  return (
    <div className="cm-over" onClick={onClose}>
      <div className="cm-reveal" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {isNew && <span className="cm-new">New card!</span>}
        <div className="cm-pack"><img src={`${IMG}cards/booster.png`} alt="" className="cm-pack-img" /><div className="cm-pack-card"><CreatureCard f={f} scale={1.25} /></div></div>
        <div className="cm-row">
          <button type="button" className="btn" onClick={() => speak(`${f.name}. ${f.desc}`, tts)} aria-label="Listen">🔊</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}

// The evolution scene: the old and new shapes flash white faster and faster, then the new card.
export function EvoScene({ cm }: { cm: CmApi }) {
  const evo = cm.evoQ[0];
  const [step, setStep] = useState<'glow' | 'done'>('glow');
  useEffect(() => {
    if (!evo) return; setStep('glow');
    speak(`What? ${form(evo.from).name} is evolving!`, cm.student?.ttsSettings);
    const t = window.setTimeout(() => {
      setStep('done'); sfx.chime(); cm.applyEvo(evo);
      speak(`${form(evo.from).name} evolved into ${form(evo.to).name}! A new card!`, cm.student?.ttsSettings);
    }, cm.calm ? 2600 : 4200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evo?.uid, evo?.to]);
  if (!evo) return null;
  return (
    <div className={`cm-over cm-evo ${step}`} onClick={() => { if (step === 'done') cm.popEvo(); }}>
      <h2>{step === 'glow' ? `What? ${form(evo.from).name} is evolving!` : `${form(evo.from).name} evolved into ${form(evo.to).name}!`}</h2>
      <div className="cm-evo-stage">
        {step === 'glow' ? (<><Sprite f={form(evo.from)} px={120} className="cm-evo-a" /><Sprite f={form(evo.to)} px={120} className="cm-evo-b" /></>) : <CreatureCard f={form(evo.to)} scale={1.3} />}
      </div>
      {step === 'done' && <button type="button" className="btn btn-primary btn-lg" onClick={() => cm.popEvo()}>Awesome!</button>}
    </div>
  );
}

// Her effect packs (732): Super Pixel Effects Gigapack by Will Tice / unTied Games, played once as a sprite strip.
export const FX: Record<string, [number, number, number]> = { fire: [96, 96, 9], water: [128, 128, 24], leaf: [96, 96, 10], stone: [96, 96, 8], spark: [64, 64, 8], light: [256, 144, 9], shadow: [64, 64, 21], frost: [96, 96, 7], sky: [64, 64, 14], heal: [128, 128, 16], guard: [128, 128, 18], power: [128, 128, 18], sparkle: [96, 96, 24], hearts: [128, 128, 23], coins: [128, 128, 24], poof: [64, 64, 21] };
export function Fx({ name, size = 160, loop = false, style }: { name: string; size?: number; loop?: boolean; style?: React.CSSProperties }) {
  const m = FX[name] ?? FX.sparkle; const [w, h, n] = m; const k = size / Math.max(w, h);
  return <span className={`cm-fx${loop ? ' loop' : ''}`} aria-hidden style={{ width: w * k, height: h * k, backgroundImage: `url(${IMG}fx/${name}.png)`, backgroundSize: `${w * k * n}px ${h * k}px`, ['--fx-end' as string]: `${-w * k * n}px`, ['--fx-n' as string]: n, animationDuration: `${n * 55}ms`, ...style } as React.CSSProperties} />;
}
// Her JDSherbert Pixel UI SFX pack (732).
const sfxCache: Record<string, HTMLAudioElement> = {};
export function uiSound(name: 'select-1' | 'cursor-1' | 'popup-open-1' | 'popup-close-1' | 'cancel-1' | 'error-1') {
  try { if (localStorage.getItem('mini-sfx') === '0') return; } catch { /* fine */ }
  try { const a = sfxCache[name] ?? (sfxCache[name] = new Audio(`${IMG}sfx/${name}.mp3`)); a.volume = 0.5; a.currentTime = 0; void a.play().catch(() => {}); } catch { /* fine */ }
}
// "Kindlit learned Lazy!"
export function AbilityScene({ cm }: { cm: CmApi }) {
  const a = cm.abQ[0]; const m = a ? cm.S.mons.find((x) => x.uid === a.uid) : null;
  const title = a && m ? (a.grew ? `${displayName(m)}'s ${ABILITIES[a.ab].name} grew into ${abName(a.ab, a.grew)}!` : `${displayName(m)} learned ${ABILITIES[a.ab].name}!`) : '';
  const how = a ? (a.grew ? `Now ${AB_GROW[a.ab]}.` : ABILITIES[a.ab].how) : '';
  useEffect(() => { if (a && m) speak(`${title} ${how}`, cm.student?.ttsSettings); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [a?.uid, a?.ab, a?.grew]);
  if (!a || !m || cm.evoQ.length) return null;
  return (
    <div className="cm-over" onClick={() => cm.popAb()}>
      <div className="cm-reveal">
        <h2>{title}</h2>
        <div className="cm-ab-stage"><Fx name={ABILITIES[a.ab].fx} size={a.grew ? 280 : 220} loop /><Sprite f={form(m.formId)} px={a.grew ? 140 : 110} anim="move" /></div>
        <p className="cm-ab-how">{how} <small>({a.grew ? 'grew' : 'learned'} {a.why})</small></p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => cm.popAb()}>Cool!</button>
      </div>
    </div>
  );
}
