import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import WebpageFrame from '../../components/WebpageFrame';
import { ELEMENTS, RECIPES, START } from '../../games/alchemy/data';

// Alchemy, an app on the student's computer (teacher 2026-10-08: "lets get the alchemy game
// going. make an app in the computer"), built from her prototype. Drag one element onto another
// to discover something new. Discoveries are saved for each student (the `alchemy:<id>` row in
// style_looks, plus this iPad). iPad first: big tiles, touch drag, the element shelf moves under
// the board in portrait.

type El = { id: string; e: string; n: string };
const ELS: Record<string, El> = Object.fromEntries(ELEMENTS.map(([id, e, n]) => [id, { id, e, n }]));
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const R: Record<string, string> = Object.fromEntries(RECIPES.map(([a, b, r]) => [key(a, b), r]));
type Tile = { uid: number; id: string; x: number; y: number; fx?: 'pop' | 'shake' };
const owner = (sid: string) => `alchemy:${sid}`;

let actx: AudioContext | null = null;
function beep(freqs: number[], dur: number) {
  try {
    actx = actx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const t0 = actx.currentTime;
    freqs.forEach((f, i) => {
      const o = actx!.createOscillator(), g = actx!.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + i * dur);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + i * dur + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur + dur);
      o.connect(g); g.connect(actx!.destination);
      o.start(t0 + i * dur); o.stop(t0 + i * dur + dur + 0.02);
    });
  } catch { /* no sound on this device */ }
}

