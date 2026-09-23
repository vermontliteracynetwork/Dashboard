import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { speak } from '../../components/ReadAloud';
import HelpOverlay from '../../components/HelpOverlay';
import { SANDBOX_PIECES } from '../../lib/grammarContent';
import { MORPHEME_ROOTS, MORPHEME_PREFIXES, MORPHEME_SUFFIXES, MORPHEME_COMBOS } from '../../lib/morphemeContent';
import { MONTESSORI_WORD_CLASS_INFO, type MontessoriWordClass } from '../../lib/montessoriGrammar';
import { SYMBOL_SENTENCE_PAGES, type SymbolSentence } from '../../lib/symbolSentences';
import {
  SENTENCE_FORMULAS, FORMULA_CATEGORIES, WHO_WORDS, SLOT_MONTESSORI_CLASS, SLOT_LABELS,
  wordBankFor, actionWordsFor, auxWordFor, type FormulaCategory,
} from '../../lib/sentenceFormulas';
import { CONSONANTS, VOWELS } from '../../lib/soundWallData';
import { GRAMMAR_WORD_CLASS_COLORS, GRAMMAR_WORD_CLASS_TEXT_COLORS } from '../../types';
import type { GrammarPiece, SavedWhiteboard } from '../../types';
import { todayISO } from '../../lib/dates';

// Literacy Manipulatives — rebuilt per direct teacher redesign (2026-09-22),
// replacing the previous mode-switching build entirely: "the design...
// is too scripted, too prompted. it should really just be a drag and
// drop... an interactive whiteboard to explore all the tools... entirely
// unscripted and not aligned with a curriculum... this is open play,
// dont build the activity component until all design, features,
// navigation, and tools in literacy manipulatives is developed
// completely." Every earlier scripted mode (Mad Libs, Sentence
// Formulas, the Montessori decision-tree Sentence Builder, Sound Boxes/
// Blending Board tied to one target word, Word Sorts' fixed buckets,
// Morpheme Web's tap-to-attach validator) is gone from THIS screen —
// their content modules (sentenceFormulas.ts, soundContent.ts,
// montessoriGrammar.ts's GRAMMAR_STATES, morphemeContent.ts's
// MORPHEME_COMBOS) stay in the repo untouched for the future
// teacher-authored Activity mode, which is explicitly not being built
// yet.
//
// This is now ONE shared canvas plus a left-side material palette
// (nav moved off the old top bar, direct instruction: "the bar across
// the top should move to the left hand side"), Polypad/GeoGebra-style:
// every material (word tiles, blank Montessori grammar shapes, morpheme
// pieces, letters, sound-box frames) drags from the sidebar onto the
// canvas and can be freely repositioned, mixed, and combined, with no
// fixed target/correct-answer/completion state anywhere. The one
// surviving "smart" behavior is the noun+verb number-agreement snap —
// a structural grammar rule applied to any two words regardless of
// content (like real magnetic tiles), not a curriculum target, and it
// predates and survived every design review this sandbox has had.
const TILE_W = 120;
const TILE_H = 58;
const SNAP_GAP = 14;
const SNAP_THRESHOLD = 160;
const HISTORY_LIMIT = 20;

// Speech-to-text for the Text Box tool — direct teacher instruction
// ("SST option" on the new typeable fields). The browser's own Web
// Speech API, feature-detected once at module scope, same pattern this
// project used before speech-to-text was removed app-wide (2026-09-22,
// "remove STT, but allow TTS for the items or things highlighted by
// the student" — that removal was about ArticleReader specifically;
// this is a new, separate, explicit request for this one tool).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;
const voiceToTextSupported = !!SpeechRecognitionCtor;

