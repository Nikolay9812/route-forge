// Month calendars for API routes: the `month` query parameter and the response shape shared by couriers and reviewers.
import { isMonth, lastDayOf, monthStats } from "@/domain/calendar";
import { monthOf } from "@/domain/dates";
import type { CalendarMonth, Firm, Shift } from "@/domain/types";

/** The requested month ("YYYY-MM"), the current one when absent, or null when it isn't a valid month. */
export function monthParam(request: Request, today: string): string | null {
  const month = new URL(request.url).searchParams.get("month") ?? monthOf(today);
  return isMonth(month) ? month : null;
}

/** First and last calendar day of the month, for date range queries. */
export function monthRange(month: string): [string, string] {
  return [`${month}-01`, lastDayOf(month)];
}

/** Paging back stops at the month of the first shift, or at the current month when there are none. */
export function firstMonthOf(today: string, firstDate: string | null): string {
  const current = monthOf(today);
  return firstDate && monthOf(firstDate) < current ? monthOf(firstDate) : current;
}

export function calendarMonth(
  firm: Firm,
  today: string,
  month: string,
  shifts: Shift[],
  firstDate: string | null,
): CalendarMonth {
  return { firm, today, month, firstMonth: firstMonthOf(today, firstDate), shifts, stats: monthStats(shifts) };
}
