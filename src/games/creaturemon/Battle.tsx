// Creaturemon battles (Build Queue 703): Smash style, her biggest influence. Two creatures on a floating island with two
// small platforms. Every hit adds damage %, and the higher the %, the farther a hit knocks you. Knock the other
// creature off the island to take one of its stars. Lose both stars and the battle is over. Nobody ever gets hurt:
// a knocked out creature just pops back in a puff of sparkles (her No Blood rule).
// Controls (iPad first): move pad on the left, Jump, Attack, Special and Shield on the right. Keys: arrows/WASD, Space,
// J, K, L.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CreatureSprite, pixelTex, stageHeight } from './three';
import { IMG, form, line, statsAt, typeMult, TYPE_COLOR, type SpecialKind } from './data';
import { sfx } from '../../lib/miniSfx';

const STAGE_W = 8.5; // half the main island
const PLATS = [{ x: -4.6, y: 3.6, w: 2.2 }, { x: 4.6, y: 3.6, w: 2.2 }, { x: 0, y: 6.6, w: 2 }];
const BLAST = { x: 21, top: 19, bottom: -9 };
const G = 34;
const STOCKS = 2;

interface Fighter {
  formId: string; level: number; type: ReturnType<typeof line>['type']; kind: SpecialKind;
  x: number; y: number; vx: number; vy: number; face: 1 | -1; jumps: number; onGround: boolean;
  pct: number; stocks: number; stun: number; atkT: number; atkCd: number; spCd: number; spT: number; shield: number; shieldCd: number;
  inv: number; respawn: number; hitBy: number; atk: number; def: number; spd: number; weight: number; h: number; spr?: CreatureSprite;
}
interface Shot { x: number; y: number; vx: number; owner: 0 | 1; t: number; mesh?: THREE.Mesh }
export interface BattleInput { mx: number; jump: boolean; atk: boolean; sp: boolean; shield: boolean }

function makeFighter(formId: string, level: number, x: number): Fighter {
  const f = form(formId); const l = line(formId); const s = statsAt(f, level);
  return {
    formId, level, type: l.type, kind: l.special.kind, x, y: 0, vx: 0, vy: 0, face: x < 0 ? 1 : -1, jumps: 2, onGround: true,
    pct: 0, stocks: STOCKS, stun: 0, atkT: 0, atkCd: 0, spCd: 0, spT: 0, shield: 0, shieldCd: 0, inv: 1, respawn: 0, hitBy: -1,
    atk: s.atk, def: s.def, spd: s.spd, weight: 0.7 + s.hp / 120, h: Math.min(2.2, stageHeight(f.stage) * 0.85),
  };
}

