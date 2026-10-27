import type { VercelRequest, VercelResponse } from '@vercel/node';

// Build Queue 394: emails a Marketplace prize receipt to the two grown-ups who hand out real-life prizes. The addresses
// live here, never in the request, so this can only ever email them. It uses Resend (https://resend.com) and works once
// RESEND_API_KEY is set in the Vercel project (and RECEIPT_FROM, a sender on a domain verified in Resend; until then
// Resend's test sender is used). Without a key it answers 501 and the receipt is still in the teacher Inbox.
const TO = ['georgeshomeschool@gmail.com', 'kayden@vermontliteracynetwork.com'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.RESEND_API_KEY;
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only.' }); return; }
  const from = String(req.headers.referer ?? req.headers.origin ?? ''), host = String(req.headers.host ?? '');
  if (from && host && !from.includes(host)) { res.status(403).json({ error: 'Not allowed.' }); return; }
  if (!key) { res.status(501).json({ error: 'Email is not set up yet.' }); return; }
  const body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) ?? {};
  const subject = String(body.subject ?? '').slice(0, 160), text = String(body.text ?? '').slice(0, 2000);
  if (!subject.startsWith('Prize receipt:') || !text) { res.status(400).json({ error: 'Not a receipt.' }); return; }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RECEIPT_FROM || 'Dashboard Receipts <onboarding@resend.dev>', to: TO, subject, text }),
    });
    res.status(r.ok ? 200 : 502).json({ sent: r.ok });
  } catch { res.status(502).json({ error: 'The email service did not answer.' }); }
}
