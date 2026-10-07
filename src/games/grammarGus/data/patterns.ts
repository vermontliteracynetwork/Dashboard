import type { Pos } from '../engine/types';

// The teacher's 33 sentence patterns (Grammar_Sentence_Reference_List.pdf,
// plan section 10). Source of truth and test fixtures. Do not change a
// pattern without the teacher's approval (plan section 25.8).
export interface Pattern { id: number; symbols: Pos[]; example: string }

const p = (id: number, s: string, example: string): Pattern => ({ id, symbols: s.split(' ') as Pos[], example });

export const PATTERNS: Pattern[] = [
  p(1, 'A N V', 'The cat ran.'),
  p(2, 'A J N V', 'The small cat ran.'),
  p(3, 'A J J N V', 'The small white cat ran.'),
  p(4, 'A N V D', 'The cat ran quickly.'),
  p(5, 'A J N V D', 'The small cat ran quickly.'),
  p(6, 'A J J N V D', 'The small white cat ran quickly.'),
  p(7, 'A N C A N V', 'The cat and the dog ran.'),
  p(8, 'A J N C A J N V', 'The small cat and the big dog ran.'),
  p(9, 'A J N C A J N V D', 'The small cat and the big dog ran quickly.'),
  p(10, 'A N V P A N', 'The dog jumped over the cat.'),
  p(11, 'A J N V P A N', 'The big dog jumped over the cat.'),
  p(12, 'A J N V P C P A N', 'The big dog jumped over and around the cat.'),
  p(13, 'D A N V', 'Softly, the girl sings.'),
  p(14, 'D A J N V', 'Softly, the young girl sings.'),
  p(15, 'D A J J N V', 'Softly, the pretty, young girl sings.'),
  p(16, 'A N V D C A N V D', 'The bug crawled slowly and the bird flew quickly.'),
  p(17, 'A N C A N V C V', 'The fish and the dolphin swam and jumped.'),
  p(18, 'D A N C A N V', 'Quickly, the boy and the girl ran.'),
  p(19, 'D A N V C D A N V', 'Slowly, the turtle crawled, and quickly the hare ran.'),
  p(20, 'A J N V D P A N', 'A small ball bounced loudly on the floor.'),
  p(21, 'D A J N V P A N', 'Loudly, a hard rock broke through the window.'),
  p(22, 'R V', 'He jumps.'),
  p(23, 'R V D', 'He jumps slowly.'),
  p(24, 'R V D C D', 'He jumps slowly and quietly.'),
  p(25, 'R V P A N', 'He runs through the door.'),
  p(26, 'R V D P A N', 'He runs quickly through the door.'),
  p(27, 'R V D C D', 'He sings loudly and proudly.'),
  p(28, 'R V C V', 'She cleans and dusts.'),
  p(29, 'R V C V P A N', 'She eats and drinks at the table.'),
  p(30, 'R V C V P A N', 'He cooks and bakes in the kitchen.'),
  p(31, 'I R V A N', 'Eek! I missed the bus!'),
  p(32, 'I A N V D', 'Phew! The plane landed safely.'),
  p(33, 'I A N V', 'Yuck! The popsicle melted.'),
];

export const patternById = (id: number) => PATTERNS.find((x) => x.id === id)!;
export function patternsForColumns(n: number): Pattern[] {
  return PATTERNS.filter((x) => x.symbols.length === n);
}
// Pattern 31 is the one pattern with an object noun right after the verb.
export const OBJECT_PATTERNS = new Set([31]);
