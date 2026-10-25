// One shift for a dispatcher or owner: read it (with pay and history), approve or reject it, or correct it.
// Shifts outside the reviewer's firm or depots answer 404, never revealing that they exist.
import { isId, parseCorrection, parseReview } from "@/domain/shift";
import { canUseDepot, correct, review, reviewDetail, scopeStations, shiftInScope } from "@/server/approvals";
import { apiError, handle, readJson } from "@/server/auth";
import { reviewerContext } from "@/server/context";
import { editValues } from "@/server/edits";
import { activeBuses } from "@/server/shifts";

export function GET(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await reviewerContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const detail = await reviewDetail(ctx.scope, id);
    return detail ? Response.json({ firm: ctx.firm, ...detail }) : apiError("notFound");
  });
}

export function POST(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await reviewerContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const body = parseReview(await readJson(request));
    if (!body.ok) return apiError("invalid");
    if (!(await shiftInScope(ctx.scope, id))) return apiError("notFound");

    const decision =
      body.value.action === "approve"
        ? ({ status: "approved" } as const)
        : ({ status: "rejected", reasons: body.value.reasons, note: body.value.note } as const);
    const shift = await review(ctx.scope, id, decision);
    return shift ? Response.json(shift) : apiError("notEditable");
  });
}

export function PATCH(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await reviewerContext(request);
    if (ctx instanceof Response) return ctx;
    const { scope, firm } = ctx;
    if (!isId(id)) return apiError("notFound");
    const edit = parseCorrection(await readJson(request));
    if (!edit.ok) return apiError("invalid");

    const found = await shiftInScope(scope, id);
    if (!found) return apiError("notFound");
    if (found.shift.status !== "submitted" && found.shift.status !== "approved") return apiError("notEditable");

    const values = await editValues(found.shift, edit.value, firm, scope.firmId, (depotId) =>
      canUseDepot(scope, depotId),
    );
    if (values === "invalid") return apiError("invalid");
    const [stations, buses] = await Promise.all([scopeStations(scope), activeBuses(scope.firmId)]);
    const shift = await correct(scope, found.shift, values, { stations, buses });
    return shift ? Response.json(shift) : apiError("notEditable");
  });
}
