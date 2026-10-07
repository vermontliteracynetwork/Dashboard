// Shape Dash sounds (Web Audio, no files): a bouncy beat that speeds up
// with the level, and soft effects. Geometry Dash is a music game, so the
// beat is part of the fun; both can be turned off.
let ctx: AudioContext | null = null;
let musicOn = true; let sfxOn = true;
let timer = 0; let bus: GainNode | null = null; let stepN = 0; let nextAt = 0; let bpm = 118; let key = 0;
const ac = () => (ctx = ctx ?? new AudioContext());
export function setSound(music: boolean, effects: boolean) { musicOn = music; sfxOn = effects; if (!music) stopMusic(); }

function tone(f: number, dur: number, vol: number, type: OscillatorType, at: number, out: AudioNode, slide?: number) {
  const c = ac(); const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, at); if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + dur);
  g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out); o.start(at); o.stop(at + dur + 0.02);
}
function hat(at: number, out: AudioNode, vol = 0.05) {
  const c = ac(); const len = Math.floor(c.sampleRate * 0.04); const b = c.createBuffer(1, len, c.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); const f = c.createBiquadFilter(); const g = c.createGain(); f.type = 'highpass'; f.frequency.value = 6000; g.gain.value = vol;
  s.buffer = b; s.connect(f).connect(g).connect(out); s.start(at);
}
const SCALE = [0, 3, 5, 7, 10, 12];
const BASS = [0, 0, 5, 3];
const MEL = [12, 10, 7, 10, 12, 15, 12, 7];
function schedule() {
  const c = ac(); if (!bus) return;
  const beat = 60 / bpm / 2; // eighth notes
  while (nextAt < c.currentTime + 0.2) {
    const i = stepN % 32; const bar = Math.floor(stepN / 8) % 4;
    const root = 110 * 2 ** ((key + BASS[bar]) / 12);
    if (i % 4 === 0) tone(120, 0.14, 0.32, 'sine', nextAt, bus, 45); // kick
    if (i % 2 === 1) hat(nextAt, bus);
    if (i % 8 === 4) hat(nextAt, bus, 0.09);
    if (i % 2 === 0) tone(root, beat * 0.9, 0.09, 'triangle', nextAt, bus);
    if (i % 4 === 2) { const m = MEL[(stepN / 4 + bar) % MEL.length | 0]; tone(root * 2 ** ((m + SCALE[bar % SCALE.length]) / 12), beat * 1.6, 0.035, 'square', nextAt, bus); }
    nextAt += beat; stepN++;
  }
}
export function startMusic(level: number) {
  if (!musicOn) return;
  try {
    const c = ac(); void c.resume();
    bpm = Math.min(150, 112 + level * 4); key = [0, 2, 5, 7, 3][level % 5];
    if (timer) return;
    bus = c.createGain(); bus.gain.value = 0.55; bus.connect(c.destination);
    nextAt = c.currentTime + 0.05; stepN = 0;
    timer = window.setInterval(schedule, 60);
  } catch { /* no sound on this device */ }
}
export function stopMusic() { window.clearInterval(timer); timer = 0; try { bus?.disconnect(); } catch { /* fine */ } bus = null; }
export function pauseMusic(p: boolean) { if (bus) bus.gain.value = p ? 0.12 : 0.55; }

const fx = (fn: (c: AudioContext, t: number) => void) => { if (!sfxOn) return; try { const c = ac(); void c.resume(); fn(c, c.currentTime); } catch { /* silent */ } };
export const sfx = {
  jump: () => fx((c, t) => tone(330, 0.16, 0.12, 'square', t, c.destination, 660)),
  pad: () => fx((c, t) => tone(260, 0.35, 0.14, 'sawtooth', t, c.destination, 1040)),
  coin: () => fx((c, t) => { tone(988, 0.08, 0.1, 'square', t, c.destination); tone(1319, 0.2, 0.1, 'square', t + 0.07, c.destination); }),
  checkpoint: () => fx((c, t) => [523, 659, 784].forEach((f, i) => tone(f, 0.25, 0.1, 'triangle', t + i * 0.08, c.destination))),
  crash: () => fx((c, t) => { tone(220, 0.4, 0.16, 'sawtooth', t, c.destination, 60); hat(t, c.destination, 0.2); }),
  shield: () => fx((c, t) => [784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 0.08, 'sine', t + i * 0.05, c.destination))),
  saved: () => fx((c, t) => { tone(600, 0.2, 0.12, 'triangle', t, c.destination, 1200); }),
  win: () => fx((c, t) => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 0.1, 'square', t + i * 0.1, c.destination))),
  tap: () => fx((c, t) => tone(660, 0.06, 0.06, 'sine', t, c.destination)),
};
