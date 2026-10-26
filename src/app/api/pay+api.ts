// One month of the signed-in courier's own pay for the Pay tab: approved totals, the rates in force, and the
// approved and pending days behind them, plus the 5 months before the current one. Computed on every request from
// approved shifts, never stored.
import { addMonths, lastDayOf } from "@/domain/calendar";
import { monthOf } from "@/domain/dates";
import { monthTotals, nextRate, payDays, ratesIn } from "@/domain/salary";
import type { MonthPay, PayMonth, PaySchedule, Shift } from "@/domain/types";
import { apiError, handle } from "@/server/auth";
import { firstMonthOf, monthParam, monthRange } from "@/server/calendar";
import { courierContext } from "@/server/context";
import { payScheduleOf } from "@/server/pay-rates";
import { firstShiftDate, shiftsBetween } from "@/server/shifts";

const RECENT_MONTHS = 5;

/** The months before `current`, newest first, from `firstMonth` on. */
function recentMonthsOf(
  current: string,
  firstMonth: string,
  shifts: Shift[],
  schedule: PaySchedule,
): MonthPay[] {
  const months: MonthPay[] = [];
  for (let i = 1; i <= RECENT_MONTHS; i++) {
    const month = addMonths(current, -i);
    if (month < firstMonth) break;
    const totals = monthTotals(
      shifts.filter((s) => s.date.startsWith(month)),
      schedule,
    );
    months.push({
      month,
      payMinor: totals.payMinor,
      approvedMinutes: totals.approvedMinutes,
      approvedShifts: totals.approvedShifts,
    });
  }
  return months;
}

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, firm, date } = ctx;
    const month = monthParam(request, date);
    if (!month) return apiError("invalid");
    const [first, last] = monthRange(month);
    const thisMonth = monthOf(date);
    const [shifts, earlier, firstDate, schedule] = await Promise.all([
      shiftsBetween(courier, first, last),
      shiftsBetween(
        courier,
        `${addMonths(thisMonth, -RECENT_MONTHS)}-01`,
        lastDayOf(addMonths(thisMonth, -1)),
      ),
      firstShiftDate(courier),
      payScheduleOf(courier.firmId, courier.userId),
    ]);
    const current = month === thisMonth;
    const firstMonth = firstMonthOf(date, firstDate);
    const body: PayMonth = {
      firm,
      today: date,
      month,
      firstMonth,
      totals: monthTotals(shifts, schedule),
      rates: ratesIn(first, current ? date : last, schedule),
      next: current ? nextRate(date, schedule) : null,
      days: payDays(shifts, schedule),
      recentMonths: recentMonthsOf(thisMonth, firstMonth, earlier, schedule),
    };
    return Response.json(body);
  });
}
