import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { BEAKER_MAX, HEAT_RECIPES, RECIPES as LAB_RECIPES, STARTER, SUB, blend, heatUp, pour, type LabEffect, type Recipe, type Substance } from '../../games/scienceLab/lab';
import { snSound } from '../../lib/supernature';
import { Fx, type FxKey } from './SupernatureFx';
import { Icon } from './SupernatureWriting';

// The Mixing Lab inside the Supernature Cauldron (Build Queue 156, her words 2026-10-14: "take the logic
// from the magic part of the science lab and transfer the similar view, interactions, and mixing elements
// to increase the interactive features in the potion maker part of Supernature -- add real science logic
// in a gamified, magical way"). The Science Lab's real chemistry (src/games/scienceLab/lab.ts: things fizz,
// foam, glow, change color or go boom only when the real reaction would) in three pixel flasks: pick a
// flask, then tap or drag a bottle in, heat it, or pour one flask into another. Every reaction shows its
// magic name first and then the real science (what happened and the equation). Discoveries are shared
// with the Science Lab, so the two always agree, and each one adds new bottles to the shelf.
const LISTEN = 'M4 9h4l5-4v14l-5-4H4z M17 8c1.6 1.4 1.6 6.6 0 8';
const ALL = [...LAB_RECIPES, ...HEAT_RECIPES];
const FLASKS = 3;
const owner = (sid: string) => `lab:${sid}`;
const FX_OF: Record<LabEffect, FxKey | null> = { fizz: 'splash', boom: 'blast', bigboom: 'blast', flash: 'hit_light', pop: 'poof', smoke: 'dust', color: 'heal', cloudy: 'dust', layers: null, dissolve: 'potion', foam: 'poof', glow: 'potion' };
const RANKS = [{ at: 0, name: 'Apprentice' }, { at: 4, name: 'Potion Brewer' }, { at: 10, name: 'Alchemist' }, { at: 20, name: 'Grand Alchemist' }, { at: 30, name: 'Archmage' }];
const rankOf = (n: number) => { let r = RANKS[0]; for (const x of RANKS) if (n >= x.at) r = x; return { name: r.name, next: RANKS.find((x) => x.at > n) }; };

