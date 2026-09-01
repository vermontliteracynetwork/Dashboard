export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isWeekend = (isoDate: string): boolean => {
  const d = new Date(`${isoDate}T00:00:00`);
  const day = d.getDay();
  return day === 0 || day === 6;
};

// Count the number of "school days" (Mon-Fri) strictly between two ISO dates (exclusive of both ends).
const schoolDaysBetween = (fromISO: string, toISO: string): number => {
  const from = new Date(`${fromISO}T00:00:00`);
  const to = new Date(`${toISO}T00:00:00`);
  let count = 0;
  const cursor = new Date(from);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor < to) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

/**
 * A streak continues if the last completed day and today are the same day,
 * consecutive, or separated only by a weekend (weekends auto-freeze).
 */
export const streakContinues = (lastCompletedISO: string | null, todayISOStr: string): boolean => {
  if (!lastCompletedISO) return false;
  if (lastCompletedISO === todayISOStr) return true;
  const gapSchoolDays = schoolDaysBetween(lastCompletedISO, todayISOStr);
  return gapSchoolDays === 0;
};
