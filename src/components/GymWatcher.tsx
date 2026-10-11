import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { dropOffIfFinishedWhileAway, useFee, useGym, clearFee, DROP_FEE_CENTS, DROP_FEE_QUESTIONS } from '../lib/petGym';
import { formatMoney } from '../lib/money';
import { playCashRegister } from '../lib/chime';

// Buff Doge's pickups (her Pets v2 spec, 2026-10-11): "Personal trainer drops off pet at home if
// student leaves the game otherwise the student must pick the pet home. Personal trainer charges a
// drop off at home fee. a conversation message should pop up on relaunch for students for
// bartering message (pay $100 fee or answer 25 questions in quiz mode)".
// When the game opens, a paid session that finished while the student was away becomes a drop-off
// (the pet is home and the session counts) and Buff Doge asks for the fee. While the student is
// playing, a finished session waits at the gym with a reminder to come pick the pet up.
export default function GymWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = useStore((s) => s.role);
  const hydrated = useStore((s) => s.hydrated);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const pets = useStore((s) => s.pets);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const gym = useGym(student?.id);
  const fee = useFee(student?.id);
  const checked = useRef(false);
  const [showFee, setShowFee] = useState(false);
  const [readyNote, setReadyNote] = useState(false);
  const shownReadyFor = useRef<number | null>(null);

  useEffect(() => {
    if (checked.current || role !== 'student' || !hydrated || !student) return;
    checked.current = true;
    dropOffIfFinishedWhileAway(student.id);
    window.setTimeout(() => { if (useStore.getState().styleLooks.some((r) => r.ownerId === `gymfee:${student.id}` && (r.look as { petId?: string }).petId)) setShowFee(true); }, 0);
  }, [role, hydrated, student]);

  useEffect(() => {
    if (!gym.readyAt || !gym.petId) { setReadyNote(false); return; }
    const wait = gym.readyAt - Date.now();
    const show = () => { if (shownReadyFor.current !== gym.readyAt) { shownReadyFor.current = gym.readyAt ?? null; setReadyNote(true); } };
    if (wait <= 0) { show(); return; }
    const t = window.setTimeout(show, wait);
    return () => window.clearTimeout(t);
  }, [gym.readyAt, gym.petId]);

  if (role !== 'student' || !student || location.pathname === '/student/gym') return null;
  const feePet = pets.find((p) => p.id === fee.petId);
  const gymPet = pets.find((p) => p.id === gym.petId);

  return (
    <>
      {showFee && fee.petId && (
        <div className="bdg-modal-back" role="dialog" aria-modal="true" aria-label="Buff Doge's drop-off fee">
          <div className="bdg-modal">
            <img src="/pets/gym/doge.png" alt="Buff Doge" style={{ width: 150, height: 150, objectFit: 'contain' }} />
            <h2 style={{ margin: '4px 0' }}>Welcome back!</h2>
            <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              You left while {feePet?.customName ?? 'your pet'} was training {fee.trick}, so I dropped {feePet?.customName ?? 'your pet'} off at home. The drop-off fee is {formatMoney(DROP_FEE_CENTS)}, or you can answer {DROP_FEE_QUESTIONS} questions with me.
            </p>
            <div className="bdg-modal-row">
              <button type="button" className="btn btn-primary btn-lg" disabled={student.coins < DROP_FEE_CENTS} onClick={() => {
                recordTransaction(student.id, -DROP_FEE_CENTS, `🏋️ Buff Doge's drop-off fee (${feePet?.customName ?? 'pet'})`, '🏋️', 'purchase-pet');
                playCashRegister(); clearFee(student.id); setShowFee(false);
              }}>Pay {formatMoney(DROP_FEE_CENTS)}</button>
              <button type="button" className="btn btn-primary btn-lg" onClick={() => { setShowFee(false); navigate('/student/gym'); }}>Answer {DROP_FEE_QUESTIONS} questions</button>
              <button type="button" className="btn btn-lg" onClick={() => setShowFee(false)}>Later</button>
            </div>
          </div>
        </div>
      )}
      {!showFee && readyNote && gymPet && (
        <div className="gym-ready-toast" role="status">
          <img src="/pets/gym/doge.png" alt="" />
          <span>{gymPet.customName} finished training {gym.trick}! Pick {gymPet.customName} up at Buff Doge's Gym.</span>
          <button type="button" className="btn btn-primary" onClick={() => { setReadyNote(false); navigate('/student/gym'); }}>Go to the gym</button>
          <button type="button" className="btn" aria-label="Close" onClick={() => setReadyNote(false)}>✕</button>
        </div>
      )}
    </>
  );
}
