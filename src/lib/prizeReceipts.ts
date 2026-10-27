import type { Transaction } from '../types';
import { formatMoney } from './money';

// Build Queue 394 (her words: "fro purchases in marketplace when prizes are in real life such as minecoins (need a parent
// or teacher to do it) have the reciept sent to me in inbox and also include an email or text to
// georgeshomeschool@gmail.com and kayden@vermontliteracynetwork.com"). Every Marketplace prize is a real-life treat a
// grown-up has to hand over, so each prize purchase is a receipt: it shows in the teacher Inbox, and an email goes to
// both grown-ups (sent by api/receipt.ts once an email key is set in Vercel; the Inbox also has an Email button).
export const RECEIPT_TO = ['georgeshomeschool@gmail.com', 'kayden@vermontliteracynetwork.com'];
export const isPrizeReceipt = (t: Transaction) => t.kind === 'purchase-prize' && !t.voided;
const prizeName = (t: Transaction) => t.description.replace(/^Prize: /, '');
export function receiptText(t: Transaction, student: string) {
  const when = new Date(t.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
  return {
    subject: `Prize receipt: ${student} bought ${prizeName(t)}`,
    body: `Prize receipt from the Independent Work Dashboard\n\nStudent: ${student}\nPrize: ${prizeName(t)}\nPrice: ${formatMoney(Math.abs(t.amountCents))} in classroom money\nWhen: ${when}\nReceipt number: ${t.id}\n\nThis is a real-life prize, so a parent or teacher needs to give it to ${student}.`,
  };
}
export const mailtoFor = (t: Transaction, student: string) => { const r = receiptText(t, student); return `mailto:${RECEIPT_TO.join(',')}?subject=${encodeURIComponent(r.subject)}&body=${encodeURIComponent(r.body)}`; };
// Fire and forget: the purchase never waits on the email.
export function sendReceiptEmail(t: Transaction, student: string) {
  const r = receiptText(t, student);
  try { void fetch('/api/receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: r.subject, text: r.body }) }).catch(() => {}); } catch { /* offline */ }
}
