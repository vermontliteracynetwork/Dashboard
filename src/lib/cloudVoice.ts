// Human voices for read-aloud (teacher 2026-10-12: "tts voices need to be completely human, no more
// robot sounds"). When the app's voice service is set up (api/tts.ts, OPENAI_API_KEY in Vercel), every
// read-aloud plays a real neural voice; otherwise callers fall back to the most human device voice.
let ready: boolean | null = null;
if (typeof window !== 'undefined') {
  fetch('/api/tts?probe=1').then((r) => { ready = r.ok; }).catch(() => { ready = false; });
}
let current: HTMLAudioElement | null = null;
export function stopCloudVoice() { if (current) { try { current.pause(); } catch { /* fine */ } current = null; } }
// Anything that stops speech with speechSynthesis.cancel() stops a human voice too.
if (typeof window !== 'undefined' && window.speechSynthesis) {
  const sy = window.speechSynthesis, cancel = sy.cancel.bind(sy);
  try { sy.cancel = () => { stopCloudVoice(); cancel(); }; } catch { /* read-only on this browser */ }
}
export interface VoiceEvents { onstart: (() => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
// Plays `text` in a human voice. Returns null when the service is not set up (use the device voice);
// `fallback` runs if the audio cannot play.
export function playCloudVoice(text: string, voice: string, rate = 1, fallback?: () => void): VoiceEvents | null {
  if (!ready || !text.trim()) return null;
  stopCloudVoice();
  window.speechSynthesis?.cancel();
  const a = new Audio(`/api/tts?v=${encodeURIComponent(voice)}&text=${encodeURIComponent(text.trim().slice(0, 900))}`);
  a.playbackRate = Math.min(1.4, Math.max(0.7, rate));
  const ev: VoiceEvents = { onstart: null, onend: null, onerror: null };
  let failed = false;
  const fail = () => { if (failed) return; failed = true; if (current === a) current = null; ev.onerror?.(); fallback?.(); };
  a.onplay = () => ev.onstart?.();
  a.onended = () => { if (current === a) current = null; ev.onend?.(); };
  a.onerror = fail;
  current = a;
  a.play().catch(fail);
  return ev;
}
