import { useEffect, useRef, useState } from 'react';
import { SOUNDS, type GameProject } from '../../lib/gameBuilder/model';
import { NOTE_NAMES, PRESET_TUNES, STEPS, WAVES, emptyTune, startMusic, type Music } from '../../games/gameBuilder/music';
import { tone } from '../../games/gameBuilder/runtime';
import { useMusicTracks } from '../../lib/musicLibrary';
import { SoundLibrary, soundName } from './GameBuilderLibrary';

// The Sound tab in Game Builder (Build Queue 664, her words: "sounds, music, etc."): the game's music (no music, a
// tune they pick or compose on a note grid, or a song from the class music library) and a board of every sound
// effect the blocks can play.

type Update = (f: (q: GameProject) => GameProject) => void;
const isSongFile = (u: string) => /\.(mp3|m4a|wav|ogg|aac)(\?|$)/i.test(u) || u.startsWith('/music/') || /supabase\.co\/storage/.test(u);

export default function SoundPanel({ p, update }: { p: GameProject; update: Update }) {
  const m: Music = p.design.music ?? { kind: 'none' };
  const setM = (patch: Partial<Music>) => update((q) => ({ ...q, design: { ...q.design, music: { ...(q.design.music ?? { kind: 'none' }), ...patch } } }));
  const [listening, setListening] = useState(false);
  const [lib, setLib] = useState(false);
  const mine = p.design.mySounds ?? [];
  const stopRef = useRef<() => void>(() => {});
  const tracks = useMusicTracks().filter((t) => isSongFile(t.url));
  const notes = m.notes ?? PRESET_TUNES[0].notes;
  useEffect(() => { stopRef.current(); stopRef.current = listening ? startMusic(m) : () => {}; return () => stopRef.current(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listening, JSON.stringify(m)]);
  const toggleNote = (r: number, c: number) => setM({ kind: 'tune', notes: notes.map((row, i) => (i === r ? row.slice(0, c) + (row[c] === 'x' ? '.' : 'x') + row.slice(c + 1) : row)) });

  return (
    <div className="gb-design gbs">
      <h3>Music</h3>
      <div className="gba-row">
        <button type="button" className={`gb-btn ${m.kind === 'none' ? 'gb-primary' : ''}`} onClick={() => { setListening(false); setM({ kind: 'none' }); }}>No music</button>
        <button type="button" className={`gb-btn ${m.kind === 'tune' ? 'gb-primary' : ''}`} onClick={() => setM({ kind: 'tune', notes, tempo: m.tempo ?? PRESET_TUNES[0].tempo, wave: m.wave ?? PRESET_TUNES[0].wave })}>Make a tune</button>
        {tracks.length > 0 && <button type="button" className={`gb-btn ${m.kind === 'song' ? 'gb-primary' : ''}`} onClick={() => setM({ kind: 'song', songUrl: m.songUrl ?? tracks[0].url, songTitle: m.songTitle ?? tracks[0].title })}>Class song</button>}
        {m.kind !== 'none' && <button type="button" className="gb-btn" onClick={() => setListening((l) => !l)}>{listening ? '■ Stop' : '▶ Listen'}</button>}
      </div>
      {m.kind === 'tune' && <>
        <p className="gb-muted">Start from a tune, then tap squares to add or take away notes. Each column is one beat.</p>
        <div className="gba-row">{PRESET_TUNES.map((t) => <button key={t.id} type="button" className="gb-btn" onClick={() => setM({ kind: 'tune', notes: t.notes, tempo: t.tempo, wave: t.wave })}>{t.label}</button>)}<button type="button" className="gb-btn" onClick={() => setM({ kind: 'tune', notes: emptyTune() })}>Empty</button></div>
        <div className="gbs-grid" role="grid" aria-label="Tune maker">
          {NOTE_NAMES.map((n, r) => (
            <div key={n} className="gbs-row" role="row">
              <span className="gbs-note">{n}</span>
              {Array.from({ length: STEPS }, (_, c) => <button key={c} type="button" role="gridcell" aria-label={`${n}, beat ${c + 1}`} aria-pressed={notes[r][c] === 'x'} className={`${notes[r][c] === 'x' ? 'on' : ''} ${c % 4 === 0 ? 'beat' : ''}`} onClick={() => toggleNote(r, c)} />)}
            </div>
          ))}
        </div>
        <div className="gba-row">
          <label className="gba-speed">Speed: <b>{m.tempo ?? 120}</b><input type="range" min={60} max={200} step={4} value={m.tempo ?? 120} onChange={(e) => setM({ tempo: Number(e.target.value) })} /></label>
          {WAVES.map(([id, l]) => <button key={id} type="button" className={`gb-btn ${(m.wave ?? 'square') === id ? 'gb-primary' : ''}`} onClick={() => setM({ wave: id })}>{l}</button>)}
        </div>
      </>}
      {m.kind === 'song' && <div className="gbs-songs">{tracks.map((t) => <button key={t.id} type="button" className={`gb-btn ${m.songUrl === t.url ? 'gb-primary' : ''}`} onClick={() => setM({ songUrl: t.url, songTitle: t.title })}>{t.title}</button>)}</div>}
      <h3>My sounds</h3>
      <p className="gb-muted">Add up to 8 sounds from the dashboard's sound library. They show up in the "play sound" block.</p>
      <div className="gbl-sounds">{mine.map((u) => <div key={u} className="gbl-sound"><span>{soundName(u)}</span><button type="button" className="gbx-btn" onClick={() => tone(`lib:${u}`)}>Hear</button><button type="button" className="gbx-btn" onClick={() => update((q) => ({ ...q, design: { ...q.design, mySounds: (q.design.mySounds ?? []).filter((x) => x !== u) } }))}>Remove</button></div>)}</div>
      {mine.length < 8 && <button type="button" className="gb-btn" onClick={() => setLib(true)}>Add a sound from the library</button>}
      {lib && <SoundLibrary onClose={() => setLib(false)} onPick={(u) => { update((q) => ({ ...q, design: { ...q.design, mySounds: [...new Set([...(q.design.mySounds ?? []), u])].slice(0, 8) } })); setLib(false); }} />}
      <h3>Sound effects</h3>
      <p className="gb-muted">Tap to hear one. Use a "play sound" block to put it in your game.</p>
      <div className="gba-row">{SOUNDS.map(([id, l]) => <button key={id} type="button" className="gb-btn" onClick={() => tone(id)}>Hear {l}</button>)}</div>
    </div>
  );
}
