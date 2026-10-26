// Home for the signed-in courier: today's shift and recent shifts. Pay and month totals live on the Pay tab
// (`GET /api/pay`).
import { handle } from "@/server/auth";
import { courierContext } from "@/server/context";
import { shiftOn, shiftsBefore } from "@/server/shifts";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, firm, date } = ctx;
    const [today, recent] = await Promise.all([shiftOn(courier, date), shiftsBefore(courier, date, 5)]);
    return Response.json({ firm, date, today, recent });
  });
}
