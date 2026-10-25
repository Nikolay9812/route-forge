// Home for the signed-in courier: today's shift, recent shifts, this month's totals and their own pay rate. Pay is
// the courier's own, from approved shifts only, computed on every request and never stored.
import { monthOf } from "@/domain/dates";
import { monthTotals, nextRate, rateFor } from "@/domain/salary";
import { handle } from "@/server/auth";
import { courierContext } from "@/server/context";
import { payScheduleOf } from "@/server/pay-rates";
import { shiftOn, shiftsBefore, shiftsBetween } from "@/server/shifts";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, firm, date } = ctx;
    const [today, recent, month, schedule] = await Promise.all([
      shiftOn(courier, date),
      shiftsBefore(courier, date, 5),
      shiftsBetween(courier, `${monthOf(date)}-01`, date),
      payScheduleOf(courier.firmId, courier.userId),
    ]);
    const rate = { current: rateFor(date, schedule), next: nextRate(date, schedule) };
    return Response.json({ firm, date, today, recent, totals: monthTotals(month, schedule), rate });
  });
}
