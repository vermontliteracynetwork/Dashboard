import { useState } from 'react';
import { useStore } from '../store/store';
import type { QuizTheme } from '../types';

const THEMES: { id: QuizTheme; label: string; icon: string; swatch: string }[] = [
  { id: 'standard', label: 'Standard', icon: '⭐', swatch: 'linear-gradient(120deg, var(--purple), var(--purple-dark))' },
  { id: 'pixel', label: 'Pixel', icon: '👾', swatch: 'linear-gradient(120deg, #4b6fd1, #2f4fa8)' },
  { id: 'adventure', label: 'Adventure', icon: '🗺️', swatch: 'linear-gradient(120deg, #a9713f, #7a4d24)' },
  { id: 'fantasy', label: 'Fantasy', icon: '🏰', swatch: 'linear-gradient(120deg, #d8b46a, #a9832f)' },
];

interface Props {
  studentId: string;
  current: QuizTheme;
}

// A small "change look" button in the quiz header that opens a one-choice
// theme picker. The choice is saved to the student (not just this session)
// so a themed quiz looks the same every time — predictability matters more
// here than novelty for this population.
export default function QuizThemePicker({ studentId, current }: Props) {
  const updateStudent = useStore((s) => s.updateStudent);
  const [open, setOpen] = useState(false);
  const currentDef = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <>
      <button
        type="button"
        className="btn btn-sm"
        style={{ minHeight: 44 }}
        onClick={() => setOpen(true)}
        aria-label={`Quiz look: ${currentDef.label}. Tap to change.`}
      >
        {currentDef.icon} {currentDef.label}
      </button>
      {open && (
        <div className="overlay-backdrop" onClick={() => setOpen(false)}>
          <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
              <h2 style={{ margin: 0 }}>Pick a look for your quiz</h2>
              <p style={{ opacity: 0.75, margin: 0, fontSize: '0.9rem' }}>Pick one. You can change it anytime.</p>
              <div className="row-wrap" style={{ justifyContent: 'center' }}>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className="stack"
                    style={{
                      width: 120,
                      alignItems: 'center',
                      gap: 6,
                      padding: '12px 10px',
                      borderRadius: 14,
                      border: t.id === current ? '4px solid var(--purple)' : '2px solid var(--ink)',
                      background: t.swatch,
                      color: 'white',
                      cursor: 'pointer',
                      minHeight: 96,
                    }}
                    onClick={() => {
                      updateStudent(studentId, { quizTheme: t.id });
                      setOpen(false);
                    }}
                  >
                    <span style={{ fontSize: '2rem' }}>{t.icon}</span>
                    <span style={{ fontWeight: 800 }}>{t.label}</span>
                  </button>
                ))}
              </div>
              <button className="btn btn-sm" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
