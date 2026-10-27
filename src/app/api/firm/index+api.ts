// The owner's Firm settings: name (from Clerk), currency, timezone, whether they're locked, and the break and Spesen
// rules with their history. Works before the firm has a settings row, so a new firm can be set up here.
import { handle, requireOwner } from "@/server/auth";
import { firmSettingsView } from "@/server/firm";

export function GET(request: Request) {
  return handle(async () => {
    const owner = await requireOwner(request);
    if (owner instanceof Response) return owner;
    return Response.json(await firmSettingsView(owner.firmId));
  });
}
