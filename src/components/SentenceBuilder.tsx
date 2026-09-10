import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { speak } from './ReadAloud';
import { roleFromLabel, wordEmoji } from '../lib/sentenceScene';
import type { SentenceBuilderContent, TTSSettings } from '../types';

interface Props {
  studentId: string;
  taskId: string;
  content: SentenceBuilderContent;
  ttsSettings?: TTSSettings;
  onDone: () => void;
}

// A colored-slot "graphic organizer" for sentence-level writing — each
// blank keeps the same color across every organizer a student sees, the
// way colourful-semantics style sentence scaffolds work in structured
// writing instruction: color becomes a reliable cue for sentence role,
// not just decoration.
export default function SentenceBuilder({ studentId, taskId, content, ttsSettings, onDone }: Props) {
  const response = useStore((s) => s.sentenceBuilderResponses[`${studentId}:${taskId}`]);
  const setSentenceBuilderAnswer = useStore((s) => s.setSentenceBuilderAnswer);

  // Local draft so typing doesn't push a network write on every keystroke —
  // only committed on blur, same tradeoff as the word-processor autosave.
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    setDraft(response?.answers ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, taskId]);

  const blanks = content.parts.filter((p) => p.kind === 'blank');
  const allFilled = blanks.every((p) => (draft[p.id] ?? '').trim().length > 0);

  const commit = (partId: string, text: string) => {
    setSentenceBuilderAnswer(studentId, taskId, partId, text);
  };

  const sentencePreview = content.parts
    .map((p) => (p.kind === 'connector' ? p.text : draft[p.id]?.trim()))
    .filter(Boolean)
    .join(' ');

  // A small emoji "scene" built from the words the student picked — the
  // app has no AI image-generation configured, so this stands in for the
  // "picture of your sentence" payoff with a simple, honest illustration.
  const sceneTokens = blanks
    .map((p) => {
      const word = draft[p.id]?.trim();
      if (!word) return null;
      const role = roleFromLabel(p.label);
      return { partId: p.id, word, emoji: wordEmoji(word, role), role };
    })
    .filter((t): t is NonNullable<typeof t> => t !== null);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <p style={{ opacity: 0.75, margin: 0 }}>Fill in every colored box to build your sentence.</p>

      <div className="row-wrap" style={{ gap: 10, alignItems: 'flex-start' }}>
        {content.parts.map((part) =>
          part.kind === 'connector' ? (
            <div
              key={part.id}
              style={{
                alignSelf: 'center',
                fontWeight: 700,
                fontSize: '1.1rem',
                opacity: 0.7,
                padding: '10px 4px',
              }}
            >
              {part.text}
            </div>
          ) : (
            <div key={part.id} className="stack" style={{ gap: 4, minWidth: 150 }}>
              <div
                className="tag-pill"
                style={{ background: part.color, color: '#fff', alignSelf: 'flex-start', fontSize: '0.8rem' }}
              >
                {part.label}
              </div>
              <input
                value={draft[part.id] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [part.id]: e.target.value }))}
                onBlur={(e) => commit(part.id, e.target.value)}
                placeholder={part.placeholder}
                style={{
                  border: `3px solid ${part.color}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: '1.05rem',
                  minHeight: 44,
                }}
              />
              {part.wordBank && part.wordBank.length > 0 && (
                <div className="row-wrap" style={{ gap: 4 }}>
                  {part.wordBank.map((w) => (
                    <button
                      key={w}
                      className="btn btn-sm"
                      style={{ minHeight: 32, fontSize: '0.8rem' }}
                      onClick={() => {
                        setDraft((d) => ({ ...d, [part.id]: w }));
                        commit(part.id, w);
                      }}
                    >
                      {w}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ),
        )}
      </div>

      <div className="content-well" style={{ background: '#f4f2ff' }}>
        <div className="space-between" style={{ marginBottom: 4 }}>
          <strong style={{ fontSize: '0.85rem' }}>📝 Your sentence:</strong>
          {sentencePreview && (
            <button className="btn btn-sm btn-blue" onClick={() => speak(sentencePreview, ttsSettings)}>
              🔈
            </button>
          )}
        </div>
        <p style={{ margin: 0, fontSize: '1.15rem', minHeight: '1.5em' }}>
          {sentencePreview || <span style={{ opacity: 0.4 }}>Your sentence will build here as you type…</span>}
        </p>
      </div>

      {sceneTokens.length > 0 && (
        <div className="sentence-scene">
          <strong style={{ fontSize: '0.85rem' }}>🎨 A little picture of your sentence:</strong>
          <div className="sentence-scene-stage">
            {sceneTokens.map((t) => (
              <div key={t.partId} className={`sentence-scene-token${t.role === 'action' ? ' sentence-scene-token-action' : ''}`}>
                <span className="sentence-scene-emoji">{t.emoji}</span>
                <span className="sentence-scene-word">{t.word}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn btn-primary btn-lg"
        style={{ minHeight: 44, alignSelf: 'center' }}
        disabled={!allFilled}
        onClick={() => onDone()}
      >
        ✅ I'm done!
      </button>
    </div>
  );
}
