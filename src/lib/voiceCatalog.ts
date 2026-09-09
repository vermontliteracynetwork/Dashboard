export interface VoiceOption {
  id: string;
  name: string;
  price: number; // Class Cash, in cents; 0 = free starter, always owned
  pitch: number; // Web Speech API pitch (0-2), layered on top of the browser's chosen voice
  rate: number; // Web Speech API rate multiplier applied on top of the student's own TTS speed
  preferredVoiceNameHints: string[]; // lowercase substrings tried against getVoices() names, in order
}

// The browser's own installed voices are all a web app can use — there's
// no way to ship a real "Santa" voice file without licensing one. Instead
// each "voice" here is a fun preset: pick the closest-matching real system
// voice (falling back to the student's default), then reshape it with
// pitch/rate — the same trick real kids'-app "voice changers" use.
export const VOICE_CATALOG: VoiceOption[] = [
  { id: 'voice-default', name: 'My Voice', price: 0, pitch: 1, rate: 1, preferredVoiceNameHints: [] },
  { id: 'voice-robot', name: '🤖 Robot', price: 0, pitch: 0.3, rate: 0.9, preferredVoiceNameHints: [] },
  { id: 'voice-santa', name: '🎅 Santa', price: 400, pitch: 0.5, rate: 0.82, preferredVoiceNameHints: ['male', 'daniel', 'fred', 'david'] },
  { id: 'voice-fairy', name: '🧚 Fairy', price: 400, pitch: 1.8, rate: 1.15, preferredVoiceNameHints: ['female', 'samantha', 'victoria', 'karen'] },
  { id: 'voice-giant', name: '👹 Giant', price: 400, pitch: 0.2, rate: 0.75, preferredVoiceNameHints: ['male'] },
  { id: 'voice-chipmunk', name: '🐿️ Chipmunk', price: 400, pitch: 2, rate: 1.4, preferredVoiceNameHints: [] },
];

export const STARTER_VOICE_IDS: string[] = VOICE_CATALOG.filter((v) => v.price === 0).map((v) => v.id);

const BY_ID = new Map(VOICE_CATALOG.map((v) => [v.id, v]));
export function voiceOptionById(id: string): VoiceOption | undefined {
  return BY_ID.get(id);
}

// Finds the first installed system voice whose name contains any hint
// (case-insensitive); null if none match or there are no hints, so the
// caller falls back to the browser/OS default voice.
export function pickSystemVoice(hints: string[]): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window) || hints.length === 0) return null;
  const voices = window.speechSynthesis.getVoices();
  for (const hint of hints) {
    const match = voices.find((v) => v.name.toLowerCase().includes(hint));
    if (match) return match;
  }
  return null;
}
