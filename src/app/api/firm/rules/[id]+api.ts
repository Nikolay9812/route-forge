// Edit (whole) or cancel one upcoming rule entry. Started entries answer `notEditable`; other firms' entries 404.
import { parseRule } from "@/domain/firm";
import { isId } from "@/domain/shift";
import { apiError, handle, readJson, requireOwner } from "@/server/auth";
import { deleteRule, firmSettingsView, settingsToday, updateRule } from "@/server/firm";

export function PATCH(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await requireOwner(request);
    if (owner instanceof Response) return owner;
    if (!isId(id)) return apiError("notFound");
    const body = parseRule(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const error = await updateRule(owner.firmId, owner.userId, id, body.value, await settingsToday(owner.firmId));
    if (error) return apiError(error);
    return Response.json(await firmSettingsView(owner.firmId));
  });
}

export function DELETE(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await requireOwner(request);
    if (owner instanceof Response) return owner;
    if (!isId(id)) return apiError("notFound");
    const error = await deleteRule(owner.firmId, id, await settingsToday(owner.firmId));
    if (error) return apiError(error);
    return Response.json(await firmSettingsView(owner.firmId));
  });
}