function useTextBoxVoiceToText(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const stop = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggle = () => {
    if (listening) { stop(); return; }
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let added = '';
      for (let i = e.resultIndex; i < e.results.length; i++) added += e.results[i][0].transcript;
      if (added.trim()) onFinalTextRef.current(added.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  return { listening, toggle, supported: voiceToTextSupported };
}

const LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const FRAME_SIZES = [2, 3, 4, 5];

// Grapheme tiles — direct teacher request: "a set of all graphemes
// taught in the UFLI scope." This environment's network policy blocks
// UFLI's own published materials (same standing block logged everywhere
// else in this project for UFLI links), so this can't claim to be
// UFLI's verified scope-and-sequence specifically. Reuses the real,
// ordinary grapheme data already built for the Orton-Gillingham Sound
// Wall (soundWallData.ts) instead — every real spelling of every real
// English consonant/vowel sound, deduped — a genuine comprehensive
// grapheme set, just not verified against UFLI's own text.
const GRAPHEMES = Array.from(new Set([...CONSONANTS, ...VOWELS].flatMap((p) => p.graphemes))).sort();

// Ordinary, well-documented affix meanings — used to compose a plain
// definition when a morpheme piece connects to a real word (see
// AFFIX_MEANINGS usage below). Not a specialized curriculum standard.
const AFFIX_MEANINGS: Record<string, string> = {
  'un-': 'not, or the opposite of', 're-': 'again', 'dis-': 'not, or the opposite of',
  '-ed': 'happened in the past', '-ing': 'happening right now', '-ful': 'full of', '-less': 'without',
};

// Always-available baseline colors — direct teacher instruction: "grabbing
// purchased/earned/inventory markers of students in addition to regular."
// A student with nothing purchased yet still has real colors to draw
// with; owned Marketplace colors are appended after these.
const BASE_PEN_COLORS = ['#1f1147', '#dc2626', '#2563eb', '#16a34a', '#f97316', '#7c3aed'];
const BASE_HIGHLIGHT_COLORS = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4'];

type PlacedKind = 'grammar' | 'shape' | 'letter' | 'frame' | 'morpheme' | 'sentenceFrame' | 'textbox';

interface PlacedItem {
  instanceId: string;
  kind: PlacedKind;
  x: number;
  y: number;
  pieceId?: string; // grammar
  wordClass?: MontessoriWordClass; // shape
  letter?: string; // letter
  boxCount?: number; // frame
  morphText?: string; // morpheme
  morphType?: 'root' | 'prefix' | 'suffix'; // morpheme
  morphId?: string; // morpheme — original MORPHEME_ROOTS/PREFIXES/SUFFIXES id, for MORPHEME_COMBOS lookup
  formulaId?: string; // sentenceFrame
  frameFills?: Record<number, string>; // sentenceFrame
  textValue?: string; // textbox
  fontSize?: number; // textbox
}

const pieceById = (id: string): GrammarPiece | undefined => SANDBOX_PIECES.find((p) => p.id === id);

function sizeFor(kind: PlacedKind, boxCount?: number): { w: number; h: number } {
  if (kind === 'grammar') return { w: TILE_W, h: TILE_H };
  if (kind === 'morpheme') return { w: 96, h: 64 };
  if (kind === 'frame') { const n = boxCount ?? 3; return { w: n * 44 + (n - 1) * 4, h: 44 }; }
  if (kind === 'textbox') return { w: 160, h: 56 };
  return { w: 44, h: 44 }; // shape, letter, sentenceFrame (drag not used for the latter)
}

// Jigsaw-piece morpheme silhouette — direct teacher request, real
// reference image. Purely decorative now (no attach validation, per the
// "entirely unscripted" redesign): root pieces show both a tab and a
// notch, a prefix only its right-side tab, a suffix only its left-side
// notch, so the interlocking affordance still reads visually even
// though nothing checks whether a combination is a real word anymore.
function PuzzlePiece({ text, color, textColor = '#fff', hasNotch, hasTab }: {
  text: string; color: string; textColor?: string; hasNotch: boolean; hasTab: boolean;
}) {
  const w = 96;
  const h = 64;
  const r = 9;
  const rectY = 15;
  const rectH = h - rectY - 3;
  const cy = rectY + rectH / 2;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect x="3" y={rectY} width={w - 6} height={rectH} rx="8" fill={color} stroke="var(--ink)" strokeWidth="3" />
      <circle cx={w / 2} cy="9" r="8" fill={color} stroke="var(--ink)" strokeWidth="3" />
      {hasTab && <circle cx={w - 3} cy={cy} r={r} fill={color} stroke="var(--ink)" strokeWidth="3" />}
      {hasNotch && <circle cx="3" cy={cy} r={r - 1} fill="var(--paper, #fdfdfb)" stroke="var(--ink)" strokeWidth="3" />}
      <text x={w / 2} y={cy + 6} textAnchor="middle" fontFamily="'Baloo 2', sans-serif" fontWeight={800} fontSize="14" fill={textColor}>
        {text}
      </text>
    </svg>
  );
}

// Pure appearance for any placed/tray item — one render path shared by
// the sidebar tray and the canvas, so every material looks identical in
// both places (a real navigation-clarity fix: one visual language, not
// a different tile style per old "mode").
function ItemVisual({ kind, pieceId, wordClass, letter, boxCount, morphText, morphType }: {
  kind: PlacedKind; pieceId?: string; wordClass?: MontessoriWordClass; letter?: string; boxCount?: number;
  morphText?: string; morphType?: 'root' | 'prefix' | 'suffix';
}) {
  if (kind === 'grammar') {
    const piece = pieceById(pieceId ?? '');
    if (!piece) return null;
    const bg = GRAMMAR_WORD_CLASS_COLORS[piece.wordClass];
    const fg = GRAMMAR_WORD_CLASS_TEXT_COLORS[piece.wordClass];
    return (
      <div style={{
        width: TILE_W, minHeight: TILE_H, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '6px 14px', borderRadius: piece.wordClass === 'noun' ? 12 : 999, background: bg, color: fg,
        fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '1rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)', textAlign: 'center',
      }}>
        {piece.text}
      </div>
    );
  }
  if (kind === 'shape') {
    const info = MONTESSORI_WORD_CLASS_INFO[wordClass ?? 'noun'];
    return (
      <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={info.imageUrl} alt={info.label} draggable={false} style={{ width: 40, height: 40, objectFit: 'contain', pointerEvents: 'none' }} />
      </div>
    );
  }
  if (kind === 'letter') {
    // Also used for grapheme tiles (multi-character, e.g. "sh", "a_e"),
    // hence the min-width instead of a fixed square.
    return (
      <div style={{
        minWidth: 40, height: 40, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '3px solid var(--ink)', borderRadius: 8, background: 'white',
        fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: (letter?.length ?? 1) > 2 ? '0.85rem' : '1.2rem', boxShadow: '2px 2px 0 rgba(31,17,71,0.2)',
      }}>
        {letter}
      </div>
    );
  }
  if (kind === 'frame') {
    return (
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: boxCount ?? 3 }).map((_, i) => (
          <div key={i} style={{ width: 44, height: 44, border: '3px solid var(--ink)', borderRadius: 6, background: 'white' }} />
        ))}
      </div>
    );
  }
  // morpheme
  const color = morphType === 'root' ? '#F6C445' : morphType === 'prefix' ? '#7c3aed' : '#14b8a6';
  const textColor = morphType === 'root' ? '#241a05' : '#fff';
  return <PuzzlePiece text={morphText ?? ''} color={color} textColor={textColor} hasTab={morphType !== 'suffix'} hasNotch={morphType !== 'prefix'} />;
}

