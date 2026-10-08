import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { lazyFresh } from '../../lib/freshBuild';
import { useLocation } from 'react-router-dom';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { useStore } from '../../store/store';
import { useBack } from '../../lib/navTrail';
import ReadAloud from '../../components/ReadAloud';
import {
  PIECE_NAME, PIECE_RULE, PIECE_VALUE, describeMove, explainIllegal, other, pickComputerMove, riskyTargets, suggestMove,
  kingSquare, type Hint, type Level,
} from '../../lib/chessCoach';
import { slimeSound } from '../../lib/slimeSounds';
import { useNpcProfiles, type NpcProfile } from '../../style/npcs';
import { pickRival, recordGameMemory } from '../../lib/gameRivals';
const NpcPortrait3D = lazyFresh(() => import('../../components/NpcPortrait3D'));
import { payForAnswers } from '../../lib/gameEarnings';
import type { ChessGameRecord, MCQuestion, QuestionSet } from '../../types';
import { generateAutoQuestion } from '../../lib/autoQuestions';
import QuestionScreen from '../../components/QuestionScreen';
import QuestionSourcePicker, { type QuestionSourceMode } from '../../components/QuestionSourcePicker';
import { findActiveGameplayTask, pickGameplayQuestion } from '../../lib/gameplayAssignment';

// Slime Chess — a native game reached through a Town Square object with
// the 'chess' role (teacher places the uploaded Chess Set model in Build
// Mode). Direct teacher instruction, 2026-10-01: real chess with full
// rules, a slime / bubbles / bright-colors theme from the teacher's
// Jelly Chess pack, fun pop noises on every move, and, because it's for
// neurodivergent kids, always-visible help: every legal path for the
// picked piece, risky squares marked, hints with a reason, and a
// plain-language speech bubble explaining exactly why any move that
// doesn't work doesn't work. (The "danger" glow and the tap-their-piece
// "their reach" preview were removed by direct teacher instruction: only
// can move / can capture / risky are shown.)
//
// Rules engine: chess.js (castling, en passant, promotion, check,
// checkmate, stalemate, threefold repetition, 50-move rule, insufficient
// material). The coach, the computer opponent and every explanation live
// in src/lib/chessCoach.ts. Sounds are synthesized (src/lib/slimeSounds.ts).

type Screen = 'menu' | 'play';
type Mode = 'computer' | 'friends';
type Tone = 'info' | 'good' | 'warn' | 'hint' | 'check';

interface Theme {
  id: 1 | 2 | 3;
  name: string;
  team: Record<Color, string>;
  tiles: [number, number]; // light, dark tile index in that set's tile row
}
const THEMES: Theme[] = [
  { id: 1, name: 'Berry Blast', team: { w: 'Strawberry', b: 'Blueberry' }, tiles: [3, 2] },
  { id: 2, name: 'Citrus Splash', team: { w: 'Lime', b: 'Lemon' }, tiles: [5, 4] },
  { id: 3, name: 'Grape Fizz', team: { w: 'Grape', b: 'Icy' }, tiles: [3, 2] },
];
const PIECE_FILE: Record<PieceSymbol, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const pieceSrc = (theme: Theme, color: Color, type: PieceSymbol) => `/chess/piece-${theme.id}-${color === 'w' ? 'a' : 'b'}-${PIECE_FILE[type]}.png`;
const FILES = 'abcdefgh';
const LEVEL_LABEL: Record<Level, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

type IdMap = Record<string, string>;
function freshIds(chess: Chess): IdMap {
  const ids: IdMap = {};
  for (const row of chess.board()) for (const cell of row) if (cell) ids[cell.square] = `${cell.color}${cell.type}-${cell.square}-${Math.random().toString(36).slice(2, 6)}`;
  return ids;
}
function applyMoveIds(ids: IdMap, m: Move): IdMap {
  const next = { ...ids };
  const id = next[m.from];
  delete next[m.from];
  if (m.flags.includes('e')) delete next[`${m.to[0]}${m.from[1]}`];
  next[m.to] = id;
  const rank = m.from[1];
  if (m.flags.includes('k')) { next[`f${rank}`] = next[`h${rank}`]; delete next[`h${rank}`]; }
  if (m.flags.includes('q')) { next[`d${rank}`] = next[`a${rank}`]; delete next[`a${rank}`]; }
  return next;
}

interface Pop { id: string; square: Square; src: string }

// Direct teacher instructions: the computer hesitates before moving, like
// a real opponent thinking it over ("a 5-10 second moment of hesitation"),
// and then "after the student has answered the question, the system needs
// to wait 10 seconds before the computer player takes their turn"), later
// shortened by direct instruction: "reduce the computer waiting time as
// they're taking their turn to six seconds". The computer waits 6 seconds
// after the student's move (which always comes after that turn's question).
const COMPUTER_THINK_MS = 6000;
// Questions come only at the start of a player's own turn, never during
// the computer's (direct teacher instruction). After the computer moves,
// the board stays fully visible for 3 seconds so the student sees what it
// did ("give a 3 second wait between the computer players move and the
// question"). Two-player games get the same 3 seconds after each move,
// then a "It's Blueberry's turn!" card so it's clear who answers.
const QUESTION_AFTER_COMPUTER_MS = 3000;
const FRIEND_MOVE_SETTLE_MS = 3000;
const TURN_CARD_MS = 2200;

