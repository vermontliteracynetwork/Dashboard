import type { VercelRequest, VercelResponse } from '@vercel/node';

// Build Queue 350 (her words: "take the suno thing now, im not downloading it but i need you to put it in the music"):
// a Suno share link (suno.com/s/...) plays in the music library without a download. This function opens the share
// link on the server, finds the song's id, and sends the browser to Suno's own MP3 for it. Answers are cached by
// Vercel's CDN for a day, keyed by the link. Only suno.com links are accepted.

const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = String(req.query.u ?? '');
  let link: URL;
  try { link = new URL(raw); } catch { res.status(400).json({ error: 'Send a Suno link as ?u=' }); return; }
  if (!/(^|\.)suno\.(com|ai)$/i.test(link.hostname)) { res.status(400).json({ error: 'Only Suno links.' }); return; }
  try {
    let id = link.pathname.match(UUID)?.[1];
    if (!id) {
      const page = await fetch(link.toString(), { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36' } });
      id = page.url.match(UUID)?.[1];
      if (!id) {
        const html = await page.text();
        id = html.match(/cdn\d?\.suno\.ai\/([0-9a-f-]{36})\.mp3/i)?.[1] ?? html.match(/\/song\/([0-9a-f-]{36})/i)?.[1] ?? html.match(UUID)?.[1];
      }
    }
    if (!id) { res.status(404).json({ error: 'That Suno song could not be found.' }); return; }
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    if (req.query.info) { res.status(200).json({ id, audio: `https://cdn1.suno.ai/${id}.mp3` }); return; }
    res.redirect(302, `https://cdn1.suno.ai/${id}.mp3`);
  } catch {
    res.status(502).json({ error: 'Suno did not answer.' });
  }
}
