// Home for the signed-in courier: today's shift, recent shifts and this month's totals. Pay is the courier's own,
// from approved shifts only, computed on every request and never stored.
import { monthOf } from "@/domain/dates";
import { monthTotals } from "@/domain/salary";
import { handle } from "@/server/auth";
import { courierContext } from "@/server/context";
import { ratesOf, shiftOn, shiftsBefore, shiftsBetween } from "@/server/shifts";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, firm, date } = ctx;
    const [today, recent, month, rates] = await Promise.all([
      shiftOn(courier, date),
      shiftsBefore(courier, date, 5),
      shiftsBetween(courier, `${monthOf(date)}-01`, date),
      ratesOf(courier),
    ]);
    return Response.json({ firm, date, today, recent, totals: monthTotals(month, rates) });
  });
}
