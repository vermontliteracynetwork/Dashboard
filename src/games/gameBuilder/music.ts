import { playableSrc } from '../../lib/musicLibrary';

// Game Builder music (Build Queue 664, her words: "sounds, music, etc."). A student's game can play a tune they
// pick or compose on a 16 step note grid (made in the browser, no files), or a song from the class music library.

export const STEPS = 16;
export const NOTE_NAMES = ['high C', 'A', 'G', 'E', 'D', 'C', 'low A', 'low G']; // top row is the highest note
const NOTE_HZ = [523.25, 440, 392, 329.63, 293.66, 261.63, 220, 196];

export interface Music { kind: 'none' | 'tune' | 'song'; notes?: string[]; tempo?: number; wave?: string; songUrl?: string; songTitle?: string }

const row = (s: string) => s.padEnd(STEPS, '.').slice(0, STEPS);
const tune = (rows: string[]) => NOTE_NAMES.map((_, i) => row(rows[i] ?? ''));
export const PRESET_TUNES: { id: string; label: string; tempo: number; wave: string; notes: string[] }[] = [
  { id: 'happy', label: 'Happy', tempo: 132, wave: 'square', notes: tune(['', '....x.......x...', '..x.....x.....x.', 'x.......x.......', '......x.......x.', '', '', '']) },
  { id: 'adventure', label: 'Adventure', tempo: 118, wave: 'triangle', notes: tune(['x...............', '..x.......x.....', '....x.......x...', '......x.......x.', '', '........x.......', '', 'x...x...x...x...']) },
  { id: 'spooky', label: 'Spooky (not scary)', tempo: 96, wave: 'sine', notes: tune(['', '', '', 'x.....x.........', '..x.......x.....', '....x.......x...', '..............x.', 'x.......x.......']) },
  { id: 'calm', label: 'Calm', tempo: 84, wave: 'sine', notes: tune(['', 'x.......', '....x.......x...', '........x.......', '', '..x.......x.....', '', 'x...............']) },
  { id: 'fast', label: 'Super fast', tempo: 168, wave: 'square', notes: tune(['..x...x...x...x.', '', 'x...x...x...x...', '', '.x.x.x.x.x.x.x.x', '', '', 'x.......x.......']) },
];
export const WAVES: [string, string][] = [['square', 'Arcade'], ['triangle', 'Soft arcade'], ['sine', 'Flute'], ['sawtooth', 'Buzzy']];
export const emptyTune = () => NOTE_NAMES.map(() => '.'.repeat(STEPS));

export function startMusic(m: Music | undefined, volume = 0.05): () => void {
  if (!m || m.kind === 'none') return () => {};
  if (m.kind === 'song' && m.songUrl) {
    const a = new Audio(playableSrc(m.songUrl)); a.loop = true; a.volume = 0.35; void a.play().catch(() => {});
    return () => { a.pause(); a.src = ''; };
  }
  const notes = m.notes ?? PRESET_TUNES[0].notes;
  let ac: AudioContext;
  try { ac = new AudioContext(); } catch { return () => {}; }
  const stepLen = 60 / (m.tempo || 120) / 2; // eighth notes
  let step = 0; let next = ac.currentTime + 0.1;
  const play = (hz: number, at: number) => {
    const o = ac.createOscillator(); const g = ac.createGain(); o.type = (m.wave as OscillatorType) || 'square';
    o.frequency.value = hz; g.gain.setValueAtTime(volume, at); g.gain.exponentialRampToValueAtTime(0.0005, at + stepLen * 0.95);
    o.connect(g); g.connect(ac.destination); o.start(at); o.stop(at + stepLen);
  };
  const timer = window.setInterval(() => {
    while (next < ac.currentTime + 0.25) {
      notes.forEach((r, i) => { if (r[step] === 'x') play(NOTE_HZ[i], next); });
      step = (step + 1) % STEPS; next += stepLen;
    }
  }, 60);
  return () => { window.clearInterval(timer); void ac.close().catch(() => {}); };
}
