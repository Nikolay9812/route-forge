// Turns an edit (a dispatcher's correction or a courier's fix) into checked column values for a finished shift.
// Times arrive as wall-clock minutes on the shift's day in the firm's timezone.
import { zonedTime } from "@/domain/dates";
import { finishProblem, minutesBetween, type Correction } from "@/domain/shift";
import type { Firm, Shift } from "@/domain/types";

import { ownsDepotAndCar, type ShiftValues } from "./shifts";

/**
 * The values to write, or "invalid" when the result would break a rule: the depot or car isn't an active one of
 * this firm (or the depot is outside `depotAllowed`), finish isn't after start, finish is in the future, end km is
 * below start km or missing, or returned is above loaded.
 */
export async function editValues(
  current: Shift,
  edit: Correction,
  firm: Firm,
  firmId: string,
  depotAllowed: (depotId: string) => boolean = () => true,
): Promise<ShiftValues | "invalid"> {
  if (edit.depotId && !depotAllowed(edit.depotId)) return "invalid";
  if ((edit.depotId || edit.carId) && !(await ownsDepotAndCar(firmId, edit.depotId, edit.carId))) return "invalid";

  const startedAt =
    edit.startTime === undefined ? current.startedAt : zonedTime(current.date, edit.startTime, firm.timeZone);
  const finishedAt =
    edit.finishTime === undefined ? current.finishedAt : zonedTime(current.date, edit.finishTime, firm.timeZone);
  if (!finishedAt || Date.parse(finishedAt) <= Date.parse(startedAt) || Date.parse(finishedAt) > Date.now()) {
    return "invalid";
  }

  const counts = {
    startKm: edit.startKm ?? current.startKm,
    endKm: edit.endKm ?? current.endKm,
    loaded: edit.loaded ?? current.loaded,
    returned: edit.returned === undefined ? current.returned : edit.returned,
  };
  if (finishProblem(counts)) return "invalid";

  const values: ShiftValues = {
    startKm: counts.startKm,
    endKm: counts.endKm,
    loaded: counts.loaded,
    returned: counts.returned,
    pickups: edit.pickups === undefined ? current.pickups : edit.pickups,
    startedAt: new Date(startedAt),
    finishedAt: new Date(finishedAt),
    minutes: minutesBetween(startedAt, finishedAt),
  };
  if (edit.depotId) values.depotId = edit.depotId;
  if (edit.carId) values.carId = edit.carId;
  return values;
}
