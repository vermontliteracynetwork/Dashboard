import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { SymbolPos } from '../types';
import { SYMBOLS } from '../lib/symbolSentence';
import SymbolTip from './SymbolTip';

// The Grammar Symbols and Punctuation panel beside a symbol sentence (Build Queue 494, from her question set mockups;
// 495 took out the word bubble type picker and the symbol search). The same panel is on the student's question and on
// the teacher's builder. Tap a symbol to use it, or drag it onto a box with a finger (pointer events, so it works on an
// iPad); when a tap has nothing to fill, it shows what the symbol means instead.
export const PALETTE: SymbolPos[] = ['noun', 'propernoun', 'article', 'adjective', 'verb', 'preposition', 'adverb', 'pronoun', 'conjunction', 'interjection'];
export const MARKS = ['.', '!', '?'] as const;
export const MARK_NAME: Record<string, string> = { '.': 'period', '!': 'exclamation point', '?': 'question mark' };

type Press = { pos: SymbolPos; x: number; y: number; moved: boolean };

export default function SymbolPanel({ onPick, onMark, onDrop, disabled = false, tts }: {
  // Return false when the tap had nothing to fill, and the panel shows the symbol's meaning.
  onPick: (pos: SymbolPos) => boolean;
  onMark: (mark: string) => void;
  onDrop: (pos: SymbolPos, slot: number) => void;
  disabled?: boolean;
  tts?: (text: string) => void;
}) {
  const [openSym, setOpenSym] = useState(true);
  const [openMarks, setOpenMarks] = useState(true);
  const [ghost, setGhost] = useState<{ pos: SymbolPos; x: number; y: number } | null>(null);
  const [tip, setTip] = useState<{ el: HTMLElement; pos: SymbolPos } | null>(null);
  const press = useRef<Press | null>(null);
  const over = useRef<Element | null>(null);
  const skipClick = useRef(false);

  // A tip opened by a tap closes on the next tap anywhere else.
  useEffect(() => {
    if (!tip) return;
    const close = (e: PointerEvent) => { if (!tip.el.contains(e.target as Node)) setTip(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [tip]);

  // A box, or (in the builder, Build Queue 509) anywhere on the sentence to add a new box there.
  const slotAt = (x: number, y: number) => { const el = document.elementFromPoint(x, y); return el?.closest('[data-ssq-slot]') ?? el?.closest('[data-ssq-drop]') ?? null; };
  const mark = (el: Element | null) => {
    if (over.current === el) return;
    over.current?.classList.remove('drop-over');
    el?.classList.add('drop-over');
    over.current = el;
  };
  const down = (e: React.PointerEvent<HTMLButtonElement>, pos: SymbolPos) => {
    if (disabled || e.button > 0) return;
    press.current = { pos, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const p = press.current; if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
    p.moved = true;
    setGhost({ pos: p.pos, x: e.clientX, y: e.clientY });
    mark(slotAt(e.clientX, e.clientY));
  };
  const up = (e: React.PointerEvent) => {
    const p = press.current; press.current = null;
    if (!p) return;
    if (p.moved) {
      // The click that may follow a drag is not a tap; it is cleared right after in case no click comes.
      skipClick.current = true; window.setTimeout(() => { skipClick.current = false; }, 0);
      const el = slotAt(e.clientX, e.clientY);
      const at = el ? (el.hasAttribute('data-ssq-slot') ? Number(el.getAttribute('data-ssq-slot')) : -1) : NaN;
      if (Number.isFinite(at)) onDrop(p.pos, at);
    }
    mark(null); setGhost(null);
  };
  const cancel = () => { press.current = null; mark(null); setGhost(null); };
  const tap = (e: React.MouseEvent<HTMLButtonElement>, pos: SymbolPos) => {
    if (skipClick.current) { skipClick.current = false; return; }
    if (disabled) return;
    if (!onPick(pos)) { setTip({ el: e.currentTarget, pos }); tts?.(`${SYMBOLS[pos].name}: ${SYMBOLS[pos].def}`); }
  };

  return (
    <aside className="ssq-panel" aria-label="Grammar symbols and punctuation">
      <section className={`ssq-box ssq-box-sym${openSym ? ' open' : ''}`}>
        <button type="button" className="ssq-box-head" aria-expanded={openSym} onClick={() => setOpenSym((o) => !o)}>
          <span>Grammar Symbols</span><i aria-hidden>▾</i>
        </button>
        {openSym && (
          <div className="ssq-pal-grid">
            {PALETTE.map((pos) => {
              const info = SYMBOLS[pos];
              return (
                <button key={pos} type="button" className="ssq-pal" disabled={disabled} aria-label={`${info.name}: ${info.def}`}
                  onPointerDown={(e) => down(e, pos)} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onClick={(e) => tap(e, pos)}
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse') setTip({ el: e.currentTarget, pos }); }} onPointerLeave={(e) => { if (e.pointerType === 'mouse') setTip(null); }}>
                  <img src={info.img} alt="" draggable={false} />
                  <span>{info.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>
      <section className={`ssq-box ssq-box-marks${openMarks ? ' open' : ''}`}>
        <button type="button" className="ssq-box-head" aria-expanded={openMarks} onClick={() => setOpenMarks((o) => !o)}>
          <span>Punctuation</span><i aria-hidden>▾</i>
        </button>
        {openMarks && (
          <div className="ssq-mark-grid">
            {MARKS.map((m) => <button key={m} type="button" className="ssq-mark-btn" disabled={disabled} aria-label={MARK_NAME[m]} onClick={() => onMark(m)}>{m}</button>)}
          </div>
        )}
      </section>
      {tip && <SymbolTip anchor={tip.el} name={SYMBOLS[tip.pos].name} def={SYMBOLS[tip.pos].def} />}
      {ghost && createPortal(<img className="ssq-ghost" src={SYMBOLS[ghost.pos].img} alt="" style={{ left: ghost.x, top: ghost.y }} />, document.body)}
    </aside>
  );
}
