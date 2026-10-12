import { useState } from 'react';

// Her rule (2026-10-01): "while in chess game, (and all games) give confirmation menu if attempting
// to leave game". The ✕ Leave button for the native games from her 2026-09-30 lists asks first.
export default function LeaveButton({ onLeave, note = 'Everything you collected is saved, and your right answers are paid when you leave.' }: { onLeave: () => void; note?: string }) {
  const [ask, setAsk] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setAsk(true)}>✕ Leave</button>
      {ask && (
        <div className="pf-overlay" style={{ zIndex: 70 }} onClick={() => setAsk(false)}>
          <div className="pf-panel fd-catch leave-confirm" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-label="Leave this game?">
            <div className="fd-fish" aria-hidden>⚠️</div>
            <h2>Leave this game?</h2>
            <p>{note}</p>
            <div className="pf-detail-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setAsk(false)}>Keep playing</button>
              <button type="button" className="btn btn-lg" onClick={() => { setAsk(false); onLeave(); }}>Leave</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
