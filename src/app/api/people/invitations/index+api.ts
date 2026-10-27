// Invite someone to the owner's firm by email, as a courier or dispatcher. Clerk sends the email.
import { parseInvite } from "@/domain/people";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { invite } from "@/server/people";

export function POST(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    const body = parseInvite(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const invitation = await invite(owner.firmId, owner.userId, body.value);
    return typeof invitation === "string" ? apiError(invitation) : Response.json(invitation, { status: 201 });
  });
}
