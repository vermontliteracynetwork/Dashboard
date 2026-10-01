import { Chess, type Move, type Square, type PieceSymbol, type Color } from 'chess.js';

// Slime Chess "coach": the computer opponent, hints with a plain-language
// reason, and an explanation for every move that doesn't work. Built for
// neurodivergent K-8 players (direct teacher instruction, 2026-10-01):
// every rule the game enforces should be explained in kid words, never a
// silent "nope".

export const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'Pawn', n: 'Knight', b: 'Bishop', r: 'Rook', q: 'Queen', k: 'King',
};
export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const PIECE_RULE: Record<PieceSymbol, string> = {
  p: 'A Pawn moves straight forward 1 square (or 2 on its very first move), and captures 1 square diagonally forward.',
  n: 'A Knight jumps in an L shape: 2 squares one way, then 1 square to the side. It can hop over other pieces.',
  b: 'A Bishop slides diagonally, as many squares as it wants.',
  r: 'A Rook slides straight up, down, left, or right, as many squares as it wants.',
  q: 'A Queen slides in any straight line or diagonal, as many squares as it wants.',
  k: 'A King steps 1 square in any direction.',
};

const FILES = 'abcdefgh';
const fileOf = (sq: Square) => FILES.indexOf(sq[0]);
const rankOf = (sq: Square) => Number(sq[1]) - 1;
const sqAt = (f: number, r: number) => `${FILES[f]}${r + 1}` as Square;
export const other = (c: Color): Color => (c === 'w' ? 'b' : 'w');

export function kingSquare(chess: Chess, color: Color): Square | null {
  for (const row of chess.board()) for (const cell of row) if (cell && cell.type === 'k' && cell.color === color) return cell.square;
  return null;
}

// --- Explaining a move that doesn't work ----------------------------------

function pathClear(chess: Chess, from: Square, to: Square): boolean {
  const df = Math.sign(fileOf(to) - fileOf(from));
  const dr = Math.sign(rankOf(to) - rankOf(from));
  let f = fileOf(from) + df;
  let r = rankOf(from) + dr;
  while (f !== fileOf(to) || r !== rankOf(to)) {
    if (chess.get(sqAt(f, r))) return false;
    f += df;
    r += dr;
  }
  return true;
}

function firstBlocker(chess: Chess, from: Square, to: Square): Square | null {
  const df = Math.sign(fileOf(to) - fileOf(from));
  const dr = Math.sign(rankOf(to) - rankOf(from));
  let f = fileOf(from) + df;
  let r = rankOf(from) + dr;
  while (f !== fileOf(to) || r !== rankOf(to)) {
    const s = sqAt(f, r);
    if (chess.get(s)) return s;
    f += df;
    r += dr;
  }
  return null;
}

const colorWord = (c: Color, names: Record<Color, string>) => names[c];

