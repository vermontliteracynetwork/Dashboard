import { useState } from 'react';
import { useStore } from '../store/store';
import { uploadImage } from '../lib/upload';
import { makeId } from '../lib/id';
import { DIARY_LIBRARY, STARTER_MEMES, STARTER_STICKERS, type DiaryLibrary, type LibraryPic } from '../lib/diaryBook';

// Build Queue 577: the teacher adds the stickers and memes students decorate their Diary pages with.
export default function DiaryLibraryManager() {
  const row = useStore((s) => s.styleLooks.find((r) => r.ownerId === DIARY_LIBRARY));
  const merge = useStore((s) => s.mergeStyleRow);
  const lib = (row?.look ?? {}) as DiaryLibrary;
  const [busy, setBusy] = useState('');
  const upload = async (kind: 'stickers' | 'memes', files: FileList | null) => {
    if (!files?.length) return;
    const add: Record<string, LibraryPic> = {};
    for (const [k, f] of [...files].entries()) {
      setBusy(`Uploading ${k + 1} of ${files.length}...`);
      try { add[makeId()] = { src: await uploadImage(f), name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').slice(0, 30) }; } catch { /* skip the one that failed */ }
    }
    merge(DIARY_LIBRARY, { [kind]: { ...(lib[kind] ?? {}), ...add } });
    setBusy(Object.keys(add).length < files.length ? 'Some pictures did not upload.' : '');
  };
  const remove = (kind: 'stickers' | 'memes', id: string) => merge(DIARY_LIBRARY, { [kind]: { ...(lib[kind] ?? {}), [id]: null } });
  const section = (kind: 'stickers' | 'memes', title: string, help: string) => {
    const items = Object.entries(lib[kind] ?? {}).filter((x): x is [string, LibraryPic] => !!x[1]);
    return (
      <div className="dlm-sec">
        <div className="dlm-head">
          <h3>{title} <span title={help} aria-label={help}>ⓘ</span></h3>
          <label className="btn btn-sm">Add pictures<input type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(kind, e.target.files); e.target.value = ''; }} /></label>
        </div>
        <div className="dlm-grid">
          {kind === 'stickers' && STARTER_STICKERS.map((s) => <figure key={s.src} className="dlm-starter" title="Built in"><img src={s.src} alt={s.name} /><figcaption>{s.name}</figcaption></figure>)}
          {items.map(([id, s]) => (
            <figure key={id}><img src={s.src} alt={s.name} /><figcaption>{s.name}</figcaption>
              <button type="button" className="dlm-x" onClick={() => remove(kind, id)} aria-label={`Remove ${s.name}`}>×</button></figure>
          ))}
          {kind === 'memes' && STARTER_MEMES.map((s2) => <figure key={s2.src} className="dlm-starter" title="Built in"><img src={s2.src} alt={s2.name} /><figcaption>{s2.name}</figcaption></figure>)}
        </div>
      </div>
    );
  };
  return (
    <section className="card dlm">
      <h2>Diary stickers and memes</h2>
      {busy && <p role="status">{busy}</p>}
      {section('stickers', 'Stickers', 'Pictures students drag onto their Diary pages to decorate. PNGs with see-through backgrounds look best.')}
      {section('memes', 'Memes', 'Pictures and memes students may relate to. They appear in the Memes tab of the Diary.')}
    </section>
  );
}
