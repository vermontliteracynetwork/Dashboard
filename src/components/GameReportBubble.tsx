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
// Grammar Gus is left out on purpose: nothing may overlap his machine (her standing Gus rule).
const EXTRA: Record<string, string> = {
  '/student/gym': "Buff Doge's Gym", '/student/science-lab': 'Science Lab', '/student/supernature': 'Supernature',
  '/student/farmers-market': 'Farmers Market', '/student/grammar': 'Grammar Sandbox',
};
const AZ = '/characters/';
const VOICE = NPC_VOICE_PRESETS['bright-friendly'];
const PRAISE = ['Thank you!', 'That helps a lot!', 'Great telling!', 'You are a great helper!', 'Got it!'];
const MEMO_MAX = 60;

interface Choice { value: string; label: string; icon: string; words: string[]; img?: string }
// model: what Azalea says a good answer sounds like; frames: sentence starters a student can tap
// (teacher 2026-10-14: "make sure azalea says something to prompt the students so these students know
// exactly what to say").
interface Step { id: string; ask: string; choices?: Choice[]; free?: boolean; need?: boolean; model?: string; frames?: string[] }
const NOT_SURE: Choice = { value: 'I am not sure', label: 'I am not sure', icon: '🤷', words: ['not sure', "don't know", 'dont know', 'no idea'] };

const GAMES = () => NATIVE_GAME_CARDS.map((g) => ({ value: g.title, label: g.title, icon: g.cabinet.icon, img: g.cover, words: [g.title.toLowerCase()] }));
// Her ask (2026-10-14): "allow students to clarify what game, feature, or what is happening clearly.
// remember that these students have communication disorders ... we need to be supportive and guiding
// in very explicit ways". Which game (with its picture), then which part of it, before the details.
function clarify(game: string, answers: Record<string, string>): Step[] {
  const here = NATIVE_GAME_CARDS.find((g) => g.title === game);
  const out: Step[] = [{ id: 'game', ask: `Is it about ${game}? Tap yes, or tap A different game.`, choices: [
    { value: game, label: `Yes, ${game}`, icon: '✅', img: here?.cover, words: ['yes', 'yeah', 'this', game.toLowerCase()] },
    { value: '__other', label: 'A different game', icon: '🎮', words: ['different', 'other', 'another'] },
    { value: 'The whole app', label: 'Not a game: the app, Town Square or my money', icon: '🏠', words: ['app', 'town', 'home', 'money', 'bank'] },
  ] }];
  if (answers.game === '__other') out.push({ id: 'whichGame', ask: 'Which game is it? Tap its picture.', choices: GAMES() });
  const g = answers.game === '__other' ? answers.whichGame ?? 'the game' : answers.game ?? game;
  out.push({ id: 'part', ask: `Which part of ${g} is it about?`, free: true, model: 'It is about the questions.', frames: ['It is about the ___.', 'It is the ___ screen.'], choices: [
    { value: 'Playing the game', label: 'Playing the game', icon: '🎮', words: ['playing', 'play', 'game'] },
    { value: 'The questions', label: 'The questions', icon: '📝', words: ['question', 'quiz', 'answer'] },
    { value: 'The shop or store', label: 'The shop or store', icon: '🛒', words: ['shop', 'store', 'buy'] },
    { value: 'Money or prizes', label: 'Money or prizes', icon: '💰', words: ['money', 'coin', 'prize', 'reward'] },
    { value: 'Sounds or voices', label: 'Sounds or voices', icon: '🔊', words: ['sound', 'voice', 'music'] },
    { value: 'Buttons or menus', label: 'Buttons or menus', icon: '👆', words: ['button', 'menu'] },
    { value: 'A character', label: 'A character', icon: '🧑', words: ['character', 'person', 'cat', 'dog', 'neighbor'] },
    NOT_SURE,
  ] });
  return out;
}
export const gameOf = (game: string, a: Record<string, string>) => (a.game === '__other' ? a.whichGame ?? game : a.game ?? game);

