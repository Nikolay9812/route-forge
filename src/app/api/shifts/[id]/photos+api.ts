// Vehicle check photos of one of the courier's own shifts: start an upload, keep the uploaded photo, remove one.
// Only while the shift is a draft or rejected; someone else's shift answers 404.
import { isId } from "@/domain/shift";
import { apiError, handle } from "@/server/auth";
import { courierContext } from "@/server/context";
import { shiftPhotoRoute } from "@/server/shift-photos";
import { ownShift } from "@/server/shifts";

function route(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const shift = await ownShift(ctx.courier, id);
    if (!shift) return apiError("notFound");
    return shiftPhotoRoute(request, ctx.courier, shift);
  });
}

/** Body `{ slot, contentType }`; answers `{ key, uploadUrl }` (a 5-minute presigned PUT). */
export const POST = route;
/** Body `{ slot, key }` once the file is uploaded; answers the shift's photos. */
export const PUT = route;
/** Query `?slot=`; answers the shift's photos. */
export const DELETE = route;
