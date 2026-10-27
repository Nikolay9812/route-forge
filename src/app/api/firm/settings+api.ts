// Currency and timezone, from the fixed lists. Only while the firm has no shifts: after that `notEditable`.
import { parseSettings } from "@/domain/firm";
import { apiError, handle, readJson, requireOwner } from "@/server/auth";
import { firmSettingsView, saveSettings } from "@/server/firm";

export function PUT(request: Request) {
  return handle(async () => {
    const owner = await requireOwner(request);
    if (owner instanceof Response) return owner;
    const body = parseSettings(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const error = await saveSettings(owner.firmId, body.value);
    if (error) return apiError(error);
    return Response.json(await firmSettingsView(owner.firmId));
  });
}
