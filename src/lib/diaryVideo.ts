import { BITMOJIS, ENERGY_LEVELS, PET_EMOTES, TAPES, pageH, type DiaryItem, type DiaryPageData } from './diaryBook';
import { portraitFor } from '../style/StylePortrait';
import { ENERGY_FACE } from './supernature';
import { petDefById, thumbnailFor } from './petCatalog';

// Build Queue 578 and 579: a Diary page (or a whole week, the highlight reel) saved as a video. The page is painted onto
// a canvas frame by frame, with every animation, path, the pet wagging and the live stats, and recorded as MP4 where
// the device can (iPads and current Chrome), otherwise WebM.
export interface StatNow { n?: number; label: string; ring?: { right: number; total: number }; feel?: { w: string; zone: string; energy: number }[] }
export interface ReelPage { page: DiaryPageData; title: string; stat: (it: DiaryItem) => StatNow; pets: Record<string, { defId: string; name: string }>; studentId?: string }

const imgCache = new Map<string, Promise<HTMLImageElement | null>>();
const loadImg = (src?: string) => {
  if (!src) return Promise.resolve(null);
  if (!imgCache.has(src)) imgCache.set(src, new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }));
  return imgCache.get(src)!;
};
const htmlLines = (html?: string) => {
  if (!html) return [] as string[];
  const d = new DOMParser().parseFromString(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n'), 'text/html');
  return (d.body.textContent ?? '').split('\n');
};

function wrapText(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  text.split('\n').forEach((para) => {
    let line = '';
    para.split(/\s+/).forEach((w) => { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; });
    out.push(line);
  });
  return out;
}
function round(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.roundRect(x, y, w, h, r); }

// Paint one page at time t (seconds) into the box (bx, by, bw) of the canvas.
async function paint(g: CanvasRenderingContext2D, rp: ReelPage, bx: number, by: number, bw: number, t: number, imgs: Map<string, HTMLImageElement | null>) {
  const p = rp.page, bh = (bw * pageH(p)) / 100, u = bw / 100; // u = 1cqw
  g.save(); g.translate(bx, by);
  g.fillStyle = p.bg; round(g, 0, 0, bw, bh, 1.5 * u); g.fill(); g.clip();
  // typed words
  g.fillStyle = p.bg === '#2b2540' ? '#f5f3ff' : '#1f2937'; g.font = `500 ${3.6 * u}px Nunito, system-ui, sans-serif`; g.textBaseline = 'top';
  let ty = 6 * u; htmlLines(p.html).forEach((para) => wrapText(g, para, bw - 12 * u).forEach((ln) => { if (ty < bh - 6 * u) g.fillText(ln, 6 * u, ty); ty += 5.2 * u; }));
  const items = [...p.items].sort((a, b) => (a.kind === 'frame' ? -1 : b.kind === 'frame' ? 1 : a.z - b.z));
  for (const it of items) {
    let x = (it.x / 100) * bw, y = (it.y / 100) * bh, sc = 1, rot = it.rot, dy = 0, dx = 0;
    const w = (it.w / 100) * bw;
    if (it.anim === 'path' && it.path && it.path.length > 1) { const n = it.path.length - 1, dur = Math.max(1.5, n * 0.045), k = (t % (dur * 2)) / dur, f = (k > 1 ? 2 - k : k) * n, i = Math.min(n - 1, Math.floor(f)), r = f - i, a = it.path[i], b = it.path[i + 1]; x += ((a[0] + (b[0] - a[0]) * r) / 100) * bw; y += ((a[1] + (b[1] - a[1]) * r) / 100) * bh; }
    if (it.anim === 'bounce') dy = -Math.abs(Math.sin(t * Math.PI)) * w * 0.12;
    if (it.anim === 'wiggle') rot += Math.sin(t * 2 * Math.PI / 0.8) * 8;
    if (it.anim === 'spin') rot += (t / 3) * 360;
    if (it.anim === 'float') { dx = Math.sin(t * 2 * Math.PI / 3) * w * 0.04; dy = -Math.abs(Math.sin(t * Math.PI / 3)) * w * 0.08; }
    if (it.anim === 'pulse') sc = 1 + 0.12 * Math.abs(Math.sin(t * Math.PI / 1.2));
    if (it.kind === 'pet') rot += Math.sin(t * 2 * Math.PI / 1.6) * 4;
    g.save(); g.translate(x + dx, y + dy); g.rotate((rot * Math.PI) / 180); g.scale(sc, sc);
    if (it.emote && (it.kind === 'pet' || it.kind === 'avatar')) { if (it.emote === 'jump' || it.emote === 'flip') dy -= Math.abs(Math.sin(t * Math.PI / 1.2)) * w * 0.15; if (it.emote === 'spin') rot += ((t % 2) / 2) * 360; if (it.emote === 'dance') rot += Math.sin(t * 6) * 10; }
    const im = imgs.get(it.kind === 'pet' ? `pet:${it.petId}` : it.kind === 'avatar' ? 'avatar' : it.kind === 'energy' ? ENERGY_FACE[ENERGY_LEVELS[it.value ?? 2]] : it.filter === 'pixel' && it.pix ? it.pix : it.src ?? '') ?? null;
    const FL: Record<string, string> = { bw: 'grayscale(1)', sunny: 'sepia(0.45) saturate(1.5) brightness(1.08)', pop: 'saturate(2.2) contrast(1.15)', comic: 'contrast(1.5) saturate(1.7)' };
    g.filter = it.filter && FL[it.filter] ? FL[it.filter] : 'none'; g.imageSmoothingEnabled = it.filter !== 'pixel';
    if (it.filter === 'outline') { g.shadowColor = '#ffffff'; g.shadowBlur = 0.8 * u; }
    let h = w * (it.ar ?? 1);
    if (it.kind === 'frame') { h = ((it.h ?? 40) / 100) * bh; g.strokeStyle = it.color ?? '#111827'; g.lineWidth = 1.2 * u; g.strokeRect(-w / 2, -h / 2, w, h); }
    else if (it.kind === 'tape') { h = (bh > bw ? 5 : 4) * u; const tp = TAPES.find((q) => q.id === it.pattern); const base = tp?.css.match(/#[0-9a-f]{6}/i)?.[0] ?? '#f9a8d4'; g.globalAlpha = 0.85; g.fillStyle = base; g.fillRect(-w / 2, -h / 2, w, h); g.globalAlpha = 0.5; g.fillStyle = '#ffffff'; for (let k = -w / 2; k < w / 2; k += 2 * u) g.fillRect(k, -h / 2, u * 0.8, h); g.globalAlpha = 1; }
    else if (it.kind === 'note' || it.kind === 'bubble') {
      g.font = `700 ${3 * u}px Nunito, system-ui, sans-serif`; const lines = wrapText(g, it.text || '', w - 5 * u); h = Math.max(8 * u, lines.length * 3.9 * u + 4 * u);
      g.fillStyle = it.color ?? (it.kind === 'note' ? '#fff59d' : '#ffffff'); round(g, -w / 2, -h / 2, w, h, it.kind === 'note' || it.from === 'narrate' ? 0.6 * u : 4 * u); g.fill();
      if (it.kind === 'bubble' && it.from !== 'narrate' && it.from !== 'shout') { g.strokeStyle = '#2b2540'; g.lineWidth = 0.5 * u; g.stroke(); g.beginPath(); const tx = it.from === 'pet' ? w * 0.25 : -w * 0.25; g.moveTo(tx - 1.6 * u, h / 2); g.lineTo(tx, h / 2 + 3 * u); g.lineTo(tx + 1.6 * u, h / 2); g.fillStyle = '#2b2540'; g.fill(); }
      g.fillStyle = it.textColor ?? '#2b2540'; lines.forEach((ln, k) => g.fillText(ln, -w / 2 + 2.5 * u, -h / 2 + 2 * u + k * 3.9 * u));
    } else if (it.kind === 'sfx') { g.font = `900 ${it.w * 0.28 * u}px Impact, 'Arial Black', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 1.2 * u; g.strokeStyle = '#111827'; g.strokeText(it.text ?? '', 0, 0); g.fillStyle = it.color ?? '#facc15'; g.fillText(it.text ?? '', 0, 0); g.textAlign = 'left'; g.textBaseline = 'top'; }
    else if (it.kind === 'stat') {
      const s = rp.stat(it); h = w * 0.75; g.fillStyle = '#1e293b'; round(g, -w / 2, -h / 2, w, h, 3 * u); g.fill(); g.textAlign = 'center';
      if (s.feel) {
        const Z: Record<string, string> = { green: '#22c55e', blue: '#3b82f6', yellow: '#eab308', red: '#ef4444' }, pts = s.feel, cw = w * 0.84, ch = h * 0.55, ox = -cw / 2, oy = -h * 0.3;
        if (!pts.length) { g.fillStyle = '#fff'; g.font = `700 ${2.2 * u}px Nunito, sans-serif`; g.textBaseline = 'middle'; g.fillText('No check-ins yet', 0, 0); }
        else if (it.stat === 'feelbar') { const m = new Map<string, { n: number; z: string }>(); pts.forEach((q) => m.set(q.w, { n: (m.get(q.w)?.n ?? 0) + 1, z: q.zone })); const bars = [...m.entries()].slice(0, 7), mx = Math.max(...bars.map(([, v]) => v.n)), bw2 = cw / bars.length; bars.forEach(([wd, v], k) => { const bh2 = (v.n / mx) * ch; g.fillStyle = Z[v.z] ?? '#fde047'; g.fillRect(ox + k * bw2 + bw2 * 0.15, oy + ch - bh2, bw2 * 0.7, bh2); g.fillStyle = '#fff'; g.font = `700 ${1.8 * u}px Nunito, sans-serif`; g.textBaseline = 'top'; g.fillText(wd.slice(0, 8), ox + k * bw2 + bw2 / 2, oy + ch + u * 0.5); }); }
        else { const n = pts.length, X = (k: number) => ox + (n === 1 ? cw / 2 : (k / (n - 1)) * cw), Y = (e: number) => oy + ch - (e / 4) * ch; g.strokeStyle = '#fde047'; g.lineWidth = 0.6 * u; g.beginPath(); pts.forEach((q, k) => (k ? g.lineTo(X(k), Y(q.energy)) : g.moveTo(X(k), Y(q.energy)))); g.stroke(); pts.forEach((q, k) => { g.fillStyle = Z[q.zone] ?? '#fff'; g.beginPath(); g.arc(X(k), Y(q.energy), 1.2 * u, 0, Math.PI * 2); g.fill(); }); }
      } else if (s.ring) { const r = h * 0.3, acc = s.ring.total ? s.ring.right / s.ring.total : 0; g.lineWidth = r * 0.3; g.strokeStyle = s.ring.total ? '#ef4444' : '#e5e7eb'; g.beginPath(); g.arc(0, -h * 0.08, r, 0, Math.PI * 2); g.stroke(); if (acc) { g.strokeStyle = '#22c55e'; g.beginPath(); g.arc(0, -h * 0.08, r, -Math.PI / 2, -Math.PI / 2 + acc * Math.PI * 2); g.stroke(); } g.fillStyle = '#fff'; g.font = `900 ${r * 0.6}px Nunito, sans-serif`; g.textBaseline = 'middle'; g.fillText(`${Math.round(acc * 100)}%`, 0, -h * 0.08); }
      else { g.fillStyle = '#fde047'; g.font = `900 ${h * 0.42}px Nunito, sans-serif`; g.textBaseline = 'middle'; g.fillText(String(s.n ?? 0), 0, -h * 0.08); }
      g.fillStyle = '#fff'; g.font = `700 ${2.3 * u}px Nunito, sans-serif`; g.textBaseline = 'alphabetic'; g.fillText(s.label, 0, h / 2 - 2 * u); g.textAlign = 'left'; g.textBaseline = 'top';
    } else if (it.kind === 'energy') { h = w * 2.2; g.fillStyle = '#fff'; round(g, -w / 2, -h / 2, w, h, 3 * u); g.fill(); const v = it.value ?? 2, sy = -h / 2 + 8 * u + (4 - v) * ((h - 16 * u) / 4); if (im) g.drawImage(im, -w * 0.3, sy - w * 0.3, w * 0.6, w * 0.6); g.fillStyle = '#2b2540'; g.font = `700 ${2.4 * u}px Nunito, sans-serif`; g.fillText(`Energy: ${ENERGY_LEVELS[v]}`, -w / 2 + 1.5 * u, h / 2 - 4 * u); }
    else if (it.kind === 'voice') { h = 7 * u; g.fillStyle = '#2b2540'; round(g, -w / 2, -h / 2, w, h, h / 2); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${2.4 * u}px Nunito, sans-serif`; g.fillText(it.text ?? 'My voice', -w / 2 + 2 * u, -1.4 * u); if (it.transcript) { g.font = `italic 600 ${2.2 * u}px Nunito, sans-serif`; g.fillStyle = '#2b2540'; wrapText(g, `"${it.transcript}"`, w).slice(0, 4).forEach((ln, k) => g.fillText(ln, -w / 2, h / 2 + 1.2 * u + k * 2.9 * u)); } }
    else if (it.kind === 'avatar' && it.pattern) {
      const b = BITMOJIS.find((x) => x.id === it.pattern); h = w;
      if (b) { g.fillStyle = b.bg; g.beginPath(); g.arc(0, 0, w * 0.48, 0, Math.PI * 2); g.fill(); if (im) g.drawImage(im, -w * 0.4, -w * 0.45, w * 0.8, w * 0.8); g.font = `900 ${w * 0.17}px Impact, 'Arial Black', sans-serif`; g.textAlign = 'center'; g.lineWidth = w * 0.03; g.strokeStyle = b.ink === '#ffffff' ? '#1f2937' : '#ffffff'; g.strokeText(b.text, 0, w * 0.32); g.fillStyle = b.ink; g.fillText(b.text, 0, w * 0.32); g.textAlign = 'left'; }
    }
    else if (im) {
      h = w * (im.naturalHeight / Math.max(1, im.naturalWidth));
      const framed = it.kind === 'photo' || it.kind === 'meme' || it.kind === 'feeling', pad = framed ? 1.2 * u : 0, extra = it.kind === 'feeling' ? 4 * u : 0;
      if (framed) { g.fillStyle = '#fff'; g.fillRect(-w / 2, -h / 2, w, h + extra + pad); }
      g.drawImage(im, -w / 2 + pad, -h / 2 + pad, w - 2 * pad, h - 2 * pad);
      if (it.kind === 'feeling' && it.text) { g.fillStyle = '#2b2540'; g.font = `700 ${2.6 * u}px Nunito, sans-serif`; g.textAlign = 'center'; g.fillText(it.text, 0, h / 2); g.textAlign = 'left'; }
      if (it.kind === 'pet') { const nm = rp.pets[it.petId ?? '']?.name; if (nm) { g.fillStyle = '#2b2540'; g.font = `800 ${2.4 * u}px Nunito, sans-serif`; g.textAlign = 'center'; g.fillText(nm, 0, h / 2 - 3 * u); g.textAlign = 'left'; } }
    }
    g.filter = 'none'; g.shadowBlur = 0; g.imageSmoothingEnabled = true;
    const em = PET_EMOTES.find((e) => e.id === it.emote);
    if (em && (it.kind === 'pet' || it.kind === 'avatar')) { g.font = `900 ${w * 0.18}px Nunito, sans-serif`; g.textAlign = 'center'; g.lineWidth = 0.6 * u; g.strokeStyle = '#ffffff'; g.fillStyle = em.id === 'love' ? '#ef4444' : '#8a63d2'; const by2 = -h / 2 - w * 0.05 - Math.abs(Math.sin(t * 3)) * w * 0.05; g.strokeText(em.mark, w * 0.3, by2); g.fillText(em.mark, w * 0.3, by2); g.textAlign = 'left'; }
    if (it.caption && !['tape', 'note', 'bubble', 'frame', 'sfx', 'energy'].includes(it.kind)) { g.font = `700 ${2.8 * u}px Nunito, sans-serif`; g.textAlign = 'center'; g.fillStyle = '#ffffffcc'; const cw = Math.min(w, g.measureText(it.caption).width + 2 * u); g.fillRect(-cw / 2, h / 2 + 4.5 * u, cw, 4 * u); g.fillStyle = it.textColor ?? '#2b2540'; g.fillText(it.caption, 0, h / 2 + 5 * u); g.textAlign = 'left'; }
    g.restore();
  }
  g.restore();
}

export function videoType(): { mime: string; ext: string } {
  const opts = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
  const mime = typeof MediaRecorder !== 'undefined' ? opts.find((m) => MediaRecorder.isTypeSupported?.(m)) ?? '' : '';
  return { mime, ext: mime.includes('mp4') ? 'mp4' : 'webm' };
}

// Record the pages one after another (a title card first when there are several). Returns the video file.
export async function recordReel(pages: ReelPage[], opts: { title?: string; secsEach?: number; onProgress?: (k: number) => void; music?: string } = {}): Promise<File> {
  if (typeof MediaRecorder === 'undefined') throw new Error('This device cannot make videos.');
  const land = pages.length > 1 || pages[0]?.page.orient !== 'port';
  const W = land ? 1280 : 990, Hh = land ? 990 : 1280;
  const c = document.createElement('canvas'); c.width = W; c.height = Hh; const g = c.getContext('2d')!;
  const imgs = new Map<string, HTMLImageElement | null>();
  await Promise.all(pages.flatMap((rp) => rp.page.items.map(async (it) => {
    if (it.kind === 'avatar') { const u2 = rp.studentId ? portraitFor(rp.studentId) : null; imgs.set('avatar', u2 ? await loadImg(u2) : null); }
    else if (it.kind === 'pet') { const pet = rp.pets[it.petId ?? '']; const d = pet ? petDefById(pet.defId) : undefined; imgs.set(`pet:${it.petId}`, d ? await loadImg(thumbnailFor(d)) : null); }
    else if (it.kind === 'energy') { const s = ENERGY_FACE[ENERGY_LEVELS[it.value ?? 2]]; imgs.set(s, await loadImg(s)); }
    else if (it.src) { imgs.set(it.src, await loadImg(it.src)); if (it.pix) imgs.set(it.pix, await loadImg(it.pix)); }
  })));
  const { mime, ext } = videoType();
  const stream = c.captureStream(30);
  // The page soundtrack goes into the video (Build Queue 584).
  const musicSrc = opts.music ?? pages.find((rp) => rp.page.music)?.page.music;
  let audio: HTMLAudioElement | null = null, actx: AudioContext | null = null;
  if (musicSrc) {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      actx = new AC(); audio = new Audio(musicSrc); audio.loop = true; audio.crossOrigin = 'anonymous';
      const srcNode = actx.createMediaElementSource(audio), dest = actx.createMediaStreamDestination(); srcNode.connect(dest);
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr)); await audio.play();
    } catch { /* video without music */ }
  } const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
  const chunks: Blob[] = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise<void>((res) => { rec.onstop = () => res(); });
  const each = opts.secsEach ?? (pages.length > 1 ? 3.5 : 7), intro = pages.length > 1 ? 2.2 : 0, total = intro + each * pages.length;
  rec.start(200);
  const t0 = performance.now();
  await new Promise<void>((res) => {
    const frame = async () => {
      const t = (performance.now() - t0) / 1000;
      g.fillStyle = '#2b2540'; g.fillRect(0, 0, W, Hh);
      if (t < intro) {
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `900 ${W * 0.08}px Nunito, system-ui, sans-serif`; g.fillText(opts.title ?? 'My week', W / 2, Hh * 0.45);
        g.font = `600 ${W * 0.035}px Nunito, system-ui, sans-serif`; g.fillStyle = '#fde047'; g.fillText(`${pages.length} diary pages`, W / 2, Hh * 0.58); g.textAlign = 'left';
      } else {
        const k = Math.min(pages.length - 1, Math.floor((t - intro) / each)), rp = pages[k], lt = t - intro - k * each;
        opts.onProgress?.(k);
        const ph = pageH(rp.page) / 100, fit = Math.min((W * 0.92), (Hh * (pages.length > 1 ? 0.8 : 0.94)) / ph), bx = (W - fit) / 2, by = pages.length > 1 ? Hh * 0.13 : (Hh - fit * ph) / 2;
        const fade = Math.min(1, lt * 3, (each - lt) * 3); g.globalAlpha = Math.max(0, fade);
        await paint(g, rp, bx, by, fit, lt, imgs);
        g.globalAlpha = 1;
        if (pages.length > 1) { g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 ${W * 0.035}px Nunito, system-ui, sans-serif`; g.fillText(rp.title, W / 2, Hh * 0.07); g.textAlign = 'left'; }
      }
      if (t >= total) { res(); return; }
      requestAnimationFrame(() => void frame());
    };
    void frame();
  });
  rec.stop(); stream.getTracks().forEach((tr) => tr.stop()); audio?.pause(); void actx?.close();
  await done;
  return new File([new Blob(chunks, { type: mime || 'video/webm' })], `${(opts.title ?? 'my-diary').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`, { type: mime || 'video/webm' });
}

// Hand the video to the student: the share sheet on an iPad (Save Video), otherwise a download.
export async function shareVideo(file: File) {
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], title: file.name }); return; } catch { /* closed, fall back */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}
