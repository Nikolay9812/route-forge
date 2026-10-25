// The owner's pay rates: the firm default and every courier's own entries, and scheduling a new entry.
// Rates are salary data: owners only, and never logged.
import { parseRateCreate } from "@/domain/pay-rates";
import { apiError, handle, readJson } from "@/server/auth";
import { ownerContext } from "@/server/context";
import { createRate, payRatesOf, payRateTarget } from "@/server/pay-rates";

export function GET(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    return Response.json(await payRatesOf(owner.firmId, owner.firm, owner.date));
  });
}

/** Answers the target's updated view (firm default or that courier). */
export function POST(request: Request) {
  return handle(async () => {
    const owner = await ownerContext(request);
    if (owner instanceof Response) return owner;
    const body = parseRateCreate(await readJson(request));
    if (!body.ok) return apiError("invalid");
    const row = await createRate(owner.firmId, owner.userId, body.value);
    if (typeof row === "string") return apiError(row);
    return Response.json(await payRateTarget(owner.firmId, row.userId, owner.date), { status: 201 });
  });
}
