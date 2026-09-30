import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { extractYouTubeId, loadYouTubeApi } from '../lib/youtube';

// Direct teacher instruction: "ensure that the music player can always be
// played in the background, even when students are completing
// assignments... should have a minimized view." Moved here from
// TownSquare.tsx (where it used to live, and used to die the moment a
// student navigated to a task/quiz screen) and mounted once at the app
// shell level in App.tsx, alongside TeacherHelpAlert/CoinDropOverlay/etc,
// so it survives every route change. playingTrackId itself lives in the
// store now (see store.ts), not local state, for the same reason.
//
// Deliberately outside routes/world/ and imports nothing from there or
// from @react-three/fiber — Three.js is lazy-loaded only for the world
// routes (see App.tsx's own comment on that); pulling any of that into a
// component mounted for every single route would undo that split.

interface MusicPlayerHandle {
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (v: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
}

const YouTubeAudio = forwardRef<MusicPlayerHandle, { ytId: string; title: string; volume: number; onEnded: () => void; onReady: () => void }>(
  function YouTubeAudio({ ytId, title, volume, onEnded, onReady }, ref) {
    const frameId = `yt-music-${ytId}`;
    const playerObjRef = useRef<any>(null);
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    useEffect(() => {
      let cancelled = false;
      loadYouTubeApi().then(() => {
        if (cancelled) return;
        playerObjRef.current = new window.YT.Player(frameId, {
          events: {
            onReady: (e: any) => {
              e.target.setVolume?.(volume);
              // Direct teacher bug report: radio/Boom Box played for one
              // student but not another, who had to manually hit pause
              // then play before it would start. The iframe's `autoplay=1`
              // URL param is what's supposed to start it, but WebKit/iOS
              // (iPad is this app's primary device) silently drops that
              // param unless it lands within a very short window of a real
              // tap — the async YouTube IFrame API load (script fetch, then
              // this onReady callback) routinely blows past that window,
              // especially on a student's first song of the session before
              // the browser has "remembered" this origin is allowed to
              // autoplay audio. Calling playVideo() explicitly here is the
              // same call the manual Play button already makes — it
              // reliably starts playback once the player object exists,
              // instead of depending on the URL param's unreliable timing.
              e.target.playVideo?.();
              onReadyRef.current();
            },
            onStateChange: (e: any) => {
              if (e.data === window.YT.PlayerState.ENDED) onEndedRef.current();
            },
          },
        });
      });
      return () => {
        cancelled = true;
        try {
          playerObjRef.current?.destroy?.();
        } catch {
          // player may already be torn down
        }
        playerObjRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ytId]);

    useImperativeHandle(ref, () => ({
      play: () => playerObjRef.current?.playVideo?.(),
      pause: () => playerObjRef.current?.pauseVideo?.(),
      seekTo: (seconds: number) => playerObjRef.current?.seekTo?.(seconds, true),
      setVolume: (v: number) => playerObjRef.current?.setVolume?.(v),
      getCurrentTime: () => playerObjRef.current?.getCurrentTime?.() ?? 0,
      getDuration: () => playerObjRef.current?.getDuration?.() ?? 0,
    }), []);

    return (
      <iframe
        id={frameId}
        title={`Now playing: ${title}`}
        src={`https://www.youtube-nocookie.com/embed/${ytId}?enablejsapi=1&autoplay=1&playsinline=1`}
        allow="autoplay; encrypted-media"
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 'none' }}
      />
    );
  }
);

