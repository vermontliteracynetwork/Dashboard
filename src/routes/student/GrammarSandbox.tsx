import { useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { speak } from '../../components/ReadAloud';
import HelpOverlay from '../../components/HelpOverlay';
import { Whiteboard } from '../../components/ToolsPanel';
import { SANDBOX_PIECES, SANDBOX_NOUNS, SANDBOX_VERBS } from '../../lib/grammarContent';
import { GRAMMAR_WORD_CLASS_COLORS, GRAMMAR_WORD_CLASS_TEXT_COLORS } from '../../types';
import type { GrammarPiece } from '../../types';

// Literacy Workspace — Direct teacher instruction: "proceed with only
// the open sandbox concept. no explicit activities, learning, etc. just
// open exploration." This replaces the earlier Phase 1 Explicit
// Instruction build (fixed rung, mastery tracking, rewards) entirely —
// no lessons, no scoring, no completion state, no payout. A student
// drags word pieces from the tray onto an open canvas; a naming word and
// an action word that agree in number "click together" on their own
// when dropped near each other (the one rule quietly enforced), same
// mechanic the very first brief for this feature asked for: "visual
// puzzle pieces of words and morphemes can combine and click into each
// other if a correct sentence is used." Nothing here is saved between
// visits, same as the platform's existing Whiteboard tool ("Just for
// scratch work, not saved") — this is a toy to play with, not a task to
// finish.
const TILE_W = 130;
const TILE_H = 64;
const SNAP_GAP = 14;
const SNAP_THRESHOLD = 160;

interface PlacedPiece {
  instanceId: string;
  pieceId: string;
  x: number;
  y: number;
}

const pieceById = (id: string): GrammarPiece | undefined => SANDBOX_PIECES.find((p) => p.id === id);

function GrammarPieceTile({ piece, style, onPointerDown, onPointerMove, onPointerUp, glowing }: {
  piece: GrammarPiece;
  style: CSSProperties;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  glowing?: boolean;
}) {
  const bg = GRAMMAR_WORD_CLASS_COLORS[piece.wordClass];
  const fg = GRAMMAR_WORD_CLASS_TEXT_COLORS[piece.wordClass];
  return (
    <div
      role="button"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        touchAction: 'none',
        userSelect: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: TILE_W,
        minHeight: TILE_H,
        padding: '6px 16px',
        borderRadius: piece.wordClass === 'noun' ? 14 : 999,
        border: glowing ? '4px solid var(--success)' : '4px solid transparent',
        background: bg,
        color: fg,
        fontFamily: "'Baloo 2', sans-serif",
        fontWeight: 800,
        fontSize: '1.05rem',
        cursor: 'grab',
        boxShadow: glowing ? '0 0 0 6px rgba(34,197,94,0.35)' : '2px 2px 0 rgba(31,17,71,0.25)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
    >
      {piece.text}
    </div>
  );
}

export default function GrammarSandbox() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const student = students.find((s) => s.id === currentStudentId);

  const [mode, setMode] = useState<'move' | 'draw'>('move');
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInstanceRef = useRef<string | null>(null);
  const glowTimerRef = useRef<number | null>(null);

  if (!currentStudentId) {
    navigate('/student/login');
    return null;
  }
  if (!student) return null;

  const canvasRelative = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Snap check: a dropped/moved piece looks for the nearest OTHER piece
  // of the opposite word class whose number agrees — that's the whole
  // rule. Word choice, order, and how silly the result is are entirely
  // up to the student.
  const runSnapCheck = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      const draggedPiece = dragged && pieceById(dragged.pieceId);
      if (!dragged || !draggedPiece) return current;

      let bestId: string | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const other of current) {
        if (other.instanceId === instanceId) continue;
        const otherPiece = pieceById(other.pieceId);
        if (!otherPiece || otherPiece.wordClass === draggedPiece.wordClass || otherPiece.number !== draggedPiece.number) continue;
        const dist = Math.hypot(other.x - dragged.x, other.y - dragged.y);
        if (dist < bestDist) { bestDist = dist; bestId = other.instanceId; }
      }
      if (!bestId) return current;

      const other = current.find((p) => p.instanceId === bestId)!;
      const nounEntry = draggedPiece.wordClass === 'noun' ? dragged : other;
      const verbEntry = draggedPiece.wordClass === 'verb' ? dragged : other;

      if (glowTimerRef.current) window.clearTimeout(glowTimerRef.current);
      setGlowIds(new Set([nounEntry.instanceId, verbEntry.instanceId]));
      glowTimerRef.current = window.setTimeout(() => setGlowIds(new Set()), 900);

      return current.map((p) => (p.instanceId === verbEntry.instanceId ? { ...p, x: nounEntry.x + TILE_W + SNAP_GAP, y: nounEntry.y } : p));
    });
  };

  const startDragFromTray = (piece: GrammarPiece) => (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    const instanceId = `${piece.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaced((p) => [...p, { instanceId, pieceId: piece.id, x: x - TILE_W / 2, y: y - TILE_H / 2 }]);
    dragInstanceRef.current = instanceId;
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported, drag still works via mouse move */ }
  };

  const startDragPlaced = (instanceId: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragInstanceRef.current = instanceId;
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };

  const onDragMove = (e: React.PointerEvent) => {
    const id = dragInstanceRef.current;
    if (!id) return;
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    setPlaced((p) => p.map((pp) => (pp.instanceId === id ? { ...pp, x: x - TILE_W / 2, y: y - TILE_H / 2 } : pp)));
  };

  const onDragEnd = () => {
    const id = dragInstanceRef.current;
    dragInstanceRef.current = null;
    if (id) runSnapCheck(id);
  };

  const readBoard = () => {
    const words = [...placed]
      .sort((a, b) => a.x - b.x)
      .map((p) => pieceById(p.pieceId)?.text)
      .filter(Boolean);
    if (words.length === 0) return;
    speak(words.join('. '), student.ttsSettings);
  };

  return (
    <div className="container stack">
      {showHelp && <HelpOverlay studentId={student.id} onClose={() => setShowHelp(false)} />}
      {confirmExit && (
        <div className="overlay-backdrop" onClick={() => setConfirmExit(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>Leave Literacy Manipulatives?</h2>
              <p style={{ margin: 0 }}>Your board isn't saved. Leaving will clear it.</p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/student/home')}>Yes, go home</button>
                <button className="btn btn-lg" onClick={() => setConfirmExit(false)}>Keep playing</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--yellow), var(--pink))' }}>
        <h2 style={{ margin: 0 }}>🧩 Literacy Manipulatives</h2>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setShowHelp(true)} aria-label="Help">🧘 Help</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmExit(true)}>✕ Exit</button>
        </div>
      </div>

      {/* Mode toggle: Move Pieces (the open word canvas) vs Draw (the
          existing Whiteboard tool, reused as-is so owned Marketplace
          pens apply here too, per direct teacher instruction). */}
      <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
        <button
          className={`btn btn-lg ${mode === 'move' ? 'btn-primary' : ''}`}
          style={{ minHeight: 48 }}
          onClick={() => setMode('move')}
        >
          🔤 Word Pieces
        </button>
        <button
          className={`btn btn-lg ${mode === 'draw' ? 'btn-primary' : ''}`}
          style={{ minHeight: 48 }}
          onClick={() => setMode('draw')}
        >
          🎨 Draw
        </button>
      </div>

      {mode === 'draw' ? (
        <div className="grammar-board">
          <div className="grammar-board-surface" style={{ minHeight: 460 }}>
            <Whiteboard student={student} />
          </div>
        </div>
      ) : (
        <div className="grammar-board">
          {/* Open canvas — no sockets, no target, no right/wrong. Any
              naming word dropped near an action word that agrees in
              number clicks together on its own. */}
          <div
            ref={canvasRef}
            className="grammar-board-surface"
            style={{ position: 'relative', minHeight: 380, padding: 0, overflow: 'hidden' }}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            {placed.length === 0 && (
              <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', margin: 0, padding: 40, fontWeight: 700, color: 'var(--ink)', opacity: 0.5, pointerEvents: 'none' }}>
                Drag words up here from the tray below and build something silly!
              </p>
            )}
            {placed.map((p) => {
              const piece = pieceById(p.pieceId);
              if (!piece) return null;
              return (
                <GrammarPieceTile
                  key={p.instanceId}
                  piece={piece}
                  glowing={glowIds.has(p.instanceId)}
                  style={{ position: 'absolute', left: p.x, top: p.y }}
                  onPointerDown={startDragPlaced(p.instanceId)}
                  onPointerMove={onDragMove}
                  onPointerUp={onDragEnd}
                />
              );
            })}
          </div>

          <div className="grammar-board-tray stack" style={{ alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Word Tray — drag any word up onto the board</span>
            <div className="row-wrap" style={{ justifyContent: 'center', maxWidth: 900 }}>
              {SANDBOX_NOUNS.map((p) => (
                <GrammarPieceTile key={p.id} piece={p} style={{}} onPointerDown={startDragFromTray(p)} onPointerMove={onDragMove} onPointerUp={onDragEnd} />
              ))}
            </div>
            <div className="row-wrap" style={{ justifyContent: 'center', maxWidth: 900 }}>
              {SANDBOX_VERBS.map((p) => (
                <GrammarPieceTile key={p.id} piece={p} style={{}} onPointerDown={startDragFromTray(p)} onPointerMove={onDragMove} onPointerUp={onDragEnd} />
              ))}
            </div>
            <div className="row-wrap" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-sm btn-blue" onClick={readBoard} disabled={placed.length === 0}>
                🔈 Read my board
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setPlaced([])} disabled={placed.length === 0}>
                🗑️ Clear board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
