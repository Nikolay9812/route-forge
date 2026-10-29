// One of the courier's own shifts by id: read it (any status), or fix it while it's rejected (all but its times).
// Someone else's shift answers 404.
import { isId, parseCorrection } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { courierContext } from "@/server/context";
import { editValues } from "@/server/edits";
import { shiftPhotoState } from "@/server/shift-photos";
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
    if (!shift) return apiError("notFound");
    const { photos, expiredPhotos } = await shiftPhotoState(courier.firmId, shift.id);
    return Response.json({ firm, shift, photos, expiredPhotos, stations, buses });
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
    // Times are the reviewer's to correct: a courier fixing a sent-back shift can't change them.
    if (edit.value.startTime !== undefined || edit.value.finishTime !== undefined) return apiError("invalid");

    const current = await ownShift(courier, id);
    if (!current) return apiError("notFound");
    if (current.status !== "rejected") return apiError("notEditable");
    const values = await editValues(current, edit.value, firm, courier.firmId);
    if (values === "invalid") return apiError("invalid");
    const shift = await fixShift(courier, id, values);
    return shift ? Response.json(shift) : apiError("notEditable");
  });
}
