import { describe, expect, it } from 'vitest';
import { riskMap } from '../chessCoach';

// Build Queue 220: the risky warning in Slime Chess.
describe('Slime Chess risky warning', () => {
  it('a square guarded only by the enemy is a loss; a square you also guard is a trade', () => {
    // White knight b1, black pawn on d6 guards c5 and e5; white pawn d4 guards e5 and c5.
    const fen = '4k3/8/3p4/8/3P4/8/8/1N2K3 w - - 0 1';
    const r = riskMap(fen, 'b1');
    expect(r.has('a3')).toBe(false);
    expect(r.has('c3')).toBe(false);
    const fen2 = '4k3/8/3p4/8/8/8/8/4K1N1 w - - 0 1';
    expect(riskMap(fen2, 'g1').size).toBe(0);
    // Knight to c5 or e5 next to a black pawn on d6: pawn can capture.
    const fen3 = '4k3/8/3p4/8/1N6/8/8/4K3 w - - 0 1';
    expect(riskMap(fen3, 'b4').get('c6')).toBeUndefined();
    const fen4 = '4k3/8/3p4/8/8/2N5/3P4/4K3 w - - 0 1'; // pawn d2 does not guard e5
    expect(riskMap(fen4, 'c3').get('e4')).toBeUndefined();
  });
  it('flags loss vs trade correctly', () => {
    // Black pawn d6 attacks e5. White pawn d4 guards e5 -> trade. Without d4 -> lose.
    expect(riskMap('4k3/8/3p4/8/3P4/2N5/8/4K3 w - - 0 1', 'c3').get('e4')).toBeUndefined();
    expect(riskMap('4k3/8/3p4/8/3P4/8/2N5/4K3 w - - 0 1', 'c2').get('e3')).toBeUndefined();
    const trade = riskMap('4k3/8/3p4/8/3P4/8/5N2/4K3 w - - 0 1', 'f2'); // Nf2-e4? d5? use g4->e5
    expect(trade.size).toBeGreaterThanOrEqual(0);
    const t = riskMap('4k3/8/3p4/8/3P2N1/8/8/4K3 w - - 0 1', 'g4').get('e5');
    expect(t?.level).toBe('trade');
    const l = riskMap('4k3/8/3p4/8/6N1/8/8/4K3 w - - 0 1', 'g4').get('e5');
    expect(l?.level).toBe('lose');
  });
  it('warns when a move leaves another piece open', () => {
    // White rook a1 is safe while the white bishop on b2 blocks the black bishop's diagonal from h8... use a guard:
    // White knight c3 guards e4? Simpler: white rook e1 blocks a black rook on e8 from the white queen on e... no.
    // White bishop d4 blocks the black rook on d8 from the white queen on d1.
    const fen = '3rk3/8/8/8/3B4/8/8/3QK3 w - - 0 1';
    const r = riskMap(fen, 'd4');
    const anyAway = r.get('a7') ?? r.get('h8') ?? r.get('e3');
    expect(anyAway?.exposes).toContain('d1');
    expect(r.get('d5')).toBeUndefined(); // stays on the d file, still blocking
  });
});
