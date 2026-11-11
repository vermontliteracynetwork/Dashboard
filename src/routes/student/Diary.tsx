import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import { uploadImage, uploadVoiceMemo } from '../../lib/upload';
import { makeId } from '../../lib/id';
import { speak } from '../../components/ReadAloud';
import PaintDesigner from '../../components/PaintDesigner';
import DiaryPage from '../../components/DiaryPage';
import { FEELING_ROOTS, feelingImg, splitSelEmotion, type FeelingNode } from '../../lib/feelingsWheel';
import { SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../../lib/selZones';
import { ENERGY_FACE, ENERGY_STEPS, type Energy } from '../../lib/supernature';
import { petDefById, thumbnailFor } from '../../lib/petCatalog';
import { todayISO } from '../../lib/dates';
import { DIARY_LIBRARY, PAPERS, STARTER_STICKERS, TAPES, cleanHtml, diaryOwner, textOfHtml, type DiaryAnim, type DiaryEntry, type DiaryOrient, COMIC_LAYOUTS, SFX_WORDS, type BubbleStyle, type DiaryItem, type DiaryItemKind, type DiaryLibrary, type DiaryPageData, type LibraryPic } from '../../lib/diaryBook';
import { PET_REPLY } from '../../lib/petsV2';
import { recordReel, shareVideo, type ReelPage, type StatNow } from '../../lib/diaryVideo';
import { useBests } from '../../components/DiaryPage';
import { dayOwner } from '../../lib/questionMastery';
import { readStreak } from '../../lib/streak';
import { sayInPetVoice } from '../../lib/petSpeak';
import { PetPortrait } from './PetFinder';
import type { SelZone } from '../../types';

export { diaryOwner };
export type { DiaryEntry };

// The Diary app on the student computer. Build Queue 290 moved the memory of the day here; Build Queue 577 (her words:
// "drag and drop simple that can almost act like a scrap book. add drawings, images, audio/voice file, notes, "Stickers"
// that we will add that they can use to decorate, memes that they may relate to, they can use the pictures from the
// feelings wheel exactly. sound board for emotions (maybe?) LOVE dailo, charts and graphs of emotions ... FINCH but for
// their pets. should be able to look through old entries, NO recall games. i want this to be more creative in the moment.
// this will be shared with therapists too") makes it a scrapbook: drag things onto a page, look back at old pages, play
// with charts of their own feelings (the feelings wheel check-ins, all kept), and their pet cheers them on.

const ALL_FEELINGS: FeelingNode[] = FEELING_ROOTS.flatMap((r) => [r, ...r.kids, ...r.kids.flatMap((m) => m.kids)]);
const zoneOf = (w: string): SelZone => ALL_FEELINGS.find((f) => f.w.toLowerCase() === w.toLowerCase())?.zone ?? 'green';
const NOTE_COLORS = ['#fff59d', '#ffd1dc', '#c8f1ff', '#d4f8c4', '#ffe0b2', '#e6dcff'];
const asPage = (e: DiaryEntry): DiaryPageData => e.page ?? {
  bg: PAPERS[0],
  items: [
    ...(e.photo ? [{ id: 'p', kind: 'photo' as const, x: 50, y: 42, w: 56, rot: -2, z: 1, src: e.photo }] : []),
    ...(e.caption ? [{ id: 'n', kind: 'note' as const, x: 50, y: e.photo ? 84 : 50, w: 60, rot: 1, z: 2, text: e.caption, color: NOTE_COLORS[0] }] : []),
  ],
};
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

// Live numbers for a page's day, for its video (the same numbers the page shows).
function statFor(studentId: string, day: string) {
  const st = useStore.getState();
  const [right, wrong] = ((st.styleLooks.find((r) => r.ownerId === dayOwner(studentId))?.look ?? {}) as Record<string, [number, number] | null>)[day] ?? [0, 0];
  return (it: DiaryItem): StatNow => {
    if (it.stat === 'accuracy') return { label: `${right} of ${right + wrong} right`, ring: { right, total: right + wrong } };
    if (it.stat === 'streak') return { n: readStreak(studentId).count ?? 0, label: 'day streak' };
    if (it.stat === 'correct') return { n: right, label: 'right answers today' };
    if (it.stat === 'best') {
      const row = st.styleLooks.find((r) => r.ownerId === `board:${it.game}:${studentId}`)?.look as { games?: { score: number }[] } | undefined;
      let n = row?.games?.[0]?.score ?? 0;
      if (it.game === 'yoga') { try { const y = JSON.parse(localStorage.getItem(`yoga.save3.${studentId}`) || '{}') as { records?: Record<string, { xp: number }[]> }; n = Math.max(0, ...Object.values(y.records ?? {}).map((l) => l?.[0]?.xp ?? 0)); } catch { /* none */ } }
      return { n, label: 'my best' };
    }
    return { n: right + wrong, label: 'questions today' };
  };
}

type View = { k: 'home' } | { k: 'edit'; id: string | null } | { k: 'view'; id: string } | { k: 'charts' };

export default function Diary() {
  const back = useBack();
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === (student ? diaryOwner(student.id) : '')));
  const libRow = useStore((s) => s.styleLooks.find((r) => r.ownerId === DIARY_LIBRARY));
  const checkIns = useStore((s) => s.selCheckIns);
  const pets = useStore((s) => s.pets);
  const carePet = useStore((s) => s.carePet);
  const [view, setView] = useState<View>({ k: 'home' });
  const [petSay, setPetSay] = useState('');
  const [making, setMaking] = useState('');
  if (!student) return null;
  const entries = Object.entries((row?.look ?? {}) as Record<string, DiaryEntry | null>).filter((x): x is [string, DiaryEntry] => !!x[1] && !!x[1].at).sort((a, b) => (a[1].at < b[1].at ? 1 : -1));
  const mine = checkIns.filter((c) => c.studentId === student.id).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const pet = pets.find((p) => p.studentId === student.id && p.following) ?? pets.find((p) => p.studentId === student.id);
  const first = student.name.split(' ')[0];
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const thisWeek = entries.filter(([, e]) => e.at >= weekAgo).length;
  const petMap = Object.fromEntries(pets.filter((p) => p.studentId === student.id).map((p) => [p.id, { defId: p.petDefId, name: p.customName }]));
  const reelOf = (list: [string, DiaryEntry][]): ReelPage[] => list.map(([, e]) => ({ page: asPage(e), title: dayLabel(e.at), stat: statFor(student.id, new Date(e.at).toLocaleDateString('en-CA')), pets: petMap }));
  // Build Queue 578 and 579: save a page, or the whole week (the highlight reel), as a video.
  const makeVideo = async (list: [string, DiaryEntry][], title: string) => {
    if (!list.length) return;
    setMaking('Making your video...');
    try { const f = await recordReel(reelOf(list), { title, onProgress: (k) => setMaking(`Making your video... page ${k + 1} of ${list.length}`) }); setMaking(''); await shareVideo(f); }
    catch { setMaking('This device could not make the video.'); window.setTimeout(() => setMaking(''), 3000); }
  };

  if (view.k === 'edit') {
    const old = view.id ? entries.find(([id]) => id === view.id)?.[1] : undefined;
    const today = mine.filter((c) => c.timestamp.slice(0, 10) === todayISO()).at(-1);
    return <PageMaker initial={old ? asPage(old) : null} todayFeeling={today ? splitSelEmotion(today.emotion).emotion : null} lib={(libRow?.look ?? {}) as DiaryLibrary} tts={student.ttsSettings}
      studentId={student.id} day={(old?.at ? new Date(old.at) : new Date()).toLocaleDateString('en-CA')} pets={pets.filter((p) => p.studentId === student.id)}
      onCancel={() => setView(view.id ? { k: 'view', id: view.id } : { k: 'home' })}
      onSave={(page) => {
        const id = view.id ?? makeId(), at = old?.at ?? new Date().toISOString();
        const note = textOfHtml(page.html) || page.items.find((i) => (i.kind === 'note' || i.kind === 'bubble') && i.text)?.text, photo = page.items.find((i) => i.kind === 'photo')?.src;
        const feel = page.items.find((i) => i.kind === 'feeling')?.text;
        useStore.getState().mergeStyleRow(diaryOwner(student.id), { [id]: { at, page, caption: note ?? '', ...(photo ? { photo } : {}), ...(feel ? { feeling: feel, zone: zoneOf(feel) } : {}) } satisfies DiaryEntry });
        const name = pet?.customName;
        // Like Finch: the pet is glad you shared, and it feels loved (a "talk" care).
        if (pet && !view.id) carePet(pet.id, 'talk');
        const say = name ? `${name} loved your page! Thanks for sharing with me.` : 'Saved in your diary!';
        setPetSay(say); speak(say, student.ttsSettings);
        setView({ k: 'home' });
      }} />;
  }

  if (view.k === 'view') {
    const i = entries.findIndex(([id]) => id === view.id), e = entries[i]?.[1];
    if (!e) { setView({ k: 'home' }); return null; }
    return (
      <div className="diary">
        <header className="diary-head">
          <button type="button" className="btn" onClick={() => setView({ k: 'home' })}>← My pages</button>
          <h1>{dayLabel(e.at)}</h1>
          <button type="button" className="btn" disabled={!!making} onClick={() => void makeVideo([entries[i]], `My diary ${new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`)}>Save as video</button>
          <button type="button" className="btn btn-primary" onClick={() => setView({ k: 'edit', id: view.id })}>Add more</button>
        </header>
        {making && <p className="diary-making" role="status">{making}</p>}
        <div className="dp-viewer">
          <button type="button" className="dp-turn" disabled={i >= entries.length - 1} onClick={() => setView({ k: 'view', id: entries[i + 1][0] })} aria-label="Older page">‹</button>
          <DiaryPage page={asPage(e)} className="dp-big" studentId={student.id} day={new Date(e.at).toLocaleDateString('en-CA')} />
          <button type="button" className="dp-turn" disabled={i <= 0} onClick={() => setView({ k: 'view', id: entries[i - 1][0] })} aria-label="Newer page">›</button>
        </div>
      </div>
    );
  }

  if (view.k === 'charts') return <FeelingCharts checkIns={mine} name={first} tts={student.ttsSettings} onBack={() => setView({ k: 'home' })} />;

  return (
    <div className="diary">
      <header className="diary-head">
        <button type="button" className="btn" onClick={() => back.go()}>← Back</button>
        <h1>My Diary</h1>
        <button type="button" className="btn" disabled={!thisWeek || !!making} onClick={() => void makeVideo(entries.filter(([, e]) => e.at >= weekAgo).slice(0, 10).reverse(), `${first}'s week`)}>My week highlight reel</button>
        <button type="button" className="btn" onClick={() => setView({ k: 'charts' })}>My feelings charts</button>
      </header>
      {making && <p className="diary-making" role="status">{making}</p>}
      <section className="diary-hero">
        <div className="diary-buddy">
          {pet ? <img src={(() => { const d = petDefById(pet.petDefId); return d ? thumbnailFor(d) : '/sel/feelings/happy.jpg'; })()} alt="" onError={(e) => { e.currentTarget.src = '/sel/feelings/happy.jpg'; }} /> : <img src="/sel/feelings/happy.jpg" alt="" />}
          <div className="diary-bubble" role="status">{petSay || (pet ? `Hi ${first}! It's ${pet.customName}. What happened today?` : `Hi ${first}! What happened today?`)}</div>
        </div>
        <button type="button" className="diary-new" onClick={() => setView({ k: 'edit', id: null })}><span aria-hidden>+</span>New page</button>
        <div className="diary-week" aria-label={`${thisWeek} pages this week`}>
          {Array.from({ length: 7 }, (_, k) => <i key={k} className={k < thisWeek ? 'on' : ''} />)}
          <small>{thisWeek} {thisWeek === 1 ? 'page' : 'pages'} this week</small>
        </div>
      </section>
      {entries.length === 0 ? (
        <div className="diary-empty"><p>Your diary is empty. Tap <b>New page</b> and drag on pictures, drawings, stickers, your voice and notes.</p></div>
      ) : (
        <div className="diary-shelf">
          {entries.map(([id, e]) => (
            <button key={id} type="button" className="diary-thumb" onClick={() => setView({ k: 'view', id })}>
              <DiaryPage page={asPage(e)} className="dp-mini" lite studentId={student.id} day={new Date(e.at).toLocaleDateString('en-CA')} />
              <span>{new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{e.feeling ? ` · ${e.feeling}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- the page maker (Build Queue 578: Canva style) ----------
// Left: a sidebar of drop-down menus like the Literacy Manipulatives board. Middle: the page, with a word processor
// right on it (type, colors, highlight, sizes) and everything dragged on top. The picked item gets its own bar:
// size, turn, caption, float over the text or wrap the text around it, animations (or draw a path), talk to your pet.
type Drop = Partial<DiaryItem> & { kind: DiaryItemKind; w: number };
const BUBBLE_COLORS = ['#ffffff', '#fff59d', '#c8f1ff', '#ffd1dc', '#d4f8c4', '#2b2540'];
const SWATCHES = ['#1f2937', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff'];
const HIGHLIGHTS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];
const ANIMS: [DiaryAnim | null, string][] = [[null, 'Still'], ['bounce', 'Bounce'], ['wiggle', 'Wiggle'], ['spin', 'Spin'], ['float', 'Float'], ['pulse', 'Pulse'], ['path', 'Draw a path']];
const PET_LINES = ['That sounds awesome! Tell me more!', 'Woof! That made my tail wag!', 'You are the best. I love hearing about your day!', 'Cool! What was the best part?', 'High five! Or high paw!', 'Wow! I wish I was there with you!'];
const HARD_WORDS = /\b(sad|mad|angry|bad|tired|hate|upset|worried|scared|lonely|bored|cry|hurt)\b/i;
const petAnswer = (said: string) => (HARD_WORDS.test(said) ? PET_REPLY[/\b(mad|angry|hate|upset)\b/i.test(said) ? 'yellow' : 'blue'][Math.floor(Math.random() * 2)] : PET_LINES[Math.floor(Math.random() * PET_LINES.length)]);
const loadAr = (src: string) => new Promise<number>((res) => { const im = new Image(); im.onload = () => res(im.naturalWidth ? im.naturalHeight / im.naturalWidth : 1); im.onerror = () => res(1); im.src = src; });

function Category({ label, color, open, onToggle, children }: { label: string; color: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="dm-cat">
      <button type="button" className="dm-cat-head" style={{ background: color }} onClick={onToggle} aria-expanded={open}><span>{label}</span><span aria-hidden>{open ? '▾' : '▸'}</span></button>
      {open && <div className="dm-cat-body">{children}</div>}
    </div>
  );
}

function PageMaker({ initial, todayFeeling, lib, tts, studentId, day, pets, onSave, onCancel }: {
  initial: DiaryPageData | null; todayFeeling: string | null; lib: DiaryLibrary; tts?: Parameters<typeof speak>[1]; studentId: string; day: string;
  pets: { id: string; petDefId: string; customName: string }[];
  onSave: (p: DiaryPageData) => void; onCancel: () => void;
}) {
  const [page, setPage] = useState<DiaryPageData>(() => initial ? { ...initial } : { bg: PAPERS[0], items: [], html: '', v: 3, orient: 'land' as DiaryOrient, talk: [] });
  const [sel, setSel] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ feelings: true });
  const [sub, setSub] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [rec, setRec] = useState<{ r: MediaRecorder; stream: MediaStream; t0: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; d: Drop } | null>(null);
  const [pathing, setPathing] = useState<{ id: string; pts: [number, number][] } | null>(null);
  const [talk, setTalk] = useState('');
  const [textColor, setTextColor] = useState('#1f2937');
  const [listening, setListening] = useState(false);
  const recog = useRef<{ stop: () => void } | null>(null);
  const spokeRef = useRef(false);
  const bests = useBests(studentId);
  const pageEl = useRef<HTMLDivElement | null>(null);
  const textEl = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const trayDrag = useRef<{ d: Drop; x0: number; y0: number; moved: boolean } | null>(null);
  const fileIn = useRef<HTMLInputElement | null>(null);
  const savedRange = useRef<Range | null>(null);

  const stickers = useMemo(() => [...STARTER_STICKERS, ...Object.values(lib.stickers ?? {}).filter((x): x is LibraryPic => !!x)], [lib]);
  const memes = useMemo(() => Object.values(lib.memes ?? {}).filter((x): x is LibraryPic => !!x), [lib]);
  const topZ = () => page.items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
  const add = (d: Drop, x = 25 + Math.random() * 50, y = 25 + Math.random() * 50) => {
    const it: DiaryItem = { id: makeId(), x, y, rot: d.kind === 'tape' ? Math.round((Math.random() - 0.5) * 30) : d.kind === 'stat' || d.kind === 'pet' ? 0 : Math.round((Math.random() - 0.5) * 8), z: topZ(), ...d };
    setPage((p) => ({ ...p, items: [...p.items, it] })); setSel(it.id);
    if (it.src && (it.kind === 'photo' || it.kind === 'meme' || it.kind === 'sticker' || it.kind === 'drawing')) void loadAr(it.src).then((ar) => upd(it.id, () => ({ ar })));
    return it;
  };
  const upd = (id: string, f: (i: DiaryItem) => Partial<DiaryItem>) => setPage((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...f(i) } : i)) }));
  const selected = page.items.find((i) => i.id === sel) ?? null;
  const pct = (cx: number, cy: number) => { const r = pageEl.current!.getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100, inside: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom }; };

  // Move things on the page with a finger (or draw a path for the picked item).
  const itemDown = (e: React.PointerEvent<HTMLDivElement>, it: DiaryItem) => {
    if (pathing || (e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const p = pct(e.clientX, e.clientY); drag.current = { id: it.id, dx: p.x - it.x, dy: p.y - it.y }; setSel(it.id);
    upd(it.id, () => ({ z: topZ() }));
  };
  const stageDown = (e: React.PointerEvent) => { if (!pathing) return; e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); const p = pct(e.clientX, e.clientY); setPathing({ ...pathing, pts: [[p.x, p.y]] }); };
  const stageMove = (e: React.PointerEvent) => {
    if (pathing && pathing.pts.length) { const p = pct(e.clientX, e.clientY), last = pathing.pts[pathing.pts.length - 1]; if (Math.hypot(p.x - last[0], p.y - last[1]) > 1.2) setPathing({ ...pathing, pts: [...pathing.pts, [p.x, p.y]] }); return; }
    const d = drag.current; if (!d) return; const p = pct(e.clientX, e.clientY); upd(d.id, () => ({ x: Math.max(0, Math.min(100, p.x - d.dx)), y: Math.max(0, Math.min(100, p.y - d.dy)) }));
  };
  const stageUp = () => {
    drag.current = null;
    if (pathing && pathing.pts.length > 2) { const [x0, y0] = pathing.pts[0]; const step = Math.max(1, Math.floor(pathing.pts.length / 80)); upd(pathing.id, () => ({ anim: 'path', path: pathing.pts.filter((_, k) => k % step === 0).map(([x, y]) => [x - x0, y - y0] as [number, number]) })); setPathing(null); }
  };

  // Drag from the sidebar onto the page, or tap a tile to drop it on the page.
  const trayDown = (e: React.PointerEvent<HTMLButtonElement>, d: Drop) => { e.currentTarget.setPointerCapture(e.pointerId); trayDrag.current = { d, x0: e.clientX, y0: e.clientY, moved: false }; };
  const trayMove = (e: React.PointerEvent<HTMLButtonElement>) => { const t = trayDrag.current; if (!t) return; if (!t.moved && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 10) t.moved = true; if (t.moved) setGhost({ x: e.clientX, y: e.clientY, d: t.d }); };
  const trayUp = (e: React.PointerEvent<HTMLButtonElement>) => { const t = trayDrag.current; trayDrag.current = null; setGhost(null); if (!t) return; if (!t.moved) { add(t.d); return; } const p = pct(e.clientX, e.clientY); if (p.inside) add(t.d, p.x, p.y); };
  const tile = (d: Drop, label: string, face: React.ReactNode, key: string, say?: string) => (
    <button key={key} type="button" className="dm-tile" aria-label={`Add ${label}`} onPointerDown={(e) => trayDown(e, d)} onPointerMove={trayMove} onPointerUp={trayUp} onPointerCancel={() => { trayDrag.current = null; setGhost(null); }}>
      {face}<small>{label}</small>
      {say && <span className="dm-say" role="button" tabIndex={0} aria-label={`Hear ${say}`} onPointerDown={(e) => { e.stopPropagation(); speak(say, tts); }}>🔊</span>}
    </button>
  );

  // The word processor on the page.
  const keepSel = () => { const s = window.getSelection(); if (s && s.rangeCount && textEl.current?.contains(s.anchorNode)) savedRange.current = s.getRangeAt(0); };
  const fmt = (cmd: string, val?: string) => {
    const box = textEl.current; if (!box) return;
    box.focus(); const s = window.getSelection(); if (savedRange.current && s) { s.removeAllRanges(); s.addRange(savedRange.current); }
    document.execCommand('styleWithCSS', false, 'true'); document.execCommand(cmd, false, val);
    setPage((p) => ({ ...p, html: box.innerHTML })); keepSel();
  };
  const addPhoto = async (f: File) => { setBusy('Adding your picture...'); try { add({ kind: 'photo', src: await uploadImage(f), w: 44 }); setBusy(''); } catch { setBusy('That picture did not upload. Try again.'); window.setTimeout(() => setBusy(''), 2500); } };
  const addDrawing = async (dataUrl: string) => { setDrawing(false); setBusy('Adding your drawing...'); let src = dataUrl; try { src = await uploadImage(await (await fetch(dataUrl)).blob()); } catch { /* keep the small picture */ } add({ kind: 'drawing', src, w: 36, ar: 1 }); setBusy(''); };
  const startRec = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setBusy('This device cannot record here.'); window.setTimeout(() => setBusy(''), 2500); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const r = new MediaRecorder(stream); const chunks: Blob[] = []; r.ondataavailable = (ev) => chunks.push(ev.data);
      const t0 = Date.now();
      r.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); const secs = Math.max(1, Math.round((Date.now() - t0) / 1000)); setBusy('Saving your voice...');
        try { const src = await uploadVoiceMemo(new Blob(chunks, { type: r.mimeType || 'audio/webm' })); add({ kind: 'voice', src, text: `My voice (${secs}s)`, w: 32 }); setBusy(''); } catch { setBusy('Your voice did not save. Try again.'); window.setTimeout(() => setBusy(''), 2500); } };
      r.start(); setRec({ r, stream, t0 });
    } catch { setBusy('Allow the microphone to record.'); window.setTimeout(() => setBusy(''), 2500); }
  };
  // Talk to your pet: your words and its answer appear as talk bubbles beside it.
  const sayToPet = () => {
    const p = selected; if (!p || p.kind !== 'pet' || !talk.trim()) return;
    const said = talk.trim().slice(0, 160), reply = petAnswer(said), up = Math.max(8, p.y - 22);
    const me = add({ kind: 'bubble', from: 'me', text: said, w: 34, color: '#ffffff' }, Math.max(18, p.x - 22), up);
    add({ kind: 'bubble', from: 'pet', text: reply, w: 34, color: '#fff59d' }, Math.min(82, p.x + 22), Math.max(8, up - 6));
    const at = new Date().toISOString();
    setPage((pg) => ({ ...pg, talk: [...(pg.talk ?? []), { who: 'me', text: said, at, ...(spokeRef.current ? { spoken: true } : {}) }, { who: 'pet', text: reply, at }] }));
    spokeRef.current = false; setSel(me.id); setTalk(''); setSel(p.id);
    sayInPetVoice(reply);
  };

  // Talk out loud to the pet: what they say is written down (speech to text) and kept with the page.
  const listen = () => {
    const W = window as unknown as Record<string, unknown>; const SR = (W.SpeechRecognition ?? W.webkitSpeechRecognition) as (new () => { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }) | undefined;
    if (!SR) { setBusy('Talking is not ready on this device. Use the microphone key on the keyboard.'); window.setTimeout(() => setBusy(''), 3000); return; }
    if (listening) { recog.current?.stop(); return; }
    const r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.continuous = false;
    r.onresult = (e) => { const t = Array.from(e.results).map((x) => x[0].transcript).join(' '); setTalk(t); spokeRef.current = true; };
    r.onend = () => { setListening(false); recog.current = null; }; r.onerror = () => { setListening(false); recog.current = null; };
    recog.current = r; setListening(true); r.start();
  };
  const addComic = (id: string) => {
    const lay = COMIC_LAYOUTS.find((l) => l.id === id); if (!lay) return;
    setPage((p) => ({ ...p, items: [...p.items, ...lay.frames.map(([x, y, w, h]) => ({ id: makeId(), kind: 'frame' as const, x, y, w, h, rot: 0, z: 0 }))] }));
  };
  const tog = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const imageLike = selected && !['note', 'bubble', 'tape', 'stat', 'voice', 'frame', 'sfx', 'energy'].includes(selected.kind);
  return (
    <div className="dm dm2">
      <header className="dm-head">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <h1>{initial ? 'My page' : 'New page'}</h1>
        <div className="dm-seg dm-orient" role="radiogroup" aria-label="Page shape">
          <button type="button" role="radio" aria-checked={page.orient !== 'port'} className={page.orient !== 'port' ? 'on' : ''} onClick={() => setPage((p) => ({ ...p, orient: 'land', v: 3 }))}><span className="dm-oicon land" />Landscape</button>
          <button type="button" role="radio" aria-checked={page.orient === 'port'} className={page.orient === 'port' ? 'on' : ''} onClick={() => setPage((p) => ({ ...p, orient: 'port', v: 3 }))}><span className="dm-oicon port" />Portrait</button>
        </div>
        <button type="button" className="btn btn-primary btn-lg" disabled={!!busy} onClick={() => onSave({ ...page, html: cleanHtml(textEl.current?.innerHTML ?? page.html ?? '') })}>Save page</button>
      </header>
      <div className="dm2-body">
        <aside className="dm-side" aria-label="Things to add">
          <Category label="Feelings" color="#E5B9E0" open={!!open.feelings} onToggle={() => tog('feelings')}>
            <div className="dm-grid">{tile({ kind: 'energy', value: 2, w: 12 }, 'Energy slider', <img src={ENERGY_FACE['just right']} alt="" />, 'energy')}{todayFeeling && tile({ kind: 'feeling', src: feelingImg(todayFeeling), text: todayFeeling, w: 26 }, `Today: ${todayFeeling}`, <img src={feelingImg(todayFeeling)} alt="" />, 'today', todayFeeling)}</div>
            {FEELING_ROOTS.map((r) => (
              <div key={r.w} className="dm-subcat">
                <button type="button" className="dm-subhead" onClick={() => setSub(sub === r.w ? null : r.w)} aria-expanded={sub === r.w}><img src={feelingImg(r.w)} alt="" /><span>{r.w}</span><span aria-hidden>{sub === r.w ? '▾' : '▸'}</span></button>
                {sub === r.w && <div className="dm-grid">{ALL_FEELINGS.filter((f) => f.core === r.w).map((f) => tile({ kind: 'feeling', src: feelingImg(f.w), text: f.w, w: 26 }, f.w, <img src={feelingImg(f.w)} alt="" />, f.w, f.w))}</div>}
              </div>
            ))}
          </Category>
          <Category label="My pet" color="#FEDBC1" open={!!open.pet} onToggle={() => tog('pet')}>
            {pets.length ? <div className="dm-grid">{pets.map((p) => tile({ kind: 'pet', petId: p.id, w: 36, ar: 1 }, p.customName, <PetPortrait defId={p.petDefId} size={60} />, p.id))}</div> : <p className="dm-empty">Adopt a pet to bring it onto your pages.</p>}
          </Category>
          <Category label="Game stats" color="#C0D6F5" open={!!open.stats} onToggle={() => tog('stats')}>
            <div className="dm-grid">
              {tile({ kind: 'stat', stat: 'questions', w: 30, ar: 0.7 }, 'Questions today', <b className="dm-statchip">123</b>, 'sq')}
              {tile({ kind: 'stat', stat: 'accuracy', w: 30, ar: 1.1 }, 'Accuracy ring', <span className="dm-ringchip" />, 'sa')}
              {tile({ kind: 'stat', stat: 'correct', w: 30, ar: 0.7 }, 'Right answers', <b className="dm-statchip ok">✓</b>, 'sc')}
              {tile({ kind: 'stat', stat: 'streak', w: 30, ar: 0.7 }, 'My streak', <img src="/games/yoga/pu/star_power.png" alt="" />, 'ss')}
            </div>
            <span className="dm-sublabel">My best scores</span>
            {bests.length ? <div className="dm-grid">{bests.map((b) => tile({ kind: 'stat', stat: 'best', game: b.game, w: 30, ar: 0.75 }, `${b.name}: ${b.score}`, <b className="dm-statchip">{b.score}</b>, `best${b.game}`))}</div> : <p className="dm-empty">Play games to get best scores to brag about!</p>}
          </Category>
          <Category label="Comics" color="#FDE68A" open={!!open.comics} onToggle={() => tog('comics')}>
            <span className="dm-sublabel">Make the page a comic</span>
            <div className="dm-grid">{COMIC_LAYOUTS.map((l) => (
              <button key={l.id} type="button" className="dm-tile" onClick={() => addComic(l.id)} aria-label={`Comic layout ${l.name}`}>
                <span className="dm-layout">{l.frames.map(([x, y, w, h], k) => <i key={k} style={{ left: `${x - w / 2}%`, top: `${y - h / 2}%`, width: `${w}%`, height: `${h}%` }} />)}</span><small>{l.name}</small>
              </button>
            ))}{tile({ kind: 'frame', w: 40, h: 40, rot: 0 }, 'One frame', <span className="dm-layout"><i style={{ left: '15%', top: '15%', width: '70%', height: '70%' }} /></span>, 'frame1')}</div>
            <span className="dm-sublabel">Speech bubbles</span>
            <div className="dm-grid">{([['me', 'Talk'], ['think', 'Think'], ['shout', 'Shout'], ['whisper', 'Whisper'], ['narrate', 'Narrator box']] as [BubbleStyle, string][]).map(([f, l]) => tile({ kind: 'bubble', from: f, text: '', color: f === 'narrate' ? '#fde68a' : f === 'shout' ? '#fde047' : '#ffffff', w: 30 }, l, <span className={`dm-bubblechip ${f}`} />, `cb${f}`))}</div>
            <span className="dm-sublabel">Sound effects</span>
            <div className="dm-grid">{SFX_WORDS.map((wd, k) => tile({ kind: 'sfx', text: wd, w: 24, color: ['#facc15', '#ef4444', '#22d3ee', '#a3e635', '#f472b6', '#fb923c', '#c084fc', '#facc15'][k] }, wd, <b className="dm-sfxchip">{wd}</b>, wd))}</div>
          </Category>
          <Category label="Notes and bubbles" color="#FBF2BB" open={!!open.notes} onToggle={() => tog('notes')}>
            <div className="dm-grid">
              {NOTE_COLORS.map((c) => tile({ kind: 'note', text: '', color: c, w: 36 }, 'Sticky note', <span className="dm-notechip" style={{ background: c }} />, `n${c}`))}
              {tile({ kind: 'bubble', from: 'me', text: '', color: '#ffffff', w: 34 }, 'Talk bubble', <span className="dm-bubblechip" />, 'b1')}
              {tile({ kind: 'bubble', from: 'think', text: '', color: '#ffffff', w: 34 }, 'Think bubble', <span className="dm-bubblechip think" />, 'b2')}
            </div>
          </Category>
          <Category label="Washi tape" color="#F9D5E5" open={!!open.tape} onToggle={() => tog('tape')}>
            <div className="dm-grid">{TAPES.map((t) => tile({ kind: 'tape', pattern: t.id, w: 34 }, t.name, <span className="dm-tapechip" style={{ background: t.css }} />, t.id))}</div>
          </Category>
          <Category label="Stickers" color="#C5E4ED" open={!!open.stickers} onToggle={() => tog('stickers')}>
            <div className="dm-grid">{stickers.map((s, k) => tile({ kind: 'sticker', src: s.src, text: s.name, w: 18 }, s.name, <img src={s.src} alt="" />, `${s.src}${k}`))}</div>
          </Category>
          <Category label="Memes" color="#E2E8F0" open={!!open.memes} onToggle={() => tog('memes')}>
            {memes.length ? <div className="dm-grid">{memes.map((s, k) => tile({ kind: 'meme', src: s.src, text: s.name, w: 40 }, s.name, <img src={s.src} alt="" />, `${s.src}${k}`))}</div> : <p className="dm-empty">Your teacher will add memes here soon.</p>}
          </Category>
          <Category label="Photos, drawing and voice" color="#D9F99D" open={!!open.media} onToggle={() => tog('media')}>
            <div className="dm-col">
              <button type="button" className="dm-big" onClick={() => fileIn.current?.click()}>Take or pick a photo</button>
              <input ref={fileIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addPhoto(f); }} />
              <button type="button" className="dm-big" onClick={() => setDrawing(true)}>Draw a picture</button>
              {rec ? <button type="button" className="dm-big dm-rec" onClick={() => { rec.r.stop(); setRec(null); }}>Stop and add my voice</button> : <button type="button" className="dm-big" onClick={() => void startRec()}>Record my voice</button>}
            </div>
          </Category>
          <Category label="Paper" color="#EDE9FE" open={!!open.paper} onToggle={() => tog('paper')}>
            <div className="dm-grid">{PAPERS.map((c) => <button key={c} type="button" className={`dm-tile dm-paper${page.bg === c ? ' on' : ''}`} onClick={() => setPage((p) => ({ ...p, bg: c }))} aria-label="Paper color"><span style={{ background: c }} /></button>)}</div>
          </Category>
        </aside>
        <main className="dm-center">
          <div className="dm-textbar" role="toolbar" aria-label="Text" onPointerDown={(e) => e.preventDefault()}>
            <button type="button" onClick={() => fmt('bold')} aria-label="Bold"><b>B</b></button>
            <button type="button" onClick={() => fmt('italic')} aria-label="Italic"><i>I</i></button>
            <button type="button" onClick={() => fmt('underline')} aria-label="Underline"><u>U</u></button>
            <button type="button" onClick={() => fmt('fontSize', '5')} aria-label="Bigger words">A+</button>
            <button type="button" onClick={() => fmt('fontSize', '3')} aria-label="Normal words">A</button>
            <span className="dm-sep" />
            {SWATCHES.slice(0, 6).map((c) => <button key={c} type="button" className="dm-sw" style={{ background: c }} onClick={() => { setTextColor(c); fmt('foreColor', c); }} aria-label={`Text color ${c}`} />)}
            <label className="dm-wheel" aria-label="Pick any text color" style={{ background: `conic-gradient(red, yellow, lime, cyan, blue, magenta, red)` }}><input type="color" value={textColor} onChange={(e) => { setTextColor(e.target.value); fmt('foreColor', e.target.value); }} /></label>
            <span className="dm-sep" />
            <span className="dm-hl-label">Highlight</span>
            {HIGHLIGHTS.map((c) => <button key={c} type="button" className="dm-sw hl" style={{ background: c }} onClick={() => fmt('hiliteColor', c)} aria-label={`Highlight ${c}`} />)}
            <button type="button" onClick={() => fmt('hiliteColor', 'transparent')} aria-label="No highlight">✕</button>
            <span className="dm-sep" />
            <button type="button" onClick={() => speak(textOfHtml(textEl.current?.innerHTML) || 'Type about your day first.', tts)} aria-label="Read my words aloud">🔊</button>
          </div>
          <div className={`dm-stage${pathing ? ' pathing' : ''}`} onPointerDown={stageDown} onPointerMove={stageMove} onPointerUp={stageUp} onPointerCancel={stageUp} onKeyUp={keepSel} onMouseUp={keepSel} onTouchEnd={keepSel}>
            <DiaryPage page={page} selected={sel} onItemDown={itemDown} onBackDown={() => setSel(null)} pageRef={pageEl} className="dp-edit" studentId={studentId} day={day} textRef={textEl} onText={(html) => setPage((p) => (p.html === html ? p : { ...p, html }))} onItemChange={(id, patch) => upd(id, () => patch)} />
            {pathing && (
              <svg className="dm-pathsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden><polyline points={pathing.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#8a63d2" strokeWidth="0.8" strokeDasharray="2 1.5" vectorEffect="non-scaling-stroke" /></svg>
            )}
            {pathing && <p className="dm-busy" role="status">Draw the path with your finger.</p>}
            {busy && <p className="dm-busy" role="status">{busy}</p>}
          </div>
          {selected && !pathing && (
            <div className="dm-tools" role="toolbar" aria-label="Change this">
              <div className="dm-row">
                <button type="button" onClick={() => upd(selected.id, (i) => ({ w: Math.min(100, i.w * 1.15), ...(i.h ? { h: Math.min(100, i.h * 1.15) } : {}) }))}>Bigger</button>
                <button type="button" onClick={() => upd(selected.id, (i) => ({ w: Math.max(6, i.w / 1.15), ...(i.h ? { h: Math.max(6, i.h / 1.15) } : {}) }))}>Smaller</button>
                <button type="button" onClick={() => upd(selected.id, (i) => ({ rot: i.rot + 15 }))}>Turn</button>
                <button type="button" onClick={() => upd(selected.id, () => ({ z: topZ() }))}>To front</button>
                {selected.kind !== 'tape' && (
                  <div className="dm-seg" role="radiogroup" aria-label="Text around it">
                    <button type="button" role="radio" aria-checked={!selected.wrap} className={!selected.wrap ? 'on' : ''} onClick={() => upd(selected.id, () => ({ wrap: false }))}>Float over words</button>
                    <button type="button" role="radio" aria-checked={!!selected.wrap} className={selected.wrap ? 'on' : ''} onClick={() => upd(selected.id, () => ({ wrap: true }))}>Wrap words</button>
                  </div>
                )}
                <button type="button" className="dm-del" onClick={() => { setPage((p) => ({ ...p, items: p.items.filter((i) => i.id !== selected.id) })); setSel(null); }}>Remove</button>
              </div>
              <div className="dm-row">
                <span className="dm-lab">Move</span>
                {ANIMS.map(([a, l]) => <button key={l} type="button" className={(selected.anim ?? null) === a ? 'on' : ''} onClick={() => { if (a === 'path') setPathing({ id: selected.id, pts: [] }); else upd(selected.id, () => ({ anim: a, path: undefined })); }}>{l}</button>)}
              </div>
              {(selected.kind === 'note' || selected.kind === 'bubble') && (
                <div className="dm-row">
                  <textarea className="dm-notetext" value={selected.text ?? ''} placeholder="Type or talk your words" onChange={(e) => upd(selected.id, () => ({ text: e.target.value.slice(0, 280) }))} aria-label="Words" />
                  {(selected.kind === 'note' ? NOTE_COLORS : BUBBLE_COLORS).map((c) => <button key={c} type="button" className="dm-sw" style={{ background: c }} onClick={() => upd(selected.id, () => ({ color: c, textColor: c === '#2b2540' ? '#ffffff' : undefined }))} aria-label={`Color ${c}`} />)}
                  {selected.text && <button type="button" onClick={() => speak(selected.text!, tts)}>🔊</button>}
                </div>
              )}
              {imageLike && (
                <div className="dm-row">
                  <input className="dm-cap" value={selected.caption ?? ''} placeholder="Add a caption" onChange={(e) => upd(selected.id, () => ({ caption: e.target.value.slice(0, 120) }))} aria-label="Caption" />
                  {SWATCHES.slice(0, 5).map((c) => <button key={c} type="button" className="dm-sw" style={{ background: c }} onClick={() => upd(selected.id, () => ({ textColor: c }))} aria-label={`Caption color ${c}`} />)}
                </div>
              )}
              {selected.kind === 'pet' && (
                <div className="dm-row">
                  <input className="dm-cap" value={talk} placeholder={`Say something to ${pets.find((p) => p.id === selected.petId)?.customName ?? 'your pet'}`} onChange={(e) => setTalk(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sayToPet(); }} aria-label="Talk to your pet" />
                  <button type="button" className={listening ? 'dm-listening' : ''} onClick={listen} aria-label={listening ? 'Stop listening' : 'Talk out loud'}>{listening ? 'Listening...' : '🎤 Talk'}</button>
                  <button type="button" className="on" onClick={sayToPet} disabled={!talk.trim()}>Say it</button>
                </div>
              )}
              {selected.kind === 'voice' && selected.src && <div className="dm-row"><button type="button" onClick={() => { void new Audio(selected.src).play().catch(() => {}); }}>Play</button></div>}
            </div>
          )}
        </main>
      </div>
      {ghost && <div className="dm-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.d.src ? <img src={ghost.d.src} alt="" /> : <span className="dm-notechip" style={{ background: ghost.d.color ?? '#fff' }} />}</div>}
      {drawing && <PaintDesigner title="Draw for my diary" onSave={(u) => void addDrawing(u)} onClose={() => setDrawing(false)} />}
    </div>
  );
}

// ---------- My feelings charts (like Daylio): from their feelings wheel check-ins ----------
function FeelingCharts({ checkIns, name, tts, onBack }: { checkIns: { timestamp: string; zone: SelZone; emotion: string }[]; name: string; tts?: Parameters<typeof speak>[1]; onBack: () => void }) {
  const [pick, setPick] = useState<{ day: string; feel: string; zone: SelZone; energy?: string } | null>(null);
  const rows = checkIns.map((c) => ({ ...splitSelEmotion(c.emotion), zone: c.zone, at: c.timestamp }));
  // Mood pixels: the last 5 weeks, one square a day (the day's last check-in).
  const days = Array.from({ length: 35 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - (34 - k)); return d.toISOString().slice(0, 10); });
  const byDay = new Map<string, (typeof rows)[number]>(); rows.forEach((r) => byDay.set(r.at.slice(0, 10), r));
  const counts = new Map<string, number>(); rows.forEach((r) => counts.set(r.emotion, (counts.get(r.emotion) ?? 0) + 1));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6), max = top[0]?.[1] ?? 1;
  const zones = (['green', 'blue', 'yellow', 'red'] as SelZone[]).map((z) => ({ z, n: rows.filter((r) => r.zone === z).length }));
  const total = Math.max(1, rows.length);
  let acc = 0; const donut = zones.map(({ z, n }) => { const a = acc; acc += (n / total) * 360; return `${SEL_ZONE_COLORS[z]} ${a}deg ${acc}deg`; }).join(', ');
  const recent = rows.filter((r) => r.energy).slice(-14);
  const ey = (e?: string) => { const i = ENERGY_STEPS.indexOf((e ?? 'just right') as Energy); return 12 + (i < 0 ? 2 : i) * 34; };
  return (
    <div className="diary dc">
      <header className="diary-head">
        <button type="button" className="btn" onClick={onBack}>← My Diary</button>
        <h1>{name}'s feelings</h1>
      </header>
      {rows.length === 0 ? <div className="diary-empty"><p>Do the feelings wheel check-in and your charts will grow here!</p></div> : (
        <div className="dc-grid">
          <section className="dc-card">
            <h2>My mood pixels</h2>
            <div className="dc-pixels">
              {days.map((d) => { const r = byDay.get(d); return (
                <button key={d} type="button" className={`dc-px${d === todayISO() ? ' today' : ''}`} style={{ background: r ? SEL_ZONE_COLORS[r.zone] : undefined }} aria-label={r ? `${dayLabel(d)}: ${r.emotion}` : `${dayLabel(d)}: no check-in`}
                  onClick={() => { if (r) { setPick({ day: d, feel: r.emotion, zone: r.zone, energy: r.energy }); speak(`${r.emotion}`, tts); } }} />
              ); })}
            </div>
            {pick && <div className="dc-pick"><img src={feelingImg(pick.feel)} alt="" /><div><b>{pick.feel}</b><small>{dayLabel(pick.day)}{pick.energy ? `, ${pick.energy} energy` : ''}</small></div></div>}
          </section>
          <section className="dc-card">
            <h2>My top feelings</h2>
            <ul className="dc-bars">
              {top.map(([f, n], k) => (
                <li key={f}><button type="button" onClick={() => speak(`${f}: ${n} ${n === 1 ? 'time' : 'times'}`, tts)} aria-label={`${f}, ${n} times`}><img src={feelingImg(f)} alt="" /></button>
                  <span className="dc-bar"><i style={{ width: `${(n / max) * 100}%`, background: SEL_ZONE_COLORS[zoneOf(f)], animationDelay: `${k * 0.08}s` }} /></span><b>{n}</b></li>
              ))}
            </ul>
          </section>
          <section className="dc-card">
            <h2>My zones</h2>
            <div className="dc-donutwrap">
              <div className="dc-donut" style={{ background: `conic-gradient(${donut})` }}><span>{rows.length}<small>check-ins</small></span></div>
              <ul className="dc-legend">{zones.map(({ z, n }) => <li key={z}><i style={{ background: SEL_ZONE_COLORS[z] }} />{SEL_ZONE_LABELS[z]} <b>{n}</b></li>)}</ul>
            </div>
          </section>
          {recent.length > 1 && (
            <section className="dc-card">
              <h2>My energy</h2>
              <div className="dc-energy">
                <div className="dc-faces">{ENERGY_STEPS.map((e) => <img key={e} src={ENERGY_FACE[e]} alt={e} title={e} />)}</div>
                <svg viewBox={`0 0 ${recent.length * 40} 160`} preserveAspectRatio="none" role="img" aria-label="My energy at my last check-ins">
                  <polyline points={recent.map((r, k) => `${k * 40 + 20},${ey(r.energy)}`).join(' ')} fill="none" stroke="#8a63d2" strokeWidth="3" strokeLinejoin="round" />
                  {recent.map((r, k) => <circle key={k} cx={k * 40 + 20} cy={ey(r.energy)} r="7" fill={SEL_ZONE_COLORS[r.zone]} stroke="#fff" strokeWidth="2" />)}
                </svg>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
