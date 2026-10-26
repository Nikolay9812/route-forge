// One of the owner's cars: read it with its papers and talon photo, change its plate or depot, save its papers, or
// archive/restore it. Cars of other firms answer 404.
import { parseCarPatch } from "@/domain/fleet";
import { isId } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { carDetail, saveCarPapers, setCarArchived, updateCar } from "@/server/fleet";

export function GET(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!isId(id)) return apiError("notFound");
    const car = await carDetail(owner.firmId, id, owner.date);
    return car ? Response.json(car) : apiError("notFound");
  });
}

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
        : "papers" in body.value
          ? await saveCarPapers({ ...owner, today: owner.date }, id, body.value.papers)
          : await updateCar(owner.firmId, id, body.value);
    return typeof car === "string" ? apiError(car) : Response.json(car);
  });
}