function flow(kind: 'bug' | 'idea' | null, game: string, answers: Record<string, string> = {}): Step[] {
  const first: Step = {
    id: 'kind', ask: `Is something broken in ${game}, or do you have an idea for it?`,
    choices: [
      { value: 'bug', label: 'Something is broken', icon: '🐞', words: ['broken', 'broke', 'bug', 'wrong', 'problem', 'stuck', 'not working', 'glitch', 'error'] },
      { value: 'idea', label: 'I have an idea', icon: '💡', words: ['idea', 'add', 'new', 'wish', 'want', 'better', 'could'] },
    ],
  };
  if (kind === 'bug') return [first, ...clarify(game, answers),
    { id: 'type', ask: 'What kind of problem is it?', choices: [
      { value: 'The screen looks wrong', label: 'The screen looks wrong', icon: '👀', words: ['look', 'screen', 'see', 'picture', 'missing', 'blank', 'white', 'black'] },
      { value: 'A button does not work', label: 'A button does not work', icon: '👆', words: ['button', 'tap', 'click', 'press', 'touch'] },
      { value: 'It froze or got stuck', label: 'It froze or got stuck', icon: '🧊', words: ['froze', 'freeze', 'frozen', 'stuck', 'loading', 'slow'] },
      { value: 'Sound or voice', label: 'Sound or voice', icon: '🔊', words: ['sound', 'voice', 'hear', 'loud', 'quiet', 'music'] },
      { value: 'Money or rewards', label: 'Money or rewards', icon: '💰', words: ['money', 'coin', 'reward', 'prize', 'pay', 'dollar', 'cash'] },
      { value: 'Something else', label: 'Something else', icon: '❓', words: ['else', 'other'] },
    ] },
    { id: 'doing', ask: 'What were you doing right before it happened?', free: true, model: 'I was answering a question about money.', frames: ['I was trying to ___.', 'I was on the ___ part.'], choices: [
      { value: 'Playing the game', label: 'Playing the game', icon: '🎮', words: ['playing', 'play'] },
      { value: 'Answering a question', label: 'Answering a question', icon: '📝', words: ['question', 'answer', 'quiz'] },
      { value: 'Buying something', label: 'Buying something', icon: '🛒', words: ['buy', 'bought', 'shop', 'store'] },
      { value: 'Starting the game', label: 'Starting the game', icon: '▶️', words: ['start', 'open', 'begin'] },
      NOT_SURE,
    ] },
    { id: 'what', ask: 'Tell me what happened. Tap the microphone and talk to me, record a voice memo, or type it.', free: true, need: true,
      model: 'When I tapped the Cast button, nothing happened.',
      frames: ['When I tapped ___, ___ happened.', 'I was trying to ___, but ___.', 'The ___ is missing.', 'The game froze when I ___.', 'I got ___, but it should be ___.'] },
    { id: 'often', ask: 'Did it happen one time, or again and again?', choices: [
      { value: 'One time', label: 'One time', icon: '1️⃣', words: ['one time', 'once', 'one'] },
      { value: 'Again and again', label: 'Again and again', icon: '🔁', words: ['again', 'more', 'lot', 'every', 'always', 'many'] },
      NOT_SURE,
    ] },
    { id: 'play', ask: 'Can you still play the game?', choices: [
      { value: 'Yes, I can still play', label: 'Yes, I can still play', icon: '✅', words: ['yes', 'yeah', 'can'] },
      { value: 'No, I cannot play', label: 'No, I cannot play', icon: '⛔', words: ['no', 'nope', "can't", 'cannot'] },
    ] },
  ];
  if (kind === 'idea') return [first, ...clarify(game, answers),
    { id: 'type', ask: 'Ooh, I love ideas! What kind of idea is it?', choices: [
      { value: 'Something new to add', label: 'Something new to add', icon: '✨', words: ['new', 'add', 'more'] },
      { value: 'Change how it looks', label: 'Change how it looks', icon: '🎨', words: ['look', 'color', 'picture', 'pretty'] },
      { value: 'Make it easier', label: 'Make it easier', icon: '🟢', words: ['easier', 'easy'] },
      { value: 'Make it harder', label: 'Make it harder', icon: '🔥', words: ['harder', 'hard', 'challenge'] },
      { value: 'Sounds or music', label: 'Sounds or music', icon: '🎵', words: ['sound', 'music', 'song'] },
      { value: 'Something else', label: 'Something else', icon: '❓', words: ['else', 'other'] },
    ] },
    { id: 'what', ask: 'Tell me your idea. Tap the microphone and talk to me, record a voice memo, or type it.', free: true, need: true,
      model: `I wish ${game} had a golden prize to find.`,
      frames: [`I wish ${game} had ___.`, 'Please add ___.', 'It would be cool if ___.', 'Can you make the ___ ___?'] },
    // Her ask (2026-10-14): "reference a game (with pictures and name of game) to suggest ideas".
    { id: 'like', ask: 'Is your idea like a game you know? Tap the game, or tell me its name.', free: true, model: 'It is like the fishing game, where you catch fish.', frames: ['It is like ___, where you ___.'],
      choices: [{ value: 'No, it is a brand new idea', label: 'No, it is brand new', icon: '🌟', words: ['no', 'new', 'nope'] },
        ...NATIVE_GAME_CARDS.filter((g) => g.title !== game).map((g) => ({ value: `Like ${g.title}`, label: g.title, icon: g.cabinet.icon, img: g.cover, words: [g.title.toLowerCase()] }))] },
    { id: 'why', ask: `Why would it make ${game} better?`, free: true, model: 'It would be more fun because I could find surprises.', frames: ['It would be better because ___.'], choices: [
      { value: 'It would be more fun', label: 'It would be more fun', icon: '😄', words: ['fun'] },
      { value: 'It would help me learn', label: 'It would help me learn', icon: '🧠', words: ['learn', 'smart'] },
      { value: 'It would be easier to use', label: 'It would be easier to use', icon: '👍', words: ['easier', 'easy'] },
      NOT_SURE,
    ] },
  ];
  return [first];
}
const LABEL: Record<string, string> = { game: 'Game', whichGame: 'Game', part: 'Part', type: 'Kind', doing: 'Doing', what: 'Said', often: 'How often', play: 'Can still play', why: 'Why', like: 'Like this game' };
const MAX_PHOTOS = 3;

