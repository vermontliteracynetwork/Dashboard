import { useEffect, useState } from 'react';
import { useStore } from '../store/store';
import { QUEST1_NEIGHBORS } from '../lib/worldQuest1';
import { SEL_STARTER_TOOLS, SEL_ZONE_LABELS, SEL_RECHECK_SNOOZE_OPTIONS } from '../lib/selZones';
import type { SelZone, SelCheckIn } from '../types';
import SelZoneEmotionPicker from './SelZoneEmotionPicker';
import SelSupportMenu from './SelSupportMenu';

type Phase = 'opener' | 'repick' | 'result' | 'close';

// The automatic Neighbor re-check (docs/ZONES_OF_REGULATION_CHECKIN.md §3-4)
// — mounted once at the app root (like TeacherHelpAlert), polling for any
// of the current student's selCheckIns whose recheckDueAt has passed.
// Red gets the curriculum's "minimal language, no teaching, no shaming"
// branch (opener and strategy line both shortened); every other zone gets
// the full modeling-language script. Reuses the exact same zone/emotion
// picker and support menu the login check-in uses (spec §3's "same inline
// components, not a new screen").
export default function SelRecheckPrompt() {
  const role = useStore((s) => s.role);
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const selCheckIns = useStore((s) => s.selCheckIns);
  const completeSelRecheck = useStore((s) => s.completeSelRecheck);
  const addSelCheckInTool = useStore((s) => s.addSelCheckInTool);
  const addSelCheckInNote = useStore((s) => s.addSelCheckInNote);

  const [now, setNow] = useState(() => Date.now());
  const [phase, setPhase] = useState<Phase>('opener');
  const [repickResult, setRepickResult] = useState<{ zone: SelZone; emotion: string } | null>(null);
  const [toolUsed, setToolUsed] = useState<string | undefined>(undefined);

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

  // Reset the local flow every time a NEW due check-in appears (including
  // a re-re-check chained from a snooze timer on the same record).
  const dueKey = due ? `${due.id}:${due.recheckDueAt}` : null;
  useEffect(() => {
    setPhase('opener');
    setRepickResult(null);
    setToolUsed(undefined);
  }, [dueKey]);

  if (!due) return null;

  const student = students.find((s) => s.id === currentStudentId);
  const neighbor = QUEST1_NEIGHBORS.find((n) => n.id === due.neighborId) ?? QUEST1_NEIGHBORS[0];
  const isRedBranch = due.zone === 'red';

  const openerLines = isRedBranch
    ? [`Hi ${student?.name ?? 'there'}. It's ${neighbor.name}. Checking in.`]
    : [
        `Hi ${student?.name ?? 'there'}. It's ${neighbor.name}.`,
        `I noticed you picked ${SEL_ZONE_LABELS[due.zone]} a little while ago.`,
        `I just wanted to check in. No rush.`,
      ];

  const closeOverlay = () => { setPhase('opener'); setRepickResult(null); setToolUsed(undefined); };

  return (
    <div className="overlay-backdrop" style={{ zIndex: 400 }}>
      <div className="chrome-frame stack sel-recheck-panel" style={{ padding: 24, maxWidth: 520, alignItems: 'center', textAlign: 'center' }}>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: '2rem' }} aria-hidden="true">🧑‍🤝‍🧑</span>
          <strong>{neighbor.name}</strong>
        </div>

        {phase === 'opener' && (
          <>
            {openerLines.map((line, i) => (
              <p key={i} style={{ margin: 0 }}>{line}</p>
            ))}
            <p style={{ margin: 0, fontWeight: 700 }}>How are you feeling right now?</p>
            <button className="btn btn-primary" onClick={() => setPhase('repick')}>Tell {neighbor.name}</button>
          </>
        )}

        {phase === 'repick' && (
          <SelZoneEmotionPicker
            onPick={(zone, emotion) => {
              setRepickResult({ zone, emotion });
              setPhase('result');
            }}
          />
        )}

        {phase === 'result' && repickResult && (
          <>
            {repickResult.zone === 'green' ? (
              <p style={{ margin: 0, fontWeight: 700 }}>
                {isRedBranch
                  ? "Good to Go? I'm glad."
                  : "You're in the Green Zone now. I'm glad you found what your body needed."}
              </p>
            ) : isRedBranch && repickResult.zone !== 'red' ? (
              <p style={{ margin: 0, fontWeight: 700 }}>Good to Go? I'm glad.</p>
            ) : (
              <>
                {!isRedBranch ? (
                  <p style={{ margin: 0 }}>
                    When I feel {repickResult.emotion.toLowerCase()}, I'm in the {SEL_ZONE_LABELS[repickResult.zone]} Zone.
                    One tool that helps me is one of these. Want to try it, or pick your own?
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>Let's find something that might help.</p>
                )}
                <SelSupportMenu
                  zone={repickResult.zone}
                  tools={student?.selZoneTools?.[repickResult.zone] ?? SEL_STARTER_TOOLS[repickResult.zone]}
                  onToolTap={(label) => { setToolUsed(label); addSelCheckInTool(due.id, label); }}
                  onNoteSave={(text) => addSelCheckInNote(due.id, text)}
                />
              </>
            )}
            <button className="btn btn-primary" onClick={() => setPhase('close')}>Continue</button>
          </>
        )}

        {phase === 'close' && repickResult && (
          <>
            <p style={{ margin: 0, fontWeight: 700 }}>Do you want me to check on you again?</p>
            <div className="row-wrap" style={{ justifyContent: 'center', gap: 8 }}>
              {SEL_RECHECK_SNOOZE_OPTIONS.map((min) => (
                <button
                  key={min}
                  className="btn btn-sm"
                  style={{ minHeight: 44 }}
                  onClick={() => { completeSelRecheck(due.id, repickResult.zone, repickResult.emotion, toolUsed, min); closeOverlay(); }}
                >
                  {min} min
                </button>
              ))}
              <button
                className="btn btn-sm btn-primary"
                style={{ minHeight: 44 }}
                onClick={() => { completeSelRecheck(due.id, repickResult.zone, repickResult.emotion, toolUsed, undefined); closeOverlay(); }}
              >
                No thanks, I'm okay
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
