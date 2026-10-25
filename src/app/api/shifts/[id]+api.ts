// One of the courier's own shifts by id: read it (any status), or fix it while it's rejected. Someone else's shift
// answers 404.
import { isId, parseCorrection } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { courierContext } from "@/server/context";
import { editValues } from "@/server/edits";
import { activeBuses, activeStations, fixShift, ownShift } from "@/server/shifts";

export function GET(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const { courier, firm } = ctx;
    const [shift, stations, buses] = await Promise.all([
      ownShift(courier, id),
      activeStations(courier.firmId),
      activeBuses(courier.firmId),
    ]);
    return shift ? Response.json({ firm, shift, stations, buses }) : apiError("notFound");
  });
}

export function PATCH(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const { courier, firm } = ctx;
    const edit = parseCorrection(await readJson(request));
    if (!edit.ok) return apiError("invalid");

    const current = await ownShift(courier, id);
    if (!current) return apiError("notFound");
    if (current.status !== "rejected") return apiError("notEditable");
    const values = await editValues(current, edit.value, firm, courier.firmId);
    if (values === "invalid") return apiError("invalid");
    const shift = await fixShift(courier, id, values);
    return shift ? Response.json(shift) : apiError("notEditable");
  });
}
