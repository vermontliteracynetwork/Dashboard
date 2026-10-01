import { useState } from 'react';
import { useStore } from '../store/store';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';
import { SEL_STARTER_TOOLS, SEL_ZONE_FACE } from '../lib/selZones';
import type { SelZone } from '../types';
import SelZoneEmotionPicker from './SelZoneEmotionPicker';
import SelSupportMenu from './SelSupportMenu';

// The mandatory Zones of Regulation login check-in
// (docs/ZONES_OF_REGULATION_CHECKIN.md) — shown once per avatar tap, before
// the dashboard loads (StudentLogin.tsx renders this in place of navigating
// straight to Town Square). Picking Green ends the check-in immediately,
// no further screen (spec §1); any other zone opens the support menu, and
// leaving it schedules the automatic Neighbor re-check (spec §3-4).
export default function SelZoneCheckIn({ studentId, studentName, onDone }: { studentId: string; studentName: string; onDone: () => void }) {
  const student = useStore((s) => s.students.find((st) => st.id === studentId));
  const recordSelCheckIn = useStore((s) => s.recordSelCheckIn);
  const addSelCheckInTool = useStore((s) => s.addSelCheckInTool);
  const addSelCheckInNote = useStore((s) => s.addSelCheckInNote);
  const scheduleSelRecheck = useStore((s) => s.scheduleSelRecheck);

  const [picked, setPicked] = useState<{ zone: SelZone; emotion: string; checkInId: string } | null>(null);

  const handlePick = (zone: SelZone, emotion: string) => {
    const checkInId = recordSelCheckIn(studentId, zone, emotion);
    if (zone === 'green') {
      onDone();
      return;
    }
    setPicked({ zone, emotion, checkInId });
  };

  const handleContinue = () => {
    if (!picked) return;
    const neighbor = QUEST1_NEIGHBORS[Math.floor(Math.random() * QUEST1_NEIGHBORS.length)];
    scheduleSelRecheck(picked.checkInId, neighbor.id);
    onDone();
  };

  return (
    <div className="center-screen sel-checkin-screen">
      <div className="chrome-frame stack sel-checkin-panel" style={{ padding: 28, maxWidth: 560, alignItems: 'center', textAlign: 'center' }}>
        {!picked ? (
          <>
            <p className="sel-checkin-greeting">Hi {studentName}!</p>
            <SelZoneEmotionPicker onPick={handlePick} />
          </>
        ) : (
          <>
            <p className="sel-checkin-greeting" style={{ fontSize: '2rem', margin: 0 }} aria-hidden="true">{SEL_ZONE_FACE[picked.zone]}</p>
            <p style={{ margin: 0, fontWeight: 700 }}>Thanks for telling me. That's okay to feel.</p>
            <SelSupportMenu
              zone={picked.zone}
              tools={student?.selZoneTools?.[picked.zone] ?? SEL_STARTER_TOOLS[picked.zone]}
              onToolTap={(label) => addSelCheckInTool(picked.checkInId, label)}
              onNoteSave={(text) => addSelCheckInNote(picked.checkInId, text)}
            />
            <button className="btn btn-primary btn-lg" onClick={handleContinue}>
              Continue to your day
            </button>
          </>
        )}
      </div>
    </div>
  );
}
