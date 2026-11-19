// Creaturemon in the live world (Build Queue 725, her words: "instead of creating a new world, lets have it so the
// creaturemon is like a pokemon go style game. students should walk around in the main live mode open world game, if
// they've clicked on the creaturemon app on their computer ... they should see a border around their regular world
// view. then, they have activated the creaturemon"). Turned on from the Computer app: Town Square gets a Creaturemon
// border, wild creatures appear near the student (pixel sprites standing in the 3D world, each on a glowing ring),
// and walking up to one offers Throw orb or Battle. Turned off from the border's Off button or the app.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import { useStore } from '../../store/store';
import { useAsk } from '../mini/useAsk';
import { speak } from '../../components/ReadAloud';
import { sfx } from '../../lib/miniSfx';
import { heightAt, isTerrainWater } from '../../routes/world/terrain';
import { CreatureSprite } from './three';
import { Sprite } from './Card';
import Battle, { type BattleEnd } from './Battle';
import { AbilityScene, CM_EVENT, CatchScene, EvoScene, Fx, RevealScene, uiSound, useCmSave } from './shared';
import { IMG, LINES, TYPE_COLOR, catchChance, form, line } from './data';

export interface GoWild { id: string; formId: string; level: number; x: number; z: number; dir: number; t: number; gone: boolean; flee: number; zen?: boolean; spr?: CreatureSprite; ring?: THREE.Mesh }
type Clamp = (x: number, z: number) => [number, number];

