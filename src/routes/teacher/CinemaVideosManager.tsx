import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { extractYouTubeId, youtubeThumbnailUrl } from '../../lib/youtube';
import { uploadImage, uploadVideo } from '../../lib/upload';
import { captureVideoThumbnail, getVideoDuration } from '../../lib/videoThumbnail';
import ImageUploadField from '../../components/ImageUploadField';
import type { CinemaVideo } from '../../types';

// Videos shown in the in-world Cinema — direct teacher request: external
// links (YouTube, same extractYouTubeId path VideoTask already uses) or a
// file uploaded straight to Supabase Storage, each with an optional
// teacher-uploaded cover image (falls back to the YouTube auto-thumbnail,
// then a generic icon). Pure watch-for-fun content: unlimited replay, no
// task/mastery tracking — a video that should be graded belongs on a real
// Task with type 'video' instead. Every video here is fully editable
// (title, link, cover, tags) and deletable, per direct teacher instruction.
export default function CinemaVideosManager() {
  const cinemaVideos = useStore((s) => s.cinemaVideos);
  const addCinemaVideo = useStore((s) => s.addCinemaVideo);
  const deleteCinemaVideo = useStore((s) => s.deleteCinemaVideo);

  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  // YouTube has no local file to read a real length from, so a teacher
  // enters an estimate in minutes — direct teacher request, shown to
  // students on the shelf so they know roughly how long a video runs
  // before tapping play. Uploaded files get their real length read
  // automatically instead (see handleUpload) — no typing needed there.
  const [durationMinutes, setDurationMinutes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // Direct teacher request: categories/tags so kids can search the
  // Cinema shelf — same free-form tag pattern QuestionSets already uses.
  const allTags = useMemo(
    () => Array.from(new Set(cinemaVideos.flatMap((v) => v.tags ?? []))).sort(),
    [cinemaVideos],
  );
  const visibleVideos = tagFilter ? cinemaVideos.filter((v) => (v.tags ?? []).includes(tagFilter)) : cinemaVideos;

  const resetForm = () => {
    setTitle('');
    setLinkUrl('');
    setCoverUrl('');
    setTags([]);
    setTagInput('');
    setDurationMinutes('');
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
    if (!extractYouTubeId(u)) {
      setError("That doesn't look like a YouTube link. Paste the full video URL.");
      return;
    }
    setError(null);
    const mins = parseFloat(durationMinutes);
    addCinemaVideo({
      title: t,
      source: 'youtube',
      url: u,
      coverImageUrl: coverUrl || undefined,
      tags,
      durationSeconds: mins > 0 ? Math.round(mins * 60) : undefined,
    });
    resetForm();
  };

  const handleUpload = async (file: File) => {
    const t = title.trim() || file.name.replace(/\.[^.]+$/, '');
    setUploading(true);
    setError(null);
    try {
      const url = await uploadVideo(file);
      // No cover picked by hand — grab a real still frame from the video
      // file itself so it doesn't sit with just a generic icon.
      let cover = coverUrl || undefined;
      if (!cover) {
        try {
          const thumbBlob = await captureVideoThumbnail(file);
          cover = await uploadImage(thumbBlob);
        } catch {
          // Thumbnail capture is best-effort — the video itself already
          // uploaded fine, so a failed auto-thumbnail shouldn't block it.
        }
      }
      let durationSeconds: number | undefined;
      try {
        durationSeconds = Math.round(await getVideoDuration(file));
      } catch {
        // Best-effort, same as the thumbnail capture above.
      }
      addCinemaVideo({ title: t, source: 'upload', url, coverImageUrl: cover, tags, durationSeconds });
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="content-well stack">
      <strong>🎬 Cinema Videos</strong>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        Videos shown in the in-world Cinema. Add a YouTube link or upload your own file, and students can watch any of these anytime, unlimited replay, and heart their favorites. Tags let kids search and filter the shelf.
      </p>

      <div className="stack" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Video title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Paste a YouTube link…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }}
          />
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!title.trim() || !linkUrl.trim()} onClick={addLink}>
            + Add Link
          </button>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <label className="btn btn-sm" style={{ minHeight: 44, cursor: uploading ? 'default' : 'pointer' }}>
            {uploading ? '⏳ Uploading…' : '📤 Upload a video file'}
            <input
              type="file"
              accept="video/*"
              hidden
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = '';
              }}
            />
          </label>
          <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>Set a title above first, or it'll use the file name</span>
        </div>
        <div className="row" style={{ gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 280 }}>
            <ImageUploadField label="Cover image (optional, falls back to the YouTube thumbnail)" value={coverUrl} onChange={setCoverUrl} />
          </div>
          <div className="stack" style={{ gap: 6, minWidth: 220 }}>
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
                placeholder="e.g. Math, Silly, Calm-down…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagToForm(); } }}
              />
              <button className="btn chip-filter-sm" disabled={!tagInput.trim()} onClick={addTagToForm}>+ Add</button>
            </div>
            <label style={{ fontSize: '0.78rem', fontWeight: 700, marginTop: 4 }}>
              Length in minutes (YouTube only — uploads read their own length automatically)
            </label>
            <input
              className="input"
              type="number"
              min={1}
              style={{ fontSize: '0.82rem', padding: '5px 8px', maxWidth: 100 }}
              placeholder="e.g. 5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </div>
        </div>
        {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
      </div>

      {cinemaVideos.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>No Cinema videos yet.</p>
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
            {visibleVideos.map((v) => (
              <CinemaVideoRow key={v.id} video={v} onDelete={() => deleteCinemaVideo(v.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CinemaVideoRow({ video, onDelete }: { video: CinemaVideo; onDelete: () => void }) {
  const updateCinemaVideo = useStore((s) => s.updateCinemaVideo);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editTitle, setEditTitle] = useState(video.title);
  const [editUrl, setEditUrl] = useState(video.url);
  const [editCover, setEditCover] = useState(video.coverImageUrl ?? '');
  const [editTags, setEditTags] = useState<string[]>(video.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [editDurationMinutes, setEditDurationMinutes] = useState(video.durationSeconds ? String(Math.round(video.durationSeconds / 60)) : '');
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ytId = video.source === 'youtube' ? extractYouTubeId(video.url) : null;
  const thumb = video.coverImageUrl || (ytId ? youtubeThumbnailUrl(ytId) : null);

  const startEdit = () => {
    setEditTitle(video.title);
    setEditUrl(video.url);
    setEditCover(video.coverImageUrl ?? '');
    setEditTags(video.tags ?? []);
    setTagInput('');
    setEditDurationMinutes(video.durationSeconds ? String(Math.round(video.durationSeconds / 60)) : '');
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
    if (video.source === 'youtube') {
      const u = editUrl.trim();
      if (!extractYouTubeId(u)) {
        setError("That doesn't look like a YouTube link.");
        return;
      }
      const mins = parseFloat(editDurationMinutes);
      updateCinemaVideo(video.id, {
        title: t,
        url: u,
        coverImageUrl: editCover || undefined,
        tags: editTags,
        durationSeconds: mins > 0 ? Math.round(mins * 60) : undefined,
      });
    } else {
      updateCinemaVideo(video.id, { title: t, coverImageUrl: editCover || undefined, tags: editTags });
    }
    setEditing(false);
  };

  const replaceFile = async (file: File) => {
    setReplacing(true);
    setError(null);
    try {
      const url = await uploadVideo(file);
      const patch: Partial<CinemaVideo> = { url };
      if (!editCover) {
        try {
          const thumbBlob = await captureVideoThumbnail(file);
          patch.coverImageUrl = await uploadImage(thumbBlob);
          setEditCover(patch.coverImageUrl);
        } catch {
          // Best-effort — a failed auto-thumbnail shouldn't block the file swap.
        }
      }
      try {
        patch.durationSeconds = Math.round(await getVideoDuration(file));
        setEditDurationMinutes(String(Math.round(patch.durationSeconds / 60)));
      } catch {
        // Best-effort, same as the thumbnail capture above.
      }
      updateCinemaVideo(video.id, patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setReplacing(false);
    }
  };

  if (editing) {
    return (
      <div className="stack" style={{ gap: 8, border: '2px solid var(--purple)', borderRadius: 10, padding: 10 }}>
        <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Video title" />
        {video.source === 'youtube' ? (
          <input className="input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="YouTube link" />
        ) : (
          <label className="btn btn-sm" style={{ minHeight: 44, alignSelf: 'flex-start', cursor: replacing ? 'default' : 'pointer' }}>
            {replacing ? '⏳ Uploading…' : '📤 Replace video file'}
            <input
              type="file"
              accept="video/*"
              hidden
              disabled={replacing}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) replaceFile(f);
                e.target.value = '';
              }}
            />
          </label>
        )}
        <div style={{ maxWidth: 280 }}>
          <ImageUploadField label="Cover image" value={editCover} onChange={setEditCover} />
        </div>
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
              placeholder="e.g. Math, Silly, Calm-down…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEditTag(); } }}
            />
            <button className="btn chip-filter-sm" disabled={!tagInput.trim()} onClick={addEditTag}>+ Add</button>
          </div>
        </div>
        {video.source === 'youtube' ? (
          <div className="stack" style={{ gap: 4 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Length in minutes</label>
            <input
              className="input"
              type="number"
              min={1}
              style={{ fontSize: '0.82rem', padding: '5px 8px', maxWidth: 100 }}
              placeholder="e.g. 5"
              value={editDurationMinutes}
              onChange={(e) => setEditDurationMinutes(e.target.value)}
            />
          </div>
        ) : (
          editDurationMinutes && <p style={{ fontSize: '0.72rem', opacity: 0.6, margin: 0 }}>⏱️ ~{editDurationMinutes} min (read from the video file)</p>
        )}
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
      {thumb ? (
        <img src={thumb} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
      ) : (
        <div style={{ width: 64, height: 36, borderRadius: 6, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🎬</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{video.title}</div>
        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>
          {video.source === 'youtube' ? 'YouTube link' : 'Uploaded file'}
          {video.durationSeconds ? ` · ~${Math.max(1, Math.round(video.durationSeconds / 60))} min` : ''}
        </div>
        {(video.tags ?? []).length > 0 && (
          <div className="row-wrap" style={{ gap: 3, marginTop: 3 }}>
            {(video.tags ?? []).map((t) => (
              <span key={t} className="tag-pill tag-pill-sm">{t}</span>
            ))}
          </div>
        )}
      </div>
      <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={startEdit} aria-label={`Edit ${video.title}`}>✏️ Edit</button>
      {confirmDelete ? (
        <>
          <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={onDelete}>Confirm</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(true)} aria-label={`Delete ${video.title}`}>
          🗑️
        </button>
      )}
    </div>
  );
}
