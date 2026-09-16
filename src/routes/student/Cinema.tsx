import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import { extractYouTubeId, youtubeThumbnailUrl } from '../../lib/youtube';

// The in-world Cinema — direct teacher request: a themed video-viewing
// screen (the uploaded curtain photos) showing whatever the teacher's added
// to the Cinema Videos library (external links or her own uploads, see
// CinemaVideosManager). Pure watch-for-fun: unlimited replay, no task/
// mastery tracking, no done-state to hit. A video someone should be graded
// on watching still belongs on a real Task with type 'video' instead.
//
// Browse row is a Netflix/Hulu-style "Now Showing" shelf per direct teacher
// request — a horizontally-scrolling row of poster tiles the student slides
// through, rather than a stacked list. scroll-snap makes each tile settle
// into place on both a touch swipe (iPad) and a mouse-wheel/trackpad
// scroll; the arrow buttons are the equivalent for a mouse-only desktop
// where nothing naturally scrolls a horizontal row.
export default function Cinema() {
  const navigate = useNavigate();
  const cinemaVideos = useStore((s) => s.cinemaVideos);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const updateStudent = useStore((s) => s.updateStudent);
  const student = students.find((s) => s.id === currentStudentId);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const favoriteIds = student?.favoriteCinemaVideoIds ?? [];
  // Direct teacher instruction: a student can heart a video to keep it at
  // the front of the shelf — a stable sort (favorites first, otherwise the
  // teacher's own add order) so nothing else jumps around when one video
  // gets hearted.
  const sortedVideos = useMemo(() => {
    return [...cinemaVideos].sort((a, b) => {
      const fa = favoriteIds.includes(a.id);
      const fb = favoriteIds.includes(b.id);
      return fa === fb ? 0 : fa ? -1 : 1;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cinemaVideos, favoriteIds.join(',')]);

  const toggleFavorite = (id: string) => {
    if (!student) return;
    const has = favoriteIds.includes(id);
    const next = has ? favoriteIds.filter((x) => x !== id) : [...favoriteIds, id];
    updateStudent(student.id, { favoriteCinemaVideoIds: next });
  };

  const playing = cinemaVideos.find((v) => v.id === playingId) ?? null;
  const ytId = playing?.source === 'youtube' ? extractYouTubeId(playing.url) : null;

  const scrollRow = (dir: 1 | -1) => {
    rowRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

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
      {/* Claudia's audit (H1): every other student screen (Marketplace,
          Pet Shelter, Pet Journal) keeps a Town Square / Home exit always
          visible in its header. Cinema's only had one — "Now Showing" —
          and only while a video was actually playing, so the default
          browse screen (the one a student actually lands on) was a real
          dead end. These two are now always here, matching every sibling
          screen. */}
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
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/world/town')} aria-label="Go to Town Square">🌳 Town Square</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/home')}>🏠 Home</button>
        </div>
      </div>

      {playing ? (
        <div className="stack" style={{ alignItems: 'center', marginTop: 20 }}>
          {/* Direct teacher instruction: no frame around the video itself —
              the real curtain photo behind is the only framing this view
              gets, so the video just sits directly on it. */}
          <div style={{ width: '100%', maxWidth: 640, aspectRatio: '16 / 9', boxShadow: '0 10px 30px rgba(0,0,0,0.45)' }}>
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
          <div className="row" style={{ alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '8px 16px' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#5c1219', fontFamily: 'system-ui, sans-serif' }}>{playing.title}</p>
            <button
              onClick={() => toggleFavorite(playing.id)}
              aria-label={favoriteIds.includes(playing.id) ? 'Remove from favorites' : 'Add to favorites'}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.3rem', padding: 0, lineHeight: 1 }}
            >
              {favoriteIds.includes(playing.id) ? '❤️' : '🤍'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ margin: '32px auto 0', width: '100%', maxWidth: 1000 }}>
          <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 16, padding: '20px 0', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
            <h2 style={{ margin: '0 20px 14px', color: '#5c1219', fontFamily: 'system-ui, sans-serif' }}>Now Showing</h2>
            {sortedVideos.length === 0 ? (
              <p style={{ opacity: 0.7, margin: '0 20px' }}>Nothing playing yet. Ask your teacher to add a video!</p>
            ) : (
              <div style={{ position: 'relative' }}>
                <button
                  aria-label="Scroll left"
                  onClick={() => scrollRow(-1)}
                  style={{ position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--ink)', background: '#fff', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                >
                  ‹
                </button>
                <div
                  ref={rowRef}
                  style={{
                    display: 'flex',
                    gap: 14,
                    overflowX: 'auto',
                    scrollSnapType: 'x mandatory',
                    padding: '4px 48px',
                    scrollbarWidth: 'none',
                  }}
                >
                  {sortedVideos.map((v) => {
                    const thumbId = v.source === 'youtube' ? extractYouTubeId(v.url) : null;
                    const cover = v.coverImageUrl || (thumbId ? youtubeThumbnailUrl(thumbId) : null);
                    const isFavorite = favoriteIds.includes(v.id);
                    return (
                      <div
                        key={v.id}
                        style={{
                          position: 'relative',
                          flex: '0 0 auto',
                          scrollSnapAlign: 'start',
                          width: 220,
                          border: '3px solid var(--ink)',
                          borderRadius: 14,
                          overflow: 'hidden',
                          background: '#fff',
                          boxShadow: '4px 4px 0 var(--ink)',
                        }}
                      >
                        <button
                          onClick={() => setPlayingId(v.id)}
                          style={{ display: 'block', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                          aria-label={`Watch ${v.title}`}
                        >
                          {cover ? (
                            <img src={cover} alt="" style={{ width: '100%', aspectRatio: '16 / 9', objectFit: 'cover', display: 'block' }} />
                          ) : (
                            <div style={{ width: '100%', aspectRatio: '16 / 9', background: 'linear-gradient(135deg, var(--purple), var(--teal))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.4rem' }}>
                              🎬
                            </div>
                          )}
                          <div style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'system-ui, sans-serif', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🎟️ {v.title}
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(v.id); }}
                          aria-label={isFavorite ? `Remove ${v.title} from favorites` : `Add ${v.title} to favorites`}
                          style={{ position: 'absolute', top: 6, right: 6, width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--ink)', background: '#fff', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                        >
                          {isFavorite ? '❤️' : '🤍'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  aria-label="Scroll right"
                  onClick={() => scrollRow(1)}
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', zIndex: 2, width: 44, height: 44, borderRadius: '50%', border: '2px solid var(--ink)', background: '#fff', fontSize: '1.1rem', fontWeight: 800, cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' }}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
