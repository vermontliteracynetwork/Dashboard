import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { SelZone } from '../types';
import FeelingsWheel from './FeelingsWheel';

// Every feelings check-in outside the login (pets, Neighbors, the Neighbor re-check, the take-a-break
// pet check after fast answers) picks its feeling on the spinning Feelings Wheel (Build Queue 235),
// shown full screen on top of the conversation. Same onPick(zone, word) as the old four-zone picker:
// the zone is the picked word's own zone (src/lib/feelingsWheel.ts). Closing the wheel leaves a button
// to open it again, so the conversation underneath is never stuck.
// hideQuestion is kept for the callers; the wheel always asks the question itself.
export default function SelZoneEmotionPicker({ onPick, greeting }: { onPick: (zone: SelZone, emotion: string) => void; hideQuestion?: boolean; greeting?: string }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" className="btn btn-primary btn-lg" style={{ minHeight: 56 }} onClick={() => setOpen(true)}>Spin the Feelings Wheel</button>
      {open && createPortal(
        <FeelingsWheel overlay greeting={greeting} onClose={() => setOpen(false)} onChoose={(n) => { setOpen(false); onPick(n.zone, n.w); }} />,
        document.body,
      )}
    </>
  );
}