// Direct teacher report: a school network can block youtube.com outright
// (a content filter, out of this app's control — see MusicManager.tsx's
// header comment), which silently breaks every YouTube-sourced track for
// anyone on that network while working fine elsewhere. The fix isn't in
// this component at all, it's giving a track a real non-YouTube source —
// this renders whichever kind `GlobalMusicPlayer` below hands it, same
// `MusicPlayerHandle` interface as `YouTubeAudio`, so nothing else about
// the player (minimized pill, transport bar, Next/Prev) has to know or
// care which kind is currently playing.
const UploadedAudio = forwardRef<MusicPlayerHandle, { src: string; title: string; volume: number; onEnded: () => void; onReady: () => void }>(
  function UploadedAudio({ src, title, volume, onEnded, onReady }, ref) {
    const audioRef = useRef<HTMLAudioElement>(null);

    useEffect(() => {
      const el = audioRef.current;
      if (!el) return;
      el.volume = volume / 100;
      // A real play() call from the same tap that started this whole
      // interaction (picking a song, or switching tracks) — the identical
      // "needs a genuine user gesture" requirement autoplay=1 URL params
      // can silently miss, satisfied the same direct way as YouTubeAudio's
      // own explicit playVideo() call above.
      el.play().catch(() => {
        // Blocked without ever having had a user gesture at all (e.g. a
        // fresh tab reload landing mid-song) — the visible Play button in
        // the expanded transport bar still starts it from here.
      });
      onReady();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src]);

    useEffect(() => {
      if (audioRef.current) audioRef.current.volume = volume / 100;
    }, [volume]);

    useImperativeHandle(ref, () => ({
      play: () => audioRef.current?.play(),
      pause: () => audioRef.current?.pause(),
      seekTo: (seconds: number) => { if (audioRef.current) audioRef.current.currentTime = seconds; },
      setVolume: (v: number) => { if (audioRef.current) audioRef.current.volume = v / 100; },
      getCurrentTime: () => audioRef.current?.currentTime ?? 0,
      getDuration: () => audioRef.current?.duration ?? 0,
    }), []);

    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <audio
        ref={audioRef}
        src={src}
        title={`Now playing: ${title}`}
        onEnded={onEnded}
        style={{ display: 'none' }}
      />
    );
  }
);

