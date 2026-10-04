import { useState } from 'react';
import { useVoiceToText, voiceToTextSupported } from '../lib/useVoiceToText';
import { isCloseEnoughAnswer } from '../lib/answerMatch';
import type { SpeakQuestion } from '../types';

// A "Say it" answer: tap the big microphone and say the answer. Graded
// with the same forgiving matcher as typed answers (a near-miss still
// counts), against the target word and any extra answers the teacher
// allowed. If the speech check gets it wrong, the student sees what was
// heard and can try again, or tap "That's what I said!" (counted as right
// and marked for the teacher). Without speech support (rare), it falls back
// to typing.
const heardMatches = (heard: string, q: SpeakQuestion) =>
  [q.targetWord, ...(q.acceptableVariants ?? [])].some((t) => t.trim() && (isCloseEnoughAnswer(heard, t) || heard.toLowerCase().split(/\s+/).some((w) => isCloseEnoughAnswer(w, t))));

export default function SpeakAnswer({ q, disabled, onResult }: { q: SpeakQuestion; disabled?: boolean; onResult: (correct: boolean, overrideConfirmed?: boolean) => void }) {
  const [heard, setHeard] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const check = (text: string) => {
    setHeard(text);
    if (heardMatches(text, q)) onResult(true);
  };
  const { listening, toggle } = useVoiceToText((t) => { check(t); }, { continuous: false });
  const wrong = heard !== null && !heardMatches(heard, q);

  if (!voiceToTextSupported) {
    return (
      <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
        <label htmlFor="speak-typed" style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.75 }}>Type your answer (this device can't listen)</label>
        <div className="row">
          <input id="speak-typed" value={typed} onChange={(e) => setTyped(e.target.value)} disabled={disabled} />
          <button className="btn btn-primary" disabled={disabled || !typed.trim()} onClick={() => onResult(heardMatches(typed, q))}>Check</button>
        </div>
      </div>
    );
  }
  return (
    <div className="stack speak-answer" style={{ alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        className={`speak-mic${listening ? ' on' : ''}`}
        disabled={disabled}
        onClick={toggle}
        aria-label={listening ? 'Listening. Tap to stop' : 'Tap and say your answer'}
      >
        🎤
      </button>
      <strong>{listening ? 'Listening... say your answer!' : heard === null ? 'Tap the microphone and say your answer' : wrong ? `I heard: "${heard}"` : `I heard: "${heard}" ✅`}</strong>
      {wrong && !disabled && (
        <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
          <button className="btn btn-lg" onClick={() => { setHeard(null); toggle(); }}>🎤 Try again</button>
          <button className="btn btn-lg" onClick={() => onResult(false)}>Next question</button>
          <button className="btn btn-lg btn-primary" onClick={() => onResult(true, true)}>That's what I said!</button>
        </div>
      )}
    </div>
  );
}
