import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { scratchThumbnailUrl, scratchEmbedUrl } from '../../lib/scratch';
import WebpageFrame from '../../components/WebpageFrame';

// The in-world Arcade — direct teacher request: her students are "obsessed
// with Scratch" and she wants a Cinema-style browse-and-play screen for the
// MIT Scratch (scratch.mit.edu) projects they love, showing whatever the
// teacher's added to the Arcade Games library (see ScratchGamesManager).
// Pure play-for-fun: unlimited replay, no task/mastery tracking attached —
// modeled directly on Cinema.tsx (same shelf/search/favorite/embed
// pattern), swapping a video player for Scratch's own officially-supported
// project embed.
export default function Arcade() {
  const scratchGames = useStore((s) => s.scratchGames);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const updateStudent = useStore((s) => s.updateStudent);
  const student = students.find((s) => s.id === currentStudentId);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const favoriteIds = student?.favoriteScratchGameIds ?? [];
  const allTags = useMemo(
    () => Array.from(new Set(scratchGames.flatMap((g) => g.tags ?? []))).sort(),
    [scratchGames],
  );

  // Same stable-sort pattern as Cinema: favorites first, otherwise the
  // teacher's own add order, so nothing jumps around when a game gets
  // hearted. Search/tag filtering happens on top of that same order.
  const sortedGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...scratchGames]
      .filter((g) => {
        if (tagFilter && !(g.tags ?? []).includes(tagFilter)) return false;
        if (q && !g.title.toLowerCase().includes(q) && !(g.tags ?? []).some((t) => t.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => {
        const fa = favoriteIds.includes(a.id);
        const fb = favoriteIds.includes(b.id);
        return fa === fb ? 0 : fa ? -1 : 1;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scratchGames, favoriteIds.join(','), search, tagFilter]);

  const toggleFavorite = (id: string) => {
    if (!student) return;
    const has = favoriteIds.includes(id);
    const next = has ? favoriteIds.filter((x) => x !== id) : [...favoriteIds, id];
    updateStudent(student.id, { favoriteScratchGameIds: next });
  };

  const playing = scratchGames.find((g) => g.id === playingId) ?? null;

  const scrollRow = (dir: 1 | -1) => {
    rowRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    // Direct teacher instruction: every "webpage" screen reads as displayed
    // inside a physical laptop now — same .laptop-frame/.laptop-screen/
    // .laptop-deck StudentHome.tsx already uses.
    <div className="laptop-frame">
      <div className="laptop-screen">
    <div className="container stack">
      <WebpageFrame url="arcade" />
      <div className="stack" style={{ minHeight: 460, background: 'linear-gradient(160deg, #2b1055, #7597de)', borderRadius: 14, padding: 20, boxSizing: 'border-box' }}>
      {playing && (
        <button className="btn btn-sm" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={() => setPlayingId(null)}>
          ⬅️ Game Shelf
        </button>
      )}

      {playing ? (
        <div className="stack" style={{ alignItems: 'center', marginTop: 20 }}>
          <div style={{ width: '100%', maxWidth: 620, aspectRatio: '480 / 402', boxShadow: '0 10px 30px rgba(0,0,0,0.45)', borderRadius: 10, overflow: 'hidden' }}>
            <iframe
              width="100%"
              height="100%"
              src={scratchEmbedUrl(playing.projectId)}
              title={playing.title}
              style={{ border: 'none', display: 'block' }}
              allowFullScreen
            />
          </div>
          <div className="row" style={{ alignItems: 'center', gap: 10, background: '#fff', borderRadius: 10, padding: '8px 16px' }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#2b1055', fontFamily: 'system-ui, sans-serif' }}>{playing.title}</p>
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
            <h2 style={{ margin: '0 20px 14px', color: '#2b1055', fontFamily: 'system-ui, sans-serif' }}>Game Shelf</h2>
            {scratchGames.length > 0 && (
              <div className="stack" style={{ gap: 8, margin: '0 20px 14px' }}>
                <input
                  className="input"
                  placeholder="🔍 Search games…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minHeight: 44 }}
                />
                {allTags.length > 0 && (
                  <div className="row-wrap" style={{ gap: 6 }}>
                    {allTags.map((t) => (
                      <button
                        key={t}
                        className="btn btn-sm"
                        style={{
                          minHeight: 40,
                          background: tagFilter === t ? 'var(--purple)' : undefined,
                          color: tagFilter === t ? '#fff' : undefined,
                        }}
                        onClick={() => setTagFilter(tagFilter === t ? null : t)}
                      >
                        🏷️ {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {sortedGames.length === 0 ? (
              <p style={{ opacity: 0.7, margin: '0 20px' }}>
                {scratchGames.length === 0 ? 'No games yet. Ask your teacher to add one!' : "No games match your search. Try a different word or tag!"}
              </p>
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
                  {sortedGames.map((g) => {
                    const isFavorite = favoriteIds.includes(g.id);
                    return (
                      <div
                        key={g.id}
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
                          onClick={() => setPlayingId(g.id)}
                          style={{ display: 'block', width: '100%', border: 'none', background: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                          aria-label={`Play ${g.title}`}
                        >
                          <img src={scratchThumbnailUrl(g.projectId)} alt="" style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block', background: '#eee' }} />
                          <div style={{ padding: '8px 10px', fontWeight: 700, fontSize: '0.85rem', fontFamily: 'system-ui, sans-serif', color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            🕹️ {g.title}
                          </div>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(g.id); }}
                          aria-label={isFavorite ? `Remove ${g.title} from favorites` : `Add ${g.title} to favorites`}
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
    </div>
      </div>
      <div className="laptop-deck" />
    </div>
  );
}
