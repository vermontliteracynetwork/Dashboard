import { useEffect, useState } from 'react';

// The Game Builder library (Build Queue 677, her words 2026-11-18: "all the sounds, assets, sprites that have been
// included in the kids dashboard should be added to the game builder"). Every single sprite picture and sound file
// already in the dashboard, listed by scripts/generate-game-builder-library.mjs, one pack at a time so the screen
// stays simple.

interface Pack { pack: string; items: string[] }
interface Lib { pictures: Pack[]; sounds: Pack[] }
let cache: Promise<Lib> | null = null;
const loadLib = () => (cache ??= fetch('/game-builder/library.json').then((r) => r.json() as Promise<Lib>).catch(() => ({ pictures: [], sounds: [] })));

export const packName = (p: string) => p.split('/').filter((x) => x !== 'games' && x !== 'sounds' && x !== 'PNG' && x !== 'Audio').map((x) => x.replace(/[-_]/g, ' ')).join(', ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Other';
export const soundName = (url: string) => decodeURIComponent(url.split('/').pop() ?? '').replace(/\.\w+$/, '').replace(/[-_]+/g, ' ').replace(/\s+\d+$/, (m) => m);

function useLib() { const [lib, setLib] = useState<Lib | null>(null); useEffect(() => { void loadLib().then(setLib); }, []); return lib; }

export function PictureLibrary({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const lib = useLib();
  const [pack, setPack] = useState('');
  const packs = lib?.pictures ?? [];
  const cur = packs.find((p) => p.pack === pack) ?? packs[0];
  return (
    <div className="gbl-modal" role="dialog" aria-label="Picture library">
      <div className="gbl-modal-box">
        <div className="gbl-modal-head">
          <h2>Picture library</h2>
          <label>Pack <select value={cur?.pack ?? ''} onChange={(e) => setPack(e.target.value)}>{packs.map((p) => <option key={p.pack} value={p.pack}>{packName(p.pack)} ({p.items.length})</option>)}</select></label>
          <button type="button" className="gbx-btn" onClick={onClose}>Close</button>
        </div>
        <p className="gbx-muted">Tap a picture to use it.</p>
        <div className="gbl-pics">{cur?.items.map((u) => <button key={u} type="button" onClick={() => onPick(u)}><img src={u} alt="" loading="lazy" /></button>)}</div>
        {!lib && <p>Loading the library...</p>}
      </div>
    </div>
  );
}

export function SoundLibrary({ onPick, onClose }: { onPick: (url: string) => void; onClose: () => void }) {
  const lib = useLib();
  const [pack, setPack] = useState('');
  const packs = lib?.sounds ?? [];
  const cur = packs.find((p) => p.pack === pack) ?? packs[0];
  const hear = (u: string) => { try { const a = new Audio(u); a.volume = 0.6; void a.play(); } catch { /* no sound */ } };
  return (
    <div className="gbl-modal" role="dialog" aria-label="Sound library">
      <div className="gbl-modal-box">
        <div className="gbl-modal-head">
          <h2>Sound library</h2>
          <label>Pack <select value={cur?.pack ?? ''} onChange={(e) => setPack(e.target.value)}>{packs.map((p) => <option key={p.pack} value={p.pack}>{packName(p.pack)} ({p.items.length})</option>)}</select></label>
          <button type="button" className="gbx-btn" onClick={onClose}>Close</button>
        </div>
        <div className="gbl-sounds">{cur?.items.map((u) => (
          <div key={u} className="gbl-sound"><span>{soundName(u)}</span><button type="button" className="gbx-btn" onClick={() => hear(u)}>Hear</button><button type="button" className="gbx-btn gbx-primary" onClick={() => onPick(u)}>Add</button></div>
        ))}</div>
        {!lib && <p>Loading the library...</p>}
      </div>
    </div>
  );
}
