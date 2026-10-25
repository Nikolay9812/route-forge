// Resubmit the courier's own rejected shift. Its times stay as they are; the previous review is cleared.
import { isId } from "@/domain/shift";
import { apiError, handle } from "@/server/auth";
import { courierContext } from "@/server/context";
import { resubmitShift } from "@/server/shifts";

export function POST(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const result = await resubmitShift(ctx.courier, id);
    return typeof result === "string" ? apiError(result) : Response.json(result);
  });
}
