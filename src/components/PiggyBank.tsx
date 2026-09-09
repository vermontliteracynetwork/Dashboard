import { useStore } from '../store/store';
import { formatMoney } from '../lib/money';

interface Props {
  studentId: string;
  onClose: () => void;
}

// A small "is this an emoji or an image path" check — every icon this app
// hands to a register row is either a plain emoji character or one of our
// own /avatars, /emotes asset paths, never an arbitrary external URL.
function isImagePath(icon: string): boolean {
  return icon.startsWith('/');
}

export default function PiggyBank({ studentId, onClose }: Props) {
  const students = useStore((s) => s.students);
  const transactions = useStore((s) => s.transactions);

  const student = students.find((s) => s.id === studentId);
  if (!student) return null;

  const register = transactions.filter((t) => t.studentId === studentId);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack">
          <div className="space-between">
            <h2 style={{ margin: 0 }}>🐷 Piggy Bank</h2>
            <button className="btn btn-sm" style={{ minHeight: 44, minWidth: 44 }} onClick={onClose}>
              Close
            </button>
          </div>

          <div
            className="stack"
            style={{
              alignItems: 'center',
              gap: 4,
              background: 'linear-gradient(180deg, var(--purple), var(--purple-dark))',
              borderRadius: 18,
              padding: '20px 16px',
              color: '#fff',
            }}
          >
            <span style={{ fontSize: '2.6rem', lineHeight: 1 }}>🐷</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 700, letterSpacing: 0.5 }}>CLASS CASH BALANCE</span>
            <span style={{ fontSize: '2.2rem', fontWeight: 800 }}>{formatMoney(student.coins)}</span>
          </div>

          <p style={{ fontSize: '0.78rem', opacity: 0.7, margin: 0 }}>
            💡 You earn money for finishing activities, and a bonus for keeping your streak going. Spend it in the 🛍️ Marketplace!
          </p>

          <strong style={{ fontSize: '0.9rem' }}>📒 Register</strong>
          {register.length === 0 ? (
            <p style={{ opacity: 0.7, fontSize: '0.85rem' }}>Nothing here yet — finish an activity to make your first deposit!</p>
          ) : (
            <div className="stack" style={{ gap: 6, maxHeight: 360, overflowY: 'auto' }}>
              {register.map((t) => {
                const income = t.amountCents >= 0;
                return (
                  <div
                    key={t.id}
                    className="row space-between"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '2px solid var(--content-border)',
                      background: '#fff',
                    }}
                  >
                    <div className="row" style={{ gap: 8, minWidth: 0 }}>
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          flexShrink: 0,
                          borderRadius: 8,
                          background: '#f4f2ff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                        }}
                      >
                        {isImagePath(t.icon) ? (
                          <img src={t.icon} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
                        ) : (
                          <span style={{ fontSize: '1.1rem' }}>{t.icon}</span>
                        )}
                      </div>
                      <div className="stack" style={{ gap: 0, minWidth: 0 }}>
                        <span style={{ fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {t.description}
                        </span>
                        <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>
                          {new Date(t.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                    <strong style={{ fontSize: '0.9rem', color: income ? 'var(--success)' : 'var(--danger)', flexShrink: 0 }}>
                      {income ? '+' : ''}
                      {formatMoney(t.amountCents)}
                    </strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
