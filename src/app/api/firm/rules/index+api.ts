// Schedule a break and Spesen rule entry from a day. Past days are allowed (the app warns first); one entry per day.
import { parseRule } from "@/domain/firm";
import { apiError, handle, readJson, requireOwner } from "@/server/auth";
import { createRule, firmSettingsView } from "@/server/firm";

export function POST(request: Request) {
  return handle(async () => {
    const owner = await requireOwner(request);
    if (owner instanceof Response) return owner;
    const body = parseRule(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const error = await createRule(owner.firmId, owner.userId, body.value);
    if (error) return apiError(error);
    return Response.json(await firmSettingsView(owner.firmId), { status: 201 });
  });
}