// Why the piece on `from` can't go to `to`. `names` maps w/b to the jelly
// team names shown on screen (e.g. Strawberry / Blueberry).
export function explainIllegal(chess: Chess, from: Square, to: Square, names: Record<Color, string>): string {
  const piece = chess.get(from);
  if (!piece) return 'There is no piece on that square to move.';
  const me = piece.color;
  if (me !== chess.turn()) return `That's a ${colorWord(me, names)} piece, and it's ${colorWord(chess.turn(), names)}'s turn.`;
  const target = chess.get(to);
  const name = PIECE_NAME[piece.type];
  if (target && target.color === me) return `Your own ${PIECE_NAME[target.type]} is already on ${to}. Pieces can't share a square, and you can't capture your own team.`;

  const df = fileOf(to) - fileOf(from);
  const dr = rankOf(to) - rankOf(from);
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  const forward = me === 'w' ? 1 : -1;

  // Does the move match how this piece moves at all?
  let shapeOk = false;
  let blockedNote = '';
  switch (piece.type) {
    case 'n':
      shapeOk = (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
      break;
    case 'b':
      shapeOk = adf === adr && adf > 0;
      break;
    case 'r':
      shapeOk = (adf === 0) !== (adr === 0);
      break;
    case 'q':
      shapeOk = (adf === adr && adf > 0) || ((adf === 0) !== (adr === 0));
      break;
    case 'k':
      shapeOk = Math.max(adf, adr) === 1;
      if (adr === 0 && adf === 2) return explainCastle(chess, from, to, me, names);
      break;
    case 'p': {
      const startRank = me === 'w' ? 1 : 6;
      if (df === 0 && dr === forward) {
        if (target) return `Pawns can't capture straight ahead. The ${PIECE_NAME[target.type]} on ${to} is blocking it. Pawns capture 1 square diagonally.`;
        shapeOk = true;
      } else if (df === 0 && dr === 2 * forward) {
        if (rankOf(from) !== startRank) return 'A Pawn can only move 2 squares on its very first move. After that, it moves 1 square at a time.';
        if (chess.get(sqAt(fileOf(from), rankOf(from) + forward)) || target) return 'Something is in the way. A Pawn can\'t jump over pieces.';
        shapeOk = true;
      } else if (adf === 1 && dr === forward) {
        if (!target && to !== epSquare(chess)) return 'Pawns only move diagonally when they are capturing a piece. There\'s nothing to capture on that square.';
        shapeOk = true;
      } else if (dr !== 0 && Math.sign(dr) !== forward) {
        return 'Pawns can never move backward. They only go forward, toward the other side of the board.';
      }
      break;
    }
  }
  if (!shapeOk) return `${PIECE_RULE[piece.type]} It can't get to ${to} from ${from}.`;

  if ((piece.type === 'b' || piece.type === 'r' || piece.type === 'q') && !pathClear(chess, from, to)) {
    const b = firstBlocker(chess, from, to);
    const bp = b ? chess.get(b) : null;
    blockedNote = bp ? `${bp.color === me ? 'Your own' : 'The'} ${PIECE_NAME[bp.type]} on ${b} is in the way.` : 'Another piece is in the way.';
    return `${blockedNote} A ${name} can't jump over pieces. Only Knights can jump!`;
  }

  // The shape is right and nothing blocks it, so the only rule left is
  // King safety.
  const ks = piece.type === 'k' ? to : kingSquare(chess, me);
  const attackers = ks ? attackersAfter(chess, from, to, ks, me) : [];
  const att = attackers[0];
  const attName = att ? `${PIECE_NAME[chess.get(att)!.type]} on ${att}` : 'enemy piece';
  if (chess.inCheck()) {
    return piece.type === 'k'
      ? `Your King is in check, and ${to} isn't safe either: the ${attName} could capture it there. Find a square where your King is safe.`
      : `Your King is in check! This move doesn't protect it. You have to move your King, block the attack, or capture the piece attacking it.`;
  }
  if (piece.type === 'k') return `Your King can't move to ${to} because the ${attName} could capture it there. A King can never move into danger.`;
  return `This ${name} is protecting your King. If it moves, the ${attName} could capture your King, so it has to stay put. (This is called a pin.)`;
}

function epSquare(chess: Chess): string {
  return chess.fen().split(' ')[3];
}

function attackersAfter(chess: Chess, from: Square, to: Square, kingSq: Square, me: Color): Square[] {
  const t = new Chess(chess.fen());
  const p = t.get(from);
  if (!p) return [];
  t.remove(from);
  t.remove(to);
  t.put(p, to);
  return t.attackers(kingSq, other(me));
}

function explainCastle(chess: Chess, from: Square, to: Square, me: Color, names: Record<Color, string>): string {
  const rights = chess.fen().split(' ')[2];
  const kingSide = fileOf(to) > fileOf(from);
  const flag = me === 'w' ? (kingSide ? 'K' : 'Q') : (kingSide ? 'k' : 'q');
  const sideWord = kingSide ? 'short side' : 'long side';
  if (!rights.includes(flag)) return `Castling (the special King and Rook move) isn't allowed on the ${sideWord} anymore, because the King or that Rook has already moved this game.`;
  const r = rankOf(from);
  const rookFile = kingSide ? 7 : 0;
  for (let f = Math.min(fileOf(from), rookFile) + 1; f < Math.max(fileOf(from), rookFile); f++) {
    if (chess.get(sqAt(f, r))) return `To castle, every square between the King and the Rook has to be empty. ${sqAt(f, r)} still has a piece on it.`;
  }
  if (chess.inCheck()) return 'You can\'t castle while your King is in check. Get your King safe first.';
  const pass = sqAt(fileOf(from) + (kingSide ? 1 : -1), r);
  if (chess.isAttacked(pass, other(me)) || chess.isAttacked(to, other(me))) {
    return `You can't castle through danger: a ${colorWord(other(me), names)} piece is watching ${chess.isAttacked(pass, other(me)) ? pass : to}.`;
  }
  return 'Castling isn\'t possible right now.';
}

// --- Computer opponent -----------------------------------------------------

const CENTER_BONUS = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [0, 1, 2, 3, 3, 2, 1, 0],
  [0, 1, 2, 3, 3, 2, 1, 0],
  [0, 1, 2, 2, 2, 2, 1, 0],
  [0, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

// Positive = good for white. Material plus a little center control and
// pawn advancement, enough to play sensible, kid-beatable chess.
function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -10000 : 10000;
  if (chess.isDraw() || chess.isStalemate()) return 0;
  let score = 0;
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (!cell) continue;
      let v = PIECE_VALUE[cell.type] * 100;
      if (cell.type === 'n' || cell.type === 'b') v += CENTER_BONUS[r][f] * 8;
      if (cell.type === 'p') {
        v += CENTER_BONUS[r][f] * 4;
        v += (cell.color === 'w' ? 7 - r : r) * 3; // board()[0] is rank 8
      }
      if (cell.type === 'q') v += CENTER_BONUS[r][f] * 2;
      // A Bishop or Knight parked in front of its own unmoved d/e pawn
      // blocks it in, a classic beginner habit the hints shouldn't teach.
      if ((cell.type === 'b' || cell.type === 'n') && (f === 3 || f === 4)) {
        const pawnRow = cell.color === 'w' ? 6 : 1;
        const frontRow = cell.color === 'w' ? 5 : 2;
        const below = board[pawnRow][f];
        if (r === frontRow && below && below.type === 'p' && below.color === cell.color) v -= 30;
      }
      score += cell.color === 'w' ? v : -v;
    }
  }
  return score;
}

