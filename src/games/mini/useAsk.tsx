import type { NpcVoiceProfile } from '../../lib/npcVoices';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { MCQuestion, NativeGameId } from '../../types';
import { drawQuestion, pickableSets } from '../../lib/questionPick';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import { payForAnswers } from '../../lib/gameEarnings';
import { findActiveGameplayTask, gameplayQuestionPool, pickGameplayQuestion } from '../../lib/gameplayAssignment';
import QuestionScreen from '../../components/QuestionScreen';
import RoundSettings from '../../components/RoundSettings';
import GameStartCard from '../../components/GameStartCard';
import { NATIVE_GAME_CARDS } from '../../lib/nativeGames';
import { useRoundSettings, type RoundRange } from '../../lib/gameRounds';

// Where a native game's questions come from, shared by every game built from her 2026-09-30 lists.
// If the teacher has an open gameplay assignment for this game (a "specific game" task) or for any
// game (an "any game" task), its questions come first and every right answer counts toward it, the
// same way Shape Dash and Bakery Match do it (src/lib/gameplayAssignment.ts). Otherwise questions
// come from her starred (focus) sets. `notice` shows "Assignment complete!" once it is finished.
export function useGameQuestions(gameId: NativeGameId) {
  const student = useStore((s) => s.students.find((st) => st.id === s.currentStudentId));
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  const assignment = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      gameId,
    );
  }, [student, rotations, progress, gameId]);
  const [finished, setFinished] = useState<string | null>(null);
  // The student's own Reduce motion setting (the same one Shape Dash and Bubble Shooter use) stills
  // these games' decorative animations; see body.calm-games in index.css.
  const calm = !!student?.worldReduceMotion;
  useEffect(() => {
    if (!calm) return;
    document.body.classList.add('calm-games');
    return () => document.body.classList.remove('calm-games');
  }, [calm]);
  const next = useCallback((avoid?: string): MCQuestion => {
    if (assignment) { const g = pickGameplayQuestion(assignment.task, avoid); if (g) return g; }
    return drawQuestion(pickableSets(questionSets), avoid) ?? generateAutoQuestion();
  }, [assignment, questionSets]);
  const right = useCallback((q: MCQuestion) => {
    if (!student || !assignment || !gameplayQuestionPool(assignment.task).some((x) => x.id === q.id)) return;
    if (submitGameplayAnswer(student.id, assignment.subject, assignment.task, q.id, true)) setFinished(assignment.task.studentTitle || assignment.task.title);
  }, [student, assignment, submitGameplayAnswer]);
  const notice = finished ? (
    <div className="pf-overlay" style={{ zIndex: 60 }}>
      <div className="pf-panel fd-catch">
        <div className="fd-fish" aria-hidden>📋</div>
        <h2>Assignment complete!</h2>
        <p>You finished <b>{finished}</b> by playing. It is checked off. You can keep playing as long as you like.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => setFinished(null)}>Keep playing</button>
      </div>
    </div>
  ) : null;
  return { next, right, notice, assignment, student };
}

// Shared question plumbing for the native mini games built from her 2026-09-30 game list
// (Rescue Shelter, Fishing Dock, Farm Grow...). A game calls ask(label, onRight) when its action
// needs a question; wrong answers just try again, and pay() at the end gives $1 per right answer.
// Her rule for every native game (2026-10-08): kids choose the rounds (where a game has them) and
// the questions per round, and an assignment's own numbers lock them. Here "questions per round" is
// how many questions each action asks (1 to 5); `settings` is the ⚙️ button for the game's header.
export function useAsk(game: string, icon: string, gameId: NativeGameId, opts?: { rounds?: RoundRange; roundsLabel?: string; perLabel?: string; compact?: boolean; autoRead?: boolean; voice?: NpcVoiceProfile; startCard?: boolean }) {
  const { next, right: countRight, notice, assignment, student } = useGameQuestions(gameId);
  const ranges = { rounds: opts?.rounds, per: { min: 1, max: 5, def: 1 } };
  const rs = useRoundSettings(gameId, ranges, assignment?.task);
  const [open, setOpen] = useState<{ q: MCQuestion; label: string; onRight: () => void; onCancel?: () => void; left: number; total: number } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // Every game opens on its settings screen (teacher 2026-10-12); a game with its own start screen
  // passes startCard: false and shows `settingsPanel` there instead.
  const [started, setStarted] = useState(opts?.startCard === false);
  const settingsPanel = (
    <>
      <RoundSettings ranges={ranges} rounds={rs.rounds} perRound={rs.perRound} onRounds={rs.setRounds} onPerRound={rs.setPerRound} locked={rs.locked}
        roundsLabel={opts?.roundsLabel} perLabel={opts?.perLabel ?? 'Questions each time'} />
      {rs.locked && <p className="game-start-note">Your teacher set these numbers for your assignment.</p>}
    </>
  );
  const right = useRef(0);
  const ask = useCallback((label: string, onRight: () => void, onCancel?: () => void) => setOpen({ q: next(), label, onRight, onCancel, left: rs.perRound, total: rs.perRound }), [next, rs.perRound]);
  const pay = useCallback(() => {
    if (student && right.current > 0) payForAnswers(student.id, right.current, game, icon);
    right.current = 0;
  }, [student, game, icon]);
  const element = (
    <>
      {open && student && (
        <QuestionScreen
          key={`${open.q.id}-${open.left}`}
          whoLabel={assignment ? `${open.label} · 📋 counts for your assignment` : open.label}
          prompt={open.q.prompt}
          choices={open.q.choices}
          correctIndex={open.q.correctIndex}
          imageUrl={open.q.imageUrl}
          imageAlt={open.q.imageAlt}
          done={open.total - open.left}
          total={open.total}
          onCorrectAnswer={() => {
            right.current += 1; countRight(open.q);
            if (open.left > 1) { setOpen({ ...open, q: next(open.q.id), left: open.left - 1 }); return; }
            const cb = open.onRight; setOpen(null); cb();
          }}
          onSkip={() => setOpen((o) => (o ? { ...o, q: next(o.q.id) } : o))}
          onExit={() => { const c = open.onCancel; setOpen(null); c?.(); }}
          ttsSettings={student.ttsSettings}
          compact={opts?.compact}
          autoRead={opts?.autoRead}
          voice={opts?.voice}
        />
      )}
      {notice}
      {!started && student && (
        <GameStartCard title={game} intro={NATIVE_GAME_CARDS.find((c) => c.id === gameId)?.blurb} onStart={() => setStarted(true)} ttsSettings={student.ttsSettings}>
          {settingsPanel}
        </GameStartCard>
      )}
      {showSettings && (
        <div className="pf-overlay" onClick={() => setShowSettings(false)}>
          <div className="pf-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>Game settings</h2>
            <RoundSettings ranges={ranges} rounds={rs.rounds} perRound={rs.perRound} onRounds={rs.setRounds} onPerRound={rs.setPerRound} locked={rs.locked}
              roundsLabel={opts?.roundsLabel} perLabel={opts?.perLabel ?? 'Questions each time'} />
            <button type="button" className="btn btn-primary btn-lg" onClick={() => setShowSettings(false)}>Done</button>
          </div>
        </div>
      )}
    </>
  );
  const settings = <button type="button" className="btn game-settings-btn" onClick={() => setShowSettings(true)} aria-label="Game settings">⚙️</button>;
  return { ask, element, pay, settings, settingsPanel, started, rounds: rs.rounds, rightSoFar: () => right.current, asking: !!open, student };
}
