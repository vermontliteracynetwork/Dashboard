import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useStore } from '../store/store';
import { speak } from './ReadAloud';
import InternalBrowser from './InternalBrowser';
import { THESAURUS, DICTIONARY, SOUND_WALL } from '../lib/wordData';
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
  const key = q.trim().toLowerCase();
  const results = THESAURUS[key];
  return (
    <div className="stack">
      <input placeholder="Type a word..." value={q} onChange={(e) => setQ(e.target.value)} />
      {key && (
        results ? (
          <div className="content-well">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{key}</strong>
              <button className="btn btn-sm btn-blue" onClick={() => speak(key, student.ttsSettings)}>🔈</button>
            </div>
            <p>{results.join(', ')}</p>
          </div>
        ) : (
          <p>No matches yet — try: {Object.keys(THESAURUS).slice(0, 6).join(', ')}...</p>
        )
      )}
    </div>
  );
}

function Dictionary({ student }: { student: Student }) {
  const [q, setQ] = useState('');
  const key = q.trim().toLowerCase();
  const def = DICTIONARY[key];
  return (
    <div className="stack">
      <input placeholder="Type a word..." value={q} onChange={(e) => setQ(e.target.value)} />
      {key && (
        def ? (
          <div className="content-well">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>{key}</strong>
              <button className="btn btn-sm btn-blue" onClick={() => speak(`${key}. ${def}`, student.ttsSettings)}>🔈</button>
            </div>
            <p>{def}</p>
          </div>
        ) : (
          <p>No matches yet — try: {Object.keys(DICTIONARY).slice(0, 6).join(', ')}...</p>
        )
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

function WordProcessor({ student }: { student: Student }) {
  const scratchText = useStore((s) => s.scratchText[student.id] ?? '');
  const setScratchText = useStore((s) => s.setScratchText);
  const [fontSize, setFontSize] = useState(1.15);
  const wordCount = scratchText.trim() ? scratchText.trim().split(/\s+/).length : 0;

  return (
    <div className="stack" style={{ height: '100%', minHeight: 0 }}>
      <div className="row-wrap" style={{ justifyContent: 'space-between' }}>
        <div className="row" style={{ gap: 4 }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.7, marginRight: 4 }}>Text size:</span>
          <button className="btn btn-sm" onClick={() => setFontSize((f) => Math.max(0.85, +(f - 0.15).toFixed(2)))} aria-label="Smaller text">A-</button>
          <button className="btn btn-sm" onClick={() => setFontSize((f) => Math.min(2, +(f + 0.15).toFixed(2)))} aria-label="Larger text">A+</button>
        </div>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>{wordCount} word{wordCount === 1 ? '' : 's'}</span>
      </div>
      <textarea
        value={scratchText}
        onChange={(e) => setScratchText(student.id, e.target.value)}
        style={{
          width: '100%',
          flex: 1,
          minHeight: 340,
          resize: 'vertical',
          fontSize: `${fontSize}rem`,
          lineHeight: 1.6,
          padding: 14,
          fontFamily: "'Nunito', sans-serif",
        }}
        placeholder="Start writing..."
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>🔒 Private, saved automatically</span>
        <button className="btn btn-sm btn-blue" onClick={() => speak(scratchText || 'Nothing written yet', student.ttsSettings)}>
          🔈 Read it back
        </button>
      </div>
    </div>
  );
}

const WHITEBOARD_COLORS = ['#1f1147', '#e63946', '#2a6df4', '#2fae5d', '#f4a300', '#8b5cf6'];
const WHITEBOARD_SIZES: { size: number; label: string }[] = [
  { size: 3, label: '· Thin' },
  { size: 6, label: '● Medium' },
  { size: 11, label: '⬤ Thick' },
];

function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState(WHITEBOARD_COLORS[0]);
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
        {WHITEBOARD_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => {
              setColor(c);
              setErasing(false);
            }}
            aria-label={`Color ${c}`}
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: c,
              cursor: 'pointer',
              padding: 0,
              border: !erasing && color === c ? '3px solid var(--ink)' : '2px solid var(--content-border)',
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
      <p style={{ fontSize: '0.75rem', opacity: 0.65, margin: 0 }}>🔒 Just for scratch work — not saved.</p>
    </div>
  );
}

function TTSSettingsPanel({ student }: { student: Student }) {
  const updateStudent = useStore((s) => s.updateStudent);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useState(() => {
    const load = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    load();
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = load;
  });
  return (
    <div className="stack">
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
      <button className="btn btn-blue" onClick={() => speak('This is what I sound like!', student.ttsSettings)}>
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
  subject: Subject;
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

  const subjectTools = SUBJECT_TOOLS[subject].filter((t) => student.featureToggles[t] !== false);
  const accessTools = ACCESSIBILITY_TOOLS.filter((t) => student.featureToggles[t] !== false && (!hideCalculator || t !== 'calculator'));
  const customTools = student.customTools.filter((c) => c.subject === subject || c.subject === 'both');

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
      case 'whiteboard': return <Whiteboard />;
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
