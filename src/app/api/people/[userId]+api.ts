// Change a member's role (courier ↔ dispatcher) or a dispatcher's depots, or remove them from the firm.
// Owners can't be changed here, and users outside the firm answer 404. Removing answers the updated list.
import { parsePersonPatch } from "@/domain/people";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { peopleList, removeMember, setDepots, setRole } from "@/server/people";

export function PATCH(request: Request, { userId }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    const body = parsePersonPatch(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const person =
      "role" in body.value
        ? await setRole(owner.firmId, owner.userId, userId, body.value.role)
        : await setDepots(owner.firmId, userId, body.value.depotIds);
    return typeof person === "string" ? apiError(person) : Response.json(person);
  });
}

export function DELETE(request: Request, { userId }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    const result = await removeMember(owner.firmId, userId);
    return typeof result === "string" ? apiError(result) : Response.json(await peopleList(owner));
  });
}
