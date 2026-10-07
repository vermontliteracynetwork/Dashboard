import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

// Fetches a teacher-provided article URL server-side (browsers can't do this
// directly — most sites block cross-origin fetches) and runs Mozilla's
// Readability algorithm (the same one behind Firefox Reader View) to strip
// navigation, ads, and other page chrome, leaving just the article itself.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = typeof req.query.url === 'string' ? req.query.url : null;
  if (!url) {
    res.status(400).json({ error: 'Missing url parameter.' });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: 'That doesn\'t look like a valid web address.' });
    return;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    res.status(400).json({ error: 'Only http/https links are supported.' });
    return;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')) {
    res.status(400).json({ error: 'That address can\'t be fetched.' });
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const response = await fetch(parsed.toString(), {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ClassroomReaderBot/1.0; +https://vercel.com)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.status(502).json({ error: `The site responded with an error (${response.status}). Double-check the link.` });
      return;
    }
    const html = await response.text();

    // linkedom, not jsdom: jsdom crashed the serverless function on load
    // (FUNCTION_INVOCATION_FAILED, found 2026-10-07 importing a Kiddle article).
    const { document } = parseHTML(html);
    // Readability resolves relative image links against the page address.
    const base = document.createElement('base'); base.setAttribute('href', parsed.toString());
    document.head?.prepend(base);
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();

    if (!article || !article.textContent || article.textContent.trim().length < 50) {
      res.status(422).json({ error: 'Could not find readable article text on that page.' });
      return;
    }

    res.status(200).json({
      title: article.title ?? '',
      byline: article.byline ?? null,
      contentHtml: article.content ?? '',
      textContent: article.textContent,
      siteName: article.siteName ?? null,
      excerpt: article.excerpt ?? null,
    });
  } catch (err) {
    const message = err instanceof Error && err.name === 'AbortError' ? 'That site took too long to respond.' : 'Could not fetch that page.';
    res.status(500).json({ error: message });
  }
}