function formatTime(s: number) {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function GlobalMusicPlayer() {
  const musicTracks = useStore((s) => s.musicTracks);
  const playingTrackId = useStore((s) => s.playingTrackId);
  const setPlayingTrackId = useStore((s) => s.setPlayingTrackId);
  const playing = musicTracks.find((t) => t.id === playingTrackId);
  const ytId = playing ? extractYouTubeId(playing.url) : null;
  const playerRef = useRef<MusicPlayerHandle>(null);
  const [paused, setPaused] = useState(false);
  const [volume, setVolumeState] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  // Minimized by default every time a new song starts — the small pill is
  // the "always there, never in the way" state; a student/teacher taps it
  // to expand the full Spotify-style transport bar (seek/volume/skip).
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setPaused(false);
    setReady(false);
    setCurrentTime(0);
    setDuration(0);
  }, [playingTrackId]);

  useEffect(() => {
    if (!ready) return;
    const iv = setInterval(() => {
      setCurrentTime(playerRef.current?.getCurrentTime() ?? 0);
      setDuration(playerRef.current?.getDuration() ?? 0);
    }, 500);
    return () => clearInterval(iv);
  }, [ready]);

  const trackIndex = musicTracks.findIndex((t) => t.id === playingTrackId);
  const goRelative = (dir: 1 | -1) => {
    if (musicTracks.length === 0) return;
    const next = musicTracks[(trackIndex + dir + musicTracks.length) % musicTracks.length];
    setPlayingTrackId(next.id);
  };

  if (!playing) return null;

  return (
    <>
      {ytId ? (
        <YouTubeAudio
          // Direct teacher bug report: switching tracks (Next/Prev, or
          // picking a new song) silently stopped working. Root cause: with
          // no `key`, React reused the SAME <iframe> DOM node across a track
          // change (just updating its id/src), but the outgoing effect's
          // cleanup still calls the YT Player's own `destroy()`, which
          // removes that iframe element from the DOM outright — ripping out
          // the very node React had just repointed at the new track, a beat
          // before the new effect could look it up by id and attach a fresh
          // player to it. A `key` forces a real unmount/remount per track
          // instead: the old effect destroys its own, no-longer-reused
          // iframe, and the new track gets a brand new one untouched by that
          // cleanup.
          key={playing.id}
          ref={playerRef}
          ytId={ytId}
          title={playing.title}
          volume={volume}
          onReady={() => setReady(true)}
          onEnded={() => goRelative(1)}
        />
      ) : (
        <UploadedAudio
          key={playing.id}
          ref={playerRef}
          src={playing.url}
          title={playing.title}
          volume={volume}
          onReady={() => setReady(true)}
          onEnded={() => goRelative(1)}
        />
      )}
      {expanded ? (
        <div
          style={{
            position: 'fixed', bottom: 16, left: 16, zIndex: 500,
            display: 'flex', flexDirection: 'column', gap: 4, background: '#fff',
            border: '2px solid var(--ink, #1f4238)', borderRadius: 16,
            boxShadow: '3px 3px 0 var(--ink, #1f4238)', padding: '8px 14px', fontFamily: 'system-ui, sans-serif',
            width: 280, maxWidth: 'calc(100vw - 32px)',
          }}
        >
          <div className="space-between" style={{ alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎵 {playing.title}</span>
            <button className="btn btn-sm" style={{ minHeight: 32, minWidth: 32, padding: 0, flexShrink: 0 }} onClick={() => setExpanded(false)} aria-label="Minimize player">▾</button>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, opacity: 0.7, minWidth: 30, textAlign: 'right' }}>{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => {
                const t = Number(e.target.value);
                setCurrentTime(t);
                playerRef.current?.seekTo(t);
              }}
              style={{ flex: 1 }}
              aria-label="Seek"
            />
            <span style={{ fontSize: 10, opacity: 0.7, minWidth: 30 }}>{formatTime(duration)}</span>
          </div>
          <div className="row" style={{ gap: 10, alignItems: 'center', justifyContent: 'center' }}>
            <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40, padding: 0 }} onClick={() => goRelative(-1)} aria-label="Previous track">⏮️</button>
            <button
              className="btn btn-sm btn-primary"
              style={{ minHeight: 44, minWidth: 44, padding: 0, fontSize: '1.1rem' }}
              onClick={() => {
                if (paused) { playerRef.current?.play(); setPaused(false); } else { playerRef.current?.pause(); setPaused(true); }
              }}
              aria-label={paused ? 'Play' : 'Pause'}
            >
              {paused ? '▶️' : '⏸️'}
            </button>
            <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40, padding: 0 }} onClick={() => goRelative(1)} aria-label="Next track">⏭️</button>
            <button className="btn btn-sm btn-danger" style={{ minHeight: 40, minWidth: 40, padding: 0 }} onClick={() => setPlayingTrackId(null)} aria-label="Stop music">⏹️</button>
          </div>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12 }} aria-hidden>🔈</span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolumeState(v);
                playerRef.current?.setVolume(v);
              }}
              style={{ flex: 1 }}
              aria-label="Volume"
            />
            <span style={{ fontSize: 12 }} aria-hidden>🔊</span>
          </div>
        </div>
      ) : (
        // The minimized view — a small, quiet pill, never blocking a
        // task/quiz's own content, tap to expand.
        <button
          onClick={() => setExpanded(true)}
          title={`Now playing: ${playing.title} — tap to expand`}
          style={{
            position: 'fixed', bottom: 16, left: 16, zIndex: 500,
            display: 'flex', alignItems: 'center', gap: 6, maxWidth: 200,
            background: '#fff', border: '2px solid var(--ink, #1f4238)', borderRadius: 999,
            boxShadow: '2px 2px 0 var(--ink, #1f4238)', padding: '6px 12px', minHeight: 40,
            fontFamily: 'system-ui, sans-serif', cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 15 }} aria-hidden="true">{paused ? '⏸️' : '🎵'}</span>
          <span style={{ fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{playing.title}</span>
        </button>
      )}
    </>
  );
}
