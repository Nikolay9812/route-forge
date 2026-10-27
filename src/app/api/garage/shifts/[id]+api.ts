// One vehicle check for a mechanic: the shift's day, courier, car and signed photos, only within the last 7 days
// and for an active car. Anything else answers 404.
import { isId } from "@/domain/shift";
import { apiError, handle } from "@/server/auth";
import { garageContext } from "@/server/context";
import { garageCheck } from "@/server/garage";

export function GET(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const check = await garageCheck(ctx, id);
    return check ? Response.json(check) : apiError("notFound");
  });
}
