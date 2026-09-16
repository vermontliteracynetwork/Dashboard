import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import TheaterFrame from '../../components/TheaterFrame';
import { extractYouTubeId } from '../../lib/youtube';

// The in-world Cinema — direct teacher request: a themed video-viewing
// screen (the uploaded curtain photos) showing whatever the teacher's added
// to the Cinema Videos library (external links or her own uploads, see
// CinemaVideosManager). Pure watch-for-fun: unlimited replay, no task/
// mastery tracking, no done-state to hit. A video someone should be graded
// on watching still belongs on a real Task with type 'video' instead.
export default function Cinema() {
  const navigate = useNavigate();
  const cinemaVideos = useStore((s) => s.cinemaVideos);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const playing = cinemaVideos.find((v) => v.id === playingId) ?? null;
  const ytId = playing?.source === 'youtube' ? extractYouTubeId(playing.url) : null;

  return (
    <div
      className="stack"
      style={{
        minHeight: '100vh',
        backgroundImage: `url(/world/cinema/${playing ? 'curtain-screen' : 'curtain-closed'}.png)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div className="space-between" style={{ alignItems: 'center' }}>
        <span style={{ background: '#fff', padding: '8px 14px', borderRadius: 10, fontFamily: 'system-ui, sans-serif', fontWeight: 800, color: '#5c1219', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
          🎬 Cinema
        </span>
        <div className="row" style={{ gap: 8 }}>
          {playing && (
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setPlayingId(null)}>
              ⬅️ Now Showing
            </button>
          )}
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/world/town')} aria-label="Go to Town Square">
            🌳 Town Square
          </button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/home')}>
            🏠 Home
          </button>
        </div>
      </div>

      {playing ? (
        <div className="stack" style={{ alignItems: 'center', marginTop: 20 }}>
          <TheaterFrame>
            <div style={{ width: '100%', aspectRatio: '16 / 9' }}>
              {ytId ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube-nocookie.com/embed/${ytId}?playsinline=1`}
                  title={playing.title}
                  style={{ border: 'none', display: 'block' }}
                  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video src={playing.url} controls playsInline style={{ width: '100%', height: '100%', display: 'block', background: '#000' }} />
              )}
            </div>
          </TheaterFrame>
          <p style={{ background: '#fff', borderRadius: 10, padding: '8px 16px', fontWeight: 700, color: '#5c1219', fontFamily: 'system-ui, sans-serif' }}>
            {playing.title}
          </p>
        </div>
      ) : (
        <div style={{ maxWidth: 640, margin: '32px auto 0' }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: 20, boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
            <h2 style={{ margin: '0 0 12px', color: '#5c1219', fontFamily: 'system-ui, sans-serif' }}>Now Showing</h2>
            {cinemaVideos.length === 0 ? (
              <p style={{ opacity: 0.7 }}>Nothing playing yet — ask your teacher to add a video!</p>
            ) : (
              <div className="stack" style={{ gap: 10 }}>
                {cinemaVideos.map((v) => (
                  <button
                    key={v.id}
                    className="btn"
                    style={{ minHeight: 56, justifyContent: 'flex-start', fontSize: '1rem', fontWeight: 700, textAlign: 'left' }}
                    onClick={() => setPlayingId(v.id)}
                  >
                    🎟️ {v.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
