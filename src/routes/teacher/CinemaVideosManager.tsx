import { useState } from 'react';
import { useStore } from '../../store/store';
import { extractYouTubeId, youtubeThumbnailUrl } from '../../lib/youtube';
import { uploadVideo } from '../../lib/upload';

// Videos shown in the in-world Cinema — direct teacher request: external
// links (YouTube, same extractYouTubeId path VideoTask already uses) or a
// file uploaded straight to Supabase Storage. Pure watch-for-fun content:
// unlimited replay, no task/mastery tracking, no done-state — a video that
// should be graded belongs on a real Task with type 'video' instead.
export default function CinemaVideosManager() {
  const cinemaVideos = useStore((s) => s.cinemaVideos);
  const addCinemaVideo = useStore((s) => s.addCinemaVideo);
  const deleteCinemaVideo = useStore((s) => s.deleteCinemaVideo);

  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLink = () => {
    const t = title.trim();
    const u = linkUrl.trim();
    if (!t || !u) return;
    if (!extractYouTubeId(u)) {
      setError("That doesn't look like a YouTube link — paste the full video URL.");
      return;
    }
    setError(null);
    addCinemaVideo({ title: t, source: 'youtube', url: u });
    setTitle('');
    setLinkUrl('');
  };

  const handleUpload = async (file: File) => {
    const t = title.trim() || file.name.replace(/\.[^.]+$/, '');
    setUploading(true);
    setError(null);
    try {
      const url = await uploadVideo(file);
      addCinemaVideo({ title: t, source: 'upload', url });
      setTitle('');
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
        Videos shown in the in-world Cinema. Add a YouTube link or upload your own file — students can watch any of these anytime, unlimited replay.
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
        {error && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: 0 }}>{error}</p>}
      </div>

      {cinemaVideos.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>No Cinema videos yet.</p>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {cinemaVideos.map((v) => {
            const ytId = v.source === 'youtube' ? extractYouTubeId(v.url) : null;
            return (
              <div key={v.id} className="row" style={{ gap: 10, alignItems: 'center', border: '2px solid var(--content-border)', borderRadius: 10, padding: 8 }}>
                {ytId ? (
                  <img src={youtubeThumbnailUrl(ytId)} alt="" style={{ width: 64, height: 36, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 64, height: 36, borderRadius: 6, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>🎬</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{v.title}</div>
                  <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{v.source === 'youtube' ? 'YouTube link' : 'Uploaded file'}</div>
                </div>
                <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={() => deleteCinemaVideo(v.id)} aria-label={`Delete ${v.title}`}>
                  🗑️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
