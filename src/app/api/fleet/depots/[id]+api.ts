// Rename, archive or restore one of the owner's depots. Depots of other firms answer 404.
import { parseDepotPatch } from "@/domain/fleet";
import { isId } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { renameDepot, setDepotArchived } from "@/server/fleet";

export function PATCH(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!isId(id)) return apiError("notFound");
    const body = parseDepotPatch(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const depot =
      "archived" in body.value
        ? await setDepotArchived(owner.firmId, id, body.value.archived)
        : await renameDepot(owner.firmId, id, body.value.name);
    return typeof depot === "string" ? apiError(depot) : Response.json(depot);
  });
}
