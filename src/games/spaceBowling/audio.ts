// Space Bowling sound: background music (the teacher's three space tracks)
// and sound effects, each with its own Off / Low / Medium / High level.
// Uses Web Audio gain nodes so the levels also work on iPad (Safari ignores
// an audio element's own volume setting).

export type Level = 'off' | 'low' | 'medium' | 'high';
export const LEVELS: Level[] = ['off', 'low', 'medium', 'high'];
const GAIN: Record<Level, number> = { off: 0, low: 0.18, medium: 0.4, high: 0.75 };

const TRACKS = ['/games/space-bowling/audio/space-sprinkles.mp3', '/games/space-bowling/audio/through-space.ogg', '/games/space-bowling/audio/blast-off.mp3'];
const SFX = {
  roll: '/games/space-bowling/sfx/roll.ogg',
  crash: '/games/space-bowling/sfx/pins-crash.wav',
  crashBig: '/games/space-bowling/sfx/pins-crash-big.wav',
  strike: '/games/space-bowling/sfx/voice-strike.wav',
  spare: '/games/space-bowling/sfx/voice-spare.wav',
  gutter: '/games/space-bowling/sfx/voice-gutter.wav',
  victory: '/games/space-bowling/sfx/voice-victory.wav',
  gameOver: '/games/space-bowling/sfx/voice-game_over.wav',
  zap: '/games/space-bowling/sfx/zap.ogg',
  ufo: '/games/space-bowling/sfx/ufo-beam.ogg',
  boom: '/games/space-bowling/sfx/boom.ogg',
  shuttle: '/games/space-bowling/sfx/shuttle.ogg',
  ui: '/games/space-bowling/sfx/ui.ogg',
  blip: '/games/space-bowling/sfx/blip.ogg',
} as const;
export type Sfx = keyof typeof SFX;

let ctx: AudioContext | null = null;
let musicGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicEl: HTMLAudioElement | null = null;
let trackIndex = Math.floor(Math.random() * TRACKS.length);
const buffers = new Map<string, AudioBuffer>();

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
      musicGain = ctx.createGain();
      sfxGain = ctx.createGain();
      musicGain.connect(ctx.destination);
      sfxGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function setLevels(music: Level, sfx: Level) {
  const a = audio();
  if (!a || !musicGain || !sfxGain) return;
  musicGain.gain.setTargetAtTime(GAIN[music], a.currentTime, 0.1);
  sfxGain.gain.setTargetAtTime(GAIN[sfx], a.currentTime, 0.05);
  if (music === 'off') musicEl?.pause();
  else if (musicEl?.paused) void musicEl.play().catch(() => {});
}

// Starts (or resumes) the music, moving to the next track when one ends.
export function startMusic(level: Level) {
  const a = audio();
  if (!a || !musicGain) return;
  if (!musicEl) {
    musicEl = new Audio(TRACKS[trackIndex]);
    musicEl.crossOrigin = 'anonymous';
    musicEl.preload = 'auto';
    a.createMediaElementSource(musicEl).connect(musicGain);
    musicEl.addEventListener('ended', () => {
      trackIndex = (trackIndex + 1) % TRACKS.length;
      if (musicEl) { musicEl.src = TRACKS[trackIndex]; void musicEl.play().catch(() => {}); }
    });
  }
  if (level !== 'off') void musicEl.play().catch(() => {});
}
export function stopMusic() { musicEl?.pause(); }

export async function preloadSfx() {
  const a = audio();
  if (!a) return;
  await Promise.all(Object.values(SFX).map(async (url) => {
    if (buffers.has(url)) return;
    try {
      const res = await fetch(url);
      const buf = await a.decodeAudioData(await res.arrayBuffer());
      buffers.set(url, buf);
    } catch { /* missing or unsupported: just stay quiet */ }
  }));
}

export function sfx(name: Sfx, rate = 1, vol = 1) {
  const a = audio();
  const buf = buffers.get(SFX[name]);
  if (!a || !buf || !sfxGain) return;
  const src = a.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = a.createGain();
  g.gain.value = vol;
  src.connect(g).connect(sfxGain);
  src.start();
}

// A cartoon alien-cat "mrrow" (synthesized): a buzzy voice through a vowel
// filter that slides up and back down.
export function meow(pitch = 1) {
  const a = audio();
  if (!a || !sfxGain) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(420 * pitch, t);
  o.frequency.exponentialRampToValueAtTime(760 * pitch, t + 0.12);
  o.frequency.exponentialRampToValueAtTime(380 * pitch, t + 0.42);
  f.type = 'bandpass';
  f.Q.value = 6;
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(1800, t + 0.15);
  f.frequency.exponentialRampToValueAtTime(800, t + 0.42);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(f).connect(g).connect(sfxGain);
  o.start(t);
  o.stop(t + 0.5);
}
