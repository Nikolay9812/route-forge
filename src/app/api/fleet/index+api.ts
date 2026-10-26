// Every depot of the owner's firm with its cars (and their papers), active and archived, plus the firm's today for
// the papers' warnings. Owners only.
import { handle } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { fleetOf } from "@/server/fleet";

export function GET(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    return Response.json(await fleetOf(owner.firmId, owner.date));
  });
}
