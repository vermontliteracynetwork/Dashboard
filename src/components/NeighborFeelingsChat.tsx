import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { SEL_STARTER_TOOLS, SEL_ZONE_LABELS } from '../lib/selZones';
import { resolveNpcVoiceProfile } from '../lib/npcVoices';
import type { SelZone } from '../types';
import SelZoneEmotionPicker from './SelZoneEmotionPicker';
import SelSupportMenu from './SelSupportMenu';
import NeighborScene, { type NeighborLogEntry } from './NeighborScene';

type Phase = 'ask' | 'result' | 'bye';

// Student-started "talk about my feelings" chat with any Neighbor in the
// open world (direct teacher instruction, 2026-10-01: students pick jokes
// or feelings when they chat with a Neighbor). Same scene and the same
// zone/emotion picker + support menu as the login check-in and the
// automatic re-check, and it saves a real check-in record the teacher sees
// on the SEL Check-Ins page (a Red pick alerts her exactly like login
// does). No automatic re-check is scheduled: the student came to talk on
// their own and can come back any time. "I need a minute" always closes
// it, nothing lost.
export default function NeighborFeelingsChat({ neighbor, onClose }: { neighbor: { id: string; name: string; voicePresetId: string; modelPath?: string }; onClose: () => void }) {
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const npcVoiceOverrides = useStore((s) => s.npcVoiceOverrides);
  const recordSelCheckIn = useStore((s) => s.recordSelCheckIn);
  const addSelCheckInTool = useStore((s) => s.addSelCheckInTool);
  const addSelCheckInNote = useStore((s) => s.addSelCheckInNote);
  const student = students.find((s) => s.id === currentStudentId);

  const [phase, setPhase] = useState<Phase>('ask');
  const [pick, setPick] = useState<{ zone: SelZone; emotion: string; recordId: string } | null>(null);
  const [log, setLog] = useState<NeighborLogEntry[]>([]);
  const loggedRef = useRef<Phase | null>(null);

  const npcLines = (() => {
    if (phase === 'ask') return [`Hi ${student?.name ?? 'there'}! I'm glad you want to talk.`, 'How are you feeling right now?'];
    if (phase === 'result' && pick) {
      if (pick.zone === 'green') return [`Thanks for telling me. You're in the Green Zone, feeling ${pick.emotion.toLowerCase()}.`];
      if (pick.zone === 'red') return ['Thank you for telling me.', "Let's find something that might help."];
      return [`Thanks for telling me. When I feel ${pick.emotion.toLowerCase()}, I'm in the ${SEL_ZONE_LABELS[pick.zone]} Zone too. Here are some tools that might help.`];
    }
    return ['Thanks for talking with me. You can come tell me how you feel any time.'];
  })();

  useEffect(() => {
    if (loggedRef.current === phase) return;
    loggedRef.current = phase;
    setLog((prev) => [...prev, ...npcLines.map((text) => ({ sender: 'npc' as const, text }))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const say = (text: string) => setLog((prev) => [...prev, { sender: 'student', text }]);
  const voice = resolveNpcVoiceProfile(neighbor.id, neighbor.voicePresetId, npcVoiceOverrides);

  return (
    <NeighborScene
      neighbor={neighbor}
      voice={voice}
      npcLines={npcLines}
      sub={phase === 'ask' ? "All four zones are okay to feel. Pick the one that's true right now." : undefined}
      talkKey={phase}
      log={log}
      onClose={onClose}
    >
      {phase === 'ask' && (
        <SelZoneEmotionPicker
          hideQuestion
          onPick={(zone, emotion) => {
            if (!student) return;
            say(`I'm in the ${SEL_ZONE_LABELS[zone]} Zone. I feel ${emotion.toLowerCase()}.`);
            const recordId = recordSelCheckIn(student.id, zone, emotion);
            setPick({ zone, emotion, recordId });
            setPhase('result');
          }}
        />
      )}

      {phase === 'result' && pick && (
        <>
          {pick.zone !== 'green' && (
            <SelSupportMenu
              zone={pick.zone}
              tools={student?.selZoneTools?.[pick.zone] ?? SEL_STARTER_TOOLS[pick.zone]}
              onToolTap={(label) => { addSelCheckInTool(pick.recordId, label); say(`I'll try: ${label}.`); }}
              onNoteSave={(text) => { addSelCheckInNote(pick.recordId, text); say(`Note for my teacher: ${text}`); }}
            />
          )}
          <div className="sel-convo-choices">
            <button className="sel-pill" onClick={() => setPhase('bye')}>Continue</button>
          </div>
        </>
      )}

      {phase === 'bye' && (
        <div className="sel-convo-choices">
          <button className="sel-pill" onClick={onClose}>Bye, {neighbor.name}!</button>
        </div>
      )}
    </NeighborScene>
  );
}
