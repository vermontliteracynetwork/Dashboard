import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { speak } from '../../components/ReadAloud';
import HelpOverlay from '../../components/HelpOverlay';
import { Whiteboard } from '../../components/ToolsPanel';
import { SANDBOX_PIECES, SANDBOX_NOUNS, SANDBOX_VERBS, MADLIB_TEMPLATES } from '../../lib/grammarContent';
import { MORPHEME_ROOTS, MORPHEME_PREFIXES, MORPHEME_SUFFIXES, MORPHEME_AFFIXES, MORPHEME_COMBOS, type MorphemeAffix } from '../../lib/morphemeContent';
import { SOUND_WORDS, WORD_SORTS, type SoundWord } from '../../lib/soundContent';
import {
  MONTESSORI_WORD_CLASS_INFO, GRAMMAR_STATES, optionWordList,
  type MontessoriWordClass, type PuzzleShape, type WordOption,
} from '../../lib/montessoriGrammar';
import {
  SENTENCE_FORMULAS, FORMULA_CATEGORIES, PROGRESSIVE_BUILD_STEPS, WHO_WORDS,
  SLOT_MONTESSORI_CLASS, SLOT_LABELS, wordBankFor, actionWordsFor, auxWordFor,
  type FormulaCategory, type FormulaSegment, type PhonicsTier,
} from '../../lib/sentenceFormulas';
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

// Toolbar mode grouping — see the toolGroupOpen state comment for why
// this exists. Select/Draw are the only two base tools always visible.
type ToolMode = 'select' | 'draw' | 'madlibs' | 'formulas' | 'web' | 'boxes' | 'blend' | 'sorts' | 'sentence' | 'matrix';
const WORDS_GROUP: { id: ToolMode; label: string }[] = [
  { id: 'web', label: '🕸️ Morpheme Web' },
  { id: 'boxes', label: '🟦 Sound Boxes' },
  { id: 'blend', label: '🧱 Blending Board' },
  { id: 'sorts', label: '🗂️ Word Sorts' },
  { id: 'matrix', label: '🧬 Word Matrix' },
];
const SENTENCES_GROUP: { id: ToolMode; label: string }[] = [
  { id: 'madlibs', label: '🎭 Mad Libs' },
  { id: 'formulas', label: '📐 Sentence Formulas' },
  { id: 'sentence', label: '🧩 Sentence Builder' },
];

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

// The full 9-shape Montessori grammar-symbol set, direct teacher request
// with real reference-sheet images — every shape/color pairing here is
// read directly off her Level 1 legend (see MONTESSORI_WORD_CLASS_INFO's
// own header comment), not invented for this build.
function PuzzleShapeIcon({ shape, color, size = 22 }: { shape: PuzzleShape; color: string; size?: number }) {
  const c = size / 2;
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" aria-hidden="true" style={{ flexShrink: 0 }}>
      {shape === 'triangle-lg' && <polygon points="11,1.5 20.5,20.5 1.5,20.5" fill={color} />}
      {shape === 'triangle-md' && <polygon points="11,4 18,19 4,19" fill={color} />}
      {shape === 'triangle-sm' && <polygon points="11,7 15.5,17.5 6.5,17.5" fill={color} />}
      {shape === 'circle-lg' && <circle cx={c} cy={c} r={9.5} fill={color} />}
      {shape === 'circle-sm' && <circle cx={c} cy={c} r={6} fill={color} />}
      {shape === 'rectangle' && <rect x="2" y="7" width="18" height="8" rx="1.5" fill={color} />}
      {shape === 'crescent' && (
        <>
          <circle cx={c} cy={c} r={9.5} fill={color} />
          <circle cx={c + 6} cy={c} r={8} fill="var(--paper, #fff)" />
        </>
      )}
      {shape === 'cone' && <path d="M 11 2 C 5 9, 5 15, 11 20 C 17 15, 17 9, 11 2 Z" fill={color} />}
    </svg>
  );
}

// Jigsaw puzzle piece — direct teacher request with a real reference
// image (interlocking prefix/base/suffix pieces). A true bezier tab/notch
// outline needs SVG arc-sweep math that's easy to get backwards without a
// live render to check against (this sandbox can't screenshot itself);
// this gets the same recognizable silhouette a simpler, more robust way —
// a plain rectangle body, plus a small solid circle straddling the right
// edge (always reads as an outward "tab," regardless of arc-sweep
// direction, because it's drawn, not cut), plus a small circle in the
// canvas's own background color straddling the left edge (reads as an
// inward "notch," since it visually erases a bite of the rectangle
// underneath it). `hasTab`/`hasNotch` let the end pieces (prefix's left
// edge, suffix's right edge) stay flat, so only the seams between
// connected pieces show the interlock.
function PuzzlePiece({ text, color, textColor = '#fff', hasNotch, hasTab, onClick, muted }: {
  text: string; color: string; textColor?: string; hasNotch: boolean; hasTab: boolean; onClick?: () => void; muted?: boolean;
}) {
  const w = 96;
  const h = 64;
  const r = 9;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        position: 'relative', width: w, height: h, padding: 0, border: 'none', background: 'transparent',
        cursor: onClick ? 'pointer' : 'default', opacity: muted ? 0.45 : 1,
      }}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <rect x="3" y="3" width={w - 6} height={h - 6} rx="6" fill={color} stroke="var(--ink)" strokeWidth="3" />
        {hasTab && <circle cx={w - 3} cy={h / 2} r={r} fill={color} stroke="var(--ink)" strokeWidth="3" />}
        {hasNotch && <circle cx="3" cy={h / 2} r={r - 1} fill="var(--paper, #fdfdfb)" stroke="var(--ink)" strokeWidth="3" />}
        <text x={w / 2} y={h / 2 + 6} textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={800} fontSize="15" fill={textColor}>
          {text}
        </text>
      </svg>
    </button>
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

// Polypad's own subcategory row — a plain clickable label + chevron that
// expands its own tile grid directly beneath it, independent of any other
// subcategory row in the same category (see openSubcategories above).
function SubcategoryRow({ id, label, open, onToggle, children }: {
  id: string;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="lm-subcategory">
      <button type="button" className="lm-subcategory-header" onClick={onToggle} aria-expanded={open} aria-controls={`lm-sub-${id}`}>
        <span>{label}</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="lm-subcategory-body" id={`lm-sub-${id}`}>{children}</div>}
    </div>
  );
}

