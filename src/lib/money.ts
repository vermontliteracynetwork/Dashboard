// "Class Cash" — the app's practice currency. Stored everywhere as whole
// cents (never floats) and only converted to a dollar string for display,
// the same way a real fintech app avoids floating-point rounding drift.
export const DEFAULT_TASK_REWARD_CENTS = 100; // $1.00, used when a task has no teacher-set reward
export const DEFAULT_BADGE_REWARD_CENTS = 200; // $2.00, used when an achievement has no teacher-set reward
// Claudia's daily-review audit (H2): Playground/Free Play content is
// unlimited-replay by design (a fully-mastered practice set resets to a
// fresh attempt every time it's reopened), unlike a real assignment task
// which is done for the day once checked off. Paying it the same
// DEFAULT_TASK_REWARD_CENTS as a real assignment made ungraded free-choice
// content more lucrative per minute than actual schoolwork. A smaller,
// explicitly-separate constant keeps the reinforcement real without
// inverting the economy.
export const PLAYGROUND_REWARD_CENTS = 25; // $0.25, used when a Playground/Free Play activity has no teacher-set reward

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
