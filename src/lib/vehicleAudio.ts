// Transportation Phase 2b (docs/BOATS_DESIGN.md §8, docs/TRANSPORTATION.md
// §4 "Sound design") — engine/splash/wind/chug loops for every driveable
// vehicle. No recorded engine/water/wind sound assets exist anywhere in
// public/sounds (audited before writing this — only interface clicks, a
// cash register, a coin drop, a task-complete chime, and three ambient
// "calm" water sounds meant for the regulation tool, not a moving vehicle),
// so this follows the EXACT same standing pattern src/lib/chime.ts already
// uses for a sound the app needs but has no bundled recording for:
// synthesize it with the Web Audio API rather than borrowing an unrelated
// file and mislabeling it. This is real, working audio code — not a silent
// placeholder — but it IS synthesized rather than recorded, and this
// environment cannot play audio to confirm it actually sounds calm/pleasant
// rather than grating. Flagged plainly per the standing instruction: a
// human needs to actually listen to this in the browser before it's called
// confirmed-good. If it turns out harsh, the fix is tuning the numbers
// below (frequencies/filter cutoffs/gains), not the wiring.
//
// Every cue here follows docs/TRANSPORTATION.md §4's rules: soft, loopable,
// never sudden-onset, crossfades in/out (never a hard cut), and a contact
// "thud" is always soft, never a crash/buzzer sound.

export type VehicleSoundKind = 'car' | 'boat' | 'train' | 'plane';

type AudioCtor = typeof AudioContext;
function getAudioCtor(): AudioCtor | null {
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext || null;
}

// A shared white-noise buffer (splash/wind texture) — generated once per
// controller instance rather than per frame.
function makeNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

const FADE = 0.6; // seconds — every start/stop/enable crossfade, never a hard cut

/**
 * One controller per currently-mounted vehicle. Construct on mount, call
 * start() once audio is allowed to play (a mount is always a tap, so this
 * is never a true autoplay), setIntensity(0..1) every frame from the
 * vehicle's own speed ratio, thud() on a soft boundary/dock/shore contact,
 * and stop() on dismount. Every method is safe to call even if Web Audio
 * is unavailable or blocked (try/catch, same as chime.ts) — a vehicle
 * still drives perfectly fine with zero sound either way.
 */
export class VehicleSoundController {
  private kind: VehicleSoundKind;
  private enabled: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private textureGain: GainNode | null = null; // splash (boat) / wind (plane) / chug pulses (train)
  private engineOsc: OscillatorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private chugTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;
  private intensity = 0;

  constructor(kind: VehicleSoundKind, enabled: boolean) {
    this.kind = kind;
    this.enabled = enabled;
  }

