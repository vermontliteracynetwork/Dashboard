import { useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import { extractYouTubeId } from '../../lib/youtube';
import { uploadAudio } from '../../lib/upload';
import type { MusicTrack } from '../../types';

// A shared music library — direct teacher request: a car radio, the
// Concert Hall building, and a placeable Boom Box all draw from this same
// list. Always audio only: unlike Cinema, nothing here ever shows video.
// Two ways to add a track: paste a YouTube link (plays through a hidden
// YouTube embed), or upload a real audio file (plays through this app's
// own domain, never touching YouTube). The upload path exists specifically
// because a school's network content filter can block youtube.com outright
// — that's a network-level block this app has no way to see around, so the
// real fix is giving a track a source that was never YouTube to begin
// with. See GlobalMusicPlayer.tsx's UploadedAudio for the playback side.
export default function MusicManager() {
  const musicTracks = useStore((s) => s.musicTracks);
  const addMusicTrack = useStore((s) => s.addMusicTrack);
  const deleteMusicTrack = useStore((s) => s.deleteMusicTrack);

  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allTags = useMemo(
    () => Array.from(new Set(musicTracks.flatMap((t) => t.tags ?? []))).sort(),
    [musicTracks],
  );
  const visibleTracks = tagFilter ? musicTracks.filter((t) => (t.tags ?? []).includes(tagFilter)) : musicTracks;

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
    // A YouTube link still works fine off the school network; a plain
    // https link (e.g. a royalty-free MP3 host) is accepted too now —
    // GlobalMusicPlayer.tsx plays whichever kind it turns out to be.
    if (!extractYouTubeId(u) && !/^https?:\/\//i.test(u)) {
      setError("That doesn't look like a link. Paste a YouTube link or a direct audio file URL.");
      return;
    }
    setError(null);
    // A tag typed but not explicitly "+ Add"-ed shouldn't be silently
    // dropped when Add Track is pressed — direct teacher report.
    const pending = tagInput.trim();
    const finalTags = pending && !tags.includes(pending) ? [...tags, pending] : tags;
    addMusicTrack({ title: t, url: u, tags: finalTags });
    resetForm();
  };

  const handleUpload = async (file: File) => {
    const t = title.trim() || file.name.replace(/\.[^.]+$/, '');
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAudio(file);
      const pending = tagInput.trim();
      const finalTags = pending && !tags.includes(pending) ? [...tags, pending] : tags;
      addMusicTrack({ title: t, url, tags: finalTags });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Try again.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="content-well stack">
      <strong>🎵 Music</strong>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        A shared music library — plays audio-only (no video) from the car radio, the Concert Hall building, and the Boom Box. Paste a YouTube link, or upload an audio file directly if your network blocks YouTube.
      </p>

      <div className="stack" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Song/track title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="row-wrap" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 180 }}
            placeholder="Paste a YouTube link…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }}
          />
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!title.trim() || !linkUrl.trim()} onClick={addLink}>
            + Add Track
          </button>
          <label className="btn btn-sm" style={{ minHeight: 44, cursor: uploading ? 'default' : 'pointer' }}>
            {uploading ? '⏳ Uploading…' : '📤 Upload an audio file'}
            <input
              ref={fileRef}
              type="file"
              accept="audio/*"
              hidden
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
            />
          </label>
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
              placeholder="e.g. Calm, Upbeat, Sing-along…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagToForm(); } }}
            />
            <button className="btn chip-filter-sm" disabled={!tagInput.trim()} onClick={addTagToForm}>+ Add</button>
          </div>
        </div>
        {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
      </div>

      {musicTracks.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>No tracks yet.</p>
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
            {visibleTracks.map((t) => (
              <MusicTrackRow key={t.id} track={t} onDelete={() => deleteMusicTrack(t.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MusicTrackRow({ track, onDelete }: { track: MusicTrack; onDelete: () => void }) {
  const updateMusicTrack = useStore((s) => s.updateMusicTrack);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(track.title);
  const [editUrl, setEditUrl] = useState(track.url);
  const [editTags, setEditTags] = useState<string[]>(track.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setEditTitle(track.title);
    setEditUrl(track.url);
    setEditTags(track.tags ?? []);
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
    const u = editUrl.trim();
    if (!extractYouTubeId(u) && !/^https?:\/\//i.test(u)) {
      setError("That doesn't look like a link. Paste a YouTube link or a direct audio file URL.");
      return;
    }
    const pending = tagInput.trim();
    const finalTags = pending && !editTags.includes(pending) ? [...editTags, pending] : editTags;
    updateMusicTrack(track.id, { title: t, url: u, tags: finalTags });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="stack" style={{ gap: 8, border: '2px solid var(--purple)', borderRadius: 10, padding: 10 }}>
        <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Track title" />
        <input className="input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="YouTube link or audio file URL" />
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
              placeholder="e.g. Calm, Upbeat, Sing-along…"
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
      <div style={{ width: 44, height: 44, borderRadius: 8, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', flexShrink: 0 }}>🎵</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{track.title}</div>
        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{extractYouTubeId(track.url) ? 'YouTube link' : 'Uploaded file'}</div>
        {(track.tags ?? []).length > 0 && (
          <div className="row-wrap" style={{ gap: 3, marginTop: 3 }}>
            {(track.tags ?? []).map((t) => (
              <span key={t} className="tag-pill tag-pill-sm">{t}</span>
            ))}
          </div>
        )}
      </div>
      <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={startEdit} aria-label={`Edit ${track.title}`}>✏️ Edit</button>
      {confirmDelete ? (
        <>
          <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={onDelete}>Confirm</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(true)} aria-label={`Delete ${track.title}`}>
          🗑️
        </button>
      )}
    </div>
  );
}
