import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../store/store';
import type { MCQuestion } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import WebpageFrame from '../../components/WebpageFrame';
import BakeryTreatWheel from '../../components/BakeryTreatWheel';
import { TILE_ART } from '../../lib/bakeryTiles';
import {
  createGrid,
  swapTiles,
  findMatches,
  isAdjacent,
  clearAndRefill,
  hasAnyValidMove,
  type Grid,
  type Pos,
} from '../../lib/matchThree';

// The Bakery — a new Town Square building/location (role 'bakery' in
// townLayout.ts), teacher supplies the 3D building model in Build Mode.
// Free-play match-3 game gated by real questions from the teacher's
// Question Sets library, same sourcing pattern as the Gas Pump's
// gasQuestionPool/generateAutoQuestion fallback in TownSquare.tsx — this
// is a location a student walks up to on their own, not an assigned Task,
// so there's no mastery queue or lives system, just Gas Pump's "pull a
// random question, fall back to a generated one" approach.
//
// Match-3 mechanics come from src/lib/matchThree.ts, a from-scratch
// implementation (see that file's header) — never copied from any GPL
// reference project.
const ROWS = 6;
const COLS = 6;
const CENTS_PER_COIN = 5; // same conversion PlatformerTask.tsx uses for in-game coins -> Class Cash
const QUESTION_EVERY_MATCHES = 4; // a question break pops up after every 4 cleared groups

function posKey(p: Pos): string {
  return `${p.row},${p.col}`;
}

function playSfx(name: 'match' | 'combo' | 'fail' | 'pop') {
  try {
    new Audio(`/sounds/bakery/${name}.wav`).play().catch(() => {});
  } catch { /* audio not available, no cue, no crash */ }
}

