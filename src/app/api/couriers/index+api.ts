// The owner's Couriers list: how complete each courier's documents are, and what has expired or is expiring.
import { handle } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { documentsList } from "@/server/courier-details";

export function GET(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    return Response.json(await documentsList(owner.firmId, owner.date));
  });
}
