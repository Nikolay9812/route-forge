// One courier's documents for the owner, who can also save any section. Anyone who isn't a courier of this firm
// answers 404.
import { parseDetailsPatch } from "@/domain/courier-details";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { documentsOf, isFirmCourier, saveDetails } from "@/server/courier-details";

export function GET(request: Request, { userId }: { userId: string }) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!(await isFirmCourier(owner.firmId, userId))) return apiError("notFound");
    return Response.json(await documentsOf(owner.firmId, userId, owner.date));
  });
}

/** Body `{ section, values }` with every field of that section; answers the updated documents. */
export function PATCH(request: Request, { userId }: { userId: string }) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!(await isFirmCourier(owner.firmId, userId))) return apiError("notFound");
    const body = parseDetailsPatch(await readJson(request), owner.date);
    if (!body.ok) return apiError("invalid");
    await saveDetails(owner.firmId, userId, owner.userId, body.value.values);
    return Response.json(await documentsOf(owner.firmId, userId, owner.date));
  });
}
