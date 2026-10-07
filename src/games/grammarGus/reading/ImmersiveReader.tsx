import { useEffect, useMemo, useRef, useState } from 'react';
import '@fontsource/opendyslexic/400.css';
import '@fontsource/opendyslexic/700.css';
import { loadContent, type GusArticle, type ReadBlock, type ReadImage } from './library';

// The immersive reader for Gus's Read and Respond (teacher 2026-10-07):
// - "Male british voice - an actually good narration voice so the kids
//   will want to listen", with speed (.5, .75, 1x, 1.25, 1.5), pause/play,
//   rewind 10 seconds, forward 10 seconds and general audio settings.
// - "Visual highlight of each word being said at pace with narrator."
// - "Open dyslexic font, wide text spacing, required double space between
//   each word. no breaking text in two lines. double space each line,
//   triple space between paragraphs. bold all headings."
// - "new heading sound effect, then text reads heading title. sound effect
//   at every new bullet point (don't otherwise announce bullet points).
//   sparkly completion sound at the end of the audio."
// - "the background music/sound effects can be turned off if wanting".
// - "the gallery view should live collapsed closed at the bottom of the
//   immersive reader. it can be opened and navigated in full screen view,
//   or closed to return back to the immersive reader."
// The voice is the device's own text to speech: the best British male
// voice it has (iPads have Daniel and Arthur; "Enhanced" ones are best).

// ---- sounds --------------------------------------------------------------------
let actx: AudioContext | null = null;
const ac = () => (actx = actx ?? new AudioContext());
function note(freq: number, dur: number, vol = 0.06, type: OscillatorType = 'sine', delay = 0, attack = 0.01, out?: AudioNode) {
  try {
    const c = ac(); const t0 = c.currentTime + delay;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out ?? c.destination); o.start(t0); o.stop(t0 + dur + 0.05);
  } catch { /* no sound on this device */ }
}
const SFX = {
  heading: () => { note(523, 0.22, 0.06, 'triangle'); note(659, 0.22, 0.05, 'triangle', 0.1); note(784, 0.4, 0.06, 'triangle', 0.2); },
  bullet: () => { note(988, 0.1, 0.045); note(1319, 0.14, 0.035, 'sine', 0.05); },
  sparkle: () => [1047, 1319, 1568, 2093, 2637, 3136, 2637, 3520].forEach((f, i) => note(f, 0.5, 0.04, 'sine', i * 0.07)),
  tap: () => note(660, 0.06, 0.03),
};
// Soft background music: slow warm chords, very quiet.
const CHORDS = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 392]];
class Ambient {
  private bus: GainNode | null = null; private timer = 0; private step = 0;
  start(vol: number) {
    if (this.timer) return;
    try { const c = ac(); this.bus = c.createGain(); this.bus.gain.value = vol; this.bus.connect(c.destination); } catch { return; }
    const play = () => { const ch = CHORDS[this.step++ % CHORDS.length]; ch.forEach((f, i) => note(f, 4.2, 0.05, 'sine', i * 0.04, 1.2, this.bus!)); note(ch[3] * 2, 1.6, 0.018, 'triangle', 2, 0.02, this.bus!); };
    play(); this.timer = window.setInterval(play, 3600);
  }
  setVol(v: number) { if (this.bus) this.bus.gain.value = v; }
  stop() { window.clearInterval(this.timer); this.timer = 0; try { this.bus?.disconnect(); } catch { /* fine */ } this.bus = null; }
}

