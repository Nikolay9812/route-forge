// Change one of the owner's cars: a new plate or depot, or archive/restore it. Cars of other firms answer 404.
import { parseCarPatch } from "@/domain/fleet";
import { isId } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { setCarArchived, updateCar } from "@/server/fleet";

export function PATCH(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!isId(id)) return apiError("notFound");
    const body = parseCarPatch(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const car =
      "archived" in body.value
        ? await setCarArchived(owner.firmId, id, body.value.archived)
        : await updateCar(owner.firmId, id, body.value);
    return typeof car === "string" ? apiError(car) : Response.json(car);
  });
}
