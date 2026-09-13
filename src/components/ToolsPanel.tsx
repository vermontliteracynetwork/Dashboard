import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from '../store/store';
import { speak } from './ReadAloud';
import InternalBrowser from './InternalBrowser';
import { SOUND_WALL } from '../lib/wordData';
import { fetchDefinition, fetchSynonyms, fetchAntonyms, isBlockedTerm } from '../lib/wordLookup';
import type { WordLookupResult } from '../lib/wordLookup';
import { analyzeMorphology } from '../lib/morphology';
import type { Student, ToolKey, Subject, CustomTool } from '../types';
import { ACCESSIBILITY_TOOLS, SUBJECT_TOOLS, TOOL_LABELS } from '../types';

const TOOL_ICONS: Record<ToolKey, string> = {
  calculator: '🧮',
  tts: '🔈',
  wordProcessor: '📝',
  breakVisual: '🧘',
  multiplicationTable: '✖️',
  hundredsChart: '💯',
  numberLine: '📏',
  thesaurus: '🔄',
  dictionary: '📖',
  soundWall: '🔤',
  whiteboard: '🎨',
};

// Tools that need real room to work — shown in a much larger overlay
// instead of the default small popup.
const WIDE_TOOLS: ToolKey[] = ['wordProcessor', 'whiteboard'];

