import { useState } from 'react';
import { useStore } from '../store/store';

interface Props {
  studentId: string;
  onClose: () => void;
}

export default function HelpOverlay({ studentId, onClose }: Props) {
  const pingHelp = useStore((s) => s.pingHelp);
  const [pinged, setPinged] = useState(false);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="overlay-panel chrome-frame" style={{ padding: 24 }} onClick={(e) => e.stopPropagation()}>
        <div className="content-well stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2>🧘 Take a Moment</h2>
          <p>Breathe in as the circle grows. Breathe out as it shrinks.</p>
          <div className="breathe-circle" />
          <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>No rush — stay here as long as you'd like.</p>
          <hr className="divider" style={{ width: '100%' }} />
          {pinged ? (
            <p>🙋 Your teacher has been quietly let know. They'll come check on you.</p>
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
          <button className="btn btn-primary btn-lg" onClick={onClose}>
            I'm ready to go back
          </button>
        </div>
      </div>
    </div>
  );
}
