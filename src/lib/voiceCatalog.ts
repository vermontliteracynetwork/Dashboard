// Finds the first installed system voice whose name contains any hint
// (case-insensitive); null if none match or there are no hints, so the
// caller falls back to the browser/OS default voice. Used to approximate a
// marketplace voice-skin item (e.g. "Santa") with the closest real voice
// the browser has installed, since there's no way to ship real branded
// voice audio in a web app.
export function pickSystemVoice(hints: string[]): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window) || hints.length === 0) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const hint of hints) {
    const match = voices.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  return null;
}