  // Called any time the shared vehicleSoundEnabled setting changes while a
  // vehicle is already mounted — mutes/unmutes with the same soft fade as
  // everything else here, never an abrupt cut, and never re-creates the
  // audio graph.
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!this.ctx || !this.master) return;
    const target = enabled ? this.levelFor(this.intensity) : 0;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(target, this.ctx.currentTime + FADE);
  }

  start() {
    if (this.started) return;
    this.started = true;
    try {
      const Ctx = getAudioCtor();
      if (!Ctx) return;
      const ctx = new Ctx();
      this.ctx = ctx;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      this.master = master;

      const engineGain = ctx.createGain();
      engineGain.gain.value = 0.5;
      engineGain.connect(master);

      const textureGain = ctx.createGain();
      textureGain.gain.value = 0;
      textureGain.connect(master);
      this.textureGain = textureGain;

      if (this.kind === 'car') {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 60;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 220;
        osc.connect(lp);
        lp.connect(engineGain);
        osc.start();
        this.engineOsc = osc;
      } else if (this.kind === 'boat') {
        // Idle "put-put" — a slow amplitude wobble on a low oscillator.
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 55;
        osc.connect(engineGain);
        osc.start();
        this.engineOsc = osc;
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 3.2;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 0.35;
        lfo.connect(lfoGain);
        lfoGain.connect(engineGain.gain);
        lfo.start();
        // Splash texture — filtered noise, silent until speed rises.
        const noise = ctx.createBufferSource();
        noise.buffer = makeNoiseBuffer(ctx);
        noise.loop = true;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 0.6;
        noise.connect(bp);
        bp.connect(textureGain);
        noise.start();
        this.noiseSource = noise;
      } else if (this.kind === 'train') {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 45;
        osc.connect(engineGain);
        osc.start();
        this.engineOsc = osc;
        // Chugging pulses, tempo tied to speed via setIntensity's timer
        // reschedule below, not built here — see setIntensity.
      } else {
        // plane/drone — continuous drone + a light wind layer.
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 140;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 500;
        osc.connect(lp);
        lp.connect(engineGain);
        osc.start();
        this.engineOsc = osc;
        const noise = ctx.createBufferSource();
        noise.buffer = makeNoiseBuffer(ctx);
        noise.loop = true;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1200;
        noise.connect(hp);
        hp.connect(textureGain);
        noise.start();
        this.noiseSource = noise;
      }

      // Crossfade in — never a hard start, per the design doc.
      master.gain.linearRampToValueAtTime(this.enabled ? this.levelFor(0) : 0, ctx.currentTime + FADE);
    } catch {
      // Web Audio unavailable/blocked — the vehicle still drives, just silently.
    }
  }

  private levelFor(intensity: number): number {
    // Idle is always audible-but-soft (never silent at a standstill, per
    // "soft looping engine put-put at idle"); moving rises gently on top.
    return 0.12 + intensity * 0.28;
  }

  setIntensity(ratio: number) {
    this.intensity = Math.max(0, Math.min(1, ratio));
    if (!this.ctx || !this.master || !this.engineOsc) return;
    const now = this.ctx.currentTime;
    const target = this.enabled ? this.levelFor(this.intensity) : 0;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.linearRampToValueAtTime(target, now + 0.4);

    if (this.kind === 'car') {
      this.engineOsc.frequency.linearRampToValueAtTime(60 + this.intensity * 90, now + 0.3);
    } else if (this.kind === 'boat') {
      this.engineOsc.frequency.linearRampToValueAtTime(55 + this.intensity * 35, now + 0.3);
      // Splash volume rises gently (never sharply) with speed, per spec.
      this.textureGain?.gain.linearRampToValueAtTime(this.intensity * 0.22, now + 0.5);
    } else if (this.kind === 'train') {
      this.engineOsc.frequency.linearRampToValueAtTime(45 + this.intensity * 25, now + 0.3);
      this.rescheduleChug();
    } else {
      this.engineOsc.frequency.linearRampToValueAtTime(140 + this.intensity * 60, now + 0.3);
      this.textureGain?.gain.linearRampToValueAtTime(0.05 + this.intensity * 0.12, now + 0.5);
    }
  }

  // Train-only: a soft rhythmic pulse whose tempo tracks current speed —
  // "a chugging loop that speeds up/slows down smoothly with actual train
  // speed" (docs/TRANSPORTATION.md §4).
  private rescheduleChug() {
    if (this.chugTimer) clearInterval(this.chugTimer);
    if (!this.ctx || !this.enabled) return;
    const intervalMs = 700 - this.intensity * 450; // faster chugs at speed
    this.chugTimer = setInterval(() => this.pulse(140, 0.08), Math.max(140, intervalMs));
  }

  private pulse(freq: number, gain: number) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // A soft contact thud — dock/shore bump (boat), boundary bump-and-slide
  // (any vehicle), or a train reaching the end of its track. Never a crash
  // sound, per the standing "gentle nudge, never a buzzer" rule.
  thud() {
    if (!this.enabled || !this.ctx || !this.master) return;
    try {
      this.pulse(90, 0.14);
    } catch {
      // Audio unavailable — no visible effect either way.
    }
  }

  // Train-only: a soft whistle at a station stop — predictable, not startling.
  whistle() {
    if (!this.enabled || !this.ctx || !this.master) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;
      [880, 1046.5].forEach((freq, i) => {
        const start = now + i * 0.12;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.1, start + 0.08);
        g.gain.exponentialRampToValueAtTime(0.001, start + 0.9);
        osc.connect(g);
        g.connect(this.master!);
        osc.start(start);
        osc.stop(start + 0.9);
      });
    } catch {
      // Audio unavailable — no visible effect either way.
    }
  }

  stop() {
    if (!this.started) return;
    if (this.chugTimer) clearInterval(this.chugTimer);
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) { this.started = false; return; }
    try {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.linearRampToValueAtTime(0, now + FADE);
      const osc = this.engineOsc;
      const noise = this.noiseSource;
      setTimeout(() => {
        try { osc?.stop(); } catch { /* already stopped */ }
        try { noise?.stop(); } catch { /* already stopped */ }
        try { void ctx.close(); } catch { /* already closed */ }
      }, FADE * 1000 + 100);
    } catch {
      // Audio unavailable — nothing to tear down.
    }
    this.started = false;
    this.ctx = null;
    this.master = null;
    this.textureGain = null;
    this.engineOsc = null;
    this.noiseSource = null;
  }
}
