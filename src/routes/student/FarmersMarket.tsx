import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store/store';
import type { MarketplaceItem, MarketplaceItemKind, FarmerMarketOffer } from '../../types';

// The Farmer's Market — direct teacher request, explicitly framed as a
// way to practice negotiation as a real skill: students trade items with
// each other instead of paying coins. Async/turn-based, not a live
// haggling session (see FarmerMarketOffer in types.ts for why) — a
// student posts an offer, any other student can accept it whenever they
// next look, same shape the Mailbox already uses for async delivery.
// Restricted to fonts/colors/voices, the app's only real "owned item"
// pools besides avatars/prizes, and only same-kind trades (font-for-font
// etc.) as a simple built-in fairness rule — no free-typed haggling, no
// value scoring, no trade ever reads as one student "winning."
const TRADEABLE_KINDS: MarketplaceItemKind[] = ['font', 'color', 'voice'];
const OWNED_FIELD: Record<'font' | 'color' | 'voice', 'ownedFontIds' | 'ownedColorIds' | 'ownedVoiceIds'> = {
  font: 'ownedFontIds',
  color: 'ownedColorIds',
  voice: 'ownedVoiceIds',
};
const KIND_LABEL: Record<MarketplaceItemKind, string> = { font: '🔤 Font', color: '🎨 Color', voice: '🔊 Voice', powerup: '🎫 Power-Up', prize: '🎁 Prize' };

function ItemChip({ item }: { item: MarketplaceItem }) {
  const isImg = item.icon.startsWith('/') || item.icon.startsWith('http');
  return (
    <span className="row" style={{ gap: 6, alignItems: 'center' }}>
      {item.kind === 'color' ? (
        <span style={{ width: 22, height: 22, borderRadius: '50%', background: item.colorHex === 'rainbow' ? 'conic-gradient(red, orange, yellow, green, blue, purple, red)' : item.colorHex, border: '2px solid var(--ink)', display: 'inline-block' }} />
      ) : item.kind === 'font' ? (
        <span style={{ fontFamily: item.cssFontFamily, fontWeight: 800 }}>Aa</span>
      ) : isImg ? (
        <img src={item.icon} alt="" style={{ width: 22, height: 22, objectFit: 'cover', borderRadius: 4 }} />
      ) : (
        <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
      )}
      <strong style={{ fontSize: '0.9rem' }}>{item.name}</strong>
    </span>
  );
}

