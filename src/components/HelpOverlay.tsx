import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import ChatPanel from './ChatPanel';
import ReadAloud from './ReadAloud';

interface Props {
  studentId: string;
  onClose: () => void;
  // Claudia's daily-review audit: the Wizard ThunderSword lock (Town
  // Square) renders at zIndex 300, above the default .overlay-backdrop's
  // zIndex 100 this component normally uses — so opening Help from inside
  // that lock rendered it BEHIND the lock, invisible and unclickable,
  // directly contradicting this app's own "regulation is always reachable"
  // rule. Set true only when opening from inside a z-index-300+ overlay.
  aboveLock?: boolean;
}

export default function HelpOverlay({ studentId, onClose, aboveLock }: Props) {
  const navigate = useNavigate();
  const pingHelp = useStore((s) => s.pingHelp);
  const requestBreak = useStore((s) => s.requestBreak);
  const pets = useStore((s) => s.pets);
  const [pinged, setPinged] = useState(false);
  const [breakRequested, setBreakRequested] = useState(false);
  const [showChat, setShowChat] = useState(false);

  if (showChat) return <ChatPanel studentId={studentId} role="student" onClose={() => setShowChat(false)} aboveLock={aboveLock} />;

  // SEL co-regulation, strictly opt-in (Claudia's plan, Phase 5): a
  // trained companion shows up here purely as a passive comfort presence
  // for a student who's already bonded with one — never a new condition on
  // this already-free calm-down path, and never shown at all for a
  // student with no companion.
  const companion = pets.find((p) => p.studentId === studentId && p.following);
  // Direct tie-in the Part B backlog asked for: "check on your pet" as an
  // offered regulation-break activity, not just the passive comfort line
  // above — any owned pet counts (not only a trained companion), and it's
  // exactly as opt-in as everything else here: a suggestion, never a
  // requirement, and closing this panel without tapping it costs nothing.
  const ownedPets = pets.filter((p) => p.studentId === studentId);

  return (
    <div className="overlay-backdrop" style={aboveLock ? { zIndex: 310 } : undefined} onClick={onClose}>
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
          {ownedPets.length > 0 && (
            <button
              className="btn btn-sm"
              style={{ minHeight: 44 }}
              onClick={() => { onClose(); navigate('/world/home-room'); }}
            >
              🐾 Check on your pet
            </button>
          )}
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
