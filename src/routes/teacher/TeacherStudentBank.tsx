import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../../store/store';
import TeacherNav from '../../components/TeacherNav';
import AvatarWithEmote from '../../components/AvatarWithEmote';
import PiggyBankCharts from '../../components/PiggyBankCharts';
import { formatMoney, dollarsToCents } from '../../lib/money';
import { todayISO } from '../../lib/dates';

function isImagePath(icon: string): boolean {
  return icon.startsWith('/');
}

export default function TeacherStudentBank() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const students = useStore((s) => s.students);
  const transactions = useStore((s) => s.transactions);
  const adjustStudentBalance = useStore((s) => s.adjustStudentBalance);
  const setStudentBalance = useStore((s) => s.setStudentBalance);
  const deleteTransaction = useStore((s) => s.deleteTransaction);
  const updateStudent = useStore((s) => s.updateStudent);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const setStreak = useStore((s) => s.setStreak);
  const resetDailySpin = useStore((s) => s.resetDailySpin);

  const [view, setView] = useState<'register' | 'charts'>('register');
  const [addAmount, setAddAmount] = useState('5.00');
  const [addReason, setAddReason] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subReason, setSubReason] = useState('');
  const [confirmSub, setConfirmSub] = useState(false);
  const [exactAmount, setExactAmount] = useState('');
  const [exactReason, setExactReason] = useState('');
  const [confirmSet, setConfirmSet] = useState(false);
  const [streakInput, setStreakInput] = useState('');
  const [confirmStreakSet, setConfirmStreakSet] = useState(false);
  const [confirmDeleteTxId, setConfirmDeleteTxId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const student = students.find((s) => s.id === studentId);

  if (!student) {
    return (
      <div className="app-shell">
        <TeacherNav />
        <div className="container">
          <p>Student not found.</p>
          <button className="btn" onClick={() => navigate('/teacher')}>← Back to Overview</button>
        </div>
      </div>
    );
  }

  const register = transactions.filter((t) => t.studentId === student.id).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const chartRegister = register.filter((t) => !t.voided);
  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 2000);
  };

  return (
    <div className="app-shell">
      <TeacherNav />
      <div className="container stack">
        <div className="space-between">
          <div className="row">
            <AvatarWithEmote student={student} size={48} readOnly />
            <h1 style={{ margin: 0 }}>{student.name}'s Piggy Bank</h1>
          </div>
          <button className="btn btn-sm" onClick={() => navigate('/teacher')}>← Overview</button>
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
          <span style={{ fontSize: '0.8rem', opacity: 0.85, fontWeight: 700, letterSpacing: 0.5 }}>CURRENT BALANCE</span>
          <span style={{ fontSize: '2.4rem', fontWeight: 800 }}>{formatMoney(student.coins)}</span>
        </div>

        {flash && (
          <div className="content-well" style={{ background: '#e8fff0', textAlign: 'center', fontWeight: 700, color: 'var(--success)' }}>
            ✅ {flash}
          </div>
        )}

        <div className="row-wrap" style={{ alignItems: 'flex-start' }}>
          <div className="chrome-frame stack" style={{ padding: 16, flex: 1, minWidth: 240 }}>
            <h3 style={{ marginTop: 0 }}>💰 Give a bonus</h3>
            <div className="row" style={{ gap: 4 }}>
              <span>$</span>
              <input type="number" min={0} step={0.25} value={addAmount} onChange={(e) => setAddAmount(e.target.value)} style={{ width: 90 }} />
            </div>
            <input value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder="Reason (optional)" />
            <button
              className="btn btn-success"
              onClick={() => {
                const cents = dollarsToCents(parseFloat(addAmount) || 0);
                if (cents <= 0) return;
                adjustStudentBalance(student.id, cents, addReason.trim() || 'Bonus from your teacher');
                setAddReason('');
                showFlash(`Added ${formatMoney(cents)}`);
              }}
            >
              ➕ Add to balance
            </button>
          </div>

          <div className="chrome-frame stack" style={{ padding: 16, flex: 1, minWidth: 240 }}>
            <h3 style={{ marginTop: 0 }}>➖ Subtract</h3>
            <div className="row" style={{ gap: 4 }}>
              <span>$</span>
              <input type="number" min={0} step={0.25} value={subAmount} onChange={(e) => { setSubAmount(e.target.value); setConfirmSub(false); }} placeholder="0.00" style={{ width: 90 }} />
            </div>
            <input value={subReason} onChange={(e) => setSubReason(e.target.value)} placeholder="Reason (optional)" />
            {confirmSub ? (
              <div className="row-wrap">
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    const cents = dollarsToCents(parseFloat(subAmount) || 0);
                    if (cents <= 0) return;
                    adjustStudentBalance(student.id, -cents, subReason.trim() || 'Balance adjusted by your teacher');
                    setSubAmount('');
                    setSubReason('');
                    setConfirmSub(false);
                    showFlash(`Subtracted ${formatMoney(cents)}`);
                  }}
                >
                  Confirm: subtract ${subAmount || '0.00'}
                </button>
                <button className="btn btn-sm" onClick={() => setConfirmSub(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn-danger" disabled={!subAmount || (parseFloat(subAmount) || 0) <= 0} onClick={() => setConfirmSub(true)}>
                ➖ Subtract from balance
              </button>
            )}
          </div>

          <div className="chrome-frame stack" style={{ padding: 16, flex: 1, minWidth: 240 }}>
            <h3 style={{ marginTop: 0 }}>✏️ Set exact balance</h3>
            <div className="row" style={{ gap: 4 }}>
              <span>$</span>
              <input type="number" min={0} step={0.25} value={exactAmount} onChange={(e) => setExactAmount(e.target.value)} placeholder={(student.coins / 100).toFixed(2)} style={{ width: 90 }} />
            </div>
            <input value={exactReason} onChange={(e) => setExactReason(e.target.value)} placeholder="Reason (optional)" />
            {confirmSet ? (
              <div className="row-wrap">
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    const cents = dollarsToCents(parseFloat(exactAmount) || 0);
                    setStudentBalance(student.id, cents, exactReason.trim() || 'Balance set by your teacher');
                    setExactAmount('');
                    setExactReason('');
                    setConfirmSet(false);
                    showFlash(`Balance set to ${formatMoney(cents)}`);
                  }}
                >
                  Confirm: set to ${exactAmount || '0.00'}
                </button>
                <button className="btn btn-sm" onClick={() => setConfirmSet(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn" disabled={!exactAmount} onClick={() => setConfirmSet(true)}>
                Set balance
              </button>
            )}
          </div>
        </div>

        <div className="row-wrap" style={{ alignItems: 'flex-start' }}>
          <div className="chrome-frame stack" style={{ padding: 16, flex: 1, minWidth: 240 }}>
            <h3 style={{ marginTop: 0 }}>🔥 Streak</h3>
            <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
              Drives the daily streak-interest bonus and the growth line on this student's Charts tab.
            </p>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <button className="btn btn-sm" onClick={() => setStreak(student.id, Math.max(0, student.streak - 1))}>−</button>
              <strong style={{ fontSize: '1.3rem', minWidth: 50, textAlign: 'center' }}>{student.streak}-day</strong>
              <button className="btn btn-sm" onClick={() => setStreak(student.id, student.streak + 1)}>+</button>
            </div>
            <div className="row" style={{ gap: 4 }}>
              <input
                type="number"
                min={0}
                placeholder="Set exact #"
                value={streakInput}
                onChange={(e) => { setStreakInput(e.target.value); setConfirmStreakSet(false); }}
                style={{ width: 90 }}
              />
              {confirmStreakSet ? (
                <>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => {
                      const n = Math.max(0, Math.round(parseFloat(streakInput) || 0));
                      setStreak(student.id, n);
                      setStreakInput('');
                      setConfirmStreakSet(false);
                      showFlash(`Streak set to ${n} days`);
                    }}
                  >
                    Confirm
                  </button>
                  <button className="btn btn-sm" onClick={() => setConfirmStreakSet(false)}>Cancel</button>
                </>
              ) : (
                <button className="btn btn-sm" disabled={!streakInput} onClick={() => setConfirmStreakSet(true)}>
                  Set
                </button>
              )}
            </div>
            <label className="row" style={{ gap: 6, fontSize: '0.8rem' }}>
              <input type="checkbox" checked={!!student.streakHidden} onChange={(e) => updateStudent(student.id, { streakHidden: e.target.checked })} />
              Hide streak from this student
            </label>
          </div>

          <div className="chrome-frame stack" style={{ padding: 16, flex: 1, minWidth: 240 }}>
            <h3 style={{ marginTop: 0 }}>🎫 Skip Passes</h3>
            <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
              Lets this student skip one non-required to-do item. Earned from the daily wheel or bought in the Marketplace.
            </p>
            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
              <button
                className="btn btn-sm"
                disabled={student.skipTokens <= 0}
                onClick={() => {
                  updateStudent(student.id, { skipTokens: Math.max(0, student.skipTokens - 1) });
                  recordTransaction(student.id, 0, '🎫 Skip Pass removed by teacher', '🎫', 'teacher-adjustment');
                }}
              >
                −
              </button>
              <strong style={{ fontSize: '1.3rem', minWidth: 40, textAlign: 'center' }}>{student.skipTokens}</strong>
              <button
                className="btn btn-sm"
                onClick={() => {
                  updateStudent(student.id, { skipTokens: student.skipTokens + 1 });
                  recordTransaction(student.id, 0, '🎫 Skip Pass given by teacher', '🎫', 'teacher-adjustment');
                }}
              >
                +
              </button>
            </div>
          </div>

          <div className="chrome-frame stack" style={{ padding: 16, flex: 1, minWidth: 240 }}>
            <h3 style={{ marginTop: 0 }}>🎡 Daily Spin</h3>
            <p style={{ fontSize: '0.75rem', opacity: 0.7, margin: 0 }}>
              {student.lastSpinDate === todayISO()
                ? 'Already spun today.'
                : "Hasn't spun today yet."}
            </p>
            <button
              className="btn btn-sm"
              disabled={student.lastSpinDate !== todayISO()}
              onClick={() => {
                resetDailySpin(student.id);
                showFlash(`${student.name} can spin the wheel again today.`);
              }}
            >
              Reset today's spin
            </button>
          </div>
        </div>

        <div className="row-wrap" style={{ alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>📒 Full Register</h3>
          <div className="row-wrap" style={{ marginLeft: 'auto' }}>
            <button className={`btn btn-sm ${view === 'register' ? 'btn-primary' : ''}`} onClick={() => setView('register')}>📒 Register</button>
            <button className={`btn btn-sm ${view === 'charts' ? 'btn-primary' : ''}`} onClick={() => setView('charts')}>📊 Charts</button>
          </div>
        </div>

        {view === 'charts' ? (
          <PiggyBankCharts transactions={chartRegister} currentBalanceCents={student.coins} streak={student.streak} />
        ) : register.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No transactions yet.</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            {register.map((t) => {
              const income = t.amountCents >= 0;
              return (
                <div key={t.id} className="row space-between chrome-frame" style={{ padding: '8px 12px', opacity: t.voided ? 0.55 : 1 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f4f2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {isImagePath(t.icon) ? <img src={t.icon} alt="" style={{ width: '80%', height: '80%', objectFit: 'contain' }} /> : <span>{t.icon}</span>}
                    </div>
                    <div className="stack" style={{ gap: 0 }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, textDecoration: t.voided ? 'line-through' : 'none' }}>{t.description}</span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>
                        {new Date(t.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        {t.voided && ' (removed by teacher)'}
                      </span>
                    </div>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <strong style={{ color: income ? 'var(--success)' : 'var(--danger)', textDecoration: t.voided ? 'line-through' : 'none' }}>
                      {income ? '+' : ''}{formatMoney(t.amountCents)}
                    </strong>
                    {t.voided ? null : confirmDeleteTxId === t.id ? (
                      <div className="row" style={{ gap: 4 }}>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => {
                            deleteTransaction(t.id);
                            setConfirmDeleteTxId(null);
                            showFlash('Entry removed');
                          }}
                        >
                          Confirm
                        </button>
                        <button className="btn btn-sm" onClick={() => setConfirmDeleteTxId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button className="btn btn-sm" title="Remove this entry" onClick={() => setConfirmDeleteTxId(t.id)}>
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
