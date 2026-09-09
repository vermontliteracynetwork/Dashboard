import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { AVATAR_CATALOG } from '../store/badges';
import { AvatarGlyph } from './AvatarGlyph';
import { EMOTE_CATALOG } from '../lib/emoteCatalog';
import { formatMoney } from '../lib/money';
import { todayISO } from '../lib/dates';
import type { MarketplaceItem, MarketplaceItemKind } from '../types';

type Tab = 'characters' | 'emotes' | 'writing' | 'whiteboard' | 'voices' | 'prizes' | 'powerups' | 'mystuff';

function isAvailableToday(item: MarketplaceItem): boolean {
  const today = todayISO();
  if (item.availableFrom && today < item.availableFrom) return false;
  if (item.availableUntil && today > item.availableUntil) return false;
  return true;
}

// A small shared category + tag + search filter bar, reused across every
// tab backed by teacher-authored marketplace items — with everything
// fully customizable now, browsing needs real filters, not just a flat grid.
function ItemFilterBar({
  items,
  category,
  onCategory,
  tag,
  onTag,
  query,
  onQuery,
}: {
  items: MarketplaceItem[];
  category: string;
  onCategory: (v: string) => void;
  tag: string;
  onTag: (v: string) => void;
  query: string;
  onQuery: (v: string) => void;
}) {
  const categories = useMemo(() => [...new Set(items.map((it) => it.category))].sort(), [items]);
  const tags = useMemo(() => [...new Set(items.flatMap((it) => it.tags))].sort(), [items]);
  if (items.length < 4) return null;
  return (
    <div className="row-wrap" style={{ gap: 6, marginBottom: 10 }}>
      <input
        placeholder="🔍 Search..."
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        style={{ minHeight: 40, flex: '1 1 140px' }}
      />
      {categories.length > 1 && (
        <select value={category} onChange={(e) => onCategory(e.target.value)} style={{ minHeight: 40 }}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      )}
      {tags.length > 0 && (
        <select value={tag} onChange={(e) => onTag(e.target.value)} style={{ minHeight: 40 }}>
          <option value="">All tags</option>
          {tags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      )}
    </div>
  );
}

function useItemFilter(items: MarketplaceItem[]) {
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [query, setQuery] = useState('');
  const filtered = items.filter((it) => {
    if (category && it.category !== category) return false;
    if (tag && !it.tags.includes(tag)) return false;
    if (query && !it.name.toLowerCase().includes(query.trim().toLowerCase())) return false;
    return true;
  });
  return { filtered, category, setCategory, tag, setTag, query, setQuery };
}

export default function Marketplace() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const buyAvatar = useStore((s) => s.buyAvatar);
  const buyEmote = useStore((s) => s.buyEmote);
  const equipEmote = useStore((s) => s.equipEmote);
  const buyMarketplaceItem = useStore((s) => s.buyMarketplaceItem);
  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const updateStudent = useStore((s) => s.updateStudent);
  const [tab, setTab] = useState<Tab>('characters');

  const student = students.find((s) => s.id === currentStudentId);
  if (!student) return null;
  const studentId = student.id;

  const ownedAvatars = AVATAR_CATALOG.filter((a) => student.ownedAvatarIds.includes(a.id));
  const ownedEmotes = EMOTE_CATALOG.filter((e) => student.ownedEmoteIds.includes(e.id));

  const byKind = (kind: MarketplaceItemKind) => marketplaceItems.filter((it) => it.kind === kind && isAvailableToday(it));
  const fontItems = byKind('font');
  const allColorItems = byKind('color');
  const textColorItems = allColorItems.filter((it) => (it.colorUse ?? 'text') === 'text');
  const highlightColorItems = allColorItems.filter((it) => it.colorUse === 'highlight');
  const markerColorItems = allColorItems.filter((it) => it.colorUse === 'marker');
  const voiceItems = byKind('voice');
  const prizeItems = byKind('prize');
  const powerupItems = byKind('powerup');

  const prizeFilter = useItemFilter(prizeItems);
  const fontFilter = useItemFilter(fontItems);
  const voiceFilter = useItemFilter(voiceItems);

  const ownedFieldFor = (kind: MarketplaceItemKind): keyof typeof student | null => {
    if (kind === 'font') return 'ownedFontIds';
    if (kind === 'color') return 'ownedColorIds';
    if (kind === 'voice') return 'ownedVoiceIds';
    if (kind === 'prize') return 'ownedPrizeIds';
    return null;
  };

  const renderBuyableItem = (item: MarketplaceItem, opts?: { iconSize?: number }) => {
    const ownedField = ownedFieldFor(item.kind);
    const owned = ownedField ? (student[ownedField] as string[]).includes(item.id) : false;
    const affordable = student.coins >= item.price;
    const isImg = item.icon.startsWith('/') || item.icon.startsWith('http');
    return (
      <div key={item.id} className="shop-item-card" style={{ width: 140 }}>
        <div className="shop-item-icon-frame" style={item.kind === 'color' ? { width: opts?.iconSize ?? 44, height: opts?.iconSize ?? 44, borderRadius: '50%', background: item.colorHex === 'rainbow' ? 'conic-gradient(red, orange, yellow, green, blue, purple, red)' : item.colorHex } : item.kind === 'font' ? { width: '100%', fontFamily: item.cssFontFamily, fontSize: '1.6rem' } : {}}>
          {item.kind !== 'color' && item.kind !== 'font' && (isImg ? <img src={item.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.8rem' }}>{item.icon}</span>)}
          {item.kind === 'font' && 'Aa'}
        </div>
        <strong style={{ fontSize: '0.72rem' }}>{item.name}</strong>
        {item.description && <p style={{ fontSize: '0.6rem', opacity: 0.7, margin: 0 }}>{item.description}</p>}
        {item.tags.length > 0 && (
          <div className="row-wrap" style={{ gap: 2, justifyContent: 'center' }}>
            {item.tags.map((t) => <span key={t} className="tag-pill" style={{ fontSize: '0.55rem', padding: '1px 6px' }}>{t}</span>)}
          </div>
        )}
        {owned ? (
          <span className="tag-pill" style={{ fontSize: '0.62rem', background: 'var(--success)', color: '#fff' }}>✓ Unlocked</span>
        ) : (
          <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
            <button
              className="shop-price-chip"
              style={{ border: '2px solid var(--ink)', minHeight: 40, cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
              disabled={!affordable}
              onClick={() => buyMarketplaceItem(studentId, item.id)}
            >
              🪙 {formatMoney(item.price)}
            </button>
            {!affordable && (
              <span style={{ fontSize: '0.62rem', color: 'var(--danger)', fontWeight: 700 }}>
                🔒 Need {formatMoney(item.price - student.coins)} more
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="container stack">
      <div className="shop-panel">
          <div className="shop-header">
            <span className="shop-ribbon">🛍️ SHOP</span>
            <div className="row" style={{ gap: 8 }}>
              <span className="shop-balance-chip" title="Your Piggy Bank balance — spend it here!">
                🐷 {formatMoney(student.coins)}
              </span>
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/home')}>🏠 Home</button>
            </div>
          </div>

          <div className="shop-tabs">
            <button className={`shop-tab-btn ${tab === 'characters' ? 'active' : ''}`} onClick={() => setTab('characters')}>
              🧑 Characters
            </button>
            <button className={`shop-tab-btn ${tab === 'emotes' ? 'active' : ''}`} onClick={() => setTab('emotes')}>
              😊 Emotes
            </button>
            <button className={`shop-tab-btn ${tab === 'writing' ? 'active' : ''}`} onClick={() => setTab('writing')}>
              ✍️ Writing
            </button>
            <button className={`shop-tab-btn ${tab === 'whiteboard' ? 'active' : ''}`} onClick={() => setTab('whiteboard')}>
              🖊️ Whiteboard
            </button>
            <button className={`shop-tab-btn ${tab === 'voices' ? 'active' : ''}`} onClick={() => setTab('voices')}>
              🔊 Voices
            </button>
            {prizeItems.length > 0 && (
              <button className={`shop-tab-btn ${tab === 'prizes' ? 'active' : ''}`} onClick={() => setTab('prizes')}>
                🎁 Prizes
              </button>
            )}
            <button className={`shop-tab-btn ${tab === 'powerups' ? 'active' : ''}`} onClick={() => setTab('powerups')}>
              🎫 Power-Ups
            </button>
            <button className={`shop-tab-btn ${tab === 'mystuff' ? 'active' : ''}`} onClick={() => setTab('mystuff')}>
              🎒 My Stuff
            </button>
          </div>

          <div className="shop-shelf">
            {tab === 'characters' && (
              <div className="shop-item-grid">
                {AVATAR_CATALOG.map((a) => {
                  const owned = student.ownedAvatarIds.includes(a.id);
                  const equipped = student.avatar === a.id;
                  const affordable = student.coins >= a.price;
                  return (
                    <div key={a.id} className="shop-item-card">
                      <div className="shop-item-icon-frame" style={{ outline: equipped ? '3px solid var(--purple)' : 'none' }}>
                        <AvatarGlyph value={a.id} />
                      </div>
                      <strong style={{ fontSize: '0.75rem' }}>{a.name}</strong>
                      {equipped ? (
                        <span className="tag-pill" style={{ fontSize: '0.68rem', background: 'var(--success)', color: '#fff' }}>
                          ✓ Wearing
                        </span>
                      ) : owned ? (
                        <button className="btn btn-sm btn-primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => updateStudent(studentId, { avatar: a.id })}>
                          Wear
                        </button>
                      ) : (
                        <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
                          <button
                            className="shop-price-chip"
                            style={{ border: '2px solid var(--ink)', minHeight: 40, cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
                            disabled={!affordable}
                            onClick={() => buyAvatar(studentId, a.id)}
                          >
                            🪙 {formatMoney(a.price)}
                          </button>
                          {!affordable && (
                            <span style={{ fontSize: '0.62rem', color: 'var(--danger)', fontWeight: 700 }}>
                              🔒 Need {formatMoney(a.price - student.coins)} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'emotes' && (
              <div className="shop-item-grid">
                {EMOTE_CATALOG.map((e) => {
                  const owned = student.ownedEmoteIds.includes(e.id);
                  const equipped = student.equippedEmoteId === e.id;
                  const affordable = student.coins >= e.price;
                  return (
                    <div key={e.id} className="shop-item-card">
                      <div className="shop-item-icon-frame" style={{ outline: equipped ? '3px solid var(--purple)' : 'none' }}>
                        <img src={e.src} alt="" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
                      </div>
                      <strong style={{ fontSize: '0.72rem' }}>{e.name}</strong>
                      {equipped ? (
                        <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => equipEmote(studentId, null)}>
                          Unequip
                        </button>
                      ) : owned ? (
                        <button className="btn btn-sm btn-primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => equipEmote(studentId, e.id)}>
                          Show
                        </button>
                      ) : (
                        <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
                          <button
                            className="shop-price-chip"
                            style={{ border: '2px solid var(--ink)', minHeight: 40, cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
                            disabled={!affordable}
                            onClick={() => buyEmote(studentId, e.id)}
                          >
                            🪙 {formatMoney(e.price)}
                          </button>
                          {!affordable && (
                            <span style={{ fontSize: '0.62rem', color: 'var(--danger)', fontWeight: 700 }}>
                              🔒 Need {formatMoney(e.price - student.coins)} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'writing' && (
              <div className="stack" style={{ gap: 16 }}>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>🔤 Fonts for your Notes</strong>
                  <ItemFilterBar items={fontItems} category={fontFilter.category} onCategory={fontFilter.setCategory} tag={fontFilter.tag} onTag={fontFilter.setTag} query={fontFilter.query} onQuery={fontFilter.setQuery} />
                  <div className="shop-item-grid" style={{ marginTop: 8 }}>
                    {fontFilter.filtered.map((f) => renderBuyableItem(f))}
                  </div>
                </div>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>🎨 Text Colors</strong>
                  <div className="shop-item-grid" style={{ marginTop: 8 }}>
                    {textColorItems.map((c) => renderBuyableItem(c, { iconSize: 44 }))}
                  </div>
                </div>
                {highlightColorItems.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>🖍️ Highlight Colors</strong>
                    <div className="shop-item-grid" style={{ marginTop: 8 }}>
                      {highlightColorItems.map((c) => renderBuyableItem(c, { iconSize: 44 }))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'whiteboard' && (
              <div>
                <strong style={{ fontSize: '0.85rem' }}>✏️ Marker Colors</strong>
                <div className="shop-item-grid" style={{ marginTop: 8 }}>
                  {markerColorItems.length === 0 ? (
                    <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No marker colors yet — ask your teacher to add some!</p>
                  ) : (
                    markerColorItems.map((c) => renderBuyableItem(c, { iconSize: 44 }))
                  )}
                </div>
              </div>
            )}

            {tab === 'voices' && (
              <div>
                <ItemFilterBar items={voiceItems} category={voiceFilter.category} onCategory={voiceFilter.setCategory} tag={voiceFilter.tag} onTag={voiceFilter.setTag} query={voiceFilter.query} onQuery={voiceFilter.setQuery} />
                <div className="shop-item-grid">
                  {voiceFilter.filtered.map((v) => renderBuyableItem(v))}
                </div>
              </div>
            )}

            {tab === 'prizes' && (
              <div>
                <ItemFilterBar items={prizeItems} category={prizeFilter.category} onCategory={prizeFilter.setCategory} tag={prizeFilter.tag} onTag={prizeFilter.setTag} query={prizeFilter.query} onQuery={prizeFilter.setQuery} />
                <div className="shop-item-grid">
                  {prizeFilter.filtered.map((p) => renderBuyableItem(p))}
                </div>
                <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: '10px 0 0' }}>
                  💡 Bought a prize? Show this screen to your teacher — they'll help you get it!
                </p>
              </div>
            )}

            {tab === 'powerups' && (
              <div className="shop-item-grid">
                {powerupItems.map((p) => {
                  const affordable = student.coins >= p.price;
                  return (
                    <div key={p.id} className="shop-item-card" style={{ width: 156 }}>
                      <div className="shop-item-icon-frame" style={{ width: 72, height: 72 }}>
                        <span style={{ fontSize: '2rem' }}>{p.icon}</span>
                      </div>
                      <strong style={{ fontSize: '0.8rem' }}>{p.name}</strong>
                      {p.description && <p style={{ fontSize: '0.66rem', opacity: 0.75, margin: 0 }}>{p.description}</p>}
                      {p.id === 'powerup-skip' && <div className="tag-pill" style={{ fontSize: '0.68rem' }}>You have: {student.skipTokens}</div>}
                      <button
                        className="shop-price-chip"
                        style={{ border: '2px solid var(--ink)', minHeight: 40, cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
                        disabled={!affordable}
                        onClick={() => buyMarketplaceItem(studentId, p.id)}
                      >
                        🪙 {formatMoney(p.price)}
                      </button>
                      {!affordable && (
                        <span style={{ fontSize: '0.6rem', color: 'var(--danger)', fontWeight: 700 }}>
                          🔒 Need {formatMoney(p.price - student.coins)} more
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'mystuff' && (
              <div className="stack" style={{ gap: 16 }}>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>🧑 Your Characters</strong>
                  <div className="shop-item-grid" style={{ marginTop: 8 }}>
                    {ownedAvatars.map((a) => {
                      const equipped = student.avatar === a.id;
                      return (
                        <div key={a.id} className="shop-item-card">
                          <div className="shop-item-icon-frame" style={{ outline: equipped ? '3px solid var(--purple)' : 'none' }}>
                            <AvatarGlyph value={a.id} />
                          </div>
                          <strong style={{ fontSize: '0.75rem' }}>{a.name}</strong>
                          {equipped ? (
                            <span className="tag-pill" style={{ fontSize: '0.68rem', background: 'var(--success)', color: '#fff' }}>✓ Wearing</span>
                          ) : (
                            <button className="btn btn-sm btn-primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => updateStudent(studentId, { avatar: a.id })}>
                              Wear
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>😊 Your Emotes</strong>
                  <div className="shop-item-grid" style={{ marginTop: 8 }}>
                    {ownedEmotes.length === 0 && <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No emotes yet — find some in the 😊 Emotes tab!</p>}
                    {ownedEmotes.map((e) => {
                      const equipped = student.equippedEmoteId === e.id;
                      return (
                        <div key={e.id} className="shop-item-card">
                          <div className="shop-item-icon-frame" style={{ outline: equipped ? '3px solid var(--purple)' : 'none' }}>
                            <img src={e.src} alt="" style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
                          </div>
                          <strong style={{ fontSize: '0.72rem' }}>{e.name}</strong>
                          {equipped ? (
                            <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => equipEmote(studentId, null)}>
                              Unequip
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => equipEmote(studentId, e.id)}>
                              Show
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
