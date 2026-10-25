// Add a car to one of the owner's active depots. Plates are stored normalised and unique per firm.
import { parseCarCreate } from "@/domain/fleet";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { createCar } from "@/server/fleet";

export function POST(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    const body = parseCarCreate(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const car = await createCar(owner.firmId, body.value);
    return typeof car === "string" ? apiError(car) : Response.json(car, { status: 201 });
  });
}
