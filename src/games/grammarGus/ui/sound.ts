// Gentle machine sounds (plan 3.16.2, 8.6): soft thunks, bubbly puffs, a
// quiet "pssh" steam leak, a curtain swish and a star ding. Web Audio,
// low volume, and every sound respects the mute toggle.
let ctx: AudioContext | null = null;
let muted = false;
export const setGusMuted = (m: boolean) => { muted = m; };
// Machine noises go soft while Gus reads the sentence out loud (teacher 2026-10-07).
let level = 1;
export const setGusLevel = (v: number) => { level = v; };
// Sound sets from the Paint Shop (Garage extras, 2026-10-09): the same sounds, retuned.
let pitch = 1; let wave: OscillatorType | null = null;
export const setGusSoundSet = (id?: string) => {
  pitch = id === 'cartoon' ? 1.6 : id === 'giant' ? 0.6 : id === 'robot' ? 1.15 : 1;
  wave = id === 'robot' ? 'square' : id === 'cartoon' ? 'sine' : null;
};

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slideTo?: number, delay = 0) {
  if (muted) return;
  try {
    ctx = ctx ?? new AudioContext();
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = wave ?? type; o.frequency.setValueAtTime(freq * pitch, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo * pitch, t0 + dur);
    g.gain.setValueAtTime(Math.max(0.0002, vol * level * (wave === 'square' && type !== 'square' ? 0.5 : 1)), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
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
    f.type = 'highpass'; f.frequency.value = 1800 * pitch; g.gain.value = vol * level;
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
  // Fun part sounds (teacher 2026-10-07: "sound effects ... whenever possible").
  honk: () => { tone(196, 0.55, 'sawtooth', 0.07, 185); tone(247, 0.55, 'square', 0.025, 233); },
  boing: () => tone(160, 0.4, 'sine', 0.09, 620),
  whoosh: () => noise(0.45, 0.045),
  whee: () => tone(420, 0.45, 'sine', 0.05, 980),
  clack: () => { for (let i = 0; i < 5; i++) tone(1100 - i * 60, 0.03, 'square', 0.03, undefined, i * 0.07); },
  clank: () => { for (let i = 0; i < 3; i++) tone(170, 0.07, 'square', 0.035, 120, i * 0.12); },
  splosh: () => { noise(0.25, 0.05); tone(320, 0.22, 'sine', 0.06, 90); },
  heave: () => { tone(140, 0.25, 'triangle', 0.07, 210); tone(180, 0.3, 'triangle', 0.07, 300, 0.22); },
  copy: () => { tone(660, 0.07, 'square', 0.03); tone(880, 0.07, 'square', 0.03, undefined, 0.1); tone(660, 0.07, 'square', 0.03, undefined, 0.2); },
  whir: () => tone(90, 0.9, 'sawtooth', 0.018, 150),
  tada: () => { tone(523, 0.12, 'triangle', 0.06); tone(659, 0.12, 'triangle', 0.06, undefined, 0.12); tone(784, 0.3, 'triangle', 0.07, undefined, 0.24); },
  twang: () => tone(220, 0.35, 'sawtooth', 0.05, 110),
  warp: () => { tone(200, 0.6, 'sine', 0.06, 1200); tone(1200, 0.6, 'sine', 0.025, 200); },
  glug: () => { for (let i = 0; i < 3; i++) tone(320 - i * 40, 0.1, 'sine', 0.06, 150, i * 0.13); },
  popper: () => { noise(0.08, 0.09); tone(900, 0.12, 'square', 0.03, 1500, 0.05); },
  achoo: () => { tone(700, 0.18, 'sine', 0.05, 1300); noise(0.3, 0.08, 0.2); },
  gun: () => noise(0.14, 0.12),
  zap: () => tone(1500, 0.3, 'square', 0.03, 180),
  tick: () => { for (let i = 0; i < 4; i++) tone(1800, 0.03, 'square', 0.025, undefined, i * 0.09); },
  creak: () => { tone(150, 0.4, 'sawtooth', 0.03, 110); tone(110, 0.12, 'square', 0.05, 80, 0.42); },
  grind: () => { noise(0.4, 0.05); tone(80, 0.4, 'sawtooth', 0.04, 70); },
  crunch: () => { noise(0.25, 0.09); tone(120, 0.25, 'square', 0.05, 60); },
  clang: () => { tone(880, 0.3, 'triangle', 0.06, 860); tone(1320, 0.25, 'sine', 0.03, undefined, 0.02); },
  choo: () => { noise(0.18, 0.05); noise(0.18, 0.05, 0.25); tone(587, 0.3, 'triangle', 0.05, undefined, 0.5); tone(740, 0.3, 'triangle', 0.04, undefined, 0.5); },
  bonk: () => tone(260, 0.18, 'square', 0.05, 120),
  ahem: () => { tone(520, 0.08, 'square', 0.03, 440); tone(660, 0.1, 'square', 0.03, 560, 0.1); },
};
