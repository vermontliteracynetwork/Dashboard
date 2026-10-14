import { useEffect, useRef, useState } from 'react';
import { useVoiceToText } from '../../lib/useVoiceToText';
import { uploadVoiceMemo } from '../../lib/upload';
import { snSound } from '../../lib/supernature';

// Say it first, then copy it (Build Queue 162, her words 2026-10-14: "add a voice memo feature for
// students to copy their words"). The student records their idea out loud; their own words appear in big
// print with their own voice to play back, so they can copy them into the writing box themselves (the
// copying is the writing practice, so nothing is filled in for them). Words come from the device's speech
// to text while recording, or from the app's transcript service after.
const MAX = 45;

export default function SayItMemo({ label = 'Say it first, then copy your words', prompt }: { label?: string; prompt?: string }) {
  const [rec, setRec] = useState<{ secs: number } | null>(null);
  const [memo, setMemo] = useState<{ url: string; blob: Blob } | null>(null);
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const ref = useRef<{ r: MediaRecorder; stream: MediaStream; timer: number } | null>(null);
  const heard = useRef('');
  const voice = useVoiceToText((t) => { heard.current = heard.current ? `${heard.current} ${t}` : t; setWords(heard.current); }, { continuous: true });
  useEffect(() => () => { const c = ref.current; if (c) { window.clearInterval(c.timer); c.stream.getTracks().forEach((t) => t.stop()); } }, []);

  const stop = () => {
    const c = ref.current; if (!c) return;
    window.clearInterval(c.timer); try { if (c.r.state !== 'inactive') c.r.stop(); } catch { /* stopped */ }
    ref.current = null; setRec(null); if (voice.listening) voice.stop();
  };
  const start = async () => {
    setNote(''); heard.current = ''; setWords(''); setMemo(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      if (voice.supported) { voice.toggle(); setNote('Talk now. Your words will show below.'); } else setNote('This device cannot record. Ask your teacher for help.');
      return;
    }
    try {
      window.speechSynthesis?.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream); const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const t0 = Date.now();
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        if (!blob.size) return;
        setMemo({ url: URL.createObjectURL(blob), blob });
        // No words from the device: ask the transcript service instead.
        if (!heard.current.trim()) {
          setBusy(true);
          try {
            const url = await uploadVoiceMemo(blob);
            const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
            const j = res.ok ? await res.json() as { text?: string } : null;
            if (j?.text) setWords(j.text.trim()); else setNote('I could not write down your words this time. Play your memo and copy what you hear.');
          } catch { setNote('I could not write down your words this time. Play your memo and copy what you hear.'); }
          setBusy(false);
        }
      };
      r.start(); snSound('tap');
      const timer = window.setInterval(() => { const secs = Math.round((Date.now() - t0) / 1000); setRec({ secs }); if (secs >= MAX) stop(); }, 500);
      ref.current = { r, stream, timer }; setRec({ secs: 0 });
      if (voice.supported && !voice.listening) { try { voice.toggle(); } catch { /* recording still works */ } }
    } catch { setNote('The microphone is turned off. Ask your teacher to turn it on.'); }
  };

  return (
    <div className="say-memo">
      <b>🎙️ {label}</b>
      {prompt && <small>{prompt}</small>}
      <div className="say-memo-row">
        {rec ? <button type="button" className="sn-btn2 live" onClick={stop}>⏹️ Stop ({rec.secs}s)</button>
          : <button type="button" className="sn-btn2 go" onClick={start}>{memo || words ? '🎙️ Say it again' : '🎙️ Record my idea'}</button>}
        {!rec && voice.listening && <button type="button" className="sn-btn2 live" onClick={voice.stop}>⏹️ Stop listening</button>}
        {memo && <audio controls src={memo.url} />}
      </div>
      {busy && <p className="say-memo-note">Writing down your words...</p>}
      {words && <p className="say-memo-words" aria-live="polite"><span>Your words. Now copy them:</span>{words}</p>}
      {note && <p className="say-memo-note">{note}</p>}
    </div>
  );
}
