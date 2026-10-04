import { useEffect, useRef, useState } from 'react';
import { playListeningStartChime, playListeningStopChime } from './audioCues';

// Speech to text, shared (re-extracted 2026-10-04 for the new "Say it"
// quiz question, its third independent use after Grammar Sandbox's Text
// Box, Symbol Sentence and Sentence Formula fields). The browser's own Web
// Speech API, feature-detected once. A chime plays when listening starts
// and stops, so a student who isn't looking still gets a cue.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;
export const voiceToTextSupported = !!SpeechRecognitionCtor;

export function useVoiceToText(onFinalText: (text: string) => void, { continuous = true }: { continuous?: boolean } = {}) {
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
    if (listening) { stop(); playListeningStopChime(); return; }
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'en-US';
    rec.continuous = continuous;
    rec.interimResults = false;
    rec.maxAlternatives = 3;
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
    playListeningStartChime();
  };

  return { listening, toggle, stop, supported: voiceToTextSupported };
}
