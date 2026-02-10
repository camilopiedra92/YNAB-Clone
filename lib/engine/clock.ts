/**
 * System Clock — Pure logic for time and date handling.
 * 
 * Centralizing all Date-related logic here prevents timezone-related bugs
 * and makes the application easily testable by allowing clock mocking.
 */

/**
 * Returns the current month in YYYY-MM format.
 * 
 * @param timezone Optional timezone string (defaults to system local)
 */
export function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Checks if the given month (YYYY-MM) is in the past relative to the current month.
 * 
 * @param month Month to check in YYYY-MM format
 */
export function isPastMonth(month: string): boolean {
  return month < getCurrentMonth();
}

/**
 * Checks if the given month (YYYY-MM) is the current month.
 * 
 * @param month Month to check in YYYY-MM format
 */
export function isCurrentMonth(month: string): boolean {
  return month === getCurrentMonth();
}

/**
 * Checks if the given month (YYYY-MM) is in the future relative to the current month.
 * 
 * @param month Month to check in YYYY-MM format
 */
export function isFutureMonth(month: string): boolean {
  return month > getCurrentMonth();
}
