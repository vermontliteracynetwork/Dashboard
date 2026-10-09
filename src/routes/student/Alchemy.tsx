import { useEffect, useMemo, useRef, useState } from 'react';
import WebpageFrame from '../../components/WebpageFrame';
import { ELEMENTS, RECIPES, START } from '../../games/alchemy/data';
import { setLeaveGuard, useBack } from '../../lib/navTrail';
import { useLocation } from 'react-router-dom';
import { useStore } from '../../store/store';
import QuestionScreen from '../../components/QuestionScreen';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import { payForAnswers } from '../../lib/gameEarnings';
import { drawQuestion } from '../../lib/questionPick';
import { formatMoney } from '../../lib/money';
import type { MCQuestion, NativeGameId } from '../../types';
import { noteGameStart } from '../../lib/gameReports';

// Alchemy, an app on the student's computer (teacher 2026-10-08: "lets get the alchemy game
// going. make an app in the computer"), built from her prototype. Drag one element onto another
// to discover something new. Every visit starts fresh (teacher 2026-10-08: "if you leave alchemy,
// it should clear the board and start from the beginning"). iPad first: big tiles, touch drag, the
// element shelf moves under the board in portrait.

// Alchemy as a native game (teacher 2026-10-08: "alchemy can be selected from main native game
// window. controls should be set by student: moves between question sets (1 move slider up to 10
// moves/combinations/plays) and number of questions each time 1-10). this should pop up if the
// alchemy game is selected from the coputer though a button should be there of "just explore"";
// "default $.50 per correct answer").
const PER_RIGHT_CENTS = 50;
const readNum = (k: string, d: number) => { try { const n = Number(localStorage.getItem(k)); return n >= 1 && n <= 10 ? n : d; } catch { return d; } };
const saveNum = (k: string, n: number) => { try { localStorage.setItem(k, String(n)); } catch { /* fine */ } };

