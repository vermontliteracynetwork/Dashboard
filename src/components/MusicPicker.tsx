import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { Icon } from './Icon';

// The shared music picker (car radio, Concert Hall, Boom Box, and since Build Queue 348 the Music app on the
// student computer). Audio only: tapping a song starts the app-wide player (GlobalMusicPlayer), which keeps
// playing across screens with its own small Now Playing bar.
export default function MusicPicker({ onClose }: { onClose: () => void }) {
  const musicTracks = useStore((s) => s.musicTracks);
  const playingTrackId = useStore((s) => s.playingTrackId);
  const setPlayingTrackId = useStore((s) => s.setPlayingTrackId);
  const [tag, setTag] = useState<string | null>(null);
  const tags = useMemo(() => Array.from(new Set(musicTracks.flatMap((t) => t.tags ?? []))).sort(), [musicTracks]);
  const visible = tag ? musicTracks.filter((t) => (t.tags ?? []).includes(tag)) : musicTracks;
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack">
          <div className="space-between">
            <h2 style={{ margin: 0 }}><Icon name="music" size={20} fallback="🎵" /> Music</h2>
            <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={onClose} aria-label="Close"><Icon name="close" size={16} fallback="✕" /></button>
          </div>
          {musicTracks.length === 0 ? (
            <p style={{ opacity: 0.7, margin: 0 }}>No music yet. Ask your teacher to add some!</p>
          ) : (
            <>
              {tags.length > 0 && (
                <div className="row-wrap" style={{ gap: 6 }}>
                  <button className={`btn chip-filter-sm ${tag === null ? 'btn-primary' : ''}`} onClick={() => setTag(null)}>All</button>
                  {tags.map((t) => <button key={t} className={`btn chip-filter-sm ${tag === t ? 'btn-primary' : ''}`} onClick={() => setTag(tag === t ? null : t)}>🏷️ {t}</button>)}
                </div>
              )}
              <div className="stack" style={{ gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                {visible.map((t) => (
                  <button key={t.id} className={`btn btn-lg ${playingTrackId === t.id ? 'btn-primary' : ''}`} style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                    onClick={() => { setPlayingTrackId(t.id); onClose(); }}>🎵 {t.title}</button>
                ))}
              </div>
              {playingTrackId && <button className="btn" onClick={() => setPlayingTrackId(null)}>Stop the music</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
