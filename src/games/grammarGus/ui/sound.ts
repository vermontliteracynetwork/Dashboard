// Gentle machine sounds (plan 3.16.2, 8.6): soft thunks, bubbly puffs, a
// quiet "pssh" steam leak, a curtain swish and a star ding. Web Audio,
// low volume, and every sound respects the mute toggle.
let ctx: AudioContext | null = null;
let muted = false;
export const setGusMuted = (m: boolean) => { muted = m; };

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slideTo?: number, delay = 0) {
  if (muted) return;
  try {
    ctx = ctx ?? new AudioContext();
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  } catch { /* no audio on this device: silent is fine */ }
}
function noise(dur: number, vol = 0.05, delay = 0) {
  if (muted) return;
  try {
    ctx = ctx ?? new AudioContext();
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800; g.gain.value = vol;
    src.buffer = buf; src.connect(f).connect(g).connect(ctx.destination); src.start(ctx.currentTime + delay);
  } catch { /* silent */ }
}

export const gusSound = {
  snap: () => tone(220, 0.09, 'triangle', 0.09, 140), // rubbery thunk
  part: (i: number) => tone(330 + i * 40, 0.12, 'sine', 0.05),
  puff: () => noise(0.18, 0.025),
  steam: () => noise(0.5, 0.04), // the friendly "pssh"
  rumble: () => tone(70, 1.8, 'sawtooth', 0.025, 60),
  swish: () => noise(0.35, 0.02),
  ding: () => { tone(988, 0.25, 'sine', 0.06); tone(1319, 0.35, 'sine', 0.05, undefined, 0.12); },
  horn: () => { tone(330, 0.18, 'sawtooth', 0.04, 300); tone(262, 0.3, 'sawtooth', 0.04, 240, 0.16); },
  ahem: () => { tone(520, 0.08, 'square', 0.03, 440); tone(660, 0.1, 'square', 0.03, 560, 0.1); },
};
