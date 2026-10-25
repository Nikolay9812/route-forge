// Shift rules shared by API routes and the app: derived numbers, what Start and Finish need, and input
// validation. Pure and import-free at runtime. The server re-runs every check; the UI uses them for feedback.
import type { Shift } from "./types";

/** The largest count or odometer reading accepted. */
export const MAX_COUNT = 9_999_999;

type Counts = Pick<Shift, "startKm" | "loaded"> & Partial<Pick<Shift, "endKm" | "returned">>;

/** End km − start km, or null until end km is known. Negative when end is below start. */
export function kmDriven(shift: Counts): number | null {
  return shift.endKm == null ? null : shift.endKm - shift.startKm;
}

/** Loaded − returned; an unknown returned counts as 0. Negative when returned is above loaded. */
export function delivered(shift: Counts): number {
  return shift.loaded - (shift.returned ?? 0);
}

export type FinishProblem = "endKmMissing" | "endBelowStart" | "returnedAboveLoaded";

/** Why a shift can't be submitted yet, or null when it can. */
export function finishProblem(shift: Counts): FinishProblem | null {
  const driven = kmDriven(shift);
  if (driven === null) return "endKmMissing";
  if (driven < 0) return "endBelowStart";
  if (delivered(shift) < 0) return "returnedAboveLoaded";
  return null;
}

/** Whole minutes between two ISO timestamps, never negative. */
export function minutesBetween(from: string, to: string): number {
  return Math.max(0, Math.floor((Date.parse(to) - Date.parse(from)) / 60_000));
}

export type StartInput = { depotId: string; carId: string; startKm: number; loaded: number };

export type ShiftPatch = Partial<{
  depotId: string;
  carId: string;
  startKm: number;
  endKm: number | null;
  loaded: number;
  returned: number | null;
  pickups: number | null;
  startedAt: string;
}>;

type Parsed<T> = { ok: true; value: T } | { ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

/** Body of "start shift": every field required. */
export function parseStart(body: unknown): Parsed<StartInput> {
  if (!isObject(body)) return { ok: false };
  const { depotId, carId, startKm, loaded } = body;
  if (!isId(depotId) || !isId(carId) || !isCount(startKm) || !isCount(loaded)) return { ok: false };
  return { ok: true, value: { depotId, carId, startKm, loaded } };
}

/** Body of "update shift": any known field; unknown fields are rejected. Optional counts may be null (cleared). */
export function parsePatch(body: unknown): Parsed<ShiftPatch> {
  if (!isObject(body)) return { ok: false };
  const value: ShiftPatch = {};
  for (const [key, field] of Object.entries(body)) {
    switch (key) {
      case "depotId":
      case "carId":
        if (!isId(field)) return { ok: false };
        value[key] = field;
        break;
      case "startKm":
      case "loaded":
        if (!isCount(field)) return { ok: false };
        value[key] = field;
        break;
      case "endKm":
      case "returned":
      case "pickups":
        if (field !== null && !isCount(field)) return { ok: false };
        value[key] = field;
        break;
      case "startedAt":
        if (typeof field !== "string" || Number.isNaN(Date.parse(field))) return { ok: false };
        value.startedAt = new Date(field).toISOString();
        break;
      default:
        return { ok: false };
    }
  }
  return { ok: true, value };
}
