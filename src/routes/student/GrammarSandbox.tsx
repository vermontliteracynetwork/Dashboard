import { useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { speak } from '../../components/ReadAloud';
import HelpOverlay from '../../components/HelpOverlay';
import { Whiteboard } from '../../components/ToolsPanel';
import { SANDBOX_PIECES, SANDBOX_NOUNS, SANDBOX_VERBS } from '../../lib/grammarContent';
import { GRAMMAR_WORD_CLASS_COLORS, GRAMMAR_WORD_CLASS_TEXT_COLORS, GRAMMAR_WORD_CLASS_SHAPES } from '../../types';
import type { GrammarPiece, GrammarMontessoriShape } from '../../types';
import { todayISO } from '../../lib/dates';

// Literacy Workspace — Direct teacher instruction: "proceed with only
// the open sandbox concept. no explicit activities, learning, etc. just
// open exploration." No lessons, no scoring, no completion state, no
// payout. A student drags word pieces from the left tile sidebar onto an
// open canvas; a naming word and an action word that agree in number
// "click together" on their own when dropped near each other (the one
// rule quietly enforced). Nothing here is saved between visits, same as
// the platform's existing Whiteboard tool.
//
// Layout rebuilt to match Polypad's own model (teacher's direct request,
// with a Claudia design review confirming the gap): a persistent,
// collapsible left sidebar holds every tile category, the canvas is one
// open workspace rather than a boxed card, and Word Pieces/Draw are
// compact toolbar tabs instead of full-screen mode switches. The
// sidebar's category list is data-driven (CATEGORIES below) so future
// content — Letters & Sounds (UFLI-inspired grapheme tiles), Morphemes
// (Word Web), Word Lists, Montessori grammar shapes — can slot in later
// without another layout rebuild. Only categories with real, working
// content render today; a "coming soon" tile a student can tap and get
// nothing back is a dead end, not a feature.
const TILE_W = 120;
const TILE_H = 58;
const SNAP_GAP = 14;
const SNAP_THRESHOLD = 160;
const HISTORY_LIMIT = 20;

interface PlacedPiece {
  instanceId: string;
  pieceId: string;
  x: number;
  y: number;
}

const pieceById = (id: string): GrammarPiece | undefined => SANDBOX_PIECES.find((p) => p.id === id);

// Montessori grammar-symbol shape icon — LITERACY_WORKSPACE.md's
// "Sentence Grammar tiles: Montessori shape + platform color" spec, the
// recommended next build per LITERACY_MANIPULATIVES_FEATURE_AUDIT.md.
// A second, independent visual channel alongside color and text, never
// a replacement for either (color is never the only signal for meaning).
function MontessoriShapeIcon({ shape, color }: { shape: GrammarMontessoriShape; color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true" style={{ flexShrink: 0 }}>
      {shape === 'triangle' ? <polygon points="7.5,1.5 14,13.5 1,13.5" fill={color} /> : <circle cx="7.5" cy="7.5" r="6.5" fill={color} />}
    </svg>
  );
}

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
  const shape = GRAMMAR_WORD_CLASS_SHAPES[piece.wordClass];
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
        gap: 6,
        minWidth: TILE_W,
        minHeight: TILE_H,
        padding: '6px 14px',
        borderRadius: piece.wordClass === 'noun' ? 12 : 999,
        border: glowing ? '4px solid var(--success)' : '3px solid transparent',
        background: bg,
        color: fg,
        fontFamily: "'Baloo 2', sans-serif",
        fontWeight: 800,
        fontSize: '1rem',
        cursor: 'grab',
        boxShadow: glowing ? '0 0 0 6px rgba(34,197,94,0.35)' : '2px 2px 0 rgba(31,17,71,0.2)',
        transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
        ...style,
      }}
    >
      <MontessoriShapeIcon shape={shape} color={fg} />
      {piece.text}
    </div>
  );
}

