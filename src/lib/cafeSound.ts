import { sfxOn } from './miniSfx';

// Build Queue 403 (her words: "All sound effects need to be updated for the cupcake game. Bakery timers should note when
// items are complete, background music should be light and playful cafe style music"). Cupcake Tycoon's own sounds,
// made on the iPad with Web Audio (no files to load): a mixer whir, an oven timer ding, a cash register cha-ching, a
// power-up sparkle, a power hum, and a soft jazzy cafe loop (electric piano chords, a walking bass, a light shaker and a
// few vibraphone notes). Everything follows the game's sound on/off switch.
let ctx: AudioContext | null = null;
const ac = () => {
  if (!ctx) { try { ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
};
function note(freq: number, at: number, dur: number, type: OscillatorType, vol: number, dest?: AudioNode) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(dest ?? c.destination); o.start(at); o.stop(at + dur + 0.05);
}
function noise(at: number, dur: number, vol: number, hp: number, dest?: AudioNode) {
  const c = ac(); if (!c) return;
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.buffer = b; s.connect(f); f.connect(g); g.connect(dest ?? c.destination); s.start(at);
}
let lastDing = 0, lastCash = 0;
export const cafe = {
  // Mixing starts: a short soft whir.
  mix: () => { const c = ac(); if (!c || !sfxOn()) return; const t = c.currentTime; note(180, t, 0.25, 'sawtooth', 0.015); note(240, t + 0.05, 0.2, 'sawtooth', 0.01); },
  // The oven timer: an item finished baking.
  ding: (soft = false) => { const c = ac(); if (!c || !sfxOn()) return; const t = c.currentTime; if (t - lastDing < 0.35) return; lastDing = t; const v = soft ? 0.03 : 0.07; note(1568, t, 0.9, 'sine', v); note(3136, t, 0.5, 'sine', v * 0.35); },
  // Sold: the cash register.
  cash: (soft = false) => { const c = ac(); if (!c || !sfxOn()) return; const t = c.currentTime; if (t - lastCash < 0.25) return; lastCash = t; const v = soft ? 0.025 : 0.06; noise(t, 0.06, v, 3000); note(2093, t + 0.05, 0.35, 'triangle', v); note(2637, t + 0.12, 0.4, 'triangle', v); },
  // A power-up starts.
  sparkle: () => { const c = ac(); if (!c || !sfxOn()) return; const t = c.currentTime; [1047, 1319, 1568, 2093, 2637].forEach((f, i) => note(f, t + i * 0.06, 0.35, 'sine', 0.05)); },
  // The ovens get power.
  power: () => { const c = ac(); if (!c || !sfxOn()) return; const t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'square'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.5); g.gain.setValueAtTime(0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 0.65); },
  // Not enough coins or power.
  nope: () => { const c = ac(); if (!c || !sfxOn()) return; const t = c.currentTime; note(330, t, 0.15, 'triangle', 0.04); note(262, t + 0.12, 0.2, 'triangle', 0.04); },
  tap: () => { const c = ac(); if (!c || !sfxOn()) return; note(880 + Math.random() * 120, c.currentTime, 0.08, 'sine', 0.035); },
};

// ---- the cafe music loop ----
// Fmaj7, Em7, Dm7, Cmaj7 at a relaxed swing, two bars each pass, scheduled a little ahead.
const CHORDS = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
const BASS = [[41, 45, 48, 45], [40, 43, 47, 43], [38, 41, 45, 41], [36, 40, 43, 40]];
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
let timer: number | null = null, bus: GainNode | null = null, beat = 0, next = 0;
export function startCafeMusic() {
  const c = ac(); if (!c || timer !== null) return;
  bus = c.createGain(); bus.gain.value = 0.5; bus.connect(c.destination);
  beat = 0; next = c.currentTime + 0.1;
  const spb = 60 / 92;
  timer = window.setInterval(() => {
    const cc = ac(); if (!cc || !bus) return;
    bus.gain.value = sfxOn() ? 0.5 : 0;
    while (next < cc.currentTime + 0.6) {
      const bar = Math.floor(beat / 4) % 4, b = beat % 4, ch = CHORDS[bar];
      if (b === 0 || b === 2) ch.forEach((m) => note(hz(m + 12), next + (b === 2 ? spb * 0.33 : 0), spb * 1.6, 'triangle', 0.012, bus!));
      note(hz(BASS[bar][b]), next, spb * 0.9, 'sine', 0.05, bus!);
      noise(next + spb * 0.66, 0.05, 0.012, 6000, bus!);
      if (Math.random() < 0.35) note(hz(ch[Math.floor(Math.random() * 4)] + 24), next + spb * 0.5, spb * 1.2, 'sine', 0.018, bus!);
      next += spb; beat++;
    }
  }, 200);
}
export function stopCafeMusic() {
  if (timer !== null) { clearInterval(timer); timer = null; }
  if (bus) { try { bus.disconnect(); } catch { /* gone */ } bus = null; }
}
