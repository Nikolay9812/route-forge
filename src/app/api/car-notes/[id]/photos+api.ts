// A note's photos: start an upload, keep the uploaded photo, remove it. Its author only, within 7 days; notes of
// other firms answer 404.
import { isId } from "@/domain/shift";
import { apiError, handle } from "@/server/auth";
import { notePhotoRoute } from "@/server/car-notes";
import { garageContext } from "@/server/context";

function route(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    return notePhotoRoute(request, ctx, id);
  });
}

/** Body `{ slot, contentType }`; answers `{ key, uploadUrl }` (a 5-minute presigned PUT). */
export const POST = route;
/** Body `{ slot, key }` once the file is uploaded; answers the note. */
export const PUT = route;
/** Query `?slot=`; answers the note. */
export const DELETE = route;
