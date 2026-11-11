import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import { extractYouTubeId } from '../../lib/youtube';
import type { MusicTrack } from '../../types';
import { uploadAudio } from '../../lib/upload';
import { playableSrc, useMusicTracks } from '../../lib/musicLibrary';
import { isSongFile } from '../../components/GlobalMusicPlayer';

// Build Queue 609: song file uploads (an MP3 from Suno, for example) with no YouTube step. Checks the file first and
// turns a storage error into a plain next step instead of a raw message.
const MAX_SONG_MB = 50; // Supabase's standard upload limit per file
const SONG_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|webm|flac)$/i;
const songFileProblem = (f: File) =>
  !(f.type.startsWith('audio/') || SONG_EXT.test(f.name)) ? `"${f.name}" is not a song file. Use an MP3, M4A, WAV or OGG file.`
    : f.size > MAX_SONG_MB * 1024 * 1024 ? `"${f.name}" is too big (over ${MAX_SONG_MB} MB). Download it again as MP3, which is much smaller.`
      : null;
const uploadErrorText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e ?? '');
  if (/bucket not found/i.test(m)) return 'Song uploads need the "videos" storage bucket. Run supabase/schema.sql (the Storage part near the end) in the Supabase SQL Editor once, then try again.';
  if (/row-level security|policy|unauthorized|403/i.test(m)) return 'Supabase did not allow the upload. Run supabase/schema.sql (the Storage part near the end) in the Supabase SQL Editor once, then try again.';
  if (/payload too large|exceeded the maximum|413/i.test(m)) return `That file is too big for storage (over ${MAX_SONG_MB} MB). Download it again as MP3, which is much smaller.`;
  return m || 'That song could not be uploaded. Check the internet connection and try again.';
};
// Where a track's sound comes from, for the row label.
const sourceLabel = (url: string) =>
  extractYouTubeId(url) ? 'YouTube link, audio only'
    : /\/storage\/v1\/object\/public\//.test(url) ? 'Uploaded song file'
      : url.startsWith('/music/') ? 'Built-in song file'
        : 'Song file link';

