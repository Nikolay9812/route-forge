// What the courier is typing on the shift form. Number fields stay strings so the inputs show exactly what was
// typed; "" means empty. The rules themselves live in src/domain/shift.ts; these adapt the strings to them.
import { minuteOfDayIn } from "@/domain/dates";
import { delivered, finishProblem, kmDriven, type ShiftPatch } from "@/domain/shift";
import type { Shift } from "@/domain/types";

export type ShiftFields = {
  stationId: string | null;
  busId: string | null;
  startKm: string;
  endKm: string;
  loaded: string;
  returned: string;
  pickups: string;
};

export type FieldName = keyof ShiftFields;

export const emptyFields: ShiftFields = {
  stationId: null,
  busId: null,
  startKm: "",
  endKm: "",
  loaded: "",
  returned: "",
  pickups: "",
};

const text = (value: number | null) => (value === null ? "" : String(value));
const num = (value: string) => (value === "" ? null : Number(value));

export function fieldsOf(shift: Shift): ShiftFields {
  return {
    stationId: shift.depot.id,
    busId: shift.car.id,
    startKm: text(shift.startKm),
    endKm: text(shift.endKm),
    loaded: text(shift.loaded),
    returned: text(shift.returned),
    pickups: text(shift.pickups),
  };
}

/** The counts as the domain rules see them (empty required counts as 0). */
function counts(fields: ShiftFields) {
  return {
    startKm: num(fields.startKm) ?? 0,
    endKm: num(fields.endKm),
    loaded: num(fields.loaded) ?? 0,
    returned: num(fields.returned),
  };
}

/** End km − start km, or null until both are typed. Negative when end is below start. */
export function kmDrivenOf(fields: ShiftFields): number | null {
  return fields.startKm === "" ? null : kmDriven(counts(fields));
}

/** Loaded − returned, or null until loaded is typed. Negative when returned is above loaded. */
export function deliveredOf(fields: ShiftFields): number | null {
  return fields.loaded === "" ? null : delivered(counts(fields));
}

export function canStart(fields: ShiftFields): boolean {
  return !!fields.stationId && !!fields.busId && fields.startKm !== "" && fields.loaded !== "";
}

export function canFinish(fields: ShiftFields): boolean {
  return canStart(fields) && finishProblem(counts(fields)) === null;
}

/**
 * The API patch for these fields, or null while one of them can't be saved yet: a required count is empty,
 * or returned is above loaded (the server refuses it, so it waits until the courier fixes it).
 */
export function patchOf(fields: ShiftFields, names: Iterable<FieldName>): ShiftPatch | null {
  const patch: ShiftPatch = {};
  for (const name of names) {
    switch (name) {
      case "stationId":
        if (fields.stationId) patch.depotId = fields.stationId;
        break;
      case "busId":
        if (fields.busId) patch.carId = fields.busId;
        break;
      case "startKm":
      case "loaded":
        if (fields[name] === "") return null;
        patch[name] = Number(fields[name]);
        break;
      case "endKm":
      case "returned":
      case "pickups":
        patch[name] = num(fields[name]);
        break;
    }
  }
  if ((patch.loaded !== undefined || patch.returned !== undefined) && (deliveredOf(fields) ?? 0) < 0) return null;
  return patch;
}

/** Keeps digits only, so pasted "48 213" or "140." becomes a plain number string. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "").slice(0, 7);
}

/** "7:30" or "07:30" → 450 minutes after midnight, or null if it isn't a valid time. */
export function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Today at the given firm-local minute of day, as UTC milliseconds, or null if that is in the future. */
export function todayAt(minuteOfDay: number, timeZone: string, now = new Date()): number | null {
  const current = minuteOfDayIn(timeZone, now);
  if (minuteOfDay > current) return null;
  const startOfMinute = now.getTime() - (now.getTime() % 60_000);
  return startOfMinute - (current - minuteOfDay) * 60_000;
}

/** Whole minutes between two UTC timestamps. */
export function elapsedMinutes(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / 60_000));
}
