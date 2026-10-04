import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';

// The car dashboard (teacher spec 2026-10-04): a small "dash" card at the
// top of the screen while driving a car. Gas dial on the left (the number
// is units of gas left), the stereo across the top middle (song title; tap
// it to change the song) with a volume dial on its right (0 to 100%; turn
// it by dragging, tap it to change the song), the speedometer on the right
// (the number is map squares per second), trip distance under the stereo,
// and a settings button for car settings. Replaces the old gas bar and the
// radio button. Sized for iPad fingers.

function Dial({ value, max, label, color, display, warn }: { value: number; max: number; label: string; color: string; display: string; warn?: boolean }) {
  const f = Math.max(0, Math.min(1, value / max));
  const r = 34;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => [44 + r * Math.cos(a), 46 + r * Math.sin(a)];
    const [x0, y0] = p(a0);
    const [x1, y1] = p(a1);
    return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const start = Math.PI * 0.8;
  const end = Math.PI * 2.2;
  const needle = start + (end - start) * f;
  return (
    <div className={`dash-dial${warn ? ' warn' : ''}`} role="img" aria-label={`${label}: ${display}`}>
      <svg viewBox="0 0 88 80" width="88" height="80" aria-hidden="true">
        <path d={arc(start, end)} stroke="rgba(255,255,255,0.18)" strokeWidth="8" fill="none" strokeLinecap="round" />
        {f > 0.001 && <path d={arc(start, start + (end - start) * f)} stroke={color} strokeWidth="8" fill="none" strokeLinecap="round" />}
        {Array.from({ length: 11 }, (_, i) => {
          const a = start + ((end - start) * i) / 10;
          return <line key={i} x1={44 + 25 * Math.cos(a)} y1={46 + 25 * Math.sin(a)} x2={44 + 29 * Math.cos(a)} y2={46 + 29 * Math.sin(a)} stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />;
        })}
        <line x1="44" y1="46" x2={44 + 22 * Math.cos(needle)} y2={46 + 22 * Math.sin(needle)} stroke="#ff5a5a" strokeWidth="3" strokeLinecap="round" />
        <circle cx="44" cy="46" r="4" fill="#ff5a5a" />
        <text x="44" y="72" textAnchor="middle" className="dash-dial-num">{display}</text>
      </svg>
      <span className="dash-dial-label">{label}</span>
    </div>
  );
}

function VolumeKnob({ value, onChange, onTap }: { value: number; onChange: (v: number) => void; onTap: () => void }) {
  const drag = useRef<{ y: number; x: number; v: number; moved: boolean } | null>(null);
  const angle = -135 + (value / 100) * 270;
  return (
    <button
      type="button"
      className="dash-knob"
      aria-label={`Volume ${value}%. Drag to turn, tap to pick a song`}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); drag.current = { y: e.clientY, x: e.clientX, v: value, moved: false }; }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const delta = (d.y - e.clientY) + (e.clientX - d.x);
        if (Math.abs(delta) > 4) d.moved = true;
        if (d.moved) onChange(d.v + delta * 0.6);
      }}
      onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) onTap(); }}
      onPointerCancel={() => { drag.current = null; }}
    >
      <span className="dash-knob-face" style={{ transform: `rotate(${angle}deg)` }}><span className="dash-knob-mark" /></span>
      <span className="dash-knob-num">{value}%</span>
    </button>
  );
}

export default function CarDashboard({ speedRef, maxSpeed, gasDashes, gasSecondsRef, secondsPerDash, onFillUp, canFill, onPickSong, onSettings }: {
  speedRef: React.RefObject<number>; // 0..1 of top speed, written every frame
  maxSpeed: number; // map squares per second at top speed
  gasDashes: number; // 0 to 10
  gasSecondsRef: React.RefObject<number>; // seconds used of the current dash
  secondsPerDash: number;
  onFillUp: () => void;
  canFill: boolean;
  onPickSong: () => void;
  onSettings: () => void;
}) {
  const tracks = useStore((s) => s.musicTracks);
  const playingId = useStore((s) => s.playingTrackId);
  const volume = useStore((s) => s.musicVolume);
  const setVolume = useStore((s) => s.setMusicVolume);
  const song = tracks.find((t) => t.id === playingId);
  const [speed, setSpeed] = useState(0);
  const [trip, setTrip] = useState(0);
  // Gas units: one unit is one second of driving (10 dashes of 15 seconds
  // = 150 units in a full tank), so the number counts down smoothly.
  const gasMax = 10 * secondsPerDash;
  const gasUnits = gasDashes <= 0 ? 0 : Math.max(0, gasDashes * secondsPerDash - (gasSecondsRef.current ?? 0));
  // Speed and trip distance, sampled 10 times a second (smoothed so the
  // needle glides). The trip starts over each time they get in a car.
  useEffect(() => {
    let last = performance.now();
    let smooth = 0;
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const v = (speedRef.current ?? 0) * maxSpeed;
      smooth += (v - smooth) * 0.35;
      setSpeed(smooth);
      setTrip((t) => t + v * dt);
    }, 100);
    return () => window.clearInterval(id);
  }, [speedRef, maxSpeed]);
  // re-render each second so the gas number ticks down
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(id); }, []);

  return (
    <div className="car-dash" role="group" aria-label="Car dashboard">
      <div className="dash-side">
        <Dial value={gasUnits} max={gasMax} label="⛽ Gas" color={gasUnits / gasMax > 0.3 ? '#3ddc84' : '#ffb020'} display={String(Math.ceil(gasUnits))} warn={gasUnits / gasMax <= 0.3} />
        {canFill && <button type="button" className="dash-fill" onClick={onFillUp}>Fill up</button>}
      </div>
      <div className="dash-center">
        <div className="dash-stereo">
          <button type="button" className="dash-screen" onClick={onPickSong} aria-label={song ? `Now playing ${song.title}. Tap to change the song` : 'Radio off. Tap to pick a song'}>
            <span className="dash-screen-kicker">📻 {song ? 'NOW PLAYING' : 'RADIO'}</span>
            <span className="dash-screen-title"><span className={song && song.title.length > 22 ? 'dash-marquee' : undefined}>{song ? song.title : 'Tap to pick a song'}</span></span>
          </button>
          <VolumeKnob value={volume} onChange={setVolume} onTap={onPickSong} />
        </div>
        <div className="dash-trip-row">
          <span className="dash-trip">Trip <strong>{trip.toFixed(1)}</strong> squares</span>
          <button type="button" className="dash-gear" onClick={onSettings} aria-label="Car settings">⚙️</button>
        </div>
      </div>
      <div className="dash-side">
        <Dial value={speed} max={maxSpeed} label="Speed" color="#5ec8ff" display={speed < 0.05 ? '0' : speed.toFixed(1)} />
      </div>
    </div>
  );
}
