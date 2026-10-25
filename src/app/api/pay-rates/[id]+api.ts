// Edit or cancel one upcoming pay-rate entry. Started entries answer `notEditable`; other firms' entries 404.
import { parseRatePatch } from "@/domain/pay-rates";
import { isId } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { deleteRate, payRateTarget, updateRate } from "@/server/pay-rates";

export function PATCH(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!isId(id)) return apiError("notFound");
    const body = parseRatePatch(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const row = await updateRate(owner.firmId, owner.userId, id, body.value, owner.date);
    if (typeof row === "string") return apiError(row);
    return Response.json(await payRateTarget(owner.firmId, row.userId, owner.date));
  });
}

export function DELETE(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    if (!isId(id)) return apiError("notFound");
    const row = await deleteRate(owner.firmId, id, owner.date);
    if (typeof row === "string") return apiError(row);
    return Response.json(await payRateTarget(owner.firmId, row.userId, owner.date));
  });
}
