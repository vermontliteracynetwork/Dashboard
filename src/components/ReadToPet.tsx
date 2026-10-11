import { useRef, useState } from 'react';
import { useStore } from '../store/store';
import { speakTrainee, startRecording, scoreReading, recordSpeakRead, READS_PER_SESSION, type Recording } from '../lib/petSpeak';
import { playCheer } from '../lib/petSounds';

// Speak training by reading aloud (her Pets v2 spec): in the Library's reader, a student whose pet
// is ready to learn Speak can record themselves reading the passage. The reading gets 1 to 3 stars;
// every 2 readings with 2 or more stars is one Speak session at Buff Doge's Gym.
export default function ReadToPet({ passage }: { passage: string }) {
  const studentId = useStore((s) => s.currentStudentId);
  useStore((s) => s.styleLooks); // stay current as tricks are learned
  const pet = studentId ? speakTrainee(studentId) : null;
  const rec = useRef<Recording | null>(null);
  const [state, setState] = useState<'idle' | 'rec' | 'scoring'>('idle');
  const [result, setResult] = useState<{ stars: number; text: string } | null>(null);
  const [err, setErr] = useState('');
  if (!pet) return null;

  const start = async () => {
    setErr(''); setResult(null);
    try { rec.current = await startRecording(true); setState('rec'); }
    catch { setErr('The microphone is not available. Ask your teacher to allow it.'); }
  };
  const stop = async () => {
    if (!rec.current) return;
    setState('scoring');
    const r = await rec.current.stop(); rec.current = null;
    const stars = scoreReading(passage, r.heard, r.voiced, r.recognized);
    const out = recordSpeakRead(pet.id, stars);
    let text = stars === 3 ? 'Great reading!' : stars === 2 ? 'I heard you read it. Nice work!' : "I couldn't hear much reading. Try again, nice and clear.";
    if (out.session) { text += ` That's ${READS_PER_SESSION} readings: ${pet.customName} finished a Speak session (${out.session.done} of ${out.session.need})!`; playCheer(); if (out.session.learned) text += ` ${pet.customName} learned Speak!`; }
    else if (out.counted) text += ` ${out.reads} of ${READS_PER_SESSION} readings toward ${pet.customName}'s next Speak session.`;
    setResult({ stars, text });
    setState('idle');
  };
  return (
    <div className="rtp">
      {state === 'rec'
        ? <button type="button" className="rtp-btn rec" onClick={stop}>⏹ Stop reading</button>
        : <button type="button" className="rtp-btn" onClick={start} disabled={state === 'scoring'}>{state === 'scoring' ? 'Listening back...' : `🎙️ Read it to ${pet.customName} (Speak training)`}</button>}
      {state === 'rec' && <span className="rtp-live" aria-live="polite">🔴 Recording. Read the passage out loud.</span>}
      {result && <div className="rtp-result" role="status"><span className="rtp-stars" aria-label={`${result.stars} of 3 stars`}>{'⭐'.repeat(result.stars)}{'☆'.repeat(3 - result.stars)}</span> {result.text}</div>}
      {err && <div className="rtp-result">{err}</div>}
    </div>
  );
}
