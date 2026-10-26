// The signed-in courier's own documents, and saving one section of them. Couriers only; there is no user ID in
// the request, so nobody can address another courier's documents here.
import { parseDetailsPatch } from "@/domain/courier-details";
import { apiError, handle, readJson } from "@/server/auth";
import { courierContext } from "@/server/context";
import { documentsOf, saveDetails } from "@/server/courier-details";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { firmId, userId } = ctx.courier;
    return Response.json(await documentsOf(firmId, userId, ctx.date));
  });
}

/** Body `{ section, values }` with every field of that section; answers the updated documents. */
export function PATCH(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const body = parseDetailsPatch(await readJson(request), ctx.date);
    if (!body.ok) return apiError("invalid");
    const { firmId, userId } = ctx.courier;
    await saveDetails(firmId, userId, userId, body.value.values);
    return Response.json(await documentsOf(firmId, userId, ctx.date));
  });
}
