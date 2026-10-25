// The shared edit form for a finished shift (a dispatcher's correction, a courier's fix): string fields as typed,
// their errors, and the API body with only what changed. Times are "HH:MM" on the shift's day, firm time.
import { parseClock } from "@/domain/dates";
import { delivered, kmDriven } from "@/domain/shift";
import type { Shift } from "@/domain/types";
import type { TranslationKey } from "@/i18n";

export type EditFields = {
  stationId: string;
  busId: string;
  startTime: string;
  finishTime: string;
  startKm: string;
  endKm: string;
  loaded: string;
  returned: string;
  pickups: string;
};

export type EditErrors = Partial<Record<keyof EditFields, TranslationKey>>;

/** "07:30" for an instant in the firm's timezone. Not the app locale: the field always takes 24-hour HH:MM. */
export function clockOf(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
    new Date(iso),
  );
}

const text = (value: number | null) => (value === null ? "" : String(value));

export function editFieldsOf(shift: Shift, timeZone: string): EditFields {
  return {
    stationId: shift.depot.id,
    busId: shift.car.id,
    startTime: clockOf(shift.startedAt, timeZone),
    finishTime: shift.finishedAt ? clockOf(shift.finishedAt, timeZone) : "",
    startKm: text(shift.startKm),
    endKm: text(shift.endKm),
    loaded: text(shift.loaded),
    returned: text(shift.returned),
    pickups: text(shift.pickups),
  };
}

/** Field errors to show; empty when the form can be saved. The server checks again. */
export function editErrors(fields: EditFields): EditErrors {
  const errors: EditErrors = {};
  const start = parseClock(fields.startTime);
  const finish = parseClock(fields.finishTime);
  if (start === null) errors.startTime = "shifts.time.invalid";
  if (finish === null) errors.finishTime = "shifts.time.invalid";
  else if (start !== null && finish <= start) errors.finishTime = "edit.finishBeforeStart";

  if (fields.startKm === "") errors.startKm = "edit.required";
  if (fields.endKm === "") errors.endKm = "edit.required";
  if (fields.loaded === "") errors.loaded = "edit.required";
  const counts = {
    startKm: Number(fields.startKm),
    endKm: fields.endKm === "" ? null : Number(fields.endKm),
    loaded: Number(fields.loaded),
    returned: fields.returned === "" ? null : Number(fields.returned),
  };
  if (!errors.endKm && !errors.startKm && (kmDriven(counts) ?? 0) < 0) errors.endKm = "shifts.route.endBelowStart";
  if (!errors.loaded && delivered(counts) < 0) errors.returned = "shifts.packages.returnedAboveLoaded";
  return errors;
}

/** A correction or fix as sent to the API: ids, "HH:MM" times and counts. */
export type EditBody = Record<string, string | number | null>;

/** The API body: only the fields that differ from the original. Call it only when editErrors is empty. */
export function correctionOf(fields: EditFields, original: EditFields): EditBody {
  const body: EditBody = {};
  if (fields.stationId !== original.stationId) body.depotId = fields.stationId;
  if (fields.busId !== original.busId) body.carId = fields.busId;
  if (fields.startTime !== original.startTime) body.startTime = fields.startTime;
  if (fields.finishTime !== original.finishTime) body.finishTime = fields.finishTime;
  for (const name of ["startKm", "endKm", "loaded"] as const) {
    if (fields[name] !== original[name]) body[name] = Number(fields[name]);
  }
  for (const name of ["returned", "pickups"] as const) {
    if (fields[name] !== original[name]) body[name] = fields[name] === "" ? null : Number(fields[name]);
  }
  return body;
}
