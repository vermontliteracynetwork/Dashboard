import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react';
import ReadAloud from './ReadAloud';
import type { Quest1Neighbor } from '../lib/worldQuest1';
import type { NpcVoiceProfile } from '../lib/npcVoices';

// Lazy so three.js only loads when a Neighbor scene actually opens.
const NeighborCharacter3D = lazy(() => import('./NeighborCharacter3D'));

export type NeighborLogEntry = { sender: 'npc' | 'student' | 'history'; text: string };

// The shared full-screen Neighbor conversation layout (teacher direction,
// 2026-10-01): the Neighbor's live 3D model bottom-left with no box, the
// current message big in the center, the student's choices centered under
// it, and a running transcript on the right. Used by the automatic SEL
// re-check and by a student-started "talk about my feelings" chat.
export default function NeighborScene({
  neighbor,
  voice,
  npcLines,
  sub,
  talkKey,
  log,
  children,
  onClose,
}: {
  neighbor: Quest1Neighbor;
  voice: NpcVoiceProfile;
  npcLines: string[];
  sub?: string;
  talkKey: string;
  log: NeighborLogEntry[];
  children: ReactNode;
  onClose?: () => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log.length]);

  return (
    <div className="sel-convo" role="dialog" aria-modal="true" aria-label={`Talking with ${neighbor.name}`}>
      <div className="sel-convo-stage">
        <div className="sel-convo-character" aria-hidden="true">
          <Suspense fallback={null}>
            <NeighborCharacter3D path={neighbor.modelPath} talkKey={talkKey} />
          </Suspense>
        </div>

        {onClose && (
          <button className="sel-convo-close" onClick={onClose}>
            I need a minute
          </button>
        )}

        <div className="sel-convo-center">
          <div className="sel-convo-message" key={talkKey}>
            <div className="sel-convo-name">
              <span>{neighbor.name}</span>
              <ReadAloud text={npcLines.join(' ')} small npcVoiceProfile={voice} />
            </div>
            {npcLines.map((line, i) => (
              <p key={i} className={`sel-convo-line${i === npcLines.length - 1 ? ' main' : ''}`}>{line}</p>
            ))}
            {sub && <p className="sel-convo-sub">{sub}</p>}
          </div>
          <div className="sel-convo-responses">{children}</div>
        </div>
      </div>

      <aside className="sel-convo-log" aria-label="Conversation so far">
        <h2 className="sel-convo-log-title">Talking with {neighbor.name}</h2>
        <div className="sel-convo-log-scroll">
          {log.map((m, i) =>
            m.sender === 'history' ? (
              <p key={i} className="sel-convo-history">{m.text}</p>
            ) : (
              <div key={i} className={`sel-convo-row ${m.sender}`}>
                {m.sender === 'npc' && <ReadAloud text={m.text} small npcVoiceProfile={voice} />}
                <div className={`sel-convo-bubble ${m.sender}`}>{m.text}</div>
              </div>
            ),
          )}
          <div ref={logEndRef} />
        </div>
      </aside>
    </div>
  );
}