export default function GrammarSandbox() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const student = students.find((s) => s.id === currentStudentId);
  const literacyFocusSets = useStore((s) => s.literacyFocusSets);
  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const updateStudent = useStore((s) => s.updateStudent);

  const [tool, setTool] = useState<ToolMode>('select');
  // Toolbar grouping — Claudia's audit flagged 9 flat top-level toolbar
  // modes as already past the standing "max 5-6 visible nav options"
  // checklist limit; adding Sentence Formulas as a 10th flat button would
  // make a real, already-named violation worse. One level of grouping
  // only (no nested dropdown deeper than this): Select/Draw stay always
  // visible as base tools, everything else clusters into two toggleable
  // rows the student expands on demand.
  const [toolGroupOpen, setToolGroupOpen] = useState<'words' | 'sentences' | null>(null);
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Mad Libs mode — fills keyed by segment index within the active
  // template; madlibGlow is the segment index that was just filled, for
  // a one-time celebratory pulse (never a "correct" signal).
  const [madlibTemplateIndex, setMadlibTemplateIndex] = useState(0);
  const [madlibFills, setMadlibFills] = useState<Record<number, string>>({});
  const [madlibGlow, setMadlibGlow] = useState<number | null>(null);
  const madlibGlowTimerRef = useRef<number | null>(null);
  // Morpheme Web mode — one root active at a time; attachedAffixIds is
  // only ever affixes that validly connect to the CURRENT root (switching
  // roots clears it). No punitive feedback for an invalid tap: webShake
  // briefly flags a tile for a neutral "didn't connect" wobble, never a
  // red/wrong color.
  const [morphemeRootId, setMorphemeRootId] = useState(MORPHEME_ROOTS[0].id);
  const [attachedAffixIds, setAttachedAffixIds] = useState<Set<string>>(new Set());
  const [webShakeId, setWebShakeId] = useState<string | null>(null);
  const webShakeTimerRef = useRef<number | null>(null);
  // Sound Boxes (Elkonin boxes) — Claudia's tool-survey top priority: a
  // decades-old, public-domain phonemic-segmenting technique, the most
  // foundational item missing from this sandbox. One box per real sound
  // in the current word; a student taps letters from a scrambled tray to
  // fill boxes left to right (same tap-to-fill-next-blank interaction
  // Mad Libs already proved), tapping a filled box empties it back to the
  // tray. No correct/incorrect gate — any letter can go in any box,
  // matching this sandbox's standing "no punitive feedback" rule; "Read
  // it" is how a student checks their own work by ear.
  const [soundWordIndex, setSoundWordIndex] = useState(0);
  const [boxFills, setBoxFills] = useState<Record<number, string>>({});
  const soundWord: SoundWord = SOUND_WORDS[soundWordIndex];
  // Blending Board — the second half of the same skill: build a word up
  // letter by letter (not into fixed boxes) and blend the growing string
  // after every addition, the real generic mechanic behind every
  // published blending board (UFLI's specific one stays unbuilt/unverified,
  // see soundContent.ts's own header comment).
  const [blendWordIndex, setBlendWordIndex] = useState(0);
  const [blendBuilt, setBlendBuilt] = useState<string[]>([]);
  const blendWord: SoundWord = SOUND_WORDS[blendWordIndex];
  // Word Sorts (Words Their Way-style pattern induction) — tap a word
  // card, then tap the bucket it belongs in. Placing is never blocked
  // (any word can go in any bucket, matching the sandbox's open-
  // exploration rule), but a bucket that's the real match for a placed
  // word gets the same positive-only glow the noun/verb snap already
  // uses — self-checking by ear/eye, never a red "wrong."
  const [sortIndex, setSortIndex] = useState(0);
  const [sortPlacements, setSortPlacements] = useState<Record<string, string>>({});
  const [selectedSortWordId, setSelectedSortWordId] = useState<string | null>(null);
  const [sortGlowWordId, setSortGlowWordId] = useState<string | null>(null);
  const sortGlowTimerRef = useRef<number | null>(null);
  const activeSort = WORD_SORTS[sortIndex];
  // Marker overlay — direct teacher request: "Markers can always be used,
  // even when manipulatives are active." A transparent drawing layer over
  // whichever mode is currently showing, toggled from the toolbar (always
  // visible, every mode), rather than a full separate mode swap — reaches
  // marking in one tap from anywhere without losing whatever board/word/
  // sort state is currently built. True simultaneous tile-drag-and-draw
  // was already ruled out elsewhere in this file (a real gesture-
  // disambiguation risk); this is the same "toggle, don't blend gestures"
  // resolution, applied as a floating layer instead of a swapped mode so
  // the underlying work stays visible and reachable the instant marking
  // is turned back off.
  const [markerOn, setMarkerOn] = useState(false);
  const markerCanvasRef = useRef<HTMLCanvasElement>(null);
  const markerDrawing = useRef(false);
  const markerLast = useRef<{ x: number; y: number } | null>(null);
  // Montessori Sentence Builder — direct teacher request with real
  // reference images: a decision-tree sentence builder (see
  // montessoriGrammar.ts for the full state graph and why). sbBuilt is
  // the sentence so far; sbStateId is where the decision tree currently
  // is; sbSubjectVerbForm is captured the moment a subject noun/pronoun
  // is chosen, so the Verb step only ever offers the grammatically
  // agreeing form. History stacks (state + subject form BEFORE each word
  // was added) are what makes Undo correct — the decision tree can't be
  // "rewound" just by popping the last word, since state depends on the
  // whole path taken, not just the word count.
  const [sbBuilt, setSbBuilt] = useState<{ wordClass: MontessoriWordClass; text: string }[]>([]);
  const [sbStateId, setSbStateId] = useState('start');
  const [sbSubjectVerbForm, setSbSubjectVerbForm] = useState<'singular' | 'plural' | null>(null);
  const [sbOpenPicker, setSbOpenPicker] = useState<MontessoriWordClass | null>(null);
  const sbStateHistory = useRef<string[]>([]);
  const sbSubjectHistory = useRef<('singular' | 'plural' | null)[]>([]);
  // Word Matrix — direct teacher request, "puzzle piece like format for
  // morphemes": the same real, hand-verified root+prefix+suffix pool
  // Morpheme Web already uses (morphemeContent.ts), rendered as
  // interlocking jigsaw pieces in a row instead of Morpheme Web's radial
  // layout — a genuinely different manipulative, not a reskin, per
  // Claudia's own build-plan scope call (two independently-validated
  // flanks around one base, not full three-part simultaneous validation).
  const [matrixRootId, setMatrixRootId] = useState(MORPHEME_ROOTS[0].id);
  const [matrixPrefixId, setMatrixPrefixId] = useState<string | null>(null);
  const [matrixSuffixId, setMatrixSuffixId] = useState<string | null>(null);
  const [matrixShakeId, setMatrixShakeId] = useState<string | null>(null);
  const matrixShakeTimerRef = useRef<number | null>(null);
  // Sentence Formulas — Claudia's audit + expansion of the real curriculum
  // (docs/curriculum-reference/sentence-formulas/), direct teacher
  // instruction to make this a developmental priority. sfFills maps a
  // segment's index in the active formula/step to the word chosen for it;
  // sfOpenPicker is which blank's word-bank dropdown is currently showing
  // (same click-a-blank-to-open-a-dropdown pattern as the Montessori
  // Sentence Builder above). Switching formula, step, or the progressive
  // toggle always clears fills — half-built sentences don't carry over
  // between different target structures.
  const [sfCategoryId, setSfCategoryId] = useState<FormulaCategory>('basic-action');
  const [sfFormulaId, setSfFormulaId] = useState(SENTENCE_FORMULAS[0].id);
  const [sfProgressiveOn, setSfProgressiveOn] = useState(false);
  const [sfProgressiveStep, setSfProgressiveStep] = useState(0);
  const [sfTier, setSfTier] = useState<PhonicsTier>('general');
  const [sfFills, setSfFills] = useState<Record<number, string>>({});
  const [sfOpenPicker, setSfOpenPicker] = useState<number | null>(null);
  // Per-category collapse — now that there are two sidebar categories
  // (Sentence Grammar, Word Lists), with Letters & Sounds still to come,
  // letting a student collapse the ones they're not using keeps the
  // sidebar scannable instead of one long scroll. Both open by default
  // so nothing looks hidden on first visit.
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({ grammar: true, wordLists: true });
  const toggleCategory = (key: string) => setOpenCategories((s) => ({ ...s, [key]: !s[key] }));
  // Direct teacher request: "model the collapsible nature of the
  // manipulatives... as closely modeled to amplify polypad as possible."
  // Polypad's own sidebar is two levels, not one: a colored top-level
  // category (Tiles > Geometry/Numbers) opens onto a flat list of plain
  // subcategory rows (Number Tiles and Cubes, Number Bars, Number
  // Frames...), each independently collapsible, expanding its own tile
  // grid inline right beneath itself. Naming words/Action words (under
  // Sentence Grammar) and Phonics patterns/Word parts/Spelling words
  // (under Word Lists) are that same second level here now. Default open,
  // same "nothing hidden on first visit" reasoning openCategories above
  // already uses.
  const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({
    nouns: true, verbs: true, phonics: true, morphemes: true, spelling: true,
  });
  const toggleSubcategory = (key: string) => setOpenSubcategories((s) => ({ ...s, [key]: !s[key] }));
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

  const activeMadlibTemplate = MADLIB_TEMPLATES[madlibTemplateIndex];

  const fillNextMadlibBlank = (piece: GrammarPiece) => {
    const segIdx = activeMadlibTemplate.findIndex((seg, i) => seg.type === 'blank' && seg.wordClass === piece.wordClass && !madlibFills[i]);
    if (segIdx === -1) return;
    setMadlibFills((f) => ({ ...f, [segIdx]: piece.id }));
    if (madlibGlowTimerRef.current) window.clearTimeout(madlibGlowTimerRef.current);
    setMadlibGlow(segIdx);
    madlibGlowTimerRef.current = window.setTimeout(() => setMadlibGlow(null), 900);
  };

  const clearMadlibBlank = (segIdx: number) => {
    setMadlibFills((f) => {
      const next = { ...f };
      delete next[segIdx];
      return next;
    });
  };

  const newMadlibSentence = () => {
    setMadlibTemplateIndex((i) => (i + 1) % MADLIB_TEMPLATES.length);
    setMadlibFills({});
  };

  const clearMadlibBlanks = () => setMadlibFills({});

  const readMadlib = () => {
    const sentence = activeMadlibTemplate
      .map((seg, i) => (seg.type === 'text' ? seg.value : (madlibFills[i] ? pieceById(madlibFills[i])?.text : undefined) ?? '___'))
      .join('');
    speak(sentence, student.ttsSettings);
  };

  const currentRoot = MORPHEME_ROOTS.find((r) => r.id === morphemeRootId) ?? MORPHEME_ROOTS[0];

  const selectMorphemeRoot = (rootId: string) => {
    setMorphemeRootId(rootId);
    setAttachedAffixIds(new Set());
  };

  const toggleMorphemeAffix = (affix: MorphemeAffix) => {
    const comboKey = `${morphemeRootId}:${affix.id}`;
    if (attachedAffixIds.has(affix.id)) {
      setAttachedAffixIds((s) => { const next = new Set(s); next.delete(affix.id); return next; });
      return;
    }
    if (!MORPHEME_COMBOS[comboKey]) {
      // Doesn't connect — a brief, neutral wobble, never a red/wrong signal.
      if (webShakeTimerRef.current) window.clearTimeout(webShakeTimerRef.current);
      setWebShakeId(affix.id);
      webShakeTimerRef.current = window.setTimeout(() => setWebShakeId(null), 400);
      return;
    }
    setAttachedAffixIds((s) => new Set(s).add(affix.id));
  };

  const readMorphemeWords = () => {
    const words = MORPHEME_AFFIXES
      .filter((a) => attachedAffixIds.has(a.id))
      .map((a) => MORPHEME_COMBOS[`${morphemeRootId}:${a.id}`])
      .filter(Boolean);
    if (words.length === 0) { speak(currentRoot.text, student.ttsSettings); return; }
    speak(words.join('. '), student.ttsSettings);
  };

  // Sound Boxes — tray is the current word's own letters, shuffled once
  // per word (useMemo keyed on the word so it doesn't reshuffle on every
  // render, only when the word actually changes).
  const soundTrayLetters = useMemo(() => {
    const arr = soundWord.letters.map((l, i) => ({ letter: l, trayId: `${soundWord.id}-${i}` }));
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }, [soundWord]);

  // boxFills stores each box's TRAY TILE id, not just the letter — a word
  // like "sun" has no repeats, but future words could, and matching by
  // trayId (not letter value) is the only way to correctly know which
  // specific tray tile is "used up" when two tiles show the same letter.
  const fillNextSoundBox = (trayId: string) => {
    setBoxFills((f) => {
      if (Object.values(f).includes(trayId)) return f; // already placed
      const nextIdx = soundWord.sounds.findIndex((_, i) => !f[i]);
      if (nextIdx === -1) return f;
      return { ...f, [nextIdx]: trayId };
    });
  };

  const clearSoundBox = (idx: number) => {
    setBoxFills((f) => {
      const next = { ...f };
      delete next[idx];
      return next;
    });
  };

  const newSoundWord = () => {
    setSoundWordIndex((i) => (i + 1) % SOUND_WORDS.length);
    setBoxFills({});
  };

  const speakSoundWordTarget = () => speak(soundWord.word, student.ttsSettings);

  const soundTrayLetterFor = (trayId: string | undefined) => soundTrayLetters.find((t) => t.trayId === trayId)?.letter ?? '';

  const readSoundBoxes = () => {
    const built = soundWord.sounds.map((_, i) => soundTrayLetterFor(boxFills[i])).join('');
    // Isolated single letters read by name, not by phoneme, through
    // ordinary browser text-to-speech (no way to get a real isolated
    // phoneme sound from it) — reading the built string back as a whole
    // is a closer, if imperfect, approximation than each letter alone,
    // same tradeoff every browser-TTS-based phonics tool in this app
    // already accepts.
    speak(built || soundWord.word, student.ttsSettings);
  };

  // Blending Board — sequential build, not fixed boxes: tapping the next
  // correct-position letter from the (in-order, not scrambled — blending
  // is about the growing sound, not finding the right letter) tray adds
  // it, and the growing string is read back so the student hears the
  // blend get closer to the real word each time.
  const blendNextLetter = blendWord.letters[blendBuilt.length];

  const blendAddLetter = () => {
    if (!blendNextLetter) return;
    const next = [...blendBuilt, blendNextLetter];
    setBlendBuilt(next);
    speak(next.join(''), student.ttsSettings);
  };

  const blendRemoveLast = () => setBlendBuilt((b) => b.slice(0, -1));

  const newBlendWord = () => {
    setBlendWordIndex((i) => (i + 1) % SOUND_WORDS.length);
    setBlendBuilt([]);
  };

  const speakBlendWordTarget = () => speak(blendWord.word, student.ttsSettings);

  // Word Sorts — two-tap placement (tap a word, then tap a bucket),
  // touch-friendlier than drag for a small fixed set of targets. Placing
  // is never blocked; a real-match placement gets the same kind of
  // positive-only glow the noun/verb snap uses elsewhere in this file.
  const selectSortWord = (wordId: string) => setSelectedSortWordId((id) => (id === wordId ? null : wordId));

  const placeSortWord = (bucketId: string) => {
    if (!selectedSortWordId) return;
    const word = SOUND_WORDS.find((w) => w.id === selectedSortWordId);
    const bucket = activeSort.buckets.find((b) => b.id === bucketId);
    setSortPlacements((p) => ({ ...p, [selectedSortWordId]: bucketId }));
    if (word && bucket?.matches(word)) {
      if (sortGlowTimerRef.current) window.clearTimeout(sortGlowTimerRef.current);
      setSortGlowWordId(selectedSortWordId);
      sortGlowTimerRef.current = window.setTimeout(() => setSortGlowWordId(null), 900);
    }
    setSelectedSortWordId(null);
  };

  const clearSortPlacements = () => setSortPlacements({});

  const changeSort = (idx: number) => {
    setSortIndex(idx);
    setSortPlacements({});
    setSelectedSortWordId(null);
  };

  // Marker overlay — a real, second lightweight canvas drawer (not the
  // Whiteboard component, which paints an opaque white page background by
  // design for its own Notes use elsewhere in the app; this one is
  // transparent on purpose, so it can sit visually on top of whichever
  // manipulative mode is showing underneath). Reuses the exact same
  // owned-marker-color/equipped-color data Whiteboard already reads.
  const markerColors = marketplaceItems.filter((it) => it.kind === 'color' && it.colorUse === 'marker' && student.ownedColorIds.includes(it.id));
  const equippedMarker = markerColors.find((c) => c.id === student.equippedMarkerColorId) ?? markerColors[0];
  const markerColor = equippedMarker?.colorHex ?? '#1f1147';

  const markerPosFor = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = markerCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  const markerStartDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    markerDrawing.current = true;
    markerLast.current = markerPosFor(e);
  };

  const markerMoveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!markerDrawing.current) return;
    const ctx = markerCanvasRef.current?.getContext('2d');
    if (!ctx || !markerLast.current) return;
    const p = markerPosFor(e);
    ctx.strokeStyle = markerColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(markerLast.current.x, markerLast.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    markerLast.current = p;
  };

  const markerEndDraw = () => {
    markerDrawing.current = false;
    markerLast.current = null;
  };

  const clearMarker = () => {
    const canvas = markerCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Montessori Sentence Builder
  const sbCurrentState = GRAMMAR_STATES[sbStateId];

  const sbWordListFor = (wordClass: MontessoriWordClass): WordOption[] => {
    if (wordClass === 'verb') return SANDBOX_VERBS.filter((v) => v.number === sbSubjectVerbForm).map((v) => ({ text: v.text }));
    return optionWordList(sbStateId, wordClass);
  };

  const sbChooseWord = (wordClass: MontessoriWordClass, option: WordOption) => {
    const opt = sbCurrentState.options.find((o) => o.wordClass === wordClass);
    if (!opt) return;
    sbStateHistory.current.push(sbStateId);
    sbSubjectHistory.current.push(sbSubjectVerbForm);
    setSbBuilt((b) => [...b, { wordClass, text: option.text }]);
    // The subject's verb form is captured the instant a noun/pronoun
    // resolves into 'afterSubject' — a common noun (no verbForm on the
    // option, since optionWordList's COMMON_NOUNS carry none) defaults to
    // singular, matching ordinary usage ("the dog runs").
    if (opt.next === 'afterSubject') setSbSubjectVerbForm(option.verbForm ?? 'singular');
    setSbStateId(opt.next);
    setSbOpenPicker(null);
  };

  const sbUndo = () => {
    if (sbBuilt.length === 0) return;
    setSbBuilt((b) => b.slice(0, -1));
    setSbStateId(sbStateHistory.current.pop() ?? 'start');
    setSbSubjectVerbForm(sbSubjectHistory.current.pop() ?? null);
    setSbOpenPicker(null);
  };

  const sbReset = () => {
    setSbBuilt([]);
    setSbStateId('start');
    setSbSubjectVerbForm(null);
    setSbOpenPicker(null);
    sbStateHistory.current = [];
    sbSubjectHistory.current = [];
  };

  const sbSentenceText = () => sbBuilt.map((w) => w.text).join(' ').replace(/\s+([!.])/, '$1');

  const sbReadSentence = () => {
    if (sbBuilt.length === 0) return;
    const finished = sbCurrentState.canEnd ? `${sbSentenceText()}.` : sbSentenceText();
    speak(finished, student.ttsSettings);
  };

  // Word Matrix
  const matrixRoot = MORPHEME_ROOTS.find((r) => r.id === matrixRootId) ?? MORPHEME_ROOTS[0];

  const selectMatrixRoot = (rootId: string) => {
    setMatrixRootId(rootId);
    setMatrixPrefixId(null);
    setMatrixSuffixId(null);
  };

  const matrixTryAttach = (affix: MorphemeAffix) => {
    const comboKey = `${matrixRootId}:${affix.id}`;
    const isAttached = affix.type === 'prefix' ? matrixPrefixId === affix.id : matrixSuffixId === affix.id;
    if (isAttached) {
      if (affix.type === 'prefix') setMatrixPrefixId(null); else setMatrixSuffixId(null);
      return;
    }
    if (!MORPHEME_COMBOS[comboKey]) {
      if (matrixShakeTimerRef.current) window.clearTimeout(matrixShakeTimerRef.current);
      setMatrixShakeId(affix.id);
      matrixShakeTimerRef.current = window.setTimeout(() => setMatrixShakeId(null), 400);
      return;
    }
    if (affix.type === 'prefix') setMatrixPrefixId(affix.id); else setMatrixSuffixId(affix.id);
  };

  const matrixReadWord = () => {
    const prefixText = matrixPrefixId ? MORPHEME_PREFIXES.find((p) => p.id === matrixPrefixId)?.text ?? '' : '';
    const suffixText = matrixSuffixId ? MORPHEME_SUFFIXES.find((s) => s.id === matrixSuffixId)?.text ?? '' : '';
    const key = matrixSuffixId ? `${matrixRootId}:${matrixSuffixId}` : matrixPrefixId ? `${matrixRootId}:${matrixPrefixId}` : null;
    // Prefix+base+suffix together (full three-part combo) isn't in the
    // validated table yet — Claudia's own scope call on this build: v1
    // validates two independent flanks, not a combined three-part word,
    // so with both attached this reads the pieces aloud separately
    // rather than guessing a combined spelling that might not be real.
    if (matrixPrefixId && matrixSuffixId) { speak(`${prefixText} ${matrixRoot.text} ${suffixText}`, student.ttsSettings); return; }
    const word = key ? MORPHEME_COMBOS[key] : matrixRoot.text;
    speak(word ?? matrixRoot.text, student.ttsSettings);
  };

  // Sentence Formulas
  const sfActiveFormula = SENTENCE_FORMULAS.find((f) => f.id === sfFormulaId) ?? SENTENCE_FORMULAS[0];
  const sfSegments: FormulaSegment[] = sfProgressiveOn ? PROGRESSIVE_BUILD_STEPS[sfProgressiveStep].segments : sfActiveFormula.segments;
  const sfWhoIndex = sfSegments.findIndex((seg) => seg.kind === 'slot' && seg.slot === 'who');
  const sfWhoText = sfWhoIndex >= 0 ? sfFills[sfWhoIndex] : undefined;
  const sfWhoVerbForm: 'singular' | 'plural' | null = sfWhoText ? (WHO_WORDS.find((w) => w.text === sfWhoText)?.verbForm ?? 'singular') : null;

  const sfSelectFormula = (id: string) => {
    setSfFormulaId(id);
    setSfFills({});
    setSfOpenPicker(null);
  };

  const sfSetCategory = (cat: FormulaCategory) => {
    setSfCategoryId(cat);
    const first = SENTENCE_FORMULAS.find((f) => f.category === cat);
    if (first) sfSelectFormula(first.id);
  };

  const sfToggleProgressive = (on: boolean) => {
    setSfProgressiveOn(on);
    setSfProgressiveStep(0);
    setSfFills({});
    setSfOpenPicker(null);
  };

  const sfSetProgressiveStep = (i: number) => {
    setSfProgressiveStep(i);
    setSfFills({});
    setSfOpenPicker(null);
  };

  const sfWordBankFor = (i: number): { text: string }[] => {
    const seg = sfSegments[i];
    if (seg.kind !== 'slot') return [];
    if (seg.slot === 'action') return actionWordsFor(sfWhoVerbForm, seg.verbFormOverride);
    return wordBankFor(seg.slot, sfTier, sfWhoVerbForm);
  };

  const sfPickWord = (i: number, text: string) => {
    setSfFills((f) => ({ ...f, [i]: text }));
    setSfOpenPicker(null);
  };

  const sfClearSlot = (i: number) => {
    setSfFills((f) => {
      const next = { ...f };
      delete next[i];
      return next;
    });
    setSfOpenPicker(null);
  };

  const sfBlankFor = (seg: FormulaSegment, i: number): string | null => {
    if (seg.kind === 'fixed') return seg.text;
    if (seg.kind === 'aux') return auxWordFor(seg.auxType, sfWhoText, WHO_WORDS);
    return sfFills[i] ?? null;
  };

  const sfIsComplete = sfSegments.every((seg, i) => seg.kind !== 'slot' || sfFills[i]);

  const sfSentenceText = () => sfSegments.map((seg, i) => sfBlankFor(seg, i) ?? '').join(' ').replace(/\s+([.!?])/g, '$1');

  const sfReadSentence = () => {
    if (!sfIsComplete) return;
    speak(sfSentenceText(), student.ttsSettings);
  };

  const sfClear = () => {
    setSfFills({});
    setSfOpenPicker(null);
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
            <button
              type="button"
              className="lm-category-header"
              style={{ background: GRAMMAR_WORD_CLASS_COLORS.noun, width: '100%', minHeight: 44, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              onClick={() => toggleCategory('grammar')}
              aria-expanded={openCategories.grammar}
            >
              <span>🔤 Sentence Grammar</span>
              <span aria-hidden="true">{openCategories.grammar ? '▾' : '▸'}</span>
            </button>
            {openCategories.grammar && (
              <div className="lm-category-body">
                <SubcategoryRow id="nouns" label="Naming words" open={openSubcategories.nouns} onToggle={() => toggleSubcategory('nouns')}>
                  <div className="lm-tile-list">
                    {SANDBOX_NOUNS.map((p) => (
                      <GrammarPieceTile
                        key={p.id}
                        piece={p}
                        style={{ width: '100%' }}
                        onPointerDown={tool === 'madlibs' ? (e) => { e.preventDefault(); fillNextMadlibBlank(p); } : startDragFromTray(p)}
                        onPointerMove={tool === 'madlibs' ? undefined : onDragMove}
                        onPointerUp={tool === 'madlibs' ? undefined : onDragEnd}
                      />
                    ))}
                  </div>
                </SubcategoryRow>
                <SubcategoryRow id="verbs" label="Action words" open={openSubcategories.verbs} onToggle={() => toggleSubcategory('verbs')}>
                  <div className="lm-tile-list">
                    {SANDBOX_VERBS.map((p) => (
                      <GrammarPieceTile
                        key={p.id}
                        piece={p}
                        style={{ width: '100%' }}
                        onPointerDown={tool === 'madlibs' ? (e) => { e.preventDefault(); fillNextMadlibBlank(p); } : startDragFromTray(p)}
                        onPointerMove={tool === 'madlibs' ? undefined : onDragMove}
                        onPointerUp={tool === 'madlibs' ? undefined : onDragEnd}
                      />
                    ))}
                  </div>
                </SubcategoryRow>
              </div>
            )}
          </div>

          {/* Word Lists — Literacy Workspace Phase 2 (LITERACY_WORKSPACE.md):
              a scrollable reference shelf pulling the student's current
              week's phonics/morpheme/spelling focus (set by the teacher in
              Student Manager), NOT draggable tiles — a lookup panel, not a
              mechanic. Only renders when there's an active focus with real
              content, same guard SubjectDashboard's Focus Banner uses. */}
          {hasWordList && activeFocus && (
            <div className="lm-category">
              <button
                type="button"
                className="lm-category-header"
                style={{ background: 'var(--purple)', color: '#fff', width: '100%', minHeight: 44, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                onClick={() => toggleCategory('wordLists')}
                aria-expanded={openCategories.wordLists}
              >
                <span>📚 Word Lists</span>
                <span aria-hidden="true">{openCategories.wordLists ? '▾' : '▸'}</span>
              </button>
              {openCategories.wordLists && (
                <div className="lm-category-body">
                  {activeFocus.phonicsPatterns.length > 0 && (
                    <SubcategoryRow id="phonics" label="Phonics patterns" open={openSubcategories.phonics} onToggle={() => toggleSubcategory('phonics')}>
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {activeFocus.phonicsPatterns.map((p) => (
                          <WordListPill key={`p-${p}`} word={p} onSpeak={() => speak(p, student.ttsSettings)} />
                        ))}
                      </div>
                    </SubcategoryRow>
                  )}
                  {activeFocus.morphemes.length > 0 && (
                    <SubcategoryRow id="morphemes" label="Word parts" open={openSubcategories.morphemes} onToggle={() => toggleSubcategory('morphemes')}>
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {activeFocus.morphemes.map((m) => (
                          <WordListPill key={`m-${m}`} word={m} onSpeak={() => speak(m, student.ttsSettings)} />
                        ))}
                      </div>
                    </SubcategoryRow>
                  )}
                  {activeFocus.practiceWords.length > 0 && (
                    <SubcategoryRow id="spelling" label="Spelling words" open={openSubcategories.spelling} onToggle={() => toggleSubcategory('spelling')}>
                      <div className="row-wrap" style={{ gap: 6 }}>
                        {activeFocus.practiceWords.map((w) => (
                          <WordListPill key={`w-${w}`} word={w} onSpeak={() => speak(w, student.ttsSettings)} />
                        ))}
                      </div>
                    </SubcategoryRow>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reserved for a future category (Letters & Sounds / UFLI
              grapheme tiles) — deliberately not rendered yet, parked on
              a real blocker (needs the teacher's real UFLI reference,
              see DEVELOPMENT_PLAN.md). A tile a student can tap that
              does nothing is a dead end, not a placeholder; this ships
              as soon as there's real content behind it. Morpheme Web
              and the Montessori shape system both shipped, as a
              toolbar mode and a tile icon overlay respectively rather
              than sidebar categories. */}
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
          {/* Grouped clusters (Claudia's audit fix, see toolGroupOpen's
              state comment): tapping a group button expands a second
              toolbar row with that group's modes. The group button shows
              the active mode's own label whenever the active tool is in
              that group, so a student always sees where they are even
              with the row collapsed. */}
          <button
            className={`btn btn-sm ${WORDS_GROUP.some((m) => m.id === tool) ? 'btn-primary' : ''}`}
            onClick={() => setToolGroupOpen((v) => (v === 'words' ? null : 'words'))}
          >
            {WORDS_GROUP.find((m) => m.id === tool)?.label ?? '🔤 Sounds & Words'} ▾
          </button>
          <button
            className={`btn btn-sm ${SENTENCES_GROUP.some((m) => m.id === tool) ? 'btn-primary' : ''}`}
            onClick={() => setToolGroupOpen((v) => (v === 'sentences' ? null : 'sentences'))}
          >
            {SENTENCES_GROUP.find((m) => m.id === tool)?.label ?? '📝 Sentences'} ▾
          </button>
          <span className="lm-toolbar-divider" />
          {/* Marker — direct teacher request: "always be used, even when
              manipulatives are active." A toggle, not a mode: turning it
              on layers a transparent draw canvas over whatever's already
              showing (tiles, boxes, sort buckets, ...) without leaving
              or losing that mode's state. */}
          <button className={`btn btn-sm ${markerOn ? 'btn-primary' : ''}`} onClick={() => setMarkerOn((v) => !v)}>🖍️ Mark</button>
          {markerOn && (
            <>
              {markerColors.length === 0 && <span style={{ fontSize: '0.72rem', opacity: 0.7 }}>Get markers in the 🛍️ Marketplace!</span>}
              {markerColors.map((c) => (
                <button
                  key={c.id}
                  onClick={() => updateStudent(student.id, { equippedMarkerColorId: c.id })}
                  aria-label={`${c.name} Marker`}
                  title={`${c.name} Marker`}
                  style={{ width: 30, height: 30, borderRadius: '50%', background: c.colorHex, cursor: 'pointer', padding: 0, border: equippedMarker?.id === c.id ? '3px solid var(--ink)' : '2px solid var(--content-border)' }}
                />
              ))}
              <button className="btn btn-sm" onClick={clearMarker}>🗑️ Clear marks</button>
            </>
          )}
          <span className="lm-toolbar-divider" />
          {tool === 'madlibs' ? (
            <>
              <button className="btn btn-sm" onClick={newMadlibSentence}>🔀 New sentence</button>
              <button className="btn btn-sm" onClick={readMadlib}>🔈 Read it</button>
              <button className="btn btn-sm" onClick={clearMadlibBlanks} disabled={Object.keys(madlibFills).length === 0}>↺ Clear blanks</button>
            </>
          ) : tool === 'formulas' ? (
            <>
              <button className="btn btn-sm" onClick={sfReadSentence} disabled={!sfIsComplete}>🔈 Read it</button>
              <button className="btn btn-sm" onClick={sfClear} disabled={Object.keys(sfFills).length === 0}>↺ Clear blanks</button>
            </>
          ) : tool === 'web' ? (
            <>
              <button className="btn btn-sm" onClick={readMorphemeWords}>🔈 Read words</button>
              <button className="btn btn-sm" onClick={() => setAttachedAffixIds(new Set())} disabled={attachedAffixIds.size === 0}>↺ Clear branches</button>
            </>
          ) : tool === 'boxes' ? (
            <>
              <button className="btn btn-sm" onClick={speakSoundWordTarget}>🔈 Say the word</button>
              <button className="btn btn-sm" onClick={readSoundBoxes}>🔈 Read my boxes</button>
              <button className="btn btn-sm" onClick={newSoundWord}>🔀 New word</button>
            </>
          ) : tool === 'blend' ? (
            <>
              <button className="btn btn-sm" onClick={speakBlendWordTarget}>🔈 Say the word</button>
              <button className="btn btn-sm" onClick={blendRemoveLast} disabled={blendBuilt.length === 0}>↩️ Take off a letter</button>
              <button className="btn btn-sm" onClick={newBlendWord}>🔀 New word</button>
            </>
          ) : tool === 'sorts' ? (
            <>
              {WORD_SORTS.map((s, i) => (
                <button key={s.id} className={`btn btn-sm ${i === sortIndex ? 'btn-primary' : ''}`} onClick={() => changeSort(i)}>{s.label}</button>
              ))}
              <button className="btn btn-sm" onClick={clearSortPlacements} disabled={Object.keys(sortPlacements).length === 0}>↺ Clear sort</button>
            </>
          ) : tool === 'sentence' ? (
            <>
              <button className="btn btn-sm" onClick={sbReadSentence} disabled={sbBuilt.length === 0}>🔈 Read it</button>
              <button className="btn btn-sm" onClick={sbUndo} disabled={sbBuilt.length === 0}>↩️ Undo</button>
              <button className="btn btn-sm" onClick={sbReset} disabled={sbBuilt.length === 0}>🔀 New sentence</button>
            </>
          ) : tool === 'matrix' ? (
            <>
              <button className="btn btn-sm" onClick={matrixReadWord}>🔈 Read it</button>
              <button className="btn btn-sm" onClick={() => { setMatrixPrefixId(null); setMatrixSuffixId(null); }} disabled={!matrixPrefixId && !matrixSuffixId}>↺ Clear pieces</button>
            </>
          ) : (
            <>
              <button className="btn btn-sm" onClick={undo} disabled={!canUndo}>↩️ Undo</button>
              <button className="btn btn-sm" onClick={readBoard} disabled={placed.length === 0}>🔈 Read board</button>
              <button className="btn btn-sm" onClick={clearBoard} disabled={placed.length === 0}>🗑️ Clear</button>
            </>
          )}
        </div>

        {toolGroupOpen && (
          <div className="lm-toolbar" style={{ paddingTop: 0 }}>
            {(toolGroupOpen === 'words' ? WORDS_GROUP : SENTENCES_GROUP).map((m) => (
              <button key={m.id} className={`btn btn-sm ${tool === m.id ? 'btn-primary' : ''}`} onClick={() => setTool(m.id)}>{m.label}</button>
            ))}
          </div>
        )}

        {/* Everything below is the mode-panel stack, wrapped so the
            marker overlay (see markerOn above) can sit as one absolutely-
            positioned layer on top of whichever panel is showing,
            regardless of mode — pointerEvents flips between the content
            and the marker canvas so a stroke never fights a tile drag. */}
        <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', pointerEvents: markerOn ? 'none' : undefined }}>
        {tool === 'draw' && (
          <div className="lm-canvas" style={{ position: 'relative' }}>
            <Whiteboard student={student} />
            {/* Claudia's design pass on "simultaneous draw+tiles": true
                pointer-level coexistence (dragging a tile and drawing a
                stroke from the same canvas) would force a gesture-
                disambiguation rule, a real regression against this file's
                own "one primary action per screen" finding. Scoped
                alternative: the already-placed sentence shows through as
                a non-interactive reference layer while drawing, so a
                student can see and draw around it without losing it and
                without a second live interaction mode. */}
            {placed.length > 0 && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {placed.map((p) => {
                  const piece = pieceById(p.pieceId);
                  if (!piece) return null;
                  return (
                    <GrammarPieceTile
                      key={p.instanceId}
                      piece={piece}
                      style={{ position: 'absolute', left: p.x, top: p.y, opacity: 0.9 }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tool === 'madlibs' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'center', maxWidth: 680, fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: '1.3rem', color: 'var(--ink)', lineHeight: 1.6 }}>
              {activeMadlibTemplate.map((seg, i) => {
                if (seg.type === 'text') return <span key={i}>{seg.value}</span>;
                const pieceId = madlibFills[i];
                const piece = pieceId ? pieceById(pieceId) : undefined;
                if (piece) {
                  return (
                    <GrammarPieceTile
                      key={i}
                      piece={piece}
                      glowing={madlibGlow === i}
                      style={{ cursor: 'pointer' }}
                      onPointerDown={(e) => { e.preventDefault(); clearMadlibBlank(i); }}
                    />
                  );
                }
                const blankBg = GRAMMAR_WORD_CLASS_COLORS[seg.wordClass];
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: TILE_W,
                      minHeight: TILE_H,
                      padding: '6px 14px',
                      borderRadius: seg.wordClass === 'noun' ? 12 : 999,
                      border: `3px dashed ${blankBg}`,
                      color: 'var(--ink)',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      opacity: 0.6,
                    }}
                  >
                    {seg.wordClass === 'noun' ? 'naming word' : 'action word'}
                  </span>
                );
              })}
            </div>
            <p style={{ margin: 0, fontWeight: 700, opacity: 0.5, textAlign: 'center' }}>
              {Object.keys(madlibFills).length === 0 ? 'Tap a word below to fill in the story!' : 'Tap a filled word to swap it out.'}
            </p>
          </div>
        )}

        {tool === 'web' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 24, overflowY: 'auto' }}>
            {/* Root picker — one root active at a time, per
                LITERACY_WORKSPACE.md's "a root/base tile sits centrally"
                spec. Switching roots clears attached branches. */}
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
              {MORPHEME_ROOTS.map((r) => (
                <button
                  key={r.id}
                  className={`btn btn-sm ${r.id === morphemeRootId ? 'btn-primary' : ''}`}
                  onClick={() => selectMorphemeRoot(r.id)}
                >
                  {r.text}
                </button>
              ))}
            </div>

            {/* Root + attached branches, radiating outward: prefixes to
                the left, suffixes to the right, each showing the real
                word it forms with the root. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap', minHeight: 100 }}>
              <div className="stack" style={{ gap: 8, alignItems: 'flex-end' }}>
                {MORPHEME_PREFIXES.filter((a) => attachedAffixIds.has(a.id)).map((a) => (
                  <span key={a.id} className="tag-pill" style={{ background: 'var(--blue)', color: '#fff' }}>
                    {a.text} → {MORPHEME_COMBOS[`${morphemeRootId}:${a.id}`]}
                  </span>
                ))}
              </div>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minWidth: 110, minHeight: 64, padding: '10px 22px', borderRadius: 999,
                  background: 'var(--purple)', color: '#fff', fontFamily: "'Baloo 2', sans-serif",
                  fontWeight: 800, fontSize: '1.3rem', border: '3px solid var(--ink)',
                  boxShadow: '2px 2px 0 rgba(31,17,71,0.2)',
                }}
              >
                {currentRoot.text}
              </div>
              <div className="stack" style={{ gap: 8, alignItems: 'flex-start' }}>
                {MORPHEME_SUFFIXES.filter((a) => attachedAffixIds.has(a.id)).map((a) => (
                  <span key={a.id} className="tag-pill" style={{ background: 'var(--blue)', color: '#fff' }}>
                    {a.text} → {MORPHEME_COMBOS[`${morphemeRootId}:${a.id}`]}
                  </span>
                ))}
              </div>
            </div>

            {/* Etymology enrichment card — Phase 5 of Morpheme Web's
                original spec, built this hour. Purely informational, no
                interaction required, never gates the tile-tap mechanic
                above it — matches this sandbox's "no explicit activity"
                override exactly. */}
            <div className="chrome-frame" style={{ padding: '12px 18px', maxWidth: 440, textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: '0.85rem', color: 'var(--purple)' }}>📜 Where this word comes from</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>{currentRoot.etymology}</p>
            </div>

            {/* Affix tray — tap to attach/detach. An invalid tap gets a
                brief neutral wobble, never a red/wrong signal. */}
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 8, maxWidth: 500 }}>
              {MORPHEME_AFFIXES.map((a) => {
                const attached = attachedAffixIds.has(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`tag-pill${webShakeId === a.id ? ' lm-web-shake' : ''}`}
                    style={{
                      cursor: 'pointer',
                      background: attached ? 'var(--success)' : 'white',
                      color: attached ? '#fff' : 'var(--ink)',
                      opacity: attached ? 1 : 0.85,
                    }}
                    onClick={() => toggleMorphemeAffix(a)}
                  >
                    {a.text}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: 0, fontWeight: 700, opacity: 0.5, textAlign: 'center' }}>
              Tap a word part to see if it connects to "{currentRoot.text}"!
            </p>
          </div>
        )}

        {tool === 'boxes' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 24 }}>
            {/* Elkonin / Sound Boxes — one box per real sound in the
                word (see soundContent.ts for how CVCe silent-e is
                handled). Tapping a tray letter fills the next empty box
                left to right; tapping a filled box empties it back to
                the tray — the exact "tap to fill the next blank"
                interaction Mad Libs already proved, applied to a new
                content domain. */}
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 10 }}>
              {soundWord.sounds.map((_, i) => {
                const filledLetter = soundTrayLetterFor(boxFills[i]);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => filledLetter && clearSoundBox(i)}
                    style={{
                      width: 64, height: 64, borderRadius: 10, border: '3px solid var(--ink)',
                      background: filledLetter ? 'var(--blue)' : '#fff', color: filledLetter ? '#fff' : 'var(--ink)',
                      fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '1.6rem',
                      cursor: filledLetter ? 'pointer' : 'default', textTransform: 'uppercase',
                    }}
                    aria-label={filledLetter ? `Box ${i + 1}: ${filledLetter}, tap to empty` : `Box ${i + 1}, empty`}
                  >
                    {filledLetter}
                  </button>
                );
              })}
            </div>
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
              {soundTrayLetters.map(({ letter, trayId }) => {
                const used = Object.values(boxFills).includes(trayId);
                return (
                  <button
                    key={trayId}
                    type="button"
                    disabled={used}
                    onClick={() => fillNextSoundBox(trayId)}
                    style={{
                      width: 56, height: 56, borderRadius: '50%', border: '3px solid var(--ink)',
                      background: used ? '#eee' : '#fdf3d8', opacity: used ? 0.4 : 1,
                      fontFamily: "'Baloo 2', sans-serif", fontWeight: 800,
                      fontSize: '1.4rem', textTransform: 'uppercase', cursor: used ? 'default' : 'pointer',
                      boxShadow: used ? 'none' : '2px 2px 0 rgba(31,17,71,0.2)',
                    }}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: 0, fontWeight: 700, opacity: 0.5, textAlign: 'center' }}>
              Tap "Say the word," then tap letters into the boxes for each sound you hear!
            </p>
          </div>
        )}

        {tool === 'blend' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 24 }}>
            {/* Blending Board — build the word up one letter at a time
                (in spelling order, not scrambled) and hear the growing
                string blended after every letter, the real generic
                mechanic behind every published blending board. Not a
                reproduction of UFLI's specific one, see soundContent.ts. */}
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 4 }}>
              {blendWord.letters.map((l, i) => (
                <span
                  key={i}
                  style={{
                    width: 56, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 10, border: '3px solid var(--ink)',
                    background: i < blendBuilt.length ? 'var(--success)' : '#fff',
                    color: i < blendBuilt.length ? '#fff' : 'var(--ink)',
                    fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '1.6rem', textTransform: 'uppercase',
                  }}
                >
                  {i < blendBuilt.length ? l : ''}
                </span>
              ))}
            </div>
            {blendNextLetter && (
              <button
                type="button"
                onClick={blendAddLetter}
                style={{
                  width: 72, height: 72, borderRadius: '50%', border: '3px solid var(--ink)',
                  background: '#fdf3d8', fontFamily: "'Baloo 2', sans-serif", fontWeight: 800,
                  fontSize: '1.8rem', textTransform: 'uppercase', cursor: 'pointer',
                  boxShadow: '2px 2px 0 rgba(31,17,71,0.2)',
                }}
                aria-label={`Add the next letter, ${blendNextLetter}`}
              >
                {blendNextLetter}
              </button>
            )}
            {!blendNextLetter && (
              <p style={{ margin: 0, fontWeight: 800, color: 'var(--success)', fontSize: '1.1rem' }}>🎉 You built "{blendWord.word}"!</p>
            )}
            <p style={{ margin: 0, fontWeight: 700, opacity: 0.5, textAlign: 'center' }}>
              Tap the big letter to add it, and listen to the word grow!
            </p>
          </div>
        )}

        {tool === 'sorts' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 24, overflowY: 'auto' }}>
            {/* Word Sorts (Words Their Way-style pattern induction) —
                tap a word card, then tap the bucket it belongs in.
                Placing is never blocked; a real match gets a positive-
                only glow, never a red "wrong" (same rule Morpheme Web
                and the noun/verb snap already follow). */}
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 10, maxWidth: 700 }}>
              {activeSort.buckets.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => placeSortWord(b.id)}
                  disabled={!selectedSortWordId}
                  style={{
                    flex: '1 1 160px', minHeight: 110, borderRadius: 14, border: '3px solid var(--ink)',
                    background: selectedSortWordId ? '#fdf3d8' : '#fff', padding: 10,
                    display: 'flex', flexDirection: 'column', gap: 6, cursor: selectedSortWordId ? 'pointer' : 'default',
                  }}
                >
                  <span style={{ fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '0.9rem' }}>{b.label}</span>
                  <div className="row-wrap" style={{ justifyContent: 'center', gap: 4 }}>
                    {Object.entries(sortPlacements).filter(([, bucketId]) => bucketId === b.id).map(([wordId]) => {
                      const w = SOUND_WORDS.find((sw) => sw.id === wordId);
                      if (!w) return null;
                      return (
                        <span
                          key={wordId}
                          className="tag-pill"
                          style={{ background: sortGlowWordId === wordId ? 'var(--success)' : '#fff', color: sortGlowWordId === wordId ? '#fff' : 'var(--ink)' }}
                        >
                          {w.word}
                        </span>
                      );
                    })}
                  </div>
                </button>
              ))}
            </div>
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 8, maxWidth: 700 }}>
              {SOUND_WORDS.filter((w) => !sortPlacements[w.id] && activeSort.buckets.some((b) => b.matches(w))).map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="tag-pill"
                  style={{
                    cursor: 'pointer',
                    background: selectedSortWordId === w.id ? 'var(--blue)' : '#fff',
                    color: selectedSortWordId === w.id ? '#fff' : 'var(--ink)',
                  }}
                  onClick={() => { selectSortWord(w.id); speak(w.word, student.ttsSettings); }}
                >
                  {w.word}
                </button>
              ))}
            </div>
            <p style={{ margin: 0, fontWeight: 700, opacity: 0.5, textAlign: 'center' }}>
              {selectedSortWordId ? 'Now tap the bucket it belongs in!' : 'Tap a word, then tap where it belongs.'}
            </p>
          </div>
        )}

        {tool === 'sentence' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 24, overflowY: 'auto' }}>
            {/* Montessori Sentence Builder — direct teacher request with
                real reference images: at every step, only the word
                classes that are grammatically valid right now are
                offered (montessoriGrammar.ts's decision tree), so a
                built sentence is always a real, correct English sentence
                once "Read it"/canEnd allows finishing — never a dead end,
                never a wrong turn to correct. */}
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 6, minHeight: 50 }}>
              {sbBuilt.length === 0 && (
                <p style={{ margin: 0, fontWeight: 700, opacity: 0.4 }}>Tap a shape below to start your sentence!</p>
              )}
              {sbBuilt.map((w, i) => {
                const info = MONTESSORI_WORD_CLASS_INFO[w.wordClass];
                return (
                  <span
                    key={i}
                    className="tag-pill"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: info.color, color: '#fff', fontWeight: 700 }}
                  >
                    <PuzzleShapeIcon shape={info.shape} color="#fff" size={16} />
                    {w.text}
                  </span>
                );
              })}
              {sbCurrentState.canEnd && sbBuilt.length > 0 && <span style={{ fontWeight: 800, fontSize: '1.2rem' }}>.</span>}
            </div>
            {sbCurrentState.canEnd && (
              <p style={{ margin: 0, fontWeight: 800, color: 'var(--success)', fontSize: '0.85rem' }}>✅ This is already a real, complete sentence — keep going or tap "Read it"!</p>
            )}

            <div className="stack" style={{ gap: 10, alignItems: 'center', width: '100%', maxWidth: 640 }}>
              <p style={{ margin: 0, fontWeight: 700, opacity: 0.6, fontSize: '0.8rem' }}>What comes next?</p>
              <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
                {sbCurrentState.options.map((opt) => {
                  const info = MONTESSORI_WORD_CLASS_INFO[opt.wordClass];
                  return (
                    <button
                      key={opt.wordClass}
                      type="button"
                      className="btn btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, background: sbOpenPicker === opt.wordClass ? info.color : '#fff', color: sbOpenPicker === opt.wordClass ? '#fff' : 'var(--ink)' }}
                      onClick={() => setSbOpenPicker((v) => (v === opt.wordClass ? null : opt.wordClass))}
                    >
                      <PuzzleShapeIcon shape={info.shape} color={sbOpenPicker === opt.wordClass ? '#fff' : info.color} size={18} />
                      {info.label}
                    </button>
                  );
                })}
              </div>
              {sbOpenPicker && (
                <div className="row-wrap chrome-frame" style={{ justifyContent: 'center', gap: 6, padding: 10, maxWidth: 600 }}>
                  {sbWordListFor(sbOpenPicker).map((opt) => (
                    <button key={opt.text} type="button" className="tag-pill" style={{ cursor: 'pointer', background: '#fff' }} onClick={() => sbChooseWord(sbOpenPicker, opt)}>
                      {opt.text}
                    </button>
                  ))}
                  {sbWordListFor(sbOpenPicker).length === 0 && <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Pick a naming word first so I know which verb form to offer!</span>}
                </div>
              )}
            </div>
          </div>
        )}

        {tool === 'formulas' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 24, overflowY: 'auto' }}>
            {/* Sentence Formulas — Claudia's audit + expansion of the real
                curriculum (sentenceFormulas.ts), direct teacher priority.
                Named-formula mode lets a student pick one of the 22 real
                target structures by category; Build a Sentence is the
                separate 4-step progressive scaffold (WHO+ACTION, then one
                new slot at a time). Same click-a-blank-to-open-a-word-bank
                pattern as the Montessori Sentence Builder above, plus a
                phonics word-level toggle so the same formula can be
                practiced at an easier or harder decoding level. */}
            <div className="row-wrap" style={{ gap: 6, justifyContent: 'center' }}>
              <button className={`btn btn-sm ${!sfProgressiveOn ? 'btn-primary' : ''}`} onClick={() => sfToggleProgressive(false)}>📐 Named Formulas</button>
              <button className={`btn btn-sm ${sfProgressiveOn ? 'btn-primary' : ''}`} onClick={() => sfToggleProgressive(true)}>🌱 Build a Sentence</button>
            </div>

            {!sfProgressiveOn ? (
              <>
                <div className="row-wrap" style={{ gap: 6, justifyContent: 'center' }}>
                  {FORMULA_CATEGORIES.map((c) => (
                    <button key={c.id} className={`btn btn-sm ${sfCategoryId === c.id ? 'btn-primary' : ''}`} onClick={() => sfSetCategory(c.id)}>{c.icon} {c.label}</button>
                  ))}
                </div>
                <div className="row-wrap" style={{ gap: 6, justifyContent: 'center' }}>
                  {SENTENCE_FORMULAS.filter((f) => f.category === sfCategoryId).map((f) => (
                    <button key={f.id} className={`btn btn-sm ${sfFormulaId === f.id ? 'btn-primary' : ''}`} onClick={() => sfSelectFormula(f.id)}>{f.name}</button>
                  ))}
                </div>
                <div className="chrome-frame" style={{ padding: 10, textAlign: 'center', fontSize: '0.8rem', opacity: 0.75, maxWidth: 500, alignSelf: 'center' }}>
                  <div>Like: <strong>{sfActiveFormula.examples[0]}</strong></div>
                  <div>Like: <strong>{sfActiveFormula.examples[1]}</strong></div>
                </div>
              </>
            ) : (
              <div className="row-wrap" style={{ gap: 6, justifyContent: 'center' }}>
                {PROGRESSIVE_BUILD_STEPS.map((s, i) => (
                  <button key={s.label} className={`btn btn-sm ${sfProgressiveStep === i ? 'btn-primary' : ''}`} onClick={() => sfSetProgressiveStep(i)}>{s.label}</button>
                ))}
              </div>
            )}

            <div className="row-wrap" style={{ gap: 6, justifyContent: 'center', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.6 }}>Word level:</span>
              {(['general', 'cvc', 'vce', 'blends'] as PhonicsTier[]).map((tr) => (
                <button key={tr} className={`btn btn-sm ${sfTier === tr ? 'btn-primary' : ''}`} onClick={() => setSfTier(tr)}>
                  {tr === 'general' ? 'General' : tr === 'cvc' ? 'CVC' : tr === 'vce' ? 'VCe' : 'Blends'}
                </button>
              ))}
            </div>

            <div className="row-wrap" style={{ justifyContent: 'center', gap: 8, minHeight: 60, alignItems: 'center' }}>
              {sfSegments.map((seg, i) => {
                if (seg.kind === 'fixed') return <span key={i} style={{ fontWeight: 700, fontSize: '1.2rem' }}>{seg.text}</span>;
                if (seg.kind === 'aux') return <span key={i} style={{ fontWeight: 700, fontSize: '1.2rem', fontStyle: 'italic', opacity: 0.75 }}>{sfBlankFor(seg, i)}</span>;
                const montClass = SLOT_MONTESSORI_CLASS[seg.slot];
                const info = montClass ? MONTESSORI_WORD_CLASS_INFO[montClass] : null;
                const filled = sfFills[i];
                return (
                  <button
                    key={i}
                    type="button"
                    className="tag-pill"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: filled ? (info?.color ?? 'var(--accent)') : '#fff', color: filled ? '#fff' : 'var(--ink)', border: `2px solid ${info?.color ?? 'var(--content-border)'}`, fontWeight: 700, cursor: 'pointer' }}
                    onClick={() => (filled ? sfClearSlot(i) : setSfOpenPicker((v) => (v === i ? null : i)))}
                  >
                    {info && <PuzzleShapeIcon shape={info.shape} color={filled ? '#fff' : info.color} size={16} />}
                    {filled ?? SLOT_LABELS[seg.slot]}
                  </button>
                );
              })}
            </div>

            {sfIsComplete && (
              <p style={{ margin: 0, fontWeight: 800, color: 'var(--success)', fontSize: '0.85rem', textAlign: 'center' }}>✅ That's a real, complete sentence, tap "Read it"!</p>
            )}

            {sfOpenPicker !== null && (
              <div className="row-wrap chrome-frame" style={{ justifyContent: 'center', gap: 6, padding: 10, maxWidth: 640, alignSelf: 'center' }}>
                {sfWordBankFor(sfOpenPicker).map((opt) => (
                  <button key={opt.text} type="button" className="tag-pill" style={{ cursor: 'pointer', background: '#fff' }} onClick={() => sfPickWord(sfOpenPicker, opt.text)}>
                    {opt.text}
                  </button>
                ))}
                {sfWordBankFor(sfOpenPicker).length === 0 && (
                  <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>Pick WHO first so I know which verb form to offer!</span>
                )}
              </div>
            )}
          </div>
        )}

        {tool === 'matrix' && (
          <div className="lm-canvas" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 24, overflowY: 'auto' }}>
            {/* Word Matrix — direct teacher request with a real reference
                image: prefix/base/suffix as literal interlocking jigsaw
                pieces (see PuzzlePiece above), reusing the exact same
                real hand-verified root/affix/combo pool Morpheme Web
                already validated, just laid out and validated as two
                independent flanks around one base instead of a radial
                web — Claudia's own scoped v1 call. */}
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
              {MORPHEME_ROOTS.map((r) => (
                <button key={r.id} className={`btn btn-sm ${r.id === matrixRootId ? 'btn-primary' : ''}`} onClick={() => selectMatrixRoot(r.id)}>{r.text}</button>
              ))}
            </div>

            <div className="row" style={{ justifyContent: 'center', alignItems: 'center', gap: 4 }}>
              {matrixPrefixId ? (
                <PuzzlePiece text={MORPHEME_PREFIXES.find((p) => p.id === matrixPrefixId)?.text ?? ''} color="var(--blue)" hasNotch={false} hasTab onClick={() => setMatrixPrefixId(null)} />
              ) : (
                <span style={{ width: 96, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px dashed var(--content-border)', borderRadius: 10, fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>+ prefix</span>
              )}
              <PuzzlePiece text={matrixRoot.text} color="var(--purple)" hasNotch={!!matrixPrefixId} hasTab={!!matrixSuffixId} />
              {matrixSuffixId ? (
                <PuzzlePiece text={MORPHEME_SUFFIXES.find((s) => s.id === matrixSuffixId)?.text ?? ''} color="var(--blue)" hasNotch hasTab={false} onClick={() => setMatrixSuffixId(null)} />
              ) : (
                <span style={{ width: 96, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px dashed var(--content-border)', borderRadius: 10, fontSize: '0.7rem', opacity: 0.5, fontWeight: 700 }}>+ suffix</span>
              )}
            </div>

            <div className="stack" style={{ gap: 10, alignItems: 'center' }}>
              <p style={{ margin: 0, fontWeight: 700, opacity: 0.6, fontSize: '0.8rem' }}>Prefixes</p>
              <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
                {MORPHEME_PREFIXES.map((a) => (
                  <div key={a.id} className={matrixShakeId === a.id ? 'lm-web-shake' : ''}>
                    <PuzzlePiece text={a.text} color="#fdf3d8" textColor="var(--ink)" hasNotch={false} hasTab muted={matrixPrefixId !== null && matrixPrefixId !== a.id} onClick={() => matrixTryAttach(a)} />
                  </div>
                ))}
              </div>
              <p style={{ margin: 0, fontWeight: 700, opacity: 0.6, fontSize: '0.8rem' }}>Suffixes</p>
              <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
                {MORPHEME_SUFFIXES.map((a) => (
                  <div key={a.id} className={matrixShakeId === a.id ? 'lm-web-shake' : ''}>
                    <PuzzlePiece text={a.text} color="#fdf3d8" textColor="var(--ink)" hasNotch hasTab={false} muted={matrixSuffixId !== null && matrixSuffixId !== a.id} onClick={() => matrixTryAttach(a)} />
                  </div>
                ))}
              </div>
            </div>
            <p style={{ margin: 0, fontWeight: 700, opacity: 0.5, textAlign: 'center' }}>
              Tap a puzzle piece to attach it — it only fits if it makes a real word part!
            </p>
          </div>
        )}

        {tool === 'select' && (
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
        {/* Transparent marker canvas — only captures pointer events while
            markerOn is true (the content layer above takes them back the
            instant marking is toggled off). Cleared independently of any
            mode's own Clear button; switching modes never clears it. */}
        <canvas
          ref={markerCanvasRef}
          width={1400}
          height={900}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            pointerEvents: markerOn ? 'auto' : 'none',
            touchAction: 'none', cursor: markerOn ? 'crosshair' : 'default',
          }}
          onPointerDown={markerOn ? markerStartDraw : undefined}
          onPointerMove={markerOn ? markerMoveDraw : undefined}
          onPointerUp={markerOn ? markerEndDraw : undefined}
          onPointerLeave={markerOn ? markerEndDraw : undefined}
        />
        </div>
      </div>
    </div>
  );
}
