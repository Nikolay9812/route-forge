// The owner's People screen: every member, pending invitations, and the active depots a dispatcher can be given.
import { handle } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { peopleList } from "@/server/people";

export function GET(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    return Response.json(await peopleList(owner));
  });
}
