import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import ImageUploadField from '../../components/ImageUploadField';
import { FONT_CATALOG } from '../../lib/fontCatalog';
import { COLOR_CATALOG } from '../../lib/colorCatalog';
import { VOICE_CATALOG } from '../../lib/voiceCatalog';
import { formatMoney } from '../../lib/money';
import type { CustomPrize } from '../../types';

const STARTER_CATEGORIES = ['Free Time', 'Pets', 'Build a House', 'Tools'];

function PrizeRow({ prize }: { prize: CustomPrize }) {
  const updateCustomPrize = useStore((s) => s.updateCustomPrize);
  const deleteCustomPrize = useStore((s) => s.deleteCustomPrize);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="chrome-frame row-wrap" style={{ padding: 12, alignItems: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f4effe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {prize.icon.startsWith('/') || prize.icon.startsWith('http') ? (
          <img src={prize.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: '1.4rem' }}>{prize.icon}</span>
        )}
      </div>
      <input value={prize.name} onChange={(e) => updateCustomPrize(prize.id, { name: e.target.value })} style={{ width: 140 }} />
      <input value={prize.category} onChange={(e) => updateCustomPrize(prize.id, { category: e.target.value })} style={{ width: 120 }} />
      <div className="row" style={{ gap: 4 }}>
        <span>$</span>
        <input
          type="number"
          min={0}
          step={0.25}
          style={{ width: 72 }}
          value={(prize.price / 100).toFixed(2)}
          onChange={(e) => updateCustomPrize(prize.id, { price: Math.round(Math.max(0, parseFloat(e.target.value) || 0) * 100) })}
        />
      </div>
      <input
        value={prize.description ?? ''}
        onChange={(e) => updateCustomPrize(prize.id, { description: e.target.value })}
        placeholder="Description (optional)"
        style={{ flex: 1, minWidth: 160 }}
      />
      {confirmDelete ? (
        <>
          <button className="btn btn-sm btn-danger" onClick={() => deleteCustomPrize(prize.id)}>Confirm</button>
          <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </>
      ) : (
        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>🗑️</button>
      )}
    </div>
  );
}

export default function MarketplaceManager() {
  const customPrizes = useStore((s) => s.customPrizes);
  const addCustomPrize = useStore((s) => s.addCustomPrize);

  const [name, setName] = useState('');
  const [category, setCategory] = useState(STARTER_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [price, setPrice] = useState('2.00');
  const [description, setDescription] = useState('');

  const existingCategories = [...new Set([...STARTER_CATEGORIES, ...customPrizes.map((p) => p.category)])];
  const grouped = existingCategories
    .map((cat) => ({ cat, items: customPrizes.filter((p) => p.category === cat) }))
    .filter((g) => g.items.length > 0);

  const submit = () => {
    const finalCategory = category === '__custom' ? customCategory.trim() : category;
    if (!name.trim() || !finalCategory) return;
    addCustomPrize({
      name: name.trim(),
      category: finalCategory,
      icon: imageUrl || icon.trim() || '🎁',
      price: Math.round(Math.max(0, parseFloat(price) || 0) * 100),
      description: description.trim() || undefined,
    });
    setName('');
    setDescription('');
    setImageUrl(undefined);
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🛍️ Marketplace</h1>
        <p style={{ opacity: 0.75, fontSize: '0.85rem', margin: 0 }}>
          Manage everything students can buy. Characters, emotes, fonts, colors, and voices are built-in catalogs
          (below); prizes are yours to define — free time, pets, pieces of a build, anything you want to offer.
        </p>

        <div className="chrome-frame stack" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>➕ New Prize</h3>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 10 min free time" />
            </div>
            <div>
              <label>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {existingCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__custom">➕ New category…</option>
              </select>
              {category === '__custom' && (
                <input value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Category name" style={{ marginTop: 4 }} />
              )}
            </div>
            <div>
              <label>Icon (emoji)</label>
              <input value={icon} onChange={(e) => setIcon(e.target.value)} style={{ width: 60 }} />
            </div>
            <div>
              <label>Price</label>
              <div className="row" style={{ gap: 4 }}>
                <span>$</span>
                <input type="number" min={0} step={0.25} value={price} onChange={(e) => setPrice(e.target.value)} style={{ width: 72 }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <label>Description (optional)</label>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div style={{ maxWidth: 260 }}>
            <ImageUploadField label="Or upload a photo instead of an emoji" value={imageUrl} onChange={setImageUrl} />
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!name.trim()} onClick={submit}>
            Add Prize
          </button>
        </div>

        <div className="stack">
          <h3>🎁 Prizes</h3>
          {grouped.length === 0 && <p style={{ opacity: 0.7 }}>No prizes yet — add one above and it appears in every student's Shop.</p>}
          {grouped.map((g) => (
            <div key={g.cat} className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: '0.9rem' }}>{g.cat}</strong>
              {g.items.map((p) => <PrizeRow key={p.id} prize={p} />)}
            </div>
          ))}
        </div>

        <div className="chrome-frame stack" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Built-in catalogs</h3>
          <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
            Characters and Emotes come from the bundled art set. Fonts, Colors, and Voices are fixed presets students
            unlock with Class Cash — here's what's available:
          </p>
          <div className="row-wrap">
            {FONT_CATALOG.map((f) => <span key={f.id} className="tag-pill">{f.name} — {formatMoney(f.price)}</span>)}
          </div>
          <div className="row-wrap">
            {COLOR_CATALOG.map((c) => <span key={c.id} className="tag-pill">{c.name} — {formatMoney(c.price)}</span>)}
          </div>
          <div className="row-wrap">
            {VOICE_CATALOG.map((v) => <span key={v.id} className="tag-pill">{v.name} — {formatMoney(v.price)}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
