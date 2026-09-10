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

// A real recorded cash-register "cha-ching" — played once at the moment a
// student confirms a Marketplace purchase, distinct from the synthesized
// playChaChing() below (which fires for money landing IN the bank, not
// leaving it). A fresh Audio element each call so back-to-back checkouts
// don't get cut off by a still-playing previous one.
export function playCashRegister() {
  try {
    const audio = new Audio('/sounds/cash-register.mp3');
    audio.volume = 0.6;
    void audio.play().catch(() => {
      // Autoplay can be blocked until the student has interacted with the
      // page — checkout is always a tap, so this is only a rare edge case.
    });
  } catch {
    // Audio isn't available — the purchase still goes through, just silently.
  }
}

// A real recorded coin-drop jingle — played any time Class Cash lands in a
// student's Piggy Bank (spin win, task reward, streak bonus, achievement,
// teacher bonus, etc.), alongside the falling-coins animation in
// CoinDropOverlay. Replaces the old synthesized playChaChing() for that use.
export function playCoinDrop() {
  try {
    const audio = new Audio('/sounds/coin-drop.mp3');
    audio.volume = 0.6;
    void audio.play().catch(() => {
      // Autoplay can be blocked until the student has interacted with the
      // page — the coins still land, just silently until then.
    });
  } catch {
    // Audio isn't available — the coins still land, just silently.
  }
}

// A bright cash-register "cha-ching" — a quick bell strike followed by a
// few rapid high coin-jingle blips. Synthesized (no bundled audio file),
// played any time Class Cash lands in a student's Piggy Bank.
export function playChaChing() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    // The "ching" — a bright bell strike.
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'square';
    bell.frequency.value = 1046.5; // C6
    bellGain.gain.setValueAtTime(0, now);
    bellGain.gain.linearRampToValueAtTime(0.12, now + 0.01);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(now);
    bell.stop(now + 0.35);

    // The coin jingle — a few quick high blips.
    const coinFreqs = [2093, 2349, 2637, 3136]; // C7, D7, E7, G7
    coinFreqs.forEach((freq, i) => {
      const start = now + 0.06 + i * 0.05;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });

    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Audio isn't available (e.g. autoplay policy) — the money still lands, just silently.
  }
}
