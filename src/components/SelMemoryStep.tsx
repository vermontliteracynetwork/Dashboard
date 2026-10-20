import { useEffect, useState } from 'react';
import { useVoiceToText } from '../lib/useVoiceToText';
import { speak } from './ReadAloud';
import type { TTSSettings } from '../types';

// A memory of the day before the feelings check-in (Build Queue 269, her words: "Memory of what happened in the
// day, small caption (memory recall of daily events) Select or take picture, write cation, emotional check in
// after"). The student takes or picks one picture and writes (or says) a short caption, then goes on to the
// Feelings Wheel. The memory is saved with that check-in and shows in the team report.
export interface SelMemory { caption: string; file?: File }

const SAY = 'What happened in your day? Take or pick a picture, then write a small caption.';

export default function SelMemoryStep({ name, tts, onNext }: { name: string; tts?: TTSSettings; onNext: (m: SelMemory | null) => void }) {
  const [caption, setCaption] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const voice = useVoiceToText((heard) => setCaption((c) => (c ? `${c} ${heard}` : heard)), { continuous: false });
  useEffect(() => { const t = window.setTimeout(() => speak(`Hi ${name}! ${SAY}`, tts), 300); return () => window.clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const pick = (f?: File | null) => { if (!f || !f.type.startsWith('image/')) return; if (url) URL.revokeObjectURL(url); setFile(f); setUrl(URL.createObjectURL(f)); };
  const ready = !!caption.trim() || !!file;
  return (
    <div className="fw-root">
      <div className="fw-energy selm">
        <h1>What happened in your day?
          <button type="button" className="fw-say" aria-label="Listen" onClick={() => speak(SAY, tts)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>
          </button>
        </h1>
        <div className="selm-pic">
          {url ? <img src={url} alt="My memory" /> : <span aria-hidden>🖼️</span>}
        </div>
        <div className="selm-row">
          <label className="fw-btn selm-btn">📷 Take a picture<input type="file" accept="image/*" capture="environment" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
          <label className="fw-btn selm-btn">🖼️ Pick a picture<input type="file" accept="image/*" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} /></label>
          {file && <button type="button" className="fw-btn" onClick={() => { setFile(null); setUrl(null); }}>✕ Remove</button>}
        </div>
        <label className="selm-cap">
          <span>My caption</span>
          <textarea value={caption} maxLength={160} rows={2} placeholder="I played tag with my friends at recess." onChange={(e) => setCaption(e.target.value)} />
        </label>
        <div className="selm-row">
          {voice.supported && <button type="button" className={`fw-btn${voice.listening ? ' on' : ''}`} onClick={voice.toggle}>{voice.listening ? '⏹️ Stop' : '🎤 Say it'}</button>}
          {caption.trim() && <button type="button" className="fw-btn" onClick={() => speak(caption, tts)}>🔊 Hear it</button>}
        </div>
        <button type="button" className="btn btn-primary btn-lg" disabled={!ready} onClick={() => { voice.stop(); onNext({ caption: caption.trim(), file: file ?? undefined }); }}>Next: how I feel →</button>
        <button type="button" className="fw-btn selm-skip" onClick={() => { voice.stop(); onNext(null); }}>Skip the memory</button>
      </div>
    </div>
  );
}