// ---- voices ----------------------------------------------------------------------
function voiceScore(v: SpeechSynthesisVoice): number {
  const n = v.name.toLowerCase();
  if (!/^en/i.test(v.lang)) return -99;
  if (/bells|bubbles|whisper|zarvox|trinoids|albert|bad news|good news|jester|organ|cellos|boing|superstar|wobble|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|junior|ralph|kathy|fred/.test(n)) return -50;
  let s = 0;
  if (/en[-_]gb/i.test(v.lang)) s += 6;
  if (/daniel|arthur|oliver|george|ryan|thomas|harry|william|jamie|uk english male|british.*male/.test(n)) s += 6;
  if (/enhanced|premium|natural|neural|online/.test(n)) s += 3;
  if (/female|serena|kate|martha|libby|sonia|stephanie|susan|fiona|moira|tessa|karen|samantha|victoria|hazel|maisie|emily|ava|allison|zoe|nicky/.test(n)) s -= 8;
  return s;
}
const englishVoices = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis.getVoices() : []).filter((v) => voiceScore(v) > -50).sort((a, b) => voiceScore(b) - voiceScore(a));

interface Settings { voice: string; voiceVol: number; music: boolean; musicVol: number; sfx: boolean; size: number }
const DEFAULTS: Settings = { voice: '', voiceVol: 1, music: true, musicVol: 0.5, sfx: true, size: 1 };
const SKEY = 'gus-reader-settings';
const loadSettings = (): Settings => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SKEY) ?? '{}') }; } catch { return DEFAULTS; } };
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5];
const SIZES = ['1.15rem', '1.35rem', '1.6rem'];
const WPS = 2.6; // words a second at 1x, for the 10 second jumps and the highlight when a voice gives no word timing

interface Word { b: number; text: string; chunkEnd: number }

