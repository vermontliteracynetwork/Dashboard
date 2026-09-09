import { useState } from 'react';
import { useStore } from '../store/store';
import { AVATAR_CATALOG } from '../store/badges';
import { AvatarGlyph } from './AvatarGlyph';
import { EMOTE_CATALOG } from '../lib/emoteCatalog';
import { formatMoney } from '../lib/money';

interface Props {
  studentId: string;
  onClose: () => void;
}

type Tab = 'characters' | 'emotes' | 'powerups' | 'mystuff';

const SKIP_TOKEN_PRICE_CENTS = 1500;

export default function Marketplace({ studentId, onClose }: Props) {
  const students = useStore((s) => s.students);
  const buyAvatar = useStore((s) => s.buyAvatar);
  const buyEmote = useStore((s) => s.buyEmote);
  const equipEmote = useStore((s) => s.equipEmote);
  const buySkipToken = useStore((s) => s.buySkipToken);
  const updateStudent = useStore((s) => s.updateStudent);
  const [tab, setTab] = useState<Tab>('characters');

  const student = students.find((s) => s.id === studentId);
  if (!student) return null;

  const ownedAvatars = AVATAR_CATALOG.filter((a) => student.ownedAvatarIds.includes(a.id));
  const ownedEmotes = EMOTE_CATALOG.filter((e) => student.ownedEmoteIds.includes(e.id));

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel" style={{ maxWidth: 680, padding: 0, background: 'transparent', boxShadow: 'none', border: 'none' }} onClick={(e) => e.stopPropagation()}>
        <div className="shop-panel">
          <div className="shop-header">
            <span className="shop-ribbon">🛍️ SHOP</span>
            <div className="row" style={{ gap: 8 }}>
              <span className="shop-balance-chip" title="Your Piggy Bank balance — spend it here!">
                🐷 {formatMoney(student.coins)}
              </span>
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={onClose}>✕ Close</button>
            </div>
          </div>

          <div className="shop-tabs">
            <button className={`shop-tab-btn ${tab === 'characters' ? 'active' : ''}`} onClick={() => setTab('characters')}>
              🧑 Characters
            </button>
            <button className={`shop-tab-btn ${tab === 'emotes' ? 'active' : ''}`} onClick={() => setTab('emotes')}>
              😊 Emotes
            </button>
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
                        <button className="btn btn-sm btn-primary" style={{ minHeight: 40, minWidth: 40 }} onClick={() => updateStudent(studentId, { avatar: a.id })}>
                          Wear
                        </button>
                      ) : (
                        <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
                          <button
                            className="shop-price-chip"
                            style={{ border: '2px solid var(--ink)', cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
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
                        <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40 }} onClick={() => equipEmote(studentId, null)}>
                          Unequip
                        </button>
                      ) : owned ? (
                        <button className="btn btn-sm btn-primary" style={{ minHeight: 40, minWidth: 40 }} onClick={() => equipEmote(studentId, e.id)}>
                          Show
                        </button>
                      ) : (
                        <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
                          <button
                            className="shop-price-chip"
                            style={{ border: '2px solid var(--ink)', cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
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

            {tab === 'powerups' && (
              <div className="shop-item-grid">
                <div className="shop-item-card" style={{ width: 156 }}>
                  <div className="shop-item-icon-frame" style={{ width: 72, height: 72 }}>
                    <span style={{ fontSize: '2rem' }}>🎫</span>
                  </div>
                  <strong style={{ fontSize: '0.8rem' }}>Skip Pass</strong>
                  <p style={{ fontSize: '0.66rem', opacity: 0.75, margin: 0 }}>
                    Cross off one to-do item without doing it. Your teacher can still see it was skipped.
                  </p>
                  <div className="tag-pill" style={{ fontSize: '0.68rem' }}>You have: {student.skipTokens}</div>
                  <button
                    className="shop-price-chip"
                    style={{ border: '2px solid var(--ink)', cursor: student.coins >= SKIP_TOKEN_PRICE_CENTS ? 'pointer' : 'not-allowed', opacity: student.coins >= SKIP_TOKEN_PRICE_CENTS ? 1 : 0.5 }}
                    disabled={student.coins < SKIP_TOKEN_PRICE_CENTS}
                    onClick={() => buySkipToken(studentId)}
                  >
                    🪙 {formatMoney(SKIP_TOKEN_PRICE_CENTS)}
                  </button>
                  {student.coins < SKIP_TOKEN_PRICE_CENTS && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--danger)', fontWeight: 700 }}>
                      🔒 Need {formatMoney(SKIP_TOKEN_PRICE_CENTS - student.coins)} more
                    </span>
                  )}
                </div>
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
                            <button className="btn btn-sm btn-primary" style={{ minHeight: 40, minWidth: 40 }} onClick={() => updateStudent(studentId, { avatar: a.id })}>
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
                            <button className="btn btn-sm" style={{ minHeight: 40, minWidth: 40 }} onClick={() => equipEmote(studentId, null)}>
                              Unequip
                            </button>
                          ) : (
                            <button className="btn btn-sm btn-primary" style={{ minHeight: 40, minWidth: 40 }} onClick={() => equipEmote(studentId, e.id)}>
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
    </div>
  );
}
