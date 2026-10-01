import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { useStore } from '../../store/store';
import ReadAloud from '../../components/ReadAloud';
import {
  PIECE_NAME, PIECE_RULE, describeMove, explainIllegal, other, pickComputerMove, riskyTargets, suggestMove,
  kingSquare, type Hint, type Level,
} from '../../lib/chessCoach';
import { slimeSound } from '../../lib/slimeSounds';

// Slime Chess — a native game reached through a Town Square object with
// the 'chess' role (teacher places the uploaded Chess Set model in Build
// Mode). Direct teacher instruction, 2026-10-01: real chess with full
// rules, a slime / bubbles / bright-colors theme from the teacher's
// Jelly Chess pack, fun pop noises on every move, and, because it's for
// neurodivergent kids, always-visible help: every legal path for the
// picked piece, risky squares marked, hints with a reason, a "danger"
// glow on pieces that could be captured, and a plain-language speech
// bubble explaining exactly why any move that doesn't work doesn't work.
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

export default function SlimeChess() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromTown = (location.state as { from?: string } | null)?.from === 'town';
  const backTo = cameFromTown ? '/world/town' : '/student/home';
  const backLabel = cameFromTown ? 'Town Square' : 'Computer';
  const currentStudentId = useStore((s) => s.currentStudentId);
  const students = useStore((s) => s.students);
  const student = students.find((s) => s.id === currentStudentId);

  const [screen, setScreen] = useState<Screen>('menu');
  const [mode, setMode] = useState<Mode>('computer');
  const [level, setLevel] = useState<Level>('easy');
  const [theme, setTheme] = useState<Theme>(THEMES[0]);
  const [human, setHuman] = useState<Color>('w');
  const [soundOn, setSoundOn] = useState(true);
  const [showDanger, setShowDanger] = useState(true);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [ids, setIds] = useState<IdMap>(() => freshIds(gameRef.current));
  const [history, setHistory] = useState<Move[]>([]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [peek, setPeek] = useState<Square | null>(null);
  const [hint, setHint] = useState<Hint | null>(null);
  const [coach, setCoach] = useState<{ text: string; tone: Tone }>({ text: '', tone: 'info' });
  const [thinking, setThinking] = useState(false);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [pops, setPops] = useState<Pop[]>([]);
  const [shakeSquare, setShakeSquare] = useState<Square | null>(null);
  const [gameOver, setGameOver] = useState<{ title: string; text: string; win: boolean | null } | null>(null);
  const aiTimer = useRef<number | null>(null);

  useEffect(() => () => { if (aiTimer.current) window.clearTimeout(aiTimer.current); }, []);

  const game = gameRef.current;
  const turn = game.turn();
  const names = theme.team;
  const bottom: Color = mode === 'computer' ? human : 'w';
  const sound = (fn: () => void) => { if (soundOn) fn(); };
  const isHumanTurn = mode === 'friends' || turn === human;

  const legalFromSelected = useMemo(
    () => (selected ? game.moves({ square: selected, verbose: true }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, fen],
  );
  const risky = useMemo(() => (selected ? riskyTargets(fen, selected) : new Set<string>()), [selected, fen]);
  const peekTargets = useMemo(() => {
    if (!peek) return [] as string[];
    const parts = fen.split(' ');
    parts[1] = other(turn);
    parts[3] = '-';
    try {
      return new Chess(parts.join(' ')).moves({ square: peek, verbose: true }).map((m) => m.to as string);
    } catch {
      return [];
    }
  }, [peek, fen, turn]);

  // Pieces of the side to move that could be captured right now and
  // aren't protected: the "danger glow" recommendation layer.
  const dangerSquares = useMemo(() => {
    const set = new Set<string>();
    if (!showDanger || gameOver) return set;
    const viewer: Color = mode === 'computer' ? human : turn;
    for (const row of game.board()) for (const cell of row) {
      if (!cell || cell.color !== viewer || cell.type === 'k') continue;
      if (game.isAttacked(cell.square, other(viewer)) && game.attackers(cell.square, viewer).length === 0) set.add(cell.square);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen, showDanger, gameOver, mode, human, turn]);

  const checkedKing = game.inCheck() ? kingSquare(game, turn) : null;

  const say = (text: string, tone: Tone = 'info') => setCoach({ text, tone });

  const startGame = () => {
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    gameRef.current = new Chess();
    setFen(gameRef.current.fen());
    setIds(freshIds(gameRef.current));
    setHistory([]);
    setSelected(null);
    setPeek(null);
    setHint(null);
    setPops([]);
    setGameOver(null);
    setThinking(false);
    setScreen('play');
    if (mode === 'computer' && human === 'b') {
      say(`You're ${names.b}. ${names.w} goes first. Watch where the computer moves!`);
      queueComputer();
    } else {
      say(mode === 'computer'
        ? `You're ${names[human]}! Tap one of your pieces to see where it can go. Tap Hint any time for an idea.`
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
        title: mode === 'friends' ? `${winnerName} wins!` : humanWon ? 'You win!' : 'The computer wins this time',
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
    setPeek(null);
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
    }, 650);
  };

  const afterHumanMove = (m: Move) => {
    if (finishCheck(m.color)) return;
    const g = gameRef.current;
    const msg = m.captured
      ? `Splat! ${describeMove(m, names)}.`
      : `${describeMove(m, names)}.`;
    if (mode === 'computer') {
      say(g.inCheck() ? `${msg} Their King has to escape now.` : `${msg} The computer is thinking...`, m.captured || g.inCheck() ? 'good' : 'info');
      queueComputer();
    } else {
      say(g.inCheck()
        ? `${msg} ${names[g.turn()]}, your King is in check! Get it to safety.`
        : `${msg} ${names[g.turn()]}'s turn.`, g.inCheck() ? 'check' : 'info');
    }
  };

  const tapSquare = (sq: Square) => {
    if (gameOver || promotion) return;
    const g = gameRef.current;
    if (thinking || !isHumanTurn) {
      say('Hang on, the computer is taking its turn.', 'info');
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
    if (piece) {
      setPeek(sq);
      say(`That's ${names[piece.color]}'s ${PIECE_NAME[piece.type]}. The red bubbles show where it could go on its turn, so watch those squares! Tap one of your ${names[g.turn()]} pieces to move.`, 'info');
      return;
    }
    say(`Tap one of your ${names[g.turn()]} pieces first, then tap where you want it to go.`, 'info');
  };

  const selectPiece = (sq: Square) => {
    const g = gameRef.current;
    const piece = g.get(sq)!;
    setSelected(sq);
    setPeek(null);
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
    if (r.size) text += ` Yellow bubbles are risky: your ${name} could get captured there.`;
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
    setPeek(null);
    sound(slimeSound.hint);
    say(h.text, 'hint');
  };

  const undo = () => {
    if (thinking || history.length === 0) return;
    const g = gameRef.current;
    const steps = mode === 'computer' ? (g.turn() === human ? 2 : 1) : 1;
    for (let i = 0; i < steps && g.history().length > 0; i++) g.undo();
    setHistory((h) => h.slice(0, Math.max(0, h.length - steps)));
    setFen(g.fen());
    setIds(freshIds(g));
    setSelected(null);
    setPeek(null);
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

  if (screen === 'menu') {
    return (
      <div className="slime-chess">
        <Bubbles />
        <button className="sc-back" onClick={() => navigate(backTo)}>← {backLabel}</button>
        <div className="sc-menu">
          <h1 className="sc-title">Slime Chess</h1>
          <p className="sc-sub">Real chess, extra squishy. {student ? `Ready, ${student.name}?` : ''}</p>

          <div className="sc-menu-section">
            <h2>Who do you want to play?</h2>
            <div className="sc-choice-row">
              <button className={`sc-pill pill-cyan${mode === 'computer' ? ' on' : ''}`} onClick={() => setMode('computer')}>The Computer</button>
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

          <button className="sc-play" onClick={startGame}>
            <img src="/chess/btn-play.png" alt="" /> Play!
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="slime-chess playing">
      <Bubbles />
      <div className="sc-layout">
        <div className="sc-board-wrap">
          <div className="sc-board">
            {squares.map((sq) => {
              const f = FILES.indexOf(sq[0]);
              const r = Number(sq[1]) - 1;
              const light = (f + r) % 2 === 1;
              const target = legalFromSelected.find((m) => m.to === sq);
              const isPeek = peekTargets.includes(sq);
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
                      {risky.has(sq) && !target.captured && <span className="sc-target-bang">!</span>}
                    </span>
                  )}
                  {isPeek && <span className="sc-target peek" aria-hidden="true" />}
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
                  className={`sc-piece${selected === sq ? ' selected' : ''}${dangerSquares.has(sq) ? ' danger' : ''}${checkedKing === sq ? ' in-check' : ''}${shakeSquare === sq ? ' nope' : ''}`}
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
            <span>
              {gameOver ? 'Game over' : thinking ? 'Computer is thinking...' : mode === 'computer' ? (turn === human ? 'Your turn!' : "Computer's turn") : `${names[turn]}'s turn`}
            </span>
          </div>

          <div className={`sc-coach ${coach.tone}`} role="status" aria-live="polite">
            <img className="sc-coach-face" src={pieceSrc(theme, mode === 'computer' ? human : turn, 'p')} alt="" />
            <div className="sc-coach-bubble">
              <p>{coach.text}</p>
              {coach.text && <ReadAloud text={coach.text} small />}
            </div>
          </div>

          <div className="sc-actions">
            <button className="sc-round" onClick={showHint} disabled={!!gameOver || thinking || !isHumanTurn}>
              <img src="/chess/btn-hint.png" alt="" /> <span>Hint</span>
            </button>
            <button className="sc-round" onClick={undo} disabled={thinking || history.length === 0}>
              <img src="/chess/btn-undo.png" alt="" /> <span>Undo</span>
            </button>
            <button className="sc-round" onClick={() => setShowDanger((v) => !v)} aria-pressed={showDanger}>
              <img src="/chess/btn-info.png" alt="" /> <span>{showDanger ? 'Danger: on' : 'Danger: off'}</span>
            </button>
            <button className="sc-round" onClick={() => setSoundOn((v) => !v)} aria-pressed={soundOn}>
              <img src="/chess/btn-sound.png" alt="" style={{ opacity: soundOn ? 1 : 0.45 }} /> <span>{soundOn ? 'Sound: on' : 'Sound: off'}</span>
            </button>
            <button className="sc-round" onClick={() => { if (aiTimer.current) window.clearTimeout(aiTimer.current); setThinking(false); setScreen('menu'); }}>
              <img src="/chess/btn-new.png" alt="" /> <span>New game</span>
            </button>
            <button className="sc-round" onClick={() => navigate(backTo)}>
              <img src="/chess/btn-home.png" alt="" /> <span>{backLabel}</span>
            </button>
          </div>

          <div className="sc-legend">
            <span><i className="dot ok" /> can move</span>
            <span><i className="dot cap" /> can capture</span>
            <span><i className="dot risky" /> risky</span>
            <span><i className="dot peek" /> their reach</span>
            {showDanger && <span><i className="dot danger" /> could be captured</span>}
          </div>

          <div className="sc-captured">
            {(['w', 'b'] as Color[]).map((c) => (
              <div key={c} className="sc-captured-row">
                <span>{names[c]} captured:</span>
                {capturedBy(c).length === 0 ? <em>nothing yet</em> : capturedBy(c).map((t, i) => <img key={i} src={pieceSrc(theme, other(c), t)} alt={PIECE_NAME[t]} />)}
              </div>
            ))}
          </div>

          <ol className="sc-moves" aria-label="Moves so far">
            {history.slice(-6).map((m, i) => (
              <li key={history.length - 6 + i}>{describeMove(m, names)}</li>
            ))}
          </ol>
        </aside>
      </div>

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

      {gameOver && (
        <div className="sc-modal-backdrop">
          <div className={`sc-modal sc-gameover${gameOver.win ? ' win' : ''}`}>
            <img className="sc-gameover-badge" src={gameOver.win === false ? '/chess/badge-red.png' : '/chess/badge-green.png'} alt="" />
            <h2>{gameOver.title}</h2>
            <p>{gameOver.text}</p>
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
