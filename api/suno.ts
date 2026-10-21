import type { VercelRequest, VercelResponse } from '@vercel/node';

// Build Queue 350 (her words: "take the suno thing now, im not downloading it but i need you to put it in the music"):
// a Suno share link (suno.com/s/...) plays in the music library without a download. This function opens the share
// link on the server and finds the song's id. Only suno.com links are accepted.
// Build Queue 351 ("dog nose magic song doesnt play"): the browser was sent straight to Suno's MP3, which some school
// networks and iPads refuse. Now this function plays the song itself: it fetches the MP3 from Suno's servers (trying
// each of Suno's audio hosts until one answers) and passes it on in pieces of up to 3 MB, so the audio player can seek
// and stays under Vercel's size limit. `?info=1` reports which host answered.

const UUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const CHUNK = 3 * 1024 * 1024;
const hosts = (id: string) => [`https://cdn1.suno.ai/${id}.mp3`, `https://cdn2.suno.ai/${id}.mp3`, `https://audiopipe.suno.ai/?item_id=${id}`];

async function findId(link: URL): Promise<{ id?: string; html?: string }> {
  const fromPath = link.pathname.match(UUID)?.[1];
  if (fromPath) return { id: fromPath };
  const page = await fetch(link.toString(), { redirect: 'follow', headers: { 'User-Agent': UA } });
  const fromUrl = page.url.match(UUID)?.[1];
  if (fromUrl) return { id: fromUrl };
  const html = await page.text();
  return { html, id: html.match(/cdn\d?\.suno\.ai\/([0-9a-f-]{36})\.mp3/i)?.[1] ?? html.match(/\/song\/([0-9a-f-]{36})/i)?.[1] ?? html.match(UUID)?.[1] };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = String(req.query.u ?? '');
  let link: URL;
  try { link = new URL(raw); } catch { res.status(400).json({ error: 'Send a Suno link as ?u=' }); return; }
  if (!/(^|\.)suno\.(com|ai)$/i.test(link.hostname)) { res.status(400).json({ error: 'Only Suno links.' }); return; }
  try {
    const { id, html } = await findId(link);
    if (!id) { res.status(404).json({ error: 'That Suno song could not be found.' }); return; }
    // Any audio link the share page itself names comes first.
    const named = html ? [...new Set(html.match(/https:\/\/[a-z0-9.-]*suno\.ai\/[^"'\s\\]+\.mp3/gi) ?? [])] : [];
    const tries = [...named, ...hosts(id)];

    // The byte range the player asked for, capped at 3 MB.
    const m = String(req.headers.range ?? '').match(/bytes=(\d+)-(\d*)/);
    const from = m ? Number(m[1]) : 0;
    const to = m && m[2] ? Math.min(Number(m[2]), from + CHUNK - 1) : from + CHUNK - 1;
    const report: { url: string; status: number }[] = [];
    for (const url of tries) {
      let up: Response;
      try { up = await fetch(url, { headers: { 'User-Agent': UA, Range: `bytes=${from}-${to}` }, redirect: 'follow' }); } catch { report.push({ url, status: 0 }); continue; }
      report.push({ url, status: up.status });
      if (up.status !== 200 && up.status !== 206) continue;
      if (req.query.info) { res.status(200).json({ id, audio: url, tried: report }); return; }
      const buf = Buffer.from(await up.arrayBuffer());
      const total = Number(up.headers.get('content-range')?.split('/')[1] ?? '') || (up.status === 200 ? buf.length : 0);
      const body = up.status === 200 ? buf.subarray(from, to + 1) : buf;
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      if (total) res.setHeader('Content-Range', `bytes ${from}-${from + body.length - 1}/${total}`);
      res.setHeader('Content-Length', String(body.length));
      res.status(total && (from > 0 || from + body.length < total) ? 206 : 200).send(body);
      return;
    }
    res.status(404).json({ error: 'Suno did not send the song.', id, tried: report });
  } catch {
    res.status(502).json({ error: 'Suno did not answer.' });
  }
}