// Is Creaturemon on for the student on this iPad? (The Computer app turns it on.)
export function useCreaturemonActive() {
  const id = useStore((s) => s.currentStudentId);
  const read = () => { try { return !!(JSON.parse(localStorage.getItem(`creaturemon:${id}`) ?? 'null') as { active?: boolean } | null)?.active; } catch { return false; } };
  const [on, setOn] = useState(read);
  useEffect(() => {
    setOn(read());
    const f = () => setOn(read()); window.addEventListener(CM_EVENT, f); window.addEventListener('storage', f);
    return () => { window.removeEventListener(CM_EVENT, f); window.removeEventListener('storage', f); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return on;
}

// Every creature line can turn up in Town Square; a few at a time, all around the student, at about their level.
function pickWild(avgLevel: number) {
  const l = LINES[Math.floor(Math.random() * LINES.length)];
  const big = Math.random() < 0.15 && l.forms.length > 1;
  const f = big ? l.forms[1] : l.forms[0];
  const lv = Math.max(big ? (l.forms[0].evolvesAt ?? 5) : 1, Math.min(40, Math.round(avgLevel + Math.random() * 4 - 2 + (big ? 3 : 0))));
  return { formId: f.id, level: lv };
}
const MAX_WILD = 6;

export function CreaturemonWilds({ playerPosRef, wildsRef, clamp, avgLevel = 4 }: { playerPosRef: React.RefObject<THREE.Vector3>; wildsRef: React.MutableRefObject<GoWild[]>; clamp: Clamp; avgLevel?: number }) {
  const { scene, camera } = useThree();
  const ringGeo = useMemo(() => { const g = new THREE.RingGeometry(0.55, 0.75, 24); g.rotateX(-Math.PI / 2); return g; }, []);
  const spawnT = useRef(0); const n = useRef(0);
  const remove = (w: GoWild) => { if (w.spr) { scene.remove(w.spr.mesh); w.spr.dispose(); w.spr = undefined; } if (w.ring) { scene.remove(w.ring); (w.ring.material as THREE.Material).dispose(); w.ring = undefined; } };
  useEffect(() => () => { wildsRef.current.forEach(remove); wildsRef.current = []; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw); const p = playerPosRef.current; if (!p) return;
    // keep a few creatures around; far away ones wander off
    spawnT.current -= dt;
    const live = wildsRef.current.filter((w) => !w.gone);
    if (live.length < MAX_WILD && spawnT.current <= 0) {
      spawnT.current = 4 + Math.random() * 6;
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2, r = 9 + Math.random() * 16;
        const [x, z] = clamp(p.x + Math.cos(a) * r, p.z + Math.sin(a) * r);
        if (Math.hypot(x - p.x, z - p.z) < 6 || isTerrainWater(x, z)) continue;
        const pk = pickWild(avgLevel); n.current += 1;
        // some sit and meditate (732): zen, peaceful, and they join you if you sit with them
        const w: GoWild = { id: `g${n.current}`, ...pk, x, z, dir: Math.random() * 6.28, t: 2, gone: false, flee: 0, zen: Math.random() < 0.18 };
        w.spr = new CreatureSprite(w.formId); scene.add(w.spr.mesh);
        w.ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: w.zen ? '#ffffff' : TYPE_COLOR[line(w.formId).type], transparent: true, opacity: 0.75, depthWrite: false })); scene.add(w.ring);
        wildsRef.current = [...wildsRef.current.filter((q) => !q.gone || q.spr), w];
        sfx.tick();
        break;
      }
    }
    const camYaw = Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    for (const w of wildsRef.current) {
      if (!w.spr || !w.ring) continue;
      const d = Math.hypot(w.x - p.x, w.z - p.z);
      if (w.gone) { w.spr.mesh.visible = false; w.ring.visible = false; continue; }
      if (d > 45) { w.gone = true; remove(w); continue; }
      w.t -= dt; let moving = false; const px = w.x, pz = w.z;
      if (w.flee > 0) w.flee -= dt;
      if (w.t < 0) { w.t = 2 + Math.random() * 3; w.dir += (Math.random() - 0.5) * 2.4; }
      if (!w.zen && (w.flee > 0 || w.t > 2.6)) {
        const sp = w.flee > 0 ? 4.5 : 1.1;
        const [nx, nz] = clamp(w.x + Math.sin(w.dir) * sp * dt, w.z + Math.cos(w.dir) * sp * dt);
        if (isTerrainWater(nx, nz) || (Math.abs(nx - w.x) < 1e-4 && Math.abs(nz - w.z) < 1e-4)) w.dir += Math.PI * 0.6; else { w.x = nx; w.z = nz; moving = true; }
      }
      const y = heightAt(w.x, w.z);
      w.spr.mesh.position.set(w.x, y + 0.02, w.z); w.spr.mesh.visible = true;
      w.ring.position.set(w.x, y + 0.04, w.z); w.ring.visible = true; w.ring.rotation.y += dt;
      if (w.zen) { const k = 1 + Math.sin(performance.now() / 700) * 0.18; w.ring.scale.set(k, 1, k); w.spr.mesh.position.y += 0.25 + Math.sin(performance.now() / 900) * 0.12; }
      w.spr.set(moving ? 'move' : 'idle'); w.spr.tick(dt);
      w.spr.face(camYaw, (w.x - px) * right.x + (w.z - pz) * right.z > 0);
    }
  });
  return <Followers playerPosRef={playerPosRef} />;
}