export default function GameReportBubble() {
  const { pathname } = useLocation();
  const role = useStore((s) => s.role);
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const submitFeedback = useStore((s) => s.submitFeedback);
  const game = [...NATIVE_GAME_CARDS, QUIZ_MODE_CARD].find((g) => g.route.split('?')[0] === pathname)?.title ?? EXTRA[pathname] ?? null;
  const on = !!game && role === 'student' && !!student;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<'bug' | 'idea' | null>(null);
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [say, setSay] = useState('');
  const [hint, setHint] = useState(0);
  const [phase, setPhase] = useState<'ask' | 'review' | 'sending' | 'sent'>('ask');
  const [memo, setMemo] = useState<{ blob: Blob; url: string; secs: number } | null>(null);
  const [rec, setRec] = useState<{ secs: number } | null>(null);
  const [memoNote, setMemoNote] = useState('');
  const [photos, setPhotos] = useState<{ file: File; url: string }[]>([]);
  const [heard, setHeard] = useState('');
  const [listened, setListened] = useState(false);
  const voiceRef = useRef<{ listening: boolean; stop: () => void } | null>(null);
  const recRef = useRef<{ r: MediaRecorder; stream: MediaStream; timer: number; chunks: Blob[]; start: number } | null>(null);
  const steps = flow(kind, game ?? 'this game', answers);
  const step = steps[Math.min(at, steps.length - 1)];
  const first = (student?.name ?? '').split(' ')[0];

  useEffect(() => {
    if (!on) return;
    document.body.classList.add('has-report-bubble');
    return () => document.body.classList.remove('has-report-bubble');
  }, [on]);
  const stopMemo = () => {
    const c = recRef.current; if (!c) return;
    window.clearInterval(c.timer);
    try { if (c.r.state !== 'inactive') c.r.stop(); } catch { /* already stopped */ }
    recRef.current = null; setRec(null);
    if (voiceRef.current?.listening) voiceRef.current.stop();
  };
  const reset = () => { stopMemo(); setKind(null); setAt(0); setAnswers({}); setDraft(''); setSay(''); setHint(0); setPhase('ask'); setMemo(null); setMemoNote(''); setPhotos([]); setHeard(''); setListened(false); };
  useEffect(() => { setOpen(false); reset(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  useEffect(() => () => stopMemo(), []);

  // Azalea says each question as it comes up (praise for the last answer first).
  const talk = (t: string) => { setSay(t); if (student) speak(t, student.ttsSettings, undefined, VOICE); };
  useEffect(() => {
    if (!open) return;
    if (phase === 'review') { setListened(false); talk('Great job! Before we send it, tap Hear my message and listen. Is it right?'); return; }
    if (phase !== 'ask') return;
    const model = step.model ? ` You could say: ${step.model}` : '';
    const prev = steps[at - 1]; const got = prev ? answers[prev.id] : undefined;
    const picked = got && got !== '__other' ? ` You said: ${got}.` : '';
    talk(at === 0 && !Object.keys(answers).length ? `Hi ${first}! I am Azalea. I help your teacher fix things and hear new ideas. ${step.ask}` : `${PRAISE[at % PRAISE.length]}${picked} ${step.ask}${model}`);
    setHeard('');
    setHint(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, at, kind, phase]);
  // Prompt fading: after a quiet wait, a visual hint, then a gentle reminder.
  useEffect(() => {
    if (!open || phase !== 'ask' || rec) return;
    const a = window.setTimeout(() => { setHint(1); talk(step.choices && !step.free ? 'You can tap a picture, or tap the microphone and talk to me.' : 'You can tap the microphone and talk, tap Record a voice memo, or type.'); }, 14000);
    const b = window.setTimeout(() => { setHint(2); talk('Take your time. I am right here.'); }, 34000);
    return () => { window.clearTimeout(a); window.clearTimeout(b); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, at, kind, phase, answers, draft, rec]);

  const answer = (id: string, value: string) => {
    const next = { ...answers, [id]: value };
    setAnswers(next); setDraft(''); setHeard('');
    if (id === 'kind') { setKind(value as 'bug' | 'idea'); setAt(1); return; }
    if (at + 1 >= steps.length) { setPhase('review'); return; }
    setAt(at + 1);
  };
  const match = (heard: string) => {
    const h = heard.toLowerCase();
    return step.choices?.find((c) => c.words.some((w) => h.includes(w)));
  };
  const voice = useVoiceToText((heard) => {
    if (step.free && !match(heard)) {
      setDraft((d) => (d ? `${d} ${heard}` : heard)); setHeard(heard);
      if (!recRef.current) talk(`I heard you say: ${heard}. If that is right, tap Next. If not, tap Clear and try again.`);
      return;
    }
    const m = match(heard);
    if (m) { answer(step.id, m.value); return; }
    if (step.id !== 'kind' && step.choices?.some((c) => c.value === 'Something else')) { answer(step.id, `Something else: ${heard}`); return; }
    talk(`I heard you say: ${heard}. Which picture matches best?`); setHint(1);
  }, { continuous: false });
  voiceRef.current = voice;

  const startMemo = async () => {
    setMemoNote('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMemoNote('This device cannot record. You can talk with the microphone or type instead.'); return; }
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
      // A written transcript of the memo too, when this device can listen and record at once.
      if (voice.supported && !voice.listening) { try { voice.toggle(); } catch { /* recording still works */ } }
    } catch { setMemoNote('The microphone is turned off. Ask your teacher to turn it on, or type instead.'); }
  };

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    const add = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length).map((file) => ({ file, url: URL.createObjectURL(file) }));
    if (add.length) { setPhotos((p) => [...p, ...add]); talk(add.length === 1 ? 'Thank you for the picture! That really helps.' : 'Thank you for the pictures! That really helps.'); }
  };
  const summary = () => steps.slice(1).map((s) => {
    const v = s.id === 'what' && memo && !answers.what ? '(voice memo)' : answers[s.id] === '__other' ? null : answers[s.id];
    return v ? `${LABEL[s.id] ?? s.id}: ${v}` : null;
  }).filter(Boolean) as string[];
  const send = async () => {
    if (!student || !game || !kind) return;
    setPhase('sending');
    let memoLine = '';
    if (memo) {
      try {
        const url = await uploadVoiceMemo(memo.blob);
        memoLine = `\n🎙️ Voice memo (${memo.secs} seconds): ${url}`;
        // A written transcript of the memo for the teacher's inbox (2026-10-14).
        try {
          const ctl = new AbortController(); const t = window.setTimeout(() => ctl.abort(), 25000);
          const r = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }), signal: ctl.signal });
          window.clearTimeout(t);
          const j = r.ok ? await r.json() as { text?: string } : null;
          if (j?.text) memoLine += `\n📝 Memo transcript: "${j.text.replace(/\s+/g, ' ')}"`;
        } catch { /* sent without a transcript */ }
      }
      catch { memoLine = '\n🎙️ A voice memo was recorded but could not be saved.'; }
    }
    const ua = navigator.userAgent; const device = /iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1 ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /CrOS/.test(ua) ? 'Chromebook' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
    let photoLines = '';
    for (const ph of photos) {
      try { photoLines += `\n📷 Photo: ${await uploadImage(ph.file)}`; } catch { photoLines += '\n📷 A photo was added but could not be saved.'; }
    }
    submitFeedback(student.id, 'gameplay', kind === 'bug' ? 'Glitch / Bug Found' : 'Feature to Add', gameOf(game, answers), `${summary().join('\n')}\nDevice: ${device}, ${window.innerWidth}x${window.innerHeight}, ${new Date().toLocaleString()}${memoLine}${photoLines}`);
    setPhase('sent');
    talk(kind === 'bug' ? `You did it, ${first}! You are a real bug detective. Your teacher will see your report.` : `What a great idea, ${first}! Your teacher will see it.`);
  };
  const hearAll = () => {
    setListened(true);
    const lines = summary().join('. ');
    talk(`Here is your message. ${lines}.${photos.length ? ` You added ${photos.length} ${photos.length === 1 ? 'picture' : 'pictures'}.` : ''}${memo ? ' Your voice memo is next: tap play to hear it.' : ''}`);
  };
  const close = () => { window.speechSynthesis?.cancel(); setOpen(false); reset(); };
  if (!on || !student) return null;

  const freeOk = !!draft.trim() || (step.id === 'what' && !!memo);
  return (
    <>
      <button type="button" className="report-bubble" onClick={() => setOpen(true)} aria-label={`Talk to Azalea: report a bug or share an idea for ${game}`}>
        <img src={`${AZ}azalea-head.png`} alt="" /><small>Report</small>
      </button>
      {open && (
        <div className="pf-overlay report-back" onClick={close}>
          <div className="pf-panel report-card az" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Talk to Azalea">
            <img className="az-cat" src={`${AZ}azalea.png`} alt="Azalea the cat" />
            <div className="az-main">
              <div className="az-top">
                <span className="az-paws" aria-label={`Step ${phase === 'ask' ? at + 1 : steps.length} of ${kind ? steps.length : '?'}`}>{(kind ? steps : [steps[0], steps[0], steps[0], steps[0]]).map((_, i) => <i key={i} className={i <= at || phase !== 'ask' ? 'on' : ''}>🐾</i>)}</span>
                <button type="button" className="btn report-listen" onClick={close} aria-label="Close">✕</button>
              </div>
              <div className="az-say" role="status">
                <b>Azalea</b>
                <p>{say}</p>
                <button type="button" className="btn report-listen" onClick={() => talk(say)} aria-label="Listen to Azalea">🔊</button>
              </div>

              {phase === 'ask' && (
                <>
                  {step.choices && (
                    <div className={`az-choices${step.choices.some((c) => c.img) ? ' games' : ''}`}>
                      {step.choices.map((c, i) => (
                        <button key={c.value} type="button" className={`az-choice${c.img ? ' game' : ''}${answers[step.id] === c.value ? ' on' : ''}${hint >= 1 && i === 0 ? ' nudge' : ''}`} onClick={() => answer(step.id, c.value)}>
                          {c.img ? <img src={c.img} alt="" /> : <span aria-hidden>{c.icon}</span>}{c.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {step.model && (
                    <div className="az-model">
                      <span>💬 Say it like this:</span>
                      <b>"{step.model}"</b>
                      <button type="button" className="btn report-listen" onClick={() => talk(`You could say: ${step.model}`)} aria-label="Listen to the example">🔊</button>
                    </div>
                  )}
                  {step.frames && (
                    <div className="az-frames" aria-label="Sentence starters">
                      {step.frames.map((f) => <button key={f} type="button" className="az-frame" onClick={() => { setDraft((d) => (d ? `${d} ${f}` : f)); talk(`${f.replace(/___/g, 'blank')} Fill in the blanks.`); }}>{f}</button>)}
                    </div>
                  )}
                  {heard && <p className="az-heard">🐱 Azalea heard: <b>"{heard}"</b></p>}
                  {step.free && (
                    <label className="report-field">
                      <span>{step.choices ? 'Or tell me in your own words' : 'Your words'}</span>
                      <textarea id={`az-${step.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder={kind === 'bug' ? 'Example: I tapped Cast and nothing happened.' : 'Example: Add a golden fish to catch.'} />
                    </label>
                  )}
                  <div className="az-tools">
                    {voice.supported && <button type="button" className={`az-tool${voice.listening ? ' live' : ''}`} onClick={voice.toggle}>{voice.listening ? '⏹️ Stop listening' : '🎤 Talk to Azalea'}</button>}
                    {step.free && draft && <button type="button" className="az-tool" onClick={() => { setDraft(''); setHeard(''); }}>🧽 Clear</button>}
                    {(step.id === 'what' || step.id === 'like') && photos.length < MAX_PHOTOS && (
                      <label className="az-tool az-photo">📷 Add a photo
                        <input type="file" accept="image/*" multiple onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
                      </label>
                    )}
                    {step.id === 'what' && (rec
                      ? <button type="button" className="az-tool live" onClick={stopMemo}>⏹️ Stop recording ({rec.secs}s of {MEMO_MAX}s)</button>
                      : <button type="button" className="az-tool" onClick={startMemo}>🎙️ {memo ? 'Record again' : 'Record a voice memo'}</button>)}
                  </div>
                  {voice.error === 'denied' && <p className="az-note">The microphone is turned off. You can tap a picture or type instead.</p>}
                  {voice.error === 'nothing' && <p className="az-note">I did not hear anything. Try again, a little louder.</p>}
                  {memoNote && <p className="az-note">{memoNote}</p>}
                  {photos.length > 0 && (step.id === 'what' || step.id === 'like') && (
                    <div className="az-photos">{photos.map((ph, i) => <span key={ph.url}><img src={ph.url} alt={`Photo ${i + 1}`} /><button type="button" onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))} aria-label={`Remove photo ${i + 1}`}>✕</button></span>)}</div>
                  )}
                  {step.id === 'what' && kind === 'bug' && <p className="az-note">Tip: to take a picture of the game on an iPad, press the top button and the volume up button at the same time. Then tap Add a photo.</p>}
                  {memo && step.id === 'what' && (
                    <div className="az-memo"><span>🎙️ Your voice memo ({memo.secs}s)</span><audio controls src={memo.url} /><button type="button" className="btn" onClick={() => setMemo(null)}>Delete</button></div>
                  )}
                  <div className="pf-detail-actions">
                    <button type="button" className="btn btn-lg" onClick={() => { if (at === 0) close(); else { setAt(at - 1); if (at === 1) setKind(null); } }}>{at === 0 ? 'Cancel' : 'Back'}</button>
                    {step.free && <button type="button" className="btn btn-primary btn-lg" disabled={step.need && !freeOk} onClick={() => answer(step.id, draft.trim() || (step.id === 'what' ? '' : 'I am not sure'))}>{freeOk || !step.need ? 'Next' : 'Talk, record or type first'}</button>}
                  </div>
                </>
              )}

              {phase === 'review' && (
                <>
                  <p className="az-sub">Here is what I will tell your teacher:</p>
                  <ul className="az-review">{summary().map((l) => <li key={l}>{l}</li>)}</ul>
                  <div className="az-tools">
                    <button type="button" className={`az-tool${!listened ? ' live' : ''}`} onClick={hearAll}>🔊 Hear my message</button>
                  </div>
                  {memo && <div className="az-memo"><span>🎙️ My voice memo ({memo.secs}s)</span><audio controls src={memo.url} onPlay={() => setListened(true)} /></div>}
                  {photos.length > 0 && <div className="az-photos">{photos.map((ph, i) => <span key={ph.url}><img src={ph.url} alt={`Photo ${i + 1}`} /></span>)}</div>}
                  {!listened && <p className="az-note">Listen to your message first, then you can send it.</p>}
                  <div className="pf-detail-actions">
                    <button type="button" className="btn btn-lg" onClick={() => { setPhase('ask'); setAt(1); }}>✏️ Change something</button>
                    <button type="button" className="btn btn-primary btn-lg" disabled={!listened} onClick={send}>✅ Yes, send it</button>
                  </div>
                </>
              )}
              {phase === 'sending' && <p className="az-sub">Sending...</p>}
              {phase === 'sent' && (
                <>
                  <div className="az-star" aria-hidden>⭐</div>
                  <button type="button" className="btn btn-primary btn-lg" onClick={close}>Back to {game}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
