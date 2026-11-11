import { Suspense, lazy, useEffect, useRef } from 'react';
import { TAPES, cleanHtml, type DiaryItem, type DiaryPageData } from '../lib/diaryBook';
import { useStore } from '../store/store';
import { petDefById } from '../lib/petCatalog';
import { AGE_SCALE, ageForTraining } from '../lib/petsV2';
import { useStreak } from '../lib/streak';
import { dayOwner } from '../lib/questionMastery';
import { PetPortrait } from '../routes/student/PetFinder';
import { speak } from './ReadAloud';

const PetStage3D = lazy(() => import('./PetStage3D'));

// Build Queue 577 and 578: one scrapbook page, drawn from its items over a typed text layer. Used read only (old pages,
// the SEL team report) and inside the editor (with onItemDown, selected and the editable text). Sizes are in container
// units, so a small preview looks exactly like the full page. `lite` (shelf previews, the report) shows the pet as a
// picture instead of the live 3D pet.
export default function DiaryPage({ page, selected, onItemDown, onBackDown, className = '', pageRef, lite, studentId, day, textRef, onText }: {
  page: DiaryPageData; selected?: string | null; className?: string;
  onItemDown?: (e: React.PointerEvent<HTMLDivElement>, it: DiaryItem) => void;
  onBackDown?: () => void; pageRef?: React.Ref<HTMLDivElement>; lite?: boolean;
  studentId?: string; day?: string; textRef?: React.RefObject<HTMLDivElement | null>; onText?: (html: string) => void;
}) {
  const dark = page.bg === '#2b2540', v2 = page.v === 2, H = v2 ? 133.333 : 75;
  const editing = !!onText;
  const wraps = page.items.filter((i) => i.wrap && i.kind !== 'tape');
  return (
    <div ref={pageRef} className={`dp-page${dark ? ' dark' : ''}${v2 ? ' v2' : ''} ${className}`} style={{ background: page.bg }} onPointerDown={(e) => { if (e.target === e.currentTarget) onBackDown?.(); }}>
      {(v2 || page.html) && (
        <div className="dp-text" onPointerDown={() => onBackDown?.()}>
          {/* Wrap text: an invisible float beside each wrapped picture pushes the words around it, like a word processor. */}
          {wraps.map((it) => {
            const pad = 6, w = it.w, h = it.w * (it.ar ?? 1) + (it.caption ? 6 : 0), left = it.x - w / 2 - pad, top = (it.y / 100) * H - h / 2 - pad;
            const right = it.x >= 50;
            const style: React.CSSProperties = right
              ? { float: 'right', width: `${Math.max(0, 100 - 2 * pad - left + 2)}cqw`, height: `${Math.max(0, top + h + 2)}cqw`, shapeOutside: `inset(${Math.max(0, top - 1)}cqw 0 0 0)` }
              : { float: 'left', width: `${Math.max(0, left + w + 2)}cqw`, height: `${Math.max(0, top + h + 2)}cqw`, shapeOutside: `inset(${Math.max(0, top - 1)}cqw 0 0 ${Math.max(0, left - 1)}cqw)` };
            return <div key={`f${it.id}`} className="dp-float" style={style} aria-hidden />;
          })}
          {editing ? <EditableText html={page.html ?? ''} textRef={textRef} onText={onText!} /> : <div className="dp-words" dangerouslySetInnerHTML={{ __html: cleanHtml(page.html ?? '') }} />}
        </div>
      )}
      {[...page.items].sort((a, b) => a.z - b.z).map((it) => (
        <Item key={it.id} it={it} sel={selected === it.id} onDown={onItemDown} lite={!!lite} live={!onItemDown} studentId={studentId} day={day} H={H} />
      ))}
    </div>
  );
}

