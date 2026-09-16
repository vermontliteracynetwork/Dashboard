import { useState } from 'react';
import { useStore } from '../store/store';
import ChatPanel from './ChatPanel';
import ReadAloud from './ReadAloud';

interface Props {
  studentId: string;
  onClose: () => void;
}

export default function HelpOverlay({ studentId, onClose }: Props) {
  const pingHelp = useStore((s) => s.pingHelp);
  const requestBreak = useStore((s) => s.requestBreak);
  const pets = useStore((s) => s.pets);
  const [pinged, setPinged] = useState(false);
  const [breakRequested, setBreakRequested] = useState(false);
  const [showChat, setShowChat] = useState(false);

  if (showChat) return <ChatPanel studentId={studentId} role="student" onClose={() => setShowChat(false)} />;

  // SEL co-regulation, strictly opt-in (Claudia's plan, Phase 5): a
  // trained companion shows up here purely as a passive comfort presence
  // for a student who's already bonded with one — never a new condition on
  // this already-free calm-down path, and never shown at all for a
  // student with no companion.
  const companion = pets.find((p) => p.studentId === studentId && p.following);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            <h2 style={{ margin: 0 }}>🧘 Take a Moment</h2>
            <ReadAloud text="Take a moment. Breathe in as the circle grows. Breathe out as it shrinks. No rush. Stay here as long as you'd like." small />
          </div>
          <p>Breathe in as the circle grows. Breathe out as it shrinks.</p>
          <div className="breathe-circle" />
          {companion && (
            <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>🐾 {companion.customName} is here with you.</p>
          )}
          <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>No rush. Stay here as long as you'd like.</p>
          <hr className="divider" style={{ width: '100%' }} />
          {pinged ? (
            <>
              <p>🙋 Your teacher has been quietly let know. They'll come check on you.</p>
              <button className="btn btn-pink" onClick={() => setShowChat(true)}>
                💬 Chat with your teacher
              </button>
            </>
          ) : (
            <button
              className="btn btn-pink"
              onClick={() => {
                pingHelp(studentId);
                setPinged(true);
              }}
            >
              🙋 I need my teacher
            </button>
          )}
          {breakRequested ? (
            <p>🌿 Your teacher will see your break request soon.</p>
          ) : (
            <button
              className="btn btn-pink"
              onClick={() => {
                requestBreak(studentId);
                setBreakRequested(true);
              }}
            >
              🌿 I need a break
            </button>
          )}
          <button className="btn btn-primary btn-lg" onClick={onClose}>
            I'm ready to go back
          </button>
        </div>
      </div>
    </div>
  );
}