// Her "creaturemons can follow players like pets" (732): the creatures marked Follow (the leader when none are) walk
// behind the student in Town Square, up to two.
function Followers({ playerPosRef }: { playerPosRef: React.RefObject<THREE.Vector3> }) {
  const cm = useCmSave(); const { scene, camera } = useThree();
  const list = (cm.team.filter((m) => m.follow).length ? cm.team.filter((m) => m.follow) : cm.team.slice(0, 1)).slice(0, 2);
  const key = list.map((m) => m.formId).join(',');
  const sprites = useMemo(() => list.map((m) => new CreatureSprite(m.formId)), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const pos = useRef<THREE.Vector3[]>([]);
  useEffect(() => { sprites.forEach((sp) => scene.add(sp.mesh)); return () => sprites.forEach((sp) => { scene.remove(sp.mesh); sp.dispose(); }); }, [sprites, scene]);
  const last = useRef(new THREE.Vector3());
  useFrame((_, dtRaw) => {
    const p = playerPosRef.current; if (!p) return; const dt = Math.min(0.05, dtRaw);
    const mv = p.clone().sub(last.current); if (mv.lengthSq() > 0.0004) last.current.copy(p);
    const camYaw = Math.atan2(camera.matrixWorld.elements[8], camera.matrixWorld.elements[10]);
    const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
    sprites.forEach((sp, i) => {
      const want = new THREE.Vector3(p.x + (i === 0 ? 1.4 : -1.4), 0, p.z + 1.6);
      const cur = pos.current[i] ?? (pos.current[i] = want.clone());
      if (cur.distanceTo(want) > 14) cur.copy(want);
      const before = cur.clone(); cur.lerp(want, Math.min(1, dt * 2.5));
      const step = cur.clone().sub(before); const moving = step.lengthSq() > 0.00005;
      sp.mesh.position.set(cur.x, heightAt(cur.x, cur.z) + 0.02, cur.z);
      sp.set(moving ? 'move' : 'idle'); sp.tick(dt); sp.face(camYaw, step.dot(right) > 0);
    });
  });
  return null;
}

export function CreaturemonGoOverlay({ playerPosRef, wildsRef }: { playerPosRef: React.RefObject<THREE.Vector3>; wildsRef: React.MutableRefObject<GoWild[]> }) {
  const cm = useCmSave(); const navigate = useNavigate();
  const [near, setNear] = useState<GoWild | null>(null);
  const [catching, setCatching] = useState<{ w?: GoWild; formId: string; level: number; ok: boolean; shakes: number } | null>(null);
  const [reveal, setReveal] = useState<{ formId: string; isNew: boolean; title: string } | null>(null);
  const [battle, setBattle] = useState<GoWild | null>(null);
  const [zen, setZen] = useState<GoWild | null>(null);
  const [toast, setToast] = useState('');
  const tts = cm.student?.ttsSettings;
  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? '' : x)), 2800); };
  // the closest creature in reach
  useEffect(() => {
    const t = window.setInterval(() => {
      const p = playerPosRef.current; if (!p) return;
      let best: GoWild | null = null, bd = 6;
      for (const w of wildsRef.current) { if (w.gone) continue; const d = Math.hypot(w.x - p.x, w.z - p.z); if (d < bd) { bd = d; best = w; } }
      setNear((cur) => (cur?.id === best?.id ? cur : best));
    }, 300);
    return () => window.clearInterval(t);
  }, [playerPosRef, wildsRef]);
  useEffect(() => { if (near) cm.see(near.formId); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [near?.id]);

  const throwOrb = (w: GoWild, tired = false) => {
    if (cm.sRef.current.orbs <= 0) { say('Out of orbs! Make more in the Creaturemon app on your Computer.'); uiSound('error-1'); return; }
    cm.put({ orbs: cm.sRef.current.orbs - 1 }); sfx.whoosh(); uiSound('select-1');
    const p = playerPosRef.current; const behind = p ? Math.abs(((Math.atan2(p.x - w.x, p.z - w.z) - w.dir + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 1.2 : false;
    const ok = Math.random() < catchChance(form(w.formId), w.level, tired, behind);
    w.gone = true;
    setCatching({ w, formId: w.formId, level: w.level, ok, shakes: ok ? 3 : 1 + Math.floor(Math.random() * 2) });
  };
  const caught = () => {
    const c = catching; setCatching(null); if (!c) return;
    if (c.ok) {
      const r = cm.addMon(c.formId, c.level); sfx.chime(); const nm = form(c.formId).name;
      setReveal({ formId: c.formId, isNew: r.isNew, title: `You caught ${nm}!` });
      speak(`You caught ${nm}!${r.isNew ? ' A new card for your collection!' : ''}`, tts);
    } else if (c.w) { c.w.gone = false; c.w.flee = 1.6; sfx.boing(); say(`${form(c.formId).name} popped out! Try again, or battle it first.`); }
  };
  // Sit with a meditating creature (732): three slow breaths together, then it joins you, Zen.
  const joined = (w: GoWild) => {
    setZen(null); w.gone = true;
    const r = cm.addMon(w.formId, w.level, 'meditation', ['zen']);
    cm.stat(r.mon.uid, (st) => ({ ...st, meditations: st.meditations + 1 }));
    const lead = cm.team[0]; if (lead) { cm.stat(lead.uid, (st) => ({ ...st, meditations: st.meditations + 1 })); if (Math.random() < 0.5) window.setTimeout(() => cm.learn(lead.uid, 'by meditating', 'zen'), 2600); }
    sfx.chime(); const nm = form(w.formId).name;
    setReveal({ formId: w.formId, isNew: r.isNew, title: `${nm} joined you!` });
    speak(`${nm} feels calm and peaceful with you. ${nm} joined you!`, tts);
  };
  const endBattle = (r: BattleEnd) => {
    const w = battle; setBattle(null);
    if (r?.won && w) { w.gone = false; throwOrb(w, true); }
  };
  const S = cm.S;
  const f = near ? form(near.formId) : null;
  const seenIt = f && (S.seen.includes(f.id) || S.caught.includes(f.id));
  return (
    <>
      {/* the Creaturemon border around the regular world view */}
      <div className="cmgo-border" aria-hidden />
      <div className="cmgo-bar">
        <img src={`${IMG}forms/kindlit.png`} alt="" className="cmgo-logo" />
        <b>Creaturemon is on</b>
        <span className="cmgo-pill"><i className="cm-orb-i" aria-hidden />{S.orbs} orbs</span>
        <span className="cmgo-pill">{S.caught.length} cards</span>
        <button type="button" className="btn" onClick={() => navigate('/student/creaturemon')}>Cards and team</button>
        <button type="button" className="btn" onClick={() => { cm.put({ active: false }); sfx.click(); }}>Turn off</button>
      </div>
      {!near && !battle && !catching && <p className="cmgo-hint">Walk around to find creatures. They stand on glowing rings.</p>}
      {near && f && near.zen && !battle && !catching && !reveal && !zen && (
        <div className="cmgo-target zen">
          <Sprite f={f} px={56} />
          <div className="cm-target-txt">
            <b>{seenIt ? f.name : 'A wild creature'}</b>
            <small>It is meditating. It looks calm and peaceful.</small>
          </div>
          <div className="cmgo-acts">
            <button type="button" className="cm-big fight" onClick={() => { uiSound('popup-open-1'); setZen(near); }}>Sit with it</button>
          </div>
        </div>
      )}
      {zen && <Meditate formId={zen.formId} calm={cm.calm} tts={tts} onDone={() => joined(zen)} onStop={() => setZen(null)} />}
      {near && f && !near.zen && !battle && !catching && !reveal && (
        <div className="cmgo-target" style={{ borderColor: TYPE_COLOR[line(f.id).type] }}>
          <Sprite f={f} px={56} />
          <div className="cm-target-txt">
            <b>{seenIt ? f.name : 'A wild creature'}</b>
            <small>Lv {near.level} · {line(f.id).type}{S.caught.includes(f.id) ? ' · card caught' : ' · new card!'}</small>
          </div>
          <div className="cmgo-acts">
            <button type="button" className="cm-big orb" onClick={() => throwOrb(near)}>Throw orb</button>
            <button type="button" className="cm-big fight" onClick={() => (cm.team.length ? setBattle(near) : say('Catch a creature first, then you can battle!'))}>Battle</button>
          </div>
        </div>
      )}
      {toast && <div className="cmgo-toast" role="status">{toast}</div>}
      {catching && <CatchScene shakes={catching.shakes} onDone={caught} />}
      {reveal && <RevealScene formId={reveal.formId} isNew={reveal.isNew} title={reveal.title} onClose={() => setReveal(null)} tts={tts} />}
      {battle && <GoBattle cm={cm} foe={{ formId: battle.formId, level: battle.level }} onClose={endBattle} />}
      <EvoScene cm={cm} />
      <AbilityScene cm={cm} />
    </>
  );
}

// The battle with its questions. The question plumbing (and the Learn or Play switch) is only on while a battle is
// open, so it never changes anything else in Town Square.
function GoBattle({ cm, foe, onClose }: { cm: ReturnType<typeof useCmSave>; foe: { formId: string; level: number }; onClose: (r: BattleEnd) => void }) {
  const { ask, element, pay } = useAsk('Creaturemon', '🐉', 'creaturemon', { startCard: false });
  useEffect(() => () => pay(), [pay]);
  return <div className="cmb-host"><Battle cm={cm} wildFoe={foe} ask={ask} onClose={onClose} />{element}</div>;
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