function Arena({ fx, input, onHud, onEnd, calm, aiLevel, going }: {
  fx: React.MutableRefObject<Fighter[]>; input: React.MutableRefObject<BattleInput>; onHud: (h: { pct: number[]; stocks: number[]; msg?: string }) => void;
  onEnd: (won: boolean) => void; calm: boolean; aiLevel: number; going: boolean;
}) {
  const { scene, camera } = useThree();
  const shots = useRef<Shot[]>([]);
  const fxBits = useRef<{ m: THREE.Mesh; t: number; v: THREE.Vector3 }[]>([]);
  const ended = useRef(false); const hudT = useRef(0); const ai = useRef({ think: 0, mx: 0, want: '' as '' | 'atk' | 'sp' | 'jump' | 'shield' });
  const prev = useRef<BattleInput>({ mx: 0, jump: false, atk: false, sp: false, shield: false });
  const shotGeo = useMemo(() => new THREE.IcosahedronGeometry(0.32, 0), []);
  const bitGeo = useMemo(() => new THREE.BoxGeometry(0.18, 0.18, 0.18), []);
  useEffect(() => {
    fx.current.forEach((f) => { f.spr = new CreatureSprite(f.formId, f.h); scene.add(f.spr.mesh); });
    return () => { fx.current.forEach((f) => { if (f.spr) { scene.remove(f.spr.mesh); f.spr.dispose(); } }); shots.current.forEach((s) => s.mesh && scene.remove(s.mesh)); fxBits.current.forEach((b) => scene.remove(b.m)); };
  }, [fx, scene]);
  const sparkle = (x: number, y: number, color: string, n = 10) => {
    if (calm) n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(bitGeo, new THREE.MeshBasicMaterial({ color })); m.position.set(x, y, 0.2); scene.add(m);
      fxBits.current.push({ m, t: 0.5 + Math.random() * 0.3, v: new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 7, 0) });
    }
  };
  const hit = (a: Fighter, d: Fighter, power: number, dirX: number, up = 0.75, special = false) => {
    if (d.inv > 0 || d.respawn > 0) return;
    const ai2 = fx.current.indexOf(a) as 0 | 1;
    if (d.shield > 0) { d.shield = Math.max(0, d.shield - 0.25); sfx.tick(); sparkle(d.x, d.y + d.h * 0.5, '#9fd8ff', 4); return; }
    const mult = special ? typeMult(a.type, d.type) : 1;
    const dmg = Math.max(1, Math.round(power * a.atk * mult * (12 / (d.def + 12)) * 0.55));
    d.pct = Math.min(999, d.pct + dmg); d.hitBy = ai2;
    const kb = (4 + d.pct * 0.085) * (power / 1.1) / d.weight;
    d.vx = dirX * kb * 0.95; d.vy = kb * up + 3; d.onGround = false; d.stun = 0.18 + kb * 0.018; d.spT = 0;
    d.spr?.set('hurt');
    sparkle(d.x, d.y + d.h * 0.5, mult > 1 ? '#ffd23f' : '#ffffff', mult > 1 ? 14 : 8);
    if (mult > 1) onHud({ pct: fx.current.map((f) => f.pct), stocks: fx.current.map((f) => f.stocks), msg: 'Super strong hit!' });
    sfx.bonk();
  };
  const special = (f: Fighter, i: number) => {
    if (f.spCd > 0 || f.stun > 0 || f.respawn > 0) return;
    const other = fx.current[1 - i];
    f.spCd = f.kind === 'shot' ? 1.1 : 1.6; sfx.whoosh();
    if (f.kind === 'shot') {
      const m = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ color: TYPE_COLOR[f.type] })); scene.add(m);
      shots.current.push({ x: f.x + f.face * 0.8, y: f.y + f.h * 0.55, vx: f.face * 15, owner: i as 0 | 1, t: 1.2, mesh: m });
    } else if (f.kind === 'dash') { f.vx = f.face * 18; f.vy = Math.max(f.vy, 2); f.spT = 0.28; }
    else if (f.kind === 'burst') {
      sparkle(f.x, f.y + f.h * 0.5, TYPE_COLOR[f.type], 16);
      const d = Math.hypot(other.x - f.x, other.y - f.y); if (d < 2.8) hit(f, other, 1.15, Math.sign(other.x - f.x) || f.face, 0.9, true);
    } else { // slam: jump up, then come down hard
      f.vy = f.onGround ? 11 : -22; f.spT = 0.9; f.onGround = false;
    }
  };
  const attack = (f: Fighter, i: number) => {
    if (f.atkCd > 0 || f.stun > 0 || f.respawn > 0) return;
    f.atkCd = 0.38; f.atkT = 0.12; sfx.pop();
    const o = fx.current[1 - i]; const dx = o.x - f.x;
    if (Math.sign(dx) === f.face && Math.abs(dx) < 1.1 + f.h * 0.55 && Math.abs(o.y - f.y) < 1.4 + f.h * 0.4) hit(f, o, 0.8, f.face, 0.6);
  };
  useFrame((_, dtRaw) => {
    if (ended.current) return;
    if (!going) { fx.current.forEach((f) => { if (f.spr) { f.spr.mesh.position.set(f.x, 0, 0); f.spr.face(0, f.face < 0); } }); camera.lookAt(0, 1.5, 0); return; }
    const dt = Math.min(0.04, dtRaw) * (calm ? 0.8 : 1);
    const [p, e] = fx.current;
    // player input (edge triggered buttons)
    const inp = input.current; const pv = prev.current;
    const pIn = { mx: inp.mx, jump: inp.jump && !pv.jump, atk: inp.atk && !pv.atk, sp: inp.sp && !pv.sp, shield: inp.shield };
    prev.current = { ...inp };
    // a friendly computer opponent: walks over, swings, uses its special, recovers back to the island
    const a = ai.current; a.think -= dt;
    const eIn = { mx: 0, jump: false, atk: false, sp: false, shield: false };
    if (a.think <= 0) {
      a.think = 0.28 - aiLevel * 0.03 + Math.random() * 0.2; const dx = p.x - e.x; const ad = Math.abs(dx);
      a.mx = Math.abs(e.x) > STAGE_W - 0.5 && e.y < 2.5 ? -Math.sign(e.x) : ad > 1.4 ? Math.sign(dx) : 0;
      const r = Math.random();
      a.want = ad < 1.8 && r < 0.45 + aiLevel * 0.08 ? 'atk' : ad > 4 && r < 0.18 + aiLevel * 0.05 ? 'sp' : (p.y > e.y + 1.8 && r < 0.4) ? 'jump' : p.atkT > 0 && ad < 2 && r < 0.2 + aiLevel * 0.06 ? 'shield' : '';
      if (Math.abs(e.x) > STAGE_W && e.y < 1.5) a.want = e.jumps > 0 ? 'jump' : 'sp';
    }
    eIn.mx = a.mx; if (a.want) { (eIn as Record<string, boolean | number>)[a.want] = true; if (a.want !== 'shield') a.want = ''; }
    [p, e].forEach((f, i) => {
      const c = i === 0 ? pIn : eIn; const spr = f.spr; if (!spr) return;
      if (f.respawn > 0) {
        f.respawn -= dt; spr.mesh.visible = false;
        if (f.respawn <= 0) { Object.assign(f, { x: i === 0 ? -3 : 3, y: 9, vx: 0, vy: 0, pct: 0, inv: 1.6, jumps: 2 }); sparkle(f.x, f.y, '#ffffff', 12); }
        return;
      }
      spr.mesh.visible = f.inv <= 0 || Math.floor(f.inv * 10) % 2 === 0;
      f.inv = Math.max(0, f.inv - dt); f.atkCd = Math.max(0, f.atkCd - dt); f.spCd = Math.max(0, f.spCd - dt); f.atkT = Math.max(0, f.atkT - dt); f.shieldCd = Math.max(0, f.shieldCd - dt);
      // shield
      if (c.shield && f.shieldCd <= 0 && f.onGround && f.stun <= 0) f.shield = Math.max(f.shield, 0.6); else if (f.shield > 0) { f.shield -= dt; if (f.shield <= 0) f.shieldCd = 0.5; }
      if (f.stun > 0) f.stun -= dt;
      else if (f.shield <= 0) {
        const top = 4.5 + f.spd * 0.13;
        if (Math.abs(c.mx) > 0.15) { f.vx += c.mx * top * dt * (f.onGround ? 10 : 5); f.face = c.mx > 0 ? 1 : -1; }
        else if (f.onGround && f.spT <= 0) f.vx *= Math.pow(0.0005, dt);
        if (f.spT <= 0) f.vx = Math.max(-top, Math.min(top, f.vx));
        if (c.jump && f.jumps > 0) { f.vy = f.jumps === 2 ? 12.5 : 11; f.jumps -= 1; f.onGround = false; sfx.boing(); }
        if (c.atk) attack(f, i);
        if (c.sp) special(f, i);
      }
      // special timers
      if (f.spT > 0) {
        f.spT -= dt; const o = fx.current[1 - i];
        if (f.kind === 'dash' && Math.abs(o.x - f.x) < 1.2 + f.h * 0.4 && Math.abs(o.y - f.y) < 1.5) { hit(f, o, 1.15, f.face, 0.55, true); f.spT = 0; }
        if (f.kind === 'slam' && f.vy < 0 && !f.onGround) f.vy = Math.min(f.vy, -18);
      }
      // physics
      f.vy -= G * dt; const oy = f.y; f.x += f.vx * dt; f.y += f.vy * dt;
      if (!f.onGround) f.vx *= Math.pow(0.6, dt);
      f.onGround = false;
      if (f.vy <= 0) {
        if (Math.abs(f.x) < STAGE_W && oy >= 0 && f.y <= 0) { f.y = 0; f.vy = 0; f.onGround = true; }
        for (const pl of PLATS) if (Math.abs(f.x - pl.x) < pl.w && oy >= pl.y && f.y <= pl.y) { f.y = pl.y; f.vy = 0; f.onGround = true; }
      }
      // the island's side is a wall below the top
      if (f.y < 0 && f.y > -3 && Math.abs(f.x) < STAGE_W + 0.2 && Math.abs(f.x) > STAGE_W - 0.6) f.x = Math.sign(f.x) * (STAGE_W + 0.2);
      if (f.onGround) {
        f.jumps = 2;
        if (f.kind === 'slam' && f.spT > 0) { // landing a slam
          f.spT = 0; sparkle(f.x, f.y + 0.2, TYPE_COLOR[f.type], 12); sfx.thud();
          const o = fx.current[1 - i]; if (Math.abs(o.x - f.x) < 2.6 && Math.abs(o.y - f.y) < 1.6) hit(f, o, 1.25, Math.sign(o.x - f.x) || f.face, 1, true);
        }
      }
      // off the screen: a star is lost, the creature pops back
      if (Math.abs(f.x) > BLAST.x || f.y < BLAST.bottom || f.y > BLAST.top) {
        f.stocks -= 1; f.respawn = 1.2; f.vx = f.vy = 0; sfx.chime();
        sparkle(Math.max(-BLAST.x + 2, Math.min(BLAST.x - 2, f.x)), Math.max(BLAST.bottom + 2, Math.min(BLAST.top - 2, f.y)), '#ffd23f', 20);
        onHud({ pct: fx.current.map((q) => q.pct), stocks: fx.current.map((q) => q.stocks), msg: i === 0 ? 'Oh no, a star lost!' : 'Knocked off! A star for you!' });
        if (f.stocks <= 0) { ended.current = true; window.setTimeout(() => onEnd(i === 1), 900); }
      }
      // sprite
      spr.mesh.position.set(f.x, f.y, 0);
      spr.set(f.stun > 0 ? 'hurt' : Math.abs(f.vx) > 0.6 || !f.onGround ? 'move' : 'idle'); spr.tick(dt, 10);
      spr.face(0, f.face < 0);
      spr.mat.color.set(f.shield > 0 ? '#9fd8ff' : f.atkT > 0 ? '#fff2b0' : '#ffffff');
    });
    // shots
    shots.current = shots.current.filter((s) => {
      s.t -= dt; s.x += s.vx * dt; if (s.mesh) { s.mesh.position.set(s.x, s.y, 0.1); s.mesh.rotation.z += dt * 10; }
      const o = fx.current[1 - s.owner];
      if (o.respawn <= 0 && Math.abs(o.x - s.x) < 0.7 + o.h * 0.3 && s.y > o.y - 0.2 && s.y < o.y + o.h + 0.2) { hit(fx.current[s.owner], o, 0.95, Math.sign(s.vx), 0.5, true); s.t = 0; }
      if (s.t <= 0) { if (s.mesh) scene.remove(s.mesh); return false; }
      return true;
    });
    fxBits.current = fxBits.current.filter((b) => { b.t -= dt; b.v.y -= 20 * dt; b.m.position.addScaledVector(b.v, dt); if (b.t <= 0) { scene.remove(b.m); return false; } return true; });
    // Smash camera: frame both fighters
    const vis = fx.current.filter((f) => f.respawn <= 0);
    const xs = vis.map((f) => f.x), ys = vis.map((f) => f.y + f.h * 0.5);
    const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0, cy = ys.length ? (Math.min(...ys) + Math.max(...ys)) / 2 : 2;
    const span = xs.length > 1 ? Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.6) : 6;
    const z = Math.max(14, Math.min(30, 10 + span * 1.1));
    camera.position.lerp(new THREE.Vector3(cx * 0.7, cy * 0.6 + 4, z), calm ? 0.04 : 0.08); camera.lookAt(cx * 0.7, cy * 0.6 + 1.5, 0);
    hudT.current -= dt; if (hudT.current <= 0) { hudT.current = 0.12; onHud({ pct: fx.current.map((f) => f.pct), stocks: fx.current.map((f) => f.stocks) }); }
  });
  return (
    <>
      {/* the floating island: grass top, rock underneath */}
      <mesh position={[0, -0.6, 0]}><boxGeometry args={[STAGE_W * 2, 1.2, 4]} /><meshLambertMaterial color="#6cbf4a" flatShading /></mesh>
      <mesh position={[0, -2.6, 0]}><cylinderGeometry args={[STAGE_W - 0.5, 2.2, 3, 7]} /><meshLambertMaterial color="#8a6a48" flatShading /></mesh>
      {PLATS.map((pl, i) => (
        <mesh key={i} position={[pl.x, pl.y - 0.15, 0]}><boxGeometry args={[pl.w * 2, 0.3, 2]} /><meshLambertMaterial color="#c9a46a" flatShading /></mesh>
      ))}
    </>
  );
}

