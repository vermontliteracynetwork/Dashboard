import { useEffect, useRef, useState } from 'react';

// The browser's own Web Speech API, feature-detected once at module scope
// (same pattern FeedbackTool.tsx already uses for its own voice-to-text).
// Shared here so every other long-form text field a student writes in
// gets the same communication-disorder-friendly "talk instead of typing"
// option, not just the Feedback tool.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;
export const voiceToTextSupported = !!SpeechRecognitionCtor;

export function useVoiceToText(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  // Always call the latest onFinalText without having to restart
  // recognition just because the caller's callback identity changed.
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
    rec.onresult = (e: SpeechRecognitionEvent) => {
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

  return { listening, toggle, stop, supported: voiceToTextSupported };
}
