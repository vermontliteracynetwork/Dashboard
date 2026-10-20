import { useEffect, useRef } from 'react';
import { FEELING_FAMILY, FEELING_ROOTS, feelingImg, feelingPath, type FeelingNode } from '../lib/feelingsWheel';
import { SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../lib/selZones';
import { sfxOn } from '../lib/miniSfx';
import { speak } from './ReadAloud';

// The Feelings Wheel check-in (Build Queue 233 and 234). Half a prize wheel rises from the bottom of
// the screen. It starts with the seven center feelings; when a ring stops, the slice under the
// pointer opens out of its pie shape into a square card. Staying on a feeling for 5 seconds (or
// "See more like this") grows the next ring outside it. Every ring spins on its own: spinning an
// outer ring leaves the inner rings still, and spinning an inner ring folds away the rings outside
// it, because they belonged to the old feeling. Each word's tag is its zone color.
// Drawn on one canvas; the card and the opening picture are plain DOM on top.

const TAU = Math.PI * 2;
const SPLITS: Record<number, number[]> = { 1: [1], 2: [0.42, 0.58], 3: [0.27, 0.31, 0.42] };
const ZONE_INK: Record<string, string> = { blue: '#ffffff', green: '#ffffff', yellow: '#231b33', red: '#ffffff' };

interface Ring {
  parent: FeelingNode | null; items: FeelingNode[];
  rot: number; vel: number; phase: 'idle' | 'drag' | 'spin' | 'snap'; target: number; tick: number;
  a: number; b: number; ta: number; tb: number; alpha: number; dying: boolean;
}

// Little Web Audio sounds, quiet and short, off when the games' sound switch is off (miniSfx).
let actx: AudioContext | null = null;
function ac() {
  if (!sfxOn()) return null;
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    if (!actx || actx.state === 'closed') actx = new C();
    if (actx.state === 'suspended') void actx.resume();
    return actx;
  } catch { return null; }
}
function tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slideTo?: number) {
  const c = ac(); if (!c) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + dur + 0.03);
}
let lastTick = 0;
const snd = {
  tick: () => { const n = performance.now(); if (n - lastTick < 30) return; lastTick = n; tone(2200, 0.028, 'triangle', 0.12); tone(650, 0.02, 'square', 0.025); },
  notify: () => { tone(880, 0.12, 'sine', 0.1); tone(1320, 0.18, 'sine', 0.08, 0.08); },
  ring: () => { tone(330, 0.22, 'sine', 0.1, 0, 520); tone(660, 0.2, 'sine', 0.07, 0.12); },
  choose: () => { tone(784, 0.5, 'sine', 0.1); tone(1175, 0.7, 'sine', 0.06, 0.06); },
};

