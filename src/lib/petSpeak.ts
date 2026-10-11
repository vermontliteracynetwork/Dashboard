import { useStore } from '../store/store';
import { creditSession, trickSessionsOf, speakOpen, isLearned } from './petGym';
import { petDefById } from './petCatalog';

// Speak (her Pets v2 spec, 2026-10-11): "Training for speak skill can be expedited by the student
// recording themselves reading passages ... Only a score out of three stars should be give to the
// student - 1 star equals poorest quality, unrecognizable speech, no sound - 2 stars equals heard
// it and it was okay, some words out of order or incorrect - 3 stars is great quality reading ...
// Every two passages read equates to one session of training." and "It should be like Talking
// pets, Talking Ben the dog - randomize responses, repeating the voices, echolalia".

export const READS_PER_SESSION = 2;
const readsOwner = (petId: string) => `speakreads:${petId}`;
export function speakReadsOf(petId: string): number {
  return ((useStore.getState().styleLooks.find((r) => r.ownerId === readsOwner(petId))?.look as { n?: number } | undefined)?.n ?? 0);
}
// The first pet that is ready to train Speak (every other trick learned, Speak not learned yet).
export function speakTrainee(studentId: string) {
  return useStore.getState().pets.find((p) => p.studentId === studentId && speakOpen(trickSessionsOf(p.id)) && !isLearned(trickSessionsOf(p.id), 'Speak')) ?? null;
}
// A passage read with 2 or 3 stars counts; every 2 counted passages is one Speak session.
export function recordSpeakRead(petId: string, stars: number): { counted: boolean; reads: number; session?: { done: number; need: number; learned: boolean } } {
  if (stars < 2) return { counted: false, reads: speakReadsOf(petId) };
  const reads = speakReadsOf(petId) + 1;
  if (reads >= READS_PER_SESSION) {
    useStore.getState().mergeStyleRow(readsOwner(petId), { n: 0 });
    return { counted: true, reads: 0, session: creditSession(petId, 'Speak') };
  }
  useStore.getState().mergeStyleRow(readsOwner(petId), { n: reads });
  return { counted: true, reads };
}

// Scores a reading: what speech recognition heard compared with the passage, or (when this device
// cannot recognize speech) how much of the expected reading time had a voice in it.
export function scoreReading(passage: string, heard: string, voicedSeconds: number, recognized: boolean): number {
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 1);
  const pw = norm(passage), expected = Math.max(5, pw.length / 2.3);
  if (!recognized) {
    const ratio = voicedSeconds / expected;
    return ratio >= 0.3 ? 2 : 1;
  }
  const hw = norm(heard);
  if (hw.length < 3 && voicedSeconds < 3) return 1;
  const bag = new Set(pw);
  const hits = hw.filter((w) => bag.has(w)).length;
  const coverage = hits / Math.min(pw.length, 250);
  const accuracy = hw.length ? hits / hw.length : 0;
  if (coverage >= 0.55 && accuracy >= 0.7) return 3;
  if (coverage >= 0.12 || voicedSeconds / expected >= 0.3) return 2;
  return 1;
}

// The pet talks back (Talking Ben): plays the student's own words back in a squeaky pet voice, or
// says something silly of its own.
const DOG_LINES = ['Woof! Hello!', 'Ruff ruff! You are my best friend!', 'Woof? Do you have a treat?', 'Arf! Let us play fetch!', 'Bork! I love you!'];
const CAT_LINES = ['Meow! Hello!', 'Mrrrp? Pet me please.', 'Meow meow! I am the boss.', 'Purrr. I like you.', 'Mew! Is it snack time?'];
export function petVoiceLine(defId: string): string {
  const lines = petDefById(defId)?.category === 'cat' ? CAT_LINES : DOG_LINES;
  return lines[Math.floor(Math.random() * lines.length)];
}
export function sayInPetVoice(text: string) {
  try {
    const sy = window.speechSynthesis; if (!sy) return;
    sy.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.pitch = 1.9; u.rate = 1.15;
    sy.speak(u);
  } catch { /* no voice on this device */ }
}
export async function playSqueaky(blob: Blob) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const src = ctx.createBufferSource();
    src.buffer = buf; src.playbackRate.value = 1.55;
    src.connect(ctx.destination); src.start();
    src.onended = () => ctx.close();
  } catch { /* could not play it back */ }
}

// Records from the microphone; resolves with the clip and how many seconds had a voice in it.
export interface Recording { stop: () => Promise<{ blob: Blob | null; voiced: number; heard: string; recognized: boolean }> }
export async function startRecording(listen = false): Promise<Recording> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks: Blob[] = [];
  let rec: MediaRecorder | null = null;
  try { rec = new MediaRecorder(stream); rec.ondataavailable = (e) => chunks.push(e.data); rec.start(); } catch { rec = null; }
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const an = ctx.createAnalyser(); an.fftSize = 1024;
  ctx.createMediaStreamSource(stream).connect(an);
  const data = new Uint8Array(an.fftSize);
  let voiced = 0, last = performance.now();
  const tick = window.setInterval(() => {
    an.getByteTimeDomainData(data);
    let sum = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
    const now = performance.now();
    if (Math.sqrt(sum / data.length) > 0.04) voiced += (now - last) / 1000;
    last = now;
  }, 100);
  // Speech recognition where the device has it (Safari on iPad and Chrome do).
  type SR = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null };
  const SRC = (window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition;
  let heard = '';
  let sr: SR | null = null;
  if (listen && SRC) {
    try {
      sr = new SRC(); sr.continuous = true; sr.interimResults = false; sr.lang = 'en-US';
      sr.onresult = (e) => { heard = Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(' '); };
      sr.onerror = () => {};
      sr.start();
    } catch { sr = null; }
  }
  return {
    stop: () => new Promise((resolve) => {
      window.clearInterval(tick);
      try { sr?.stop(); } catch { /* fine */ }
      const done = () => { stream.getTracks().forEach((t) => t.stop()); void ctx.close(); window.setTimeout(() => resolve({ blob: chunks.length ? new Blob(chunks, { type: chunks[0].type }) : null, voiced, heard, recognized: !!sr }), 400); };
      if (rec && rec.state !== 'inactive') { rec.onstop = done; rec.stop(); } else done();
    }),
  };
}