export default function FarmersMarket() {
  const navigate = useNavigate();
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const marketplaceItems = useStore((s) => s.marketplaceItems);
  const farmerMarketOffers = useStore((s) => s.farmerMarketOffers);
  const postFarmerMarketOffer = useStore((s) => s.postFarmerMarketOffer);
  const withdrawFarmerMarketOffer = useStore((s) => s.withdrawFarmerMarketOffer);
  const acceptFarmerMarketOffer = useStore((s) => s.acceptFarmerMarketOffer);
  const student = students.find((s) => s.id === currentStudentId);

  const [tab, setTab] = useState<'board' | 'mine'>('board');
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!student) return null;

  const itemsById = new Map(marketplaceItems.map((m) => [m.id, m]));
  const studentName = (id: string) => students.find((s) => s.id === id)?.name ?? 'A student';

  const openBoardOffers = farmerMarketOffers.filter((o) => o.status === 'open' && o.studentId !== student.id);
  const myOffers = farmerMarketOffers.filter((o) => o.studentId === student.id || o.acceptedByStudentId === student.id);

  const handleAccept = async (offer: FarmerMarketOffer) => {
    const result = await acceptFarmerMarketOffer(offer.id, student.id);
    setMessage(result.ok ? 'Trade complete! Check My Offers.' : result.reason ?? 'That trade could not be completed.');
  };

  return (
    <div className="container stack">
      <div className="subject-header space-between" style={{ background: 'linear-gradient(120deg, var(--success), var(--yellow))' }}>
        <h2 style={{ margin: 0 }}>🧺 Farmer's Market</h2>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/world/town')} aria-label="Go to Town Square">🌳 Town Square</button>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => navigate('/student/home')}>🏠 Home</button>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontWeight: 700 }}>Trade with other students, no coins needed! ✨</p>

      {message && (
        <div className="chrome-frame" style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>
          {message}{' '}
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setMessage(null)}>OK</button>
        </div>
      )}

      <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
        <button className={`btn btn-sm ${tab === 'board' ? 'btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => setTab('board')}>📋 Trade Board</button>
        <button className={`btn btn-sm ${tab === 'mine' ? 'btn-primary' : ''}`} style={{ minHeight: 44 }} onClick={() => setTab('mine')}>🙋 My Offers</button>
        <button className="btn btn-sm btn-success" style={{ minHeight: 44 }} onClick={() => setPosting(true)}>+ Post a Trade</button>
      </div>

      {posting && (
        <PostTradeModal
          student={student}
          marketplaceItems={marketplaceItems}
          onClose={() => setPosting(false)}
          onPost={(offeredItemId, wantsItemId) => {
            postFarmerMarketOffer(student.id, offeredItemId, wantsItemId);
            setPosting(false);
          }}
        />
      )}

      {tab === 'board' ? (
        openBoardOffers.length === 0 ? (
          <p style={{ textAlign: 'center', opacity: 0.75 }}>No trades posted right now. Be the first!</p>
        ) : (
          <div className="stack" style={{ gap: 10, maxWidth: 560, margin: '0 auto', width: '100%' }}>
            {openBoardOffers.map((o) => {
              const offered = itemsById.get(o.offeredItemId);
              const wants = itemsById.get(o.wantsItemId);
              if (!offered || !wants) return null;
              const canAccept = student[OWNED_FIELD[offered.kind as 'font' | 'color' | 'voice']]?.includes(o.wantsItemId);
              return (
                <div key={o.id} className="chrome-frame" style={{ padding: 14 }}>
                  <div style={{ fontSize: '0.8rem', opacity: 0.75, marginBottom: 6 }}>{studentName(o.studentId)} is offering:</div>
                  <div className="row space-between" style={{ alignItems: 'center' }}>
                    <ItemChip item={offered} />
                    <span style={{ fontWeight: 800 }}>for</span>
                    <ItemChip item={wants} />
                  </div>
                  <div style={{ marginTop: 10 }}>
                    {canAccept ? (
                      <button className="btn btn-sm btn-success" style={{ minHeight: 44 }} onClick={() => handleAccept(o)}>🤝 Accept Trade</button>
                    ) : (
                      <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>You need "{wants.name}" to accept this trade.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : myOffers.length === 0 ? (
        <p style={{ textAlign: 'center', opacity: 0.75 }}>You haven't posted any trades yet.</p>
      ) : (
        <div className="stack" style={{ gap: 10, maxWidth: 560, margin: '0 auto', width: '100%' }}>
          {myOffers.map((o) => {
            const offered = itemsById.get(o.offeredItemId);
            const wants = itemsById.get(o.wantsItemId);
            if (!offered || !wants) return null;
            const isMine = o.studentId === student.id;
            return (
              <div key={o.id} className="chrome-frame" style={{ padding: 14 }}>
                <div className="row space-between" style={{ alignItems: 'center' }}>
                  <ItemChip item={isMine ? offered : wants} />
                  <span style={{ fontWeight: 800 }}>{o.status === 'accepted' ? '↔️ traded for' : 'for'}</span>
                  <ItemChip item={isMine ? wants : offered} />
                </div>
                <div style={{ marginTop: 8, fontSize: '0.78rem', opacity: 0.75 }}>
                  {o.status === 'open' && isMine && 'Waiting for someone to accept…'}
                  {o.status === 'accepted' && `Traded with ${studentName(isMine ? (o.acceptedByStudentId ?? '') : o.studentId)}!`}
                </div>
                {o.status === 'open' && isMine && (
                  <button className="btn btn-sm" style={{ minHeight: 44, marginTop: 8 }} onClick={() => withdrawFarmerMarketOffer(o.id)}>✕ Withdraw</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PostTradeModal({
  student,
  marketplaceItems,
  onClose,
  onPost,
}: {
  student: import('../../types').Student;
  marketplaceItems: MarketplaceItem[];
  onClose: () => void;
  onPost: (offeredItemId: string, wantsItemId: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [offeredItemId, setOfferedItemId] = useState<string | null>(null);

  const offeredItem = marketplaceItems.find((m) => m.id === offeredItemId) ?? null;
  const kind = offeredItem?.kind as 'font' | 'color' | 'voice' | undefined;

  const myTradeableItems = TRADEABLE_KINDS.flatMap((k) =>
    marketplaceItems.filter((m) => m.kind === k && student[OWNED_FIELD[k as 'font' | 'color' | 'voice']].includes(m.id)),
  );
  const wantOptions = kind
    ? marketplaceItems.filter((m) => m.kind === kind && m.id !== offeredItemId && !student[OWNED_FIELD[kind]].includes(m.id))
    : [];

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame stack" style={{ padding: 20, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="space-between" style={{ marginBottom: 4 }}>
          <strong>{step === 1 ? 'Step 1: Pick what to give' : 'Step 2: Pick what you want'}</strong>
          <button className="btn btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        {step === 1 ? (
          myTradeableItems.length === 0 ? (
            <p style={{ opacity: 0.75 }}>You don't have any fonts, colors, or voices to trade yet. Visit the Marketplace or spin the Daily Wheel to earn some!</p>
          ) : (
            <div className="stack" style={{ gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {myTradeableItems.map((m) => (
                <button
                  key={m.id}
                  className="btn"
                  style={{ justifyContent: 'space-between', minHeight: 44 }}
                  onClick={() => { setOfferedItemId(m.id); setStep(2); }}
                >
                  <ItemChip item={m} />
                  <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{KIND_LABEL[m.kind]}</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <div className="stack" style={{ gap: 10 }}>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem' }}>Giving:</span>
              {offeredItem && <ItemChip item={offeredItem} />}
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setStep(1)}>Change</button>
            </div>
            {wantOptions.length === 0 ? (
              <p style={{ opacity: 0.75 }}>There's nothing left of this same type to ask for, try a different item.</p>
            ) : (
              <div className="stack" style={{ gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                {wantOptions.map((m) => (
                  <button
                    key={m.id}
                    className="btn btn-primary"
                    style={{ justifyContent: 'flex-start', minHeight: 44 }}
                    onClick={() => offeredItemId && onPost(offeredItemId, m.id)}
                  >
                    <ItemChip item={m} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
