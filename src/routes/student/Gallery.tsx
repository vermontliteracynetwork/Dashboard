import { useState } from 'react';
import { useStore } from '../../store/store';
import WebpageFrame from '../../components/WebpageFrame';

// The Playground's Gallery — direct teacher request (referencing the
// Kinzoo app's kid-facing content gallery): "a gallery where I can add
// videos and images for the kids to look through... fun things like
// memes." Pure browsing, same "no explicit activity" shape as every
// other Playground-flavored screen: no scoring, no completion state, tap
// any tile to see it bigger, tap again to close. Personality quizzes and
// mini games from the same original request are a separate, not-yet-
// built piece (needs a design pass first) — this is just the image half.
export default function Gallery() {
  const galleryItems = useStore((s) => s.galleryItems);
  const [openId, setOpenId] = useState<string | null>(null);

  const open = galleryItems.find((g) => g.id === openId) ?? null;

  return (
    // Direct teacher instruction: every "webpage" screen reads as displayed
    // inside a physical laptop now — same .laptop-frame/.laptop-screen/
    // .laptop-deck StudentHome.tsx already uses. Gallery is only ever
    // reached from the Playground (no Town Square walk-up building exists
    // for it), so Back always goes there, not the WebpageFrame default of
    // the Computer.
    <div className="laptop-frame">
      <div className="laptop-screen">
    <div className="container stack">
      <WebpageFrame url="gallery" backTo="/student/playground/view" backLabel="🎪 Back to Playground" />
      <h2 style={{ margin: 0, textAlign: 'center' }}>🎉 Gallery</h2>

      <p style={{ textAlign: 'center', fontWeight: 700 }}>Just for fun, look through and tap anything! ✨</p>

      {open && (
        <div className="overlay-backdrop" onClick={() => setOpenId(null)}>
          <div className="overlay-panel chrome-frame stack" style={{ padding: 16, maxWidth: 520, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
            <img src={open.imageUrl} alt={open.caption ?? ''} style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 10 }} />
            {open.caption && <p style={{ fontWeight: 700, textAlign: 'center', margin: 0 }}>{open.caption}</p>}
            <button className="btn btn-primary" onClick={() => setOpenId(null)}>✕ Close</button>
          </div>
        </div>
      )}

      {galleryItems.length === 0 ? (
        <p style={{ textAlign: 'center', opacity: 0.75 }}>Nothing here yet. Ask your teacher to add some pictures!</p>
      ) : (
        <div className="row-wrap" style={{ gap: 12, justifyContent: 'center' }}>
          {galleryItems.map((g) => (
            <button
              key={g.id}
              onClick={() => setOpenId(g.id)}
              aria-label={g.caption ?? 'Open image'}
              style={{
                width: 150,
                border: 'var(--chunk) solid var(--ink)',
                borderRadius: 16,
                boxShadow: '5px 5px 0 var(--ink)',
                overflow: 'hidden',
                cursor: 'pointer',
                background: '#fff',
                padding: 0,
              }}
            >
              <img src={g.imageUrl} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
              {g.caption && (
                <div style={{ padding: '6px 8px', fontFamily: "'Baloo 2', sans-serif", fontWeight: 800, fontSize: '0.8rem', color: 'var(--ink)' }}>
                  {g.caption}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
      </div>
      <div className="laptop-deck" />
    </div>
  );
}