type El = { id: string; e: string; n: string };
const ELS: Record<string, El> = Object.fromEntries(ELEMENTS.map(([id, e, n]) => [id, { id, e, n }]));
// Two-picture elements (🔥🐦 Phoenix) draw a little smaller so they fit the tile.
const TWO = /\p{Extended_Pictographic}.*\p{Extended_Pictographic}/u;
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
const R: Record<string, string> = Object.fromEntries(RECIPES.map(([a, b, r]) => [key(a, b), r]));
type Tile = { uid: number; id: string; x: number; y: number; fx?: 'pop' | 'shake' };

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
  useEffect(() => { noteGameStart('Alchemy'); }, []); // Inbox report timing
  const location = useLocation();
  const back = useBack();
  const fromGames = new URLSearchParams(location.search).get('mode') === 'game';
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const [mode, setMode] = useState<'ask' | 'explore' | 'play'>('ask');
  const [every, setEvery] = useState(() => readNum('alchemy.every', 3));
  const [count, setCount] = useState(() => readNum('alchemy.count', 1));
  const [source, setSource] = useState<QuestionSourceMode>({ mode: 'random' });
  const usableSets = useMemo(() => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((x) => x.kind === 'mc')), [questionSets]);
  const active = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      '__any__' as NativeGameId,
    );
  }, [student, rotations, progress]);
  // An assignment's questions-per-round setting wins and locks the slider (teacher 2026-10-08).
  const qCount = active ? Math.min(10, Math.max(1, active.task.gameQuestionsPerRound ?? count)) : count;
  const [sinceQ, setSinceQ] = useState(0);
  // Save and come back later (teacher 2026-10-08: "give a button to save and return to progress for
  // alchemy"). Saved to the class server per student (style_looks row alchemy:<id>, no new SQL).
  // Leaving without saving still starts fresh next time.
  const saveOwner = student ? `alchemy:${student.id}` : '';
  const saved = useStore((s) => s.styleLooks.find((r) => r.ownerId === saveOwner)?.look as { disc?: string[]; tiles?: { id: string; fx: number; fy: number }[]; at?: string } | undefined);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  const [resume, setResume] = useState(true);
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const [question, setQuestion] = useState<MCQuestion | null>(null);
  const [qLeft, setQLeft] = useState(0);
  const [earned, setEarned] = useState(0);
  const right = useRef(0);
  const pay = useRef(() => {});
  pay.current = () => { if (student && right.current > 0) payForAnswers(student.id, right.current, 'Alchemy', '⚗️', PER_RIGHT_CENTS); right.current = 0; };
  useEffect(() => () => pay.current(), []);
  const pickQ = (avoid?: string): MCQuestion => {
    if (active) { const g = pickGameplayQuestion(active.task, avoid); if (g) return g; }
    if (source.mode === 'set') {
      const pool = questionSets.find((qs) => qs.id === source.setId)?.questions.filter((x): x is MCQuestion => x.kind === 'mc') ?? [];
      const choices = pool.length > 1 && avoid ? pool.filter((x) => x.id !== avoid) : pool;
      if (choices.length) return choices[Math.floor(Math.random() * choices.length)];
    }
    return drawQuestion(questionSets, avoid) ?? generateAutoQuestion();
  };
  // Every combination counts as a play; after "every" plays comes a break of "count" questions.
  const countPlay = () => {
    if (mode !== 'play') return;
    const n = sinceQ + 1;
    if (n < every) { setSinceQ(n); return; }
    setSinceQ(0);
    window.setTimeout(() => { setQLeft(qCount); setQuestion(pickQ()); }, 900);
  };
  const answeredRight = () => {
    if (!question) return;
    right.current += 1; setEarned((e) => e + PER_RIGHT_CENTS);
    if (active && student) submitGameplayAnswer(student.id, active.subject, active.task, question.id, true);
    if (qLeft > 1) { setQLeft(qLeft - 1); setQuestion(pickQ(question.id)); return; }
    setQuestion(null); setQLeft(0);
    say(`Back to mixing! Questions again after ${every} combination${every === 1 ? '' : 's'}.`);
  };
  const [disc, setDisc] = useState<string[]>(() => [...START]);
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
    const d = [...disc, id]; setDisc(d); setFresh((f) => [...f, id]);
    sound([523, 659, 784], 0.1);
    say(`New discovery: ${ELS[id].e} ${ELS[id].n}!`);
    if (d.length === ELEMENTS.length) window.setTimeout(() => say('🎉 You discovered everything!'), 2600);
  };
  const combine = (a: Tile, b: Tile) => {
    countPlay();
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
  // Leaving clears everything, so ask first (teacher 2026-10-08: "make sure there is a confirmation
  // menu that appears before they leave to confirm delete"). Back, the breadcrumbs and closing the tab all ask.
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const sigNow = JSON.stringify([disc, tiles.map((t) => t.id)]);
  const played = (disc.length > START.length || tiles.length > 0) && sigNow !== savedSig;
  const saveGame = () => {
    if (!saveOwner) return;
    const r = boardRect();
    const data = { disc, tiles: tiles.map((t) => ({ id: t.id, fx: (t.x - r.left) / Math.max(1, r.width), fy: (t.y - r.top) / Math.max(1, r.height) })), at: new Date().toISOString() };
    mergeStyleRow(saveOwner, data);
    setSavedSig(sigNow);
    sound([660, 880], 0.08);
    say(`💾 Saved! ${disc.length} discoveries. Next time, tap Continue my saved game.`);
  };
  const loadSave = () => {
    if (!saved?.disc?.length) return;
    const okDisc = saved.disc.filter((id) => ELS[id]);
    setDisc(okDisc); setFresh([]);
    const r = boardRect();
    const ts = (saved.tiles ?? []).filter((t) => ELS[t.id]).map((t) => ({ uid: nextUid.current++, id: t.id, ...clamp(r.left + t.fx * r.width, r.top + t.fy * r.height) }));
    setTiles(ts);
    setSavedSig(JSON.stringify([okDisc, ts.map((t) => t.id)]));
  };
  const startMode = (m: 'play' | 'explore') => {
    if (resume && saved?.disc?.length && savedSig === null) loadSave();
    if (m === 'play') setSinceQ(0);
    setMode(m);
  };
  useEffect(() => {
    if (!played) { setLeaveGuard(null); return; }
    setLeaveGuard((go) => { setLeaving(() => go); return true; });
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => { setLeaveGuard(null); window.removeEventListener('beforeunload', warn); };
  }, [played]);
  const shelf = useMemo(() => disc.filter((id) => !q.trim() || ELS[id].n.toLowerCase().includes(q.trim().toLowerCase())), [disc, q]);

  return (
    <div className="alc">
      <WebpageFrame url="alchemy" />
      <div className="alc-app">
        <div className="alc-board" ref={boardRef}>
          <div className="alc-hud">
            <span className="alc-count" aria-label={`${disc.length} of ${ELEMENTS.length} discovered`}>⚗️ {disc.length} / {ELEMENTS.length}</span>
            {mode === 'play' && (
              <button type="button" className="alc-btn" onClick={() => setMode('ask')} aria-label={`Questions after ${every - sinceQ} more combinations. ${formatMoney(earned)} earned. Tap to change the question settings.`}>
                ❓ in {every - sinceQ} · 💵 {formatMoney(earned)}
              </button>
            )}
            {mode === 'explore' && <button type="button" className="alc-btn" onClick={() => setMode('ask')}>🧭 Exploring</button>}
            <button type="button" className="alc-btn" onClick={saveGame} aria-label="Save my progress">{!played && savedSig ? '✅ Saved' : '💾 Save'}</button>
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
            <div className="alc-in"><div className={`alc-em${TWO.test(ELS[t.id].e) ? ' two' : ''}`}>{ELS[t.id].e}</div><div className="alc-nm">{ELS[t.id].n}</div></div>
          </div>
        ))}
      </div>
      {mode === 'ask' && (
        <div className="overlay-backdrop">
          <div className="overlay-panel chrome-frame stack alc-setup" style={{ padding: 20, maxWidth: 520, width: '100%', gap: 14 }} role="dialog" aria-label="How do you want to play Alchemy?">
            <strong style={{ fontSize: '1.3rem', textAlign: 'center' }}>⚗️ How do you want to play?</strong>
            {saved?.disc?.length && savedSig === null ? (
              <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }} role="radiogroup" aria-label="Saved game">
                <button type="button" role="radio" aria-checked={resume} className={`btn${resume ? ' btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => setResume(true)}>📂 Continue my saved game ({saved.disc.length} found)</button>
                <button type="button" role="radio" aria-checked={!resume} className={`btn${!resume ? ' btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => setResume(false)}>✨ Start fresh</button>
              </div>
            ) : null}
            <label className="alc-slider">
              <span>Combinations between question breaks: <b>{every}</b></span>
              <input type="range" min={1} max={10} step={1} value={every} onChange={(e) => { const n = Number(e.target.value); setEvery(n); saveNum('alchemy.every', n); }} aria-label="Combinations between question breaks" />
            </label>
            <label className="alc-slider">
              <span>Questions each break: <b>{qCount}</b>{active ? ' 🔒 set by your teacher' : ''}</span>
              <input type="range" min={1} max={10} step={1} value={qCount} disabled={!!active} onChange={(e) => { const n = Number(e.target.value); setCount(n); saveNum('alchemy.count', n); }} aria-label="Questions each break" />
            </label>
            {active ? (
              <p style={{ margin: 0, textAlign: 'center' }}>📋 Your questions come from your assignment.</p>
            ) : (
              <QuestionSourcePicker questionSets={usableSets} value={source} onChange={setSource} />
            )}
            <p style={{ margin: 0, textAlign: 'center', fontWeight: 700 }}>💵 {formatMoney(PER_RIGHT_CENTS)} for every right answer</p>
            <div className="row-wrap" style={{ gap: 10, justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary btn-lg" style={{ minHeight: 52 }} onClick={() => startMode('play')}>▶ Play with questions</button>
              {!fromGames && <button type="button" className="btn btn-lg" style={{ minHeight: 52 }} onClick={() => startMode('explore')}>🧭 Just explore</button>}
            </div>
          </div>
        </div>
      )}
      {question && !leaving && (
        <QuestionScreen
          key={question.id + qLeft}
          whoLabel={`⚗️ Alchemy question${qCount > 1 ? ` (${qCount - qLeft + 1} of ${qCount})` : ''}`}
          prompt={question.prompt}
          choices={question.choices}
          correctIndex={question.correctIndex}
          done={qCount - qLeft}
          total={qCount}
          imageUrl={question.imageUrl}
          imageAlt={question.imageAlt}
          onCorrectAnswer={answeredRight}
          onExit={() => setLeaving(() => () => back.go())}
          onSkip={() => setQuestion(pickQ(question.id))}
          ttsSettings={student?.ttsSettings}
        />
      )}
      {leaving && (
        <div className="overlay-backdrop" onClick={() => setLeaving(null)}>
          <div className="overlay-panel chrome-frame stack" style={{ padding: 20, maxWidth: 400, textAlign: 'center' }} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Leave Alchemy">
            <strong>Leave Alchemy?</strong>
            <p style={{ margin: 0 }}>{savedSig ? 'You have changes you did not save. Leaving deletes them.' : disc.length > START.length ? `Leaving deletes your board and your ${disc.length - START.length} new discoveries.` : 'Leaving clears your board.'}{earned > 0 ? ` Your ${formatMoney(earned)} for right answers is yours to keep.` : ''} Tap Save and leave to keep it all for next time.</p>
            <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
              <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => setLeaving(null)} autoFocus>Stay and keep playing</button>
              <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => { saveGame(); const go = leaving; setLeaving(null); setLeaveGuard(null); go(); }}>💾 Save and leave</button>
              <button type="button" className="btn btn-danger" style={{ minHeight: 44 }} onClick={() => { const go = leaving; setLeaving(null); setLeaveGuard(null); go(); }}>Leave and delete</button>
            </div>
          </div>
        </div>
      )}
      {confirmReset && (
        <div className="overlay-backdrop" onClick={() => setConfirmReset(false)}>
          <div className="overlay-panel chrome-frame stack" style={{ padding: 20, maxWidth: 380, textAlign: 'center' }} onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Start over">
            <strong>Start over?</strong>
            <p style={{ margin: 0 }}>This clears the board and goes back to fire, water, earth and air.</p>
            <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
              <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => setConfirmReset(false)}>Keep my discoveries</button>
              <button type="button" className="btn btn-danger" style={{ minHeight: 44 }} onClick={() => { setDisc([...START]); setFresh([]); setTiles([]); setConfirmReset(false); }}>Start over</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