const ringFor = (parent: FeelingNode | null) => {
  let arr = parent ? parent.kids.slice() : FEELING_ROOTS.slice();
  if (parent && arr.length === 1) arr = [parent, ...arr];
  const base = arr.slice();
  while (arr.length < 4) arr = arr.concat(base);
  return arr;
};
const norm = (a: number) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
const hexA = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export default function FeelingsWheel({ studentName, onChoose }: { studentName: string; onChoose: (n: FeelingNode) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef(onChoose); chooseRef.current = onChoose;

  useEffect(() => {
    const root = rootRef.current!;
    const q = <T extends HTMLElement>(s: string) => root.querySelector(s) as T;
    const cv = q<HTMLCanvasElement>('.fw-canvas'), g = cv.getContext('2d')!;
    const top = q<HTMLElement>('.fw-top'), hint = q<HTMLElement>('.fw-hint'), back = q<HTMLButtonElement>('.fw-back');
    const morph = q<HTMLDivElement>('.fw-morph'), card = q<HTMLElement>('.fw-card'), slot = q<HTMLElement>('.fw-slot');
    const cWord = q<HTMLElement>('.fw-word'), cPath = q<HTMLElement>('.fw-path'), cZone = q<HTMLElement>('.fw-zone');
    const more = q<HTMLButtonElement>('.fw-more'), note = q<HTMLElement>('.fw-note'), mini = q<HTMLCanvasElement>('.fw-mini');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const imgs: Record<string, HTMLImageElement> = {};
    const img = (w: string) => { if (!imgs[w]) { const i = new Image(); i.src = feelingImg(w); imgs[w] = i; } return imgs[w]; };
    FEELING_ROOTS.forEach((r) => { img(r.w); r.kids.forEach((k) => img(k.w)); });

    let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 200, rimW = 15, h0 = 30;
    const rings: Ring[] = [];
    const live = () => rings.filter((r) => !r.dying);
    const outer = () => { const l = live(); return l[l.length - 1]; };
    const stepOf = (r: Ring) => TAU / r.items.length;
    const atPointer = (r: Ring) => { const n = r.items.length; return ((Math.round(-r.rot / stepOf(r)) % n) + n) % n; };
    const selected = (r: Ring) => r.items[atPointer(r)];

    function retarget() {
      const l = live(), fr = SPLITS[l.length] ?? SPLITS[3], A = R - h0;
      let at = h0;
      l.forEach((r, i) => { r.ta = at; at += A * fr[i]; r.tb = at; });
      rings.filter((r) => r.dying).forEach((r) => { r.ta = R; r.tb = R; });
    }
    function layout() {
      const box = root.getBoundingClientRect();
      W = box.width; H = box.height; dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      const hb = top.getBoundingClientRect().bottom - box.top;
      R = Math.max(130, Math.min(W * 0.455, (H - hb - 18) / 1.2, H * 0.72));
      rimW = R * 0.075; cx = W / 2; cy = H; h0 = R * 0.13;
      retarget();
      rings.forEach((r) => { r.a = r.ta; r.b = r.tb; });
    }
    function addRing(parent: FeelingNode | null, instant = false) {
      const items = ringFor(parent);
      const st = TAU / items.length;
      const r: Ring = { parent, items, rot: st / 2, vel: 0, phase: 'idle', target: 0, tick: 0, a: R, b: R, ta: R, tb: R, alpha: instant ? 1 : 0, dying: false };
      rings.push(r); retarget();
      if (instant) { r.a = r.ta; r.b = r.tb; }
      items.forEach((n) => { img(n.w); n.kids.forEach((k) => img(k.w)); });
      setHint();
    }
    function dropOutside(k: number) {
      const l = live();
      l.slice(k + 1).forEach((r) => { r.dying = true; });
      retarget(); setHint();
    }

    // ---------- drawing ----------
    function wedgePath(rIn: number, rOut: number, a0: number, a1: number) {
      g.beginPath();
      g.arc(cx, cy, rOut, a0 - Math.PI / 2, a1 - Math.PI / 2);
      g.arc(cx, cy, Math.max(0, rIn), a1 - Math.PI / 2, a0 - Math.PI / 2, true);
      g.closePath();
    }
    function rr(x: number, y: number, w: number, h: number, r: number) {
      g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }
    const sliceColor = (r: Ring, i: number, n: FeelingNode) => {
      const f = FEELING_FAMILY[n.core];
      if (!r.parent) return f[0];
      return r.items.length % 2 ? f[i % 3] : f[i % 2];
    };
    function drawRing(r: Ring, isOuter: boolean) {
      const rIn = r.a, rOut = r.b;
      if (rOut - rIn < 3 || r.alpha < 0.02) return;
      const n = r.items.length, st = TAU / n, half = st / 2, thick = rOut - rIn;
      g.save(); g.globalAlpha = r.alpha;
      for (let i = 0; i < n; i++) {
        const th = r.rot + i * st;
        if (Math.cos(th) < -Math.cos(half) - 0.05) continue;
        const node = r.items[i], col = sliceColor(r, i, node);
        wedgePath(rIn, rOut, th - half, th + half);
        g.fillStyle = col; g.fill();
        g.save(); g.clip(); g.translate(cx, cy); g.rotate(th);
        const im = img(node.w), Bw = 2 * rOut * Math.sin(half), Bh = rOut - rIn * Math.cos(half), D = Math.max(Bw, Bh);
        if (im.complete && im.naturalWidth) g.drawImage(im, -Bw / 2 + (Bw - D) / 2, -rOut + (Bh - D) / 2, D, D);
        const grd = g.createLinearGradient(0, -rOut, 0, -rOut + thick * 0.4);
        grd.addColorStop(0, hexA(col, 0.6)); grd.addColorStop(1, hexA(col, 0));
        g.fillStyle = grd; g.fillRect(-Bw, -rOut - 2, Bw * 2, thick * 0.45);
        g.restore();
      }
      g.strokeStyle = '#ffffff'; g.lineWidth = Math.max(2.5, R * 0.008); g.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const an = r.rot + i * st - half - Math.PI / 2;
        g.beginPath(); g.moveTo(cx + Math.cos(an) * rIn, cy + Math.sin(an) * rIn); g.lineTo(cx + Math.cos(an) * rOut, cy + Math.sin(an) * rOut); g.stroke();
      }
      g.beginPath(); g.arc(cx, cy, rOut, 0, TAU); g.lineWidth = 3; g.stroke();
      // the slice under the pointer on an inner ring stays outlined: it is the path so far
      if (!isOuter || r.phase === 'idle') {
        const k = atPointer(r), th = r.rot + k * st;
        if (Math.abs(norm(th)) < half * 0.5) {
          wedgePath(rIn + 2, rOut - 2, th - half + 0.01, th + half - 0.01);
          g.lineWidth = Math.max(4, R * 0.012); g.strokeStyle = 'rgba(255,255,255,.95)'; g.stroke();
        }
      }
      // word tags in the word's zone color
      const fs = Math.max(11, Math.min(22, thick * 0.15, R * 0.045)), th2 = fs * 1.7;
      g.font = `900 ${fs}px Nunito, ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const th = r.rot + i * st;
        if (Math.cos(th) < -0.15) continue;
        const node = r.items[i], tr = rOut - th2 * 0.85;
        g.save(); g.translate(cx, cy); g.rotate(th); g.translate(0, -tr);
        const maxW = 2 * tr * Math.sin(half) * 0.9, tw = Math.min(g.measureText(node.w).width + fs * 1.2, maxW);
        g.shadowColor = 'rgba(30,20,50,.35)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
        rr(-tw / 2, -th2 / 2, tw, th2, th2 * 0.32); g.fillStyle = SEL_ZONE_COLORS[node.zone]; g.fill();
        g.shadowColor = 'transparent';
        g.fillStyle = ZONE_INK[node.zone]; g.fillText(node.w, 0, 1, tw - fs * 0.5);
        g.restore();
      }
      // pegs at the slice edges
      const pr = Math.max(3.5, Math.min(R * 0.016, thick * 0.05));
      for (let i = 0; i < n; i++) {
        const an = r.rot + i * st - half - Math.PI / 2, rr2 = rOut - pr * 1.9;
        const x = cx + Math.cos(an) * rr2, y = cy + Math.sin(an) * rr2;
        if (y > H + 8) continue;
        g.beginPath(); g.arc(x, y, pr, 0, TAU); g.fillStyle = '#ffffff'; g.shadowColor = 'rgba(0,0,0,.3)'; g.shadowBlur = 4; g.fill(); g.shadowBlur = 0;
      }
      g.restore();
    }
    function star(x: number, y: number, r: number) {
      g.beginPath();
      for (let k = 0; k < 10; k++) { const q2 = k % 2 ? r * 0.45 : r, an = -Math.PI / 2 + k * Math.PI / 5; g.lineTo(x + Math.cos(an) * q2, y + Math.sin(an) * q2); }
      g.closePath();
    }
    let flap = 0;
    function draw(t: number) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      g.save(); g.shadowColor = 'rgba(60,40,110,.28)'; g.shadowBlur = 30; g.shadowOffsetY = -4;
      g.beginPath(); g.arc(cx, cy, R + rimW, 0, TAU); g.fillStyle = '#f6be2c'; g.fill(); g.restore();
      g.beginPath(); g.arc(cx, cy, R + rimW, 0, TAU); g.lineWidth = 3; g.strokeStyle = '#d99a12'; g.stroke();
      g.beginPath(); g.arc(cx, cy, R + 1.5, 0, TAU); g.lineWidth = 4; g.strokeStyle = '#c7880c'; g.stroke();
      const spinning = rings.some((r) => r.phase === 'drag' || Math.abs(r.vel) > 0.4), chase = Math.floor(t * 14), nb = 30;
      for (let j = 0; j < nb; j++) {
        const an = j * TAU / nb - Math.PI / 2, x = cx + Math.cos(an) * (R + rimW / 2), y = cy + Math.sin(an) * (R + rimW / 2);
        if (y > H + 10) continue;
        const lit = spinning ? (j + chase) % 3 === 0 : 0.5 + 0.5 * Math.sin(t * 2 + j * 0.6) > 0.25;
        g.beginPath(); g.arc(x, y, rimW * 0.27, 0, TAU); g.fillStyle = lit ? '#fffbe6' : '#f0cf6a';
        if (lit) { g.shadowColor = '#fff3b0'; g.shadowBlur = 10; }
        g.fill(); g.shadowBlur = 0;
      }
      const o = outer();
      rings.forEach((r) => drawRing(r, r === o));
      g.beginPath(); g.arc(cx, cy, h0, 0, TAU); g.fillStyle = '#f6be2c'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#d99a12'; g.stroke();
      g.beginPath(); g.arc(cx, cy, h0 * 0.72, 0, TAU); g.fillStyle = '#ffe58a'; g.fill();
      star(cx, cy - h0 * 0.36, h0 * 0.3); g.fillStyle = '#f6be2c'; g.fill();
      const pTop = cy - R - rimW - R * 0.06, tipY = cy - R + R * 0.07, pw = R * 0.07, piv = pTop + pw * 0.6;
      g.save(); g.translate(cx, piv); g.rotate(flap); g.translate(-cx, -piv);
      g.beginPath(); g.moveTo(cx - pw, piv); g.quadraticCurveTo(cx, pTop - pw * 0.7, cx + pw, piv); g.lineTo(cx, tipY); g.closePath();
      g.fillStyle = '#2a2147'; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 8; g.shadowOffsetY = 3; g.fill();
      g.shadowColor = 'transparent'; g.lineWidth = 3; g.strokeStyle = '#ffffff'; g.stroke();
      g.beginPath(); g.arc(cx, pTop + pw * 0.55, pw * 0.32, 0, TAU); g.fillStyle = '#f6be2c'; g.fill();
      g.restore();
    }

    // ---------- card: the slice opens into a square ----------
    let cardNode: FeelingNode | null = null, cardTimer = 0, countTimer = 0, morphHide = 0, openTimer = 0, clipTimer = 0;
    const poly = (pts: [number, number][]) => 'polygon(' + pts.map((p) => `${p[0].toFixed(2)}% ${p[1].toFixed(2)}%`).join(',') + ')';
    function sliceBox(r: Ring) {
      const half = stepOf(r) / 2, rIn = r.a, rOut = r.b, Bw = 2 * rOut * Math.sin(half), Bh = rOut - rIn * Math.cos(half), N = 12;
      const pts: [number, number][] = [];
      for (let j = 0; j < N; j++) { const th = -half + (2 * half * j) / (N - 1); pts.push([(rOut * Math.sin(th) + Bw / 2) / Bw * 100, (rOut - rOut * Math.cos(th)) / Bh * 100]); }
      for (let j = 0; j < N; j++) { const th = half - (2 * half * j) / (N - 1); pts.push([(rIn * Math.sin(th) + Bw / 2) / Bw * 100, (rOut - rIn * Math.cos(th)) / Bh * 100]); }
      return { left: cx - Bw / 2, top: cy - rOut, width: Bw, height: Bh, clip: poly(pts) };
    }
    const square = (() => { const pts: [number, number][] = []; for (let j = 0; j < 12; j++) pts.push([j / 11 * 100, 0]); for (let j = 0; j < 12; j++) pts.push([100 - j / 11 * 100, 100]); return poly(pts); })();
    const place = (b: { left: number; top: number; width: number; height: number }) => {
      morph.style.left = `${b.left}px`; morph.style.top = `${b.top}px`; morph.style.width = `${b.width}px`; morph.style.height = `${b.height}px`;
    };
    function layoutCard() {
      const box = root.getBoundingClientRect(), hb = top.getBoundingClientRect().bottom - box.top, wide = W > H * 1.05 && W > 700;
      card.classList.toggle('col', !wide);
      let s: number;
      if (wide) { s = Math.max(170, Math.min(320, H - hb - 70)); card.style.width = `${s + 36 + 20 + Math.min(330, W * 0.34)}px`; }
      else { s = Math.max(150, Math.min(300, W - 72, (H - hb) * 0.36)); card.style.width = `${Math.min(W - 32, Math.max(s + 36, 340))}px`; }
      slot.style.width = slot.style.height = `${s}px`;
      card.style.left = `${Math.max(16, (W - card.getBoundingClientRect().width) / 2)}px`;
      card.style.top = `${hb + 10}px`;
    }
    function drawMini(kids: FeelingNode[]) {
      const m = mini.getContext('2d')!, s = mini.width, rad = s / 2 - 3, st = TAU / Math.max(1, kids.length);
      m.clearRect(0, 0, s, s);
      kids.forEach((k, i) => {
        const a0 = -Math.PI / 2 + i * st - st / 2, a1 = a0 + st, mid = (a0 + a1) / 2;
        m.save(); m.beginPath(); m.moveTo(s / 2, s / 2); m.arc(s / 2, s / 2, rad, a0, a1); m.closePath();
        m.fillStyle = FEELING_FAMILY[k.core][i % 2]; m.fill(); m.clip();
        const im = img(k.w), D = rad * 1.25;
        if (im.complete && im.naturalWidth) m.drawImage(im, s / 2 + Math.cos(mid) * rad * 0.5 - D / 2, s / 2 + Math.sin(mid) * rad * 0.5 - D / 2, D, D);
        else im.addEventListener('load', () => drawMini(kids), { once: true });
        m.restore();
        m.beginPath(); m.moveTo(s / 2, s / 2); m.arc(s / 2, s / 2, rad, a0, a1); m.closePath(); m.lineWidth = 3; m.strokeStyle = '#fff'; m.stroke();
      });
    }
    function openCard(r: Ring) {
      const node = selected(r); if (!node) return;
      cardNode = node; snd.notify();
      const canGrow = node.kids.length > 0 && node !== r.parent && live().length < 3;
      cWord.textContent = node.w;
      const fp = feelingPath(node); cPath.textContent = fp.length > 1 ? fp.join('  >  ') : 'One of the seven main feelings';
      cZone.textContent = `${SEL_ZONE_LABELS[node.zone]} Zone`;
      cZone.style.background = SEL_ZONE_COLORS[node.zone]; cZone.style.color = ZONE_INK[node.zone];
      more.hidden = !canGrow;
      note.textContent = canGrow ? 'Stay here and more feelings open in 5 seconds.' : 'Or spin the wheel to look at other feelings.';
      if (canGrow) drawMini(node.kids);
      card.classList.remove('show'); card.classList.add('measure');
      layoutCard();
      const sb = slot.getBoundingClientRect(), rb = root.getBoundingClientRect();
      const B = sliceBox(r), i = atPointer(r);
      window.clearTimeout(morphHide); window.clearTimeout(openTimer); window.clearTimeout(clipTimer);
      morph.classList.remove('anim');
      morph.style.backgroundImage = `url("${feelingImg(node.w)}")`;
      morph.style.backgroundColor = sliceColor(r, i, node);
      morph.style.opacity = '1'; morph.style.display = 'block';
      place(B); morph.style.clipPath = B.clip;
      void morph.offsetWidth;
      morph.classList.add('anim');
      place({ left: sb.left - rb.left, top: sb.top - rb.top, width: sb.width, height: sb.height }); morph.style.clipPath = square;
      cv.classList.add('dim');
      openTimer = window.setTimeout(() => { if (cardNode !== node) return; card.classList.remove('measure'); card.classList.add('show'); speak(node.w); }, reduce ? 0 : 380);
      clipTimer = window.setTimeout(() => { if (cardNode === node) { morph.classList.remove('anim'); morph.style.clipPath = 'inset(0 round 20px)'; } }, reduce ? 10 : 600);
      if (canGrow) {
        more.classList.remove('counting'); void more.offsetWidth; more.classList.add('counting');
        let left = 5;
        window.clearInterval(countTimer);
        countTimer = window.setInterval(() => {
          left--; if (cardNode !== node) { window.clearInterval(countTimer); return; }
          if (left > 0) note.textContent = `Stay here and more feelings open in ${left} second${left === 1 ? '' : 's'}.`;
        }, 1000);
        window.clearTimeout(cardTimer);
        cardTimer = window.setTimeout(() => { if (cardNode === node) grow(node); }, 5000);
      }
    }
    function closeCard(fast: boolean) {
      window.clearTimeout(cardTimer); window.clearInterval(countTimer); window.clearTimeout(openTimer); window.clearTimeout(clipTimer);
      more.classList.remove('counting');
      if (!cardNode) return;
      cardNode = null; card.classList.remove('show'); cv.classList.remove('dim');
      const o = outer();
      if (fast || reduce || !o) { morph.style.display = 'none'; return; }
      const B = sliceBox(o);
      morph.classList.remove('anim'); morph.style.clipPath = square; void morph.offsetWidth;
      morph.classList.add('anim'); place(B); morph.style.clipPath = B.clip;
      morphHide = window.setTimeout(() => { morph.style.display = 'none'; }, 560);
    }
    function grow(node: FeelingNode) {
      closeCard(true);
      snd.ring();
      addRing(node);
      speak(`What kind of ${node.w.toLowerCase()}? Spin the new ring.`);
    }
    function setHint() {
      const l = live(), last = outer()?.parent ?? null;
      hint.textContent = last
        ? `You picked ${last.w}. Spin the outside ring to find the feeling that fits you best.`
        : 'Spin the wheel. Stop on the feeling that fits you.';
      back.hidden = l.length < 2;
    }

    // ---------- motion ----------
    let raf = 0, last = 0;
    function frame(ts: number) {
      const t = ts / 1000, dt = Math.min(0.05, last ? t - last : 0.016); last = t;
      const k = reduce ? 1 : 1 - Math.exp(-9 * dt);
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.a += (r.ta - r.a) * k; r.b += (r.tb - r.b) * k;
        r.alpha += ((r.dying ? 0 : 1) - r.alpha) * (reduce ? 1 : 1 - Math.exp(-7 * dt));
        if (r.dying && r.alpha < 0.03) { rings.splice(i, 1); continue; }
        const st = stepOf(r);
        if (r.phase === 'spin') {
          r.rot += r.vel * dt; r.vel *= Math.exp(-1.25 * dt);
          if (Math.abs(r.vel) < 0.55) { r.phase = 'snap'; r.target = -Math.round(-r.rot / st) * st; }
        } else if (r.phase === 'snap') {
          const d = r.target - r.rot; r.rot += d * (1 - Math.exp(-9 * dt));
          if (Math.abs(d) < 0.0015) { r.rot = r.target; r.phase = 'idle'; r.vel = 0; setHint(); if (r === outer()) openCard(r); }
        }
        const ti = Math.round(-r.rot / st);
        if (ti !== r.tick && !r.dying) { snd.tick(); flap = Math.max(-0.5, Math.min(0.5, flap + (ti > r.tick ? 0.38 : -0.38))); r.tick = ti; }
      }
      flap *= Math.exp(-11 * dt);
      draw(t);
      raf = requestAnimationFrame(frame);
    }

    // ---------- input ----------
    let drag: { ring: Ring; a: number; t0: number; moved: number; hist: { t: number; r: number }[] } | null = null;
    const angAt = (x: number, y: number) => Math.atan2(x - cx, -(y - cy));
    const local = (e: PointerEvent) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    function down(e: PointerEvent) {
      const { x, y } = local(e), dist = Math.hypot(x - cx, y - cy);
      ac();
      if (dist > R + rimW + 10) { if (cardNode) closeCard(false); return; }
      const l = live();
      if (!l.length || dist < h0) return;
      let k = l.findIndex((r) => dist >= r.a && dist <= r.b);
      if (k < 0) k = l.length - 1;
      if (cardNode) closeCard(true);
      if (k < l.length - 1) dropOutside(k);
      const ring = l[k];
      cv.setPointerCapture(e.pointerId);
      drag = { ring, a: angAt(x, y), t0: performance.now(), moved: 0, hist: [{ t: performance.now(), r: ring.rot }] };
      ring.phase = 'drag'; ring.vel = 0;
    }
    function move(e: PointerEvent) {
      if (!drag) return;
      const { x, y } = local(e), a = angAt(x, y), d = norm(a - drag.a);
      drag.ring.rot += d; drag.a = a; drag.moved += Math.abs(d) * Math.hypot(x - cx, y - cy);
      const now = performance.now(); drag.hist.push({ t: now, r: drag.ring.rot });
      while (drag.hist.length > 2 && now - drag.hist[0].t > 110) drag.hist.shift();
    }
    function up(e: PointerEvent) {
      if (!drag) return;
      const { x, y } = local(e), r = drag.ring, now = performance.now(), st = stepOf(r);
      if (drag.moved < 10 && now - drag.t0 < 450) {
        const i = Math.round(norm(angAt(x, y) - r.rot) / st);
        r.target = r.rot + norm(-(r.rot + i * st)); r.phase = 'snap';
      } else {
        const h = drag.hist, f = h[0], l = h[h.length - 1], dt = (l.t - f.t) / 1000;
        r.vel = dt > 0.008 && now - l.t < 90 ? Math.max(-22, Math.min(22, (l.r - f.r) / dt)) : 0;
        r.phase = 'spin';
      }
      drag = null;
    }
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

    more.onclick = () => { if (cardNode) grow(cardNode); };
    q<HTMLButtonElement>('.fw-pick').onclick = () => { const n = cardNode; if (!n) return; snd.choose(); closeCard(true); chooseRef.current(n); };
    q<HTMLButtonElement>('.fw-say').onclick = () => { if (cardNode) speak(cardNode.w); };
    q<HTMLButtonElement>('.fw-listen').onclick = () => { ac(); speak(`${q<HTMLElement>('.fw-q').textContent} ${hint.textContent}`); };
    back.onclick = () => { closeCard(true); const l = live(); if (l.length > 1) dropOutside(l.length - 2); };
    const onResize = () => { closeCard(true); layout(); };
    window.addEventListener('resize', onResize);

    layout();
    addRing(null, true);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      [cardTimer, morphHide, openTimer, clipTimer].forEach((id) => window.clearTimeout(id));
      window.clearInterval(countTimer);
    };
  }, []);

  return (
    <div className="fw-root" ref={rootRef}>
      <canvas className="fw-canvas" aria-label="Feelings wheel. Drag a ring to spin it." />
      <header className="fw-top">
        <div className="fw-greet">
          <p className="fw-hi">Hi {studentName}!</p>
          <h1 className="fw-q">How are you feeling right now?</h1>
          <p className="fw-hint">Spin the wheel. Stop on the feeling that fits you.</p>
          <button type="button" className="fw-btn fw-back" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>Back
          </button>
        </div>
        <button type="button" className="fw-btn fw-listen" aria-label="Listen">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /><path d="M19 6a8.5 8.5 0 0 1 0 12" /></svg>
        </button>
      </header>
      <div className="fw-morph" />
      <section className="fw-card" aria-live="polite">
        <div className="fw-slot" />
        <div className="fw-info">
          <h2><span className="fw-word" /><button type="button" className="fw-say" aria-label="Listen">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>
          </button></h2>
          <p className="fw-path" />
          <span className="fw-zone" />
          <button type="button" className="fw-cta fw-pick">This is how I feel</button>
          <button type="button" className="fw-cta fw-more"><canvas className="fw-mini" width={116} height={116} /><span>See more like this</span><span className="fw-fill" /></button>
          <p className="fw-note" />
        </div>
      </section>
    </div>
  );
}