// Plain text -> safe HTML for seeding a contentEditable from an old,
// pre-rich-text note that only ever had a plain `body`.
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function Calculator() {
  const [display, setDisplay] = useState('0');
  const [pending, setPending] = useState<{ op: string; value: number } | null>(null);

  const apply = (op: string, a: number, b: number) => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? 0 : a / b;
      default: return b;
    }
  };

  const pressNum = (n: string) => setDisplay((d) => (d === '0' ? n : d + n));
  const pressOp = (op: string) => {
    setPending({ op, value: parseFloat(display) });
    setDisplay('0');
  };
  const pressEquals = () => {
    if (!pending) return;
    const result = apply(pending.op, pending.value, parseFloat(display));
    setDisplay(String(result));
    setPending(null);
  };
  const clear = () => { setDisplay('0'); setPending(null); };

  return (
    <div className="stack" style={{ maxWidth: 260 }}>
      <div className="content-well" style={{ textAlign: 'right', fontSize: '1.8rem', fontFamily: 'monospace' }}>
        {display}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {['7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '-', '0', 'C', '=', '+'].map((k) => (
          <button
            key={k}
            className={`btn btn-sm ${'+-×÷='.includes(k) ? 'btn-primary' : ''}`}
            onClick={() => {
              if (k === 'C') clear();
              else if (k === '=') pressEquals();
              else if ('+-×÷'.includes(k)) pressOp(k);
              else pressNum(k);
            }}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiplicationTable() {
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const nums = Array.from({ length: 12 }, (_, i) => i + 1);
  return (
    <div className="stack">
      {sel && (
        <div className="content-well" style={{ textAlign: 'center', fontSize: '1.3rem' }}>
          {sel.r} × {sel.c} = <strong>{sel.r * sel.c}</strong>
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table className="grid-table">
          <thead>
            <tr>
              <th></th>
              {nums.map((c) => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {nums.map((r) => (
              <tr key={r}>
                <th>{r}</th>
                {nums.map((c) => (
                  <td
                    key={c}
                    onClick={() => setSel({ r, c })}
                    style={{
                      cursor: 'pointer',
                      background: sel && sel.r === r && sel.c === c ? 'var(--yellow)' : undefined,
                    }}
                  >
                    {r * c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HundredsChart() {
  const [skip, setSkip] = useState<number | null>(null);
  const nums = Array.from({ length: 100 }, (_, i) => i + 1);
  return (
    <div className="stack">
      <div className="row-wrap">
        <span>Highlight counting by:</span>
        {[2, 5, 10].map((n) => (
          <button key={n} className={`btn btn-sm ${skip === n ? 'btn-primary' : ''}`} onClick={() => setSkip(skip === n ? null : n)}>
            {n}s
          </button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 4, maxWidth: 420 }}>
        {nums.map((n) => (
          <div
            key={n}
            style={{
              textAlign: 'center',
              padding: '6px 0',
              borderRadius: 6,
              fontSize: '0.8rem',
              border: '1px solid var(--content-border)',
              background: skip && n % skip === 0 ? 'var(--teal)' : 'white',
              color: skip && n % skip === 0 ? 'white' : 'inherit',
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

const NUMBER_LINE_RANGES: { label: string; min: number; max: number }[] = [
  { label: '0–10', min: 0, max: 10 },
  { label: '0–20', min: 0, max: 20 },
  { label: '0–50', min: 0, max: 50 },
  { label: '0–100', min: 0, max: 100 },
  { label: '-10–10', min: -10, max: 10 },
];

const NL_TICK_W = 34;

function NumberLine() {
  const [rangeIdx, setRangeIdx] = useState(1);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const range = NUMBER_LINE_RANGES[rangeIdx];
  const nums = Array.from({ length: range.max - range.min + 1 }, (_, i) => range.min + i);

  const pick = (n: number) => {
    if (start === null || end !== null) {
      setStart(n);
      setEnd(null);
    } else {
      setEnd(n);
    }
  };

  const reset = () => {
    setStart(null);
    setEnd(null);
  };

  const startIdx = start !== null ? start - range.min : null;
  const endIdx = end !== null ? end - range.min : null;
  const lineWidth = nums.length * NL_TICK_W;

  return (
    <div className="stack">
      <div className="row-wrap">
        <span style={{ fontSize: '0.85rem', alignSelf: 'center' }}>Range:</span>
        {NUMBER_LINE_RANGES.map((r, i) => (
          <button
            key={r.label}
            className={`btn btn-sm ${rangeIdx === i ? 'btn-primary' : ''}`}
            onClick={() => {
              setRangeIdx(i);
              reset();
            }}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p style={{ fontSize: '0.85rem', opacity: 0.75, margin: 0 }}>
        Tap a number to start, tap another to see the jump between them.
      </p>
      {start !== null && end !== null && (
        <div className="content-well" style={{ textAlign: 'center', fontSize: '1.15rem' }}>
          {start} → {end} is a jump of <strong>{Math.abs(end - start)}</strong> {end > start ? '➡️ forward' : '⬅️ backward'}
        </div>
      )}
      <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
        <div style={{ position: 'relative', width: lineWidth, paddingTop: 32 }}>
          {startIdx !== null && endIdx !== null && startIdx !== endIdx && (
            <svg
              width={lineWidth}
              height={32}
              style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', pointerEvents: 'none' }}
            >
              <defs>
                <marker id="nl-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="var(--purple)" />
                </marker>
              </defs>
              <path
                d={`M ${startIdx * NL_TICK_W + NL_TICK_W / 2} 30 Q ${((startIdx + endIdx) / 2) * NL_TICK_W + NL_TICK_W / 2} 0 ${endIdx * NL_TICK_W + NL_TICK_W / 2} 30`}
                fill="none"
                stroke="var(--purple)"
                strokeWidth={3}
                markerEnd="url(#nl-arrow)"
              />
            </svg>
          )}
          <div style={{ position: 'relative', height: 3, background: 'var(--ink)', width: lineWidth }} />
          <div style={{ display: 'flex' }}>
            {nums.map((n) => {
              const isStart = n === start;
              const isEnd = n === end;
              return (
                <button
                  key={n}
                  onClick={() => pick(n)}
                  style={{
                    width: NL_TICK_W,
                    flex: '0 0 auto',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: -3,
                  }}
                >
                  <div style={{ width: 3, height: 14, background: isStart || isEnd ? 'var(--purple)' : 'var(--ink)' }} />
                  <span
                    style={{
                      marginTop: 4,
                      fontSize: '0.72rem',
                      fontWeight: isStart || isEnd ? 800 : 500,
                      color: isStart ? 'var(--blue)' : isEnd ? 'var(--pink)' : 'inherit',
                    }}
                  >
                    {n}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <button className="btn btn-sm" style={{ alignSelf: 'center' }} onClick={reset}>
        🔄 Reset
      </button>
    </div>
  );
}

function Thesaurus({ student }: { student: Student }) {
  const [q, setQ] = useState('');
  const [word, setWord] = useState<string | null>(null);
  const [synonyms, setSynonyms] = useState<string[]>([]);
  const [antonyms, setAntonyms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (raw: string) => {
    const key = raw.trim().toLowerCase();
    if (!key) return;
    setQ(key);
    if (isBlockedTerm(key)) {
      setWord(null);
      setError("Let's look up a different word. Ask your teacher if you're not sure.");
      return;
    }
    setWord(key);
    setLoading(true);
    setError(null);
    try {
      const [syn, ant] = await Promise.all([fetchSynonyms(key), fetchAntonyms(key)]);
      setSynonyms(syn);
      setAntonyms(ant);
    } catch {
      setError("Couldn't reach the thesaurus right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="stack">
      <div className="row-wrap">
        <input
          placeholder="Type a word..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(q)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={() => search(q)}>
          🔍 Look up
        </button>
      </div>
      {loading && <p>Looking that up…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {!loading && !error && word && (
        <div className="stack" style={{ gap: 0, borderRadius: 16, overflow: 'hidden', border: '3px solid var(--content-border)' }}>
          <div
            className="row space-between"
            style={{ background: 'linear-gradient(120deg, var(--teal), var(--purple))', color: '#fff', padding: '14px 18px' }}
          >
            <div style={{ fontSize: '1.6rem', fontWeight: 800, textTransform: 'capitalize' }}>{word}</div>
            <button className="btn btn-sm" style={{ background: '#fff', minHeight: 44 }} onClick={() => speak(word, student.ttsSettings)}>🔈</button>
          </div>
          <div className="stack" style={{ padding: 16, background: '#fff' }}>
            <div>
              <strong style={{ fontSize: '0.85rem' }}>✅ Means about the same:</strong>
              {synonyms.length === 0 ? (
                <p style={{ fontSize: '0.85rem', opacity: 0.7 }}>No synonyms found.</p>
              ) : (
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  {synonyms.map((s) => (
                    <button key={s} className="tag-pill" style={{ cursor: 'pointer', minHeight: 36 }} onClick={() => search(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {antonyms.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.85rem' }}>🔁 Means the opposite:</strong>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  {antonyms.map((s) => (
                    <button key={s} className="tag-pill" style={{ cursor: 'pointer', minHeight: 36, background: 'var(--orange)' }} onClick={() => search(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Dictionary({ student }: { student: Student }) {
  const [q, setQ] = useState('');
  const [result, setResult] = useState<WordLookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [synonyms, setSynonyms] = useState<string[]>([]);

  const search = async (raw: string) => {
    const key = raw.trim().toLowerCase();
    if (!key) return;
    setQ(key);
    setResult(null);
    if (isBlockedTerm(key)) {
      setError("Let's look up a different word. Ask your teacher if you're not sure.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [def, syn] = await Promise.all([fetchDefinition(key), fetchSynonyms(key)]);
      if (!def) {
        setError(`No dictionary entry found for "${key}". Check the spelling?`);
      } else {
        setResult(def);
        setSynonyms(syn.slice(0, 5));
      }
    } catch {
      setError("Couldn't reach the dictionary right now. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const morphology = result ? analyzeMorphology(result.word) : null;

  return (
    <div className="stack">
      <div className="row-wrap">
        <input
          placeholder="Type a word..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search(q)}
          style={{ flex: 1, minWidth: 160 }}
        />
        <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} onClick={() => search(q)}>
          🔍 Look up
        </button>
      </div>
      {loading && <p>Looking that up…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {result && (
        <div className="stack" style={{ gap: 0, borderRadius: 16, overflow: 'hidden', border: '3px solid var(--content-border)' }}>
          <div
            className="row space-between"
            style={{ background: 'linear-gradient(120deg, var(--purple), var(--purple-dark))', color: '#fff', padding: '14px 18px' }}
          >
            <div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, textTransform: 'capitalize' }}>{result.word}</div>
              {result.phonetic && <span style={{ opacity: 0.85, fontSize: '0.85rem' }}>{result.phonetic}</span>}
            </div>
            <button
              className="btn btn-sm"
              style={{ background: '#fff', minHeight: 44 }}
              onClick={() => speak(`${result.word}. ${result.definitions[0]?.definition ?? ''}`, student.ttsSettings)}
            >
              🔈
            </button>
          </div>

          <div className="stack" style={{ padding: 16, background: '#fff' }}>
            {result.definitions.map((d, i) => (
              <div key={i} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--purple)', minWidth: 24 }}>{i + 1}</span>
                <div>
                  <span className="tag-pill" style={{ fontSize: '0.68rem', background: 'var(--yellow)' }}>{d.partOfSpeech}</span>
                  <p style={{ margin: '4px 0' }}>{d.definition}</p>
                  {d.example && <p style={{ margin: 0, fontStyle: 'italic', opacity: 0.7, fontSize: '0.85rem' }}>"{d.example}"</p>}
                </div>
              </div>
            ))}

            {morphology && (morphology.prefix || morphology.suffix) && (
              <div>
                <strong style={{ fontSize: '0.85rem' }}>🧩 Word Parts Matrix</strong>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${[morphology.prefix, true, morphology.suffix].filter(Boolean).length}, 1fr)`,
                    gap: 6,
                    marginTop: 6,
                  }}
                >
                  {morphology.prefix && (
                    <div className="stack" style={{ gap: 2, alignItems: 'center', textAlign: 'center', background: 'var(--purple)', color: '#fff', borderRadius: 10, padding: '8px 6px' }}>
                      <strong style={{ fontSize: '1.05rem' }}>{morphology.prefix.form}-</strong>
                      <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>{morphology.prefix.meaning}</span>
                    </div>
                  )}
                  <div className="stack" style={{ gap: 2, alignItems: 'center', textAlign: 'center', background: 'var(--yellow)', borderRadius: 10, padding: '8px 6px' }}>
                    <strong style={{ fontSize: '1.05rem' }}>{morphology.base}</strong>
                    <span style={{ fontSize: '0.68rem', opacity: 0.75 }}>base word</span>
                  </div>
                  {morphology.suffix && (
                    <div className="stack" style={{ gap: 2, alignItems: 'center', textAlign: 'center', background: 'var(--teal)', color: '#fff', borderRadius: 10, padding: '8px 6px' }}>
                      <strong style={{ fontSize: '1.05rem' }}>-{morphology.suffix.form}</strong>
                      <span style={{ fontSize: '0.68rem', opacity: 0.9 }}>{morphology.suffix.meaning}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {synonyms.length > 0 && (
              <div>
                <strong style={{ fontSize: '0.85rem' }}>✅ Similar words:</strong>
                <div className="row-wrap" style={{ marginTop: 4 }}>
                  {synonyms.map((s) => (
                    <button key={s} className="tag-pill" style={{ cursor: 'pointer', minHeight: 36 }} onClick={() => search(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SoundWall({ student }: { student: Student }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
      {SOUND_WALL.map((s) => (
        <button
          key={s.symbol}
          className="btn btn-sm"
          onClick={() => speak(`${s.symbol}, as in ${s.example}`, student.ttsSettings)}
          title={s.example}
        >
          {s.symbol}
        </button>
      ))}
    </div>
  );
}

// A small, Notes-app-style word processor: a list of independently saved
// documents (not one shared scratch blob) with basic per-note formatting —
// font and text color, both drawn only from what the student has unlocked
// in the Marketplace, so the picker never shows anything they can't use.
function WordProcessor({ student }: { student: Student }) {
  const notes = useStore((s) => s.notes);
  const createNote = useStore((s) => s.createNote);
  const updateNote = useStore((s) => s.updateNote);
  const deleteNote = useStore((s) => s.deleteNote);

  const myNotes = notes.filter((n) => n.studentId === student.id).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  const [selectedId, setSelectedId] = useState<string | null>(myNotes[0]?.id ?? null);
  const [fontSize, setFontSize] = useState(1.15);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const fontItems = marketplaceItems.filter((it) => it.kind === 'font');
  const colorItems = marketplaceItems.filter((it) => it.kind === 'color' && (it.colorUse ?? 'text') === 'text');
  const highlightItems = marketplaceItems.filter((it) => it.kind === 'color' && it.colorUse === 'highlight');

  const selected = myNotes.find((n) => n.id === selectedId) ?? null;
  const ownedFonts = fontItems.filter((f) => student.ownedFontIds.includes(f.id));
  const ownedColors = colorItems.filter((c) => student.ownedColorIds.includes(c.id));
  const ownedHighlights = highlightItems.filter((c) => student.ownedColorIds.includes(c.id));
  const activeFont = fontItems.find((f) => f.id === (selected?.fontId ?? student.equippedFontId)) ?? fontItems[0];
  const activeColor = colorItems.find((c) => c.id === (selected?.colorId ?? student.equippedColorId)) ?? colorItems[0];
  const activeHighlight = highlightItems.find((c) => c.id === (selected?.highlightColorId ?? student.equippedHighlightColorId));
  const wordCount = selected?.body.trim() ? selected.body.trim().split(/\s+/).length : 0;

  const handleNew = () => {
    const id = createNote(student.id);
    setSelectedId(id);
  };

  // The note body is an uncontrolled contentEditable (not a React-controlled
  // value) so a student can select just one word/phrase and color-code it —
  // React never touches its innerHTML except when switching to a different
  // note, which would otherwise reset the cursor on every keystroke.
  const bodyEditorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyEditorRef.current;
    if (!el) return;
    el.innerHTML = selected?.bodyHtml ?? escapeHtml(selected?.body ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const syncBodyFromDom = () => {
    const el = bodyEditorRef.current;
    if (!el || !selected) return;
    updateNote(selected.id, { bodyHtml: el.innerHTML, body: el.textContent ?? '' });
  };

  // Wraps the current text selection (if any, and if it's actually inside
  // this note) in a span carrying the given inline style — lets a student
  // color just one word or phrase without changing the color of the rest
  // of the note, so multiple colors can be used side by side for color-
  // coding. Returns false (does nothing) when there's no selection, so the
  // caller can fall back to the old "set the whole note's color" behavior.
  const applyStyleToSelection = (style: Partial<CSSStyleDeclaration>): boolean => {
    const el = bodyEditorRef.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return false;
    const span = document.createElement('span');
    Object.assign(span.style, style);
    try {
      range.surroundContents(span);
    } catch {
      // Selection crosses existing span boundaries (partial overlap) —
      // extract the fragment and wrap it instead.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }
    sel.removeAllRanges();
    syncBodyFromDom();
    return true;
  };

  const RAINBOW_STYLE: Partial<CSSStyleDeclaration> = {
    backgroundImage: 'repeating-linear-gradient(90deg, #e63946, #f4a300, #ffdd33, #2fae5d, #2a6df4, #7c3aed, #e63946)',
    backgroundSize: '140px 100%',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
  } as Partial<CSSStyleDeclaration>;

  return (
    <div className="row" style={{ height: '100%', minHeight: 0, gap: 12, alignItems: 'stretch' }}>
      <div className="stack" style={{ width: 170, flex: '0 0 auto', gap: 6, overflowY: 'auto' }}>
        <button className="btn btn-sm btn-primary" onClick={handleNew}>➕ New Note</button>
        {myNotes.length === 0 && <p style={{ fontSize: '0.78rem', opacity: 0.65 }}>No notes yet!</p>}
        {myNotes.map((n) => (
          <div key={n.id} className="stack" style={{ gap: 2 }}>
            <button
              className={`btn btn-sm ${selectedId === n.id ? 'btn-primary' : ''}`}
              style={{ textAlign: 'left', minHeight: 44 }}
              onClick={() => setSelectedId(n.id)}
            >
              <div className="stack" style={{ gap: 0 }}>
                <strong style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                  {n.title || 'Untitled'}
                </strong>
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{new Date(n.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
              </div>
            </button>
            {confirmDeleteId === n.id ? (
              <div className="row" style={{ gap: 4 }}>
                <button
                  className="btn btn-sm btn-danger"
                  style={{ fontSize: '0.7rem' }}
                  onClick={() => {
                    deleteNote(n.id);
                    if (selectedId === n.id) setSelectedId(myNotes.find((x) => x.id !== n.id)?.id ?? null);
                    setConfirmDeleteId(null);
                  }}
                >
                  Delete it
                </button>
                <button className="btn btn-sm" style={{ fontSize: '0.7rem' }} onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-sm" style={{ fontSize: '0.7rem', alignSelf: 'flex-end' }} onClick={() => setConfirmDeleteId(n.id)}>
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="stack" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {!selected ? (
          <p style={{ opacity: 0.7, margin: 'auto' }}>Tap "➕ New Note" to start writing!</p>
        ) : (
          <>
            <input
              value={selected.title}
              onChange={(e) => updateNote(selected.id, { title: e.target.value })}
              placeholder="Note title"
              style={{ fontWeight: 800, fontSize: '1.1rem' }}
            />
            <div className="row-wrap" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="row-wrap" style={{ gap: 4 }}>
                <button className="btn btn-sm" onClick={() => setFontSize((f) => Math.max(0.85, +(f - 0.15).toFixed(2)))} aria-label="Smaller text">A-</button>
                <button className="btn btn-sm" onClick={() => setFontSize((f) => Math.min(2, +(f + 0.15).toFixed(2)))} aria-label="Larger text">A+</button>
                {ownedFonts.length > 1 && (
                  <select value={activeFont?.id} onChange={(e) => updateNote(selected.id, { fontId: e.target.value })} style={{ fontSize: '0.8rem' }}>
                    {ownedFonts.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
                {ownedColors.length > 1 && (
                  <div className="row-wrap" style={{ gap: 4 }}>
                    {ownedColors.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const applied = applyStyleToSelection(c.colorHex === 'rainbow' ? RAINBOW_STYLE : { color: c.colorHex });
                          if (!applied) updateNote(selected.id, { colorId: c.id });
                        }}
                        aria-label={`${c.name} Text Color. Select some words first to color just those, or tap with nothing selected to set the whole note's color`}
                        title={`${c.name} Text Color`}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: '50%',
                          padding: 0,
                          cursor: 'pointer',
                          border: activeColor?.id === c.id ? '3px solid var(--ink)' : '2px solid var(--content-border)',
                          background: c.colorHex === 'rainbow' ? 'conic-gradient(red, orange, yellow, green, blue, purple, red)' : c.colorHex,
                        }}
                      />
                    ))}
                  </div>
                )}
                {ownedHighlights.length > 0 && (
                  <div className="row-wrap" style={{ gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>🖍️</span>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => updateNote(selected.id, { highlightColorId: null })}
                      aria-label="No highlight"
                      title="No highlight"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        padding: 0,
                        cursor: 'pointer',
                        background: '#fff',
                        border: !activeHighlight ? '3px solid var(--ink)' : '2px solid var(--content-border)',
                      }}
                    />
                    {ownedHighlights.map((c) => (
                      <button
                        key={c.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const applied = applyStyleToSelection({ backgroundColor: c.colorHex });
                          if (!applied) updateNote(selected.id, { highlightColorId: c.id });
                        }}
                        aria-label={`${c.name} Highlight. Select some words first to highlight just those, or tap with nothing selected to set the whole note's background`}
                        title={`${c.name} Highlight`}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          padding: 0,
                          cursor: 'pointer',
                          background: c.colorHex,
                          border: activeHighlight?.id === c.id ? '3px solid var(--ink)' : '2px solid var(--content-border)',
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
            </div>
            {(ownedColors.length > 1 || ownedHighlights.length > 0) && (
              <p style={{ fontSize: '0.7rem', opacity: 0.65, margin: 0 }}>
                💡 Select some words, then tap a color to color-code just that part. Tap a color with nothing selected to change the whole note.
              </p>
            )}
            <div style={{ background: activeHighlight?.colorHex ?? 'transparent', borderRadius: 12, padding: activeHighlight ? 6 : 0, flex: 1, minHeight: 0, display: 'flex' }}>
              <div
                ref={bodyEditorRef}
                className="note-editor"
                contentEditable
                suppressContentEditableWarning
                onInput={syncBodyFromDom}
                data-placeholder="Start writing..."
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 260,
                  overflowY: 'auto',
                  fontSize: `${fontSize}rem`,
                  lineHeight: 1.6,
                  padding: 14,
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  fontFamily: activeFont?.cssFontFamily,
                  ...(activeColor?.colorHex === 'rainbow'
                    ? {
                        background: 'repeating-linear-gradient(90deg, #e63946, #f4a300, #ffdd33, #2fae5d, #2a6df4, #7c3aed, #e63946)',
                        backgroundSize: '140px 100%',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                      }
                    : { background: activeHighlight ? 'transparent' : '#fff', color: activeColor?.colorHex }),
                }}
              />
            </div>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>🔒 Private, saved automatically</span>
              <button className="btn btn-sm btn-blue" onClick={() => speak(selected.body || 'Nothing written yet', student.ttsSettings, student.equippedVoiceId)}>
                🔈 Read it back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const WHITEBOARD_SIZES: { size: number; label: string }[] = [
  { size: 3, label: '· Thin' },
  { size: 6, label: '● Medium' },
  { size: 11, label: '⬤ Thick' },
];

// Marker colors are Marketplace items now (kind: 'color', colorUse:
// 'marker') so a teacher can add seasonal/limited ones — but the app
// still needs a color to draw with even before any are owned, so this
// falls back to plain black rather than leaving the canvas colorless.
function Whiteboard({ student }: { student: Student }) {
  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const updateStudent = useStore((s) => s.updateStudent);
  const markerColors = marketplaceItems.filter((it) => it.kind === 'color' && it.colorUse === 'marker' && student.ownedColorIds.includes(it.id));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const equipped = markerColors.find((c) => c.id === student.equippedMarkerColorId) ?? markerColors[0];
  const color = equipped?.colorHex ?? '#1f1147';
  const [size, setSize] = useState(6);
  const [erasing, setErasing] = useState(false);

  const posFor = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDraw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    last.current = posFor(e);
  };

  const moveDraw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !last.current) return;
    const p = posFor(e);
    ctx.strokeStyle = erasing ? '#ffffff' : color;
    ctx.lineWidth = erasing ? size * 5 : size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const endDraw = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="stack" style={{ height: '100%', minHeight: 0 }}>
      <div className="row-wrap" style={{ alignItems: 'center' }}>
        {markerColors.length === 0 && <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>Get marker colors in the 🛍️ Marketplace!</span>}
        {markerColors.map((c) => (
          <button
            key={c.id}
            onClick={() => {
              updateStudent(student.id, { equippedMarkerColorId: c.id });
              setErasing(false);
            }}
            aria-label={`${c.name} Marker`}
            title={`${c.name} Marker`}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: c.colorHex,
              cursor: 'pointer',
              padding: 0,
              border: !erasing && equipped?.id === c.id ? '3px solid var(--ink)' : '2px solid var(--content-border)',
            }}
          />
        ))}
        <span style={{ width: 1, height: 24, background: 'var(--content-border)', margin: '0 4px' }} />
        {WHITEBOARD_SIZES.map((s) => (
          <button
            key={s.size}
            className={`btn btn-sm ${!erasing && size === s.size ? 'btn-primary' : ''}`}
            onClick={() => {
              setSize(s.size);
              setErasing(false);
            }}
          >
            {s.label}
          </button>
        ))}
        <button className={`btn btn-sm ${erasing ? 'btn-primary' : ''}`} onClick={() => setErasing((v) => !v)}>
          🧽 Eraser
        </button>
        <button className="btn btn-sm btn-danger" onClick={clear}>
          🗑️ Clear
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        style={{
          width: '100%',
          flex: 1,
          minHeight: 300,
          background: 'white',
          border: '2px solid var(--content-border)',
          borderRadius: 12,
          touchAction: 'none',
          cursor: 'crosshair',
        }}
        onPointerDown={startDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
      <p style={{ fontSize: '0.75rem', opacity: 0.65, margin: 0 }}>🔒 Just for scratch work, not saved.</p>
    </div>
  );
}

function TTSSettingsPanel({ student }: { student: Student }) {
  const updateStudent = useStore((s) => s.updateStudent);
  const voiceItems = useStore((s) => s.marketplaceItems.filter((it) => it.kind === 'voice'));
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useState(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    load();
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = load;
  });
  return (
    <div className="stack">
      <div>
        <label>
          <input
            type="checkbox"
            checked={student.dyslexiaFont}
            onChange={(e) => updateStudent(student.id, { dyslexiaFont: e.target.checked })}
          />{' '}
          Dyslexia-friendly font (everywhere in the app)
        </label>
      </div>
      <hr className="divider" />
      <div>
        <label>Speed: {student.ttsSettings.rate.toFixed(1)}x</label>
        <input
          type="range"
          min={0.5}
          max={1.5}
          step={0.1}
          value={student.ttsSettings.rate}
          onChange={(e) => updateStudent(student.id, { ttsSettings: { ...student.ttsSettings, rate: parseFloat(e.target.value) } })}
        />
      </div>
      {voices.length > 0 && (
        <div>
          <label>Voice</label>
          <select
            value={student.ttsSettings.voiceURI ?? ''}
            onChange={(e) => updateStudent(student.id, { ttsSettings: { ...student.ttsSettings, voiceURI: e.target.value || null } })}
          >
            <option value="">Default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>
            ))}
          </select>
        </div>
      )}
      {student.ownedVoiceIds.length > 1 && (
        <div>
          <label>🎭 Voice Skin (from the Marketplace)</label>
          <div className="row-wrap">
            {voiceItems.filter((v) => student.ownedVoiceIds.includes(v.id)).map((v) => (
              <button
                key={v.id}
                className={`btn btn-sm ${student.equippedVoiceId === v.id || (!student.equippedVoiceId && v.id === 'voice-default') ? 'btn-primary' : ''}`}
                onClick={() => updateStudent(student.id, { equippedVoiceId: v.id === 'voice-default' ? null : v.id })}
              >
                {v.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <button className="btn btn-blue" onClick={() => speak('This is what I sound like!', student.ttsSettings, student.equippedVoiceId)}>
        🔈 Try it
      </button>
    </div>
  );
}

function QuietTool() {
  return (
    <div className="stack" style={{ alignItems: 'center', textAlign: 'center' }}>
      <p>Breathe in as the circle grows. Breathe out as it shrinks.</p>
      <div className="breathe-circle" />
    </div>
  );
}

interface Props {
  student: Student;
  // 'both' shows every subject's tools together — for screens with no one
  // active subject (Home, a subject's "all done"/"nothing assigned"
  // screen), so tools stay reachable there too instead of only while a
  // task is actually in progress.
  subject: Subject | 'both';
  variant?: 'fab' | 'inline';
  hideCalculator?: boolean; // quiz activities hide it — the point is fact fluency, not calculating the answer
}

// Always-available tools menu: a floating button on the normal page
// (variant="fab"), or a small header button when rendered inside the
// internal browser (variant="inline") so tools stay one tap away even
// while a student is inside an embedded external activity.
export default function ToolsPanel({ student, subject, variant = 'fab', hideCalculator = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState<ToolKey | null>(null);
  const [customOpen, setCustomOpen] = useState<CustomTool | null>(null);
  const recordToolUsage = useStore((s) => s.recordToolUsage);

  const subjectTools = (subject === 'both' ? [...SUBJECT_TOOLS.math, ...SUBJECT_TOOLS.literacy] : SUBJECT_TOOLS[subject]).filter(
    (t) => student.featureToggles[t] !== false,
  );
  const accessTools = ACCESSIBILITY_TOOLS.filter((t) => student.featureToggles[t] !== false && (!hideCalculator || t !== 'calculator'));
  const customTools = student.customTools.filter((c) => subject === 'both' || c.subject === subject || c.subject === 'both');

  const openTool = (tool: ToolKey) => {
    setOpen(tool);
    setMenuOpen(false);
    recordToolUsage(student.id, tool);
  };

  const renderTool = (tool: ToolKey) => {
    switch (tool) {
      case 'calculator': return <Calculator />;
      case 'multiplicationTable': return <MultiplicationTable />;
      case 'hundredsChart': return <HundredsChart />;
      case 'numberLine': return <NumberLine />;
      case 'thesaurus': return <Thesaurus student={student} />;
      case 'dictionary': return <Dictionary student={student} />;
      case 'soundWall': return <SoundWall student={student} />;
      case 'wordProcessor': return <WordProcessor student={student} />;
      case 'whiteboard': return <Whiteboard student={student} />;
      case 'tts': return <TTSSettingsPanel student={student} />;
      case 'breakVisual': return <QuietTool />;
      default: return null;
    }
  };

  const ToolRow = ({ tools, label }: { tools: ToolKey[]; label: string }) =>
    tools.length === 0 ? null : (
      <div>
        <div style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.75, marginBottom: 6 }}>{label}</div>
        <div className="row-wrap">
          {tools.map((t) => (
            <button key={t} className="btn btn-sm btn-ghost" onClick={() => openTool(t)} title={TOOL_LABELS[t]}>
              {TOOL_ICONS[t]} {TOOL_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
    );

  return (
    <>
      <button
        className={variant === 'fab' ? 'tools-fab' : 'btn btn-sm btn-teal'}
        onClick={() => setMenuOpen(true)}
        aria-label="My Tools"
        title="My Tools"
      >
        🧰{variant === 'inline' ? ' Tools' : ''}
      </button>

      {menuOpen && (
        <div className="overlay-backdrop" onClick={() => setMenuOpen(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="space-between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>🧰 My Tools</h3>
              <button className="btn btn-sm" onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div className="stack">
              <ToolRow tools={subjectTools} label="Subject Tools" />
              <ToolRow tools={accessTools} label="Accessibility Toolbar" />
              {customTools.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.75, marginBottom: 6 }}>More Tools</div>
                  <div className="row-wrap">
                    {customTools.map((c) => (
                      <button
                        key={c.id}
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          setCustomOpen(c);
                          setMenuOpen(false);
                        }}
                        title={c.label}
                      >
                        🔗 {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="overlay-backdrop" onClick={() => setOpen(null)}>
          <div
            className="overlay-panel chrome-frame"
            style={{
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              ...(WIDE_TOOLS.includes(open) ? { maxWidth: 900, width: '95vw', height: '85vh' } : {}),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-between" style={{ marginBottom: 12, flex: '0 0 auto' }}>
              <h3 style={{ margin: 0 }}>{TOOL_ICONS[open]} {TOOL_LABELS[open]}</h3>
              <button className="btn btn-sm" onClick={() => setOpen(null)}>✕</button>
            </div>
            <div className="content-well" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {renderTool(open)}
            </div>
          </div>
        </div>
      )}

      {customOpen && (
        <InternalBrowser url={customOpen.url} title={customOpen.label} onClose={() => setCustomOpen(null)} />
      )}
    </>
  );
}
