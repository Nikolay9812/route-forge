// Revoke one of the owner's pending invitations and answer the updated list. Other firms' invitations answer 404.
import { apiError, handle } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { peopleList, revokeInvitation } from "@/server/people";

export function DELETE(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    const result = await revokeInvitation(owner.firmId, owner.userId, id);
    return typeof result === "string" ? apiError(result) : Response.json(await peopleList(owner));
  });
}