export default function Alchemy() {
  const studentId = useStore((s) => s.currentStudentId);
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === owner(studentId)) : undefined));
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const localKey = `alchemy.v1.${studentId ?? 'guest'}`;
  const [disc, setDisc] = useState<string[]>(() => {
    const saved = ((row?.look as { d?: string[] } | undefined)?.d) ?? (() => { try { return (JSON.parse(localStorage.getItem(localKey) ?? 'null') as { d?: string[] } | null)?.d ?? []; } catch { return []; } })();
    return [...new Set([...START, ...saved.filter((id) => ELS[id])])];
  });
  const [soundOn, setSoundOn] = useState(() => { try { return localStorage.getItem('alchemy.sound') !== '0'; } catch { return true; } });
  const [fresh, setFresh] = useState<string[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [hot, setHot] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const shelfRef = useRef<HTMLElement>(null);
  const tilesRef = useRef(tiles); tilesRef.current = tiles;
  const nextUid = useRef(1);
  const drag = useRef<{ uid: number; fromShelf: boolean; moved: boolean; sx: number; sy: number; dx: number; dy: number } | null>(null);
  const toastT = useRef<number>(0);
  const sound = (f: number[], d: number) => { if (soundOn) beep(f, d); };
  const say = (m: string) => { setToast(m); window.clearTimeout(toastT.current); toastT.current = window.setTimeout(() => setToast(null), 2400); };

  // A save from another device arrives: merge it in.
  useEffect(() => {
    const d = (row?.look as { d?: string[] } | undefined)?.d;
    if (d?.length) setDisc((cur) => { const all = [...new Set([...cur, ...d.filter((id) => ELS[id])])]; return all.length === cur.length ? cur : all; });
  }, [row]);
  const save = (d: string[]) => {
    try { localStorage.setItem(localKey, JSON.stringify({ d })); } catch { /* fine */ }
    if (studentId) mergeStyleRow(owner(studentId), { d });
  };

  const boardRect = () => boardRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const clamp = (x: number, y: number) => { const r = boardRect(); return { x: Math.min(Math.max(x, r.left + 46), r.right - 46), y: Math.min(Math.max(y, r.top + 70), r.bottom - 46) }; };
  const nearest = (t: Tile) => {
    let best: Tile | null = null; let bd = 64;
    for (const o of tilesRef.current) { if (o.uid === t.uid) continue; const d = Math.hypot(o.x - t.x, o.y - t.y); if (d < bd) { bd = d; best = o; } }
    return best;
  };
  const addTile = (id: string, x: number, y: number, fx?: Tile['fx']): Tile => { const t = { uid: nextUid.current++, id, x, y, fx }; setTiles((ts) => [...ts, t]); return t; };

  const discover = (id: string) => {
    if (disc.includes(id)) { sound([520], 0.1); return; }
    const d = [...disc, id]; setDisc(d); save(d); setFresh((f) => [...f, id]);
    sound([523, 659, 784], 0.1);
    say(`New discovery: ${ELS[id].e} ${ELS[id].n}!`);
    if (d.length === ELEMENTS.length) window.setTimeout(() => say('🎉 You discovered everything!'), 2600);
  };
  const combine = (a: Tile, b: Tile) => {
    const r = R[key(a.id, b.id)];
    if (r) {
      const p = clamp((a.x + b.x) / 2, (a.y + b.y) / 2);
      setTiles((ts) => [...ts.filter((t) => t.uid !== a.uid && t.uid !== b.uid), { uid: nextUid.current++, id: r, x: p.x, y: p.y, fx: 'pop' }]);
      discover(r);
      return;
    }
    // Not a recipe: both wobble and bounce apart.
    let vx = b.x - a.x, vy = b.y - a.y; const len = Math.hypot(vx, vy) || 1; if (len < 1) { vx = 1; vy = 0; }
    setTiles((ts) => ts.map((t) => {
      if (t.uid !== a.uid && t.uid !== b.uid) return t;
      const s = t.uid === a.uid ? -1 : 1; const p = clamp(t.x + (s * 46 * vx) / len, t.y + (s * 46 * vy) / len);
      return { ...t, ...p, fx: 'shake' };
    }));
    sound([180], 0.12);
  };

  const startDrag = (e: React.PointerEvent, t: Tile, fromShelf: boolean) => {
    e.preventDefault();
    drag.current = { uid: t.uid, fromShelf, moved: false, sx: e.clientX, sy: e.clientY, dx: fromShelf ? 0 : t.x - e.clientX, dy: fromShelf ? 0 : t.y - e.clientY };
    setTiles((ts) => [...ts.filter((x) => x.uid !== t.uid), { ...t, fx: undefined }]); // dragged tile on top
  };
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.moved = true;
      if (!d.moved && d.fromShelf) return;
      setTiles((ts) => ts.map((t) => (t.uid === d.uid ? { ...t, x: e.clientX + d.dx, y: e.clientY + d.dy } : t)));
      const me = tilesRef.current.find((t) => t.uid === d.uid);
      const n = me ? nearest({ ...me, x: e.clientX + d.dx, y: e.clientY + d.dy }) : null;
      setHot(n?.uid ?? null);
    };
    const end = (e: PointerEvent, cancelled: boolean) => {
      const d = drag.current; if (!d) return; drag.current = null; setHot(null);
      const t = tilesRef.current.find((x) => x.uid === d.uid); if (!t) return;
      const sr = shelfRef.current?.getBoundingClientRect();
      const overShelf = !!sr && e.clientX >= sr.left && e.clientX <= sr.right && e.clientY >= sr.top && e.clientY <= sr.bottom;
      if (cancelled || (overShelf && d.moved)) { setTiles((ts) => ts.filter((x) => x.uid !== t.uid)); return; }
      if (d.fromShelf && !d.moved) {
        // A tap on the shelf drops the element somewhere on the board.
        const r = boardRect();
        const p = clamp(r.left + 90 + Math.random() * Math.max(40, r.width - 180), r.top + 110 + Math.random() * Math.max(40, r.height - 200));
        setTiles((ts) => ts.map((x) => (x.uid === t.uid ? { ...x, ...p, fx: 'pop' } : x)));
        sound([440], 0.06);
        return;
      }
      const p = clamp(t.x, t.y); const placed = { ...t, ...p };
      setTiles((ts) => ts.map((x) => (x.uid === t.uid ? placed : x)));
      const o = nearest(placed);
      if (o) combine(placed, o);
    };
    const up = (e: PointerEvent) => end(e, false); const cancel = (e: PointerEvent) => end(e, true);
    const resize = () => setTiles((ts) => ts.map((t) => ({ ...t, ...clamp(t.x, t.y) })));
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', cancel); window.addEventListener('resize', resize);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('resize', resize); };
  });

  const hint = () => {
    const opts = RECIPES.filter(([a, b, r]) => !disc.includes(r) && disc.includes(a) && disc.includes(b));
    if (!opts.length) { say('No hints right now. Keep experimenting!'); return; }
    const [a, b] = opts[Math.floor(Math.random() * opts.length)];
    say(`Try: ${ELS[a].e} ${ELS[a].n} + ${ELS[b].e} ${ELS[b].n}`);
  };
  const shelf = useMemo(() => disc.filter((id) => !q.trim() || ELS[id].n.toLowerCase().includes(q.trim().toLowerCase())), [disc, q]);

  return (
    <div className="alc">
      <WebpageFrame url="alchemy" />
      <div className="alc-app">
        <div className="alc-board" ref={boardRef}>
          <div className="alc-hud">
            <span className="alc-count" aria-label={`${disc.length} of ${ELEMENTS.length} discovered`}>⚗️ {disc.length} / {ELEMENTS.length}</span>
            <button type="button" className="alc-btn" onClick={hint}>💡 Hint</button>
            <button type="button" className="alc-btn" onClick={() => setTiles([])}>🧹 Clear board</button>
            <button type="button" className="alc-btn" onClick={() => { setSoundOn((s) => { try { localStorage.setItem('alchemy.sound', s ? '0' : '1'); } catch { /* fine */ } return !s; }); }} aria-label={soundOn ? 'Sound on. Tap to mute' : 'Sound off. Tap to turn on'}>{soundOn ? '🔊' : '🔇'}</button>
            <button type="button" className="alc-btn" onClick={() => setConfirmReset(true)}>♻️ Start over</button>
          </div>
          {tiles.length === 0 && <div className="alc-empty">Drag an element onto another to combine them.<br />Tap an element to drop it on the board.</div>}
          {toast && <div className="alc-toast" role="status">{toast}</div>}
        </div>
        <aside className="alc-shelf" ref={shelfRef} aria-label="Your elements">
          <input className="alc-search" type="search" placeholder="Search elements..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search your elements" />
          <div className="alc-items">
            {shelf.map((id) => (
              <button key={id} type="button" className={`alc-chip${fresh.includes(id) ? ' new' : ''}`}
                onPointerDown={(e) => { if (e.button > 0) return; setFresh((f) => f.filter((x) => x !== id)); startDrag(e, addTile(id, e.clientX, e.clientY), true); }}
                aria-label={`${ELS[id].n}. Drag onto the board, or tap to drop it there.`}>
                <span className="alc-e" aria-hidden>{ELS[id].e}</span><span>{ELS[id].n}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <div className="alc-layer">
        {tiles.map((t) => (
          <div key={t.uid} className={`alc-tile${hot === t.uid ? ' hot' : ''}${t.fx ? ` ${t.fx}` : ''}${drag.current?.uid === t.uid ? ' drag' : ''}`} style={{ left: t.x, top: t.y }}
            onPointerDown={(e) => { if (e.button > 0) return; startDrag(e, t, false); }}
            onDoubleClick={() => { const p = clamp(t.x + 40, t.y + 40); addTile(t.id, p.x, p.y, 'pop'); }}
            onAnimationEnd={() => setTiles((ts) => ts.map((x) => (x.uid === t.uid ? { ...x, fx: undefined } : x)))}
            role="img" aria-label={ELS[t.id].n}>
            <div className="alc-in"><div className="alc-em">{ELS[t.id].e}</div><div className="alc-nm">{ELS[t.id].n}</div></div>
          </div>
        ))}
      </div>
      {confirmReset && (
        <div className="overlay-backdrop" onClick={() => setConfirmReset(false)}>
          <div className="overlay-panel chrome-frame stack" style={{ padding: 20, maxWidth: 380, textAlign: 'center' }} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Start over">
            <strong>Start over?</strong>
            <p style={{ margin: 0 }}>This forgets everything you discovered except fire, water, earth and air.</p>
            <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
              <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => setConfirmReset(false)}>Keep my discoveries</button>
              <button type="button" className="btn btn-danger" style={{ minHeight: 44 }} onClick={() => { const d = [...START]; setDisc(d); save(d); setFresh([]); setTiles([]); setConfirmReset(false); }}>Start over</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
