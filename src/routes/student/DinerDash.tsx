import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import LeaveButton from '../../components/LeaveButton';
import { useAsk } from '../../games/mini/useAsk';
import { playCheer } from '../../lib/petSounds';
import { sfx, SfxToggle } from '../../lib/miniSfx';
import { MyBest } from '../../components/MyBest';
import { recordBestGame } from '../../lib/personalBoard';

// Time-Management Diner (her student-favorite genres list, 2026-09-30: "restaurant; answers serve
// customers in order"). Customers sit at the counter with numbered tickets and an order. The student
// makes the food in the kitchen (tap a food, it cooks onto the tray), then serves the customers in
// ticket order: first come, first served. Serving takes one right answer. Patience drains slowly
// and stops while a question is open; a customer who runs out of patience just leaves to come back
// another day (no penalty, no tip). Eight customers make a shift.

const FOODS = [
  { id: 'burger', icon: '🍔', name: 'Burger' }, { id: 'fries', icon: '🍟', name: 'Fries' }, { id: 'drink', icon: '🥤', name: 'Drink' },
  { id: 'hotdog', icon: '🌭', name: 'Hot Dog' }, { id: 'pizza', icon: '🍕', name: 'Pizza' }, { id: 'icecream', icon: '🍦', name: 'Ice Cream' },
];
const FACES = ['🐻', '🐰', '🦊', '🐸', '🐼', '🐵', '🐨', '🐯', '🐷', '🐮'];
const SEATS = 3, PATIENCE = 75, COOK = 1.5, TRAY = 3;
interface Guest { ticket: number; face: string; order: string[]; patience: number }
const food = (id: string) => FOODS.find((f) => f.id === id)!;

