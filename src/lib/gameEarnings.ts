import { useStore } from '../store/store';
import { formatMoney } from './money';

// Native game pay (teacher direction 2026-10-04): "for all native games,
// students earn the equal number of dollars for the correct number of
// questions answered. example, if i answer 20 correct questions in a game,
// i will earn $20" and "the coin animation should be shown, a mesage should
// appear, and the bank register should be updated".
//
// $1 per right answer. One bank register row per payout, the app-wide
// falling coins (CoinDropOverlay), and a message on screen saying what was
// earned and why.
export const DOLLARS_PER_CORRECT_CENTS = 100;

export function payForAnswers(studentId: string, correct: number, game: string, icon: string) {
  if (!studentId || correct <= 0) return;
  const cents = correct * DOLLARS_PER_CORRECT_CENTS;
  const st = useStore.getState();
  st.recordTransaction(studentId, cents, `${icon} ${game}: ${correct} right answer${correct === 1 ? '' : 's'}`, icon, 'game-answers');
  useStore.setState((s) => ({
    lastCoinEarn: s.lastCoinEarn ? { ...s.lastCoinEarn, message: `You earned ${formatMoney(cents)} for ${correct} right answer${correct === 1 ? '' : 's'} in ${game}!` } : s.lastCoinEarn,
  }));
}