export default function SupernatureMixLab({ say }: { say: (t: string) => void }) {
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const row = useStore((s) => (student ? s.styleLooks.find((r) => r.ownerId === owner(student.id)) : undefined));
  const saved = (row?.look ?? {}) as { unlocked?: string[]; found?: string[] };
  const shelf = useMemo(() => [...new Set([...STARTER, ...(saved.unlocked ?? [])])].filter((id) => SUB.has(id)).map((id) => SUB.get(id)!), [saved.unlocked]);
  const found = useMemo(() => (saved.found ?? []).filter((id) => ALL.some((r) => r.id === id)), [saved.found]);
  const [flasks, setFlasks] = useState<string[][]>(() => Array.from({ length: FLASKS }, () => []));
  const [sel, setSel] = useState(0);
  const [fx, setFx] = useState<({ k: FxKey; big: boolean; key: number } | null)[]>(() => Array(FLASKS).fill(null));
  const [pouring, setPouring] = useState<{ flask: number; color: string } | null>(null);
  const [heating, setHeating] = useState<number | null>(null);
  const [pourFrom, setPourFrom] = useState<number | null>(null);
  const [card, setCard] = useState<{ r: Recipe; fresh: boolean; unlocked: string[] } | null>(null);
  const [note, setNote] = useState('Pick a flask, then tap a bottle (or drag it) to pour it in. Real science decides what happens!');
  const [book, setBook] = useState(false);
  const [drag, setDrag] = useState<{ s: Substance; x: number; y: number } | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  const rank = rankOf(found.length);

  const record = (r: Recipe) => {
    const fresh = !found.includes(r.id);
    const newly = r.unlocks.filter((u) => !shelf.some((s) => s.id === u));
    if (student && (fresh || newly.length)) mergeStyleRow(owner(student.id), { found: fresh ? [...found, r.id] : found, unlocked: [...new Set([...(saved.unlocked ?? []), ...newly])] });
    setCard({ r, fresh, unlocked: newly });
    say(`${r.magic.name}! ${r.magic.line} The real science: ${r.fact}`);
  };
  const react = (b: number, r: Recipe) => {
    const k = FX_OF[r.effect];
    if (k) setFx((f) => f.map((x, i) => (i === b ? { k, big: r.effect === 'bigboom', key: Date.now() } : x)));
    snSound(r.effect === 'boom' || r.effect === 'bigboom' || r.effect === 'pop' ? 'poof' : r.effect === 'fizz' || r.effect === 'foam' ? 'fizzle' : 'learned');
    later(() => setFx((f) => f.map((x, i) => (i === b ? null : x))), 2000);
    later(() => record(r), r.effect === 'boom' || r.effect === 'bigboom' ? 900 : 600);
  };
  const addAll = (b: number, ids: string[]) => {
    let cur = flasks[b]; let reaction: Recipe | null = null; let full = false; let noble = false;
    for (const id of ids) {
      const res = pour(cur, id);
      if (res.full) { full = true; break; }
      cur = res.contents; noble = noble || !!res.noble;
      if (res.reaction) reaction = res.reaction;
    }
    setFlasks((fs) => fs.map((x, i) => (i === b ? cur : x)));
    if (full) setNote('That flask is full. Tap 🚰 Empty, or pick another flask.');
    else if (noble && !reaction) setNote('Helium is a noble gas: it never reacts with anything, so nothing happens.');
    else if (reaction) react(b, reaction);
    else if (cur.length > 1) setNote(`No reaction yet. Flask ${b + 1} holds ${cur.map((c) => SUB.get(c)?.name).join(', ')}. Try something else, or heat it!`);
  };
  const pourIn = (s: Substance, b = sel) => {
    if (pouring || heating !== null) return;
    setPourFrom(null); setSel(b);
    if (flasks[b].length >= BEAKER_MAX) { setNote('That flask is full. Tap 🚰 Empty, or pick another flask.'); return; }
    setNote(`${s.name} (${s.formula}): ${s.fact}`);
    setPouring({ flask: b, color: s.color }); snSound('cork');
    later(() => { setPouring(null); addAll(b, [s.id]); }, 700);
  };
  const tapFlask = (i: number) => {
    if (pouring || heating !== null) return;
    if (pourFrom !== null && pourFrom !== i) {
      const from = pourFrom; const ids = flasks[from]; setPourFrom(null); setSel(i);
      if (!ids.length) return;
      setPouring({ flask: i, color: blend(ids) }); snSound('cork');
      later(() => { setPouring(null); setFlasks((fs) => fs.map((x, k) => (k === from ? [] : x))); addAll(i, ids); }, 750);
      return;
    }
    setPourFrom(null); setSel(i); snSound('tap');
  };
  const heat = (b: number) => {
    if (pouring || heating !== null || !flasks[b].length) return;
    setHeating(b); snSound('stir');
    later(() => {
      setHeating(null);
      const res = heatUp(flasks[b]);
      if (!res.reaction) { setNote('It gets warm, but nothing new happens. Heat changes things like water, salt water, sugar or blue copper water.'); return; }
      setFlasks((fs) => fs.map((x, i) => (i === b ? res.contents : x)));
      react(b, res.reaction);
    }, 1300);
  };
  const empty = (i: number) => { setFlasks((fs) => fs.map((x, k) => (k === i ? [] : x))); setFx((f) => f.map((x, k) => (k === i ? null : x))); snSound('cork'); };
  // Drag a bottle onto a flask (a tap pours into the picked flask).
  const startDrag = (e: React.PointerEvent, s: Substance) => {
    const start = { x: e.clientX, y: e.clientY }; let moved = false;
    const st = () => { const r = document.querySelector('.sn-stage')!.getBoundingClientRect(); return { r, k: r.width / 1180 }; };
    const mv = (ev: PointerEvent) => { if (!moved && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) moved = true; if (moved) { const { r, k } = st(); setDrag({ s, x: (ev.clientX - r.left) / k, y: (ev.clientY - r.top) / k }); } };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (!moved) { pourIn(s); return; }
      const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-flask]') as HTMLElement | null;
      if (el) pourIn(s, Number(el.dataset.flask));
    };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  };

  return (
    <div className="mx">
      <section className="mx-shelf" aria-label="Bottles">
        <span className="sn-label">Real ingredients ({shelf.length})</span>
        <div className="mx-bottles">
          {shelf.map((s) => (
            <button key={s.id} type="button" className="mx-bottle" onPointerDown={(e) => startDrag(e, s)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') pourIn(s); }} aria-label={`Pour ${s.name} into flask ${sel + 1}`}>
              <i className={`mx-vial ${s.state}`} style={{ ['--c' as string]: s.color }} />
              <b>{s.name}</b><small>{s.formula}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="mx-bench">
        <div className="mx-rank">🧙 {rank.name} · {found.length} of {ALL.length} discovered{rank.next ? ` · ${rank.next.at - found.length} more to ${rank.next.name}` : ''}
          <button type="button" className="sn-btn2 small" onClick={() => { snSound('page'); setBook(true); }}>📜 Grimoire</button>
        </div>
        <div className="mx-flasks">
          {flasks.map((c, i) => {
            const f = fx[i];
            const fill = Math.min(1, c.length / BEAKER_MAX);
            return (
              <div key={i} className="mx-station">
                <button type="button" data-flask={i} className={`mx-flask${sel === i ? ' on' : ''}${pourFrom === i ? ' from' : ''}${heating === i ? ' hot' : ''}${drag ? ' drop' : ''}`} onClick={() => tapFlask(i)}
                  aria-label={`Flask ${i + 1}${c.length ? `: ${c.map((x) => SUB.get(x)?.name).join(', ')}` : ', empty'}${sel === i ? ', picked' : ''}`}>
                  <span className="mx-glass">
                    <span className="mx-liquid" style={{ height: `${12 + fill * 70}%`, background: c.length ? blend(c) : 'transparent' }} />
                    {c.length > 0 && <span className="mx-bubbles" aria-hidden="true"><i /><i /><i /></span>}
                  </span>
                  {pouring?.flask === i && <span className="mx-stream" style={{ background: pouring.color }} aria-hidden="true" />}
                  {f && <Fx key={f.key} k={f.k} size={f.big ? 260 : 180} className="mx-fx" />}
                  {heating === i && <Fx k="flame" size={70} loop className="mx-flame" />}
                </button>
                <div className="mx-chips">{c.length ? c.map((x, k) => <span key={k}>{SUB.get(x)?.formula}</span>) : <span className="empty">empty</span>}</div>
                <div className="mx-tools">
                  <button type="button" className="sn-btn2 small" disabled={!c.length || heating !== null} onClick={() => heat(i)}>🔥 Heat</button>
                  <button type="button" className={`sn-btn2 small${pourFrom === i ? ' on' : ''}`} disabled={!c.length} onClick={() => { setPourFrom(pourFrom === i ? null : i); setNote(pourFrom === i ? 'Pouring cancelled.' : `Now tap the flask to pour flask ${i + 1} into.`); }}>🫗 Pour</button>
                  <button type="button" className="sn-btn2 small" disabled={!c.length} onClick={() => empty(i)}>🚰 Empty</button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="sn-msg mx-note" role="status">{note}<button type="button" className="sn-listen" onClick={() => say(note)} aria-label="Listen"><Icon d={LISTEN} /></button></p>
      </section>

      {card && (
        <div className="sn-modal" role="dialog" aria-label={card.r.magic.name} onClick={() => setCard(null)}>
          <div className="sn-modal-card paper mx-card" onClick={(e) => e.stopPropagation()}>
            <span className="sn-new">{card.fresh ? '✨ New discovery!' : 'You brewed it again!'}</span>
            <h2>{card.r.magic.name}</h2>
            <p className="mx-magicline">{card.r.magic.line}</p>
            <div className="mx-science">
              <b>🔬 The real science: {card.r.name}</b>
              <p>{card.r.fact}</p>
              <code>{card.r.equation}</code>
            </div>
            {card.unlocked.length > 0 && <p className="sn-small"><b>New on your shelf:</b> {card.unlocked.map((u) => SUB.get(u)?.name).join(', ')}</p>}
            <div className="sn-row center">
              <button type="button" className="sn-btn2" onClick={() => say(`${card.r.magic.name}. ${card.r.magic.line} The real science: ${card.r.name}. ${card.r.fact}`)}>🔊 Listen</button>
              <button type="button" className="sn-btn" onClick={() => setCard(null)}>Keep mixing</button>
            </div>
          </div>
        </div>
      )}
      {book && (
        <div className="sn-modal" role="dialog" aria-label="Grimoire" onClick={() => setBook(false)}>
          <div className="sn-modal-card paper wide mx-book" onClick={(e) => e.stopPropagation()}>
            <h2>📜 Grimoire of Real Reactions</h2>
            <p className="sn-small">Every reaction you discover, with its magic name and the real science. The Science Lab shares this book.</p>
            <div className="mx-book-grid">
              {ALL.map((r) => found.includes(r.id) ? (
                <div key={r.id} className="mx-page"><b>{r.magic.name}</b><small>{r.name}</small><code>{r.equation}</code></div>
              ) : (
                <div key={r.id} className="mx-page locked"><b>❓ Not discovered</b><small>Hint: try {r.needs.filter((n) => n !== 'heat').map((n) => (shelf.some((s) => s.id === n) ? SUB.get(n)?.name : '???')).join(' + ')}{r.needs.includes('heat') ? ', then heat it' : ''}</small></div>
              ))}
            </div>
            <button type="button" className="sn-btn" onClick={() => setBook(false)}>Close</button>
          </div>
        </div>
      )}
      {drag && <span className="mx-drag" style={{ left: drag.x - 26, top: drag.y - 40 }}><i className={`mx-vial ${drag.s.state}`} style={{ ['--c' as string]: drag.s.color }} /></span>}
    </div>
  );
}
