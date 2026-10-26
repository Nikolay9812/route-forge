// The talon photo of one of the owner's cars: start an upload, keep the uploaded photo, remove it. Owners only;
// cars of other firms answer 404.
import { isId } from "@/domain/shift";
import { apiError, handle } from "@/server/auth";
import { carPhotoChange } from "@/server/car-photos";
import { ownerContext } from "@/server/context";
import { carDetail, isFirmCar } from "@/server/fleet";

function route(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!isId(id) || !(await isFirmCar(owner.firmId, id))) return apiError("notFound");
    const answer = await carPhotoChange(request, { firmId: owner.firmId, userId: owner.userId, carId: id });
    if (answer) return answer;
    const car = await carDetail(owner.firmId, id, owner.date);
    return car ? Response.json(car) : apiError("notFound");
  });
}

/** Body `{ slot, contentType }`; answers `{ key, uploadUrl }` (a 5-minute presigned PUT). */
export const POST = route;
/** Body `{ slot, key }` once the file is uploaded; answers the car. */
export const PUT = route;
/** Query `?slot=`; answers the car. */
export const DELETE = route;
