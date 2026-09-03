// A short, gentle two-note bell — used to signal a break or Playground
// timer running out. Synthesized with the Web Audio API instead of a
// bundled audio file, and deliberately soft (slow fade, low gain, no harsh
// attack) rather than a jarring alarm buzzer.
export function playCalmChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const notes = [523.25, 659.25]; // C5, E5 — a soft, consonant interval
    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * 0.5;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 1.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 1.7);
    });
    setTimeout(() => ctx.close(), 2500);
  } catch {
    // Audio isn't available (e.g. autoplay policy) — the visual timer still communicates time's up.
  }
}
