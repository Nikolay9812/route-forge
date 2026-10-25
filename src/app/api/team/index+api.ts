// The Team tab: couriers the dispatcher (their depots) or owner (the whole firm) may see, with this month's totals.
import { handle } from "@/server/auth";
import { reviewerContext } from "@/server/context";
import { firmToday } from "@/server/shifts";
import { teamList } from "@/server/team";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await reviewerContext(request);
    if (ctx instanceof Response) return ctx;
    const today = firmToday(ctx.firm);
    return Response.json({ firm: ctx.firm, today, couriers: await teamList(ctx.scope, today) });
  });
}
