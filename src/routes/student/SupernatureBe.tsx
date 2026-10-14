import { useEffect, useRef, useState } from 'react';
import { ENERGY_FACE, ENERGY_STEPS, SN, snSound } from '../../lib/supernature';
import { art, type Biome, type Creature } from '../../lib/supernatureCreatures';
import { Icon } from './SupernatureWriting';
import PopCard from './SupernaturePopCard';

// Be the creature (Build Queue 103; plan section 16). Play any creature in the Habitat for 90
// seconds. Tap anywhere to walk there, or use the big joystick. Its diet is the goal: plant eaters
// munch plants, hunters tag prey (the prey poofs safely back to its burrow), leftover eaters clean
// up and feed the soil, and magic eaters gather sparkles. Plant eaters can hide in the bushes when
// a hunter comes; getting chased just sends you back to your burrow. Energy uses her 5 faces: moving
// wears it down, eating lifts it, resting by a bush brings it back to just right.

const W = 1152, H = 584, ROUND = 90;
const HB = `${SN}habitat/`, SW = '/games/castle-defense/craftpix/swamp/props/';
const BUSHES = [{ x: 260, y: 300 }, { x: 640, y: 160 }, { x: 900, y: 420 }];
const BURROW = { x: 80, y: 480 };
const SPEED = [0.5, 0.75, 1, 1.12, 1.2];
interface Item { id: number; x: number; y: number; vx: number; vy: number; away: number; img: string }
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';

