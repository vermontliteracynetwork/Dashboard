import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { AVATAR_CATALOG } from '../store/badges';
import { AvatarGlyph } from './AvatarGlyph';
import { avatarPriceFor } from '../lib/avatarCatalog';
import { EMOTE_CATALOG, emotePriceFor } from '../lib/emoteCatalog';
import { formatMoney } from '../lib/money';
import { todayISO } from '../lib/dates';
import { playCashRegister } from '../lib/chime';
import FocusBanner from './FocusBanner';
import WebpageFrame from './WebpageFrame';
import { petDefById, thumbnailFor } from '../lib/petCatalog';
import type { PetDef } from '../lib/petCatalog';
import type { MarketplaceItem, MarketplaceItemKind } from '../types';

type Tab = 'characters' | 'emotes' | 'writing' | 'whiteboard' | 'voices' | 'prizes' | 'powerups' | 'pets' | 'mystuff' | 'receipts';

interface CartEntry {
  key: string; // `${source}-${id}`, unique per cart
  source: 'avatar' | 'emote' | 'item';
  id: string;
  name: string;
  icon: string; // emoji, or an image URL
  price: number;
  // Homeplot's needs-vs-wants standard: one optional, non-blocking reflection
  // tap in the cart, never required, never gates Confirm Purchase.
  needsWants?: 'need' | 'want';
}

interface ReceiptLine extends CartEntry {
  ok: boolean; // false if it failed at checkout (already owned/unaffordable by then)
}

// Homeplot's Bank standard, "Count It Out" checkout: the actual skill this
// targets (per the €UReka currency-training precedent for ASD teens) is
// recognizing and combining real bills/coins — money today only ever shows
// up as a number. Tap-to-add rather than drag-to-a-tray: this population's
// working set already leans on tap/one-thing-does-one-thing everywhere else
// in this app, and a mis-aimed drag is a much easier miss than a mis-tapped
// button for a student with fine-motor or motor-planning differences — an
// accessibility call, not a shortcut past the "real bill/coin" spec.
const DENOMINATIONS = [
  { cents: 2000, label: '$20', kind: 'bill' as const },
  { cents: 1000, label: '$10', kind: 'bill' as const },
  { cents: 500, label: '$5', kind: 'bill' as const },
  { cents: 100, label: '$1', kind: 'bill' as const },
  { cents: 25, label: '25¢', kind: 'coin' as const },
  { cents: 10, label: '10¢', kind: 'coin' as const },
  { cents: 5, label: '5¢', kind: 'coin' as const },
  { cents: 1, label: '1¢', kind: 'coin' as const },
];

