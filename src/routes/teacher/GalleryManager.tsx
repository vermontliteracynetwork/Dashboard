import { useMemo, useState } from 'react';
import { useStore } from '../../store/store';
import ImageUploadField from '../../components/ImageUploadField';
import type { GalleryItem } from '../../types';

// The Playground's Gallery — direct teacher request (referencing the
// Kinzoo app's kid-facing content gallery): a curated feed of images
// ("memes") kids can browse for fun, distinct from any task. Same shape
// as CinemaVideosManager just for images: teacher-authored, unlimited
// browse, no mastery tracking, fully editable/deletable. Video content
// from the same original request isn't duplicated here — Cinema already
// covers that exact purpose.
export default function GalleryManager() {
  const galleryItems = useStore((s) => s.galleryItems);
  const addGalleryItem = useStore((s) => s.addGalleryItem);
  const deleteGalleryItem = useStore((s) => s.deleteGalleryItem);

  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  const allTags = useMemo(
    () => Array.from(new Set(galleryItems.flatMap((g) => g.tags ?? []))).sort(),
    [galleryItems],
  );
  const visibleItems = tagFilter ? galleryItems.filter((g) => (g.tags ?? []).includes(tagFilter)) : galleryItems;

  const addTagToForm = () => {
    const t = tagInput.trim();
    if (!t || tags.includes(t)) return;
    setTags([...tags, t]);
    setTagInput('');
  };

  const add = () => {
    if (!imageUrl) return;
    addGalleryItem({ imageUrl, caption: caption.trim() || undefined, tags });
    setImageUrl('');
    setCaption('');
    setTags([]);
    setTagInput('');
  };

  return (
    <div className="content-well stack">
      <strong>🎉 Gallery</strong>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        A fun, teacher-curated feed of images shown in the Playground: silly pictures, memes, anything kids can just look through. Videos belong in Cinema instead.
      </p>

      <div className="stack" style={{ gap: 8 }}>
        <div style={{ maxWidth: 280 }}>
          <ImageUploadField label="Add an image" value={imageUrl} onChange={setImageUrl} />
        </div>
        <input
          className="input"
          placeholder="Caption (optional)"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <div className="stack" style={{ gap: 6, maxWidth: 340 }}>
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
              placeholder="e.g. Silly, Animals…"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTagToForm(); } }}
            />
            <button className="btn chip-filter-sm" disabled={!tagInput.trim()} onClick={addTagToForm}>+ Add</button>
          </div>
        </div>
        <button className="btn btn-sm btn-primary" style={{ minHeight: 44, alignSelf: 'flex-start' }} disabled={!imageUrl} onClick={add}>
          + Add to Gallery
        </button>
      </div>

      {galleryItems.length === 0 ? (
        <p style={{ opacity: 0.6, fontSize: '0.85rem', margin: 0 }}>No Gallery images yet.</p>
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
          <div className="row-wrap" style={{ gap: 8 }}>
            {visibleItems.map((g) => (
              <GalleryItemThumb key={g.id} item={g} onDelete={() => deleteGalleryItem(g.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function GalleryItemThumb({ item, onDelete }: { item: GalleryItem; onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="stack" style={{ gap: 4, width: 110, border: '2px solid var(--content-border)', borderRadius: 10, padding: 6 }}>
      <img src={item.imageUrl} alt={item.caption ?? ''} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 6 }} />
      {item.caption && <div style={{ fontSize: '0.7rem', fontWeight: 700, lineHeight: 1.2 }}>{item.caption}</div>}
      {confirmDelete ? (
        <div className="row" style={{ gap: 4 }}>
          <button className="btn chip-filter-sm btn-danger" onClick={onDelete}>Confirm</button>
          <button className="btn chip-filter-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn chip-filter-sm btn-danger" onClick={() => setConfirmDelete(true)} aria-label="Delete image">🗑️</button>
      )}
    </div>
  );
}
