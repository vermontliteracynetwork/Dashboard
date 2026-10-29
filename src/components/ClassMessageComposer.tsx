import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/store';
import ImageUploadField from './ImageUploadField';
import ClassMessagePopup from './ClassMessagePopup';
import { MSG_SIZES, TEXT_SIZES, refreshSeen, showTime, useClassMessages, useSeenCount, type ClassMessage, type MsgBlock, type MsgSize, type MsgWhen } from '../lib/classMessage';

// Build Queue 439 and 440: the teacher's message builder. Drag a Text box or an Image from the left into the message (or
// tap it to add it at the end, for the iPad), drag fields to reorder them (or use the arrows), pick the pop up size, each
// text box's size, the button's words, who gets it (everyone or single students) and when it pops up (next check in,
// right now, an exact time, or in a few minutes, interrupting games or waiting until the game is done), with a live
// preview before sending. Sent messages are listed with who has read them, and can be stopped.
const uid = () => Math.random().toString(36).slice(2, 9);
const newBlock = (kind: 'text' | 'image'): MsgBlock => (kind === 'text' ? { id: uid(), kind, text: '', size: 'm', align: 'center' } : { id: uid(), kind, src: '', alt: '', width: 'medium' });
const WHEN: { id: MsgWhen; label: string }[] = [
  { id: 'checkin', label: 'Next check in' }, { id: 'now', label: 'Right now' }, { id: 'at', label: 'At a time' }, { id: 'in', label: 'In a few minutes' },
];
const nextAt = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const d = new Date(); d.setHours(h || 0, m || 0, 0, 0); if (d.getTime() < Date.now() - 60000) d.setDate(d.getDate() + 1); return d; };

// The preview shows the pop up on a pretend iPad screen (1024 by 768), scaled down to fit, so every size looks true.
function Stage({ msg }: { msg: ClassMessage }) {
  const ref = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(0.4);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setK(Math.min(1, el.clientWidth / 1024)));
    ro.observe(el); return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="cmc-stage" style={{ height: 768 * k }}>
      <div className="cmc-screen" style={{ transform: `scale(${k})` }}><ClassMessagePopup msg={msg} preview /></div>
    </div>
  );
}

function SentRow({ m, names, onStop }: { m: ClassMessage; names: string; onStop: () => void }) {
  const read = useSeenCount(m.id);
  const first = m.blocks.find((b) => b.kind === 'text');
  const whenText = (m.when ?? 'checkin') === 'checkin' ? 'next check in' : `${new Date(showTime(m)).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}${m.interrupt ? ', interrupts games' : ', after games'}`;
  return (
    <li className="cmc-sentrow">
      <span><b>{first && first.kind === 'text' ? first.text.slice(0, 60) || 'Picture message' : 'Picture message'}</b><small>To {names} · {whenText} · read by {read}</small></span>
      <button type="button" className="btn btn-sm" onClick={onStop}>Stop</button>
    </li>
  );
}

