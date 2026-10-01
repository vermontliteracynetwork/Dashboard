import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useStore } from '../store/store';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';
import { SEL_STARTER_TOOLS, SEL_ZONE_LABELS, SEL_RECHECK_SNOOZE_OPTIONS } from '../lib/selZones';
import { resolveNpcVoiceProfile } from '../lib/npcVoices';
import type { SelZone, SelCheckIn } from '../types';
import SelZoneEmotionPicker from './SelZoneEmotionPicker';
import SelSupportMenu from './SelSupportMenu';
import ReadAloud from './ReadAloud';

// Lazy so three.js only loads when a re-check actually opens, not with
// every page (this component is mounted at the app root).
const NeighborCharacter3D = lazy(() => import('./NeighborCharacter3D'));

type Phase = 'ask' | 'result' | 'again' | 'bye';
type LogEntry = { sender: 'npc' | 'student' | 'history'; text: string };

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

// The automatic Neighbor re-check (docs/ZONES_OF_REGULATION_CHECKIN.md §3-4)
// — mounted once at the app root, polling for any of the current student's
// selCheckIns whose recheckDueAt has passed. Red gets the curriculum's
// "minimal language, no teaching, no shaming" branch; every other zone gets
// the full modeling-language script. Reuses the login check-in's own
// zone/emotion picker and support menu.
//
// Layout, direct teacher instruction (2026-10-01): the Neighbor's real 3D
// model (no background box, idle animation + a small hop on every new
// line) in the bottom-left corner, the Neighbor's current message in the
// center, the student's answer choices centered under it, and the full
// conversation as a running transcript on the right, the same left/right
// chat-bubble style as Town Square's Neighbor conversations. The
// transcript opens with this check-in's own history (the earlier pick, any
// tools tried, the last re-check) so it reads as one running record.
export default function SelRecheckPrompt() {
  const role = useStore((s) => s.role);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const selCheckIns = useStore((s) => s.selCheckIns);
  const npcVoiceOverrides = useStore((s) => s.npcVoiceOverrides);
  const completeSelRecheck = useStore((s) => s.completeSelRecheck);
  const addSelCheckInTool = useStore((s) => s.addSelCheckInTool);
  const addSelCheckInNote = useStore((s) => s.addSelCheckInNote);

  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>('ask');
  const [repickResult, setRepickResult] = useState<{ zone: SelZone; emotion: string } | null>(null);
  const [toolUsed, setToolUsed] = useState<string | undefined>(undefined);
  const [nextDelay, setNextDelay] = useState<number | undefined>(undefined);
  const [log, setLog] = useState<LogEntry[]>([]);
  const loggedPhaseRef = useRef<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const due: SelCheckIn | undefined =
    role === 'student' && currentStudentId
      ? selCheckIns
          .filter((c) => c.studentId === currentStudentId && c.recheckDueAt && !c.recheckCompleted && new Date(c.recheckDueAt).getTime() <= now)
          .sort((a, b) => (a.recheckDueAt! < b.recheckDueAt! ? -1 : 1))[0]
      : undefined;

  const student = students.find((s) => s.id === currentStudentId);
  const neighbor = QUEST1_NEIGHBORS.find((n) => n.id === due?.neighborId) ?? QUEST1_NEIGHBORS[0];
  const isRedBranch = due?.zone === 'red';

  // The Neighbor's lines for each step — shown big in the center and
  // appended once to the running transcript.
  const npcLines = (() => {
    if (!due) return [];
    if (phase === 'ask') {
      const opener = isRedBranch
        ? [`Hi ${student?.name ?? 'there'}. It's ${neighbor.name}. Checking in.`]
        : [
            `Hi ${student?.name ?? 'there'}. It's ${neighbor.name}.`,
            `I noticed you picked ${SEL_ZONE_LABELS[due.zone]} a little while ago. I just wanted to check in. No rush.`,
          ];
      return [...opener, 'How are you feeling right now?'];
    }
    if (phase === 'result' && repickResult) {
      if (repickResult.zone === 'green') {
        return [isRedBranch ? "Good to Go? I'm glad." : "You're in the Green Zone now. I'm glad you found what your body needed."];
      }
      if (isRedBranch && repickResult.zone !== 'red') return ["Good to Go? I'm glad."];
      return isRedBranch
        ? ["Let's find something that might help."]
        : [`When I feel ${repickResult.emotion.toLowerCase()}, I'm in the ${SEL_ZONE_LABELS[repickResult.zone]} Zone. One tool that helps me is one of these. Want to try it, or pick your own?`];
    }
    if (phase === 'again') return ['Do you want me to check on you again?'];
    if (phase === 'bye') {
      return [nextDelay ? `Okay! I'll check on you again in ${nextDelay} minutes.` : "Okay. I'm here if you need me. Bye for now!"];
    }
    return [];
  })();

  // Reset the flow (and seed the transcript with this record's history)
  // every time a NEW due check-in appears, including a re-re-check chained
  // from a snooze on the same record.
  const dueKey = due ? `${due.id}:${due.recheckDueAt}` : null;
  useEffect(() => {
    setPhase('ask');
    setRepickResult(null);
    setToolUsed(undefined);
    setNextDelay(undefined);
    loggedPhaseRef.current = null;
    if (!due) { setLog([]); return; }
    const history: LogEntry[] = [
      { sender: 'history', text: `${timeLabel(due.timestamp)}: you picked ${SEL_ZONE_LABELS[due.zone]}, ${due.emotion}.` },
    ];
    if (due.toolsUsedLabels.length > 0) history.push({ sender: 'history', text: `You tried: ${due.toolsUsedLabels.join(', ')}.` });
    if (due.recheckTimestamp && due.recheckZone) {
      history.push({ sender: 'history', text: `${timeLabel(due.recheckTimestamp)}: ${neighbor.name} checked in. You picked ${SEL_ZONE_LABELS[due.recheckZone]}${due.recheckEmotion ? `, ${due.recheckEmotion}` : ''}.` });
    }
    setLog(history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dueKey]);

  const phaseKey = dueKey ? `${dueKey}:${phase}` : null;
  useEffect(() => {
    if (!phaseKey || loggedPhaseRef.current === phaseKey || npcLines.length === 0) return;
    loggedPhaseRef.current = phaseKey;
    setLog((prev) => [...prev, ...npcLines.map((text) => ({ sender: 'npc' as const, text }))]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseKey]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [log.length]);

  if (!due) return null;

  const say = (text: string) => setLog((prev) => [...prev, { sender: 'student', text }]);
  const voice = resolveNpcVoiceProfile(neighbor.id, neighbor.voicePresetId, npcVoiceOverrides);
  const showSupport = phase === 'result' && repickResult && repickResult.zone !== 'green' && !(isRedBranch && repickResult.zone !== 'red');

  return (
    <div className="sel-convo" role="dialog" aria-modal="true" aria-label={`${neighbor.name} is checking in`}>
      <div className="sel-convo-stage">
        <div className="sel-convo-character" aria-hidden="true">
          <Suspense fallback={null}>
            <NeighborCharacter3D path={neighbor.modelPath} talkKey={phaseKey ?? ''} />
          </Suspense>
        </div>

        <div className="sel-convo-center">
          <div className="sel-convo-message" key={phaseKey}>
            <div className="sel-convo-name">
              <span>{neighbor.name}</span>
              <ReadAloud text={npcLines.join(' ')} small npcVoiceProfile={voice} />
            </div>
            {npcLines.map((line, i) => (
              <p key={i} className={`sel-convo-line${i === npcLines.length - 1 ? ' main' : ''}`}>{line}</p>
            ))}
            {phase === 'ask' && <p className="sel-convo-sub">All four zones are okay to feel. Pick the one that's true right now.</p>}
          </div>

          <div className="sel-convo-responses">
            {phase === 'ask' && (
              <SelZoneEmotionPicker
                hideQuestion
                onPick={(zone, emotion) => {
                  say(`I'm in the ${SEL_ZONE_LABELS[zone]} Zone. I feel ${emotion.toLowerCase()}.`);
                  setRepickResult({ zone, emotion });
                  setPhase('result');
                }}
              />
            )}

            {phase === 'result' && repickResult && (
              <>
                {showSupport && (
                  <SelSupportMenu
                    zone={repickResult.zone}
                    tools={student?.selZoneTools?.[repickResult.zone] ?? SEL_STARTER_TOOLS[repickResult.zone]}
                    onToolTap={(label) => { setToolUsed(label); addSelCheckInTool(due.id, label); say(`I'll try: ${label}.`); }}
                    onNoteSave={(text) => { addSelCheckInNote(due.id, text); say(`Note for my teacher: ${text}`); }}
                  />
                )}
                <div className="sel-convo-choices">
                  <button className="sel-pill" onClick={() => setPhase('again')}>Continue</button>
                </div>
              </>
            )}

            {phase === 'again' && repickResult && (
              <div className="sel-convo-choices">
                {SEL_RECHECK_SNOOZE_OPTIONS.map((min) => (
                  <button
                    key={min}
                    className="sel-pill"
                    onClick={() => { say(`Yes, in ${min} minutes please.`); setNextDelay(min); setPhase('bye'); }}
                  >
                    {min} min
                  </button>
                ))}
                <button
                  className="sel-pill sel-pill-secondary"
                  onClick={() => { say("No thanks, I'm okay."); setNextDelay(undefined); setPhase('bye'); }}
                >
                  No thanks, I'm okay
                </button>
              </div>
            )}

            {phase === 'bye' && repickResult && (
              <div className="sel-convo-choices">
                <button
                  className="sel-pill"
                  onClick={() => completeSelRecheck(due.id, repickResult.zone, repickResult.emotion, toolUsed, nextDelay)}
                >
                  Bye, {neighbor.name}!
                </button>
              </div>
            )}
          </div>
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
