import { sfxOn } from './miniSfx';

// Build Queue 407 (Phase A): World Box's own sounds, made with Web Audio (no files): the sound of the biome in the
// middle of the view (birds in the meadow and forest, wind on snow and mountains, frogs in the wetland, waves at a
// lake, a dry breeze in the desert), hammer taps and stone clacks while something is built (one clack for each stone
// cube, so the volume is counted out loud), an XP chime, and a calm marimba music loop. Two sliders (0 to 5).
let ctx: AudioContext | null = null;
const ac = () => {
  if (!ctx) { try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};
let sfxScale = 0.8, musicScale = 0.6;
export const setWorldSfx = (step: number) => { sfxScale = Math.max(0, Math.min(5, step)) / 5; };
export const setWorldMusic = (step: number) => { musicScale = Math.max(0, Math.min(5, step)) / 5; if (bus) bus.gain.value = musicScale * 0.6; };
const ok = () => sfxOn() && sfxScale > 0;
function note(freq: number, at: number, dur: number, type: OscillatorType, vol: number, dest?: AudioNode, slide?: number) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at); if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(dest ?? c.destination); o.start(at); o.stop(at + dur + 0.05);
}
function noise(at: number, dur: number, vol: number, type: BiquadFilterType, freq: number, dest?: AudioNode) {
  const c = ac(); if (!c) return;
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / d.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = type; f.frequency.value = freq; g.gain.value = vol;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(dest ?? c.destination); s.start(at);
}
export const worldSfx = {
  tap: () => { const c = ac(); if (!c || !ok()) return; note(900, c.currentTime, 0.06, 'sine', 0.04 * sfxScale); },
  // Building: hammer taps, then one stone clack for each cube (up to 24), a little faster each time.
  build: (cubes = 4) => {
    const c = ac(); if (!c || !ok()) return; const t = c.currentTime, n = Math.min(24, Math.max(2, cubes));
    for (let i = 0; i < n; i++) { const at = t + i * Math.max(0.06, 0.16 - i * 0.004); noise(at, 0.05, 0.12 * sfxScale, 'bandpass', 1800 + (i % 3) * 300); note(220 + (i % 4) * 30, at, 0.08, 'triangle', 0.03 * sfxScale); }
  },
  chime: () => { const c = ac(); if (!c || !ok()) return; const t = c.currentTime; [784, 988, 1175, 1568].forEach((f, i) => note(f, t + i * 0.08, 0.5, 'sine', 0.05 * sfxScale)); },
  storm: () => { const c = ac(); if (!c || !ok()) return; noise(c.currentTime, 1.6, 0.18 * sfxScale, 'lowpass', 400); note(60, c.currentTime + 0.2, 1.2, 'sine', 0.06 * sfxScale, undefined, 40); },
  season: () => { const c = ac(); if (!c || !ok()) return; const t = c.currentTime; [523, 659, 784, 1047].forEach((f, i) => note(f, t + i * 0.12, 0.7, 'triangle', 0.04 * sfxScale)); },
};
// One small sound from the biome in view, played every couple of seconds.
export function ambience(biome: string, night: boolean) {
  const c = ac(); if (!c || !ok()) return; const t = c.currentTime, v = 0.025 * sfxScale;
  if (night) { if (Math.random() < 0.5) note(2400 + Math.random() * 400, t, 0.05, 'sine', v * 0.6); else note(380, t, 0.25, 'sine', v, undefined, 300); return; }
  if (biome === 'meadow' || biome === 'forest' || biome === 'hills') { const f = 2200 + Math.random() * 1400; note(f, t, 0.09, 'sine', v, undefined, f * 1.3); note(f * 1.1, t + 0.12, 0.08, 'sine', v, undefined, f * 0.9); }
  else if (biome === 'snow' || biome === 'mountain') noise(t, 1.8, v * 2.5, 'bandpass', 500 + Math.random() * 300);
  else if (biome === 'wetland') { note(140, t, 0.12, 'square', v * 0.7, undefined, 110); note(150, t + 0.18, 0.12, 'square', v * 0.7, undefined, 115); }
  else if (biome === 'lake') noise(t, 1.4, v * 2, 'lowpass', 700);
  else if (biome === 'desert') noise(t, 1.6, v * 1.6, 'highpass', 2500);
}
// The calm marimba loop (C major pentatonic), a soft pattern over a slow bass.
const PENT = [60, 62, 64, 67, 69, 72, 74, 76];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
let timer: number | null = null, bus: GainNode | null = null, step = 0, next = 0;
export function startWorldMusic() {
  const c = ac(); if (!c || timer !== null) return;
  bus = c.createGain(); bus.gain.value = musicScale * 0.6; bus.connect(c.destination);
  next = c.currentTime + 0.2; step = 0;
  const spb = 60 / 84 / 2;
  timer = window.setInterval(() => {
    const cc = ac(); if (!cc || !bus) return;
    bus.gain.value = sfxOn() ? musicScale * 0.6 : 0;
    while (next < cc.currentTime + 0.6) {
      if (step % 8 === 0) note(hz([48, 45, 41, 43][Math.floor(step / 8) % 4]), next, spb * 7, 'sine', 0.05, bus);
      if (Math.random() < 0.55) note(hz(PENT[Math.floor(Math.random() * PENT.length)]), next, spb * 2.5, 'triangle', 0.025, bus);
      next += spb; step++;
    }
  }, 200);
}
export function stopWorldMusic() {
  if (timer !== null) { clearInterval(timer); timer = null; }
  if (bus) { try { bus.disconnect(); } catch { /* gone */ } bus = null; }
}
