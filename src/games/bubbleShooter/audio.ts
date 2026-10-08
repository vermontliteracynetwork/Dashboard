// Bubble Shooter sounds and music, all made in the browser (no files). The music is a bouncy loop
// that speeds up a little when the bubbles get close to the danger line (Claudia's prediction for
// the students' "music" ask, 2026-10-08). Calm mode and the toggles turn it off.

let ctx: AudioContext | null = null;
const ac = () => {
  try { ctx = ctx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); return ctx; } catch { return null; }
};

export function tone(freqs: number[], dur: number, type: OscillatorType = 'sine', vol = 0.16) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime;
  freqs.forEach((f, i) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0 + i * dur);
    g.gain.setValueAtTime(0.0001, t0 + i * dur);
    g.gain.exponentialRampToValueAtTime(vol, t0 + i * dur + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * dur + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0 + i * dur); o.stop(t0 + i * dur + dur + 0.02);
  });
}

export function noise(dur: number, vol = 0.25, low = 400) {
  const a = ac(); if (!a) return;
  const n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(a.destination); src.start();
}

// Combo pops climb in pitch: the bigger the combo, the higher the notes.
export const sfx = {
  shoot: () => tone([520, 760], 0.05, 'triangle', 0.1),
  stick: () => tone([220], 0.06, 'sine', 0.12),
  pop: (n: number, combo: number) => tone(Array.from({ length: Math.min(6, n) }, (_, i) => (560 + combo * 70) * 2 ** (i / 12 * 2)), 0.05, 'sine', 0.14),
  row: () => tone([160, 120], 0.12, 'square', 0.06),
  win: () => tone([523, 659, 784, 1047, 1319], 0.1, 'triangle', 0.14),
  boom: () => { noise(0.5, 0.35, 500); tone([90, 60], 0.18, 'sine', 0.2); },
  rainbowBoom: () => { noise(0.4, 0.25, 1200); tone([784, 988, 1175, 1568], 0.06, 'triangle', 0.12); },
  laser: () => { const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(1600, a.currentTime); o.frequency.exponentialRampToValueAtTime(180, a.currentTime + 0.45); g.gain.setValueAtTime(0.09, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.45); o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.5); },
  shuffle: () => tone([400, 600, 500, 700, 550, 800], 0.04, 'triangle', 0.1),
  mystery: () => tone([330, 415, 494, 659], 0.08, 'square', 0.07),
  powerup: () => tone([659, 784, 1047], 0.08, 'triangle', 0.13),
  peg: (i: number) => tone([900 + (i % 4) * 60], 0.03, 'triangle', 0.07),
  coin: () => tone([988, 1319], 0.07, 'square', 0.07),
};

// Bouncy loop: bass on the beat, a pentatonic sparkle on top. tempo() is read every beat.
const BASS = [131, 131, 165, 147, 131, 131, 196, 175];
const TOP = [523, 659, 784, 659, 587, 784, 880, 784];
let timer = 0; let beat = 0;
export function startMusic(tempo: () => number) {
  stopMusic();
  const tick = () => {
    const a = ac(); if (!a) return;
    const b = beat++ % 8;
    tone([BASS[b]], 0.18, 'triangle', 0.07);
    if (b % 2 === 0) tone([TOP[b]], 0.09, 'sine', 0.035);
    timer = window.setTimeout(tick, 300 / tempo());
  };
  tick();
}
export function stopMusic() { window.clearTimeout(timer); timer = 0; }

// Plinko drop zones each have a fast, silly sound (teacher 2026-10-08: "1=bark 2=chime 3= meow 4= ding
// dong doorbell etc."). Zones 5 to 10 were Claudia's picks in the same spirit.
function glide(type: OscillatorType, from: number, to: number, dur: number, vol = 0.14, vib = 0) {
  const a = ac(); if (!a) return;
  const t0 = a.currentTime;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(from, t0); o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  if (vib) { const l = a.createOscillator(), lg = a.createGain(); l.frequency.value = vib; lg.gain.value = from * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t0); l.stop(t0 + dur); }
  g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
export const ZONE_SOUNDS: { name: string; play: () => void }[] = [
  { name: 'Bark', play: () => { noise(0.08, 0.3, 900); glide('square', 420, 180, 0.12, 0.09); window.setTimeout(() => { noise(0.07, 0.25, 900); glide('square', 400, 170, 0.1, 0.08); }, 150); } },
  { name: 'Chime', play: () => tone([1319, 1568, 2093], 0.09, 'triangle', 0.12) },
  { name: 'Meow', play: () => { glide('sawtooth', 520, 820, 0.18, 0.06, 7); window.setTimeout(() => glide('sawtooth', 820, 430, 0.22, 0.06, 7), 170); } },
  { name: 'Doorbell', play: () => { tone([659], 0.35, 'sine', 0.16); window.setTimeout(() => tone([523], 0.45, 'sine', 0.16), 330); } },
  { name: 'Boing', play: () => glide('sine', 150, 700, 0.35, 0.16, 18) },
  { name: 'Quack', play: () => { glide('sawtooth', 620, 380, 0.12, 0.08); window.setTimeout(() => glide('sawtooth', 600, 360, 0.12, 0.08), 150); } },
  { name: 'Slide whistle', play: () => glide('sine', 400, 1600, 0.45, 0.12) },
  { name: 'Honk', play: () => { tone([311, 294], 0.14, 'square', 0.08); } },
  { name: 'Pop', play: () => { noise(0.04, 0.4, 3000); tone([1800], 0.04, 'sine', 0.12); } },
  { name: 'Ta-da', play: () => tone([523, 659, 784, 1047], 0.08, 'triangle', 0.14) },
];
