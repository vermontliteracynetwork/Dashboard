// "Class Cash" — the app's practice currency. Stored everywhere as whole
// cents (never floats) and only converted to a dollar string for display,
// the same way a real fintech app avoids floating-point rounding drift.
export const DEFAULT_TASK_REWARD_CENTS = 100; // $1.00, used when a task has no teacher-set reward

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
