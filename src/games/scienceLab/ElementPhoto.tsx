import { useEffect, useState } from 'react';

// A real photo of the element on its card (Build Queue 2026-10-09, from her link to the interactive
// periodic table): the picture from the element's Wikipedia page, fetched when the card opens and
// remembered on the iPad. Nothing shows when the internet is out of reach.
const TITLE: Record<string, string> = { Mercury: 'Mercury_(element)' };
const key = (name: string) => `lab.photo.${name}`;
export default function ElementPhoto({ name }: { name: string }) {
  const [src, setSrc] = useState<string | null>(() => { try { return localStorage.getItem(key(name)); } catch { return null; } });
  useEffect(() => {
    if (src) return;
    let alive = true;
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${TITLE[name] ?? encodeURIComponent(name)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { thumbnail?: { source?: string } } | null) => {
        const s = j?.thumbnail?.source;
        if (!alive || !s) return;
        setSrc(s);
        try { localStorage.setItem(key(name), s); } catch { /* fine */ }
      })
      .catch(() => { /* offline: no photo */ });
    return () => { alive = false; };
  }, [name, src]);
  if (!src) return null;
  return (
    <figure className="lab-photo">
      <img src={src} alt={`A photo of ${name}`} referrerPolicy="no-referrer" loading="lazy" />
      <figcaption>Photo: Wikipedia</figcaption>
    </figure>
  );
}
