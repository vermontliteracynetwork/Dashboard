import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import type { Student, StudentFeedback } from '../types';

// A structured, quiz-like feedback flow — direct instruction, built
// specifically for students whose communication needs (including
// communication disorders) make a blank "type your feedback" box a real
// barrier. Pick a category by tapping an icon, drill down as far as the
// tree goes (Game Play -> Build Mode -> Asset to add, for instance), then
// explain in their own words — typed, or spoken via the browser's own
// voice-to-text, same choice the word processor's read-aloud gives in
// reverse. Every step is one big-icon question at a time, never a form.
interface FeedbackOption {
  id: string;
  label: string;
  icon: string;
  category?: StudentFeedback['category']; // set only on the 4 root options
  next?: FeedbackOption[];
  customLabel?: boolean; // "Other" — ask the student to name their own category
}

const ROOT_OPTIONS: FeedbackOption[] = [
  {
    id: 'gameplay', label: 'Game Play', icon: '🎮', category: 'gameplay',
    next: [
      { id: 'bug', label: 'Glitch / Bug Found', icon: '🐛' },
      { id: 'feature', label: 'Feature to Add', icon: '✨' },
      { id: 'theme', label: 'Theme Idea', icon: '🎭' },
      {
        id: 'build-mode', label: 'Build Mode', icon: '🏗️',
        next: [
          { id: 'asset', label: 'Asset to Add', icon: '🧱' },
          { id: 'broken', label: 'Something Broken', icon: '🐛' },
          { id: 'idea', label: 'Other Idea', icon: '💡' },
        ],
      },
    ],
  },
  { id: 'visuals', label: 'Visuals & Design', icon: '🎨', category: 'visuals' },
  { id: 'assignments', label: 'Assignments & Focuses', icon: '📋', category: 'assignments' },
  { id: 'other', label: 'Other', icon: '✏️', category: 'other', customLabel: true },
  // Direct teacher instruction: a dedicated Wishlist button — a place for
  // "features, items/assets, etc." a student wants, distinct from a bug
  // report or a one-off theme idea. No sub-questions (skips straight to
  // free text below) since a wishlist is naturally an open list, not a
  // drill-down category.
  { id: 'wishlist', label: 'Wishlist', icon: '🌟', category: 'wishlist' },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SpeechRecognitionCtor: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : null;

export default function FeedbackTool({ student, onClose }: { student: Student; onClose: () => void }) {
  const submitFeedback = useStore((s) => s.submitFeedback);
  const [path, setPath] = useState<FeedbackOption[]>([]);
  const [phase, setPhase] = useState<'quiz' | 'customLabel' | 'text' | 'done'>('quiz');
  const [customLabelText, setCustomLabelText] = useState('');
  const [feedbackText, setFeedbackText] = useState('');
  const [listening, setListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  const currentOptions = path.length === 0 ? ROOT_OPTIONS : path[path.length - 1].next;
  const category = path[0]?.category;

  const selectOption = (opt: FeedbackOption) => {
    const newPath = [...path, opt];
    setPath(newPath);
    if (opt.next) return; // more questions — stays in the quiz phase
    setPhase(opt.customLabel ? 'customLabel' : 'text');
  };

  const back = () => {
    if (phase === 'text' && category === 'other') { setPhase('customLabel'); return; }
    if (phase === 'customLabel' || phase === 'text') { setPhase('quiz'); return; }
    setPath((p) => p.slice(0, -1));
  };

  const toggleListening = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    if (!SpeechRecognitionCtor) return;
    const rec = new SpeechRecognitionCtor();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e: SpeechRecognitionEvent) => {
      let added = '';
      for (let i = e.resultIndex; i < e.results.length; i++) added += e.results[i][0].transcript;
      if (added.trim()) setFeedbackText((t) => (t ? `${t.trim()} ` : '') + added.trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const submit = () => {
    recognitionRef.current?.stop();
    if (!category) return;
    submitFeedback(
      student.id,
      category,
      path.map((p) => p.label).join(' > '),
      category === 'other' ? customLabelText.trim() || undefined : undefined,
      feedbackText.trim(),
    );
    setPhase('done');
  };

  const optBtn = (opt: FeedbackOption) => (
    <button
      key={opt.id}
      onClick={() => selectOption(opt)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 110, minHeight: 96,
        padding: '14px 12px', borderRadius: 14, cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
        border: '2px solid var(--content-border, #ccc)', background: '#fff',
      }}
    >
      <span style={{ fontSize: '2rem' }}>{opt.icon}</span>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, textAlign: 'center' }}>{opt.label}</span>
    </button>
  );

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 20, maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="row space-between" style={{ alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>💬 Feedback</h2>
          <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {path.length > 0 && phase !== 'done' && (
          <div style={{ fontSize: '0.75rem', opacity: 0.65, marginBottom: 10 }}>
            {path.map((p) => `${p.icon} ${p.label}`).join('  →  ')}
          </div>
        )}

        {phase === 'quiz' && currentOptions && (
          <div className="stack" style={{ gap: 14 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>
              {path.length === 0 ? 'What feedback are you giving?' : `Tell me more about ${path[path.length - 1].label.toLowerCase()}:`}
            </p>
            <div className="row-wrap" style={{ gap: 10, justifyContent: 'center' }}>
              {currentOptions.map(optBtn)}
            </div>
            {path.length > 0 && (
              <button className="btn btn-sm" style={{ minHeight: 44, alignSelf: 'flex-start' }} onClick={back}>← Back</button>
            )}
          </div>
        )}

        {phase === 'customLabel' && (
          <div className="stack" style={{ gap: 12 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>What kind of feedback is this? Type a short label.</p>
            <input
              value={customLabelText}
              onChange={(e) => setCustomLabelText(e.target.value)}
              placeholder="e.g. Sounds, Friends, Something else..."
              style={{ fontSize: '1rem' }}
              autoFocus
            />
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={back}>← Back</button>
              <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!customLabelText.trim()} onClick={() => setPhase('text')}>
                Next →
              </button>
            </div>
          </div>
        )}

        {phase === 'text' && (
          <div className="stack" style={{ gap: 12 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Tell me about it — type it, or tap the microphone to talk.</p>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Type here..."
              rows={5}
              style={{ fontSize: '1rem', lineHeight: 1.5, padding: 10, width: '100%', resize: 'vertical' }}
              autoFocus
            />
            {SpeechRecognitionCtor && (
              <button
                className={`btn btn-sm ${listening ? 'btn-danger' : ''}`}
                style={{ minHeight: 44, alignSelf: 'flex-start' }}
                onClick={toggleListening}
                aria-pressed={listening}
              >
                {listening ? '⏹ Stop talking' : '🎤 Talk instead of typing'}
              </button>
            )}
            <div className="row space-between">
              <button className="btn btn-sm" style={{ minHeight: 44 }} onClick={back}>← Back</button>
              <button className="btn btn-sm btn-primary" style={{ minHeight: 44 }} disabled={!feedbackText.trim()} onClick={submit}>
                ✅ Send Feedback
              </button>
            </div>
          </div>
        )}

        {phase === 'done' && (
          <div className="stack" style={{ alignItems: 'center', textAlign: 'center', gap: 10, padding: '10px 0' }}>
            <span style={{ fontSize: '2.4rem' }}>🎉</span>
            <p style={{ margin: 0, fontWeight: 700 }}>Thanks! Your teacher will see this.</p>
            <button className="btn btn-primary btn-lg" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}
