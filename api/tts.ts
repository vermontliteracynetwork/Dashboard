import type { VercelRequest, VercelResponse } from '@vercel/node';

// Human text to speech (teacher 2026-10-12: "tts voices need to be completely human, no more robot
// sounds"). Browsers only have the voices installed on the device, and many sound robotic, so the app
// asks this function for a real neural voice (OpenAI's gpt-4o-mini-tts) and plays the MP3. It only
// works once OPENAI_API_KEY is set in the Vercel project; until then it answers 501 and the app uses
// the most human voice on the device instead. Answers are cached by Vercel's CDN for a year, keyed by
// the exact text and voice, so a line that is read again (a question, a host's greeting) costs nothing.

const VOICES: Record<string, { voice: string; instructions: string }> = {
  reader: { voice: 'coral', instructions: 'Read clearly and warmly at a calm, steady pace, like a kind teacher reading aloud to a middle school student. Natural and human, never robotic.' },
  doc: { voice: 'ash', instructions: 'You are Doc Fishing, a friendly fishing guide from Australia and the host of a kids fishing game. Speak with a natural, smooth Australian accent: relaxed, warm and easygoing, like a real person chatting on a sunny dock. Smooth and human, never robotic.' },
  country: { voice: 'ash', instructions: 'Friendly, upbeat country voice with a light Southern accent.' },
  posh: { voice: 'fable', instructions: 'A small, prim, slightly posh and playful British voice.' },
  deep: { voice: 'onyx', instructions: 'Deep, calm and steady.' },
  warm: { voice: 'ash', instructions: 'Warm and a little gravelly, friendly.' },
  calm: { voice: 'sage', instructions: 'Calm and unhurried, gentle.' },
  crisp: { voice: 'nova', instructions: 'Crisp, clear and precise.' },
  upbeat: { voice: 'echo', instructions: 'Friendly and upbeat.' },
  bright: { voice: 'shimmer', instructions: 'Bright and friendly.' },
  cheerful: { voice: 'coral', instructions: 'Light and cheerful.' },
  playful: { voice: 'ballad', instructions: 'Playful and quick, full of energy.' },
  pet: { voice: 'coral', instructions: 'You are a tiny, cute pet. Say this in a small, squeaky, happy voice.' },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const key = process.env.OPENAI_API_KEY;
  if (req.query.probe) { res.setHeader('Cache-Control', 'no-store'); res.status(key ? 200 : 501).json({ ready: !!key }); return; }
  if (!key) { res.status(501).json({ error: 'Human voices are not set up yet.' }); return; }
  // Only this app may use it (the voice service costs money per line).
  const from = String(req.headers.referer ?? req.headers.origin ?? '');
  const host = String(req.headers.host ?? '');
  if (from && host && !from.includes(host)) { res.status(403).json({ error: 'Not allowed.' }); return; }
  const text = typeof req.query.text === 'string' ? req.query.text.trim().slice(0, 900) : '';
  if (!text) { res.status(400).json({ error: 'Missing text.' }); return; }
  const v = VOICES[typeof req.query.v === 'string' ? req.query.v : 'reader'] ?? VOICES.reader;
  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice: v.voice, input: text, instructions: v.instructions, response_format: 'mp3' }),
    });
    if (!r.ok) { res.status(502).json({ error: 'The voice service did not answer.' }); return; }
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000, s-maxage=31536000, immutable');
    res.status(200).send(audio);
  } catch {
    res.status(502).json({ error: 'The voice service did not answer.' });
  }
}
