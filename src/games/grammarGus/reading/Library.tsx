import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ImmersiveReader from './ImmersiveReader';
import { useLibrary, type GusArticle } from './library';

// The Library app (teacher 2026-10-07): "all articles uploaded will be
// saved and readable in the same reader/gallery view through the new
// 'Library' app in their computer that can also be accessed as a building
// role". Every article on Gus's shelf, opened in the immersive reader, with
// a button to answer its question in Gus's Workboard.
export default function Library() {
  const navigate = useNavigate();
  const articles = useLibrary();
  const [open, setOpen] = useState<GusArticle | null>(null);
  return (
    <div className="lib">
      <header className="lib-top">
        <button type="button" className="rdr-btn" onClick={() => navigate(-1)}>⬅ Back</button>
        <h1>📚 Library</h1>
        <button type="button" className="rdr-btn" onClick={() => navigate('/student/grammar-gus')}>🧪 Gus's Workboard</button>
      </header>
      <main className="lib-shelf">
        {articles.length === 0 && <p className="rdr-note">No articles on the shelf yet. Your teacher adds them.</p>}
        {articles.map((a) => {
          const pic = a.images?.[0]?.src;
          return (
            <article key={a.id} className="lib-card">
              <button type="button" className="lib-cover" onClick={() => setOpen(a)} aria-label={`Read ${a.title}`}>
                {pic ? <img src={pic} alt="" referrerPolicy="no-referrer" /> : <span aria-hidden>📰</span>}
              </button>
              <h2>{a.title}</h2>
              <p>❓ {a.question}</p>
              <div className="lib-actions">
                <button type="button" className="rdr-btn rdr-play" onClick={() => setOpen(a)}>📖 Read</button>
                <button type="button" className="rdr-btn" onClick={() => navigate('/student/grammar-gus', { state: { respond: a.id } })}>✍️ Answer it</button>
              </div>
            </article>
          );
        })}
      </main>
      {open && <ImmersiveReader article={open} onClose={() => setOpen(null)} onAnswer={() => navigate('/student/grammar-gus', { state: { respond: open.id } })} />}
    </div>
  );
}
