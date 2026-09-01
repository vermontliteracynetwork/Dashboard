import { useState } from 'react';
import { useStore } from '../store/store';
import { speak } from './ReadAloud';
import { THESAURUS, DICTIONARY, SOUND_WALL } from '../lib/wordData';
import type { Student, ToolKey, Subject } from '../types';
import { ACCESSIBILITY_TOOLS, SUBJECT_TOOLS, TOOL_LABELS } from '../types';

const TOOL_ICONS: Record<ToolKey, string> = {
  calculator: '🧮',
  tts: '🔈',
  wordProcessor: '📝',
  breakVisual: '🧘',
  multiplicationTable: '✖️',
  hundredsChart: '💯',
  thesaurus: '🔄',
  dictionary: '📖',
  soundWall: '🔤',
};

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
  return (
    <div className="stack">
      <textarea
        value={scratchText}
        onChange={(e) => setScratchText(student.id, e.target.value)}
        rows={10}
        style={{ width: '100%', resize: 'vertical' }}
        placeholder="Start writing..."
      />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>✅ Saved automatically</span>
        <button className="btn btn-sm btn-blue" onClick={() => speak(scratchText || 'Nothing written yet', student.ttsSettings)}>
          🔈 Read it back
        </button>
      </div>
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
}

export default function ToolsPanel({ student, subject }: Props) {
  const [open, setOpen] = useState<ToolKey | null>(null);
  const recordToolUsage = useStore((s) => s.recordToolUsage);

  const subjectTools = SUBJECT_TOOLS[subject].filter((t) => student.featureToggles[t]);
  const accessTools = ACCESSIBILITY_TOOLS.filter((t) => student.featureToggles[t]);

  const openTool = (tool: ToolKey) => {
    setOpen(tool);
    recordToolUsage(student.id, tool);
  };

  const renderTool = (tool: ToolKey) => {
    switch (tool) {
      case 'calculator': return <Calculator />;
      case 'multiplicationTable': return <MultiplicationTable />;
      case 'hundredsChart': return <HundredsChart />;
      case 'thesaurus': return <Thesaurus student={student} />;
      case 'dictionary': return <Dictionary student={student} />;
      case 'soundWall': return <SoundWall student={student} />;
      case 'wordProcessor': return <WordProcessor student={student} />;
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
    <div className="chrome-frame stack" style={{ padding: 16 }}>
      <ToolRow tools={subjectTools} label="Subject Tools" />
      <ToolRow tools={accessTools} label="Accessibility Toolbar" />

      {open && (
        <div className="overlay-backdrop" onClick={() => setOpen(null)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 20 }} onClick={(e) => e.stopPropagation()}>
            <div className="space-between" style={{ marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{TOOL_ICONS[open]} {TOOL_LABELS[open]}</h3>
              <button className="btn btn-sm" onClick={() => setOpen(null)}>✕</button>
            </div>
            <div className="content-well">{renderTool(open)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