export default function ImmersiveReader({ article, onClose, onAnswer, calm = false }: {
  article: GusArticle; onClose: () => void; onAnswer?: () => void; calm?: boolean;
}) {
  const [content, setContent] = useState<{ blocks: ReadBlock[]; images: ReadImage[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { let live = true; setError(''); loadContent(article).then((c) => live && setContent(c)).catch((e: Error) => live && setError(e.message)); return () => { live = false; }; }, [article]);

  const [st, setSt] = useState<Settings>(loadSettings);
  useEffect(() => { try { localStorage.setItem(SKEY, JSON.stringify(st)); } catch { /* fine */ } }, [st]);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(englishVoices);
  useEffect(() => {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined; if (!synth) return;
    const up = () => setVoices(englishVoices());
    synth.addEventListener?.('voiceschanged', up); up();
    return () => synth.removeEventListener?.('voiceschanged', up);
  }, []);
  const voice = voices.find((v) => v.name === st.voice) ?? voices[0] ?? null;

  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState(false);
  const [cur, setCur] = useState(-1);
  const [panel, setPanel] = useState<'none' | 'settings' | 'gallery'>('none');
  const [pic, setPic] = useState(0);

  // Every word, with the end of the sentence it is in (spoken one sentence at a time).
  const { words, blockStart } = useMemo(() => {
    const ws: Word[] = []; const starts: number[] = [];
    (content?.blocks ?? []).forEach((bl, b) => {
      starts.push(ws.length);
      const parts = bl.text.split(/\s+/).filter(Boolean);
      const first = ws.length;
      parts.forEach((t) => ws.push({ b, text: t, chunkEnd: 0 }));
      let s = first;
      for (let i = first; i < ws.length; i++) if (/[.!?]["')\]]?$/.test(ws[i].text) || i - s >= 28 || i === ws.length - 1) { for (let k = s; k <= i; k++) ws[k].chunkEnd = i + 1; s = i + 1; }
    });
    return { words: ws, blockStart: starts };
  }, [content]);

  const run = useRef(0);
  const curRef = useRef(-1); curRef.current = cur;
  const timers = useRef<number[]>([]);
  const ambient = useRef(new Ambient());
  const stRef = useRef(st); stRef.current = st;
  const clearTimers = () => { timers.current.forEach((t) => { window.clearTimeout(t); window.clearInterval(t); }); timers.current = []; };
  const synth = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined);

  const finish = () => {
    run.current++; clearTimers(); setPlaying(false); setDone(true); setCur(-1);
    if (stRef.current.sfx) SFX.sparkle();
    timers.current.push(window.setTimeout(() => ambient.current.stop(), 2500));
  };
  const speakFrom = (gi: number, rate = speed) => {
    const id = ++run.current; clearTimers(); synth()?.cancel();
    if (gi >= words.length) { finish(); return; }
    const w = words[gi]; const end = w.chunkEnd;
    const blockFirst = gi === blockStart[w.b];
    const kind = content!.blocks[w.b].kind;
    setCur(gi);
    let lead = 0;
    if (blockFirst && kind !== 'p' && stRef.current.sfx) { if (kind === 'h') { SFX.heading(); lead = 650; } else { SFX.bullet(); lead = 260; } }
    timers.current.push(window.setTimeout(() => {
      if (id !== run.current) return;
      const sy = synth();
      const parts = words.slice(gi, end).map((x) => x.text);
      const offs: number[] = []; let text = '';
      parts.forEach((p, i) => { if (i) text += ' '; offs.push(text.length); text += p; });
      if (!sy) { // no voice at all: still walk the highlight along
        const t0 = performance.now();
        timers.current.push(window.setInterval(() => { const k = Math.floor(((performance.now() - t0) / 1000) * WPS * rate); if (k >= parts.length) { clearTimers(); speakFrom(end, rate); } else setCur(gi + k); }, 120));
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = 'en-GB';
      u.rate = 0.92 * rate; u.pitch = 0.95; u.volume = stRef.current.voiceVol;
      let timed = false; const t0 = performance.now();
      u.onstart = () => { /* timing starts */ };
      u.onboundary = (e) => {
        if (id !== run.current || (e.name && e.name !== 'word')) return;
        timed = true;
        let k = 0; while (k + 1 < offs.length && offs[k + 1] <= e.charIndex) k++;
        setCur(gi + k);
      };
      // Some voices never say where they are: estimate from the clock.
      timers.current.push(window.setInterval(() => {
        if (id !== run.current || timed) return;
        const el = performance.now() - t0; if (el < 350) return;
        setCur(gi + Math.min(parts.length - 1, Math.floor(((el - 250) / 1000) * WPS * rate)));
      }, 110));
      u.onend = () => {
        if (id !== run.current) return;
        clearTimers();
        const next = end;
        const pause = next < words.length && words[next].b !== w.b ? 420 : 120;
        timers.current.push(window.setTimeout(() => { if (id === run.current) speakFrom(next, rate); }, pause));
      };
      u.onerror = (e) => { if (id === run.current && e.error !== 'interrupted' && e.error !== 'canceled') { setPlaying(false); run.current++; clearTimers(); } };
      sy.speak(u);
    }, lead));
  };
  const play = () => {
    if (!content) return;
    setPlaying(true); setDone(false);
    if (stRef.current.music) ambient.current.start(stRef.current.musicVol * 0.6);
    speakFrom(cur >= 0 && cur < words.length ? cur : 0);
  };
  const pause = () => { run.current++; clearTimers(); synth()?.cancel(); setPlaying(false); };
  const jump = (sec: number) => {
    if (!words.length) return;
    const from = cur >= 0 ? cur : 0;
    const to = Math.max(0, Math.min(words.length - 1, from + Math.round(sec * WPS * speed)));
    if (stRef.current.sfx) SFX.tap();
    if (playing) speakFrom(to); else setCur(to);
  };
  const changeSpeed = (s: number) => { setSpeed(s); if (playing) speakFrom(Math.max(0, curRef.current), s); };
  const tapWord = (i: number) => { setDone(false); if (playing) speakFrom(i); else { setCur(i); setPlaying(true); if (stRef.current.music) ambient.current.start(stRef.current.musicVol * 0.6); speakFrom(i); } };
  useEffect(() => () => { run.current++; clearTimers(); synth()?.cancel(); ambient.current.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (st.music && playing) ambient.current.start(st.musicVol * 0.6); else ambient.current.stop(); ambient.current.setVol(st.musicVol * 0.6); }, [st.music, st.musicVol]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the word being read in view.
  const textRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (cur < 0 || !textRef.current) return;
    const el = textRef.current.querySelector<HTMLElement>(`[data-w="${cur}"]`); if (!el) return;
    const box = textRef.current.getBoundingClientRect(); const r = el.getBoundingClientRect();
    if (r.top < box.top + box.height * 0.2 || r.bottom > box.top + box.height * 0.7) el.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
  }, [cur, calm]);

  const images = content?.images ?? [];
  return (
    <div className={`rdr${calm ? ' calm' : ''}`} role="dialog" aria-modal="true" aria-label={`Reading: ${article.title}`} style={{ ['--rdr-size' as string]: SIZES[st.size] ?? SIZES[1] }}>
      <header className="rdr-top">
        <button type="button" className="rdr-btn" onClick={() => { pause(); onClose(); }}>✕ Close</button>
        <h1>{article.title}</h1>
        <button type="button" className={`rdr-btn${panel === 'settings' ? ' on' : ''}`} onClick={() => setPanel((p) => (p === 'settings' ? 'none' : 'settings'))} aria-expanded={panel === 'settings'}>⚙️ Sound</button>
      </header>
      <div className="rdr-controls" role="group" aria-label="Narrator controls">
        <button type="button" className="rdr-btn" onClick={() => jump(-10)} aria-label="Back 10 seconds">⏪ 10</button>
        {playing
          ? <button type="button" className="rdr-btn rdr-play" onClick={pause}>⏸ Pause</button>
          : <button type="button" className="rdr-btn rdr-play" onClick={play} disabled={!content}>▶ {done ? 'Read again' : cur > 0 ? 'Keep reading' : 'Read to me'}</button>}
        <button type="button" className="rdr-btn" onClick={() => jump(10)} aria-label="Forward 10 seconds">10 ⏩</button>
        <div className="rdr-speeds" role="group" aria-label="Reading speed">
          {SPEEDS.map((s) => <button key={s} type="button" className={`rdr-chip${speed === s ? ' on' : ''}`} onClick={() => changeSpeed(s)} aria-pressed={speed === s}>{s}x</button>)}
        </div>
      </div>

      <div className="rdr-page" ref={textRef}>
        {!content && !error && <p className="rdr-note">Gus is fetching the article...</p>}
        {error && <p className="rdr-note">{error} Check the internet connection and try again.</p>}
        {content && <article className="rdr-text">
          {content.blocks.map((bl, b) => {
            const from = blockStart[b]; const to = b + 1 < blockStart.length ? blockStart[b + 1] : words.length;
            const ws = [];
            for (let i = from; i < to; i++) {
              if (i > from) ws.push('  ');
              ws.push(<span key={i} data-w={i} className={`rdr-w${i === cur ? ' on' : ''}`} onClick={() => tapWord(i)}>{words[i].text}</span>);
            }
            return bl.kind === 'h' ? <h2 key={b}>{ws}</h2> : bl.kind === 'li' ? <p key={b} className="rdr-li"><span className="rdr-dot" aria-hidden>●</span><span>{ws}</span></p> : <p key={b}>{ws}</p>;
          })}
          {done && <p className="rdr-done">🎉 You listened to the whole article!</p>}
        </article>}
      </div>

      <footer className="rdr-foot">
        <button type="button" className="rdr-gallery-bar" onClick={() => { setPanel('gallery'); if (stRef.current.sfx) SFX.tap(); }} disabled={!images.length} aria-label={`Open the picture gallery: ${images.length} pictures`}>
          <span className="rdr-thumbs" aria-hidden>{images.slice(0, 4).map((im) => <img key={im.src} src={im.src} alt="" referrerPolicy="no-referrer" />)}</span>
          <span>🖼️ Pictures ({images.length}) ▲</span>
        </button>
        {onAnswer && <button type="button" className={`rdr-answer${done ? ' ready' : ''}`} onClick={() => { pause(); onAnswer(); }}>✍️ Answer it: {article.question}</button>}
      </footer>

      {panel === 'settings' && (
        <div className="rdr-settings" role="dialog" aria-label="Sound and voice">
          <strong>🔊 Sound and voice</strong>
          <label className="rdr-field">Narrator voice
            <select value={voice?.name ?? ''} onChange={(e) => setSt((s) => ({ ...s, voice: e.target.value }))}>
              {voices.length === 0 && <option value="">This device's voice</option>}
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}
            </select>
          </label>
          <label className="rdr-field">Voice volume<input type="range" min={0.2} max={1} step={0.1} value={st.voiceVol} onChange={(e) => setSt((s) => ({ ...s, voiceVol: Number(e.target.value) }))} /></label>
          <button type="button" className={`rdr-toggle${st.music ? ' on' : ''}`} onClick={() => setSt((s) => ({ ...s, music: !s.music }))} aria-pressed={st.music}>🎵 Background music: {st.music ? 'on' : 'off'}</button>
          {st.music && <label className="rdr-field">Music volume<input type="range" min={0.1} max={1} step={0.1} value={st.musicVol} onChange={(e) => setSt((s) => ({ ...s, musicVol: Number(e.target.value) }))} /></label>}
          <button type="button" className={`rdr-toggle${st.sfx ? ' on' : ''}`} onClick={() => setSt((s) => ({ ...s, sfx: !s.sfx }))} aria-pressed={st.sfx}>✨ Sound effects: {st.sfx ? 'on' : 'off'}</button>
          <div className="rdr-field">Text size
            <div className="rdr-speeds">{['A', 'A', 'A'].map((l, i) => <button key={i} type="button" className={`rdr-chip${st.size === i ? ' on' : ''}`} style={{ fontSize: `${0.8 + i * 0.25}rem` }} onClick={() => setSt((s) => ({ ...s, size: i }))} aria-pressed={st.size === i} aria-label={['Small text', 'Medium text', 'Big text'][i]}>{l}</button>)}</div>
          </div>
          <small>Tip: on an iPad, Settings, Accessibility, Spoken Content, Voices, English (UK) lets you download Daniel (Enhanced) or Arthur (Enhanced) for the clearest voice.</small>
          <button type="button" className="rdr-btn" onClick={() => setPanel('none')}>Done</button>
        </div>
      )}

      {panel === 'gallery' && images.length > 0 && <Gallery articleId={article.id} images={images} at={pic} setAt={setPic} onClose={() => setPanel('none')} sfx={st.sfx} />}
    </div>
  );
}

// ---- the picture gallery -------------------------------------------------------------
type Stroke = { c: string; pts: number[] };
const INKS = ['#e8423f', '#2f7fe0', '#1f9d55', '#1f2b3d'];
function Gallery({ articleId, images, at, setAt, onClose, sfx }: { articleId: string; images: ReadImage[]; at: number; setAt: (n: number) => void; onClose: () => void; sfx: boolean }) {
  const im = images[Math.min(at, images.length - 1)];
  const [zoom, setZoom] = useState(false);
  const [draw, setDraw] = useState(false);
  const [ink, setInk] = useState(INKS[0]);
  const key = `gus-ann-${articleId}-${im.src}`;
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  useEffect(() => { try { setStrokes(JSON.parse(localStorage.getItem(key) ?? '[]')); } catch { setStrokes([]); } setZoom(false); }, [key]);
  const save = (s: Stroke[]) => { setStrokes(s); try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* fine */ } };
  const svgRef = useRef<SVGSVGElement>(null);
  const live = useRef<Stroke | null>(null);
  const pt = (e: React.PointerEvent) => { const r = svgRef.current!.getBoundingClientRect(); return [Math.round(((e.clientX - r.left) / r.width) * 1000) / 1000, Math.round(((e.clientY - r.top) / r.height) * 1000) / 1000]; };
  const go = (d: number) => { setAt((at + d + images.length) % images.length); setDraw(false); if (sfx) SFX.tap(); };
  const download = async () => {
    const name = `${articleId}-${at + 1}${(im.src.match(/\.(png|jpe?g|gif|webp|svg)(\?|$)/i)?.[0] ?? '.jpg').replace(/\?$/, '')}`;
    try {
      const r = await fetch(im.src, { mode: 'cors', referrerPolicy: 'no-referrer' }); if (!r.ok) throw new Error('no');
      const u = URL.createObjectURL(await r.blob()); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(u), 5000);
    } catch { window.open(im.src, '_blank', 'noopener'); }
  };
  const path = (s: Stroke) => s.pts.reduce((d, v, i) => d + (i % 2 === 0 ? `${i ? ' L' : 'M'}${v * 1000}` : ` ${v * 1000}`), '');
  return (
    <div className="rdr-gallery" role="dialog" aria-modal="true" aria-label="Picture gallery">
      <div className="rdr-gal-top">
        <button type="button" className="rdr-btn" onClick={onClose}>▼ Back to reading</button>
        <span className="rdr-gal-count">{at + 1} of {images.length}</span>
        <div className="rdr-gal-tools">
          <button type="button" className={`rdr-btn${zoom ? ' on' : ''}`} onClick={() => { setZoom((z) => !z); setDraw(false); }} aria-pressed={zoom}>🔍 {zoom ? 'Smaller' : 'Bigger'}</button>
          <button type="button" className={`rdr-btn${draw ? ' on' : ''}`} onClick={() => { setDraw((d) => !d); setZoom(false); }} aria-pressed={draw}>✏️ Draw</button>
          <button type="button" className="rdr-btn" onClick={download}>⬇️ Save to my iPad</button>
        </div>
      </div>
      {draw && <div className="rdr-inks" role="group" aria-label="Pen colors">
        {INKS.map((c) => <button key={c} type="button" className={`rdr-ink${ink === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setInk(c)} aria-label={`Pen color ${c}`} aria-pressed={ink === c} />)}
        <button type="button" className="rdr-btn" onClick={() => save(strokes.slice(0, -1))} disabled={!strokes.length}>↩ Undo</button>
        <button type="button" className="rdr-btn" onClick={() => save([])} disabled={!strokes.length}>🧽 Clear</button>
      </div>}
      <div className={`rdr-gal-stage${zoom ? ' zoom' : ''}`}>
        <button type="button" className="rdr-arrow left" onClick={() => go(-1)} aria-label="Previous picture" disabled={images.length < 2}>◀</button>
        <figure className="rdr-fig">
          <div className="rdr-imgwrap">
            <img src={im.src} alt={im.caption || `Picture ${at + 1}`} referrerPolicy="no-referrer" draggable={false} />
            <svg ref={svgRef} viewBox="0 0 1000 1000" preserveAspectRatio="none" className={`rdr-ann${draw ? ' drawing' : ''}`}
              onPointerDown={(e) => { if (!draw) return; (e.target as Element).setPointerCapture?.(e.pointerId); live.current = { c: ink, pts: pt(e) }; setStrokes((s) => [...s, live.current!]); }}
              onPointerMove={(e) => { if (!draw || !live.current) return; live.current.pts.push(...pt(e)); setStrokes((s) => [...s.slice(0, -1), { ...live.current! }]); }}
              onPointerUp={() => { if (live.current) { save([...strokes]); live.current = null; } }}>
              {strokes.map((s, i) => <path key={i} d={path(s)} fill="none" stroke={s.c} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />)}
            </svg>
          </div>
          {im.caption && <figcaption>{im.caption}</figcaption>}
        </figure>
        <button type="button" className="rdr-arrow right" onClick={() => go(1)} aria-label="Next picture" disabled={images.length < 2}>▶</button>
      </div>
    </div>
  );
}
