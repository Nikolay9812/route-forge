// Add a depot to the owner's firm. Names are unique per firm, ignoring case.
import { parseDepotCreate } from "@/domain/fleet";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { createDepot } from "@/server/fleet";

export function POST(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    const body = parseDepotCreate(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const depot = await createDepot(owner.firmId, body.value.name);
    return typeof depot === "string" ? apiError(depot) : Response.json(depot, { status: 201 });
  });
}
