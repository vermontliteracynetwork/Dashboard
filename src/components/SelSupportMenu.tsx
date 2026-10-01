import { useEffect, useRef, useState } from 'react';
import { SEL_ZONE_COLORS } from '../lib/selZones';
import type { SelZone } from '../types';
import { playListeningStartChime, playListeningStopChime } from '../lib/audioCues';

// Speech-to-text for the "leave a note" field — a fifth scoped exception to
// the app-wide STT removal (2026-09-22), same browser Web Speech API
// pattern as Literacy Manipulatives' Text Box tool. Transcribed to plain
// text, never stored as audio (docs/ZONES_OF_REGULATION_CHECKIN.md §6).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;

function useSelNoteVoiceToText(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const onFinalTextRef = useRef(onFinalText);
  onFinalTextRef.current = onFinalText;

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const toggle = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      playListeningStopChime();
      return;
    }
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let added = '';
      for (let i = e.resultIndex; i < e.results.length; i++) added += e.results[i][0].transcript;
      if (added.trim()) onFinalTextRef.current(added.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
    playListeningStartChime();
  };

  return { listening, toggle, supported: !!SpeechRecognitionCtor };
}

// Support menu shown after picking any non-Green zone+emotion — the tools
// board, a note to the teacher (typed or spoken), and a breathing circle
// that appears the moment a breathing-related tool is tapped. Used both by
// the login check-in and every later Neighbor re-check (same component, per
// spec §3's "same inline tools board").
export default function SelSupportMenu({
  zone,
  tools,
  onToolTap,
  onNoteSave,
}: {
  zone: SelZone;
  tools: string[];
  onToolTap: (label: string) => void;
  onNoteSave: (text: string) => void;
}) {
  const [tapped, setTapped] = useState<string[]>([]);
  const [showBreathing, setShowBreathing] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const stt = useSelNoteVoiceToText((text) => setNoteText((prev) => `${prev} ${text}`.trim()));

  const tapTool = (label: string) => {
    setTapped((prev) => [...prev, label]);
    onToolTap(label);
    if (/breath/i.test(label)) setShowBreathing(true);
  };

  const saveNote = () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    onNoteSave(trimmed);
    setNoteSaved(true);
  };

  return (
    <div className="stack sel-support-menu" style={{ gap: 14 }}>
      {tools.length > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <p className="sel-picker-subtext" style={{ margin: 0, fontWeight: 700 }}>Here are some tools that might help:</p>
          <div className="row-wrap" style={{ gap: 8, justifyContent: 'center' }}>
            {tools.map((tool) => (
              <button
                key={tool}
                className="sel-tool-btn"
                style={{ borderColor: SEL_ZONE_COLORS[zone] }}
                onClick={() => tapTool(tool)}
              >
                {tapped.includes(tool) ? '✓ ' : ''}{tool}
              </button>
            ))}
          </div>
        </div>
      )}

      {showBreathing && (
        <div className="stack" style={{ alignItems: 'center', gap: 6 }}>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>Breathe in as the circle grows. Breathe out as it shrinks.</p>
          <div className="breathe-circle" />
        </div>
      )}

      {!noteOpen ? (
        <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={() => setNoteOpen(true)}>
          ✏️ Leave a note for your teacher
        </button>
      ) : noteSaved ? (
        <p style={{ textAlign: 'center', fontSize: '0.9rem' }}>✓ Your teacher will see your note.</p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <div className="row" style={{ gap: 6, alignItems: 'center' }}>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Type here..."
              rows={3}
              style={{ flex: 1, fontSize: '1rem', padding: 8, resize: 'vertical' }}
              autoFocus
            />
            {stt.supported && (
              <button
                type="button"
                className={`btn btn-sm ${stt.listening ? 'btn-primary' : ''}`}
                style={{ minHeight: 44, minWidth: 44 }}
                onClick={stt.toggle}
                aria-label={stt.listening ? 'Listening, tap to stop' : 'Speak your note'}
              >
                {stt.listening ? '🎙️' : '🎤'}
              </button>
            )}
          </div>
          <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!noteText.trim()} onClick={saveNote}>
            Send note
          </button>
        </div>
      )}
    </div>
  );
}
