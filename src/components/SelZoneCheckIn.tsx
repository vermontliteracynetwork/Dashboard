import { useState } from 'react';
import { useStore } from '../store/store';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';
import { questNeighborIds } from '../style/npcRoster';
import { SEL_STARTER_TOOLS, SEL_ZONE_COLORS, SEL_ZONE_LABELS } from '../lib/selZones';
import { ENERGY_FACE, ENERGY_STEPS, type Energy } from '../lib/supernature';
import { feelingImg, type FeelingNode } from '../lib/feelingsWheel';
import type { SelZone } from '../types';
import SelSupportMenu from './SelSupportMenu';
import FeelingsWheel from './FeelingsWheel';
import { speak } from './ReadAloud';
import SelMemoryStep, { type SelMemory } from './SelMemoryStep';
import { uploadImage } from '../lib/upload';

// The mandatory Zones of Regulation login check-in. Since Build Queue 234 the feeling comes from the
// spinning Feelings Wheel (every word carries its zone), then the student picks their energy level
// with the same five faces as the Supernature Habitat, then the zone's support menu as before.
// Earlier notes: the login check-in
// (docs/ZONES_OF_REGULATION_CHECKIN.md) — shown once per avatar tap, before
// the dashboard loads (StudentLogin.tsx renders this in place of navigating
// straight to Town Square). Picking Green ends the check-in immediately,
// no further screen (spec §1); any other zone opens the support menu, and
// leaving it schedules the automatic Neighbor re-check (spec §3-4).
export default function SelZoneCheckIn({ studentId, studentName, onDone }: { studentId: string; studentName: string; onDone: () => void }) {
  const student = useStore((s) => s.students.find((st) => st.id === studentId));
  const recordSelCheckIn = useStore((s) => s.recordSelCheckIn);
  const styleLooks = useStore((s) => s.styleLooks);
  const addSelCheckInTool = useStore((s) => s.addSelCheckInTool);
  const addSelCheckInNote = useStore((s) => s.addSelCheckInNote);
  const scheduleSelRecheck = useStore((s) => s.scheduleSelRecheck);
  const markSelLoginCheckInDone = useStore((s) => s.markSelLoginCheckInDone);
  const mergeStyleRow = useStore((s) => s.mergeStyleRow);
  // Build Queue 269: a memory of the day (picture and caption) comes first, then the Feelings Wheel.
  const [memory, setMemory] = useState<SelMemory | null | undefined>(undefined);

  const [feeling, setFeeling] = useState<FeelingNode | null>(null);
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [picked, setPicked] = useState<{ zone: SelZone; emotion: string; checkInId: string } | null>(null);

  const chooseFeeling = (n: FeelingNode) => {
    setFeeling(n); setEnergy(null);
    window.setTimeout(() => speak(`You feel ${n.w.toLowerCase()}. What is your energy level?`), 250);
  };
  const chooseEnergy = (e: Energy) => {
    if (!feeling || energy) return;
    setEnergy(e);
    speak(`${e} energy`);
    const zone = feeling.zone, emotion = feeling.w;
    window.setTimeout(() => {
      const checkInId = recordSelCheckIn(studentId, zone, emotion, e);
      if (memory) {
        // Saved with the check-in in the student's selmem row (no new database column); the picture follows when uploaded.
        const owner = `selmem:${studentId}`, at = new Date().toISOString(), caption = memory.caption;
        mergeStyleRow(owner, { [checkInId]: { caption, at } });
        if (memory.file) uploadImage(memory.file).then((photo) => mergeStyleRow(owner, { [checkInId]: { caption, at, photo } })).catch(() => { /* the caption is still saved */ });
      }
      if (zone === 'green') {
        markSelLoginCheckInDone(studentId);
        onDone();
        return;
      }
      setPicked({ zone, emotion, checkInId });
    }, 450);
  };

  const handleContinue = () => {
    if (!picked) return;
    // Only a Neighbor who is still in town comes back to check in (Build Queue 204).
    const inTown = questNeighborIds(styleLooks);
    const pool = inTown.length ? inTown : QUEST1_NEIGHBORS.map((n) => n.id);
    scheduleSelRecheck(picked.checkInId, pool[Math.floor(Math.random() * pool.length)]);
    markSelLoginCheckInDone(studentId);
    onDone();
  };

  if (memory === undefined) return <SelMemoryStep name={studentName.split(' ')[0]} tts={student?.ttsSettings} onNext={setMemory} />;
  if (!feeling) return <FeelingsWheel studentName={studentName} onChoose={chooseFeeling} />;

  if (!picked) {
    return (
      <div className="fw-root">
        <div className="fw-energy">
          <img className="fw-energy-pic" src={feelingImg(feeling.w)} alt="" />
          <h1>You feel {feeling.w.toLowerCase()}.
            <button type="button" className="fw-say" aria-label="Listen" onClick={() => speak(`You feel ${feeling.w.toLowerCase()}. What is your energy level?`)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>
            </button>
          </h1>
          <span className="fw-zone" style={{ alignSelf: 'center', background: SEL_ZONE_COLORS[feeling.zone], color: feeling.zone === 'yellow' ? '#231b33' : '#fff' }}>{SEL_ZONE_LABELS[feeling.zone]} Zone</span>
          <p>What is your energy level?</p>
          <div className="fw-energy-row">
            {ENERGY_STEPS.map((e) => (
              <button key={e} type="button" className={`fw-energy-btn${energy === e ? ' on' : ''}`} onClick={() => chooseEnergy(e)}>
                <img src={ENERGY_FACE[e]} alt="" />{e[0].toUpperCase() + e.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="fw-btn" onClick={() => { setFeeling(null); setEnergy(null); }}>Change my feeling</button>
        </div>
      </div>
    );
  }

  return (
    <div className="center-screen sel-checkin-screen">
      <div className="chrome-frame stack sel-checkin-panel" style={{ padding: 28, maxWidth: 560, alignItems: 'center', textAlign: 'center' }}>
        <img className="fw-energy-pic" src={feelingImg(feeling.w)} alt="" style={{ width: 120 }} />
        <p style={{ margin: 0, fontWeight: 700 }}>Thanks for telling me. That's okay to feel.</p>
        <SelSupportMenu
          zone={picked.zone}
          tools={student?.selZoneTools?.[picked.zone] ?? SEL_STARTER_TOOLS[picked.zone]}
          feeling={picked.emotion}
          onToolTap={(label) => addSelCheckInTool(picked.checkInId, label)}
          onNoteSave={(text) => addSelCheckInNote(picked.checkInId, text)}
        />
        <button className="btn btn-primary btn-lg" onClick={handleContinue}>
          Continue to your day
        </button>
      </div>
    </div>
  );
}