export default function SupernatureBe({ c, roster, biome, say, onClose }: { c: Creature; roster: Creature[]; biome: Biome; say: (t: string) => void; onClose: () => void }) {
  const eats = c.eats ?? 'magic';
  const prey = roster.filter((p) => p.id !== c.id && ['plants', 'both', 'leftovers'].includes(p.eats ?? 'magic'));
  const hunterC = roster.find((p) => p.id !== c.id && (p.eats === 'meat'));
  const canBeChased = eats !== 'meat' && eats !== 'magic' && !!hunterC;
  const foodImg = (i: number) => eats === 'meat' ? (prey.length ? art(prey[i % prey.length].id) : `${HB}leafbug.png`)
    : eats === 'leftovers' ? `/games/castle-defense/craftpix/tileset/2-objects/7-decor/log${(i % 3) + 1}.png`
    : eats === 'magic' ? `${SN}theme/sparkle-${i % 6}.png`
    : eats === 'both' && i % 2 ? (prey.length ? art(prey[i % prey.length].id) : `${HB}leafbug.png`) : `${HB}nat${i % 2 ? 2 : 3}.png`;
  const moving = (i: number) => eats === 'meat' || (eats === 'both' && i % 2 === 1);
  const make = (i: number): Item => ({ id: i, x: 140 + Math.random() * (W - 260), y: 90 + Math.random() * (H - 180), vx: moving(i) ? (Math.random() - 0.5) * 90 : 0, vy: moving(i) ? (Math.random() - 0.5) * 70 : 0, away: 0, img: foodImg(i) });
  const st = useRef({
    p: { x: BURROW.x + 40, y: BURROW.y - 40 }, goal: null as null | { x: number; y: number }, joy: { x: 0, y: 0 },
    items: Array.from({ length: 8 }, (_, i) => make(i)), hunter: null as null | { x: number; y: number; t: number },
    energy: 2, moveT: 0, restT: 0, justRight: 0, time: ROUND, ate: 0, chased: 0, hid: 0, wasHidden: false, poofs: [] as { x: number; y: number; t: number }[], nextHunter: 14,
  });
  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState(() => {
    const goal = eats === 'plants' ? 'Find plants to eat.' : eats === 'meat' ? 'Tag your prey. Tagged prey poofs safely back to its burrow.' : eats === 'both' ? 'Eat plants or tag prey.' : eats === 'leftovers' ? 'Clean up the leftover logs. You feed the soil!' : 'Gather the magic sparkles.';
    return `You are the ${c.name}! ${goal}${canBeChased ? ' If a hunter comes, hide in a bush.' : ''} Tap anywhere to walk there.`;
  });
  const area = useRef<HTMLDivElement | null>(null);
  const joyEl = useRef<HTMLDivElement | null>(null);

  useEffect(() => { say(msg); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (paused || done) return;
    let raf = 0; let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = st.current;
      s.time -= dt;
      // move the player
      const sp = 230 * SPEED[s.energy];
      let mx = s.joy.x, my = s.joy.y;
      if (!mx && !my && s.goal) { const dx = s.goal.x - s.p.x, dy = s.goal.y - s.p.y, d = Math.hypot(dx, dy); if (d < 6) s.goal = null; else { mx = dx / d; my = dy / d; } }
      const isMoving = !!(mx || my);
      s.p.x = Math.max(30, Math.min(W - 30, s.p.x + mx * sp * dt)); s.p.y = Math.max(40, Math.min(H - 30, s.p.y + my * sp * dt));
      const hidden = canBeChased && BUSHES.some((b) => Math.hypot(b.x - s.p.x, b.y - s.p.y) < 60);
      if (hidden && !s.wasHidden && s.hunter) { s.hid += 1; setMsg('You hid in the bush. The hunter cannot see you!'); }
      s.wasHidden = hidden;
      // energy: moving wears it down, resting near a bush brings it to just right
      if (isMoving) { s.moveT += dt; s.restT = 0; if (s.moveT > 7) { s.moveT = 0; s.energy = Math.max(0, s.energy - 1); } }
      else { s.restT += dt; if (s.restT > 3) { s.restT = 0; if (s.energy !== 2) s.energy += s.energy < 2 ? 1 : -1; } }
      if (s.energy === 2) s.justRight += dt;
      // food and prey
      for (const it of s.items) {
        if (it.away > 0) { it.away -= dt; if (it.away <= 0) Object.assign(it, make(it.id), { x: BURROW.x + 900, y: 80 + Math.random() * 400 }); continue; }
        if (it.vx || it.vy) {
          // prey runs from the player when it is close
          const dx = it.x - s.p.x, dy = it.y - s.p.y, d = Math.hypot(dx, dy);
          if (d < 140) { it.vx += (dx / d) * 160 * dt; it.vy += (dy / d) * 160 * dt; }
          const v = Math.hypot(it.vx, it.vy); if (v > 120) { it.vx *= 120 / v; it.vy *= 120 / v; }
          it.x += it.vx * dt; it.y += it.vy * dt;
          if (it.x < 40 || it.x > W - 40) it.vx *= -1; if (it.y < 60 || it.y > H - 40) it.vy *= -1;
          it.x = Math.max(40, Math.min(W - 40, it.x)); it.y = Math.max(60, Math.min(H - 40, it.y));
        }
        if (Math.hypot(it.x - s.p.x, it.y - s.p.y) < 46) {
          s.ate += 1; it.away = 6; s.energy = Math.min(3, s.energy + 1);
          if (it.vx || it.vy) { s.poofs.push({ x: it.x, y: it.y, t: 1 }); snSound('poof'); } else snSound('pickup');
        }
      }
      s.poofs = s.poofs.map((p) => ({ ...p, t: p.t - dt })).filter((p) => p.t > 0);
      // the hunter
      if (canBeChased) {
        s.nextHunter -= dt;
        if (!s.hunter && s.nextHunter <= 0) { s.hunter = { x: W - 40, y: 80, t: 9 }; setMsg(`A ${hunterC!.name} is hunting! Hide in a bush!`); snSound('fizzle'); }
        if (s.hunter) {
          const h = s.hunter; h.t -= dt;
          const tx = hidden ? W / 2 + Math.sin(now / 700) * 300 : s.p.x, ty = hidden ? H / 2 : s.p.y;
          const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy) || 1;
          h.x += (dx / d) * 150 * dt; h.y += (dy / d) * 150 * dt;
          if (!hidden && Math.hypot(h.x - s.p.x, h.y - s.p.y) < 44) { s.chased += 1; s.p = { x: BURROW.x + 40, y: BURROW.y - 40 }; s.goal = null; s.energy = Math.max(0, s.energy - 1); setMsg('You got chased! You ran back to your burrow, safe and sound.'); snSound('back'); s.hunter = null; s.nextHunter = 16; }
          else if (h.t <= 0) { s.hunter = null; s.nextHunter = 14 + Math.random() * 8; setMsg('The hunter went away.'); }
        }
      }
      if (s.time <= 0) { setDone(true); snSound('done'); return; }
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, done]);

  const s = st.current;
  const word = eats === 'meat' ? 'tagged' : eats === 'leftovers' ? 'cleaned up' : eats === 'magic' ? 'gathered' : 'ate';
  const noun = eats === 'meat' ? 'prey' : eats === 'leftovers' ? 'logs' : eats === 'magic' ? 'sparkles' : 'snacks';
  const summary = `You ${word} ${s.ate} ${noun}.${canBeChased ? ` A hunter chased you ${s.chased} ${s.chased === 1 ? 'time' : 'times'}, and you hid in a bush ${s.hid} ${s.hid === 1 ? 'time' : 'times'}.` : ''} Your energy was just right for ${Math.round(s.justRight)} seconds.${eats === 'leftovers' ? ' Every log you cleaned up made the soil richer for the plants.' : eats === 'meat' ? ' Every tagged creature ran home safe to its burrow.' : ''}`;

  const tapWorld = (e: React.PointerEvent) => {
    if (done || paused) return;
    const r = area.current!.getBoundingClientRect();
    st.current.goal = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const joy = (e: React.PointerEvent) => {
    if (e.type === 'pointerdown') (e.target as Element).setPointerCapture?.(e.pointerId);
    if (e.type === 'pointerup' || e.type === 'pointercancel' || (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse')) { st.current.joy = { x: 0, y: 0 }; setFrame((f) => f + 1); return; }
    const r = joyEl.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), d = Math.hypot(dx, dy);
    st.current.joy = d < 8 ? { x: 0, y: 0 } : { x: dx / d, y: dy / d }; st.current.goal = null;
    e.stopPropagation();
  };

  return (
    <div className="sn-be" role="dialog" aria-label={`Be the ${c.name}`}>
      <div className={`sn-be-world biome-${biome}`} ref={area} onPointerDown={tapWorld}>
        <div className="sn-hab-ground" style={{ top: 0 }} />
        <img src={`${SW}cave-enterance.png`} alt="" className="sn-be-burrow" style={{ left: BURROW.x - 70, top: BURROW.y - 110 }} />
        {s.items.map((it) => it.away <= 0 && <img key={it.id} src={it.img} alt="" className="sn-be-item" style={{ left: it.x - 22, top: it.y - 22 }} />)}
        {s.poofs.map((p, i) => <span key={i} className="sn-be-poof" style={{ left: p.x - 40, top: p.y - 40, opacity: p.t }} />)}
        <img src={art(c.id)} alt={c.name} className="sn-be-me" style={{ left: s.p.x - 44, top: s.p.y - 64 }} />
        {BUSHES.map((b, i) => <img key={i} src={`${SW}bushes-${i + 1}.png`} alt="" className="sn-be-bush" style={{ left: b.x - 70, top: b.y - 70 }} />)}
        {s.hunter && <img src={art(hunterC!.id)} alt="" className="sn-be-hunter" style={{ left: s.hunter.x - 44, top: s.hunter.y - 64 }} />}
        <div className="sn-be-hud" onPointerDown={(e) => e.stopPropagation()}>
          <span className="sn-be-time">{Math.max(0, Math.ceil(s.time))}s</span>
          <span className="sn-be-energy"><img src={ENERGY_FACE[ENERGY_STEPS[4 - s.energy]]} alt="" className="sn-smooth" />{ENERGY_STEPS[4 - s.energy]}</span>
          <span>{s.ate} {noun}</span>
          <button type="button" className="sn-btn2 small" onClick={() => setPaused(!paused)}>{paused ? 'Keep going' : 'Pause'}</button>
          <button type="button" className="sn-btn2 small" onClick={onClose}>Stop</button>
        </div>
        <p className="sn-be-msg" onPointerDown={(e) => e.stopPropagation()}>{msg}<button type="button" className="sn-listen" onClick={() => say(msg)} aria-label="Listen"><Icon d={LISTEN} /></button></p>
        <div className="sn-joy" ref={joyEl} onPointerDown={joy} onPointerMove={(e) => { if (e.buttons || e.pointerType !== 'mouse') joy(e); }} onPointerUp={joy} onPointerCancel={joy} aria-label="Joystick">
          <i style={{ transform: `translate(${s.joy.x * 34}px, ${s.joy.y * 34}px)` }} />
        </div>
      </div>
      {done && (
        <div className="sn-modal snp-modal" role="dialog" aria-label="Round summary">
          <PopCard className="sn-modal-card paper" title="Round summary">
            <img src={art(c.id)} alt="" style={{ width: 96, height: 96 }} />
            <h2>Great job, {c.name}!</h2>
            <p>{summary}</p>
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => say(summary)}>Listen</button>
              <button type="button" className="sn-btn2" onClick={() => { Object.assign(st.current, { time: ROUND, ate: 0, chased: 0, hid: 0, justRight: 0, energy: 2, hunter: null, nextHunter: 14, p: { x: BURROW.x + 40, y: BURROW.y - 40 } }); setDone(false); }}>Play again</button>
              <button type="button" className="sn-btn" onClick={onClose}>Back to the Habitat</button>
            </div>
          </PopCard>
        </div>
      )}
    </div>
  );
}
