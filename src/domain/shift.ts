// Shift rules shared by API routes and the app: derived numbers, what Start and Finish need, and input
// validation. Pure and import-free at runtime. The server re-runs every check; the UI uses them for feedback.
import type { RejectReason, Shift, ShiftField } from "./types";

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
}>;

type Parsed<T> = { ok: true; value: T } | { ok: false };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
}

/** A UUID, as used for every row id. */
export function isId(value: unknown): value is string {
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

/**
 * Body of "update shift": any known field; unknown fields are rejected. Optional counts may be null (cleared).
 * The start time isn't one: it is set when the courier taps Start, and only a reviewer corrects it.
 */
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
      default:
        return { ok: false };
    }
  }
  return { ok: true, value };
}

/** Every reject reason, in the order the app shows them. */
export const rejectReasons: readonly RejectReason[] = ["km", "packages", "busOrStation"];

/** The longest rejection note accepted. */
export const MAX_NOTE = 300;

export type ReviewAction = { action: "approve" } | { action: "reject"; reasons: RejectReason[]; note: string | null };

/** Body of "approve" or "reject". A rejection needs at least one reason or a note. */
export function parseReview(body: unknown): Parsed<ReviewAction> {
  if (!isObject(body)) return { ok: false };
  if (body.action === "approve" && Object.keys(body).length === 1) return { ok: true, value: { action: "approve" } };
  if (body.action !== "reject") return { ok: false };
  const { reasons = [], note = null } = body;
  if (!Array.isArray(reasons) || !reasons.every((r) => rejectReasons.includes(r as RejectReason))) return { ok: false };
  if (note !== null && (typeof note !== "string" || note.length > MAX_NOTE)) return { ok: false };
  const trimmed = typeof note === "string" && note.trim() ? note.trim() : null;
  const unique = [...new Set(reasons as RejectReason[])];
  if (unique.length === 0 && !trimmed) return { ok: false };
  return { ok: true, value: { action: "reject", reasons: unique, note: trimmed } };
}

/**
 * Body of a dispatcher's correction. Times are "HH:MM" on the shift's day in the firm's timezone; the route turns
 * them into instants. End km stays required once a shift is submitted.
 */
export type Correction = Partial<{
  depotId: string;
  carId: string;
  startTime: number;
  finishTime: number;
  startKm: number;
  endKm: number;
  loaded: number;
  returned: number | null;
  pickups: number | null;
}>;

/** Same as parseClock in dates.ts, inlined: domain files share only types at runtime. */
function clockMinutes(value: unknown): number | null {
  const match = typeof value === "string" ? /^(\d{1,2}):(\d{2})$/.exec(value.trim()) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

export function parseCorrection(body: unknown): Parsed<Correction> {
  if (!isObject(body) || Object.keys(body).length === 0) return { ok: false };
  const value: Correction = {};
  for (const [key, field] of Object.entries(body)) {
    switch (key) {
      case "depotId":
      case "carId":
        if (!isId(field)) return { ok: false };
        value[key] = field;
        break;
      case "startTime":
      case "finishTime": {
        const minutes = clockMinutes(field);
        if (minutes === null) return { ok: false };
        value[key] = minutes;
        break;
      }
      case "startKm":
      case "endKm":
      case "loaded":
        if (!isCount(field)) return { ok: false };
        value[key] = field;
        break;
      case "returned":
      case "pickups":
        if (field !== null && !isCount(field)) return { ok: false };
        value[key] = field;
        break;
      default:
        return { ok: false };
    }
  }
  return { ok: true, value };
}

/** The fields that differ between two versions of a shift, as stored in shift_changes. */
export function diffShift(before: Shift, after: Shift): { field: ShiftField; from: string | null; to: string | null }[] {
  const text = (v: number | string | null) => (v === null ? null : String(v));
  const pairs: [ShiftField, string | null, string | null][] = [
    ["depot", before.depot.name, after.depot.name],
    ["car", before.car.plate, after.car.plate],
    ["startedAt", before.startedAt, after.startedAt],
    ["finishedAt", before.finishedAt, after.finishedAt],
    ["startKm", text(before.startKm), text(after.startKm)],
    ["endKm", text(before.endKm), text(after.endKm)],
    ["loaded", text(before.loaded), text(after.loaded)],
    ["returned", text(before.returned), text(after.returned)],
    ["pickups", text(before.pickups), text(after.pickups)],
  ];
  return pairs.filter(([, from, to]) => from !== to).map(([field, from, to]) => ({ field, from, to }));
}
