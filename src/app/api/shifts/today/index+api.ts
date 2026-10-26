// Today's shift for the signed-in courier: read it (with recent shifts and the stations and buses to pick from),
// start it, edit it.
import { delivered, parsePatch, parseStart } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { courierContext } from "@/server/context";
import { photosOfShift } from "@/server/shift-photos";
import {
  activeBuses,
  activeStations,
  ownsDepotAndCar,
  shiftOn,
  shiftsBefore,
  startShift,
  updateShift,
} from "@/server/shifts";

export function GET(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, firm, date } = ctx;
    const [shift, recent, stations, buses] = await Promise.all([
      shiftOn(courier, date),
      shiftsBefore(courier, date, 5),
      activeStations(courier.firmId),
      activeBuses(courier.firmId),
    ]);
    const photos = shift ? await photosOfShift(courier.firmId, shift.id) : {};
    return Response.json({ firm, date, shift, photos, recent, stations, buses });
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, date } = ctx;
    const input = parseStart(await readJson(request));
    if (!input.ok) return apiError("invalid");
    if (!(await ownsDepotAndCar(courier.firmId, input.value.depotId, input.value.carId))) return apiError("invalid");
    const shift = await startShift(courier, date, input.value);
    return shift ? Response.json(shift, { status: 201 }) : apiError("exists");
  });
}

export function PATCH(request: Request) {
  return handle(async () => {
    const ctx = await courierContext(request);
    if (ctx instanceof Response) return ctx;
    const { courier, date } = ctx;
    const patch = parsePatch(await readJson(request));
    if (!patch.ok) return apiError("invalid");
    const { depotId, carId } = patch.value;

    const current = await shiftOn(courier, date);
    if (!current) return apiError("notFound");
    if (current.status !== "draft" && current.status !== "rejected") return apiError("notEditable");
    if (delivered({ ...current, ...patch.value }) < 0) return apiError("invalid");
    if ((depotId || carId) && !(await ownsDepotAndCar(courier.firmId, depotId, carId))) return apiError("invalid");

    const shift = await updateShift(courier, date, patch.value);
    return shift ? Response.json(shift) : apiError("notEditable");
  });
}