export default function ClassMessageComposer({ onClose }: { onClose: () => void }) {
  const students = useStore((s) => s.students);
  const { msgs, add, remove } = useClassMessages();
  const [size, setSize] = useState<MsgSize>('medium');
  const [blocks, setBlocks] = useState<MsgBlock[]>([newBlock('text')]);
  const [button, setButton] = useState('Got it!');
  const [to, setTo] = useState<string[]>([]);
  const [when, setWhen] = useState<MsgWhen>('checkin');
  const [at, setAt] = useState('12:00');
  const [mins, setMins] = useState(3);
  const [interrupt, setInterrupt] = useState(false);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  useEffect(() => { void refreshSeen(); }, []);
  const draft: ClassMessage = { id: 'draft', size, blocks, button, to, sentAt: '' };
  const upd = (id: string, patch: Partial<MsgBlock>) => setBlocks((bs) => bs.map((b) => (b.id === id ? ({ ...b, ...patch } as MsgBlock) : b)));
  const move = (from: number, toIdx: number) => setBlocks((bs) => { const c = [...bs]; const [m] = c.splice(from, 1); c.splice(Math.max(0, Math.min(c.length, toIdx)), 0, m); return c; });
  const onDrop = (e: React.DragEvent, atIdx: number) => {
    e.preventDefault(); setDragOver(null);
    const kind = e.dataTransfer.getData('cm/new'), idx = e.dataTransfer.getData('cm/move');
    if (kind === 'text' || kind === 'image') setBlocks((bs) => { const c = [...bs]; c.splice(atIdx, 0, newBlock(kind)); return c; });
    else if (idx !== '') { const f = Number(idx); move(f, f < atIdx ? atIdx - 1 : atIdx); }
  };
  const ready = blocks.some((b) => (b.kind === 'text' ? b.text.trim() : b.src));
  const nameList = (ids?: string[]) => (!ids?.length ? 'all students' : ids.map((id) => students.find((s) => s.id === id)?.name ?? 'a student').join(', '));
  const doSend = () => {
    if (!ready) return;
    const showAt = when === 'at' ? nextAt(at).toISOString() : when === 'in' ? new Date(Date.now() + mins * 60000).toISOString() : undefined;
    const pick = to.length && to.length < students.length ? to : undefined;
    add({ id: uid(), size, blocks: blocks.filter((b) => (b.kind === 'text' ? b.text.trim() : b.src)), button: button.trim() || 'Got it!', to: pick, sentAt: new Date().toISOString(), when, showAt, interrupt: when === 'checkin' ? undefined : interrupt });
    setSent(when === 'checkin' ? `Sent to ${nameList(pick)}. They see it after their next check in, before the streak.`
      : `Sent to ${nameList(pick)}. It pops up ${when === 'now' ? 'within about 20 seconds' : when === 'at' ? `at ${nextAt(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : `in ${mins} ${mins === 1 ? 'minute' : 'minutes'}`}${interrupt ? ', even in the middle of a game' : ', as soon as their game is done'}.`);
    setBlocks([newBlock('text')]);
  };
  return createPortal(
    <div className="pf-overlay cmc-wrap" onClick={onClose}>
      <div className="pf-panel cmc" role="dialog" aria-label="Message my students" onClick={(e) => e.stopPropagation()}>
        <header className="cmc-head">
          <h2>Message my students</h2>
          <button type="button" className="btn" onClick={onClose}>Close</button>
        </header>
        <div className="cmc-grid">
          <aside className="cmc-tools">
            <b>Fields</b>
            <small>Drag into the message, or tap to add</small>
            {(['text', 'image'] as const).map((k) => (
              <button key={k} type="button" className="cmc-tool" draggable onDragStart={(e) => e.dataTransfer.setData('cm/new', k)} onClick={() => setBlocks((bs) => [...bs, newBlock(k)])}>
                {k === 'text' ? 'Text box' : 'Image'}
              </button>
            ))}
            <b>Pop up size</b>
            <div className="cmc-seg">{MSG_SIZES.map((s) => <button key={s.id} type="button" className={size === s.id ? 'on' : ''} onClick={() => setSize(s.id)}>{s.label}</button>)}</div>
            <label className="cmc-field"><b>Button words</b><input className="input" value={button} maxLength={40} onChange={(e) => setButton(e.target.value)} placeholder="Got it!" /></label>
            <b>When it pops up</b>
            <div className="cmc-seg">{WHEN.map((w) => <button key={w.id} type="button" className={when === w.id ? 'on' : ''} onClick={() => setWhen(w.id)}>{w.label}</button>)}</div>
            {when === 'at' && <label className="cmc-field"><span>Time</span><input className="input" type="time" value={at} onChange={(e) => setAt(e.target.value)} /></label>}
            {when === 'in' && <label className="cmc-field"><span>Minutes from now</span><input className="input" type="number" min={1} max={120} value={mins} onChange={(e) => setMins(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} /></label>}
            {when !== 'checkin' && (
              <div className="cmc-to">
                <label className={`fm-row${interrupt ? ' on' : ''}`}><input type="radio" checked={interrupt} onChange={() => setInterrupt(true)} /> Interrupt all game play</label>
                <label className={`fm-row${!interrupt ? ' on' : ''}`}><input type="radio" checked={!interrupt} onChange={() => setInterrupt(false)} /> Wait until their game is done</label>
              </div>
            )}
            <b>Send to</b>
            <div className="cmc-to">
              <label className={`fm-row${!to.length ? ' on' : ''}`}><input type="checkbox" checked={!to.length} onChange={() => setTo([])} /> All students</label>
              {students.map((st) => <label key={st.id} className={`fm-row${to.includes(st.id) ? ' on' : ''}`}><input type="checkbox" checked={to.includes(st.id)} onChange={() => setTo((t) => (t.includes(st.id) ? t.filter((x) => x !== st.id) : [...t, st.id]))} /> {st.name}</label>)}
            </div>
          </aside>
          <section className="cmc-canvas" onDragOver={(e) => { e.preventDefault(); setDragOver(blocks.length); }} onDragLeave={() => setDragOver(null)} onDrop={(e) => onDrop(e, blocks.length)}>
            <b>The message</b>
            {blocks.length === 0 && <p className="cmc-empty">Drag a Text box or an Image here.</p>}
            {blocks.map((b, i) => (
              <div key={b.id} className={`cmc-block${dragOver === i ? ' over' : ''}`} draggable onDragStart={(e) => e.dataTransfer.setData('cm/move', String(i))}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(i); }} onDrop={(e) => { e.stopPropagation(); onDrop(e, i); }}>
                <div className="cmc-bar">
                  <span className="cmc-grip" aria-hidden>⋮⋮</span>
                  <b>{b.kind === 'text' ? 'Text box' : 'Image'}</b>
                  <button type="button" className="btn btn-sm" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="Move up">↑</button>
                  <button type="button" className="btn btn-sm" disabled={i === blocks.length - 1} onClick={() => move(i, i + 1)} aria-label="Move down">↓</button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => setBlocks((bs) => bs.filter((x) => x.id !== b.id))}>Remove</button>
                </div>
                {b.kind === 'text' ? (<>
                  <textarea className="input" rows={3} value={b.text} onChange={(e) => upd(b.id, { text: e.target.value })} placeholder="Type your message" />
                  <div className="cmc-row">
                    <div className="cmc-seg">{TEXT_SIZES.map((t) => <button key={t.id} type="button" className={b.size === t.id ? 'on' : ''} onClick={() => upd(b.id, { size: t.id })}>{t.label}</button>)}</div>
                    <div className="cmc-seg">{(['left', 'center'] as const).map((a) => <button key={a} type="button" className={b.align === a ? 'on' : ''} onClick={() => upd(b.id, { align: a })}>{a === 'left' ? 'Left' : 'Center'}</button>)}</div>
                  </div>
                </>) : (<>
                  <ImageUploadField label="Picture (drag a file here or tap to choose)" value={b.src} onChange={(src) => upd(b.id, { src })} altValue={b.alt} onAltChange={(alt) => upd(b.id, { alt })} />
                  <div className="cmc-seg">{(['small', 'medium', 'full'] as const).map((w) => <button key={w} type="button" className={b.width === w ? 'on' : ''} onClick={() => upd(b.id, { width: w })}>{w === 'small' ? 'Small' : w === 'medium' ? 'Medium' : 'Full width'}</button>)}</div>
                </>)}
              </div>
            ))}
          </section>
          <section className="cmc-preview">
            <b>Preview</b>
            <Stage msg={draft} />
            {msgs.length > 0 && <>
              <b>Sent messages</b>
              <ul className="cmc-sent-list">{[...msgs].reverse().map((m) => <SentRow key={m.id} m={m} names={nameList(m.to)} onStop={() => remove(m.id)} />)}</ul>
            </>}
          </section>
        </div>
        <footer className="cmc-foot">
          {sent ? <span className="cmc-sent">{sent}</span> : <span>Each student sees a message once.</span>}
          <button type="button" className="btn btn-primary btn-lg" disabled={!ready} onClick={doSend}>Send</button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
