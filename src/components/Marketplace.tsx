import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { AVATAR_CATALOG } from '../store/badges';
import { AvatarGlyph } from './AvatarGlyph';
import { EMOTE_CATALOG } from '../lib/emoteCatalog';
import { FONT_CATALOG } from '../lib/fontCatalog';
import { COLOR_CATALOG } from '../lib/colorCatalog';
import { VOICE_CATALOG } from '../lib/voiceCatalog';
import { formatMoney } from '../lib/money';

type Tab = 'characters' | 'emotes' | 'writing' | 'voices' | 'prizes' | 'powerups' | 'mystuff';

const SKIP_TOKEN_PRICE_CENTS = 1500;

export default function Marketplace() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const buyAvatar = useStore((s) => s.buyAvatar);
  const buyEmote = useStore((s) => s.buyEmote);
  const equipEmote = useStore((s) => s.equipEmote);
  const buyFont = useStore((s) => s.buyFont);
  const buyColor = useStore((s) => s.buyColor);
  const buyVoice = useStore((s) => s.buyVoice);
  const buyCustomPrize = useStore((s) => s.buyCustomPrize);
  const customPrizes = useStore((s) => s.customPrizes);
  const buySkipToken = useStore((s) => s.buySkipToken);
  const updateStudent = useStore((s) => s.updateStudent);
  const [tab, setTab] = useState<Tab>('characters');

  const student = students.find((s) => s.id === currentStudentId);
  if (!student) return null;
  const studentId = student.id;

  const ownedAvatars = AVATAR_CATALOG.filter((a) => student.ownedAvatarIds.includes(a.id));
  const ownedEmotes = EMOTE_CATALOG.filter((e) => student.ownedEmoteIds.includes(e.id));

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
            <button className={`shop-tab-btn ${tab === 'voices' ? 'active' : ''}`} onClick={() => setTab('voices')}>
              🔊 Voices
            </button>
            {customPrizes.length > 0 && (
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

            {tab === 'writing' && (
              <div className="stack" style={{ gap: 16 }}>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>🔤 Fonts for your Notes</strong>
                  <div className="shop-item-grid" style={{ marginTop: 8 }}>
                    {FONT_CATALOG.map((f) => {
                      const owned = student.ownedFontIds.includes(f.id);
                      const affordable = student.coins >= f.price;
                      return (
                        <div key={f.id} className="shop-item-card" style={{ width: 140 }}>
                          <div className="shop-item-icon-frame" style={{ width: '100%', fontFamily: f.cssFontFamily, fontSize: '1.6rem' }}>Aa</div>
                          <strong style={{ fontSize: '0.72rem' }}>{f.name}</strong>
                          {owned ? (
                            <span className="tag-pill" style={{ fontSize: '0.65rem', background: 'var(--success)', color: '#fff' }}>✓ Unlocked</span>
                          ) : (
                            <button
                              className="shop-price-chip"
                              style={{ border: '2px solid var(--ink)', cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
                              disabled={!affordable}
                              onClick={() => buyFont(studentId, f.id)}
                            >
                              🪙 {formatMoney(f.price)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <strong style={{ fontSize: '0.85rem' }}>🎨 Text Colors</strong>
                  <div className="shop-item-grid" style={{ marginTop: 8 }}>
                    {COLOR_CATALOG.map((c) => {
                      const owned = student.ownedColorIds.includes(c.id);
                      const affordable = student.coins >= c.price;
                      return (
                        <div key={c.id} className="shop-item-card" style={{ width: 110 }}>
                          <div
                            className="shop-item-icon-frame"
                            style={{ width: 44, height: 44, borderRadius: '50%', background: c.hex === 'rainbow' ? 'conic-gradient(red, orange, yellow, green, blue, purple, red)' : c.hex }}
                          />
                          <strong style={{ fontSize: '0.7rem' }}>{c.name}</strong>
                          {owned ? (
                            <span className="tag-pill" style={{ fontSize: '0.62rem', background: 'var(--success)', color: '#fff' }}>✓ Unlocked</span>
                          ) : (
                            <button
                              className="shop-price-chip"
                              style={{ border: '2px solid var(--ink)', cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
                              disabled={!affordable}
                              onClick={() => buyColor(studentId, c.id)}
                            >
                              🪙 {formatMoney(c.price)}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {tab === 'voices' && (
              <div className="shop-item-grid">
                {VOICE_CATALOG.map((v) => {
                  const owned = student.ownedVoiceIds.includes(v.id);
                  const affordable = student.coins >= v.price;
                  return (
                    <div key={v.id} className="shop-item-card" style={{ width: 130 }}>
                      <div className="shop-item-icon-frame" style={{ fontSize: '1.8rem' }}>{v.name.split(' ')[0]}</div>
                      <strong style={{ fontSize: '0.75rem' }}>{v.name.replace(/^\S+\s/, '')}</strong>
                      {owned ? (
                        <span className="tag-pill" style={{ fontSize: '0.65rem', background: 'var(--success)', color: '#fff' }}>✓ Unlocked</span>
                      ) : (
                        <button
                          className="shop-price-chip"
                          style={{ border: '2px solid var(--ink)', cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
                          disabled={!affordable}
                          onClick={() => buyVoice(studentId, v.id)}
                        >
                          🪙 {formatMoney(v.price)}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'prizes' && (
              <div className="shop-item-grid">
                {[...new Set(customPrizes.map((p) => p.category))].map((category) => (
                  <div key={category} style={{ width: '100%' }}>
                    <strong style={{ fontSize: '0.8rem' }}>{category}</strong>
                    <div className="shop-item-grid" style={{ marginTop: 6, marginBottom: 10 }}>
                      {customPrizes.filter((p) => p.category === category).map((p) => {
                        const owned = student.ownedPrizeIds.includes(p.id);
                        const affordable = student.coins >= p.price;
                        return (
                          <div key={p.id} className="shop-item-card" style={{ width: 140 }}>
                            <div className="shop-item-icon-frame">
                              {p.icon.startsWith('/') || p.icon.startsWith('http') ? <img src={p.icon} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '1.8rem' }}>{p.icon}</span>}
                            </div>
                            <strong style={{ fontSize: '0.72rem' }}>{p.name}</strong>
                            {p.description && <p style={{ fontSize: '0.6rem', opacity: 0.7, margin: 0 }}>{p.description}</p>}
                            {owned && <span className="tag-pill" style={{ fontSize: '0.62rem', background: 'var(--success)', color: '#fff' }}>✓ Redeemed</span>}
                            <button
                              className="shop-price-chip"
                              style={{ border: '2px solid var(--ink)', cursor: affordable ? 'pointer' : 'not-allowed', opacity: affordable ? 1 : 0.5 }}
                              disabled={!affordable}
                              onClick={() => buyCustomPrize(studentId, p.id)}
                            >
                              🪙 {formatMoney(p.price)}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
                  💡 Bought a prize? Show this screen to your teacher — they'll help you get it!
                </p>
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
  );
}
