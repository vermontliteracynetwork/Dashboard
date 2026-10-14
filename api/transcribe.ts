import type { VercelRequest, VercelResponse } from '@vercel/node';

// Voice memo transcripts (teacher 2026-10-14: "make sure transcripts are added for voice memos too for
// easy view"). Azalea uploads a student's voice memo to the app's own storage, then asks this function
// to write down what was said, so the teacher can read it in her inbox without playing it. Uses the same
// OPENAI_API_KEY as the human voices; without it this answers 501 and the memo is sent without a
// transcript. Only memos in this app's own storage are accepted.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const key = process.env.OPENAI_API_KEY;
  if (!key) { res.status(501).json({ error: 'Transcripts are not set up yet.' }); return; }
  const from = String(req.headers.referer ?? req.headers.origin ?? '');
  const host = String(req.headers.host ?? '');
  if (from && host && !from.includes(host)) { res.status(403).json({ error: 'Not allowed.' }); return; }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {});
  const url = typeof body.url === 'string' ? body.url : '';
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/videos\/voice-memos\//.test(url)) { res.status(400).json({ error: 'Not a voice memo.' }); return; }
  try {
    const a = await fetch(url);
    if (!a.ok) { res.status(404).json({ error: 'Memo not found.' }); return; }
    const type = a.headers.get('content-type') ?? 'audio/webm';
    const buf = await a.arrayBuffer();
    if (buf.byteLength > 20_000_000) { res.status(413).json({ error: 'Memo too long.' }); return; }
    const form = new FormData();
    form.append('file', new Blob([buf], { type }), type.includes('mp4') ? 'memo.mp4' : 'memo.webm');
    form.append('model', 'gpt-4o-mini-transcribe');
    form.append('language', 'en');
    form.append('prompt', 'A child is telling their teacher about a bug or an idea for an educational game.');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
    if (!r.ok) { res.status(502).json({ error: 'The transcript service did not answer.' }); return; }
    const j = await r.json() as { text?: string };
    res.status(200).json({ text: (j.text ?? '').trim() });
  } catch {
    res.status(502).json({ error: 'The transcript service did not answer.' });
  }
}
