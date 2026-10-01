// Squishy synthesized sound effects for Slime Chess (Web Audio, no audio
// files): a bubbly "bloop" on every move (pitch depends on the piece), a
// splat when a piece is captured, a boing for check, a soft low "nope"
// for a move that doesn't work (never a harsh buzzer), and a little
// bubble fanfare for a win.
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freqStart: number, freqEnd: number, duration: number, volume = 0.25, type: OscillatorType = 'sine', delay = 0) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBurst(duration: number, volume = 0.15, delay = 0) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + delay;
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * duration), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1400;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t0);
}

const PIECE_PITCH: Record<string, number> = { p: 880, n: 660, b: 740, r: 520, q: 440, k: 390 };

export const slimeSound = {
  select: (piece: string) => tone(PIECE_PITCH[piece] * 1.2, PIECE_PITCH[piece] * 1.5, 0.08, 0.12),
  move: (piece: string) => {
    tone(PIECE_PITCH[piece], PIECE_PITCH[piece] * 0.45, 0.16, 0.28);
    tone(PIECE_PITCH[piece] * 1.6, PIECE_PITCH[piece] * 0.9, 0.08, 0.1, 'sine', 0.05);
  },
  capture: () => {
    noiseBurst(0.18, 0.18);
    tone(1200, 300, 0.12, 0.22);
    tone(900, 1500, 0.08, 0.12, 'sine', 0.1);
  },
  check: () => {
    tone(300, 700, 0.18, 0.22, 'triangle');
    tone(700, 350, 0.22, 0.18, 'triangle', 0.16);
  },
  nope: () => tone(260, 180, 0.22, 0.16, 'triangle'),
  hint: () => {
    tone(880, 1320, 0.1, 0.12);
    tone(1320, 1760, 0.1, 0.1, 'sine', 0.09);
  },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f * 1.02, 0.22, 0.2, 'sine', i * 0.12)),
  draw: () => [523, 587, 523].forEach((f, i) => tone(f, f, 0.18, 0.16, 'sine', i * 0.14)),
};