// One drag wrapper for every material, in the tray or on the canvas —
// pointer handlers passed in, appearance always comes from ItemVisual.
function Draggable({ onPointerDown, onPointerMove, onPointerUp, onDoubleClick, style, glowing, label, children }: {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  style?: CSSProperties;
  glowing?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={onDoubleClick}
      style={{
        touchAction: 'none', userSelect: 'none', cursor: 'grab', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        boxShadow: glowing ? '0 0 0 6px rgba(34,197,94,0.35)' : undefined,
        borderRadius: glowing ? 14 : undefined,
        transition: 'box-shadow 0.2s ease',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Polypad's own subcategory row — a plain clickable label + chevron that
// expands its own tile grid directly beneath it, independent of any
// other subcategory row in the same category.
function SubcategoryRow({ id, label, open, onToggle, children }: {
  id: string; label: string; open: boolean; onToggle: () => void; children: React.ReactNode;
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

// A single collapsible top-level category in the left sidebar.
function Category({ label, color, open, onToggle, children }: {
  label: string; color: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="lm-category">
      <button
        type="button"
        className="lm-category-header"
        style={{ background: color, width: '100%', minHeight: 44, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{label}</span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="lm-category-body">{children}</div>}
    </div>
  );
}

// A Word Lists row — plain text, not tile-styled (direct teacher
// instruction), but still draggable onto the board like every other
// material. The 🔈 button is separate so a tap can still just hear the
// word without placing a tile (its own pointerdown is stopped from
// bubbling up so it doesn't also start a drag).
function WordListRow({ word, onDragStart, onSpeak }: {
  word: string; onDragStart: (e: React.PointerEvent) => void; onSpeak: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <Draggable label={word} onPointerDown={onDragStart} style={{ flex: 1, justifyContent: 'flex-start' }}>
        <span style={{ textAlign: 'left', padding: '6px 2px', fontSize: '0.95rem', color: 'var(--ink)', minHeight: 36, display: 'flex', alignItems: 'center' }}>
          {word}
        </span>
      </Draggable>
      <button
        type="button"
        onClick={onSpeak}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Hear ${word}`}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 6 }}
      >
        🔈
      </button>
    </div>
  );
}

// A Symbol Sentences tray card — direct teacher upload (a real
// Montessori grammar-box deck: full sentences shown purely as a row of
// colored symbols, no words). Dragging the card onto the board drops
// its whole symbol row at once; the sentence text itself is only used
// as the card's aria-label, never shown, matching the sandbox's
// standing symbols-only philosophy for this material.
function SymbolSentenceCard({ sentence, onPointerDown }: {
  sentence: SymbolSentence; onPointerDown: (e: React.PointerEvent) => void;
}) {
  return (
    <Draggable label={sentence.sentence} onPointerDown={onPointerDown} style={{ width: '100%' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', width: '100%',
        padding: '8px 10px', border: '2px solid var(--ink)', borderRadius: 10, background: 'white',
        boxShadow: '2px 2px 0 rgba(31,17,71,0.15)',
      }}>
        {sentence.words.map((w, i) => (
          <img key={i} src={MONTESSORI_WORD_CLASS_INFO[w.wordClass].imageUrl} alt="" draggable={false} style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0, pointerEvents: 'none' }} />
        ))}
      </div>
    </Draggable>
  );
}

// Text Box — direct teacher instruction: "add type text input fields so
// kids can type. SST option. text fields can be double tapped to edit
// text, moveable, resize text options." A self-contained widget (same
// pattern as the Sentence Formula frames): dragging it moves it around
// like any other material, double-tapping opens edit mode (a real
// textarea, focused automatically), and while editing a student can
// type, speak (🎤, browser speech-to-text), or grow/shrink the text
// with A-/A+.
function TextBoxWidget({ item, onPointerDown, onPointerMove, onPointerUp, onTextChange, onFontSizeChange, onRemove }: {
  item: PlacedItem;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onTextChange: (value: string) => void;
  onFontSizeChange: (delta: number) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fontSize = item.fontSize ?? 20;
  const stt = useTextBoxVoiceToText((text) => onTextChange(`${item.textValue ?? ''} ${text}`.trim()));

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <div className="chrome-frame" style={{ position: 'absolute', left: item.x, top: item.y, padding: 10, zIndex: 5, minWidth: 200 }}>
        <textarea
          ref={inputRef}
          value={item.textValue ?? ''}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder="Type here..."
          style={{
            width: 220, minHeight: 70, fontFamily: "'Baloo 2', sans-serif", fontSize,
            border: '2px solid var(--ink)', borderRadius: 8, padding: 6, resize: 'both',
          }}
        />
        <div className="row-wrap" style={{ gap: 4, marginTop: 6, alignItems: 'center' }}>
          <button type="button" className="btn btn-sm" style={{ minWidth: 34, padding: '2px 8px' }} onClick={() => onFontSizeChange(-2)} aria-label="Smaller text">A-</button>
          <button type="button" className="btn btn-sm" style={{ minWidth: 34, padding: '2px 8px' }} onClick={() => onFontSizeChange(2)} aria-label="Bigger text">A+</button>
          {stt.supported && (
            <button type="button" className={`btn btn-sm ${stt.listening ? 'btn-primary' : ''}`} onClick={stt.toggle}>
              {stt.listening ? '🎙️ Listening…' : '🎤 Speak'}
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>Done</button>
          <button type="button" className="btn btn-sm" onClick={onRemove} aria-label="Remove text box">🗑️</button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={item.textValue?.trim() ? item.textValue : 'Empty text box, double-tap to type'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={() => setEditing(true)}
      style={{
        position: 'absolute', left: item.x, top: item.y, zIndex: 5,
        touchAction: 'none', userSelect: 'none', cursor: 'grab', minWidth: 120, minHeight: 44,
        padding: '8px 12px', border: '2px dashed var(--content-border)', borderRadius: 8, background: 'white',
        fontFamily: "'Baloo 2', sans-serif", fontSize, whiteSpace: 'pre-wrap', maxWidth: 320,
      }}
    >
      {item.textValue?.trim() ? item.textValue : <span style={{ opacity: 0.45 }}>Double-tap to type</span>}
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
  const savedWhiteboards = useStore((s) => s.savedWhiteboards);
  const saveWhiteboardAction = useStore((s) => s.saveWhiteboard);
  const deleteWhiteboardAction = useStore((s) => s.deleteWhiteboard);

  const [placed, setPlaced] = useState<PlacedItem[]>([]);
  const [glowIds, setGlowIds] = useState<Set<string>>(new Set());
  const [confirmExit, setConfirmExit] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Top toolbar (Help/Exit/materials-toggle/Draw/Undo/Redo/Clear/Save) —
  // direct teacher instruction: moved off the sidebar into its own
  // collapsible bar across the top of the screen.
  const [topBarOpen, setTopBarOpen] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragInstanceRef = useRef<string | null>(null);
  const glowTimerRef = useRef<number | null>(null);
  const historyRef = useRef<PlacedItem[][]>([]);
  const redoRef = useRef<PlacedItem[][]>([]);
  // Save file — direct teacher instruction: "a save file (creating a log
  // of all saved whiteboards that they can name and refer back to)."
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saveNameInput, setSaveNameInput] = useState('');

  // Draw — merged Mark+Draw into one tool, direct teacher instruction.
  // A transparent canvas overlay sits on top of the shared tile canvas
  // (same technique the old Mark toggle used); Pen and Highlight are two
  // stroke styles of the same tool, not separate tools.
  const [drawOn, setDrawOn] = useState(false);
  const [drawMode, setDrawMode] = useState<'pen' | 'highlight'>('pen');
  const [drawColor, setDrawColor] = useState(BASE_PEN_COLORS[0]);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const drawLast = useRef<{ x: number; y: number } | null>(null);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    shapes: true, symbolSentences: false, morphemes: false, letters: false, graphemes: false, frames: false, textbox: false, formulas: false, wordLists: false,
  });
  const toggleCategory = (key: string) => setOpenCategories((s) => ({ ...s, [key]: !s[key] }));
  const [openSubcategories, setOpenSubcategories] = useState<Record<string, boolean>>({
    page1: false, page2: false, page3: false, page4: false, page5: false, page6: false, page7: false, page8: false, page9: false, page10: false, page11: false,
    roots: true, affixes: true, phonics: true, morphemesList: true, spelling: true,
  });
  const toggleSubcategory = (key: string) => setOpenSubcategories((s) => ({ ...s, [key]: !s[key] }));

  // Alphabet — direct teacher instruction: full set of tiles, lowercase
  // and uppercase, toggled by double-tapping a tile. letterCase tracks
  // the tray's current case per letter (what gets dragged out next);
  // once placed, a tile's own case toggles independently via its own
  // double-tap, tracked directly on that placed instance's `letter`.
  const [letterCase, setLetterCase] = useState<Record<string, 'upper' | 'lower'>>({});
  const caseFor = (l: string) => letterCase[l] ?? 'upper';
  const toggleTrayCase = (l: string) => setLetterCase((c) => ({ ...c, [l]: caseFor(l) === 'upper' ? 'lower' : 'upper' }));
  const toggleLetterCase = (instanceId: string) => setPlaced((p) => p.map((pp) => (
    pp.instanceId === instanceId && pp.kind === 'letter' && pp.letter
      ? { ...pp, letter: pp.letter === pp.letter.toUpperCase() ? pp.letter.toLowerCase() : pp.letter.toUpperCase() }
      : pp
  )));

  if (!currentStudentId) {
    navigate('/student/login');
    return null;
  }
  if (!student) {
    navigate('/student/login');
    return null;
  }

  // Sentence Formulas — direct teacher instruction: brought back as a
  // left-sidebar category (not a full-screen mode), reusing
  // sentenceFormulas.ts's real 22-formula content. Picking a formula adds
  // a self-contained frame widget to the canvas (its own placed item,
  // not draggable — a fixed-position card with a close button, to avoid
  // the widget's internal clickable blanks fighting canvas drag). Each
  // blank is both a plain text input (type your own word) and a "▾"
  // dropdown (pick from the real word bank), satisfying "drag and drop
  // or type" without the real cross-widget drag risk that would add.
  const [sfCategoryId, setSfCategoryId] = useState<FormulaCategory>('basic-action');
  const [openFramePicker, setOpenFramePicker] = useState<string | null>(null);

  const addSentenceFrame = (formulaId: string) => {
    const count = placed.filter((p) => p.kind === 'sentenceFrame').length;
    const instanceId = `sf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setPlaced((p) => [...p, { instanceId, kind: 'sentenceFrame', formulaId, frameFills: {}, x: 40, y: 20 + count * 130 }]);
  };

  const removePlacedItem = (instanceId: string) => setPlaced((p) => p.filter((pp) => pp.instanceId !== instanceId));

  const setFrameFill = (instanceId: string, segIndex: number, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, frameFills: { ...(pp.frameFills ?? {}), [segIndex]: value } } : pp)));
  };

  const setTextBoxValue = (instanceId: string, value: string) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, textValue: value } : pp)));
  };
  const setTextBoxFontSize = (instanceId: string, delta: number) => {
    setPlaced((p) => p.map((pp) => (pp.instanceId === instanceId ? { ...pp, fontSize: Math.min(48, Math.max(12, (pp.fontSize ?? 20) + delta)) } : pp)));
  };

  const ownedVoices = marketplaceItems.filter((it) => it.kind === 'voice' && student.ownedVoiceIds.includes(it.id));

  // Morphemes — direct teacher instruction: puzzle pieces only link if
  // they form a real word ("pre" + "view" = "previewing" — a real
  // word); otherwise they never connect, and no definition appears.
  // Unlike the noun/verb snap (always snaps on number agreement,
  // whatever the words), this only snaps position when MORPHEME_COMBOS
  // confirms a real result — an invalid attempt simply doesn't move.
  const runMorphemeSnapCheck = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged || dragged.kind !== 'morpheme') return current;
      let bestId: string | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const other of current) {
        if (other.instanceId === instanceId || other.kind !== 'morpheme') continue;
        const isPair = dragged.morphType === 'root' ? other.morphType !== 'root' : other.morphType === 'root';
        if (!isPair) continue;
        const dist = Math.hypot(other.x - dragged.x, other.y - dragged.y);
        if (dist < bestDist) { bestDist = dist; bestId = other.instanceId; }
      }
      if (!bestId) return current;
      const other = current.find((p) => p.instanceId === bestId)!;
      const rootItem = dragged.morphType === 'root' ? dragged : other;
      const affixItem = dragged.morphType === 'root' ? other : dragged;
      if (!MORPHEME_COMBOS[`${rootItem.morphId}:${affixItem.morphId}`]) return current;
      const morphW = sizeFor('morpheme').w;
      const newX = affixItem.morphType === 'prefix' ? rootItem.x - morphW - 4 : rootItem.x + morphW + 4;
      return current.map((p) => (p.instanceId === affixItem.instanceId ? { ...p, x: newX, y: rootItem.y } : p));
    });
  };

  // Real-word connections currently on the board, derived (not stored)
  // from position — recomputed every render, cheap given the tiny
  // MORPHEME_ROOTS/PREFIXES/SUFFIXES pool.
  const morphemeCombos = placed
    .filter((p) => p.kind === 'morpheme' && p.morphType === 'root')
    .flatMap((root) => placed
      .filter((p) => p.kind === 'morpheme' && p.morphType !== 'root' && Math.hypot(p.x - root.x, p.y - root.y) < 140)
      .map((affix) => {
        const word = MORPHEME_COMBOS[`${root.morphId}:${affix.morphId}`];
        if (!word) return null;
        const rootData = MORPHEME_ROOTS.find((r) => r.id === root.morphId);
        const meaning = AFFIX_MEANINGS[affix.morphText ?? ''] ?? '';
        return {
          id: `${root.instanceId}-${affix.instanceId}`, x: root.x, y: root.y,
          word, definition: `"${word}" = ${affix.morphType === 'prefix' ? affix.morphText : rootData?.text}${affix.morphType === 'prefix' ? '' : affix.morphText} (${affix.morphText} means "${meaning}")`,
          etymology: rootData?.etymology,
        };
      })
      .filter((x): x is NonNullable<typeof x> => !!x));

  const pushHistory = () => {
    historyRef.current = [...historyRef.current.slice(-(HISTORY_LIMIT - 1)), placed];
    setCanUndo(true);
    // A fresh action invalidates any redo history.
    redoRef.current = [];
    setCanRedo(false);
  };

  const undo = () => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    const prev = hist[hist.length - 1];
    historyRef.current = hist.slice(0, -1);
    redoRef.current = [...redoRef.current, placed];
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(true);
    setPlaced(prev);
  };

  const redo = () => {
    const red = redoRef.current;
    if (red.length === 0) return;
    const next = red[red.length - 1];
    redoRef.current = red.slice(0, -1);
    historyRef.current = [...historyRef.current, placed];
    setCanUndo(true);
    setCanRedo(redoRef.current.length > 0);
    setPlaced(next);
  };

  const canvasRelative = (clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Snap check — the one structural rule left: a dropped/moved grammar
  // tile looks for the nearest OTHER grammar tile of the opposite word
  // class whose number agrees. Every other material kind is skipped
  // entirely, purely free placement.
  const runSnapCheck = (instanceId: string) => {
    setPlaced((current) => {
      const dragged = current.find((p) => p.instanceId === instanceId);
      if (!dragged || dragged.kind !== 'grammar') return current;
      const draggedPiece = pieceById(dragged.pieceId ?? '');
      if (!draggedPiece) return current;

      let bestId: string | null = null;
      let bestDist = SNAP_THRESHOLD;
      for (const other of current) {
        if (other.instanceId === instanceId || other.kind !== 'grammar') continue;
        const otherPiece = pieceById(other.pieceId ?? '');
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

  // A tray pointerdown and the item it spawns are two different DOM
  // elements (the tray tile vs. the newly-created canvas tile), so
  // relying on setPointerCapture alone to keep the drag live is
  // unreliable (it can retarget events to the tray element, which has
  // no move/up handler, silently freezing the new tile in place). A
  // window-level listener sidesteps that entirely: it fires on every
  // pointer move/up regardless of which element is nominally the
  // event's target, so the newly spawned tile reliably tracks the
  // cursor and lands wherever the pointer is released.
  const bindGlobalDragTracking = (
    spawned: { instanceId: string; x: number; y: number }[],
    spawnAnchor: { x: number; y: number },
    anchorSize: { w: number; h: number },
    kind: PlacedKind,
  ) => {
    const offsets = new Map(spawned.map((it) => [it.instanceId, { dx: it.x - spawnAnchor.x, dy: it.y - spawnAnchor.y }]));
    const move = (ev: PointerEvent) => {
      const { x, y } = canvasRelative(ev.clientX, ev.clientY);
      const anchorX = x - anchorSize.w / 2;
      const anchorY = y - anchorSize.h / 2;
      setPlaced((p) => p.map((pp) => {
        const off = offsets.get(pp.instanceId);
        return off ? { ...pp, x: anchorX + off.dx, y: anchorY + off.dy } : pp;
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      dragInstanceRef.current = null;
      const anchorId = spawned[spawned.length - 1].instanceId;
      if (kind === 'grammar') runSnapCheck(anchorId);
      if (kind === 'morpheme') runMorphemeSnapCheck(anchorId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const startDragNewItem = (factory: () => Omit<PlacedItem, 'x' | 'y' | 'instanceId'>) => (e: React.PointerEvent) => {
    e.preventDefault();
    pushHistory();
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const base = factory();
    const size = sizeFor(base.kind, base.boxCount);
    const item = { ...base, instanceId, x: x - size.w / 2, y: y - size.h / 2 };
    setPlaced((p) => [...p, item]);
    dragInstanceRef.current = instanceId;
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported, window listener still tracks the drag */ }
    bindGlobalDragTracking([item], { x: item.x, y: item.y }, size, base.kind);
  };

  // Symbol Sentences — drops a whole pre-made sentence's worth of plain
  // shape symbols in one row, same spawn mechanism as any other tray
  // material (startDragNewItem above), just placing several at once.
  // Once on the board each symbol is an ordinary 'shape' item, freely
  // separable and rearrangeable like any other Grammar Symbol.
  const startDragNewSymbolSentence = (sentence: SymbolSentence) => (e: React.PointerEvent) => {
    e.preventDefault();
    pushHistory();
    const { x, y } = canvasRelative(e.clientX, e.clientY);
    const gap = 8;
    const tileW = 48;
    const n = sentence.words.length;
    const totalW = n * tileW + (n - 1) * gap;
    const startX = x - totalW / 2;
    const topY = y - tileW / 2;
    const newItems: PlacedItem[] = sentence.words.map((w, i) => ({
      instanceId: `ss-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      kind: 'shape',
      wordClass: w.wordClass,
      x: startX + i * (tileW + gap),
      y: topY,
    }));
    setPlaced((p) => [...p, ...newItems]);
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch { /* not supported, window listener still tracks the drag */ }
    bindGlobalDragTracking(newItems, { x: startX, y: topY }, { w: totalW, h: tileW }, 'shape');
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
    setPlaced((p) => p.map((pp) => {
      if (pp.instanceId !== id) return pp;
      const size = sizeFor(pp.kind, pp.boxCount);
      return { ...pp, x: x - size.w / 2, y: y - size.h / 2 };
    }));
  };

  const onDragEnd = () => {
    const id = dragInstanceRef.current;
    dragInstanceRef.current = null;
    if (!id) return;
    const item = placed.find((p) => p.instanceId === id);
    if (item?.kind === 'grammar') runSnapCheck(id);
    if (item?.kind === 'morpheme') runMorphemeSnapCheck(id);
  };

  const clearBoard = () => {
    if (placed.length === 0) return;
    pushHistory();
    setPlaced([]);
  };

  // Draw canvas — same transparent-overlay technique as the old marker
  // tool, now the only drawing mechanism (Mark and Draw merged).
  const drawPosFor = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  const drawStart = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    drawLast.current = drawPosFor(e);
  };

  const drawMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = drawCanvasRef.current?.getContext('2d');
    if (!ctx || !drawLast.current) return;
    const p = drawPosFor(e);
    ctx.globalAlpha = drawMode === 'highlight' ? 0.35 : 1;
    ctx.lineWidth = drawMode === 'highlight' ? 22 : 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = drawColor;
    ctx.beginPath();
    ctx.moveTo(drawLast.current.x, drawLast.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    drawLast.current = p;
  };

  const drawEnd = () => {
    drawing.current = false;
    drawLast.current = null;
  };

  const clearDrawing = () => {
    const canvas = drawCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const myBoards = savedWhiteboards
    .filter((w) => w.studentId === student.id)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const confirmSaveWhiteboard = () => {
    const name = saveNameInput.trim() || `Board ${myBoards.length + 1}`;
    const drawingDataUrl = drawCanvasRef.current?.toDataURL() ?? null;
    saveWhiteboardAction(student.id, name, JSON.stringify(placed), drawingDataUrl);
    setSaveNameInput('');
    setShowSaveModal(false);
  };

  const loadWhiteboard = (w: SavedWhiteboard) => {
    try {
      setPlaced(JSON.parse(w.placedJson) as PlacedItem[]);
    } catch {
      setPlaced([]);
    }
    clearDrawing();
    if (w.drawingDataUrl) {
      const img = new Image();
      img.onload = () => {
        const ctx = drawCanvasRef.current?.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
      };
      img.src = w.drawingDataUrl;
    }
    historyRef.current = [];
    redoRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setShowLoadModal(false);
  };

  const ownedMarkerColors = marketplaceItems.filter((it) => it.kind === 'color' && it.colorUse === 'marker' && student.ownedColorIds.includes(it.id));
  const ownedHighlightColors = marketplaceItems.filter((it) => it.kind === 'color' && it.colorUse === 'highlight' && student.ownedColorIds.includes(it.id));
  const penPalette = [...BASE_PEN_COLORS, ...ownedMarkerColors.map((c) => c.colorHex).filter((h): h is string => !!h)];
  const highlightPalette = [...BASE_HIGHLIGHT_COLORS, ...ownedHighlightColors.map((c) => c.colorHex).filter((h): h is string => !!h)];
  const activePalette = drawMode === 'pen' ? penPalette : highlightPalette;

  const setDrawModeAndColor = (mode: 'pen' | 'highlight') => {
    setDrawMode(mode);
    setDrawColor(mode === 'pen' ? BASE_PEN_COLORS[0] : BASE_HIGHLIGHT_COLORS[0]);
  };

  const today = todayISO();
  const activeFocus = literacyFocusSets.find(
    (f) => f.studentId === student.id && f.startDate <= today && today <= f.endDate,
  );
  const hasWordList = !!activeFocus && (
    activeFocus.phonicsPatterns.length > 0 || activeFocus.morphemes.length > 0 || activeFocus.practiceWords.length > 0
  );

  return (
    <div className="lm-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
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
      {showSaveModal && (
        <div className="overlay-backdrop" onClick={() => setShowSaveModal(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>💾 Save this board</h2>
              <input
                value={saveNameInput}
                onChange={(e) => setSaveNameInput(e.target.value)}
                placeholder={`Board ${myBoards.length + 1}`}
                style={{ width: '100%' }}
                autoFocus
              />
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                <button className="btn btn-primary btn-lg" onClick={confirmSaveWhiteboard}>Save</button>
                <button className="btn btn-lg" onClick={() => setShowSaveModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showLoadModal && (
        <div className="overlay-backdrop" onClick={() => setShowLoadModal(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 460, maxHeight: '80vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div className="space-between" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>📂 My Saved Boards</h2>
              <button className="btn btn-sm" onClick={() => setShowLoadModal(false)}>✕</button>
            </div>
            {myBoards.length === 0 ? (
              <p style={{ opacity: 0.6 }}>Nothing saved yet — tap 💾 Save first!</p>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {myBoards.map((w) => (
                  <div key={w.id} className="row-wrap" style={{ justifyContent: 'space-between', border: '2px solid var(--content-border)', borderRadius: 10, padding: '8px 12px' }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{w.name}</div>
                      <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{new Date(w.createdAt).toLocaleDateString()}</div>
                    </div>
                    <div className="row-wrap" style={{ gap: 6 }}>
                      <button className="btn btn-sm btn-primary" onClick={() => loadWhiteboard(w)}>Load</button>
                      <button className="btn btn-sm" onClick={() => deleteWhiteboardAction(w.id)} aria-label={`Delete ${w.name}`}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top toolbar — direct teacher instruction: moved off the sidebar
          into its own collapsible bar. Help/Exit/materials-sidebar-toggle
          on the left, Draw/Undo/Redo/Clear/Save on the right. */}
      <div className="lm-toolbar" style={{ flex: '0 0 auto' }}>
        {topBarOpen ? (
          <>
            <span className="lm-sidebar-title" style={{ marginRight: 8 }}>🧩 Literacy Manipulatives</span>
            <button className="btn btn-sm" onClick={() => setShowHelp(true)} aria-label="Help">🧘 Help</button>
            <button className="btn btn-sm" onClick={() => setConfirmExit(true)}>✕ Exit</button>
            <button className="btn btn-sm" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? 'Hide materials' : 'Show materials'}>{sidebarOpen ? '⟨⟨' : '⟩⟩'}</button>
            <span className="lm-toolbar-divider" />
            <button className={`btn btn-sm ${drawOn ? 'btn-primary' : ''}`} onClick={() => setDrawOn((v) => !v)}>🖍️ Draw</button>
            <button className="btn btn-sm" onClick={undo} disabled={!canUndo}>↩️ Undo</button>
            <button className="btn btn-sm" onClick={redo} disabled={!canRedo}>↪️ Redo</button>
            <button className="btn btn-sm" onClick={clearBoard} disabled={placed.length === 0}>🗑️ Clear</button>
            <span className="lm-toolbar-divider" />
            <button className="btn btn-sm" onClick={() => setShowSaveModal(true)}>💾 Save</button>
            <button className="btn btn-sm" onClick={() => setShowLoadModal(true)}>📂 My Boards</button>
            <span style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => setTopBarOpen(false)} aria-label="Hide toolbar">▲ Hide bar</button>
          </>
        ) : (
          <button className="btn btn-sm" onClick={() => setTopBarOpen(true)} aria-label="Show toolbar">▼ Show toolbar</button>
        )}
      </div>
      {topBarOpen && drawOn && (
        <div className="lm-toolbar" style={{ flex: '0 0 auto', paddingTop: 0 }}>
          <button className={`btn btn-sm ${drawMode === 'pen' ? 'btn-primary' : ''}`} onClick={() => setDrawModeAndColor('pen')}>✏️ Pen</button>
          <button className={`btn btn-sm ${drawMode === 'highlight' ? 'btn-primary' : ''}`} onClick={() => setDrawModeAndColor('highlight')}>🖊️ Highlight</button>
          <span className="lm-toolbar-divider" />
          {activePalette.map((hex, i) => (
            <button
              key={`${hex}-${i}`}
              onClick={() => setDrawColor(hex)}
              aria-label="Color"
              style={{ width: 28, height: 28, borderRadius: '50%', background: hex, cursor: 'pointer', padding: 0, border: drawColor === hex ? '3px solid var(--ink)' : '2px solid var(--content-border)' }}
            />
          ))}
          <span className="lm-toolbar-divider" />
          <button className="btn btn-sm" onClick={clearDrawing}>🗑️ Clear marks</button>
        </div>
      )}

      <div className="lm-shell" style={{ flex: 1, minHeight: 0 }}>
      {sidebarOpen ? (
        <aside className="lm-sidebar">
          <Category label="🔺 Grammar Symbols" color="#e9d5ff" open={openCategories.shapes} onToggle={() => toggleCategory('shapes')}>
            <div className="row-wrap" style={{ gap: 8 }}>
              {(Object.keys(MONTESSORI_WORD_CLASS_INFO) as MontessoriWordClass[]).map((cls) => {
                const info = MONTESSORI_WORD_CLASS_INFO[cls];
                return (
                  <Draggable key={cls} label={info.label} onPointerDown={startDragNewItem(() => ({ kind: 'shape', wordClass: cls }))}>
                    <ItemVisual kind="shape" wordClass={cls} />
                  </Draggable>
                );
              })}
            </div>
          </Category>

          <Category label="📜 Symbol Sentences" color="#ddd6fe" open={openCategories.symbolSentences} onToggle={() => toggleCategory('symbolSentences')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Drag a whole sentence onto the board, symbols only!</p>
            {SYMBOL_SENTENCE_PAGES.map((page) => (
              <SubcategoryRow key={page.id} id={page.id} label={page.label} open={openSubcategories[page.id]} onToggle={() => toggleSubcategory(page.id)}>
                <div className="stack" style={{ gap: 8 }}>
                  {page.sentences.map((sentence) => (
                    <SymbolSentenceCard key={sentence.id} sentence={sentence} onPointerDown={startDragNewSymbolSentence(sentence)} />
                  ))}
                </div>
              </SubcategoryRow>
            ))}
          </Category>

          <Category label="🧩 Morphemes" color="#bae6fd" open={openCategories.morphemes} onToggle={() => toggleCategory('morphemes')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Pieces only link if they make a real word!</p>
            <SubcategoryRow id="roots" label="Roots" open={openSubcategories.roots} onToggle={() => toggleSubcategory('roots')}>
              <div className="row-wrap" style={{ gap: 8 }}>
                {MORPHEME_ROOTS.map((r) => (
                  <Draggable key={r.id} label={r.text} onPointerDown={startDragNewItem(() => ({ kind: 'morpheme', morphText: r.text, morphType: 'root', morphId: r.id }))}>
                    <ItemVisual kind="morpheme" morphText={r.text} morphType="root" />
                  </Draggable>
                ))}
              </div>
            </SubcategoryRow>
            <SubcategoryRow id="affixes" label="Prefixes & suffixes" open={openSubcategories.affixes} onToggle={() => toggleSubcategory('affixes')}>
              <div className="row-wrap" style={{ gap: 8 }}>
                {MORPHEME_PREFIXES.map((a) => (
                  <Draggable key={a.id} label={a.text} onPointerDown={startDragNewItem(() => ({ kind: 'morpheme', morphText: a.text, morphType: 'prefix', morphId: a.id }))}>
                    <ItemVisual kind="morpheme" morphText={a.text} morphType="prefix" />
                  </Draggable>
                ))}
                {MORPHEME_SUFFIXES.map((a) => (
                  <Draggable key={a.id} label={a.text} onPointerDown={startDragNewItem(() => ({ kind: 'morpheme', morphText: a.text, morphType: 'suffix', morphId: a.id }))}>
                    <ItemVisual kind="morpheme" morphText={a.text} morphType="suffix" />
                  </Draggable>
                ))}
              </div>
            </SubcategoryRow>
          </Category>

          <Category label="🔡 Alphabet" color="#fed7aa" open={openCategories.letters} onToggle={() => toggleCategory('letters')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Double-tap a letter to flip its case!</p>
            <div className="row-wrap" style={{ gap: 6 }}>
              {LETTERS.map((l) => {
                const display = caseFor(l) === 'lower' ? l.toLowerCase() : l;
                return (
                  <Draggable key={l} label={display} onPointerDown={startDragNewItem(() => ({ kind: 'letter', letter: display }))} onDoubleClick={() => toggleTrayCase(l)}>
                    <ItemVisual kind="letter" letter={display} />
                  </Draggable>
                );
              })}
            </div>
          </Category>

          <Category label="🔠 Graphemes" color="#fde68a" open={openCategories.graphemes} onToggle={() => toggleCategory('graphemes')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Every real English spelling pattern (not UFLI-verified, see code comment).</p>
            <div className="row-wrap" style={{ gap: 4 }}>
              {GRAPHEMES.map((g) => (
                <Draggable key={g} label={g} onPointerDown={startDragNewItem(() => ({ kind: 'letter', letter: g }))}>
                  <ItemVisual kind="letter" letter={g} />
                </Draggable>
              ))}
            </div>
          </Category>

          <Category label="🟦 Sound Frames" color="#bbf7d0" open={openCategories.frames} onToggle={() => toggleCategory('frames')}>
            <div className="stack" style={{ gap: 10 }}>
              {FRAME_SIZES.map((n) => (
                <Draggable key={n} label={`${n}-box frame`} onPointerDown={startDragNewItem(() => ({ kind: 'frame', boxCount: n }))}>
                  <ItemVisual kind="frame" boxCount={n} />
                </Draggable>
              ))}
            </div>
          </Category>

          <Category label="⌨️ Text Box" color="#c7d2fe" open={openCategories.textbox} onToggle={() => toggleCategory('textbox')}>
            <p style={{ margin: '0 0 6px', fontSize: '0.7rem', opacity: 0.6 }}>Double-tap a text box to type, speak, or resize the text.</p>
            <Draggable label="Add a text box" onPointerDown={startDragNewItem(() => ({ kind: 'textbox', textValue: '', fontSize: 20 }))} style={{ width: '100%' }}>
              <div style={{
                width: '100%', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                border: '2px dashed var(--ink)', borderRadius: 8, background: 'white', fontFamily: "'Baloo 2', sans-serif", fontWeight: 700, fontSize: '0.85rem', padding: '6px 10px',
              }}>
                ⌨️ Add a text box
              </div>
            </Draggable>
          </Category>

          <Category label="📐 Sentence Formulas" color="#fbcfe8" open={openCategories.formulas} onToggle={() => toggleCategory('formulas')}>
            <div className="row-wrap" style={{ gap: 4 }}>
              {FORMULA_CATEGORIES.map((c) => (
                <button key={c.id} className={`btn btn-sm ${sfCategoryId === c.id ? 'btn-primary' : ''}`} style={{ padding: '3px 8px', fontSize: '0.75rem', minHeight: 30, minWidth: 30 }} onClick={() => setSfCategoryId(c.id)} title={c.label}>{c.icon}</button>
              ))}
            </div>
            <div className="stack" style={{ gap: 2, marginTop: 8 }}>
              {SENTENCE_FORMULAS.filter((f) => f.category === sfCategoryId).map((f) => (
                <button key={f.id} className="btn btn-sm" style={{ textAlign: 'left', fontSize: '0.78rem', minHeight: 32 }} onClick={() => addSentenceFrame(f.id)}>➕ {f.name}</button>
              ))}
            </div>
          </Category>

          {hasWordList && (
            <Category label="📚 Word Lists" color="#fecdd3" open={openCategories.wordLists} onToggle={() => toggleCategory('wordLists')}>
              {/* Plain reference rows, deliberately not styled as tiles
                  (direct teacher instruction: "the word lists should not
                  be in tiles") — but still draggable onto the board like
                  every other material, plus a dedicated speaker button to
                  hear the word without placing it. */}
              {activeFocus!.phonicsPatterns.length > 0 && (
                <SubcategoryRow id="phonics" label="Phonics patterns" open={openSubcategories.phonics} onToggle={() => toggleSubcategory('phonics')}>
                  <div className="stack" style={{ gap: 2 }}>
                    {activeFocus!.phonicsPatterns.map((w) => (
                      <WordListRow key={`p-${w}`} word={w} onDragStart={startDragNewItem(() => ({ kind: 'letter', letter: w }))} onSpeak={() => speak(w, student.ttsSettings)} />
                    ))}
                  </div>
                </SubcategoryRow>
              )}
              {activeFocus!.morphemes.length > 0 && (
                <SubcategoryRow id="morphemesList" label="Word parts" open={openSubcategories.morphemesList} onToggle={() => toggleSubcategory('morphemesList')}>
                  <div className="stack" style={{ gap: 2 }}>
                    {activeFocus!.morphemes.map((w) => (
                      <WordListRow key={`m-${w}`} word={w} onDragStart={startDragNewItem(() => ({ kind: 'letter', letter: w }))} onSpeak={() => speak(w, student.ttsSettings)} />
                    ))}
                  </div>
                </SubcategoryRow>
              )}
              {activeFocus!.practiceWords.length > 0 && (
                <SubcategoryRow id="spelling" label="Spelling words" open={openSubcategories.spelling} onToggle={() => toggleSubcategory('spelling')}>
                  <div className="stack" style={{ gap: 2 }}>
                    {activeFocus!.practiceWords.map((w) => (
                      <WordListRow key={`w-${w}`} word={w} onDragStart={startDragNewItem(() => ({ kind: 'letter', letter: w }))} onSpeak={() => speak(w, student.ttsSettings)} />
                    ))}
                  </div>
                </SubcategoryRow>
              )}
            </Category>
          )}
        </aside>
      ) : null}

      <div className="lm-main">
        <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          <div
            ref={canvasRef}
            className="lm-canvas"
            style={{ position: 'relative', height: '100%', pointerEvents: drawOn ? 'none' : undefined }}
          >
            {placed.filter((p) => p.kind !== 'sentenceFrame' && p.kind !== 'textbox').map((p) => (
              <Draggable
                key={p.instanceId}
                label="Placed item"
                glowing={glowIds.has(p.instanceId)}
                style={{ position: 'absolute', left: p.x, top: p.y }}
                onPointerDown={startDragPlaced(p.instanceId)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onDoubleClick={p.kind === 'letter' ? () => toggleLetterCase(p.instanceId) : undefined}
              >
                <ItemVisual kind={p.kind} pieceId={p.pieceId} wordClass={p.wordClass} letter={p.letter} boxCount={p.boxCount} morphText={p.morphText} morphType={p.morphType} />
              </Draggable>
            ))}
            {/* Morpheme definitions — direct teacher instruction: only
                appears once a piece combination is a real word, pulled
                from the root's own etymology plus the affix's ordinary
                meaning. */}
            {morphemeCombos.map((c) => (
              <div key={c.id} className="chrome-frame" style={{ position: 'absolute', left: c.x - 20, top: c.y + 72, width: 240, padding: 8, fontSize: '0.72rem', zIndex: 3 }}>
                <div style={{ fontWeight: 800, marginBottom: 2 }}>✨ {c.word}</div>
                <div>{c.definition}</div>
                {c.etymology && <div style={{ marginTop: 4, opacity: 0.7 }}>📜 {c.etymology}</div>}
              </div>
            ))}
            {/* Sentence Formula frames — self-contained widgets, not
                draggable, so their internal clickable blanks never fight
                canvas-drag pointer handling. */}
            {placed.filter((p) => p.kind === 'sentenceFrame').map((item) => {
              const formula = SENTENCE_FORMULAS.find((f) => f.id === item.formulaId);
              if (!formula) return null;
              const fills = item.frameFills ?? {};
              const whoIdx = formula.segments.findIndex((s) => s.kind === 'slot' && s.slot === 'who');
              const whoText = whoIdx >= 0 ? fills[whoIdx] : undefined;
              const whoVerbForm: 'singular' | 'plural' | null = whoText ? (WHO_WORDS.find((w) => w.text === whoText)?.verbForm ?? 'singular') : null;
              const isComplete = formula.segments.every((seg, i) => seg.kind !== 'slot' || (fills[i] && fills[i].trim()));
              const sentenceText = formula.segments.map((seg, i) => {
                if (seg.kind === 'fixed') return seg.text;
                if (seg.kind === 'aux') return auxWordFor(seg.auxType, whoText, WHO_WORDS);
                return fills[i] ?? '';
              }).join(' ').replace(/\s+([.!?])/g, '$1');
              return (
                <div key={item.instanceId} className="chrome-frame" style={{ position: 'absolute', left: item.x, top: item.y, padding: 12, maxWidth: 640, zIndex: 4 }}>
                  <div className="space-between" style={{ marginBottom: 8, alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.85rem' }}>{formula.name}</strong>
                    <button className="btn btn-sm" onClick={() => removePlacedItem(item.instanceId)}>✕</button>
                  </div>
                  <div className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>
                    {formula.segments.map((seg, i) => {
                      if (seg.kind === 'fixed') return <span key={i} style={{ fontWeight: 700 }}>{seg.text}</span>;
                      if (seg.kind === 'aux') return <span key={i} style={{ fontWeight: 700, fontStyle: 'italic', opacity: 0.75 }}>{auxWordFor(seg.auxType, whoText, WHO_WORDS)}</span>;
                      const montClass = SLOT_MONTESSORI_CLASS[seg.slot];
                      const color = montClass ? MONTESSORI_WORD_CLASS_INFO[montClass].color : 'var(--content-border)';
                      const bank = seg.slot === 'action' ? actionWordsFor(whoVerbForm, seg.verbFormOverride) : wordBankFor(seg.slot, 'general', whoVerbForm);
                      const pickerKey = `${item.instanceId}:${i}`;
                      return (
                        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, position: 'relative' }}>
                          <input
                            value={fills[i] ?? ''}
                            onChange={(e) => setFrameFill(item.instanceId, i, e.target.value)}
                            placeholder={SLOT_LABELS[seg.slot]}
                            style={{ width: 92, border: `2px solid ${color}`, borderRadius: 6, padding: '4px 6px', fontSize: '0.85rem' }}
                          />
                          <button className="btn btn-sm" style={{ padding: '2px 6px', minHeight: 28, minWidth: 28 }} onClick={() => setOpenFramePicker((v) => (v === pickerKey ? null : pickerKey))}>▾</button>
                          {openFramePicker === pickerKey && (
                            <div className="chrome-frame row-wrap" style={{ position: 'absolute', top: '110%', left: 0, zIndex: 10, padding: 6, gap: 4, width: 220 }}>
                              {bank.map((opt) => (
                                <button key={opt.text} className="tag-pill" style={{ cursor: 'pointer' }} onClick={() => { setFrameFill(item.instanceId, i, opt.text); setOpenFramePicker(null); }}>{opt.text}</button>
                              ))}
                              {bank.length === 0 && <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Fill WHO first!</span>}
                            </div>
                          )}
                        </span>
                      );
                    })}
                  </div>
                  {isComplete && (
                    <div className="row-wrap" style={{ gap: 6, marginTop: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, opacity: 0.6 }}>🔈 Read it as:</span>
                      <button className="btn btn-sm" onClick={() => speak(sentenceText, student.ttsSettings, null)}>Default</button>
                      {ownedVoices.map((v) => (
                        <button key={v.id} className="btn btn-sm" onClick={() => speak(sentenceText, student.ttsSettings, v.id)}>{v.name}</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {placed.filter((p) => p.kind === 'textbox').map((item) => (
              <TextBoxWidget
                key={item.instanceId}
                item={item}
                onPointerDown={startDragPlaced(item.instanceId)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onTextChange={(v) => setTextBoxValue(item.instanceId, v)}
                onFontSizeChange={(d) => setTextBoxFontSize(item.instanceId, d)}
                onRemove={() => removePlacedItem(item.instanceId)}
              />
            ))}
            {placed.length === 0 && (
              <p style={{ position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)', margin: 0, fontWeight: 700, opacity: 0.35, textAlign: 'center', width: 320 }}>
                Drag anything from the left onto this board!
              </p>
            )}
          </div>
          {/* Transparent draw canvas — only captures pointer events while
              drawOn is true, the content layer takes them back instantly
              when Draw is toggled off. */}
          <canvas
            ref={drawCanvasRef}
            width={1400}
            height={900}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: drawOn ? 'auto' : 'none',
              touchAction: 'none', cursor: drawOn ? 'crosshair' : 'default',
            }}
            onPointerDown={drawOn ? drawStart : undefined}
            onPointerMove={drawOn ? drawMove : undefined}
            onPointerUp={drawOn ? drawEnd : undefined}
            onPointerLeave={drawOn ? drawEnd : undefined}
          />
        </div>
      </div>
      </div>
    </div>
  );
}
