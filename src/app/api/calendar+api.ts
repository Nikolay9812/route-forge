// One month of the signed-in courier's own shifts for the calendar on the Shifts tab.
import { apiError, handle } from "@/server/auth";
import { calendarMonth, monthParam, monthRange } from "@/server/calendar";
import { courierContext } from "@/server/context";
import { firstShiftDate, shiftsBetween } from "@/server/shifts";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, firm, date } = ctx;
    const month = monthParam(request, date);
    if (!month) return apiError("invalid");
    const [shifts, first] = await Promise.all([
      shiftsBetween(courier, ...monthRange(month)),
      firstShiftDate(courier),
    ]);
    return Response.json(calendarMonth(firm, date, month, shifts, first));
  });
}
