// One courier's month calendar for a reviewer. A courier outside the reviewer's team answers 404.
import { apiError, handle } from "@/server/auth";
import { monthParam } from "@/server/calendar";
import { reviewerContext } from "@/server/context";
import { firmToday } from "@/server/shifts";
import { courierMonth } from "@/server/team";

export function GET(request: Request, { userId }: { userId: string }) {
  return handle(async () => {
    const ctx = await reviewerContext(request);
    if (ctx instanceof Response) return ctx;
    const today = firmToday(ctx.firm);
    const month = monthParam(request, today);
    if (!month) return apiError("invalid");
    const result = await courierMonth(ctx.scope, ctx.firm, today, userId, month);
    return result ? Response.json(result) : apiError("notFound");
  });
}
