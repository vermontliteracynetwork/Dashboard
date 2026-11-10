import type { DiaryItem, DiaryPageData } from '../lib/diaryBook';
import { speak } from './ReadAloud';

// Build Queue 577: one scrapbook page, drawn from its items. Used read only (old pages, the SEL team report) and inside
// the editor (with onItemDown / selected). Sizes are in container units, so a small preview looks like the full page.
export default function DiaryPage({ page, selected, onItemDown, onBackDown, className = '', pageRef }: {
  page: DiaryPageData; selected?: string | null; className?: string;
  onItemDown?: (e: React.PointerEvent<HTMLDivElement>, it: DiaryItem) => void;
  onBackDown?: () => void; pageRef?: React.Ref<HTMLDivElement>;
}) {
  const dark = page.bg === '#2b2540';
  return (
    <div ref={pageRef} className={`dp-page${dark ? ' dark' : ''} ${className}`} style={{ background: page.bg }} onPointerDown={(e) => { if (e.target === e.currentTarget) onBackDown?.(); }}>
      {[...page.items].sort((a, b) => a.z - b.z).map((it) => (
        <div key={it.id} className={`dp-item dp-${it.kind}${selected === it.id ? ' sel' : ''}`}
          style={{ left: `${it.x}%`, top: `${it.y}%`, width: `${it.w}%`, transform: `translate(-50%, -50%) rotate(${it.rot}deg)`, zIndex: it.z }}
          onPointerDown={onItemDown ? (e) => onItemDown(e, it) : undefined}>
          <ItemFace it={it} live={!onItemDown} />
        </div>
      ))}
    </div>
  );
}

function ItemFace({ it, live }: { it: DiaryItem; live: boolean }) {
  if (it.kind === 'note') return (
    <div className="dp-note" style={{ background: it.color ?? '#fff59d' }}>
      <p>{it.text || 'My note'}</p>
      {live && it.text && <button type="button" className="dp-say" onClick={() => speak(it.text!)} aria-label="Read my note aloud">🔊</button>}
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
  return <img src={it.src} alt={it.text ?? ''} draggable={false} className={it.kind === 'photo' || it.kind === 'meme' ? 'dp-framed' : ''} />;
}