function SkyBg({ which }: { which: string }) {
  const { scene } = useThree();
  useEffect(() => { scene.background = pixelTex(`${IMG}sky/${which}.png`); return () => { scene.background = null; }; }, [scene, which]);
  return null;
}

export default function Battle({ me, foe, wild, onEnd, calm, pixel, sky }: {
  me: { formId: string; level: number; name: string }; foe: { formId: string; level: number }; wild: boolean;
  onEnd: (won: boolean) => void; calm: boolean; pixel: number; sky: string;
}) {
  const fx = useRef<Fighter[]>([makeFighter(me.formId, me.level, -3), makeFighter(foe.formId, foe.level, 3)]);
  const input = useRef<BattleInput>({ mx: 0, jump: false, atk: false, sp: false, shield: false });
  const [hud, setHud] = useState<{ pct: number[]; stocks: number[] }>({ pct: [0, 0], stocks: [STOCKS, STOCKS] });
  const [msg, setMsg] = useState('Ready? Go!');
  const [count, setCount] = useState(3);
  useEffect(() => { const t = window.setInterval(() => setCount((c) => c - 1), 650); return () => window.clearInterval(t); }, []);
  useEffect(() => { if (!msg) return; const t = window.setTimeout(() => setMsg(''), 1500); return () => window.clearTimeout(t); }, [msg]);
  useEffect(() => {
    const map: Record<string, keyof BattleInput> = { ' ': 'jump', w: 'jump', arrowup: 'jump', j: 'atk', k: 'sp', l: 'shield' };
    const set = (e: KeyboardEvent, on: boolean) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') input.current.mx = on ? -1 : input.current.mx < 0 ? 0 : input.current.mx;
      else if (k === 'd' || k === 'arrowright') input.current.mx = on ? 1 : input.current.mx > 0 ? 0 : input.current.mx;
      else if (map[k]) (input.current as unknown as Record<string, boolean>)[map[k]] = on; else return;
      e.preventDefault();
    };
    const d = (e: KeyboardEvent) => set(e, true), u = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', d); window.addEventListener('keyup', u);
    return () => { window.removeEventListener('keydown', d); window.removeEventListener('keyup', u); };
  }, []);
  const fm = form(me.formId), ff = form(foe.formId); const lm = line(me.formId), lf = line(foe.formId);
  const hold = (k: keyof BattleInput) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); (input.current as unknown as Record<string, boolean>)[k] = true; },
    onPointerUp: () => { (input.current as unknown as Record<string, boolean>)[k] = false; },
    onPointerCancel: () => { (input.current as unknown as Record<string, boolean>)[k] = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  const going = count <= 0;
  return (
    <div className="cm-battle">
      <Canvas className="cm-canvas" dpr={pixel} gl={{ antialias: false }} camera={{ fov: 45, position: [0, 5, 18] }} >
        <SkyBg which={sky} />
        <hemisphereLight args={['#fff4e0', '#5a6a8a', 1]} />
        <directionalLight position={[5, 10, 8]} intensity={1.4} />
        <Arena fx={fx} input={input} onHud={(h) => { setHud({ pct: h.pct, stocks: h.stocks }); if (h.msg) setMsg(h.msg); }} onEnd={onEnd} calm={calm} aiLevel={Math.max(0, Math.min(3, Math.round((foe.level - me.level) / 4) + 1))} going={going} />
      </Canvas>
      <div className="cm-bhud">
        {[0, 1].map((i) => {
          const f = i === 0 ? fm : ff; const l = i === 0 ? lm : lf; const pct = hud.pct[i];
          return (
            <div key={i} className={`cm-bcard ${i ? 'foe' : 'me'}`} style={{ borderColor: TYPE_COLOR[l.type] }}>
              <b>{i === 0 ? me.name : `${wild ? 'Wild ' : ''}${f.name}`}</b>
              <span className="cm-pct" style={{ color: pct > 100 ? '#e0482a' : pct > 50 ? '#f07a14' : '#fff' }}>{Math.round(pct)}%</span>
              <span className="cm-stars" aria-label={`${hud.stocks[i]} stars left`}>{'★'.repeat(Math.max(0, hud.stocks[i]))}<i>{'★'.repeat(Math.max(0, STOCKS - hud.stocks[i]))}</i></span>
              <small>Lv {i === 0 ? me.level : foe.level} · {l.type}</small>
            </div>
          );
        })}
      </div>
      {(!going || msg) && <div className="cm-bmsg" role="status">{!going ? (count > 0 ? count : 'Go!') : msg}</div>}
      <div className="cm-pad" aria-label="Move left and right">
        <button type="button" className="cm-btn mv" {...{ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current.mx = -1; }, onPointerUp: () => { input.current.mx = 0; }, onPointerCancel: () => { input.current.mx = 0; }, onPointerLeave: () => { input.current.mx = 0; } }} aria-label="Move left">◀</button>
        <button type="button" className="cm-btn mv" {...{ onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.current.mx = 1; }, onPointerUp: () => { input.current.mx = 0; }, onPointerCancel: () => { input.current.mx = 0; }, onPointerLeave: () => { input.current.mx = 0; } }} aria-label="Move right">▶</button>
      </div>
      <div className="cm-acts">
        <button type="button" className="cm-btn sh" {...hold('shield')}>Shield</button>
        <button type="button" className="cm-btn sp" style={{ background: TYPE_COLOR[lm.type] }} {...hold('sp')}>{lm.special.name}</button>
        <button type="button" className="cm-btn at" {...hold('atk')}>Attack</button>
        <button type="button" className="cm-btn jp" {...hold('jump')}>Jump</button>
      </div>
    </div>
  );
}