export default function DinerDash() {
  const back = useBack();
  const { settings, settingsPanel, rounds, ask, element, pay, asking, student } = useAsk('Diner Dash', '🍔', 'dinerDash', { startCard: false, rounds: { min: 4, max: 12, def: 8 }, roundsLabel: 'Customers each shift' });
  const SHIFT = rounds; // her rounds setting (kids choose; an assignment locks it)
  const styleLooks = useStore((s) => s.styleLooks);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  // The diner's moving parts live in one ref (so the timer never double-counts) and are copied into
  // state for drawing.
  const g = useRef({ guests: [] as Guest[], tray: [] as string[], cooking: null as { id: string; left: number } | null, arrived: 0, left: 0, next: 0 });
  const [view, setView] = useState({ guests: [] as Guest[], tray: [] as string[], cooking: null as { id: string; left: number } | null, arrived: 0, left: 0 });
  const sync = () => { const x = g.current; setView({ guests: [...x.guests], tray: [...x.tray], cooking: x.cooking ? { ...x.cooking } : null, arrived: x.arrived, left: x.left }); };
  const [served, setServed] = useState(0);
  const [tips, setTips] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro');
  const askingRef = useRef(asking);
  askingRef.current = asking;
  const { guests, tray, cooking, arrived, left } = view;

  useEffect(() => {
    if (phase !== 'play') return;
    const dt = 0.25;
    const t = window.setInterval(() => {
      if (askingRef.current) return; // the diner waits while a question is open
      const x = g.current;
      if (x.cooking) { x.cooking.left -= dt; if (x.cooking.left <= 0) { if (x.tray.length < TRAY) x.tray.push(x.cooking.id); x.cooking = null; } }
      const before = x.guests.length;
      x.guests = x.guests.map((q) => ({ ...q, patience: q.patience - dt })).filter((q) => q.patience > 0);
      if (x.guests.length < before) { x.left += before - x.guests.length; setNote('😕 A customer had to go. They will come back another day.'); }
      x.next -= dt;
      if (x.next <= 0 && x.arrived < SHIFT && x.guests.length < SEATS) {
        x.arrived += 1; x.next = 7 + Math.random() * 5;
        const order = [FOODS[Math.floor(Math.random() * FOODS.length)].id];
        if (Math.random() < 0.5) order.push(FOODS[Math.floor(Math.random() * FOODS.length)].id);
        x.guests.push({ ticket: x.arrived, face: FACES[Math.floor(Math.random() * FACES.length)], order, patience: PATIENCE });
      }
      sync();
    }, 250);
    return () => clearInterval(t);
  }, [phase]);

  // The shift ends when every customer has been served or has gone home.
  useEffect(() => {
    if (phase === 'play' && arrived >= SHIFT && served + left >= SHIFT) {
      if (student) {
        const owner = `diner:${student.id}`;
        const sv = (useStore.getState().styleLooks.find((r) => r.ownerId === owner)?.look as { served?: number; shifts?: number; bestTips?: number } | undefined) ?? {};
        mergeStyleRow(owner, { served: (sv.served ?? 0) + served, shifts: (sv.shifts ?? 0) + 1, bestTips: Math.max(sv.bestTips ?? 0, tips) });
      }
      if (student) recordBestGame(student.id, 'dinerDash', tips, `${served} served`);
      pay(); playCheer(); setPhase('end');
    }
  }, [arrived, served, left, phase, tips, student, mergeStyleRow, pay]);

  if (!student) return null;
  const saved = (styleLooks.find((r) => r.ownerId === `diner:${student.id}`)?.look as { served?: number; shifts?: number; bestTips?: number } | undefined) ?? {};

  const cook = (id: string) => {
    const x = g.current;
    if (x.cooking) { setNote('The grill is busy. One thing at a time!'); return; }
    if (x.tray.length >= TRAY) { setNote('The tray is full. Serve a customer first.'); return; }
    x.cooking = { id, left: COOK }; sync(); setNote(null); sfx.sizzle();
  };
  const serve = (guest: Guest) => {
    const x = g.current, first = x.guests[0];
    if (!first) return;
    if (guest.ticket !== first.ticket) { sfx.boing(); setNote(`First come, first served! Serve ticket #${first.ticket} first.`); return; }
    const have = [...x.tray];
    for (const id of guest.order) { const i = have.indexOf(id); if (i < 0) { setNote(`Ticket #${guest.ticket} wants ${guest.order.map((o) => food(o).icon).join(' and ')}. Make it in the kitchen first.`); return; } have.splice(i, 1); }
    ask(`🍔 Answer to serve ticket #${guest.ticket}!`, () => {
      const now = g.current.guests.find((q) => q.ticket === guest.ticket) ?? guest;
      const stars = now.patience > PATIENCE * 0.66 ? 3 : now.patience > PATIENCE * 0.33 ? 2 : 1;
      g.current.tray = have; g.current.guests = g.current.guests.filter((q) => q.ticket !== guest.ticket); sync();
      setServed((n) => n + 1); setTips((t) => t + stars);
      sfx.chime(); setNote(`${guest.face} Yum, thank you! ${'⭐'.repeat(stars)}`);
    });
  };
  const start = () => { g.current = { guests: [], tray: [], cooking: null, arrived: 0, left: 0, next: 0.5 }; sync(); setServed(0); setTips(0); setNote(null); setPhase('play'); };

  return (
    <div className="dd">
      <header className="fd-head dd-head">
        <LeaveButton onLeave={() => { pay(); back.go(); }} note="This shift stops here. Your right answers are paid." />
        <h1>🍔 Diner Dash</h1>
        <SfxToggle />
        {settings}
        <MyBest game="dinerDash" unit="tip stars" />
        <span className="mc-hud">🧾 {served} served · ⭐ {tips}</span>
      </header>
      <div className="dd-main">
        <p className="fd-msg dd-msg" aria-live="polite">{note ?? 'Make each order in the kitchen, then serve customers in ticket order.'}</p>
        <div className="dd-counter">
          {Array.from({ length: SEATS }, (_, i) => {
            const gu = guests[i];
            return (
              <div key={i} className="dd-seat">
                {gu ? (
                  <button type="button" className={`dd-guest${i === 0 ? ' first' : ''}`} onClick={() => serve(gu)} aria-label={`Ticket ${gu.ticket}, wants ${gu.order.map((o) => food(o).name).join(' and ')}. Tap to serve.`}>
                    <span className="dd-ticket">#{gu.ticket}{i === 0 ? ' next' : ''}</span>
                    <span className="dd-order">{gu.order.map((o, k) => <span key={k}>{food(o).icon}</span>)}</span>
                    <span className="dd-face" aria-hidden>{gu.face}</span>
                    <span className="dd-patience" aria-hidden><i style={{ width: `${(gu.patience / PATIENCE) * 100}%`, background: gu.patience > PATIENCE * 0.33 ? '#2fa36b' : '#f0a030' }} /></span>
                  </button>
                ) : <span className="dd-empty">Empty seat</span>}
              </div>
            );
          })}
        </div>
        <div className="dd-tray" aria-label={`Tray: ${tray.map((t) => food(t).name).join(', ') || 'empty'}`}>
          <span>🍽️ Tray:</span>
          {Array.from({ length: TRAY }, (_, i) => <span key={i} className="dd-slot">{tray[i] ? food(tray[i]).icon : ''}</span>)}
          {tray.length > 0 && <button type="button" className="btn dd-clear" onClick={() => { g.current.tray = []; sync(); }}>Clear</button>}
        </div>
        <div className="dd-kitchen">
          {FOODS.map((f) => (
            <button key={f.id} type="button" className={`dd-food${cooking?.id === f.id ? ' cooking' : ''}`} onClick={() => cook(f.id)} disabled={phase !== 'play'}>
              <span aria-hidden>{f.icon}</span>{f.name}
              {cooking?.id === f.id && <i className="dd-cook" style={{ width: `${(1 - cooking.left / COOK) * 100}%` }} />}
            </button>
          ))}
        </div>
      </div>
      {phase === 'intro' && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🍔</div>
            <h2>Welcome to the diner!</h2>
            <p>Customers sit at the counter with a ticket number and an order. Tap a food to cook it onto your tray. Then tap the customer with the lowest ticket number and answer a question to serve them. First come, first served!</p>
            <p>Customers served so far: {saved.served ?? 0} · Best tips: ⭐ {saved.bestTips ?? 0}</p>
            {settingsPanel}
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>🔔 Open the diner</button>
          </div>
        </div>
      )}
      {phase === 'end' && (
        <div className="pf-overlay">
          <div className="pf-panel fd-catch">
            <div className="fd-fish" aria-hidden>🔔</div>
            <h2>Shift complete!</h2>
            <p>You served {served} of {SHIFT} customers and earned ⭐ {tips} tip stars.{left ? ` ${left} had to go, and they will come back another day.` : ' Every customer got their food!'}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={start}>🍔 Work another shift</button>
          </div>
        </div>
      )}
      {element}
    </div>
  );
}
