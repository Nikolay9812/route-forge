// Photos of one courier's documents for the owner: the same calls as `/api/details/photos`. Anyone who isn't a
// courier of this firm answers 404.
import { apiError, handle } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { isFirmCourier, photoRoute } from "@/server/courier-details";

function route(request: Request, { userId }: { userId: string }) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!(await isFirmCourier(owner.firmId, userId))) return apiError("notFound");
    return photoRoute(request, { firmId: owner.firmId, userId, editorId: owner.userId, today: owner.date });
  });
}

/** Body `{ section, slot, contentType }`; answers `{ key, uploadUrl }` (a 5-minute presigned PUT). */
export const POST = route;
/** Body `{ section, slot, key }` once the file is uploaded; answers the updated documents. */
export const PUT = route;
/** Query `?section=&slot=`; answers the updated documents. */
export const DELETE = route;
