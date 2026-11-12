import { useState } from 'react';
import { speak } from './ReadAloud';
import type { TTSSettings } from '../types';

// The 4 digit code pad for locked Diary pages (Build Queue 624). Big number keys for the iPad. "set" asks for a new
// code twice; "open" checks the code. The teacher can always read every page and can change a forgotten code.
export default function DiaryCodePad({ mode, code, onDone, onCancel, tts }: {
  mode: 'set' | 'open'; code?: string; onDone: (code: string) => void; onCancel: () => void; tts?: TTSSettings;
}) {
  const [typed, setTyped] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const title = mode === 'open' ? 'This page is locked' : first ? 'Type your code again' : 'Make a 4 number code';
  const help = mode === 'open'
    ? 'Type your 4 number code to open it. Forgot it? Your teacher can help.'
    : first ? 'Type the same 4 numbers to be sure.' : 'Pick 4 numbers you will remember. Your locked pages are just for you, but your teacher can always read your diary to keep you safe.';
  const press = (d: string) => {
    if (typed.length >= 4) return;
    const t = typed + d;
    setTyped(t); setMsg(null);
    if (t.length < 4) return;
    window.setTimeout(() => {
      if (mode === 'open') {
        if (t === code) onDone(t); else { setMsg('That is not the code. Try again.'); setTyped(''); }
        return;
      }
      if (!first) { setFirst(t); setTyped(''); return; }
      if (t === first) onDone(t); else { setMsg('Those did not match. Make your code again.'); setFirst(null); setTyped(''); }
    }, 180);
  };
  return (
    <div className="overlay-backdrop" onClick={onCancel}>
      <div className="overlay-panel chrome-frame stack dcp" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <svg className="dcp-lock" width="44" height="44" viewBox="0 0 24 24" aria-hidden><rect x="4" y="10" width="16" height="11" rx="2.5" fill="#7c3aed" /><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#7c3aed" strokeWidth="2.4" fill="none" /><circle cx="12" cy="15.5" r="1.8" fill="#fff" /></svg>
        <strong className="dcp-title">{title}</strong>
        <p className="dcp-help">{help}</p>
        <div className="dcp-dots" aria-label={`${typed.length} of 4 numbers typed`}>{[0, 1, 2, 3].map((i) => <i key={i} className={i < typed.length ? 'on' : ''} />)}</div>
        {msg && <p className="dcp-msg" role="alert">{msg}</p>}
        <div className="dcp-keys">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => <button key={d} type="button" className="dcp-key" onClick={() => press(d)}>{d}</button>)}
          <button type="button" className="dcp-key dcp-small" onClick={() => speak(`${title}. ${help}`, tts)} aria-label="Read aloud">🔊</button>
          <button type="button" className="dcp-key" onClick={() => press('0')}>0</button>
          <button type="button" className="dcp-key dcp-small" onClick={() => setTyped((t) => t.slice(0, -1))} aria-label="Delete">Delete</button>
        </div>
        <button type="button" className="btn btn-lg" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
