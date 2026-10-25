// Submit today's shift to the dispatcher. Finish time and working time come from the database clock.
import { apiError, handle } from "@/server/auth";
import { courierContext } from "@/server/context";
import { submitShift } from "@/server/shifts";

export function POST(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const result = await submitShift(ctx.courier, ctx.date);
    return typeof result === "string" ? apiError(result) : Response.json(result);
  });
}
