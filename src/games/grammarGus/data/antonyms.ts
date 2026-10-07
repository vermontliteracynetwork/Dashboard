// Opposites the rubric uses for "actually possible" (plan 3.18.3).
// Data on purpose: the teacher can edit these lists.
export const DESCRIBER_OPPOSITES: [string, string[]][] = [
  ['big', ['small', 'tiny']],
  ['great', ['small', 'tiny']],
  ['young', ['old']],
  ['new', ['old']],
  ['plain', ['fancy', 'dazzling']],
  ['chubby', ['tiny']],
  ['plump', ['tiny']],
];

export const HOW_OPPOSITES: [string, string[]][] = [
  ['quickly', ['slowly']],
  ['swiftly', ['slowly']],
  ['loudly', ['quietly', 'softly', 'gently']],
  ['wildly', ['gently', 'softly', 'quietly', 'tenderly', 'lightly']],
];

export function areOpposites(table: [string, string[]][], a: string, b: string): boolean {
  return table.some(([x, ys]) => (x === a && ys.includes(b)) || (x === b && ys.includes(a)));
}