// Read-only reference pill — the Word Lists panel per LITERACY_WORKSPACE.md's
// own spec ("a scrollable reference shelf, not draggable tiles themselves —
// a lookup panel, not a mechanic"). Tapping speaks the word; nothing drags.
function WordListPill({ word, onSpeak }: { word: string; onSpeak: () => void }) {
  return (
    <button type="button" className="tag-pill" style={{ cursor: 'pointer', background: 'white' }} onClick={onSpeak}>
      🔈 {word}
    </button>
  );
}

export default function GrammarSandbox() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const student = students.find((s) => s.id === currentStudentId);
  const literacyFocusSets = useStore((s) => s.literacyFocusSets);

  const [tool, setTool] = useState<'select' | 'draw'>('select');
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInstanceRef = useRef<string | null>(null);
  const glowTimerRef = useRef<number | null>(null);
  const historyRef = useRef<PlacedPiece[][]>([]);

  if (!currentStudentId) {
    navigate('/student/login');
    return null;
  }
  if (!student) {
    // Claudia's audit: currentStudentId can point at a student that no
    // longer resolves (e.g. sync hasn't caught up yet) — this used to
    // render a blank screen with no way out. Same redirect as the
    // no-id case above it.
    navigate('/student/login');
    return null;
  }

  const pushHistory = () => {
    historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), placed];
    setCanUndo(true);
  };

  const undo = () => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const prev = hist[hist.length - 1];
    historyRef.current = hist.slice(0, -1);
    setCanUndo(historyRef.current.length > 0);
    setPlaced(prev);
  };

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
    pushHistory();
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    const instanceId = `${piece.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaced((p) => [...p, { instanceId, pieceId: piece.id, x: x - TILE_W / 2, y: y - TILE_H / 2 }]);
    dragInstanceRef.current = instanceId;
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported, drag still works via mouse move */ }
  };

  const startDragPlaced = (instanceId: string) => (e: React.PointerEvent) => {
    e.preventDefault();
    pushHistory();
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

  const today = todayISO();
  const activeFocus = literacyFocusSets.find(
    (f) => f.studentId === student.id && f.startDate <= today && today <= f.endDate,
  );
  const hasWordList = !!activeFocus && (
    activeFocus.phonicsPatterns.length > 0 || activeFocus.morphemes.length > 0 || activeFocus.practiceWords.length > 0
  );

  const readBoard = () => {
    const words = [...placed]
      .sort((a, b) => a.x - b.x)
      .map((p) => pieceById(p.pieceId)?.text)
      .filter(Boolean);
    if (words.length === 0) return;
    speak(words.join('. '), student.ttsSettings);
  };

  const clearBoard = () => {
    if (placed.length === 0) return;
    pushHistory();
    setPlaced([]);
  };

  return (
    <div className="lm-shell">
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

      {/* Left sidebar — Polypad's own persistent "Tiles" panel: every
          resource category lives here, not scattered across mode
          screens. Collapsible for small screens / more canvas room. */}
      {sidebarOpen && (
        <aside className="lm-sidebar">
          <div className="lm-sidebar-header">
            <span className="lm-sidebar-title">🧩 Literacy Manipulatives</span>
            <div className="row-wrap" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => setShowHelp(true)} aria-label="Help">🧘 Help</button>
              <button className="btn btn-sm" onClick={() => setConfirmExit(true)}>✕ Exit</button>
            </div>
          </div>

          <div className="lm-category">
            <div className="lm-category-header" style={{ background: GRAMMAR_WORD_CLASS_COLORS.noun }}>
              <span>🔤 Sentence Grammar</span>
            </div>
            <div className="lm-category-body">
              <span className="lm-category-sub">Naming words</span>
              <div className="lm-tile-list">
                {SANDBOX_NOUNS.map((p) => (
                  <GrammarPieceTile key={p.id} piece={p} style={{ width: '100%' }} onPointerDown={startDragFromTray(p)} onPointerMove={onDragMove} onPointerUp={onDragEnd} />
                ))}
              </div>
              <span className="lm-category-sub">Action words</span>
              <div className="lm-tile-list">
                {SANDBOX_VERBS.map((p) => (
                  <GrammarPieceTile key={p.id} piece={p} style={{ width: '100%' }} onPointerDown={startDragFromTray(p)} onPointerMove={onDragMove} onPointerUp={onDragEnd} />
                ))}
              </div>
            </div>
          </div>

          {/* Word Lists — Literacy Workspace Phase 2 (LITERACY_WORKSPACE.md):
              a scrollable reference shelf pulling the student's current
              week's phonics/morpheme/spelling focus (set by the teacher in
              Student Manager), NOT draggable tiles — a lookup panel, not a
              mechanic. Only renders when there's an active focus with real
              content, same guard SubjectDashboard's Focus Banner uses. */}
          {hasWordList && activeFocus && (
            <div className="lm-category">
              <div className="lm-category-header" style={{ background: 'var(--purple)', color: '#fff' }}>
                <span>📚 Word Lists</span>
              </div>
              <div className="lm-category-body">
                {activeFocus.phonicsPatterns.length > 0 && (
                  <>
                    <span className="lm-category-sub">Phonics patterns</span>
                    <div className="row-wrap" style={{ gap: 6 }}>
                      {activeFocus.phonicsPatterns.map((p) => (
                        <WordListPill key={`p-${p}`} word={p} onSpeak={() => speak(p, student.ttsSettings)} />
                      ))}
                    </div>
                  </>
                )}
                {activeFocus.morphemes.length > 0 && (
                  <>
                    <span className="lm-category-sub">Word parts</span>
                    <div className="row-wrap" style={{ gap: 6 }}>
                      {activeFocus.morphemes.map((m) => (
                        <WordListPill key={`m-${m}`} word={m} onSpeak={() => speak(m, student.ttsSettings)} />
                      ))}
                    </div>
                  </>
                )}
                {activeFocus.practiceWords.length > 0 && (
                  <>
                    <span className="lm-category-sub">Spelling words</span>
                    <div className="row-wrap" style={{ gap: 6 }}>
                      {activeFocus.practiceWords.map((w) => (
                        <WordListPill key={`w-${w}`} word={w} onSpeak={() => speak(w, student.ttsSettings)} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Reserved for future categories (Letters & Sounds / UFLI
              grapheme tiles, Morphemes Word Web, Montessori grammar
              shapes) — deliberately not rendered yet. A tile a student
              can tap that does nothing is a dead end, not a placeholder;
              these ship as soon as there's real content behind them. */}
        </aside>
      )}

      <div className="lm-main">
        {/* Compact always-visible toolbar — tools you pick, not full
            screens you switch into. Matches Polypad's floating toolbar
            model while keeping every control icon+text per this
            platform's standing accessibility rule (Polypad's own
            toolbar is icon-only; that part is intentionally not
            copied). */}
        <div className="lm-toolbar">
          <button className="btn btn-sm" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? 'Hide tile list' : 'Show tile list'}>
            {sidebarOpen ? '⟨⟨ Tiles' : '⟩⟩ Tiles'}
          </button>
          <span className="lm-toolbar-divider" />
          <button className={`btn btn-sm ${tool === 'select' ? 'btn-primary' : ''}`} onClick={() => setTool('select')}>🔤 Words</button>
          <button className={`btn btn-sm ${tool === 'draw' ? 'btn-primary' : ''}`} onClick={() => setTool('draw')}>🎨 Draw</button>
          <span className="lm-toolbar-divider" />
          <button className="btn btn-sm" onClick={undo} disabled={!canUndo}>↩️ Undo</button>
          <button className="btn btn-sm" onClick={readBoard} disabled={placed.length === 0}>🔈 Read board</button>
          <button className="btn btn-sm" onClick={clearBoard} disabled={placed.length === 0}>🗑️ Clear</button>
        </div>

        {tool === 'draw' ? (
          <div className="lm-canvas">
            <Whiteboard student={student} />
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="lm-canvas"
            style={{ position: 'relative' }}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
          >
            {placed.length === 0 && (
              <p style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', margin: 0, padding: 40, fontWeight: 700, color: 'var(--ink)', opacity: 0.4, pointerEvents: 'none' }}>
                Drag words from the left onto the board and build something silly!
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
        )}
      </div>
    </div>
  );
}
