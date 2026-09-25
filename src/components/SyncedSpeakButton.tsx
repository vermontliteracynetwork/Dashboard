import { useCallback, useEffect, useRef, useState } from 'react';
import type { TTSSettings } from '../types';
import { buildUtterance } from './ReadAloud';

// TTS with synced word-highlighting — A23-ROADMAP Phase 1, the spec's
// own explicitly top-priority item ("TTS with synced word highlighting"),
// built as one shared component so every 🔈 button already in Literacy
// Manipulatives (GrammarSandbox.tsx) reads through the same engine
// instead of each spot calling the plain speak() from ReadAloud.tsx on
// its own. Word-boundary events (SpeechSynthesisUtterance.onboundary)
// aren't supported identically everywhere; this degrades gracefully —
// without boundary support the button still reads the text aloud exactly
// as before, it just never lights up a word (feature-detected per
// utterance via whether onboundary ever actually fires, not per-browser
// guesswork).
//
// Deliberately a single shared hook (useSyncedTTS) rather than one
// per-button: the browser's speechSynthesis engine can only speak one
// utterance at a time anyway, so one hook instance per screen (mounted
// once in GrammarSandbox, passed down) matches that real constraint and
// means starting a new 🔈 cleanly stops whatever was already reading,
// same as the old plain speak() (which always called
// window.speechSynthesis.cancel() first).

export interface SyncedTTS {
  activeId: string | null;
  wordIndex: number;
  speakSynced: (id: string, text: string, settings?: TTSSettings, voiceSkinId?: string | null) => void;
  stop: () => void;
}

// Splits on whitespace while keeping the whitespace tokens, so re-joining
// the array always reconstructs the original text exactly — needed both
// to render highlighted spans and to map a spoken charIndex back to
// "which word is this."
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

// Given the char offset onboundary reports, finds which non-whitespace
// token that offset falls inside (as an index into the non-whitespace
// words only, matching how HighlightedText below numbers them).
function wordIndexAtChar(text: string, charIndex: number): number {
  const tokens = tokenize(text);
  let pos = 0;
  let wordNum = -1;
  for (const t of tokens) {
    const isWord = !/^\s+$/.test(t);
    if (isWord) wordNum++;
    if (charIndex >= pos && charIndex < pos + t.length) return isWord ? wordNum : wordNum + 1;
    pos += t.length;
  }
  return wordNum;
}

export function useSyncedTTS(): SyncedTTS {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [wordIndex, setWordIndex] = useState(-1);
  const activeTextRef = useRef<string>('');

  useEffect(() => () => { try { window.speechSynthesis.cancel(); } catch { /* not supported */ } }, []);

  const stop = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch { /* not supported */ }
    setActiveId(null);
    setWordIndex(-1);
  }, []);

  const speakSynced = useCallback((id: string, text: string, settings?: TTSSettings, voiceSkinId?: string | null) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    activeTextRef.current = text;
    const utter = buildUtterance(text, settings, voiceSkinId);
    utter.onboundary = (e) => {
      if (activeTextRef.current !== text) return;
      setWordIndex(wordIndexAtChar(text, e.charIndex));
    };
    utter.onstart = () => setActiveId(id);
    utter.onend = () => { setActiveId(null); setWordIndex(-1); };
    utter.onerror = () => { setActiveId(null); setWordIndex(-1); };
    window.speechSynthesis.speak(utter);
  }, []);

  return { activeId, wordIndex, speakSynced, stop };
}

// Renders `text` as flowing spans, highlighting whichever word is
// currently being spoken when `active` is true. Words are numbered the
// same way wordIndexAtChar counts them, so tts.wordIndex always lines up
// with the right span. Purely additive visually when not active — reads
// as plain text.
export function HighlightedText({ text, active, wordIndex, style }: {
  text: string; active: boolean; wordIndex: number; style?: React.CSSProperties;
}) {
  const tokens = tokenize(text);
  let wordNum = -1;
  return (
    <span style={style}>
      {tokens.map((t, i) => {
        const isWord = !/^\s+$/.test(t);
        if (isWord) wordNum++;
        const highlighted = active && isWord && wordNum === wordIndex;
        return (
          <span
            key={i}
            style={highlighted ? { background: '#fde047', borderRadius: 3, boxShadow: '0 0 0 2px #fde047' } : undefined}
          >
            {t}
          </span>
        );
      })}
    </span>
  );
}

// The shared 🔈/🔊 button itself — a drop-in replacement for a plain
// `onClick={() => speak(...)}` button, wired to the shared hook above so
// its icon reflects whether THIS text is the one currently reading (not
// just "is anything reading").
export function SyncedSpeakButton({ id, text, tts, settings, voiceSkinId, label, ariaLabel, className, style }: {
  id: string;
  text: string;
  tts: SyncedTTS;
  settings?: TTSSettings;
  voiceSkinId?: string | null;
  label?: string;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const speaking = tts.activeId === id;
  return (
    <button
      type="button"
      className={className ?? 'btn btn-sm'}
      onClick={() => (speaking ? tts.stop() : tts.speakSynced(id, text, settings, voiceSkinId))}
      aria-label={ariaLabel ?? (label ? `Hear ${label}` : 'Hear this read aloud')}
      style={style}
    >
      {speaking ? '🔊' : '🔈'}
    </button>
  );
}
