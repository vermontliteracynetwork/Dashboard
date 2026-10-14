import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/store';
import { NATIVE_GAME_CARDS, QUIZ_MODE_CARD } from '../lib/nativeGames';
import { NPC_VOICE_PRESETS } from '../lib/npcVoices';
import { useVoiceToText } from '../lib/useVoiceToText';
import { uploadImage, uploadVoiceMemo } from '../lib/upload';
import { speak } from './ReadAloud';

// Report a bug or share an idea, with Azalea the cat (teacher 2026-10-14: "lets have it so students are
// reporting the bug to this cat, Azalea. A picture of Azalea should appear and it should walk students
// through. i want it to be an ABA style conversation ... allow them to use their voice to talk with
// azalea. have her help walk through the specifics", plus "add a voice memo ability. this should be on
// every game"). One question at a time with picture choices, every question read aloud, praise after
// every answer, a gentle hint when a student waits, a microphone to answer by talking, and a voice
// memo that the teacher can play in her inbox. It lands in the same feedback inbox as before.
// Streamlined (Build Queue 144 + 150, her words 2026-10-14: "make sure the azalea conversatio bug screen
// is available in all places within the game, this should be standard default way students report
// things to me" and "streamline the azalea bug reporting. students are saying it is too long and
// unnessary and arent using it because of it. what i need is their clear ideas however we can do that"):
// now two steps. 1) Broken or idea? 2) Say it (talk, voice memo, type, photo), with one model sentence
// and tap-in sentence starters, then Send. The game or place fills itself in from the screen they are on.
// The bubble shows on every student screen except Grammar Gus (nothing may overlap his machine, her
// standing Gus rule); the Tools menu's Give Feedback opens Azalea everywhere, Gus included.
const EXTRA: Record<string, string> = {
  '/student/gym': "Buff Doge's Gym", '/student/science-lab': 'Science Lab', '/student/supernature': 'Supernature',
  '/student/farmers-market': 'Farmers Market', '/student/grammar': 'Grammar Sandbox', '/student/home': 'Home',
  '/student/marketplace': 'Marketplace', '/student/piggy-bank': 'Piggy Bank', '/student/mailbox': 'Mailbox',
  '/student/passport': 'Passport', '/student/games': 'Arcade', '/student/arcade': 'Arcade', '/student/library': 'Library',
  '/student/style': 'Style', '/student/pet-shelter': 'Pet Finder', '/student/pet-finder': 'Pet Finder',
  '/student/pet-journal': 'Pet Journal', '/student/cinema': 'Cinema', '/world/town': 'Town Square',
  '/student/grammar-gus': 'Grammar Gus', '/student/grammar-gus/classic': 'Grammar Gus',
};
const placeOf = (pathname: string) => {
  const g = [...NATIVE_GAME_CARDS, QUIZ_MODE_CARD].find((x) => x.route.split('?')[0] === pathname)?.title ?? EXTRA[pathname];
  if (g) return g;
  if (pathname.startsWith('/world')) return 'Town Square';
  const last = pathname.split('/').filter(Boolean).pop() ?? '';
  return last ? `${last.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}` : 'The app';
};
const AZ = '/characters/';
const VOICE = NPC_VOICE_PRESETS['bright-friendly'];
const MEMO_MAX = 60;
const MAX_PHOTOS = 3;
export const openAzalea = () => window.dispatchEvent(new CustomEvent('azalea:open'));
const BUG_WORDS = ['broken', 'broke', 'bug', 'wrong', 'problem', 'stuck', 'not working', 'glitch', 'error'];
const IDEA_WORDS = ['idea', 'add', 'new', 'wish', 'want', 'better', 'could'];
// One model sentence and tap-in starters, so a student knows exactly what to say (2026-10-14).
const MODEL = (kind: 'bug' | 'idea', place: string) => (kind === 'bug' ? 'When I tapped the button, nothing happened.' : `I wish ${place} had dragons, because they are fun.`);
const FRAMES = (kind: 'bug' | 'idea', place: string) => (kind === 'bug'
  ? ['When I tapped ___, ___ happened.', 'The ___ is not working.', 'It froze when I ___.']
  : [`I wish ${place} had ___.`, 'Please add ___.', 'because ___.']);