function EditableText({ html, textRef, onText }: { html: string; textRef?: React.RefObject<HTMLDivElement | null>; onText: (h: string) => void }) {
  const own = useRef<HTMLDivElement | null>(null);
  const ref = textRef ?? own;
  // Set once; after that the student's typing owns the box (re-rendering it would move the cursor).
  useEffect(() => { if (ref.current) ref.current.innerHTML = cleanHtml(html); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} className="dp-words dp-editable" contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Type about your day" data-placeholder="Tap here and type about your day..."
    onInput={(e) => onText(e.currentTarget.innerHTML)} onBlur={(e) => onText(e.currentTarget.innerHTML)} />;
}

function Item({ it, sel, onDown, lite, live, studentId, day, H }: { it: DiaryItem; sel: boolean; onDown?: (e: React.PointerEvent<HTMLDivElement>, it: DiaryItem) => void; lite: boolean; live: boolean; studentId?: string; day?: string; H: number }) {
  const el = useRef<HTMLDivElement | null>(null);
  // A drawn path (like Canva's custom animation): the item glides along it and back, over and over.
  useEffect(() => {
    if (it.anim !== 'path' || !it.path || it.path.length < 2 || !el.current) return;
    let raf = 0; const t0 = performance.now(), pts = it.path, n = pts.length - 1, dur = Math.max(1500, n * 45);
    const tick = (t: number) => {
      const k = ((t - t0) % (dur * 2)) / dur, f = (k > 1 ? 2 - k : k) * n, i = Math.min(n - 1, Math.floor(f)), r = f - i;
      const dx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * r, dy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * r;
      if (el.current) { el.current.style.left = `${it.x + dx}%`; el.current.style.top = `${it.y + dy}%`; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (el.current) { el.current.style.left = `${it.x}%`; el.current.style.top = `${it.y}%`; } };
  }, [it.anim, it.path, it.x, it.y]);
  const tape = it.kind === 'tape' ? TAPES.find((t) => t.id === it.pattern) ?? TAPES[0] : null;
  return (
    <div ref={el} className={`dp-item dp-${it.kind}${sel ? ' sel' : ''}`}
      style={{ left: `${it.x}%`, top: `${it.y}%`, width: `${it.w}%`, transform: `translate(-50%, -50%) rotate(${it.rot}deg)`, zIndex: it.z + 1 }}
      onPointerDown={onDown ? (e) => onDown(e, it) : undefined}>
      <div className={`dp-move${it.anim && it.anim !== 'path' ? ` dp-anim-${it.anim}` : ''}`}>
        {tape ? <div className="dp-tape" style={{ background: tape.css, height: `${H > 100 ? 5 : 4}cqw` }} /> : <Face it={it} live={live} lite={lite} studentId={studentId} day={day} />}
        {it.caption && it.kind !== 'tape' && it.kind !== 'note' && it.kind !== 'bubble' && <p className="dp-cap" style={{ color: it.textColor }}>{it.caption}</p>}
      </div>
    </div>
  );
}

function Face({ it, live, lite, studentId, day }: { it: DiaryItem; live: boolean; lite: boolean; studentId?: string; day?: string }) {
  if (it.kind === 'note') return (
    <div className="dp-note" style={{ background: it.color ?? '#fff59d', color: it.textColor }}>
      <p>{it.text || 'My note'}</p>
      {live && it.text && <button type="button" className="dp-say" onClick={() => speak(it.text!)} aria-label="Read my note aloud">🔊</button>}
    </div>
  );
  if (it.kind === 'bubble') return (
    <div className={`dp-bubble from-${it.from ?? 'me'}`} style={{ background: it.color ?? '#ffffff', color: it.textColor }}>
      <p>{it.text || '...'}</p>
      {live && it.text && <button type="button" className="dp-say" onClick={() => speak(it.text!)} aria-label="Read aloud">🔊</button>}
    </div>
  );
  if (it.kind === 'voice') return (
    <div className="dp-voice">
      <span aria-hidden>🎤</span><b>{it.text || 'My voice'}</b>
      {live && it.src && <button type="button" className="dp-say" onClick={() => { void new Audio(it.src).play().catch(() => {}); }} aria-label="Play my voice">▶</button>}
    </div>
  );
  if (it.kind === 'feeling') return (
    <figure className="dp-feel"><img src={it.src} alt="" draggable={false} /><figcaption>{it.text}</figcaption></figure>
  );
  if (it.kind === 'pet') return <LivePet petId={it.petId} lite={lite} />;
  if (it.kind === 'stat') return <StatWidget it={it} studentId={studentId} day={day} />;
  return <img src={it.src} alt={it.text ?? ''} draggable={false} className={it.kind === 'photo' || it.kind === 'meme' ? 'dp-framed' : ''} />;
}

// The student's own pet, live: the 3D pet doing its idle moves, gently swaying (a picture in small previews).
function LivePet({ petId, lite }: { petId?: string; lite: boolean }) {
  const pet = useStore((s) => s.pets.find((p) => p.id === petId));
  if (!pet) return <div className="dp-pet gone">My pet</div>;
  const def = petDefById(pet.petDefId);
  return (
    <div className="dp-pet">
      {lite || !def ? <div className="dp-pet-pic"><PetPortrait defId={pet.petDefId} size={200} /></div> : (
        <Suspense fallback={<div className="dp-pet-pic"><PetPortrait defId={pet.petDefId} size={200} /></div>}>
          <div className="dp-pet-3d"><PetStage3D modelPath={def.modelPath} ageScale={AGE_SCALE[ageForTraining(pet.trainingProgress)]} platform={false} yaw={-0.35} /></div>
        </Suspense>
      )}
      <span className="dp-pet-name">{pet.customName}</span>
    </div>
  );
}

// Live game stats for the page's day: they keep counting all day after they are dropped on the page.
function StatWidget({ it, studentId, day }: { it: DiaryItem; studentId?: string; day?: string }) {
  const row = useStore((s) => (studentId ? s.styleLooks.find((r) => r.ownerId === dayOwner(studentId)) : undefined));
  const streak = useStreak(studentId);
  const [right, wrong] = ((row?.look ?? {}) as Record<string, [number, number] | null>)[day ?? ''] ?? [0, 0];
  const total = right + wrong, acc = total ? Math.round((right / total) * 100) : 0;
  if (it.stat === 'accuracy') return (
    <div className="dp-stat ring">
      <div className="dp-ring" style={{ background: total ? `conic-gradient(#22c55e 0 ${acc}%, #ef4444 ${acc}% 100%)` : '#e5e7eb' }}><span><b>{acc}%</b><small>right</small></span></div>
      <small>{total ? `${right} of ${total} right` : 'No answers yet'}</small>
    </div>
  );
  const n = it.stat === 'streak' ? streak.count ?? 0 : it.stat === 'correct' ? right : total;
  const label = it.stat === 'streak' ? `day streak` : it.stat === 'correct' ? 'right answers today' : 'questions answered today';
  return (
    <div className={`dp-stat ${it.stat}`}>
      <b className="dp-stat-n" key={n}>{n}</b><small>{label}</small>
    </div>
  );
}
