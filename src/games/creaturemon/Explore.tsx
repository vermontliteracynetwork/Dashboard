// Creaturemon's own 3D pixel world, back (Build Queue 740, her words: "return the creaturemon back to their own pixel
// theme world. push immediately"). Six habitats in 3D pixel art seen from behind the player, her Stamper trees and her
// Pixel Skies (World.tsx). Walk up to a wild creature: Throw orb, Battle (the turn based battles, fueled by questions in
// Learn mode, with hearts and abilities), or, when it is meditating, Sit with it so it joins you. The lead creature
// (or the one marked Follow me) walks behind you.
import { useEffect, useRef, useState } from 'react';
import { speak } from '../../components/ReadAloud';
import { sfx } from '../../lib/miniSfx';
import World, { SKY_OF, type Target, type Wild, type WorldCtl } from './World';
import Battle, { type BattleEnd } from './Battle';
import { Sprite } from './Card';
import { CatchScene, Fx, RevealScene, uiSound, type CmApi } from './shared';
import { HABITAT_NAME, TYPE_COLOR, catchChance, form, line, type Habitat } from './data';

type Gfx = 'low' | 'medium' | 'high';
const PIXEL: Record<Gfx, number> = { low: 0.35, medium: 0.5, high: 0.7 };

export default function Explore({ cm, ask, gfx, onClose, learn = true }: { cm: CmApi; ask: (label: string, onRight: () => void, onCancel?: () => void) => void; gfx: Gfx; onClose: () => void; learn?: boolean }) {
  const tts = cm.student?.ttsSettings; const S = cm.S;
  const ctl = useRef<WorldCtl>({ throwOrb: () => {}, catchResult: () => {}, removeWild: () => {}, input: { mx: 0, mz: 0, yawV: 0, run: false } });
  const wilds = useRef<Wild[]>([]);
  const [target, setTarget] = useState<Target | null>(null);
  const [habitat, setHabitat] = useState<Habitat>('meadow');
  const [catching, setCatching] = useState<{ id?: string; formId: string; level: number; ok: boolean; shakes: number } | null>(null);
  const [reveal, setReveal] = useState<{ formId: string; isNew: boolean; title: string } | null>(null);
  const [battle, setBattle] = useState<{ id: string; formId: string; level: number } | null>(null);
  const [zen, setZen] = useState<{ id: string; formId: string; level: number } | null>(null);
  const [toast, setToast] = useState('');
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2800); };
  const followers = cm.team.filter((m) => m.follow); const lead = (followers[0] ?? cm.team[0]) ?? null;
  const avg = cm.team.length ? Math.round(cm.team.reduce((a, m) => a + m.level, 0) / cm.team.length) : 3;
  useEffect(() => { if (target) cm.see(target.formId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [target?.id]);

  const throwOrb = () => {
    if (!target) return;
    if (cm.sRef.current.orbs <= 0) { say('Out of orbs! Tap Make orbs in the menu.'); uiSound('error-1'); return; }
    cm.put({ orbs: cm.sRef.current.orbs - 1 }); sfx.whoosh(); uiSound('select-1'); ctl.current.throwOrb();
  };
  const sneaky = useRef(false); sneaky.current = !!target?.sneaky;
  useEffect(() => {
    const land = (e: Event) => {
      const id = (e as CustomEvent<string>).detail; const w = wilds.current.find((q) => q.id === id); if (!w) return;
      const ok = Math.random() < catchChance(form(w.formId), w.level, false, sneaky.current);
      w.gone = true; w.t = 0;
      setCatching({ id, formId: w.formId, level: w.level, ok, shakes: ok ? 3 : 1 + Math.floor(Math.random() * 2) });
    };
    window.addEventListener('cm-orb-land', land); return () => window.removeEventListener('cm-orb-land', land);
  }, []);
  const caught = () => {
    const c = catching; setCatching(null); if (!c) return;
    if (c.ok) {
      const r = cm.addMon(c.formId, c.level); sfx.chime(); const nm = form(c.formId).name;
      setReveal({ formId: c.formId, isNew: r.isNew, title: `You caught ${nm}!` });
      speak(`You caught ${nm}!${r.isNew ? ' A new card for your collection!' : ''}`, tts);
    } else { const w = wilds.current.find((q) => q.id === c.id); if (w) { w.gone = false; w.flee = 1.5; } sfx.boing(); say(`${form(c.formId).name} popped out! Try again, or battle it first.`); }
  };
  const endBattle = (r: BattleEnd) => {
    const b = battle; setBattle(null); if (!r?.won || !b) return;
    // a creature tired out from a battle is easy to catch
    if (cm.sRef.current.orbs <= 0) { say('Out of orbs! Tap Make orbs in the menu.'); return; }
    cm.put({ orbs: cm.sRef.current.orbs - 1 });
    const w = wilds.current.find((q) => q.id === b.id); if (w) { w.gone = true; w.t = 0; }
    setCatching({ id: b.id, formId: b.formId, level: b.level, ok: Math.random() < catchChance(form(b.formId), b.level, true, false), shakes: 3 });
  };
  const joined = () => {
    const z = zen; setZen(null); if (!z) return;
    const w = wilds.current.find((q) => q.id === z.id); if (w) { w.gone = true; w.t = 0; }
    const r = cm.addMon(z.formId, z.level, 'meditation', ['zen']);
    cm.stat(r.mon.uid, (st) => ({ ...st, meditations: st.meditations + 1 }));
    const l = cm.team[0]; if (l) { cm.stat(l.uid, (st) => ({ ...st, meditations: st.meditations + 1 })); if (Math.random() < 0.5) window.setTimeout(() => cm.learn(l.uid, 'by meditating', 'zen'), 2600); }
    sfx.chime(); const nm = form(z.formId).name;
    setReveal({ formId: z.formId, isNew: r.isNew, title: `${nm} joined you!` });
    speak(`${nm} feels calm and peaceful with you. ${nm} joined you!`, tts);
  };
  const tf = target ? form(target.formId) : null;
  const seenIt = tf && (S.seen.includes(tf.id) || S.caught.includes(tf.id));
  const busy = !!battle || !!catching || !!reveal || !!zen || cm.evoQ.length > 0 || cm.abQ.length > 0;

  return (
    <div className="cmx">
      <div className="cmx-head">
        <button type="button" className="btn" onClick={() => { uiSound('popup-close-1'); onClose(); }}>Back to the menu</button>
        <b className="cm-title">{HABITAT_NAME[habitat]}</b>
        <span className="rc-pill cm-orbs"><i className="cm-orb-i" aria-hidden />{S.orbs} orbs</span>
        <span className="rc-pill">{S.caught.length} cards</span>
      </div>
      <div className="cmx-stage">
        <div className={battle ? 'cm-hide' : 'cm-fill'}>
          <World ctl={ctl} lead={lead?.formId ?? null} wilds={wilds} avgLevel={avg} onTarget={setTarget} onHabitat={setHabitat}
            paused={busy} pixel={PIXEL[gfx]} calm={cm.calm} sky={SKY_OF[habitat]} />
        </div>
        {!battle && <MovePad ctl={ctl} />}
        {!battle && <button type="button" className="cm-run" onPointerDown={(e) => { e.preventDefault(); ctl.current.input.run = true; }} onPointerUp={() => { ctl.current.input.run = false; }} onPointerCancel={() => { ctl.current.input.run = false; }} onContextMenu={(e) => e.preventDefault()}>Run<small>hold</small></button>}
        {!target && !busy && <p className="cm-hint">Walk around to find creatures. Drag the screen to turn.</p>}
        {target && tf && !busy && (
          <div className="cm-target" style={{ borderColor: target.zen ? '#fff' : TYPE_COLOR[line(tf.id).type] }}>
            <Sprite f={tf} px={44} />
            <div className="cm-target-txt">
              <b>{seenIt ? tf.name : 'A wild creature'}</b>
              <small>Lv {target.level} · {line(tf.id).type}{S.caught.includes(tf.id) ? ' · card caught' : ' · new card!'}</small>
              {target.zen ? <small className="cm-sneak">It is meditating. It looks calm and peaceful.</small> : target.sneaky && <small className="cm-sneak">It has not seen you. Sneaky throw!</small>}
            </div>
            {target.zen ? <button type="button" className="cm-big fight" onClick={() => { uiSound('popup-open-1'); setZen({ id: target.id, formId: target.formId, level: target.level }); }}>Sit with it</button> : (
              <>
                <button type="button" className="cm-big orb" onClick={throwOrb} disabled={target.dist > 10}>Throw orb</button>
                <button type="button" className="cm-big fight" onClick={() => (cm.team.length ? setBattle({ id: target.id, formId: target.formId, level: target.level }) : say('Catch a creature first, then you can battle!'))}>Battle</button>
              </>
            )}
          </div>
        )}
        {toast && <div className="cm-toast" role="status">{toast}</div>}
      </div>
      {catching && <CatchScene shakes={catching.shakes} onDone={caught} />}
      {reveal && <RevealScene formId={reveal.formId} isNew={reveal.isNew} title={reveal.title} onClose={() => setReveal(null)} tts={tts} />}
      {battle && <div className="cmb-host"><Battle cm={cm} wildFoe={{ formId: battle.formId, level: battle.level }} ask={ask} onClose={endBattle} learn={learn} /></div>}
      {zen && <Meditate formId={zen.formId} calm={cm.calm} tts={tts} onDone={joined} onStop={() => setZen(null)} />}
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


// Three slow breaths with the creature (an SEL calm down routine), then it joins.
function Meditate({ formId, calm, tts, onDone, onStop }: { formId: string; calm: boolean; tts?: Parameters<typeof speak>[1]; onDone: () => void; onStop: () => void }) {
  const [step, setStep] = useState(0); // 0..5: in, out, in, out, in, out
  const [go, setGo] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setGo(true), 60); return () => window.clearTimeout(t); }, []);
  const len = calm ? 3000 : 4000;
  useEffect(() => {
    if (step >= 6) { onDone(); return; }
    speak(step % 2 === 0 ? 'Breathe in' : 'Breathe out', tts);
    const t = window.setTimeout(() => setStep((x) => x + 1), len); return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const f = form(formId);
  return (
    <div className="cm-over cm-zen">
      <h2>Sit with {f.name}</h2>
      <p>Breathe slowly together. Watch the circle.</p>
      <div className="cm-zen-stage">
        <span className={`cm-zen-ring ${go && step % 2 === 0 ? 'in' : 'out'}`} style={{ transitionDuration: `${len}ms` }} />
        <Fx name="sparkle" size={220} loop />
        <Sprite f={f} px={110} />
      </div>
      <b className="cm-zen-word">{step >= 6 ? 'So calm!' : step % 2 === 0 ? 'Breathe in...' : 'Breathe out...'}</b>
      <small>Breath {Math.min(3, Math.floor(step / 2) + 1)} of 3</small>
      <button type="button" className="btn" onClick={onStop}>Stop</button>
    </div>
  );
}