export default function SlimeChess() {
  const location = useLocation();
  // Opened from a Neighbor's "Play a game" (Town Square): play with them.
  const rivalId = (location.state as { rival?: string } | null)?.rival ?? null;
  // Back follows the shared trail: the Game Dashboard, the Computer or Town Square, wherever they came from.
  const back = useBack();
  const backLabel = back.label.replace(/^\S+\s/, '');
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const student = students.find((s) => s.id === currentStudentId);

  // Question gate: direct teacher request, "one question should be asked
  // to the student before each turn". Same sourcing as Castle Defense /
  // Bakery Match: an active Slime Chess (or any-game) assignment wins,
  // otherwise random from the teacher's quiz sets or one set the student
  // picks on the menu, with the auto-generated question as the fallback.
  // Wrong answers cost nothing (QuestionScreen's retry model), and after
  // one miss the student can swap to a different question.
  const questionSets = useStore((s) => s.questionSets);
  const rotations = useStore((s) => s.rotations);
  const progress = useStore((s) => s.progress);
  const submitGameplayAnswer = useStore((s) => s.submitGameplayAnswer);
  // Personal leaderboard (direct teacher request): every game against the
  // computer is saved with its XP, the traditional chess point value of
  // each piece the student captured (worldchess.com/chess-terms/
  // chess-piece-point-values): Pawn 1, Knight 3, Bishop 3, Rook 5,
  // Queen 9. Two-player games aren't saved, since they're shared.
  const recordChessGame = useStore((s) => s.recordChessGame);
  const allChessGames = useStore((s) => s.chessGames);
  const myGames = useMemo(() => allChessGames.filter((g) => g.studentId === currentStudentId), [allChessGames, currentStudentId]);
  const gameIdRef = useRef<string>('');
  const activeGameplayTask = useMemo(() => {
    if (!student) return null;
    return findActiveGameplayTask(
      { math: rotations[student.id]?.math ?? [], literacy: rotations[student.id]?.literacy ?? [] },
      { math: progress[student.id]?.math?.completedTaskIds ?? [], literacy: progress[student.id]?.literacy?.completedTaskIds ?? [] },
      'chess',
    );
  }, [student, rotations, progress]);
  const usableQuestionSets = useMemo<QuestionSet[]>(
    () => questionSets.filter((qs) => qs.kind === 'quiz' && qs.questions.some((q) => q.kind === 'mc')),
    [questionSets],
  );
  const [questionMode, setQuestionMode] = useState<QuestionSourceMode>({ mode: 'random' });
  const [challengeQuestion, setChallengeQuestion] = useState<MCQuestion | null>(null);
  // The move number (history length) the last question was asked for, so
  // each turn asks exactly once and Undo never re-asks.
  const askedForPly = useRef<number | null>(null);
  // Two-player games: whose turn the "It's X's turn!" card is showing.
  const [turnCard, setTurnCard] = useState<Color | null>(null);
  const pickQuestion = (avoidId?: string): MCQuestion => {
    if (activeGameplayTask) {
      const gameplayPick = pickGameplayQuestion(activeGameplayTask.task, avoidId);
      if (gameplayPick) return gameplayPick;
    }
    const pool = questionMode.mode === 'set'
      ? (questionSets.find((qs) => qs.id === questionMode.setId)?.questions.filter((q): q is MCQuestion => q.kind === 'mc') ?? [])
      : questionSets.filter((qs) => qs.kind === 'quiz').flatMap((qs) => qs.questions.filter((q): q is MCQuestion => q.kind === 'mc'));
    const choices = pool.length > 1 && avoidId ? pool.filter((q) => q.id !== avoidId) : pool;
    return choices.length > 0 ? choices[Math.floor(Math.random() * choices.length)] : generateAutoQuestion();
  };

  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('computer');
  const [level, setLevel] = useState<Level>('easy');
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [human, setHuman] = useState<Color>('w');
  const [soundOn, setSoundOn] = useState(true);
  // Reduced motion (direct teacher request): stops the wobbling,
  // bouncing, pulsing and floating bubbles, and pieces slide without
  // animation. Starts on if the student already has Reduce Motion on in
  // Town Square or the device asks for less motion.
  const [calm, setCalm] = useState<boolean>(() => {
    if (student?.worldReduceMotion) return true;
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
  });
  // Settings pie menu (gear in the turn bubble). Direct teacher request:
  // every game button except Town Square folds into one gear that opens a
  // round pie menu. pieAt is the gear's screen spot when it opened.
  const gearRef = useRef<HTMLButtonElement | null>(null);
  const [pieAt, setPieAt] = useState<DOMRect | null>(null);
  // Direct teacher instruction: leaving a game in progress always asks
  // first. 'leave' = back to Town Square / Computer, 'new' = New game.
  const [confirmLeave, setConfirmLeave] = useState<'leave' | 'new' | null>(null);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [ids, setIds] = useState<IdMap>(() => freshIds(gameRef.current));
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [coach, setCoach] = useState<{ text: string; tone: Tone }>({ text: '', tone: 'info' });
  const [thinking, setThinking] = useState(false);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shakeSquare, setShakeSquare] = useState<Square | null>(null);
  const [gameOver, setGameOver] = useState<{ title: string; text: string; win: boolean | null } | null>(null);
  const aiTimer = useRef<number | null>(null);
  // The opponent is a random Neighbor, not "the computer" (teacher
  // direction 2026-10-04, see src/lib/gameRivals.ts). A ref too, since the
  // computer's move runs from a timer that can outlive the render it was
  // queued in.
  const npcProfiles = useNpcProfiles();
  const [rival, setRival] = useState<NpcProfile | null>(null);
  const rivalRef = useRef<NpcProfile | null>(null);
  const rivalName = rival?.name ?? 'Your Neighbor';

  useEffect(() => () => { if (aiTimer.current) window.clearTimeout(aiTimer.current); }, []);

  const game = gameRef.current;
  const turn = game.turn();
  const names = theme.team;
  const bottom: Color = mode === 'computer' ? human : 'w';
  const sound = (fn: () => void) => { if (soundOn) fn(); };
  const isHumanTurn = mode === 'friends' || turn === human;
  // A game counts as in progress once anyone has moved and it isn't over.
  const inProgress = screen === 'play' && !gameOver && !game.isGameOver() && history.length > 0;
  const myXp = (moves: Move[]) => moves.filter((m) => m.color === human && m.captured).reduce((sum, m) => sum + PIECE_VALUE[m.captured as PieceSymbol], 0);
  const saveGame = (result: 'win' | 'loss' | 'draw' | 'unfinished') => {
    if (mode !== 'computer' || !currentStudentId || !gameIdRef.current) return;
    const moves = gameRef.current.history({ verbose: true });
    if (!moves.some((m) => m.color === human)) return;
    recordChessGame({
      id: gameIdRef.current,
      studentId: currentStudentId,
      playedAt: new Date().toISOString(),
      level,
      result,
      xp: myXp(moves),
      captured: moves.filter((m) => m.color === human && m.captured).map((m) => m.captured as string),
      moves: moves.filter((m) => m.color === human).length,
    });
  };
  // Leaving or restarting mid-game still saves the XP earned so far.
  // $1 per right answer, paid when the game ends or they leave it (see
  // src/lib/gameEarnings.ts). A ref so leaving the screen any way still pays.
  const correctRef = useRef(0);
  const payOutRef = useRef(() => {});
  payOutRef.current = () => {
    if (currentStudentId && correctRef.current > 0) payForAnswers(currentStudentId, correctRef.current, 'Slime Chess', '♟️');
    correctRef.current = 0;
  };
  useEffect(() => () => payOutRef.current(), []);
  const saveIfUnfinished = () => { if (screen === 'play' && !gameRef.current.isGameOver()) saveGame('unfinished'); payOutRef.current(); };
  const goToMenu = () => {
    saveIfUnfinished();
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    setThinking(false);
    setChallengeQuestion(null);
    setScreen('menu');
  };

  useEffect(() => {
    if (screen !== 'play' || gameOver || game.isGameOver() || thinking || promotion || !isHumanTurn) return;
    if (askedForPly.current === history.length) return;
    const ask = () => {
      askedForPly.current = history.length;
      setTurnCard(null);
      setPieAt(null);
      setChallengeQuestion(pickQuestion());
    };
    const timers: number[] = [];
    if (mode === 'computer') {
      if (history.length === 0) ask();
      else timers.push(window.setTimeout(ask, QUESTION_AFTER_COMPUTER_MS));
    } else {
      const who = turn;
      const showCard = () => { setPieAt(null); setSelected(null); setTurnCard(who); timers.push(window.setTimeout(ask, TURN_CARD_MS)); };
      if (history.length === 0) showCard();
      else timers.push(window.setTimeout(showCard, FRIEND_MOVE_SETTLE_MS));
    }
    return () => { timers.forEach((t) => window.clearTimeout(t)); setTurnCard(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, gameOver, thinking, promotion, isHumanTurn, history.length]);

  const answeredCorrectly = () => {
    correctRef.current += 1;
    if (student && activeGameplayTask && challengeQuestion) {
      submitGameplayAnswer(student.id, activeGameplayTask.subject, activeGameplayTask.task, challengeQuestion.id, true);
    }
    setChallengeQuestion(null);
  };

  const legalFromSelected = useMemo(
    () => (selected ? game.moves({ square: selected, verbose: true }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, fen],
  );
  const risky = useMemo(() => (selected ? riskyTargets(fen, selected) : new Set<string>()), [selected, fen]);


  const checkedKing = game.inCheck() ? kingSquare(game, turn) : null;

  const say = (text: string, tone: Tone = 'info') => setCoach({ text, tone });

  const startGame = () => {
    saveIfUnfinished();
    const r = mode === 'computer' ? ((rivalId && npcProfiles[rivalId]) || pickRival(npcProfiles)) : null;
    rivalRef.current = r;
    setRival(r);
    const rn = r?.name ?? 'Your Neighbor';
    gameIdRef.current = `chess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setIds(freshIds(gameRef.current));
    setHistory([]);
    setSelected(null);
    setHint(null);
    setPops([]);
    setGameOver(null);
    setThinking(false);
    askedForPly.current = null;
    setChallengeQuestion(null);
    setTurnCard(null);
    setScreen('play');
    if (mode === 'computer' && human === 'b') {
      say(`You're ${names.b}, playing ${rn}. ${names.w} goes first. Watch where ${rn} moves!`);
      queueComputer();
    } else {
      say(mode === 'computer'
        ? `You're ${names[human]}, playing ${rn}! Tap one of your pieces to see where it can go. Tap Hint any time for an idea.`
        : `${names.w} goes first. Tap a ${names.w} piece to see where it can go.`);
    }
  };

  const finishCheck = (moverColor: Color) => {
    const g = gameRef.current;
    if (!g.isGameOver()) return false;
    let result: { title: string; text: string; win: boolean | null };
    if (g.isCheckmate()) {
      const winnerName = names[moverColor];
      const humanWon = mode === 'friends' ? null : moverColor === human;
      result = {
        title: mode === 'friends' ? `${winnerName} wins!` : humanWon ? 'You win!' : `${rivalRef.current?.name ?? 'Your Neighbor'} wins this time`,
        text: `Checkmate! The ${names[other(moverColor)]} King is in check and has no way to escape.${humanWon === false ? ' Every game makes you a stronger player. Want a rematch?' : ''}`,
        win: humanWon,
      };
    } else if (g.isStalemate()) {
      result = { title: "It's a tie!", text: `Stalemate: ${names[g.turn()]} has no legal moves, but the King isn't in check, so nobody wins.`, win: null };
    } else if (g.isThreefoldRepetition()) {
      result = { title: "It's a tie!", text: 'The same position happened 3 times, so the game is a draw.', win: null };
    } else if (g.isInsufficientMaterial()) {
      result = { title: "It's a tie!", text: "Neither side has enough pieces left to checkmate, so it's a draw.", win: null };
    } else {
      result = { title: "It's a tie!", text: '50 moves in a row went by with no captures and no Pawn moves, so the game is a draw.', win: null };
    }
    setGameOver(result);
    saveGame(result.win === true ? 'win' : result.win === false ? 'loss' : 'draw');
    payOutRef.current();
    if (mode === 'computer' && rivalRef.current && currentStudentId) {
      recordGameMemory(currentStudentId, rivalRef.current.id, 'Slime Chess', result.win === true ? 'student' : result.win === false ? 'npc' : 'tie');
    }
    sound(result.win === false ? slimeSound.draw : result.win === null && !g.isCheckmate() ? slimeSound.draw : slimeSound.win);
    return true;
  };

  const doMove = (from: Square, to: Square, promo?: PieceSymbol): Move | null => {
    const g = gameRef.current;
    let m: Move;
    try {
      m = g.move({ from, to, promotion: promo });
    } catch {
      return null;
    }
    setIds((prev) => applyMoveIds(prev, m));
    setHistory((h) => [...h, m]);
    setFen(g.fen());
    setSelected(null);
    setHint(null);
    if (m.captured) {
      const capSq = (m.flags.includes('e') ? `${m.to[0]}${m.from[1]}` : m.to) as Square;
      const pop: Pop = { id: `${capSq}-${Date.now()}`, square: capSq, src: pieceSrc(theme, other(m.color), m.captured) };
      setPops((p) => [...p, pop]);
      window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== pop.id)), 700);
      sound(slimeSound.capture);
    } else {
      sound(() => slimeSound.move(m.piece));
    }
    if (g.inCheck() && !g.isCheckmate()) window.setTimeout(() => sound(slimeSound.check), 180);
    return m;
  };

  const queueComputer = () => {
    setThinking(true);
    aiTimer.current = window.setTimeout(() => {
      const g = gameRef.current;
      const m = pickComputerMove(g.fen(), level);
      setThinking(false);
      if (!m) return;
      const made = doMove(m.from, m.to, m.promotion);
      if (!made) return;
      if (finishCheck(made.color)) return;
      if (gameRef.current.inCheck()) {
        say(`${describeMove(made, names)} Your King is in check! Move it to a safe square, block the attack, or capture the attacker.`, 'check');
      } else {
        say(`${describeMove(made, names)}. Your turn!`, 'info');
      }
    }, COMPUTER_THINK_MS);
  };

  const afterHumanMove = (m: Move) => {
    if (finishCheck(m.color)) return;
    const g = gameRef.current;
    const msg = m.captured
      ? `Splat! ${describeMove(m, names)}.`
      : `${describeMove(m, names)}.`;
    if (mode === 'computer') {
      say(g.inCheck() ? `${msg} Their King has to escape now.` : `${msg} ${rivalName} is thinking...`, m.captured || g.inCheck() ? 'good' : 'info');
      queueComputer();
    } else {
      say(g.inCheck()
        ? `${msg} ${names[g.turn()]}, your King is in check! Get it to safety.`
        : `${msg} ${names[g.turn()]}'s turn.`, g.inCheck() ? 'check' : 'info');
    }
  };

  const tapSquare = (sq: Square) => {
    if (gameOver || promotion) return;
    // This turn's question hasn't been asked yet (the short look-at-the-
    // board pause after the computer moves): no moving until it's answered.
    if (isHumanTurn && askedForPly.current !== history.length) return;
    const g = gameRef.current;
    if (thinking || !isHumanTurn) {
      say(`Hang on, ${rivalName} is taking a turn.`, 'info');
      return;
    }
    const piece = g.get(sq);
    const mine = piece && piece.color === g.turn();

    if (selected) {
      const move = legalFromSelected.find((m) => m.to === sq);
      if (move) {
        if (move.promotion) {
          setPromotion({ from: selected, to: sq });
          say('Your Pawn made it to the other side! Pick what it turns into. Most players pick the Queen.', 'good');
          return;
        }
        const made = doMove(selected, sq);
        if (made) afterHumanMove(made);
        return;
      }
      if (sq === selected) {
        setSelected(null);
        say('Okay, nothing picked. Tap any of your pieces.', 'info');
        return;
      }
      if (mine) {
        selectPiece(sq);
        return;
      }
      setShakeSquare(selected);
      window.setTimeout(() => setShakeSquare(null), 450);
      sound(slimeSound.nope);
      say(explainIllegal(g, selected, sq, names), 'warn');
      return;
    }

    if (mine) {
      selectPiece(sq);
      return;
    }
    // Direct teacher instruction: the other side's pieces can't be picked
    // (the computer's against the computer; in two-player mode, the
    // player whose turn it isn't). They're still capture targets once one
    // of your own pieces is picked (handled above).
    if (piece) return;
    say(`Tap one of your ${names[g.turn()]} pieces first, then tap where you want it to go.`, 'info');
  };

  const selectPiece = (sq: Square) => {
    const g = gameRef.current;
    const piece = g.get(sq)!;
    setSelected(sq);
    sound(() => slimeSound.select(piece.type));
    const moves = g.moves({ square: sq, verbose: true });
    const name = PIECE_NAME[piece.type];
    if (moves.length === 0) {
      say(g.inCheck()
        ? `Your King is in check, and this ${name} can't help right now. Try moving your King, or a piece that can block or capture the attacker.`
        : `This ${name} has no moves right now. It's blocked in, or moving it would put your King in danger. ${PIECE_RULE[piece.type]}`, 'warn');
      return;
    }
    const r = riskyTargets(g.fen(), sq);
    const caps = moves.filter((m) => m.captured).length;
    let text = `${PIECE_RULE[piece.type]} Your ${name} can go to ${moves.length} square${moves.length === 1 ? '' : 's'} (the green bubbles).`;
    if (caps) text += ` Pink rings mean it can capture something!`;
    if (r.size) text += ` Yellow bubbles with a ! are risky: your ${name} could be captured there on their next move.`;
    say(text, 'info');
  };

  const choosePromotion = (type: PieceSymbol) => {
    if (!promotion) return;
    const made = doMove(promotion.from, promotion.to, type);
    setPromotion(null);
    if (made) afterHumanMove(made);
  };

  const showHint = () => {
    if (gameOver || thinking || !isHumanTurn) return;
    const h = suggestMove(gameRef.current.fen());
    if (!h) return;
    setHint(h);
    setSelected(null);
    sound(slimeSound.hint);
    say(h.text, 'hint');
  };

  const undo = () => {
    if (thinking || history.length === 0) return;
    const g = gameRef.current;
    const steps = mode === 'computer' ? (g.turn() === human ? 2 : 1) : 1;
    for (let i = 0; i < steps && g.history().length > 0; i++) g.undo();
    askedForPly.current = Math.max(0, history.length - steps);
    setHistory((h) => h.slice(0, Math.max(0, h.length - steps)));
    setFen(g.fen());
    setIds(freshIds(g));
    setSelected(null);
    setHint(null);
    setGameOver(null);
    sound(slimeSound.hint);
    say('Undo! The last move was taken back. Try something new.', 'info');
    if (mode === 'computer' && g.turn() !== human) queueComputer();
  };

  // --- rendering helpers ---
  const board = game.board();
  const view = (sq: Square) => {
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]) - 1;
    return bottom === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
  };
  const posStyle = (sq: Square) => {
    const { col, row } = view(sq);
    return { left: `${col * 12.5}%`, top: `${row * 12.5}%` };
  };
  const squares: Square[] = [];
  for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
    const f = bottom === 'w' ? col : 7 - col;
    const r = bottom === 'w' ? 7 - row : row;
    squares.push(`${FILES[f]}${r + 1}` as Square);
  }
  const lastMove = history[history.length - 1];
  const capturedBy = (c: Color) => history.filter((m) => m.color === c && m.captured).map((m) => m.captured as PieceSymbol);
  // Only the pieces this player has taken, as pictures, under the turn
  // text. Against the computer that is always the student's own haul.
  const haulSide: Color = mode === 'computer' ? human : turn;

  if (screen === 'menu') {
    return (
      <div className={`slime-chess${calm ? ' sc-calm' : ''}`}>
        <Bubbles />
        <button className="sc-back" onClick={() => back.go()}>← {backLabel}</button>
        <div className="sc-menu">
          <h1 className="sc-title">Slime Chess</h1>
          <p className="sc-sub">Real chess, extra squishy. {student ? `Ready, ${student.name}?` : ''}</p>

          <div className="sc-menu-section">
            <h2>Who do you want to play?</h2>
            <div className="sc-choice-row">
              <button className={`sc-pill pill-cyan${mode === 'computer' ? ' on' : ''}`} onClick={() => setMode('computer')}>{rivalId && npcProfiles[rivalId] ? npcProfiles[rivalId].name : 'A Neighbor'}</button>
              <button className={`sc-pill pill-pink${mode === 'friends' ? ' on' : ''}`} onClick={() => setMode('friends')}>A Friend (same iPad)</button>
            </div>
          </div>

          {mode === 'computer' && (
            <div className="sc-menu-section">
              <h2>How tricky?</h2>
              <div className="sc-choice-row">
                {(['easy', 'medium', 'hard'] as Level[]).map((l) => (
                  <button key={l} className={`sc-pill ${l === 'easy' ? 'pill-green' : l === 'medium' ? 'pill-yellow' : 'pill-orange'}${level === l ? ' on' : ''}`} onClick={() => setLevel(l)}>
                    {LEVEL_LABEL[l]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="sc-menu-section">
            <h2>Pick your flavors</h2>
            <div className="sc-choice-row">
              {THEMES.map((t) => (
                <button key={t.id} className={`sc-theme${theme.id === t.id ? ' on' : ''}`} onClick={() => setTheme(t)}>
                  <span className="sc-theme-pieces">
                    <img src={pieceSrc(t, 'w', 'k')} alt="" />
                    <img src={pieceSrc(t, 'b', 'k')} alt="" />
                  </span>
                  <span className="sc-theme-name">{t.name}</span>
                  <span className="sc-theme-teams">{t.team.w} vs {t.team.b}</span>
                </button>
              ))}
            </div>
          </div>

          {mode === 'computer' && (
            <div className="sc-menu-section">
              <h2>Your team</h2>
              <div className="sc-choice-row">
                {(['w', 'b'] as Color[]).map((c) => (
                  <button key={c} className={`sc-team${human === c ? ' on' : ''}`} onClick={() => setHuman(c)}>
                    <img src={pieceSrc(theme, c, 'n')} alt="" />
                    {theme.team[c]}{c === 'w' ? ' (goes first)' : ''}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!activeGameplayTask && usableQuestionSets.length > 0 && (
            <div className="sc-menu-section">
              <h2>Questions before each turn</h2>
              <QuestionSourcePicker questionSets={usableQuestionSets} value={questionMode} onChange={setQuestionMode} />
            </div>
          )}

          <ChessLeaderboard games={myGames} theme={theme} human={human} />

          <button className="sc-play" onClick={startGame}>
            <img src="/chess/btn-play.png" alt="" /> Play!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`slime-chess playing${calm ? ' sc-calm' : ''}`}>
      <Bubbles />
      <div className="sc-layout">
        <div className="sc-board-wrap">
          <div className="sc-board">
            {squares.map((sq) => {
              const f = FILES.indexOf(sq[0]);
              const r = Number(sq[1]) - 1;
              const light = (f + r) % 2 === 1;
              const target = legalFromSelected.find((m) => m.to === sq);
              const isHint = hint && (hint.from === sq || hint.to === sq);
              const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
              const { col, row } = view(sq);
              return (
                <button
                  key={sq}
                  className={`sc-square${isLast ? ' last' : ''}${isHint ? ' hint' : ''}${selected === sq ? ' selected' : ''}`}
                  style={{ backgroundImage: `url(/chess/tile-${theme.id}-${light ? theme.tiles[0] : theme.tiles[1]}.png)` }}
                  onClick={() => tapSquare(sq)}
                  aria-label={`${sq}${game.get(sq) ? `, ${names[game.get(sq)!.color]} ${PIECE_NAME[game.get(sq)!.type]}` : ''}`}
                >
                  {row === 7 && <span className="sc-coord file">{sq[0]}</span>}
                  {col === 0 && <span className="sc-coord rank">{sq[1]}</span>}
                  {target && (
                    <span className={`sc-target${target.captured ? ' capture' : ''}${risky.has(sq) ? ' risky' : ''}`} aria-hidden="true">
                      {risky.has(sq) && <span className="sc-target-bang">!</span>}
                    </span>
                  )}
                </button>
              );
            })}

            {board.flat().filter(Boolean).map((cell) => {
              const sq = cell!.square;
              const id = ids[sq] ?? sq;
              const landed = lastMove && lastMove.to === sq;
              return (
                <div
                  key={id}
                  className={`sc-piece${selected === sq ? ' selected' : ''}${checkedKing === sq ? ' in-check' : ''}${shakeSquare === sq ? ' nope' : ''}`}
                  style={{
                    ...posStyle(sq),
                    animationName: landed ? (history.length % 2 ? 'scLandA' : 'scLandB') : undefined,
                  }}
                >
                  <img src={pieceSrc(theme, cell!.color, cell!.type)} alt="" draggable={false} style={{ animationDelay: `${(sq.charCodeAt(0) + Number(sq[1])) % 7 * 0.4}s` }} />
                  {checkedKing === sq && <img className="sc-check-badge" src="/chess/badge-red.png" alt="" />}
                </div>
              );
            })}

            {pops.map((p) => (
              <div key={p.id} className="sc-pop" style={posStyle(p.square)}>
                <img src={p.src} alt="" />
              </div>
            ))}

            {hint && <HintArrow from={view(hint.from)} to={view(hint.to)} />}
          </div>
        </div>

        <aside className="sc-panel">
          <div className={`sc-turn ${turn === 'w' ? 'w' : 'b'}`}>
            <img src={pieceSrc(theme, turn, 'k')} alt="" />
            <div className="sc-turn-text">
              <span>
                {gameOver ? 'Game over' : thinking ? `${rivalName} is thinking...` : mode === 'computer' ? (turn === human ? 'Your turn!' : `${rivalName}'s turn`) : `${names[turn]}'s turn`}
              </span>
 {mode === 'computer' && myXp(history) > 0 && <span className="sc-xp-pill">⭐ {myXp(history)} XP</span>}
              {capturedBy(haulSide).length > 0 && (
                <div className="sc-turn-haul" aria-label={`${names[haulSide]} has captured ${capturedBy(haulSide).map((t) => PIECE_NAME[t]).join(', ')}`}>
                  {capturedBy(haulSide).map((t, i) => <img key={i} src={pieceSrc(theme, other(haulSide), t)} alt="" />)}
                </div>
              )}
            </div>
            <button className="sc-corner-btn" onClick={() => (inProgress ? setConfirmLeave('leave') : back.go())} aria-label={backLabel} title={backLabel}>
              <img src="/chess/btn-home.png" alt="" />
            </button>
            <button
              ref={gearRef}
              className="sc-corner-btn sc-gear"
              onClick={() => setPieAt((v) => (v ? null : gearRef.current?.getBoundingClientRect() ?? null))}
              aria-label="Settings"
              aria-expanded={!!pieAt}
              title="Settings"
            >
              <span className="sc-gear-bubble"><img src="/chess/icon-gear.png" alt="" /></span>
            </button>
          </div>

          {mode === 'computer' && rival && (
            <div className="sc-rival">
              <div className="sc-rival-stage"><Suspense fallback={null}><NpcPortrait3D look={rival.look} talkKey={`${history.length}-${!!gameOver}`} talking={thinking || !!gameOver} framing="bust" /></Suspense></div>
              <div className="sc-rival-say">
                <strong>{rival.name}</strong>
                <span>{gameOver ? (gameOver.win === true ? 'You got me! Great game!' : gameOver.win === false ? 'Checkmate! Good game, friend!' : 'A tie! We are evenly matched!') : thinking ? 'Hmm, let me think...' : turn === human ? 'Your move!' : 'Here I go!'}</span>
              </div>
            </div>
          )}

          <div className={`sc-coach ${coach.tone}`} role="status" aria-live="polite">
            <img className="sc-coach-face" src={pieceSrc(theme, mode === 'computer' ? human : turn, 'p')} alt="" />
            <div className="sc-coach-bubble">
              <p>{coach.text}</p>
              {coach.text && <ReadAloud text={coach.text} small />}
            </div>
          </div>

          <div className="sc-legend">
            <span><i className="dot ok" /> can move</span>
            <span><i className="dot cap" /> can capture</span>
            <span><i className="dot risky" /> risky</span>
          </div>

        </aside>
      </div>

      {pieAt && (
        <SettingsPie
          anchor={pieAt}
          onClose={() => setPieAt(null)}
          items={[
            { key: 'hint', icon: '/chess/btn-hint.png', label: 'Hint', disabled: !!gameOver || thinking || !isHumanTurn, onClick: () => { setPieAt(null); showHint(); } },
            { key: 'undo', icon: '/chess/btn-undo.png', label: 'Undo', disabled: thinking || history.length === 0, onClick: () => { setPieAt(null); undo(); } },
            { key: 'motion', icon: '/chess/btn-info.png', label: calm ? 'Less motion: on' : 'Less motion: off', pressed: calm, onClick: () => setCalm((v) => !v) },
            { key: 'sound', icon: '/chess/btn-sound.png', label: soundOn ? 'Sound: on' : 'Sound: off', pressed: soundOn, dim: !soundOn, onClick: () => setSoundOn((v) => !v) },
            { key: 'new', icon: '/chess/btn-new.png', label: 'New game', onClick: () => { setPieAt(null); if (inProgress) setConfirmLeave('new'); else goToMenu(); } },
          ]}
        />
      )}

      {promotion && (
        <div className="sc-modal-backdrop">
          <div className="sc-modal">
            <h2>Your Pawn can become...</h2>
            <div className="sc-promo-row">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((t) => (
                <button key={t} className="sc-promo" onClick={() => choosePromotion(t)}>
                  <img src={pieceSrc(theme, turn, t)} alt="" />
                  {PIECE_NAME[t]}{t === 'q' && <small>Strongest!</small>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {confirmLeave && (
        <div className="sc-modal-backdrop" onClick={() => setConfirmLeave(null)}>
          <div className="sc-modal" role="dialog" aria-modal="true" aria-labelledby="sc-leave-title" onClick={(e) => e.stopPropagation()}>
            <img className="sc-gameover-badge" src="/chess/badge-red.png" alt="" />
            <h2 id="sc-leave-title">{confirmLeave === 'leave' ? 'Leave this game?' : 'Start a new game?'}</h2>
            <p>{confirmLeave === 'leave' ? `Your game will end and you'll go back to ${backLabel}.` : 'This game will end and you will pick new settings.'}</p>
            <div className="sc-choice-row">
              <button className="sc-soft-btn green" onClick={() => setConfirmLeave(null)}>Keep playing</button>
              <button
                className="sc-soft-btn red"
                onClick={() => {
                  const which = confirmLeave;
                  setConfirmLeave(null);
                  if (which === 'leave') { saveIfUnfinished(); if (aiTimer.current) window.clearTimeout(aiTimer.current); back.go(); } else goToMenu();
                }}
              >
                {confirmLeave === 'leave' ? 'Leave game' : 'New game'}
              </button>
            </div>
          </div>
        </div>
      )}

      {turnCard && (
        <div className="sc-modal-backdrop" role="status" aria-live="assertive">
          <div className={`sc-modal sc-turn-card ${turnCard}`}>
            <img className="sc-turn-card-king" src={pieceSrc(theme, turnCard, 'k')} alt="" />
            <h2>It's {names[turnCard]}'s turn!</h2>
            <p>{names[turnCard]}, answer a question, then make your move.</p>
          </div>
        </div>
      )}

      {challengeQuestion && (
        <QuestionScreen
          key={challengeQuestion.id}
          whoLabel={mode === 'friends' ? `${names[turn]}'s question` : undefined}
          whoIcon={mode === 'friends' ? pieceSrc(theme, turn, 'k') : undefined}
          prompt={challengeQuestion.prompt}
          choices={challengeQuestion.choices}
          correctIndex={challengeQuestion.correctIndex}
          done={0}
          total={1}
          imageUrl={challengeQuestion.imageUrl}
          imageAlt={challengeQuestion.imageAlt}
          onCorrectAnswer={answeredCorrectly}
          onExit={() => { saveIfUnfinished(); setChallengeQuestion(null); back.go(); }}
          onSkip={() => setChallengeQuestion(pickQuestion(challengeQuestion.id))}
          ttsSettings={student?.ttsSettings}
        />
      )}

      {gameOver && (
        <div className="sc-modal-backdrop">
          <div className={`sc-modal sc-gameover${gameOver.win ? ' win' : ''}`}>
            <img className="sc-gameover-badge" src={gameOver.win === false ? '/chess/badge-red.png' : '/chess/badge-green.png'} alt="" />
            <h2>{gameOver.title}</h2>
            <p>{gameOver.text}</p>
            {mode === 'computer' && (() => {
              const xp = myXp(history);
              const best = myGames.filter((g) => g.id !== gameIdRef.current).reduce((m, g) => Math.max(m, g.xp), 0);
              return (
                <p className="sc-gameover-xp">
                  ⭐ You earned {xp} XP this game.{xp > 0 && xp > best ? ' New personal best!' : ''}
                </p>
              );
            })()}
            <ReadAloud text={`${gameOver.title}. ${gameOver.text}`} small />
            <div className="sc-choice-row">
              <button className="sc-soft-btn green" onClick={startGame}>Play again</button>
              <button className="sc-soft-btn red" onClick={() => { setGameOver(null); setScreen('menu'); }}>Change settings</button>
            </div>
            <button className="sc-link" onClick={() => setGameOver(null)}>Look at the board</button>
          </div>
        </div>
      )}
    </div>
  );
}

const RESULT_LABEL: Record<ChessGameRecord['result'], string> = { win: 'Won', loss: 'Lost', draw: 'Tie', unfinished: 'Not finished' };

// The student's own top games, ranked by XP, plus lifetime totals and the
// point values XP comes from. Personal only: no other student appears.
function ChessLeaderboard({ games, theme, human }: { games: ChessGameRecord[]; theme: Theme; human: Color }) {
  const total = games.reduce((sum, g) => sum + g.xp, 0);
  const wins = games.filter((g) => g.result === 'win').length;
  const top = [...games].sort((a, b) => b.xp - a.xp || b.playedAt.localeCompare(a.playedAt)).slice(0, 5);
  return (
    <div className="sc-menu-section sc-board-of-fame">
      <h2>My Chess Leaderboard</h2>
      <div className="sc-lb-totals">
        <span><strong>{total}</strong> total XP</span>
        <span><strong>{games.length}</strong> game{games.length === 1 ? '' : 's'}</span>
        <span><strong>{wins}</strong> win{wins === 1 ? '' : 's'}</span>
      </div>
      {top.length === 0 ? (
        <p className="sc-lb-empty">Capture your Neighbor's pieces to earn XP. Your best games will show up here!</p>
      ) : (
        <ol className="sc-lb-list">
          {top.map((g, i) => (
            <li key={g.id}>
              <span className="sc-lb-rank">{i + 1}</span>
              <span className="sc-lb-xp">{g.xp} XP</span>
              <span className="sc-lb-caps" aria-label={g.captured.length ? `Captured ${g.captured.map((c) => PIECE_NAME[c as PieceSymbol]).join(', ')}` : 'No captures'}>
                {g.captured.map((c, k) => <img key={k} src={pieceSrc(theme, other(human), c as PieceSymbol)} alt="" />)}
              </span>
              <span className="sc-lb-meta">{LEVEL_LABEL[g.level]} · {RESULT_LABEL[g.result]} · {new Date(g.playedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="sc-lb-values">Points per capture: Pawn 1 · Knight 3 · Bishop 3 · Rook 5 · Queen 9</p>
    </div>
  );
}

type PieItem = { key: string; icon: string; label: string; onClick: () => void; disabled?: boolean; pressed?: boolean; dim?: boolean };

// A round pie menu that opens under the gear: one slice per button, the
// gear's own close (X) in the middle. Kept fully on screen at any size
// (iPad portrait included). Tap outside or press Escape to close.
const PIE_COLORS = ['#ffe3f1', '#e3f0ff', '#fff4cc', '#e2fbe9', '#efe4ff'];
function SettingsPie({ anchor, items, onClose }: { anchor: DOMRect; items: PieItem[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onClose);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onClose); };
  }, [onClose]);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const R = Math.min(160, (vw - 24) / 2, (vh - 24) / 2);
  const cx = Math.min(Math.max(anchor.left + anchor.width / 2 - R * 0.55, R + 12), vw - R - 12);
  const cy = Math.min(Math.max(anchor.bottom + 10 + R, R + 12), vh - R - 12);
  const slice = 360 / items.length;
  const gradient = `conic-gradient(from ${-slice / 2}deg, ${items.map((_, i) => `${PIE_COLORS[i % PIE_COLORS.length]} ${i * slice}deg ${(i + 1) * slice}deg`).join(', ')})`;
  const r = R * 0.62;
  return (
    <div className="sc-pie-backdrop" onClick={onClose}>
      <div
        className="sc-pie"
        role="menu"
        aria-label="Settings"
        style={{ left: cx - R, top: cy - R, width: R * 2, height: R * 2, background: gradient }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((it, i) => {
          const a = (i * slice * Math.PI) / 180;
          return (
            <button
              key={it.key}
              role="menuitem"
              className="sc-pie-item"
              style={{ left: R + r * Math.sin(a), top: R - r * Math.cos(a) }}
              onClick={it.onClick}
              disabled={it.disabled}
              aria-pressed={it.pressed}
            >
              <img src={it.icon} alt="" style={{ opacity: it.dim ? 0.45 : 1 }} />
              <span>{it.label}</span>
            </button>
          );
        })}
        <button className="sc-pie-close" onClick={onClose} aria-label="Close settings">
          <img src="/chess/icon-x.png" alt="" />
        </button>
      </div>
    </div>
  );
}

function HintArrow({ from, to }: { from: { col: number; row: number }; to: { col: number; row: number } }) {
  const x1 = from.col * 12.5 + 6.25;
  const y1 = from.row * 12.5 + 6.25;
  const x2 = to.col * 12.5 + 6.25;
  const y2 = to.row * 12.5 + 6.25;
  return (
    <svg className="sc-hint-arrow" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <marker id="sc-arrowhead" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#ffe14d" />
        </marker>
      </defs>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffe14d" strokeWidth="2.6" strokeLinecap="round" markerEnd="url(#sc-arrowhead)" />
    </svg>
  );
}

function Bubbles() {
  return (
    <div className="sc-bubbles" aria-hidden="true">
      {Array.from({ length: 14 }).map((_, i) => (
        <span key={i} style={{ left: `${(i * 37) % 100}%`, width: `${18 + (i * 13) % 46}px`, animationDelay: `${(i * 1.7) % 12}s`, animationDuration: `${10 + (i * 3) % 9}s` }} />
      ))}
    </div>
  );
}
