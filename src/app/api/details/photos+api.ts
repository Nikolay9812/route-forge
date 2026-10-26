// Photos of the signed-in courier's own documents: start an upload, keep the uploaded photo, remove one. Couriers
// only; there is no user ID in the request, so nobody can address another courier's photos here.
import { handle } from "@/server/auth";
import { courierContext } from "@/server/context";
import { photoRoute } from "@/server/courier-details";

function route(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { firmId, userId } = ctx.courier;
    return photoRoute(request, { firmId, userId, editorId: userId, today: ctx.date });
  });
}

/** Body `{ section, slot, contentType }`; answers `{ key, uploadUrl }` (a 5-minute presigned PUT). */
export const POST = route;
/** Body `{ section, slot, key }` once the file is uploaded; answers the updated documents. */
export const PUT = route;
/** Query `?section=&slot=`; answers the updated documents. */
export const DELETE = route;