// A shared music library — direct teacher request: a car radio, the
// Concert Hall building, and a placeable Boom Box all draw from this same
// list. Always audio only: unlike Cinema, nothing here ever shows video.
// Students hear a YouTube link through a hidden YouTube embed, and an
// uploaded song file (Build Queue 349/609) through a hidden audio element.
export default function MusicManager() {
  const musicTracks = useMusicTracks();
  const addMusicTrack = useStore((s) => s.addMusicTrack);
  const deleteMusicTrack = useStore((s) => s.deleteMusicTrack);

  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  // Build Queue 349 (her words: "add this suno song to the mp3 music library as a song. call it "Dog Nose Magic""):
  // song files (an MP3 downloaded from Suno, for example) upload straight into the library.
  // Build Queue 609: several files at once; each one is titled from its file name unless a title is typed (a typed
  // title is used for a single file). Bad files are skipped with a reason; the rest still upload.
  const [uploading, setUploading] = useState<string | null>(null);
  const uploadSongs = async (files: File[]) => {
    if (!files.length) return;
    setError(null);
    const pending = tagInput.trim();
    const finalTags = pending && !tags.includes(pending) ? [...tags, pending] : tags;
    const problems: string[] = [];
    let added = 0;
    for (const [i, file] of files.entries()) {
      const bad = songFileProblem(file);
      if (bad) { problems.push(bad); continue; }
      setUploading(files.length > 1 ? `Uploading ${i + 1} of ${files.length}...` : 'Uploading...');
      const t = (files.length === 1 && title.trim()) || file.name.replace(/\.[a-z0-9]+$/i, '').replace(/_+/g, ' ').trim() || 'New song';
      try { const url = await uploadAudio(file); addMusicTrack({ title: t, url, tags: finalTags }); added++; }
      catch (e) { problems.push(uploadErrorText(e)); break; }
    }
    setUploading(null);
    if (added) resetForm();
    if (problems.length) setError(Array.from(new Set(problems)).join(' '));
  };

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
    if (!extractYouTubeId(u) && !isSongFile(u)) {
      setError("Paste a YouTube link or a link to a song file (MP3), or use Upload a song file.");
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

  return (
    <div className="content-well stack">
      <strong>Music</strong>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        A shared music library: plays audio only (no video) from the car radio, the Concert Hall building, the Boom Box and the Music app on the student computer. Upload song files (MP3, M4A, WAV or OGG, for example a song downloaded from Suno; you can pick several at once), or paste a YouTube link with a title.
      </p>

      <div className="stack" style={{ gap: 8 }}>
        <input
          className="input"
          placeholder="Song/track title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            placeholder="Paste a YouTube link or a link to a song file…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addLink(); }}
          />
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!title.trim() || !linkUrl.trim()} onClick={addLink}>
            + Add Track
          </button>
          <label className="btn btn-sm" style={{ minHeight: 44, position: 'relative', opacity: uploading ? 0.6 : 1, pointerEvents: uploading ? 'none' : undefined }}
            title="Pick one or more song files from this computer. The title box is used when you pick one file; otherwise each song is named after its file.">
            {uploading ?? 'Upload song files'}
            <input type="file" multiple accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" hidden disabled={!!uploading} onChange={(e) => { void uploadSongs(Array.from(e.target.files ?? [])); e.target.value = ''; }} />
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
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="stack" style={{ gap: 6 }}>
            {visibleTracks.map((t) => (
              <MusicTrackRow key={t.id} track={t} onDelete={() => { if (!t.id.startsWith('builtin-')) deleteMusicTrack(t.id); }} />
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
  const [replacing, setReplacing] = useState(false);
  const builtin = track.id.startsWith('builtin-');
  const songFile = isSongFile(track.url);

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
    if (!extractYouTubeId(u) && !isSongFile(u)) {
      setError('Paste a YouTube link or a link to a song file, or use Replace with a song file.');
      return;
    }
    const pending = tagInput.trim();
    const finalTags = pending && !editTags.includes(pending) ? [...editTags, pending] : editTags;
    updateMusicTrack(track.id, { title: t, url: u, tags: finalTags });
    setEditing(false);
  };

  // Build Queue 609: swap the sound for a new song file and keep the title and tags.
  const replaceFile = async (file: File | undefined) => {
    if (!file) return;
    const bad = songFileProblem(file);
    if (bad) { setError(bad); return; }
    setReplacing(true); setError(null);
    try { setEditUrl(await uploadAudio(file)); }
    catch (e) { setError(uploadErrorText(e)); }
    setReplacing(false);
  };

  if (editing) {
    return (
      <div className="stack" style={{ gap: 8, border: '2px solid var(--purple)', borderRadius: 10, padding: 10 }}>
        <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Track title" />
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ flex: 1 }} value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="YouTube link or song file link" />
          <label className="btn btn-sm" style={{ minHeight: 44, opacity: replacing ? 0.6 : 1, pointerEvents: replacing ? 'none' : undefined }} title="Upload a new song file for this track. The title and tags stay.">
            {replacing ? 'Uploading...' : 'Replace with a song file'}
            <input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac" hidden disabled={replacing} onChange={(e) => { void replaceFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
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
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!editTitle.trim() || replacing} onClick={save}>Save</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 10, alignItems: 'center', border: '2px solid var(--content-border)', borderRadius: 10, padding: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{track.title}</div>
        <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>{sourceLabel(track.url)}</div>
        {(track.tags ?? []).length > 0 && (
          <div className="row-wrap" style={{ gap: 3, marginTop: 3 }}>
            {(track.tags ?? []).map((t) => (
              <span key={t} className="tag-pill tag-pill-sm">{t}</span>
            ))}
          </div>
        )}
      </div>
      {/* Build Queue 609: listen to a song file right here before students hear it. */}
      {songFile && <audio controls preload="none" src={playableSrc(track.url)} style={{ height: 32, width: 240, flexShrink: 0 }} aria-label={`Preview ${track.title}`} />}
      {builtin ? <span style={{ fontSize: '0.72rem', opacity: 0.6 }} title="Built into the app, so it cannot be edited or deleted here.">Built in</span> : <>
      <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={startEdit} aria-label={`Edit ${track.title}`}>Edit</button>
      {confirmDelete ? (
        <>
          <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={onDelete}>Confirm</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-sm btn-danger" style={{ minHeight: 44 }} onClick={() => setConfirmDelete(true)} aria-label={`Delete ${track.title}`}>
          Delete
        </button>
      )}
      </>}
    </div>
  );
}
