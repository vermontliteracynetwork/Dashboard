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
import { DIARY_LIBRARY, PAPERS, STARTER_STICKERS, diaryOwner, type DiaryEntry, type DiaryItem, type DiaryItemKind, type DiaryLibrary, type DiaryPageData, type LibraryPic } from '../../lib/diaryBook';
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
  if (!student) return null;
  const entries = Object.entries((row?.look ?? {}) as Record<string, DiaryEntry | null>).filter((x): x is [string, DiaryEntry] => !!x[1] && !!x[1].at).sort((a, b) => (a[1].at < b[1].at ? 1 : -1));
  const mine = checkIns.filter((c) => c.studentId === student.id).sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const pet = pets.find((p) => p.studentId === student.id && p.following) ?? pets.find((p) => p.studentId === student.id);
  const first = student.name.split(' ')[0];
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const thisWeek = entries.filter(([, e]) => e.at >= weekAgo).length;

  if (view.k === 'edit') {
    const old = view.id ? entries.find(([id]) => id === view.id)?.[1] : undefined;
    const today = mine.filter((c) => c.timestamp.slice(0, 10) === todayISO()).at(-1);
    return <PageMaker initial={old ? asPage(old) : null} todayFeeling={today ? splitSelEmotion(today.emotion).emotion : null} lib={(libRow?.look ?? {}) as DiaryLibrary} tts={student.ttsSettings}
      onCancel={() => setView(view.id ? { k: 'view', id: view.id } : { k: 'home' })}
      onSave={(page) => {
        const id = view.id ?? makeId(), at = old?.at ?? new Date().toISOString();
        const note = page.items.find((i) => i.kind === 'note' && i.text)?.text, photo = page.items.find((i) => i.kind === 'photo')?.src;
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
          <button type="button" className="btn btn-primary" onClick={() => setView({ k: 'edit', id: view.id })}>Add more</button>
        </header>
        <div className="dp-viewer">
          <button type="button" className="dp-turn" disabled={i >= entries.length - 1} onClick={() => setView({ k: 'view', id: entries[i + 1][0] })} aria-label="Older page">‹</button>
          <DiaryPage page={asPage(e)} className="dp-big" />
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
        <button type="button" className="btn" onClick={() => setView({ k: 'charts' })}>My feelings charts</button>
      </header>
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
              <DiaryPage page={asPage(e)} className="dp-mini" />
              <span>{new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}{e.feeling ? ` · ${e.feeling}` : ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- the page maker: drag things from the tray onto the page ----------
type Tab = 'feelings' | 'stickers' | 'memes' | 'photo' | 'draw' | 'voice' | 'note' | 'paper';
const TABS: { k: Tab; label: string }[] = [
  { k: 'feelings', label: 'Feelings' }, { k: 'stickers', label: 'Stickers' }, { k: 'memes', label: 'Memes' }, { k: 'photo', label: 'Photo' },
  { k: 'draw', label: 'Draw' }, { k: 'voice', label: 'Voice' }, { k: 'note', label: 'Note' }, { k: 'paper', label: 'Paper' },
];
type Drop = { kind: DiaryItemKind; src?: string; text?: string; w: number; color?: string };

function PageMaker({ initial, todayFeeling, lib, tts, onSave, onCancel }: {
  initial: DiaryPageData | null; todayFeeling: string | null; lib: DiaryLibrary; tts?: Parameters<typeof speak>[1];
  onSave: (p: DiaryPageData) => void; onCancel: () => void;
}) {
  const [page, setPage] = useState<DiaryPageData>(initial ?? { bg: PAPERS[0], items: [] });
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('feelings');
  const [core, setCore] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [drawing, setDrawing] = useState(false);
  const [rec, setRec] = useState<{ r: MediaRecorder; stream: MediaStream; t0: number } | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; d: Drop } | null>(null);
  const pageEl = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const trayDrag = useRef<{ d: Drop; x0: number; y0: number; moved: boolean } | null>(null);
  const fileIn = useRef<HTMLInputElement | null>(null);

  const stickers = useMemo(() => [...STARTER_STICKERS, ...Object.values(lib.stickers ?? {}).filter((x): x is LibraryPic => !!x)], [lib]);
  const memes = useMemo(() => Object.values(lib.memes ?? {}).filter((x): x is LibraryPic => !!x), [lib]);
  const topZ = () => page.items.reduce((m, i) => Math.max(m, i.z), 0) + 1;
  const add = (d: Drop, x = 22 + Math.random() * 56, y = 22 + Math.random() * 56) => {
    const it: DiaryItem = { id: makeId(), kind: d.kind, x, y, w: d.w, rot: Math.round((Math.random() - 0.5) * 10), z: topZ(), src: d.src, text: d.text, color: d.color };
    setPage((p) => ({ ...p, items: [...p.items, it] })); setSel(it.id);
  };
  const upd = (id: string, f: (i: DiaryItem) => Partial<DiaryItem>) => setPage((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...f(i) } : i)) }));
  const selected = page.items.find((i) => i.id === sel) ?? null;
  const pct = (cx: number, cy: number) => { const r = pageEl.current!.getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100, inside: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom }; };

  // Move things on the page with a finger.
  const itemDown = (e: React.PointerEvent<HTMLDivElement>, it: DiaryItem) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
    const p = pct(e.clientX, e.clientY); drag.current = { id: it.id, dx: p.x - it.x, dy: p.y - it.y }; setSel(it.id);
    upd(it.id, () => ({ z: topZ() }));
  };
  const pageMove = (e: React.PointerEvent) => { const d = drag.current; if (!d) return; const p = pct(e.clientX, e.clientY); upd(d.id, () => ({ x: Math.max(0, Math.min(100, p.x - d.dx)), y: Math.max(0, Math.min(100, p.y - d.dy)) })); };
  const pageUp = () => { drag.current = null; };

  // Drag from the tray onto the page, or tap a tray item to drop it in the middle.
  const trayDown = (e: React.PointerEvent<HTMLButtonElement>, d: Drop) => { e.currentTarget.setPointerCapture(e.pointerId); trayDrag.current = { d, x0: e.clientX, y0: e.clientY, moved: false }; };
  const trayMove = (e: React.PointerEvent<HTMLButtonElement>) => { const t = trayDrag.current; if (!t) return; if (!t.moved && Math.hypot(e.clientX - t.x0, e.clientY - t.y0) > 10) t.moved = true; if (t.moved) setGhost({ x: e.clientX, y: e.clientY, d: t.d }); };
  const trayUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    const t = trayDrag.current; trayDrag.current = null; setGhost(null); if (!t) return;
    if (!t.moved) { add(t.d); return; }
    const p = pct(e.clientX, e.clientY); if (p.inside) add(t.d, p.x, p.y);
  };
  const tile = (d: Drop, label: string, face: React.ReactNode, key: string, say?: string) => (
    <button key={key} type="button" className="dm-tile" aria-label={`Add ${label}`} onPointerDown={(e) => trayDown(e, d)} onPointerMove={trayMove} onPointerUp={trayUp} onPointerCancel={() => { trayDrag.current = null; setGhost(null); }}>
      {face}<small>{label}</small>
      {say && <span className="dm-say" role="button" tabIndex={0} aria-label={`Hear ${say}`} onPointerDown={(e) => { e.stopPropagation(); speak(say, tts); }}>🔊</span>}
    </button>
  );

  const addPhoto = async (f: File) => { setBusy('Adding your picture...'); try { add({ kind: 'photo', src: await uploadImage(f), w: 42 }); } catch { setBusy('That picture did not upload. Try again.'); window.setTimeout(() => setBusy(''), 2500); return; } setBusy(''); };
  const addDrawing = async (dataUrl: string) => {
    setDrawing(false); setBusy('Adding your drawing...');
    let src = dataUrl; try { src = await uploadImage(await (await fetch(dataUrl)).blob()); } catch { /* keep the small picture itself */ }
    add({ kind: 'drawing', src, w: 34 }); setBusy('');
  };
  const startRec = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setBusy('This device cannot record here.'); window.setTimeout(() => setBusy(''), 2500); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const r = new MediaRecorder(stream); const chunks: Blob[] = []; r.ondataavailable = (ev) => chunks.push(ev.data);
      r.onstop = async () => { stream.getTracks().forEach((t) => t.stop()); const secs = Math.max(1, Math.round((Date.now() - t0) / 1000)); setBusy('Saving your voice...');
        try { const src = await uploadVoiceMemo(new Blob(chunks, { type: r.mimeType || 'audio/webm' })); add({ kind: 'voice', src, text: `My voice (${secs}s)`, w: 30 }); setBusy(''); } catch { setBusy('Your voice did not save. Try again.'); window.setTimeout(() => setBusy(''), 2500); } };
      const t0 = Date.now(); r.start(); setRec({ r, stream, t0 });
    } catch { setBusy('Allow the microphone to record.'); window.setTimeout(() => setBusy(''), 2500); }
  };
  const stopRec = () => { rec?.r.stop(); setRec(null); };

  const coreList = FEELING_ROOTS;
  const feelList = core ? ALL_FEELINGS.filter((f) => f.core === core) : [];
  return (
    <div className="dm">
      <header className="dm-head">
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <h1>{initial ? 'My page' : 'New page'}</h1>
        <button type="button" className="btn btn-primary btn-lg" disabled={!page.items.length || !!busy} onClick={() => onSave(page)}>Save page</button>
      </header>
      <div className="dm-main">
        <div className="dm-stage" onPointerMove={pageMove} onPointerUp={pageUp} onPointerCancel={pageUp}>
          <DiaryPage page={page} selected={sel} onItemDown={itemDown} onBackDown={() => setSel(null)} pageRef={pageEl} className="dp-edit" />
          {!page.items.length && <p className="dm-hint">Drag things from below onto your page.</p>}
          {busy && <p className="dm-busy" role="status">{busy}</p>}
        </div>
        {selected && (
          <div className="dm-tools" role="toolbar" aria-label="Change this">
            <button type="button" onClick={() => upd(selected.id, (i) => ({ w: Math.min(95, i.w * 1.2) }))}>Bigger</button>
            <button type="button" onClick={() => upd(selected.id, (i) => ({ w: Math.max(8, i.w / 1.2) }))}>Smaller</button>
            <button type="button" onClick={() => upd(selected.id, (i) => ({ rot: i.rot + 15 }))}>Turn</button>
            {selected.kind === 'note' && <button type="button" onClick={() => upd(selected.id, (i) => ({ color: NOTE_COLORS[(NOTE_COLORS.indexOf(i.color ?? NOTE_COLORS[0]) + 1) % NOTE_COLORS.length] }))}>Color</button>}
            {selected.kind === 'voice' && selected.src && <button type="button" onClick={() => { void new Audio(selected.src).play().catch(() => {}); }}>Play</button>}
            {(selected.kind === 'note' || selected.kind === 'feeling') && selected.text && <button type="button" onClick={() => speak(selected.text!, tts)}>🔊</button>}
            <button type="button" className="dm-del" onClick={() => { setPage((p) => ({ ...p, items: p.items.filter((i) => i.id !== selected.id) })); setSel(null); }}>Remove</button>
            {selected.kind === 'note' && <textarea className="dm-notetext" value={selected.text ?? ''} placeholder="Type or talk your note" onChange={(e) => upd(selected.id, () => ({ text: e.target.value.slice(0, 280) }))} aria-label="My note" />}
          </div>
        )}
        <div className="dm-tray">
          <div className="dm-tabs" role="tablist">
            {TABS.map((t) => <button key={t.k} type="button" role="tab" aria-selected={tab === t.k} className={tab === t.k ? 'on' : ''} onClick={() => setTab(t.k)}>{t.label}</button>)}
          </div>
          <div className="dm-strip">
            {tab === 'feelings' && !core && (<>
              {todayFeeling && tile({ kind: 'feeling', src: feelingImg(todayFeeling), text: todayFeeling, w: 26 }, `Today: ${todayFeeling}`, <img src={feelingImg(todayFeeling)} alt="" />, 'today', todayFeeling)}
              {coreList.map((r) => (
                <button key={r.w} type="button" className="dm-tile dm-core" onClick={() => setCore(r.w)} aria-label={`${r.w} feelings`}><img src={feelingImg(r.w)} alt="" /><small>{r.w}</small></button>
              ))}
            </>)}
            {tab === 'feelings' && core && (<>
              <button type="button" className="dm-tile dm-backtile" onClick={() => setCore(null)}>‹<small>All feelings</small></button>
              {feelList.map((f) => tile({ kind: 'feeling', src: feelingImg(f.w), text: f.w, w: 26 }, f.w, <img src={feelingImg(f.w)} alt="" style={{ outlineColor: SEL_ZONE_COLORS[f.zone] }} />, f.w, f.w))}
            </>)}
            {tab === 'stickers' && stickers.map((s, k) => tile({ kind: 'sticker', src: s.src, text: s.name, w: 18 }, s.name, <img src={s.src} alt="" />, `${s.src}${k}`))}
            {tab === 'memes' && (memes.length ? memes.map((s, k) => tile({ kind: 'meme', src: s.src, text: s.name, w: 38 }, s.name, <img src={s.src} alt="" />, `${s.src}${k}`)) : <p className="dm-empty">Your teacher will add memes here soon.</p>)}
            {tab === 'photo' && (<>
              <button type="button" className="dm-big" onClick={() => fileIn.current?.click()}>Take or pick a photo</button>
              <input ref={fileIn} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void addPhoto(f); }} />
            </>)}
            {tab === 'draw' && <button type="button" className="dm-big" onClick={() => setDrawing(true)}>Open the drawing pad</button>}
            {tab === 'voice' && (rec
              ? <button type="button" className="dm-big dm-rec" onClick={stopRec}>Stop and add</button>
              : <button type="button" className="dm-big" onClick={() => void startRec()}>Record my voice</button>)}
            {tab === 'note' && NOTE_COLORS.map((c) => tile({ kind: 'note', text: '', color: c, w: 40 }, 'Note', <span className="dm-notechip" style={{ background: c }} />, c))}
            {tab === 'paper' && PAPERS.map((c) => (
              <button key={c} type="button" className={`dm-tile dm-paper${page.bg === c ? ' on' : ''}`} onClick={() => setPage((p) => ({ ...p, bg: c }))} aria-label="Paper color"><span style={{ background: c }} /></button>
            ))}
          </div>
        </div>
      </div>
      {ghost && <div className="dm-ghost" style={{ left: ghost.x, top: ghost.y }}>{ghost.d.src ? <img src={ghost.d.src} alt="" /> : <span className="dm-notechip" style={{ background: ghost.d.color }} />}</div>}
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
