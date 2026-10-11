// Sounds for the adoption ceremony (her Pets v2 spec: "anticipatory music followed by
// cheering/announcement sound"). Synthesized with Web Audio, no files to load.
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx || ctx.state === 'closed') ctx = new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(c: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, vol: number) {
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.05);
}
function noiseBurst(c: AudioContext, at: number, dur: number, vol: number, hp = 800) {
  const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(at);
}

// A drumroll with a rising tune under it, for the wiggling gift box.
export function playAnticipation(ms: number): () => void {
  const c = ac(); if (!c) return () => {};
  const t0 = c.currentTime, end = t0 + ms / 1000;
  for (let t = t0; t < end; t += 0.06) noiseBurst(c, t, 0.05, 0.05 + 0.12 * ((t - t0) / (end - t0)), 1500);
  const notes = [262, 294, 330, 349, 392, 440, 494, 523];
  notes.forEach((f, i) => tone(c, f, t0 + (i * (end - t0)) / notes.length, 0.5, 'triangle', 0.08));
  let stopped = false;
  return () => { if (stopped) return; stopped = true; };
}
// The box bursting open: a pop and a bright fanfare.
export function playReveal() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  noiseBurst(c, t, 0.25, 0.35, 400);
  [523, 659, 784, 1047].forEach((f, i) => tone(c, f, t + 0.08 + i * 0.12, 0.6, 'square', 0.06));
  tone(c, 1047, t + 0.6, 1.2, 'triangle', 0.1);
  tone(c, 1319, t + 0.6, 1.2, 'triangle', 0.07);
}
// A crowd cheer: many short bright bursts, with firework pops.
export function playCheer() {
  const c = ac(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 40; i++) noiseBurst(c, t + Math.random() * 1.6, 0.25, 0.04, 1200 + Math.random() * 2000);
  for (let i = 0; i < 5; i++) { const at = t + 0.3 + i * 0.35; noiseBurst(c, at, 0.4, 0.2, 200); tone(c, 900 + Math.random() * 600, at, 0.3, 'sine', 0.05); }
}
