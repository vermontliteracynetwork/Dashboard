import { useState } from 'react';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import ImageUploadField from '../../components/ImageUploadField';
import type { MarketplaceItem, MarketplaceItemKind } from '../../types';

const KIND_LABELS: Record<MarketplaceItemKind, string> = {
  font: '🔤 Font',
  color: '🎨 Color',
  voice: '🔊 Voice',
  powerup: '🎫 Power-Up',
  prize: '🎁 Prize',
};

const STARTER_CATEGORIES = ['Free Time', 'Pets', 'Build a House', 'Tools', 'Fonts', 'Colors', 'Voices', 'Power-Ups', 'Seasonal'];

// A separate, class-wide bonus for finishing the WHOLE day's assignment
// (both Math and Literacy complete) — on top of the per-activity rewards
// every task already pays. Given the moment a student's streak ticks up.
function AssignmentRewardSettings() {
  const reward = useStore((s) => s.assignmentCompletionReward);
  const setAssignmentCompletionReward = useStore((s) => s.setAssignmentCompletionReward);
  const marketplaceItems = useStore((s) => s.marketplaceItems);

  const [enabled, setEnabled] = useState(!!reward);
  const [type, setType] = useState<'coins' | 'marketplaceItem' | 'spin'>(reward?.type ?? 'coins');
  const [amount, setAmount] = useState(reward?.amountCents ? (reward.amountCents / 100).toFixed(2) : '2.00');
  const [itemId, setItemId] = useState(reward?.itemId ?? marketplaceItems[0]?.id ?? '');

  const save = (next: { enabled: boolean; type: typeof type; amount: string; itemId: string }) => {
    if (!next.enabled) {
      setAssignmentCompletionReward(null);
      return;
    }
    if (next.type === 'coins') {
      setAssignmentCompletionReward({ type: 'coins', amountCents: Math.round(Math.max(0, parseFloat(next.amount) || 0) * 100) });
    } else if (next.type === 'marketplaceItem' && next.itemId) {
      setAssignmentCompletionReward({ type: 'marketplaceItem', itemId: next.itemId });
    } else if (next.type === 'spin') {
      setAssignmentCompletionReward({ type: 'spin' });
    }
  };

  return (
    <div className="chrome-frame stack" style={{ padding: 16 }}>
      <h3 style={{ marginTop: 0 }}>🎉 Whole-Assignment Completion Reward</h3>
      <p style={{ fontSize: '0.8rem', opacity: 0.75, margin: 0 }}>
        An extra bonus given the moment a student finishes BOTH Math and Literacy for the day — on top of what
        every activity already pays.
      </p>
      <label className="row" style={{ gap: 6 }}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save({ enabled: e.target.checked, type, amount, itemId });
          }}
        />
        Give a bonus for finishing the whole assignment
      </label>
      {enabled && (
        <div className="row-wrap" style={{ alignItems: 'center', gap: 10 }}>
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value as typeof type;
              setType(next);
              save({ enabled, type: next, amount, itemId });
            }}
          >
            <option value="coins">💰 Extra Class Cash</option>
            <option value="marketplaceItem">🎁 A marketplace item</option>
            <option value="spin">🎡 A bonus daily spin</option>
          </select>
          {type === 'coins' && (
            <div className="row" style={{ gap: 4 }}>
              <span>$</span>
              <input
                type="number"
                min={0}
                step={0.25}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  save({ enabled, type, amount: e.target.value, itemId });
                }}
                style={{ width: 80 }}
              />
            </div>
          )}
          {type === 'marketplaceItem' && (
            marketplaceItems.length === 0 ? (
              <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>Add an item below first.</span>
            ) : (
              <select
                value={itemId}
                onChange={(e) => {
                  setItemId(e.target.value);
                  save({ enabled, type, amount, itemId: e.target.value });
                }}
              >
                {marketplaceItems.map((it) => <option key={it.id} value={it.id}>{it.name} ({KIND_LABELS[it.kind]})</option>)}
              </select>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({ item }: { item: MarketplaceItem }) {
  const updateMarketplaceItem = useStore((s) => s.updateMarketplaceItem);
  const deleteMarketplaceItem = useStore((s) => s.deleteMarketplaceItem);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tagsInput, setTagsInput] = useState(item.tags.join(', '));

  return (
    <div className="chrome-frame stack" style={{ padding: 12, gap: 8 }}>
      <div className="row-wrap" style={{ alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f4effe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {item.icon.startsWith('/') || item.icon.startsWith('http') ? (
            <img src={item.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '1.4rem' }}>{item.icon}</span>
          )}
        </div>
        <span className="tag-pill" style={{ fontSize: '0.68rem' }}>{KIND_LABELS[item.kind]}</span>
        <input value={item.name} onChange={(e) => updateMarketplaceItem(item.id, { name: e.target.value })} style={{ width: 140 }} />
        <input value={item.category} onChange={(e) => updateMarketplaceItem(item.id, { category: e.target.value })} style={{ width: 110 }} placeholder="Category" />
        <div className="row" style={{ gap: 4 }}>
          <span>$</span>
          <input
            type="number"
            min={0}
            step={0.25}
            style={{ width: 72 }}
            value={(item.price / 100).toFixed(2)}
            onChange={(e) => updateMarketplaceItem(item.id, { price: Math.round(Math.max(0, parseFloat(e.target.value) || 0) * 100) })}
          />
        </div>
        {confirmDelete ? (
          <>
            <button className="btn btn-sm btn-danger" onClick={() => deleteMarketplaceItem(item.id)}>Confirm</button>
            <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </>
        ) : (
          <button className="btn btn-sm btn-danger" style={{ marginLeft: 'auto' }} onClick={() => setConfirmDelete(true)}>🗑️</button>
        )}
      </div>
      <div className="row-wrap" style={{ alignItems: 'center', gap: 8 }}>
        <input
          value={item.description ?? ''}
          onChange={(e) => updateMarketplaceItem(item.id, { description: e.target.value })}
          placeholder="Description (optional)"
          style={{ flex: 1, minWidth: 160 }}
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onBlur={() => updateMarketplaceItem(item.id, { tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean) })}
          placeholder="Tags, comma separated"
          style={{ flex: 1, minWidth: 160 }}
        />
        <label style={{ fontSize: '0.75rem' }}>
          Available from{' '}
          <input
            type="date"
            value={item.availableFrom ?? ''}
            onChange={(e) => updateMarketplaceItem(item.id, { availableFrom: e.target.value || null })}
          />
        </label>
        <label style={{ fontSize: '0.75rem' }}>
          until{' '}
          <input
            type="date"
            value={item.availableUntil ?? ''}
            onChange={(e) => updateMarketplaceItem(item.id, { availableUntil: e.target.value || null })}
          />
        </label>
      </div>
      {item.kind === 'font' && (
        <input
          value={item.cssFontFamily ?? ''}
          onChange={(e) => updateMarketplaceItem(item.id, { cssFontFamily: e.target.value })}
          placeholder="CSS font-family, e.g. 'Baloo 2', sans-serif"
          style={{ width: '100%' }}
        />
      )}
      {item.kind === 'color' && (
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {item.colorHex !== 'rainbow' && (
            <input type="color" value={item.colorHex ?? '#000000'} onChange={(e) => updateMarketplaceItem(item.id, { colorHex: e.target.value })} />
          )}
          <label className="row" style={{ gap: 4, fontSize: '0.75rem' }}>
            <input type="checkbox" checked={item.colorHex === 'rainbow'} onChange={(e) => updateMarketplaceItem(item.id, { colorHex: e.target.checked ? 'rainbow' : '#000000' })} />
            Animated rainbow
          </label>
          <label style={{ fontSize: '0.75rem' }}>
            Used for{' '}
            <select value={item.colorUse ?? 'text'} onChange={(e) => updateMarketplaceItem(item.id, { colorUse: e.target.value as 'text' | 'highlight' | 'marker' })}>
              <option value="text">Notes text color</option>
              <option value="highlight">Notes highlight color</option>
              <option value="marker">Whiteboard marker color</option>
            </select>
          </label>
        </div>
      )}
      {item.kind === 'voice' && (
        <div className="row-wrap" style={{ gap: 10, alignItems: 'center', fontSize: '0.8rem' }}>
          <label>Pitch <input type="number" min={0} max={2} step={0.1} value={item.voicePitch ?? 1} onChange={(e) => updateMarketplaceItem(item.id, { voicePitch: parseFloat(e.target.value) || 1 })} style={{ width: 60 }} /></label>
          <label>Speed <input type="number" min={0.5} max={2} step={0.05} value={item.voiceRate ?? 1} onChange={(e) => updateMarketplaceItem(item.id, { voiceRate: parseFloat(e.target.value) || 1 })} style={{ width: 60 }} /></label>
          <input
            value={(item.voiceHints ?? []).join(', ')}
            onChange={(e) => updateMarketplaceItem(item.id, { voiceHints: e.target.value.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean) })}
            placeholder="Real-voice name hints (optional), e.g. male, daniel"
            style={{ flex: 1, minWidth: 200 }}
          />
        </div>
      )}
    </div>
  );
}

export default function MarketplaceManager() {
  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const addMarketplaceItem = useStore((s) => s.addMarketplaceItem);

  const [kind, setKind] = useState<MarketplaceItemKind>('prize');
  const [name, setName] = useState('');
  const [category, setCategory] = useState(STARTER_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [icon, setIcon] = useState('🎁');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [price, setPrice] = useState('2.00');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [availableFrom, setAvailableFrom] = useState('');
  const [availableUntil, setAvailableUntil] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | MarketplaceItemKind>('all');

  const existingCategories = [...new Set([...STARTER_CATEGORIES, ...marketplaceItems.map((it) => it.category)])];
  const visibleItems = marketplaceItems.filter((it) => kindFilter === 'all' || it.kind === kindFilter);
  const grouped = [...new Set(visibleItems.map((it) => it.category))]
    .map((cat) => ({ cat, items: visibleItems.filter((it) => it.category === cat) }))
    .filter((g) => g.items.length > 0);

  const submit = () => {
    const finalCategory = category === '__custom' ? customCategory.trim() : category;
    if (!name.trim() || !finalCategory) return;
    addMarketplaceItem({
      kind,
      name: name.trim(),
      category: finalCategory,
      icon: imageUrl || icon.trim() || '🎁',
      price: Math.round(Math.max(0, parseFloat(price) || 0) * 100),
      description: description.trim() || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      availableFrom: availableFrom || null,
      availableUntil: availableUntil || null,
      ...(kind === 'font' ? { cssFontFamily: "'Nunito', sans-serif" } : {}),
      ...(kind === 'color' ? { colorHex: '#7c3aed', colorUse: 'text' as const } : {}),
      ...(kind === 'voice' ? { voicePitch: 1, voiceRate: 1, voiceHints: [] } : {}),
    });
    setName('');
    setDescription('');
    setImageUrl(undefined);
    setTags('');
    setAvailableFrom('');
    setAvailableUntil('');
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <h1>🛍️ Marketplace</h1>
        <p style={{ opacity: 0.75, fontSize: '0.85rem', margin: 0 }}>
          Full control over everything students can buy — fonts, colors, voices, power-ups, and prizes. Set prices,
          categories, tags, and an optional date window for seasonal or limited-time items. (Characters and Emotes
          use the app's bundled art and aren't editable here.)
        </p>

        <AssignmentRewardSettings />

        <div className="chrome-frame stack" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>➕ New Item</h3>
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div>
              <label>Type</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as MarketplaceItemKind)}>
                {(Object.keys(KIND_LABELS) as MarketplaceItemKind[]).map((k) => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}
              </select>
            </div>
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
          <div className="row-wrap" style={{ alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Tags (comma separated, optional)</label>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. seasonal, fun" />
            </div>
            <div>
              <label>Available from (optional)</label>
              <input type="date" value={availableFrom} onChange={(e) => setAvailableFrom(e.target.value)} />
            </div>
            <div>
              <label>Available until (optional)</label>
              <input type="date" value={availableUntil} onChange={(e) => setAvailableUntil(e.target.value)} />
            </div>
          </div>
          <div style={{ maxWidth: 260 }}>
            <ImageUploadField label="Or upload a photo instead of an emoji" value={imageUrl} onChange={setImageUrl} />
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} disabled={!name.trim()} onClick={submit}>
            Add Item
          </button>
        </div>

        <div className="row-wrap">
          <button className={`btn btn-sm ${kindFilter === 'all' ? 'btn-primary' : ''}`} onClick={() => setKindFilter('all')}>All</button>
          {(Object.keys(KIND_LABELS) as MarketplaceItemKind[]).map((k) => (
            <button key={k} className={`btn btn-sm ${kindFilter === k ? 'btn-primary' : ''}`} onClick={() => setKindFilter(k)}>{KIND_LABELS[k]}</button>
          ))}
        </div>

        <div className="stack">
          {grouped.length === 0 && <p style={{ opacity: 0.7 }}>Nothing here yet — add one above and it appears in every student's Shop.</p>}
          {grouped.map((g) => (
            <div key={g.cat} className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: '0.9rem' }}>{g.cat}</strong>
              {g.items.map((it) => <ItemRow key={it.id} item={it} />)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
