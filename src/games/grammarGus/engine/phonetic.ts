// Phonetic predictive typing (teacher 2026-10-07: "if they're typing the
// word balloon, they may spell it wrong. But I want the system to pick up
// that they're probably looking for the word balloon, especially if it's
// in a noun section"). Words are matched three ways and the best one
// wins: the start of the word (typing in progress), the whole word with a
// few typos, and how the word SOUNDS (a simple sound key: c/k/q are one
// sound, ph is f, vowels in the middle do not count, double letters are one).

export function soundKey(word: string): string {
  let s = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s.replace(/^kn/, 'n').replace(/^wr/, 'r').replace(/^wh/, 'w').replace(/^ps/, 's').replace(/^gh/, 'g')
    .replace(/ph/g, 'f').replace(/gh/g, '').replace(/tch/g, 'ch').replace(/dge/g, 'j').replace(/ck/g, 'k')
    .replace(/sh/g, '1').replace(/ch/g, '2').replace(/th/g, '3')
    .replace(/c(?=[eiy])/g, 's').replace(/[cq]/g, 'k').replace(/x/g, 'ks').replace(/z/g, 's').replace(/g(?=[ei])/g, 'j');
  const first = /[aeiouy]/.test(s[0]) ? 'a' : s[0];
  const rest = s.slice(1).replace(/[aeiouyhw]/g, '');
  return (first + rest).replace(/(.)\1+/g, '$1');
}

function lev(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

// Lower is better. Infinity means "not a match".
export function matchScore(input: string, word: string): number {
  const q = input.toLowerCase().replace(/[^a-z]/g, '');
  const w = word.toLowerCase();
  if (!q) return 0;
  if (w === q) return 0;
  if (w.startsWith(q)) return 1 + (w.length - q.length) * 0.01;
  const dPre = lev(q, w.slice(0, q.length)) / q.length;
  const dWhole = lev(q, w) / Math.max(q.length, w.length);
  const qk = soundKey(q), wk = soundKey(w);
  const dSound = qk.length < 2 ? 1 : wk === qk ? 0 : wk.startsWith(qk) ? 0.12 : lev(qk, wk) / Math.max(qk.length, wk.length);
  const best = Math.min(q.length >= 3 ? dPre * 1.3 : 1, dWhole, dSound);
  const firstSound = (qk[0] ?? '') === (wk[0] ?? '') ? 0 : 0.25;
  const score = 2 + (best + firstSound) * 3 + dWhole * 0.4; // closest spelling breaks sound ties (rabit: rabbit before robot)
  return score <= 4 ? score : Infinity;
}

// The best guesses for what the student is typing, best first.
export function predictWords(input: string, words: string[], limit = 12): string[] {
  if (!input.trim()) return words;
  return words.map((w) => ({ w, s: matchScore(input, w) })).filter((x) => x.s < Infinity)
    .sort((a, b) => a.s - b.s || a.w.length - b.w.length || a.w.localeCompare(b.w)).slice(0, limit).map((x) => x.w);
}
