import { useState } from 'react';

// A reusable tag/category picker: type a new tag, or tap a previously-used
// one to reuse it — direct teacher instruction (re: Cinema video tags):
// "those tags should save and be able to be added in a multiselect...
// reusing for new videos." A plain HTML multi-select dropdown is a poor
// touch target on iPad (this app's priority device — no ctrl/cmd-click
// equivalent, tiny options), so this uses the same tap-to-toggle chip
// pattern the rest of the app already relies on for touch-first selection
// instead of introducing a second, worse-on-touch control.
export default function TagsEditor({
  tags,
  onChange,
  suggestions,
  label = 'Tags/categories (optional)',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  label?: string;
}) {
  const [draft, setDraft] = useState('');
  const addTag = (raw: string) => {
    const t = raw.trim();
    if (!t || tags.includes(t)) return;
    onChange([...tags, t]);
    setDraft('');
  };
  const removeTag = (t: string) => onChange(tags.filter((x) => x !== t));
  const unused = suggestions.filter((s) => !tags.includes(s));

  return (
    <div className="stack" style={{ gap: 6 }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>{label}</label>
      {tags.length > 0 && (
        <div className="row-wrap" style={{ gap: 4 }}>
          {tags.map((t) => (
            <span key={t} className="tag-pill tag-pill-sm">
              {t}{' '}
              <button
                aria-label={`Remove tag ${t}`}
                onClick={() => removeTag(t)}
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
          style={{ fontSize: '0.82rem', padding: '5px 8px', flex: 1, minWidth: 140 }}
          placeholder="Type a new tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(draft); } }}
        />
        <button className="btn chip-filter-sm" disabled={!draft.trim()} onClick={() => addTag(draft)}>+ Add</button>
      </div>
      {unused.length > 0 && (
        <div className="stack" style={{ gap: 3 }}>
          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>Reuse an existing tag:</span>
          <div className="row-wrap" style={{ gap: 4 }}>
            {unused.map((s) => (
              <button key={s} className="btn chip-filter-sm" onClick={() => addTag(s)}>
                ➕ {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