export default function BakeryMatch3() {
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const questionSets = useStore((s) => s.questionSets);
  const recordTransaction = useStore((s) => s.recordTransaction);
  const student = students.find((s) => s.id === currentStudentId);

  const [grid, setGrid] = useState<Grid>(() => createGrid(ROWS, COLS));
  const [selected, setSelected] = useState<Pos | null>(null);
  const [clearingKeys, setClearingKeys] = useState<Set<string>>(new Set());
  const [shakeKeys, setShakeKeys] = useState<Set<string>>(new Set());
  const [coins, setCoins] = useState(0);
  const [question, setQuestion] = useState<MCQuestion | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [busy, setBusy] = useState(false);
  const [showTreatWheel, setShowTreatWheel] = useState(false);
  const coinsRef = useRef(0);
  coinsRef.current = coins;
  const matchesSinceQuestionRef = useRef(0);

  const questionPool = useMemo(
    () => questionSets.filter((qs) => qs.kind === 'quiz').flatMap((qs) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc')),
    [questionSets],
  );
  const pickQuestion = (): MCQuestion => (questionPool.length > 0 ? questionPool[Math.floor(Math.random() * questionPool.length)] : generateAutoQuestion());

  // Pays out whatever coins were earned this visit the moment the student
  // leaves the Bakery, same "settle up on the way out" shape as
  // PlatformerTask's session-end payout.
  useEffect(() => {
    return () => {
      if (student && coinsRef.current > 0) {
        recordTransaction(student.id, coinsRef.current * CENTS_PER_COIN, '🥐 Bakery: treats matched', '🥐', 'task');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id]);

  const resolveCascades = async (startGrid: Grid) => {
    let working = startGrid;
    let cascadeSteps = 0;
    let groupsThisSwap = 0;

    for (;;) {
      const matched = findMatches(working);
      if (matched.size === 0) break;
      groupsThisSwap += 1;
      cascadeSteps += 1;

      setClearingKeys(new Set(matched));
      await new Promise((resolve) => setTimeout(resolve, 260));

      const earned = matched.size >= 5 ? 8 : matched.size === 4 ? 5 : 3;
      setCoins((c) => c + earned);
      playSfx(cascadeSteps > 1 || matched.size >= 4 ? 'combo' : 'match');

      working = clearAndRefill(working, matched);
      setGrid(working);
      setClearingKeys(new Set());
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    if (!hasAnyValidMove(working)) {
      // Non-punitive: a stuck board is never the student's fault to fix —
      // just quietly serve a fresh one instead of a "no moves left" dead end.
      working = createGrid(ROWS, COLS);
      setGrid(working);
    }

    if (groupsThisSwap > 0) {
      matchesSinceQuestionRef.current += groupsThisSwap;
      if (matchesSinceQuestionRef.current >= QUESTION_EVERY_MATCHES) {
        matchesSinceQuestionRef.current = 0;
        setQuestion(pickQuestion());
        setQuestionFeedback(null);
      }
    }
  };

  const handleTileClick = async (pos: Pos) => {
    if (busy || question) return;
    if (!selected) {
      setSelected(pos);
      return;
    }
    if (posKey(selected) === posKey(pos)) {
      setSelected(null);
      return;
    }
    if (!isAdjacent(selected, pos)) {
      setSelected(pos);
      return;
    }

    setBusy(true);
    const swapped = swapTiles(grid, selected, pos);
    const matched = findMatches(swapped);
    setSelected(null);

    if (matched.size === 0) {
      playSfx('fail');
      setShakeKeys(new Set([posKey(selected), posKey(pos)]));
      await new Promise((resolve) => setTimeout(resolve, 260));
      setShakeKeys(new Set());
      setBusy(false);
      return;
    }

    setGrid(swapped);
    await resolveCascades(swapped);
    setBusy(false);
  };

  const answerQuestion = (choiceIndex: number) => {
    if (!question) return;
    const correct = choiceIndex === question.correctIndex;
    if (correct) setCoins((c) => c + 5);
    setQuestionFeedback(correct ? 'correct' : 'wrong');
  };

  const closeQuestion = () => {
    setQuestion(null);
    setQuestionFeedback(null);
  };

  // Direct teacher instruction: "when the game is completed, the student
  // should have a wheel spin ... with only these bakery treat options."
  // The student decides when they're "done baking" and cashes out — pays
  // out coins immediately (so the unmount payout below becomes a no-op)
  // and hands off to the treat wheel.
  const finishAndSpin = () => {
    if (student && coinsRef.current > 0) {
      recordTransaction(student.id, coinsRef.current * CENTS_PER_COIN, '🥐 Bakery: treats matched', '🥐', 'task');
      setCoins(0);
    }
    setShowTreatWheel(true);
  };

  return (
    <div className="laptop-frame">
      <div className="laptop-screen">
        <div className="container stack">
          <WebpageFrame url="bakery" />
          <div className="space-between">
            <h2 style={{ margin: 0 }}>🥐 The Bakery</h2>
            <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>🪙 {coins}</span>
          </div>
          <p style={{ margin: 0, textAlign: 'center', opacity: 0.8 }}>
            Tap a treat, then tap a treat next to it to swap. Match 3 or more of the same treat to earn coins!
          </p>

          <div
            className="chrome-frame"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: 6,
              padding: 12,
              maxWidth: 480,
              margin: '0 auto',
              width: '100%',
            }}
          >
            {grid.map((row, r) =>
              row.map((kind, c) => {
                const pos: Pos = { row: r, col: c };
                const key = posKey(pos);
                const art = TILE_ART[kind];
                const isSelected = selected && posKey(selected) === key;
                const isClearing = clearingKeys.has(key);
                const isShaking = shakeKeys.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => handleTileClick(pos)}
                    aria-label={art.label}
                    disabled={busy || !!question}
                    style={{
                      aspectRatio: '1 / 1',
                      border: isSelected ? '3px solid var(--orange, #e08a2c)' : '2px solid transparent',
                      borderRadius: 10,
                      background: isSelected ? 'rgba(224,138,44,0.15)' : 'transparent',
                      padding: 4,
                      cursor: busy || question ? 'default' : 'pointer',
                      transform: isShaking ? 'translateX(3px)' : 'none',
                      opacity: isClearing ? 0.15 : 1,
                      transition: 'opacity 0.2s, transform 0.1s, background 0.15s',
                    }}
                  >
                    <img src={art.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
                  </button>
                );
              }),
            )}
          </div>

          {coins > 0 && (
            <button className="btn btn-primary btn-lg" style={{ minHeight: 44, alignSelf: 'center' }} onClick={finishAndSpin}>
              🎡 Finish Baking & Spin for a Treat!
            </button>
          )}
        </div>
      </div>
      <div className="laptop-deck" />

      {showTreatWheel && student && <BakeryTreatWheel studentId={student.id} onClose={() => setShowTreatWheel(false)} />}

      {question && (
        <div className="overlay-backdrop">
          <div className="overlay-panel chrome-frame" style={{ padding: 24, maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="content-well stack">
              <h2 style={{ margin: 0 }}>🍞 Quick Question!</h2>
              {questionFeedback ? (
                <>
                  <p style={{ margin: 0, fontWeight: 700 }}>
                    {questionFeedback === 'correct' ? '🎉 Correct! +5 bonus coins.' : "💛 Not quite! Let's keep baking."}
                  </p>
                  <button className="btn btn-lg btn-primary" style={{ minHeight: 44 }} onClick={closeQuestion}>Back to the Bakery</button>
                </>
              ) : (
                <>
                  <p style={{ margin: 0, fontWeight: 700 }}>{question.prompt}</p>
                  {question.imageUrl && <img src={question.imageUrl} alt={question.imageAlt ?? ''} style={{ maxWidth: '100%', borderRadius: 10 }} />}
                  <div className="stack" style={{ gap: 8 }}>
                    {question.choices.map((choice, i) => (
                      <button key={i} className="btn btn-lg" style={{ minHeight: 44, justifyContent: 'flex-start', textAlign: 'left' }} onClick={() => answerQuestion(i)}>
                        {choice}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