export default function GameReportBubble() {
  const { pathname } = useLocation();
  const role = useStore((s) => s.role);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const submitFeedback = useStore((s) => s.submitFeedback);
  const here = placeOf(pathname);
  const isStudent = role === 'student' && !!student && pathname !== '/student/login';
  const showBubble = isStudent && !pathname.startsWith('/student/grammar-gus');
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'bug' | 'idea' | null>(null);
  const [about, setAbout] = useState(here);
  const [picking, setPicking] = useState(false);
  const [draft, setDraft] = useState('');
  const [say, setSay] = useState('');
  const [hint, setHint] = useState(false);
  const [phase, setPhase] = useState<'ask' | 'sending' | 'sent'>('ask');
  const [memo, setMemo] = useState<{ blob: Blob; url: string; secs: number } | null>(null);
  const [rec, setRec] = useState<{ secs: number } | null>(null);
  const [memoNote, setMemoNote] = useState('');
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const voiceRef = useRef<{ listening: boolean; stop: () => void } | null>(null);
  const recRef = useRef<{ r: MediaRecorder; stream: MediaStream; timer: number; chunks: Blob[]; start: number } | null>(null);
  const first = (student?.name ?? '').split(' ')[0];

  useEffect(() => {
    if (!showBubble) return;
    document.body.classList.add('has-report-bubble');
    return () => document.body.classList.remove('has-report-bubble');
  }, [showBubble]);
  const stopMemo = () => {
    const c = recRef.current; if (!c) return;
    window.clearInterval(c.timer);
    try { if (c.r.state !== 'inactive') c.r.stop(); } catch { /* already stopped */ }
    recRef.current = null; setRec(null);
    if (voiceRef.current?.listening) voiceRef.current.stop();
  };
  const reset = () => { stopMemo(); setKind(null); setAbout(placeOf(pathname)); setPicking(false); setDraft(''); setSay(''); setHint(false); setPhase('ask'); setMemo(null); setMemoNote(''); setPhotos([]); };
  useEffect(() => { setOpen(false); reset(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => () => stopMemo(), []);
  // Give Feedback in the Tools menu (and anything else) opens Azalea.
  useEffect(() => { const h = () => setOpen(true); window.addEventListener('azalea:open', h); return () => window.removeEventListener('azalea:open', h); }, []);

  const talk = (t: string) => { setSay(t); if (student) speak(t, student.ttsSettings, undefined, VOICE); };
  useEffect(() => {
    if (!open || phase !== 'ask') return;
    if (!kind) talk(`Hi ${first}! Is something broken, or do you have an idea?`);
    else talk(kind === 'bug' ? `Tell me what happened. You could say: ${MODEL('bug', about)}` : `Tell me your idea and why. You could say: ${MODEL('idea', about)}`);
    setHint(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, phase]);
  // One gentle nudge after a quiet wait.
  useEffect(() => {
    if (!open || phase !== 'ask' || rec || draft || memo) return;
    const a = window.setTimeout(() => { setHint(true); talk(kind ? 'Tap Talk and tell me, or tap a starter below.' : 'Tap a picture, or tap Talk and tell me.'); }, 15000);
    return () => window.clearTimeout(a);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, phase, draft, rec, memo]);

  const voice = useVoiceToText((heard) => {
    const h = heard.toLowerCase();
    if (!kind) {
      const k = BUG_WORDS.some((w) => h.includes(w)) ? 'bug' : IDEA_WORDS.some((w) => h.includes(w)) ? 'idea' : null;
      if (k) { setKind(k); if (k === 'idea' || !BUG_WORDS.includes(h.trim())) setDraft(heard); return; }
      talk(`I heard: ${heard}. Is something broken, or is it an idea? Tap one.`); return;
    }
    setDraft((d) => (d ? `${d} ${heard}` : heard));
  }, { continuous: false });
  voiceRef.current = voice;

  const startMemo = async () => {
    setMemoNote('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMemoNote('This device cannot record. Tap Talk or type instead.'); return; }
    try {
      voice.stop();
      window.speechSynthesis?.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream); const chunks: Blob[] = [];
      r.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const start = Date.now();
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || 'audio/webm' });
        if (blob.size) setMemo({ blob, url: URL.createObjectURL(blob), secs: Math.round((Date.now() - start) / 1000) });
      };
      r.start();
      const timer = window.setInterval(() => {
        const secs = Math.round((Date.now() - start) / 1000);
        setRec({ secs });
        if (secs >= MEMO_MAX) stopMemo();
      }, 500);
      recRef.current = { r, stream, timer, chunks, start }; setRec({ secs: 0 });
      // Write down what they say while the memo records, when the device can do both.
      if (voice.supported && !voice.listening) { try { voice.toggle(); } catch { /* recording still works */ } }
    } catch { setMemoNote('The microphone is turned off. Ask your teacher to turn it on, or type instead.'); }
  };
  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const add = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length).map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (add.length) setPhotos((p) => [...p, ...add]);
  };
  const ready = !!draft.trim() || !!memo;
  const send = async () => {
    if (!student || !kind || !ready) return;
    stopMemo(); setPhase('sending');
    let memoLine = '';
    if (memo) {
      try {
        const url = await uploadVoiceMemo(memo.blob);
        memoLine = `\n🎙️ Voice memo (${memo.secs} seconds): ${url}`;
        try {
          const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 25000);
          const r = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: ctl.signal });
          window.clearTimeout(t);
          const j = r.ok ? await r.json() as { text?: string } : null;
          if (j?.text) memoLine += `\n📝 Memo transcript: "${j.text.replace(/\s+/g, ' ')}"`;
        } catch { /* sent without a transcript */ }
      } catch { memoLine = '\n🎙️ A voice memo was recorded but could not be saved.'; }
    }
    const ua = navigator.userAgent; const device = /iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1 ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /CrOS/.test(ua) ? 'Chromebook' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
    let photoLines = '';
    for (const ph of photos) {
      try { photoLines += `\n📷 Photo: ${await uploadImage(ph.file)}`; } catch { photoLines += '\n📷 A photo was added but could not be saved.'; }
    }
    const said = draft.trim() ? `Said: ${draft.trim().replace(/\s+/g, ' ')}\n` : '';
    const where = about !== here ? `Part: sent from ${here}\n` : '';
    submitFeedback(student.id, 'gameplay', kind === 'bug' ? 'Glitch / Bug Found' : 'Feature to Add', about, `${said}${where}Device: ${device}, ${window.innerWidth}x${window.innerHeight}, ${new Date().toLocaleString()}${memoLine}${photoLines}`);
    setPhase('sent');
    talk(kind === 'bug' ? `Thank you, ${first}! You are a real bug detective. Your teacher will see it.` : `What a great idea, ${first}! Your teacher will see it.`);
  };
  const close = () => { window.speechSynthesis?.cancel(); setOpen(false); reset(); };
  if (!isStudent || !student) return null;

  const places = [here, ...NATIVE_GAME_CARDS.map((g) => g.title).filter((t) => t !== here), ...(here === 'The app' ? [] : ['The app'])];
  const cover = (t: string) => NATIVE_GAME_CARDS.find((g) => g.title === t)?.cover;
  return (
    <>
      {showBubble && (
        <button type="button" className="report-bubble" onClick={() => setOpen(true)} aria-label={`Talk to Azalea: report a bug or share an idea for ${here}`}>
          <img src={`${AZ}azalea-head.png`} alt="" /><small>Report</small>
        </button>
      )}
      {open && (
        <div className="pf-overlay report-back" onClick={close}>
          <div className="pf-panel report-card az" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Talk to Azalea">
            <img className="az-cat" src={`${AZ}azalea.png`} alt="Azalea the cat" />
            <div className="az-main">
              <div className="az-top">
                <button type="button" className="az-about" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                  {cover(about) ? <img src={cover(about)} alt="" /> : <span aria-hidden>🏠</span>}
                  <span>About: <b>{about}</b></span><small>{picking ? 'Close' : 'Change'}</small>
                </button>
                <button type="button" className="btn report-listen" onClick={close} aria-label="Close">✕</button>
              </div>
              {picking && (
                <div className="az-choices games">
                  {places.map((t) => (
                    <button key={t} type="button" className={`az-choice game${about === t ? ' on' : ''}`} onClick={() => { setAbout(t); setPicking(false); }}>
                      {cover(t) ? <img src={cover(t)} alt="" /> : <span aria-hidden>🏠</span>}{t}
                    </button>
                  ))}
                </div>
              )}
              <div className="az-say" role="status">
                <b>Azalea</b>
                <p>{say}</p>
                <button type="button" className="btn report-listen" onClick={() => talk(say)} aria-label="Listen to Azalea">🔊</button>
              </div>

              {phase === 'ask' && !kind && (
                <div className="az-choices az-two">
                  <button type="button" className={`az-choice${hint ? ' nudge' : ''}`} onClick={() => setKind('bug')}><span aria-hidden>🐞</span>Something is broken</button>
                  <button type="button" className={`az-choice${hint ? ' nudge' : ''}`} onClick={() => setKind('idea')}><span aria-hidden>💡</span>I have an idea</button>
                </div>
              )}
              {phase === 'ask' && kind && (
                <>
                  <div className="az-model">
                    <span>💬 Say it like this:</span>
                    <b>"{MODEL(kind, about)}"</b>
                  </div>
                  <div className="az-frames" aria-label="Sentence starters">
                    {FRAMES(kind, about).map((f) => <button key={f} type="button" className="az-frame" onClick={() => setDraft((d) => (d ? `${d} ${f}` : f))}>{f}</button>)}
                  </div>
                  <label className="report-field">
                    <span>{kind === 'bug' ? 'What happened' : 'My idea'}</span>
                    <textarea id="az-what" value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={MODEL(kind, about)} />
                  </label>
                  <div className="az-tools">
                    {voice.supported && <button type="button" className={`az-tool${voice.listening && !rec ? ' live' : ''}${hint ? ' nudge' : ''}`} onClick={voice.toggle}>{voice.listening && !rec ? '⏹️ Stop' : '🎤 Talk'}</button>}
                    {rec
                      ? <button type="button" className="az-tool live" onClick={stopMemo}>⏹️ Stop memo ({rec.secs}s)</button>
                      : <button type="button" className="az-tool" onClick={startMemo}>🎙️ {memo ? 'Record again' : 'Voice memo'}</button>}
                    {photos.length < MAX_PHOTOS && (
                      <label className="az-tool az-photo">📷 Photo
                        <input type="file" accept="image/*" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                      </label>
                    )}
                    {draft && <button type="button" className="az-tool" onClick={() => setDraft('')}>🧽 Clear</button>}
                  </div>
                  {voice.error === 'denied' && <p className="az-note">The microphone is turned off. You can type instead.</p>}
                  {voice.error === 'nothing' && <p className="az-note">I did not hear anything. Try again, a little louder.</p>}
                  {memoNote && <p className="az-note">{memoNote}</p>}
                  {memo && <div className="az-memo"><span>🎙️ Your voice memo ({memo.secs}s)</span><audio controls src={memo.url} /><button type="button" className="btn" onClick={() => setMemo(null)}>Delete</button></div>}
                  {photos.length > 0 && <div className="az-photos">{photos.map((ph, i) => <span key={ph.url}><img src={ph.url} alt={`Photo ${i + 1}`} /><button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>✕</button></span>)}</div>}
                  <div className="pf-detail-actions">
                    <button type="button" className="btn btn-lg" onClick={() => { setKind(null); setDraft(''); }}>Back</button>
                    {draft.trim() && <button type="button" className="btn btn-lg" onClick={() => talk(draft)}>🔊 Hear it</button>}
                    <button type="button" className="btn btn-primary btn-lg" disabled={!ready || !!rec} onClick={send}>{ready ? '✅ Send to my teacher' : 'Talk, record or type first'}</button>
                  </div>
                </>
              )}
              {phase === 'sending' && <p className="az-sub">Sending...</p>}
              {phase === 'sent' && (
                <>
                  <div className="az-star" aria-hidden>⭐</div>
                  <button type="button" className="btn btn-primary btn-lg" onClick={close}>Back to {here}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
