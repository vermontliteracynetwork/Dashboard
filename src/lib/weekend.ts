// Build Queue 772 (her words: "assignments are optional on weekends. though money earned should be double on saturday
// and sunday. give an anouncement if students log on on those days that money earned is 2x"). Saturday and Sunday on
// the student's own clock.
export const isWeekend = (d: Date = new Date()) => d.getDay() === 0 || d.getDay() === 6;
// Money that is earned (answers, tasks, spins, streaks, achievements). Teacher adjustments, refunds, sales and
// purchases are never doubled.
const EARNED = new Set(['task', 'streak-interest', 'spin-cash', 'spin', 'achievement', 'assignment-complete', 'bakery-match', 'castle-defense', 'game-answers', 'streak-chest', 'coins']);
export const weekendDoubles = (kind: string, amountCents: number, d: Date = new Date()) => amountCents > 0 && EARNED.has(kind) && isWeekend(d);
