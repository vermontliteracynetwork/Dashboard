import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from '../store/store';
import { speak } from './ReadAloud';

// Text to speech on every screen (Build Queue 69, her standing rule 2026-10-12: "Ensure that every screen has a
// text-to-speech option"). A 🔊 Listen button beside Azalea's Report bubble on every student screen that does not
// already have its own Listen or Read aloud control. It reads the words on the screen in a real voice (speak()).
// Grammar Gus is left alone: nothing may overlap his machine, and he reads aloud on his own.
const OWN = '.sn-listen, [data-listen], [aria-label^="Listen"], [aria-label*="ead aloud"], [aria-label^="Read the"]';

function screenText(): string {
  const root = document.querySelector('[data-listen-root]') ?? document.querySelector('main') ?? document.querySelector('.app-shell') ?? document.body;
  const raw = (root as HTMLElement).innerText ?? '';
  const seen = new Set<string>();
  const lines = raw.split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 1 && !/^(Listen|Stop|Report|🔊|⏹️)$/i.test(l) && !seen.has(l) && (seen.add(l), true));
  let out = '';
  for (const l of lines) { if ((out + l).length > 700) break; out += /[.!?:]$/.test(l) ? `${l} ` : `${l}. `; }
  return out.trim();
}

export default function ListenFab() {
  const { pathname } = useLocation();
  const role = useStore((s) => s.role);
  const tts = useStore((s) => s.students.find((st) => st.id === s.currentStudentId)?.ttsSettings);
  const studentArea = (pathname.startsWith('/student') || pathname.startsWith('/world')) && (role === 'student' || pathname === '/student/login');
  const allowed = studentArea && !pathname.startsWith('/student/grammar-gus');
  const [hasOwn, setHasOwn] = useState(true);
  const [talking, setTalking] = useState(false);
  const playing = useRef<{ pause?: () => void; onend?: unknown } | null>(null);
  useEffect(() => {
    if (!allowed) return;
    const check = () => setHasOwn(!!document.querySelector(OWN));
    check(); const t = window.setInterval(check, 1500);
    return () => window.clearInterval(t);
  }, [allowed, pathname]);
  useEffect(() => { setTalking(false); }, [pathname]);
  if (!allowed || hasOwn) return null;
  const go = () => {
    if (talking) { window.speechSynthesis?.cancel(); playing.current?.pause?.(); setTalking(false); return; }
    const text = screenText(); if (!text) return;
    setTalking(true);
    const u = speak(text, tts) as unknown as { pause?: () => void; onend?: unknown } | undefined;
    playing.current = u ?? null;
    if (u) u.onend = () => setTalking(false);
    window.setTimeout(() => setTalking(false), Math.min(90000, 3000 + text.length * 90));
  };
  return (
    <button type="button" className="listen-fab" onClick={go} data-listen-fab aria-label={talking ? 'Stop reading' : 'Read this screen aloud'}>
      <span aria-hidden="true">{talking ? '⏹️' : '🔊'}</span><small>{talking ? 'Stop' : 'Listen'}</small>
    </button>
  );
}
