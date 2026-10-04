// Style's sound effects (synthesized, no audio files). Per the teacher's
// standing instruction, sound and motion are engagement drivers for her
// students, so every Style action gets a fun sound: a pop when trying an
// item on, a swish when taking it off, a sparkly jingle when saving a look,
// a boing for jump, and a tiny chirp while picking colors.
let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(f0: number, f1: number, dur: number, vol = 0.2, type: OscillatorType = 'sine', delay = 0) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

let lastChirp = 0;
export const styleSound = {
  pop: () => { tone(500, 1100, 0.09, 0.22); tone(1100, 1600, 0.06, 0.1, 'sine', 0.05); },
  swish: () => tone(900, 250, 0.16, 0.12, 'triangle'),
  save: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, f * 1.01, 0.2, 0.16, 'sine', i * 0.08)),
  boing: () => { tone(180, 520, 0.18, 0.2, 'triangle'); tone(520, 300, 0.2, 0.12, 'triangle', 0.16); },
  cheer: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.16, 0.14, 'square', i * 0.07)),
  chirp: () => {
    const now = performance.now();
    if (now - lastChirp < 70) return;
    lastChirp = now;
    tone(1400 + Math.random() * 400, 1800, 0.04, 0.05);
  },
  tap: () => tone(700, 900, 0.05, 0.1),
  // Bawk the rooster: two quick squawks and a little crow.
  bawk: () => {
    tone(620, 900, 0.09, 0.16, 'sawtooth');
    tone(640, 950, 0.09, 0.16, 'sawtooth', 0.13);
    tone(700, 1250, 0.32, 0.12, 'square', 0.3);
  },
  buy: () => [660, 880, 1320].forEach((f, i) => tone(f, f * 1.02, 0.14, 0.15, 'triangle', i * 0.07)),
};
