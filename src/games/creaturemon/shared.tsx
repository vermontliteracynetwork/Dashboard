// Creaturemon pieces shared by the Computer app (the menu, cards, team, battles) and the live world (Pokemon GO style
// catching in Town Square, Build Queue 715): the save, catching, the card reveal and the evolution scene.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { speak } from '../../components/ReadAloud';
import { sfx } from '../../lib/miniSfx';
import { recordBestGame } from '../../lib/personalBoard';
import { CreatureCard, Sprite } from './Card';
import { FORMS, IMG, form, freshSave, giveXp, uid, xpToNext, type Mon, type Save } from './data';
import './creaturemon.css';

export interface CmSave extends Save { active?: boolean }
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
  const addMon = (formId: string, level: number): { mon: Mon; isNew: boolean } => {
    const s = sRef.current; const m: Mon = { uid: uid(), formId, level, xp: 0, caughtAt: new Date().toISOString() };
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
    put({ mons: s.mons.map((x) => (x.uid === m.uid ? { ...x, formId: e.to } : x)), caught, seen });
    if (isNew) record(caught);
  };
  const team = S.team.map((u) => S.mons.find((m) => m.uid === u)).filter(Boolean) as Mon[];
  return { S, sRef, put, addMon, see, train, team, evoQ, popEvo: () => setEvoQ((q) => q.slice(1)), applyEvo, student, calm: !!student?.worldReduceMotion };
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
