// Typo-tolerant answer matching for typed fill-in-the-blank quiz
// questions. Claudia's quiz-mode audit: a strict exact-match check
// penalizes a dyslexic student for a transposed or misspelled letter
// even when they clearly know the right answer — that's testing
// spelling mechanics the question was never meant to assess. Only
// applies to a student's own TYPED answer; word-bank taps (picking an
// exact pre-written option) stay an exact match, since nothing was typed
// there to have a typo in.
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Tolerance scales with the correct answer's own length — a short word
// (up to 4 letters) tolerates no typos (too easy to accidentally match a
// genuinely different short word), a medium word tolerates 1, a longer
// one tolerates 2.
export function isCloseEnoughAnswer(given: string, correct: string): boolean {
  const g = given.trim().toLowerCase();
  const c = correct.trim().toLowerCase();
  if (g === c) return true;
  if (!g || !c) return false;
  const tolerance = c.length <= 4 ? 0 : c.length <= 8 ? 1 : 2;
  return levenshtein(g, c) <= tolerance;
}
