import { useState } from 'react';
import { useStore } from '../store/store';
import { AVATAR_CATALOG } from '../store/badges';
import { AvatarGlyph } from './AvatarGlyph';
import { EMOTE_CATALOG } from '../lib/emoteCatalog';
import { formatMoney } from '../lib/money';

interface Props {
  studentId: string;
  onClose: () => void;
  onOpenBank?: () => void;
}

type Tab = 'characters' | 'emotes' | 'powerups';

const SKIP_TOKEN_PRICE_CENTS = 1500;

export default function Marketplace({ studentId, onClose, onOpenBank }: Props) {
  const students = useStore((s) => s.students);
  const buyAvatar = useStore((s) => s.buyAvatar);
  const buyEmote = useStore((s) => s.buyEmote);
  const equipEmote = useStore((s) => s.equipEmote);
  const buySkipToken = useStore((s) => s.buySkipToken);
  const updateStudent = useStore((s) => s.updateStudent);
  const [tab, setTab] = useState<Tab>('characters');

  const student = students.find((s) => s.id === studentId);
  if (!student) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack">
          <div className="space-between">
            <h2 style={{ margin: 0 }}>🛍️ Marketplace</h2>
            {onOpenBank ? (
              <button
                className="tag-pill"
                style={{ background: 'var(--yellow)', fontSize: '1rem', border: 'none', cursor: 'pointer', minHeight: 44 }}
                onClick={onOpenBank}
              >
                🐷 {formatMoney(student.coins)}
              </button>
            ) : (
              <div className="tag-pill" style={{ background: 'var(--yellow)', fontSize: '1rem' }}>
                🐷 {formatMoney(student.coins)}
              </div>
            )}
          </div>
          <p style={{ opacity: 0.75, marginTop: -8 }}>Earn Class Cash by finishing your tasks. Spend it here!</p>

          <div className="lp-tabs">
            <button className={`lp-tab-btn ${tab === 'characters' ? 'active' : ''}`} style={{ minHeight: 44 }} onClick={() => setTab('characters')}>
              🧑 Characters
            </button>
            <button className={`lp-tab-btn ${tab === 'emotes' ? 'active' : ''}`} style={{ minHeight: 44 }} onClick={() => setTab('emotes')}>
              😊 Emotes
            </button>
            <button className={`lp-tab-btn ${tab === 'powerups' ? 'active' : ''}`} style={{ minHeight: 44 }} onClick={() => setTab('powerups')}>
              🎫 Power-Ups
            </button>
          </div>

          {tab === 'characters' && (
            <div className="item-grid-wrap">
              <div className="row-wrap">
                {AVATAR_CATALOG.map((a) => {
                  const owned = student.ownedAvatarIds.includes(a.id);
                  const equipped = student.avatar === a.id;
                  const affordable = student.coins >= a.price;
                  return (
                    <div key={a.id} className="content-well stack" style={{ width: 108, alignItems: 'center', textAlign: 'center', gap: 6 }}>
                      <div className="avatar-sm" style={{ width: 56, height: 56, outline: equipped ? '3px solid var(--purple)' : 'none' }}>
                        <AvatarGlyph value={a.id} />
                      </div>
                      <strong style={{ fontSize: '0.75rem' }}>{a.name}</strong>
                      {equipped ? (
                        <span className="tag-pill" style={{ fontSize: '0.7rem', background: 'var(--success)', color: '#fff' }}>
                          ✓ Wearing
                        </span>
                      ) : owned ? (
                        <button className="btn btn-sm btn-primary" style={{ minHeight: 44, minWidth: 44 }} onClick={() => updateStudent(studentId, { avatar: a.id })}>
                          Wear
                        </button>
                      ) : (
                        <div className="stack" style={{ alignItems: 'center', gap: 2 }}>
                          <button
                            className="btn btn-sm"
                            style={{ minHeight: 44, minWidth: 44 }}
                            disabled={!affordable}
                            onClick={() => buyAvatar(studentId, a.id)}
                          >
                            {formatMoney(a.price)}
                          </button>
                          {!affordable && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 700 }}>
                              🔒 Need {formatMoney(a.price - student.coins)} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'emotes' && (
            <div className="item-grid-wrap">
              <div className="row-wrap">
                {EMOTE_CATALOG.map((e) => {
                  const owned = student.ownedEmoteIds.includes(e.id);
                  const equipped = student.equippedEmoteId === e.id;
                  const affordable = student.coins >= e.price;
                  return (
                    <div key={e.id} className="content-well stack" style={{ width: 96, alignItems: 'center', textAlign: 'center', gap: 6 }}>
                      <div className="avatar-sm" style={{ width: 48, height: 48, outline: equipped ? '3px solid var(--purple)' : 'none' }}>
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
                            className="btn btn-sm"
                            style={{ minHeight: 44, minWidth: 44 }}
                            disabled={!affordable}
                            onClick={() => buyEmote(studentId, e.id)}
                          >
                            {formatMoney(e.price)}
                          </button>
                          {!affordable && (
                            <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 700 }}>
                              🔒 Need {formatMoney(e.price - student.coins)} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'powerups' && (
            <div className="item-grid-wrap">
              <div className="row-wrap">
                <div className="content-well stack" style={{ width: 128, alignItems: 'center', textAlign: 'center', gap: 6 }}>
                  <span style={{ fontSize: '2.2rem' }}>🎫</span>
                  <strong style={{ fontSize: '0.8rem' }}>Skip Pass</strong>
                  <p style={{ fontSize: '0.68rem', opacity: 0.75, margin: 0 }}>
                    Cross off one to-do item without doing it. Your teacher can still see it was skipped.
                  </p>
                  <div className="tag-pill" style={{ fontSize: '0.7rem' }}>You have: {student.skipTokens}</div>
                  <button
                    className="btn btn-sm"
                    style={{ minHeight: 44, minWidth: 44 }}
                    disabled={student.coins < SKIP_TOKEN_PRICE_CENTS}
                    onClick={() => buySkipToken(studentId)}
                  >
                    {formatMoney(SKIP_TOKEN_PRICE_CENTS)}
                  </button>
                  {student.coins < SKIP_TOKEN_PRICE_CENTS && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--danger)', fontWeight: 700 }}>
                      🔒 Need {formatMoney(SKIP_TOKEN_PRICE_CENTS - student.coins)} more
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