function orderMoves(moves: Move[]): Move[] {
  return moves
    .map((m) => ({ m, s: (m.captured ? PIECE_VALUE[m.captured] * 10 - PIECE_VALUE[m.piece] : 0) + (m.promotion ? 80 : 0) + (m.san.includes('+') ? 5 : 0) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

class OutOfTime extends Error {}
let deadline = Infinity;

function negamax(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (performance.now() > deadline) throw new OutOfTime();
  const sign = chess.turn() === 'w' ? 1 : -1;
  if (depth === 0 || chess.isGameOver()) return sign * evaluate(chess);
  let best = -Infinity;
  for (const m of orderMoves(chess.moves({ verbose: true }))) {
    chess.move(m);
    let v: number;
    try {
      v = -negamax(chess, depth - 1, -beta, -alpha);
    } finally {
      chess.undo();
    }
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export type Level = 'easy' | 'medium' | 'hard';

// Easy plays a decent move most of the time but slips about a third of
// the time, so a beginner can actually win. Medium looks 2 moves ahead.
// Hard looks 3 ahead when it can finish within ~1.2s (iPad-friendly), and
// otherwise falls back to its 2-move answer.
export function pickComputerMove(fen: string, level: Level): Move | null {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) return null;
  if (level === 'easy') {
    if (Math.random() < 0.35) return moves[Math.floor(Math.random() * moves.length)];
    return searchBest(chess, 1);
  }
  if (level === 'medium') return searchBest(chess, 2);
  const fallback = searchBest(chess, 2);
  deadline = performance.now() + 1200;
  try {
    return searchBest(chess, 3);
  } catch (e) {
    if (e instanceof OutOfTime) return fallback;
    throw e;
  } finally {
    deadline = Infinity;
  }
}

function searchBest(chess: Chess, depth: number): Move {
  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const m of orderMoves(chess.moves({ verbose: true }))) {
    chess.move(m);
    let v: number;
    try {
      v = -negamax(chess, depth - 1, -Infinity, Infinity);
    } finally {
      chess.undo();
    }
    if (v > bestScore + 0.5) {
      bestScore = v;
      best = [m];
    } else if (Math.abs(v - bestScore) <= 0.5) {
      best.push(m);
    }
  }
  return best[Math.floor(Math.random() * best.length)];
}

// --- Hints -----------------------------------------------------------------

export interface Hint { from: Square; to: Square; text: string }

export function suggestMove(fen: string): Hint | null {
  const chess = new Chess(fen);
  if (chess.isGameOver()) return null;
  const m = searchBest(chess, 2);
  return { from: m.from, to: m.to, text: explainGoodMove(new Chess(fen), m) };
}

// A plain-language reason a move is a good idea, from the biggest reason
// down (checkmate > winning material > check > safety > development).
export function explainGoodMove(before: Chess, m: Move): string {
  const name = PIECE_NAME[m.piece];
  const me = m.color;
  const after = new Chess(before.fen());
  after.move(m);
  const lead = `Try moving your ${name} from ${m.from} to ${m.to}.`;
  if (after.isCheckmate()) return `${lead} That's CHECKMATE, you win!`;
  if (m.promotion) return `${lead} Your Pawn reaches the end of the board and turns into a ${PIECE_NAME[m.promotion]}!`;
  if (m.captured) {
    const safe = !after.isAttacked(m.to, other(me));
    return `${lead} It captures their ${PIECE_NAME[m.captured]} (worth ${PIECE_VALUE[m.captured]} point${PIECE_VALUE[m.captured] === 1 ? '' : 's'})${safe ? ', and nothing can capture it back.' : '.'}`;
  }
  if (m.san.includes('O-O')) return `${lead} That's castling: it tucks your King somewhere safe and wakes up your Rook.`;
  const wasAttacked = before.isAttacked(m.from, other(me)) && m.piece !== 'k';
  const nowSafe = !after.isAttacked(m.to, other(me));
  if (wasAttacked && nowSafe) return `${lead} Your ${name} was in danger where it was, and ${m.to} is a safe square.`;
  if (after.inCheck()) return `${lead} It puts their King in check, so they have to deal with it.`;
  const backRank = me === 'w' ? '1' : '8';
  if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === backRank) return `${lead} It gets a sleepy piece off the back row and into the game.`;
  if (['d4', 'e4', 'd5', 'e5', 'c4', 'c5', 'f4', 'f5'].includes(m.to)) return `${lead} It helps control the middle of the board, where the action is.`;
  return `${lead} It keeps your pieces safe and gets you ready for your next move.`;
}

// Squares a piece could move to but where it could be captured right away
// and isn't worth the risk (attacked and not defended, or attacked by
// something cheaper). Used to tint "careful!" moves on the board.
export function riskyTargets(fen: string, from: Square): Set<string> {
  const chess = new Chess(fen);
  const piece = chess.get(from);
  const risky = new Set<string>();
  if (!piece) return risky;
  for (const m of chess.moves({ square: from, verbose: true })) {
    chess.move(m);
    const attacked = chess.isAttacked(m.to, other(piece.color));
    if (attacked) {
      const defended = chess.attackers(m.to, piece.color).length > 0;
      const cheapest = Math.min(...chess.attackers(m.to, other(piece.color)).map((s) => PIECE_VALUE[chess.get(s)!.type] || 100));
      const gain = m.captured ? PIECE_VALUE[m.captured] : 0;
      if (!defended || cheapest < PIECE_VALUE[piece.type] - gain) risky.add(m.to);
    }
    chess.undo();
  }
  return risky;
}

// Plain-language line for the move list ("Blueberry Knight jumped to f6, capturing a Pawn").
export function describeMove(m: Move, names: Record<Color, string>): string {
  const who = `${names[m.color]} ${PIECE_NAME[m.piece]}`;
  if (m.san.startsWith('O-O-O')) return `${names[m.color]} castled on the long side`;
  if (m.san.startsWith('O-O')) return `${names[m.color]} castled on the short side`;
  let s = `${who} ${m.piece === 'n' ? 'jumped' : 'moved'} to ${m.to}`;
  if (m.captured) s += `, capturing a ${PIECE_NAME[m.captured]}`;
  if (m.promotion) s += ` and became a ${PIECE_NAME[m.promotion]}`;
  if (m.san.includes('#')) s += '. Checkmate!';
  else if (m.san.includes('+')) s += '. Check!';
  return s;
}
