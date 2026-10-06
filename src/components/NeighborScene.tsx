import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import ReadAloud from './ReadAloud';
import { lazyFresh } from '../lib/freshBuild';
import type { NpcVoiceProfile } from '../lib/npcVoices';
import { DEFAULT_NPC_LOOKS, useNpcProfiles } from '../style/npcs';
import { useStore } from '../store/store';
import { defaultLook } from '../style/species';
import type { StyleLook } from '../style/types';

// Lazy so three.js only loads when a Neighbor scene actually opens.
const NpcPortrait3D = lazyFresh(() => import('./NpcPortrait3D'));

export type NeighborLogEntry = { sender: 'npc' | 'student' | 'history'; text: string };
// Anyone who can be talked to: a Neighbor or a Townsperson.
export type SceneNeighbor = { id: string; name: string; modelPath?: string };

const isLook = (x: unknown): x is StyleLook => {
  const l = x as StyleLook;
  return !!l && !!l.species && !!l.body && !!l.outfit;
};
const MS_PER_CHAR = 38;

// The shared full-screen conversation scene (teacher direction 2026-10-04,
// for every conversation with a Neighbor or Townsperson, not just
// feelings): the Neighbor's live Style character bottom-left and the
// student's own Style character bottom-right, both animated, each one's
// mouth moving while their line is being "said"; the current message big in
// the middle with the reply buttons under it (always tappable); and a small
// floating chat window top-left (like a streamer's chat) that types each
// line out as it's said.
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
  neighbor: SceneNeighbor;
  voice: NpcVoiceProfile;
  npcLines: string[];
  sub?: string;
  talkKey: string;
  log: NeighborLogEntry[];
  children: ReactNode;
  onClose?: () => void;
}) {
  const profile = useNpcProfiles()[neighbor.id];
  const name = profile?.name ?? neighbor.name;
  const studentId = useStore((s) => s.currentStudentId);
  const studentName = useStore((s) => s.students.find((st) => st.id === s.currentStudentId)?.name ?? 'You');
  const studentRow = useStore((s) => s.styleLooks.find((r) => r.ownerId === studentId));
  const studentLook = useMemo(() => (isLook(studentRow?.look) ? studentRow!.look : defaultLook('dog')), [studentRow]);

  // Typewriter for the newest chat line, and who is talking while it types.
  const [typed, setTyped] = useState(0);
  const last = log[log.length - 1];
  const lastLen = last?.text.length ?? 0;
  useEffect(() => {
    setTyped(0);
    if (!last) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const n = Math.floor((performance.now() - start) / MS_PER_CHAR);
      setTyped(Math.min(n, lastLen));
      if (n >= lastLen) window.clearInterval(id);
    }, 30);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.length]);
  const speaking = last && typed < lastLen ? last.sender : null;

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log.length, typed]);

  return (
    <div className="sel-convo" role="dialog" aria-modal="true" aria-label={`Talking with ${name}`}>
      <div className="sel-convo-character" aria-hidden="true">
        <Suspense fallback={null}>
          {/* Always their Seamstress-made Style character (teacher, 2026-10-06:
              "ensure all visuals of neighbors ... reflect the newly designed
              characters from the seamstress, not the old characters"). */}
          <NpcPortrait3D look={profile?.look ?? DEFAULT_NPC_LOOKS[neighbor.id] ?? defaultLook('dog')} talkKey={talkKey} talking={speaking === 'npc'} />
        </Suspense>
        <span className="sel-convo-tag">{name}</span>
      </div>
      <div className="sel-convo-character me" aria-hidden="true">
        <Suspense fallback={null}>
          <NpcPortrait3D look={studentLook} talkKey="me" talking={speaking === 'student'} facing="left" />
        </Suspense>
        <span className="sel-convo-tag">{studentName}</span>
      </div>

      <aside className="sel-convo-log" aria-label="Chat">
        <div className="sel-convo-log-title">💬 Chat with {name}</div>
        <div className="sel-convo-log-scroll">
          {log.map((m, i) => {
            const text = i === log.length - 1 ? m.text.slice(0, typed) : m.text;
            if (m.sender === 'history') return <p key={i} className="sel-convo-history">{text}</p>;
            return (
              <p key={i} className={`sel-convo-chatline ${m.sender}`}>
                <span className="who">{m.sender === 'npc' ? name : studentName}:</span> {text}
                {i === log.length - 1 && typed < m.text.length && <span className="caret">▍</span>}
              </p>
            );
          })}
          <div ref={logEndRef} />
        </div>
      </aside>

      {onClose && (
        <button className="sel-convo-close" onClick={onClose}>
          I need a minute
        </button>
      )}

      <div className="sel-convo-stage">
        <div className="sel-convo-center">
          <div className="sel-convo-message" key={talkKey}>
            <div className="sel-convo-name">
              <span>{name}</span>
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
    </div>
  );
}
