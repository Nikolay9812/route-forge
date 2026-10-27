// Month calendars, shared by API routes, the app and Node scripts. Pure and import-free at runtime.
// Months are "YYYY-MM" and days "YYYY-MM-DD" in the firm's timezone; weeks start on Monday.
import type { Shift } from "./types";

export type CalendarDay = { date: string; inMonth: boolean };

export type MonthStats = {
  /** Every shift in the month, any status. */
  shifts: number;
  /** Worked time (after the break) of submitted and approved shifts. */
  minutes: number;
  approvedMinutes: number;
  submitted: number;
  rejected: number;
};

export function isMonth(text: string): boolean {
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  return !!match && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** "2026-10" + 1 → "2026-11". */
export function addMonths(month: string, n: number): string {
  const [year, m] = month.split("-").map(Number);
  return utcDay(new Date(Date.UTC(year, m - 1 + n, 1))).slice(0, 7);
}

/** The last calendar day of the month, e.g. "2026-10-31". */
export function lastDayOf(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return utcDay(new Date(Date.UTC(year, m, 0)));
}

/** Months from `from` to `to`, both included, oldest first. Empty when `from` is after `to`. */
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) months.push(month);
  return months;
}

/** Full Monday-first weeks covering the month, padded with days of the neighbouring months. */
export function monthGrid(month: string): CalendarDay[][] {
  const [year, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, m - 1, 1));
  const daysBefore = (first.getUTCDay() + 6) % 7;
  const cursor = new Date(Date.UTC(year, m - 1, 1 - daysBefore));
  const weeks: CalendarDay[][] = [];
  do {
    const week: CalendarDay[] = [];
    for (let i = 0; i < 7; i++) {
      const date = utcDay(cursor);
      week.push({ date, inMonth: date.startsWith(month) });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
  } while (utcDay(cursor).startsWith(month));
  return weeks;
}

export function monthStats(shifts: readonly Shift[]): MonthStats {
  const stats: MonthStats = { shifts: 0, minutes: 0, approvedMinutes: 0, submitted: 0, rejected: 0 };
  for (const shift of shifts) {
    stats.shifts += 1;
    if (shift.status === "submitted") stats.submitted += 1;
    if (shift.status === "rejected") stats.rejected += 1;
    if (shift.status === "submitted" || shift.status === "approved") stats.minutes += shift.workedMinutes ?? 0;
    if (shift.status === "approved") stats.approvedMinutes += shift.workedMinutes ?? 0;
  }
  return stats;
}