function CountItOutModal({ priceCents, onConfirm, onCancel }: { priceCents: number; onConfirm: () => void; onCancel: () => void }) {
  const [tray, setTray] = useState<number[]>([]);
  const trayTotal = tray.reduce((sum, c) => sum + c, 0);
  const enough = trayTotal >= priceCents;

  return (
    <div className="overlay-backdrop" onClick={onCancel}>
      <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack">
          <div className="row space-between">
            <h2 style={{ margin: 0 }}>💵 Count It Out</h2>
            <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={onCancel}>✕ Close</button>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Tap bills and coins until you have enough to pay <strong>{formatMoney(priceCents)}</strong>.</p>

          <div className="row space-between" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
            <span>In your tray</span>
            <span style={{ color: enough ? 'var(--success)' : undefined }}>{formatMoney(trayTotal)}</span>
          </div>

          <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
            {DENOMINATIONS.map((d) => (
              <button
                key={d.cents}
                className="btn btn-flat"
                style={{ minHeight: 52, minWidth: 52, fontWeight: 800, borderRadius: d.kind === 'coin' ? '50%' : 10, background: d.kind === 'bill' ? '#dff3e6' : '#fff6d9' }}
                onClick={() => setTray((t) => [...t, d.cents])}
              >
                {d.label}
              </button>
            ))}
          </div>

          {tray.length > 0 && (
            <button className="btn btn-sm" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={() => setTray((t) => t.slice(0, -1))}>
              ↩️ Remove last
            </button>
          )}

          <button className="btn btn-primary btn-lg" disabled={!enough} onClick={onConfirm}>
            {enough ? "✅ That's enough, finish buying" : `Keep counting (need ${formatMoney(priceCents - trayTotal)} more)`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Claudia's pets stock-review (L2): every other pet-render site (Pet
// Shelter, Pet Journal, the Home Room care panel) uses the real model
// thumbnail with a paw-icon fallback on a 404 — this was the one spot
// still showing a plain emoji regardless of which pet it was.
function OwnedPetThumb({ def }: { def: PetDef }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span style={{ fontSize: '1.8rem' }}>🐾</span>;
  return <img src={thumbnailFor(def)} alt={def.name} onError={() => setFailed(true)} style={{ width: 40, height: 40, objectFit: 'contain' }} />;
}

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
  // Town Square's inventory button jumps straight to the My Stuff tab
  // (navigate('/student/marketplace', { state: { tab: 'mystuff' } })
  // instead of always opening on the shop.
  const location = useLocation();
  const initialTab = (location.state as { tab?: Tab } | null)?.tab ?? 'characters';
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const transactions = useStore((s) => s.transactions);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const equipEmote = useStore((s) => s.equipEmote);
  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const emotePriceOverrides = useStore((s) => s.emotePriceOverrides);
  const avatarPriceOverrides = useStore((s) => s.avatarPriceOverrides);
  const updateStudent = useStore((s) => s.updateStudent);
  const pets = useStore((s) => s.pets);
  const [tab, setTab] = useState<Tab>(initialTab);
  // Direct teacher request: "marketplace needs to evolve... have a
  // search, etc... needs to be like amazon." A real substring match
  // against name/tags/category, scoped to the tab already open (each tab
  // is its own catalog shape — characters/emotes/pets aren't
  // MarketplaceItems at all — so one search box filtering "everything at
  // once" isn't a single list to begin with).
  const [search, setSearch] = useState('');
  const searchLower = search.trim().toLowerCase();
  const matchesSearch = (name: string, tags?: string[], category?: string) =>
    !searchLower ||
    name.toLowerCase().includes(searchLower) ||
    (category ?? '').toLowerCase().includes(searchLower) ||
    (tags ?? []).some((t) => t.toLowerCase().includes(searchLower));
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptLine[] | null>(null);
  const [showCountItOut, setShowCountItOut] = useState(false);

  // byKind/the three useItemFilter calls below don't depend on `student` at
  // all, so they're computed before the early-return — caught by lint as a
  // real rules-of-hooks violation (pre-existing, not from this session's
  // changes): with the checks below this block, useItemFilter would only
  // run on renders where a student is already found, meaning the number of
  // hooks called could change between renders.
  const byKind = (kind: MarketplaceItemKind) => marketplaceItems.filter((it) => it.kind === kind && isAvailableToday(it));
  const fontItems = byKind('font');
  const allColorItems = byKind('color');
  const voiceItems = byKind('voice');
  const prizeItems = byKind('prize');
  const powerupItems = byKind('powerup');

  const prizeFilter = useItemFilter(prizeItems);
  const fontFilter = useItemFilter(fontItems);
  const voiceFilter = useItemFilter(voiceItems);

  const student = students.find((s) => s.id === currentStudentId);
  if (!student) return null;
  const studentId = student.id;

  const ownedAvatars = AVATAR_CATALOG.filter((a) => student.ownedAvatarIds.includes(a.id));
  const ownedEmotes = EMOTE_CATALOG.filter((e) => student.ownedEmoteIds.includes(e.id));
  const ownedPets = pets.filter((p) => p.studentId === studentId);
  // Sends the student straight to whichever subject's to-do list still has
  // unfinished work, so using a Skip Pass from the inventory doesn't dump
  // them at Home to go hunt for it themselves.
  const goPickActivityToSkip = () => {
    const today = todayISO();
    const mathTasks = rotations[studentId]?.math ?? [];
    const litTasks = rotations[studentId]?.literacy ?? [];
    const mathProg = progress[studentId]?.math;
    const litProg = progress[studentId]?.literacy;
    const mathDone = mathTasks.length === 0 || (mathProg?.date === today && mathProg.subjectComplete);
    const litDone = litTasks.length === 0 || (litProg?.date === today && litProg.subjectComplete);
    if (mathTasks.length > 0 && !mathDone) navigate('/student/math');
    else if (litTasks.length > 0 && !litDone) navigate('/student/literacy');
    else navigate('/student/home');
  };

  const pastReceipts = transactions
    .filter((t) => t.studentId === studentId && t.kind.startsWith('purchase-'))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const textColorItems = allColorItems.filter((it) => (it.colorUse ?? 'text') === 'text');
  const highlightColorItems = allColorItems.filter((it) => it.colorUse === 'highlight');
  const markerColorItems = allColorItems.filter((it) => it.colorUse === 'marker');

  const ownedFieldFor = (kind: MarketplaceItemKind): keyof typeof student | null => {
    if (kind === 'font') return 'ownedFontIds';
    if (kind === 'color') return 'ownedColorIds';
    if (kind === 'voice') return 'ownedVoiceIds';
    if (kind === 'prize') return 'ownedPrizeIds';
    return null;
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.price, 0);
  const inCart = (key: string) => cart.some((c) => c.key === key);
  const addToCart = (entry: CartEntry) => setCart((c) => [...c, entry]);
  const removeFromCart = (key: string) => setCart((c) => c.filter((e) => e.key !== key));
  const setCartNeedsWants = (key: string, value: 'need' | 'want') =>
    setCart((c) => c.map((e) => (e.key === key ? { ...e, needsWants: e.needsWants === value ? undefined : value } : e)));

  // Every purchase — avatar, emote, or any marketplace item — is added to
  // a cart first, just like a real online store, rather than buying the
  // instant a student taps a price. Nothing is actually charged until
  // Confirm Purchase in the cart drawer.
  const checkout = () => {
    const s = useStore.getState();
    const lines: ReceiptLine[] = cart.map((entry) => {
      let ok = false;
      if (entry.source === 'avatar') ok = s.buyAvatar(studentId, entry.id, entry.needsWants);
      else if (entry.source === 'emote') ok = s.buyEmote(studentId, entry.id, entry.needsWants);
      else ok = s.buyMarketplaceItem(studentId, entry.id, entry.needsWants);
      return { ...entry, ok };
    });
    setCart([]);
    setShowCart(false);
    setReceipt(lines);
    if (lines.some((l) => l.ok)) playCashRegister();
  };

  const cartButtonFor = (entry: CartEntry, affordable: boolean) => {
    if (inCart(entry.key)) {
      return (
        <button className="shop-price-chip" style={{ border: '2px solid var(--success)', background: 'var(--success)', color: '#fff', minHeight: 40 }} onClick={() => removeFromCart(entry.key)}>
          ✓ In Cart
        </button>
      );
    }
    return (
      <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
        <button
          className="shop-price-chip"
          style={{ border: '2px solid var(--ink)', minHeight: 40, cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
          disabled={!affordable}
          onClick={() => addToCart(entry)}
        >
          🛒 {formatMoney(entry.price)}
        </button>
        {!affordable && (
          <span style={{ fontSize: '0.62rem', color: 'var(--danger)', fontWeight: 700 }}>
            🔒 Need {formatMoney(entry.price - student.coins)} more
          </span>
        )}
      </div>
    );
  };

  const renderBuyableItem = (item: MarketplaceItem, opts?: { iconSize?: number }) => {
    const ownedField = ownedFieldFor(item.kind);
    const owned = ownedField ? (student[ownedField] as string[]).includes(item.id) : false;
    const affordable = student.coins >= item.price;
    const isImg = item.icon.startsWith('/') || item.icon.startsWith('http');
    const cartKey = `item-${item.id}`;
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
          cartButtonFor({ key: cartKey, source: 'item', id: item.id, name: item.name, icon: item.icon, price: item.price }, affordable)
        )}
      </div>
    );
  };

  return (
    <div className="container stack">
      {showCart && (
        <div className="overlay-backdrop" onClick={() => setShowCart(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <div className="row space-between">
                <h2 style={{ margin: 0 }}>🛒 Your Cart</h2>
                <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setShowCart(false)}>✕ Close</button>
              </div>
              {cart.length === 0 ? (
                <p style={{ opacity: 0.7 }}>Nothing in your cart yet. Tap 🛒 on anything you want!</p>
              ) : (
                <div className="stack" style={{ gap: 6, maxHeight: 320, overflowY: 'auto' }}>
                  {cart.map((entry) => (
                    <div key={entry.key} className="stack" style={{ gap: 4, padding: '6px 8px', border: '2px solid var(--content-border)', borderRadius: 10 }}>
                      <div className="row space-between">
                        <div className="row" style={{ gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f4effe', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {entry.icon.startsWith('/') || entry.icon.startsWith('http') ? <img src={entry.icon} alt="" style={{ width: '90%', height: '90%', objectFit: 'contain' }} /> : <span>{entry.icon}</span>}
                          </div>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{entry.name}</span>
                        </div>
                        <div className="row" style={{ gap: 8 }}>
                          <strong style={{ fontSize: '0.85rem' }}>{formatMoney(entry.price)}</strong>
                          <button className="btn btn-sm btn-danger" style={{ minHeight: 44, minWidth: 44 }} aria-label={`Remove ${entry.name}`} onClick={() => removeFromCart(entry.key)}>✕</button>
                        </div>
                      </div>
                      {/* Optional, non-blocking reflection prompt. Never required, never
                          affects whether Confirm Purchase below is enabled. */}
                      <div className="row-wrap" style={{ gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: '0.68rem', opacity: 0.65 }}>Still want it tomorrow?</span>
                        <button
                          className="btn btn-sm btn-flat"
                          style={{ minHeight: 44, fontSize: '0.68rem', padding: '2px 10px', background: entry.needsWants === 'need' ? 'var(--success)' : undefined, color: entry.needsWants === 'need' ? '#fff' : undefined }}
                          onClick={() => setCartNeedsWants(entry.key, 'need')}
                        >
                          👍 Yep
                        </button>
                        <button
                          className="btn btn-sm btn-flat"
                          style={{ minHeight: 44, fontSize: '0.68rem', padding: '2px 10px', background: entry.needsWants === 'want' ? '#8a6a2f' : undefined, color: entry.needsWants === 'want' ? '#fff' : undefined }}
                          onClick={() => setCartNeedsWants(entry.key, 'want')}
                        >
                          🤔 Not sure
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="row space-between" style={{ fontWeight: 800, fontSize: '1.1rem' }}>
                <span>Total</span>
                <span>{formatMoney(cartTotal)}</span>
              </div>
              <div className="row space-between" style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                <span>Your balance</span>
                <span>{formatMoney(student.coins)}</span>
              </div>
              <button
                className="btn btn-primary btn-lg"
                disabled={cart.length === 0 || cartTotal > student.coins}
                onClick={() => {
                  if (student.countItOutEnabled) {
                    setShowCart(false);
                    setShowCountItOut(true);
                  } else {
                    checkout();
                  }
                }}
              >
                {cartTotal > student.coins ? '🔒 Not enough Class Cash' : student.countItOutEnabled ? '💵 Count It Out' : '✅ Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCountItOut && (
        <CountItOutModal
          priceCents={cartTotal}
          onCancel={() => setShowCountItOut(false)}
          onConfirm={() => { setShowCountItOut(false); checkout(); }}
        />
      )}

      {receipt && (
        <div className="overlay-backdrop" onClick={() => setReceipt(null)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: '2.2rem' }}>🧾</span>
              <h2 style={{ margin: 0 }}>Receipt</h2>
              <div className="stack" style={{ width: '100%', gap: 4 }}>
                {receipt.map((line) => (
                  <div key={line.key} className="row space-between" style={{ fontSize: '0.85rem' }}>
                    <span>{line.ok ? '✅' : '⚠️'} {line.name}</span>
                    <span>{line.ok ? formatMoney(line.price) : 'not bought'}</span>
                  </div>
                ))}
              </div>
              <div
                className="stack"
                style={{
                  alignItems: 'center',
                  gap: 2,
                  background: 'linear-gradient(180deg, var(--purple), var(--purple-dark))',
                  borderRadius: 14,
                  padding: '14px 20px',
                  color: '#fff',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 700 }}>PIGGY BANK BALANCE</span>
                <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{formatMoney(students.find((s) => s.id === studentId)?.coins ?? student.coins)}</span>
              </div>
              <button className="btn btn-primary btn-lg" onClick={() => setReceipt(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Standard "webpage frame" shared by every screen reached from the
          Computer — direct teacher instruction that the frame be applied
          everywhere, replacing the old Town Square/Home button pair. */}
      <WebpageFrame url="marketplace" />

      <div className="shop-panel">
          <div className="shop-header">
            <span className="shop-ribbon">🛍️ MARKETPLACE</span>
            <div className="row" style={{ gap: 8 }}>
              <span className="shop-balance-chip" title="Your Piggy Bank balance. Spend it here!">
                🐷 {formatMoney(student.coins)}
              </span>
              <button className="btn btn-sm" style={{ minHeight: 44, position: 'relative' }} onClick={() => setShowCart(true)} aria-label={`Cart, ${cart.length} items`}>
                🛒 Cart
                {cart.length > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      background: 'var(--danger)',
                      color: '#fff',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      fontSize: '0.65rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                    }}
                  >
                    {cart.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          <FocusBanner subjects={['finance']} />

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
            <button className={`shop-tab-btn ${tab === 'pets' ? 'active' : ''}`} onClick={() => setTab('pets')}>
              🐾 Pets
            </button>
            <button className={`shop-tab-btn ${tab === 'mystuff' ? 'active' : ''}`} onClick={() => setTab('mystuff')}>
              🎒 My Stuff
            </button>
            <button className={`shop-tab-btn ${tab === 'receipts' ? 'active' : ''}`} onClick={() => setTab('receipts')}>
              🧾 Receipts
            </button>
          </div>

          {(tab === 'characters' || tab === 'emotes' || tab === 'powerups') && (
            <input
              className="input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search..."
              style={{ marginTop: 8 }}
              aria-label="Search this tab"
            />
          )}

          <div className="shop-shelf">
            {tab === 'characters' && (
              <div className="shop-item-grid">
                {AVATAR_CATALOG.filter((a) => matchesSearch(a.name)).map((a) => {
                  const owned = student.ownedAvatarIds.includes(a.id);
                  const equipped = student.avatar === a.id;
                  const price = avatarPriceFor(avatarPriceOverrides, a.id);
                  const affordable = student.coins >= price;
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
                        cartButtonFor({ key: `avatar-${a.id}`, source: 'avatar', id: a.id, name: a.name, icon: a.src, price }, affordable)
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'emotes' && (
              <div className="shop-item-grid">
                {EMOTE_CATALOG.filter((e) => matchesSearch(e.name)).map((e) => {
                  const owned = student.ownedEmoteIds.includes(e.id);
                  const equipped = student.equippedEmoteId === e.id;
                  const price = emotePriceFor(emotePriceOverrides, e.id);
                  const affordable = student.coins >= price;
                  return (
                    <div key={e.id} className="shop-item-card" style={{ width: 150 }}>
                      <div className="shop-item-icon-frame shop-item-icon-frame-lg" style={{ outline: equipped ? '3px solid var(--purple)' : 'none' }}>
                        <img src={e.src} alt="" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                      </div>
                      <strong style={{ fontSize: '0.78rem' }}>{e.name}</strong>
                      {equipped ? (
                        <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={() => equipEmote(studentId, null)}>
                          Unequip
                        </button>
                      ) : owned ? (
                        <button className="btn btn-sm btn-primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => equipEmote(studentId, e.id)}>
                          Show
                        </button>
                      ) : (
                        cartButtonFor({ key: `emote-${e.id}`, source: 'emote', id: e.id, name: e.name, icon: e.src, price }, affordable)
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
                    <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No marker colors yet. Ask your teacher to add some!</p>
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
                  💡 Bought a prize? Show this screen to your teacher. They'll help you get it!
                </p>
              </div>
            )}

            {tab === 'powerups' && (
              <div className="shop-item-grid">
                {powerupItems.filter((p) => matchesSearch(p.name, p.tags, p.category)).map((p) => {
                  const affordable = student.coins >= p.price;
                  const owned = false; // power-ups always stay buyable (stacking), never "owned"
                  return (
                    <div key={p.id} className="shop-item-card" style={{ width: 156 }}>
                      <div className="shop-item-icon-frame" style={{ width: 72, height: 72 }}>
                        <span style={{ fontSize: '2rem' }}>{p.icon}</span>
                      </div>
                      <strong style={{ fontSize: '0.8rem' }}>{p.name}</strong>
                      {p.description && <p style={{ fontSize: '0.66rem', opacity: 0.75, margin: 0 }}>{p.description}</p>}
                      {p.id === 'powerup-skip' && <div className="tag-pill" style={{ fontSize: '0.68rem' }}>You have: {student.skipTokens}</div>}
                      {!owned && cartButtonFor({ key: `item-${p.id}`, source: 'item', id: p.id, name: p.name, icon: p.icon, price: p.price }, affordable)}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'pets' && (
              <div className="stack" style={{ gap: 16, alignItems: 'center', textAlign: 'center', maxWidth: 420, margin: '0 auto' }}>
                <span style={{ fontSize: '2.4rem' }}>🐾</span>
                <h3 style={{ margin: 0 }}>Pets moved to the Pet Shelter!</h3>
                {!student.petCouponRedeemed && (
                  <div className="content-well" style={{ background: 'linear-gradient(120deg, var(--yellow), var(--orange))', textAlign: 'center' }}>
                    <strong>🎁 You still have a free pet coupon. Pick any pet at the Shelter to redeem it.</strong>
                  </div>
                )}
                <p style={{ opacity: 0.75, margin: 0 }}>
                  Adopt a pet, meet the animals up for adoption, or try a Mystery Adoption Box, all at the Pet Shelter in Town Square.
                </p>
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/student/pet-shelter')}>
                  🏠 Visit the Shelter →
                </button>
              </div>
            )}

            {tab === 'mystuff' && (
              <div className="stack" style={{ gap: 16 }}>
                {student.skipTokens > 0 && (
                  <div className="content-well row space-between" style={{ alignItems: 'center', background: 'linear-gradient(120deg, var(--yellow), var(--orange))' }}>
                    <div className="row" style={{ gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: '1.8rem' }}>🎫</span>
                      <div className="stack" style={{ gap: 0 }}>
                        <strong>{student.skipTokens} Skip Pass{student.skipTokens === 1 ? '' : 'es'}</strong>
                        <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>Skip one thing on your to-do list</span>
                      </div>
                    </div>
                    <button className="btn btn-primary btn-lg" onClick={goPickActivityToSkip}>
                      Use it →
                    </button>
                  </div>
                )}
                {ownedPets.length > 0 && (
                  <div>
                    <strong style={{ fontSize: '0.85rem' }}>🐾 Your Pets</strong>
                    <div className="shop-item-grid" style={{ marginTop: 8 }}>
                      {ownedPets.map((pet) => {
                        const def = petDefById(pet.petDefId);
                        return (
                          <div key={pet.id} className="shop-item-card">
                            <div className="shop-item-icon-frame" style={{ outline: pet.following ? '3px solid var(--purple)' : 'none' }}>
                              {def ? <OwnedPetThumb def={def} /> : <span style={{ fontSize: '1.8rem' }}>🐾</span>}
                            </div>
                            <strong style={{ fontSize: '0.75rem' }}>{pet.customName || def?.name}</strong>
                            {pet.following && <span className="tag-pill" style={{ fontSize: '0.6rem', background: 'var(--purple)', color: '#fff' }}>Walking with you</span>}
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: '0.72rem', opacity: 0.7, margin: '6px 0 0' }}>
                      🏠 Feed, play, name, and pick your companion pet at Home.
                    </p>
                  </div>
                )}
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
                    {ownedEmotes.length === 0 && <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>No emotes yet. Find some in the 😊 Emotes tab!</p>}
                    {ownedEmotes.map((e) => {
                      const equipped = student.equippedEmoteId === e.id;
                      return (
                        <div key={e.id} className="shop-item-card" style={{ width: 150 }}>
                          <div className="shop-item-icon-frame shop-item-icon-frame-lg" style={{ outline: equipped ? '3px solid var(--purple)' : 'none' }}>
                            <img src={e.src} alt="" style={{ width: '85%', height: '85%', objectFit: 'contain' }} />
                          </div>
                          <strong style={{ fontSize: '0.78rem' }}>{e.name}</strong>
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

            {tab === 'receipts' && (
              <div className="stack" style={{ gap: 10, maxWidth: 480, margin: '0 auto' }}>
                {pastReceipts.length === 0 ? (
                  <p style={{ opacity: 0.7, textAlign: 'center' }}>No purchases yet. Anything you buy shows up here to look back at.</p>
                ) : (
                  pastReceipts.map((t) => (
                    <div key={t.id} className="row space-between chrome-frame" style={{ padding: '10px 14px', opacity: t.voided ? 0.55 : 1 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: '#f4f2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                          {t.icon.startsWith('/') || t.icon.startsWith('http') ? (
                            <img src={t.icon} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                          ) : (
                            <span>{t.icon}</span>
                          )}
                        </div>
                        <div className="stack" style={{ gap: 0 }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, textDecoration: t.voided ? 'line-through' : 'none' }}>{t.description}</span>
                          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                            {new Date(t.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            {t.voided && ' (refunded)'}
                          </span>
                        </div>
                      </div>
                      <strong style={{ color: 'var(--danger)', textDecoration: t.voided ? 'line-through' : 'none' }}>{formatMoney(t.amountCents)}</strong>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
      </div>
    </div>
  );
}
