import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { extractScratchProjectId, scratchThumbnailUrl } from '../../lib/scratch';
import type { ScratchGame } from '../../types';

// Games shown in the in-world Arcade — direct teacher request: her students
// are "obsessed with Scratch" (scratch.mit.edu) and she wants a browse-and-
// play screen for the projects they love, modeled on the Cinema. A teacher
// pastes any public project's URL; only its numeric project id is kept —
// Scratch's own CDN serves a real thumbnail with no key or upload needed
// (see src/lib/scratch.ts), and the project plays inline via Scratch's own
// officially-supported embed path. Pure play-for-fun content, same as
// Cinema: unlimited replay, no task/mastery tracking.
export default function ScratchGamesManager() {
  const scratchGames = useStore((s) => s.scratchGames);
  const addScratchGame = useStore((s) => s.addScratchGame);
  const deleteScratchGame = useStore((s) => s.deleteScratchGame);

  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(scratchGames.flatMap((g) => g.tags ?? []))).sort(),
    [scratchGames],
  );
  const visibleGames = tagFilter ? scratchGames.filter((g) => (g.tags ?? []).includes(tagFilter)) : scratchGames;

  const resetForm = () => {
    setTitle('');
    setLinkUrl('');
    setTags([]);
    setTagInput('');
  };

  const addTagToForm = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput('');
  };

  const addLink = () => {
    const t = title.trim();
    const u = linkUrl.trim();
    if (!t || !u) return;
    const projectId = extractScratchProjectId(u);
    if (!projectId) {
      setError("That doesn't look like a Scratch project link. Paste the full scratch.mit.edu/projects/… URL.");
      return;
    }
    setError(null);
    addScratchGame({ title: t, projectId, tags });
    resetForm();
  };

  return (
    <div className="content-well stack">
      <strong>🕹️ Arcade Games</strong>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        MIT Scratch projects shown in the in-world Arcade. Paste a project link (like scratch.mit.edu/projects/1214576217/) and students can play any of these anytime, unlimited replay, and heart their favorites. Tags let kids search and filter the shelf.
      </p>

      <div className="stack" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Game title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Paste a scratch.mit.edu/projects/… link…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }}
          />
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!title.trim() || !linkUrl.trim()} onClick={addLink}>
            + Add Game
          </button>
        </div>
        <div className="stack" style={{ gap: 6, maxWidth: 320 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Tags/categories (optional)</label>
          {tags.length > 0 && (
            <div className="row-wrap" style={{ gap: 4 }}>
              {tags.map((t) => (
                <span key={t} className="tag-pill tag-pill-sm">
                  {t}{' '}
                  <button
                    aria-label={`Remove tag ${t}`}
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 0 0 4px' }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input"
              style={{ fontSize: '0.82rem', padding: '5px 8px' }}
              placeholder="e.g. Platformer, Music, Art…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagToForm(); } }}
            />
            <button className="btn chip-filter-sm" disabled={!tagInput.trim()} onClick={addTagToForm}>+ Add</button>
          </div>
        </div>
        {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
      </div>

      {scratchGames.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>No Arcade games yet.</p>
      ) : (
        <>
          {allTags.length > 0 && (
            <div className="row-wrap" style={{ gap: 6 }}>
              {allTags.map((t) => (
                <button
                  key={t}
                  className={`btn chip-filter-sm ${tagFilter === t ? 'btn-primary' : ''}`}
                  onClick={() => setTagFilter(tagFilter === t ? null : t)}
                >
                  🏷️ {t}
                </button>
              ))}
            </div>
          )}
          <div className="stack" style={{ gap: 6 }}>
            {visibleGames.map((g) => (
              <ScratchGameRow key={g.id} game={g} onDelete={() => deleteScratchGame(g.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ScratchGameRow({ game, onDelete }: { game: ScratchGame; onDelete: () => void }) {
  const updateScratchGame = useStore((s) => s.updateScratchGame);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(game.title);
  const [editUrl, setEditUrl] = useState(`https://scratch.mit.edu/projects/${game.projectId}/`);
  const [editTags, setEditTags] = useState<string[]>(game.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setEditTitle(game.title);
    setEditUrl(`https://scratch.mit.edu/projects/${game.projectId}/`);
    setEditTags(game.tags ?? []);
    setTagInput('');
    setError(null);
    setEditing(true);
  };

  const addEditTag = () => {
    const t = tagInput.trim();
    if (!t || editTags.includes(t)) return;
    setEditTags([...editTags, t]);
    setTagInput('');
  };

  const save = () => {
    const t = editTitle.trim();
    if (!t) return;
    const projectId = extractScratchProjectId(editUrl.trim());
    if (!projectId) {
      setError("That doesn't look like a Scratch project link.");
      return;
    }
    updateScratchGame(game.id, { title: t, projectId, tags: editTags });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="stack" style={{ gap: 8, border: '2px solid var(--purple)', borderRadius: 10, padding: 10 }}>
        <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Game title" />
        <input className="input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="Scratch project link" />
        <div className="stack" style={{ gap: 6 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Tags/categories</label>
          {editTags.length > 0 && (
            <div className="row-wrap" style={{ gap: 4 }}>
              {editTags.map((t) => (
                <span key={t} className="tag-pill tag-pill-sm">
                  {t}{' '}
                  <button
                    aria-label={`Remove tag ${t}`}
                    onClick={() => setEditTags(editTags.filter((x) => x !== t))}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 900, padding: '0 0 0 4px' }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input"
              style={{ fontSize: '0.82rem', padding: '5px 8px' }}
              placeholder="e.g. Platformer, Music, Art…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditTag(); } }}
            />
            <button className="btn chip-filter-sm" disabled={!tagInput.trim()} onClick={addEditTag}>+ Add</button>
          </div>
        </div>
        {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!editTitle.trim()} onClick={save}>✅ Save</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 10, alignItems: 'center', border: '2px solid var(--content-border)', borderRadius: 10, padding: 8 }}>
      <img src={scratchThumbnailUrl(game.projectId)} alt="" style={{ width: 64, height: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0, background: '#eee' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{game.title}</div>
        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>Scratch project #{game.projectId}</div>
        {(game.tags ?? []).length > 0 && (
          <div className="row-wrap" style={{ gap: 3, marginTop: 3 }}>
            {(game.tags ?? []).map((t) => (
              <span key={t} className="tag-pill tag-pill-sm">{t}</span>
            ))}
          </div>
        )}
      </div>
      <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={startEdit} aria-label={`Edit ${game.title}`}>✏️ Edit</button>
      {confirmDelete ? (
        <>
          <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={onDelete}>Confirm</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(true)} aria-label={`Delete ${game.title}`}>
          🗑️
        </button>
      )}
    </div>
  );
}
