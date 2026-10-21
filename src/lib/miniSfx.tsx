// Little sound effects for the native games from her 2026-09-30 lists (Build Queue 53), synthesized
// with Web Audio like petSounds.ts (no files to load). Quiet and short on purpose. The 🔊 button in
// each game's header turns them off for this iPad (saved on the device, shared by all those games).
import { useState } from 'react';

const KEY = 'mini-sfx';
export const sfxOn = () => { try { return localStorage.getItem(KEY) !== '0'; } catch { return true; } };
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (!sfxOn()) return null;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!ctx || ctx.state === 'closed') ctx = new Ctx();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.08, slideTo?: number, delay = 0) {
  const c = ac(); if (!c) return;
  const at = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.01); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
  o.connect(g); g.connect(c.destination); o.start(at); o.stop(at + dur + 0.05);
}
function noise(dur: number, vol = 0.06, filter: BiquadFilterType = 'lowpass', freq = 1200, delay = 0) {
  const c = ac(); if (!c) return;
  const at = c.currentTime + delay, len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf; f.type = filter; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(c.destination); src.start(at);
}

export const sfx = {
  pop: () => tone(520, 0.09, 'sine', 0.08, 880),
  tick: () => tone(1400, 0.03, 'square', 0.025),
  click: () => tone(300, 0.05, 'square', 0.04),
  thud: () => { tone(140, 0.16, 'sine', 0.12, 70); noise(0.08, 0.04, 'lowpass', 400); },
  splash: () => { noise(0.35, 0.07, 'bandpass', 1800); tone(700, 0.15, 'sine', 0.03, 300); },
  whoosh: () => noise(0.3, 0.05, 'bandpass', 900),
  boing: () => tone(220, 0.25, 'triangle', 0.08, 440),
  bonk: () => { tone(330, 0.12, 'square', 0.06, 160); noise(0.05, 0.05, 'highpass', 2000); },
  coin: () => { tone(988, 0.08, 'square', 0.04); tone(1319, 0.18, 'square', 0.04, undefined, 0.07); },
  chime: () => { tone(784, 0.25, 'triangle', 0.07); tone(1047, 0.35, 'triangle', 0.06, undefined, 0.1); },
  sizzle: () => noise(0.6, 0.035, 'highpass', 3000),
  horn: () => { tone(196, 0.35, 'sawtooth', 0.04); tone(247, 0.35, 'sawtooth', 0.03); },
  beep: () => { tone(660, 0.1, 'square', 0.05); tone(660, 0.1, 'square', 0.05, undefined, 0.15); },
  creak: () => tone(110, 0.4, 'sawtooth', 0.03, 180),
};

// Build Queue 299: silly sounds a Plinko theme gives its colored pegs (her examples: a pink peg barks, an orange peg
// farts). All short, so a ball bouncing peg to peg never piles them up. A peg sound can also be her own uploaded file.
function bark(delay = 0) { tone(520, 0.11, 'sawtooth', 0.07, 260, delay); noise(0.08, 0.05, 'bandpass', 900, delay); }
export const PEG_SOUNDS: { id: string; label: string; play: () => void }[] = [
  { id: 'tick', label: 'Soft tick', play: () => sfx.tick() },
  { id: 'bark', label: 'Bark', play: () => { bark(); bark(0.16); } },
  { id: 'meow', label: 'Meow', play: () => { tone(700, 0.12, 'triangle', 0.06, 1000); tone(1000, 0.22, 'triangle', 0.06, 560, 0.11); } },
  { id: 'fart', label: 'Fart', play: () => { tone(95, 0.38, 'sawtooth', 0.09, 60); tone(120, 0.3, 'square', 0.03, 70, 0.03); noise(0.35, 0.05, 'lowpass', 260); } },
  { id: 'quack', label: 'Quack', play: () => { tone(380, 0.14, 'sawtooth', 0.07, 300); noise(0.12, 0.03, 'bandpass', 1400); } },
  { id: 'moo', label: 'Moo', play: () => tone(150, 0.5, 'sawtooth', 0.05, 110) },
  { id: 'boing', label: 'Boing', play: () => tone(180, 0.35, 'triangle', 0.09, 620) },
  { id: 'pop', label: 'Pop', play: () => tone(520, 0.09, 'sine', 0.09, 880) },
  { id: 'ding', label: 'Ding', play: () => tone(1320, 0.4, 'triangle', 0.07) },
  { id: 'drum', label: 'Drum', play: () => { tone(120, 0.18, 'sine', 0.14, 55); noise(0.06, 0.05, 'lowpass', 500); } },
  { id: 'whistle', label: 'Slide whistle', play: () => tone(600, 0.32, 'sine', 0.07, 1800) },
  { id: 'honk', label: 'Honk', play: () => { tone(310, 0.22, 'square', 0.05); tone(330, 0.22, 'sawtooth', 0.03); } },
  { id: 'zap', label: 'Zap', play: () => tone(1800, 0.16, 'sawtooth', 0.04, 200) },
  { id: 'splash', label: 'Splash', play: () => sfx.splash() },
  { id: 'coin', label: 'Coin', play: () => sfx.coin() },
  { id: 'giggle', label: 'Giggle', play: () => { for (let i = 0; i < 4; i++) tone(900 - i * 60, 0.07, 'triangle', 0.05, 1100 - i * 60, i * 0.09); } },
  { id: 'spring', label: 'Spring', play: () => { tone(300, 0.12, 'triangle', 0.07, 900); tone(300, 0.12, 'triangle', 0.05, 900, 0.12); } },
];
const fileSounds = new Map<string, HTMLAudioElement>();
// A peg sound: a built-in id, or the address of an uploaded sound file.
export function playPegSound(sound?: string) {
  if (!sound || !sfxOn()) return;
  const b = PEG_SOUNDS.find((x) => x.id === sound);
  if (b) { b.play(); return; }
  try {
    let a = fileSounds.get(sound);
    if (!a) { a = new Audio(sound); a.preload = 'auto'; fileSounds.set(sound, a); }
    const c = a.cloneNode() as HTMLAudioElement; c.volume = 0.6; void c.play().catch(() => {});
  } catch { /* fine */ }
}

export function SfxToggle({ plain = false }: { plain?: boolean } = {}) {
  const [on, setOn] = useState(sfxOn);
  const flip = () => { const v = !on; setOn(v); try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* fine */ } if (v) sfx.chime(); };
  return <button type="button" className="btn sfx-toggle" onClick={flip} aria-label={on ? 'Sound effects on. Tap to turn them off.' : 'Sound effects off. Tap to turn them on.'} aria-pressed={on}>{plain ? <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />{on ? <path d="M16.5 8.5a5 5 0 0 1 0 7" /> : <path d="M16 9l5 6M21 9l-5 6" />}</svg> : on ? '🔊' : '🔇'}</button>;
}
