// Input rules for an owner's depots and cars: names, plates and VINs are normalised before they are checked or
// stored, and patches either change values, save the papers, or archive/restore, never more than one.
import type { CarPapers, CarWarning, FleetCar } from "./types";

export const MAX_DEPOT_NAME = 60;
export const MAX_PLATE = 15;
/** Days before a TÜV, insurance or service date that the owner is warned (the same 30 as documents). */
export const CAR_WARNING_DAYS = 30;
/** Km before the service km that the owner is warned. */
export const SERVICE_WARNING_KM = 1000;
export const MAX_SERVICE_KM = 9_999_999;

/** Letters of any script (Cyrillic plates), digits, single spaces and hyphens. */
const PLATE = /^[\p{L}\p{N}](?:[\p{L}\p{N} -]*[\p{L}\p{N}])?$/u;
/** 17 characters of A–Z and 0–9 without I, O and Q (ISO 3779); EU VINs have no check digit. */
const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Parsed<T> = { ok: true; value: T } | { ok: false };

export type DepotPatch = { name: string } | { archived: boolean };
export type CarCreate = { plate: string; depotId: string };
export type CarPatch = { plate?: string; depotId?: string } | { archived: boolean } | { papers: CarPapers };

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function normalizeDepotName(text: string): string {
  return collapse(text);
}

export function normalizePlate(text: string): string {
  return collapse(text).toUpperCase();
}

/** The normalised name when it is valid, else null. */
export function validDepotName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = normalizeDepotName(value);
  return name.length > 0 && name.length <= MAX_DEPOT_NAME ? name : null;
}

/** The normalised plate when it is valid, else null. */
export function validPlate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const plate = normalizePlate(value);
  return plate.length <= MAX_PLATE && PLATE.test(plate) ? plate : null;
}

function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

function hasOnly(body: Record<string, unknown>, keys: string[]): boolean {
  const present = Object.keys(body);
  return present.length > 0 && present.every((key) => keys.includes(key));
}

function parseArchive(body: Record<string, unknown>): Parsed<{ archived: boolean }> | null {
  if (!("archived" in body)) return null;
  if (!hasOnly(body, ["archived"]) || typeof body.archived !== "boolean") return { ok: false };
  return { ok: true, value: { archived: body.archived } };
}

/** Body of "add depot". */
export function parseDepotCreate(body: unknown): Parsed<{ name: string }> {
  if (!isObject(body) || !hasOnly(body, ["name"])) return { ok: false };
  const name = validDepotName(body.name);
  return name ? { ok: true, value: { name } } : { ok: false };
}

/** Body of "change depot": a new name, or `{ archived }`. */
export function parseDepotPatch(body: unknown): Parsed<DepotPatch> {
  if (!isObject(body)) return { ok: false };
  return parseArchive(body) ?? parseDepotCreate(body);
}

/** Body of "add car". */
export function parseCarCreate(body: unknown): Parsed<CarCreate> {
  if (!isObject(body) || !hasOnly(body, ["plate", "depotId"])) return { ok: false };
  const plate = validPlate(body.plate);
  if (!plate || typeof body.depotId !== "string" || !UUID.test(body.depotId)) return { ok: false };
  return { ok: true, value: { plate, depotId: body.depotId } };
}

/** Body of "change car": a new plate and/or depot, `{ papers }`, or `{ archived }`. */
export function parseCarPatch(body: unknown): Parsed<CarPatch> {
  if (!isObject(body)) return { ok: false };
  const archive = parseArchive(body);
  if (archive) return archive;
  if ("papers" in body) {
    if (!hasOnly(body, ["papers"])) return { ok: false };
    const papers = parseCarPapers(body.papers);
    return papers.ok ? { ok: true, value: { papers: papers.value } } : papers;
  }
  if (!hasOnly(body, ["plate", "depotId"])) return { ok: false };
  const value: { plate?: string; depotId?: string } = {};
  if ("plate" in body) {
    const plate = validPlate(body.plate);
    if (!plate) return { ok: false };
    value.plate = plate;
  }
  if ("depotId" in body) {
    if (typeof body.depotId !== "string" || !UUID.test(body.depotId)) return { ok: false };
    value.depotId = body.depotId;
  }
  return { ok: true, value };
}

// Car papers.

/** Spaces and hyphens removed, uppercase, so "zfa 250006 smc06228" is the VIN ZFA250006SMC06228. */
export function normalizeVin(text: string): string {
  return text.replace(/[\s-]+/g, "").toUpperCase();
}

/** The normalised VIN when it is valid, else null. */
export function validVin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const vin = normalizeVin(value);
  return VIN.test(vin) ? vin : null;
}

function isDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** The last day of a "YYYY-MM" month, which is how a TÜV month is stored: "2028-02" → "2028-02-29". */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/** Body of "save the papers": exactly the five fields, each null or valid. */
export function parseCarPapers(body: unknown): Parsed<CarPapers> {
  if (!isObject(body)) return { ok: false };
  const keys: (keyof CarPapers)[] = ["vin", "tuvDue", "insuranceExpiresOn", "serviceDueOn", "serviceDueKm"];
  const present = Object.keys(body);
  if (present.length !== keys.length || !keys.every((key) => key in body)) return { ok: false };
  const { vin, tuvDue, insuranceExpiresOn, serviceDueOn, serviceDueKm } = body;
  const papers: CarPapers = { vin: null, tuvDue: null, insuranceExpiresOn: null, serviceDueOn: null, serviceDueKm: null };
  if (vin !== null) {
    papers.vin = validVin(vin);
    if (!papers.vin) return { ok: false };
  }
  if (tuvDue !== null) {
    if (typeof tuvDue !== "string" || !MONTH.test(tuvDue)) return { ok: false };
    papers.tuvDue = tuvDue;
  }
  for (const [key, day] of [
    ["insuranceExpiresOn", insuranceExpiresOn],
    ["serviceDueOn", serviceDueOn],
  ] as const) {
    if (day === null) continue;
    if (!isDay(day)) return { ok: false };
    papers[key] = day;
  }
  if (serviceDueKm !== null) {
    if (!Number.isInteger(serviceDueKm) || (serviceDueKm as number) < 0 || (serviceDueKm as number) > MAX_SERVICE_KM)
      return { ok: false };
    papers.serviceDueKm = serviceDueKm as number;
  }
  return { ok: true, value: papers };
}

function dayWarning(day: string | null, today: string): CarWarning["level"] | null {
  if (!day) return null;
  if (day < today) return "due";
  return day <= addDays(today, CAR_WARNING_DAYS) ? "soon" : null;
}

const worse = (a: CarWarning["level"] | null, b: CarWarning["level"] | null) =>
  a === "due" || b === "due" ? "due" : (a ?? b);

/**
 * What the owner should look at: a TÜV month, insurance or service date that has passed or comes within 30 days,
 * or a service km the car's odometer has reached or comes within 1,000 km of. In TÜV, insurance, service order.
 */
export function carWarnings(car: Pick<FleetCar, "papers" | "odometerKm">, today: string): CarWarning[] {
  const { papers, odometerKm } = car;
  const warnings: CarWarning[] = [];
  const tuv = dayWarning(papers.tuvDue ? lastDayOfMonth(papers.tuvDue) : null, today);
  if (tuv) warnings.push({ kind: "tuv", level: tuv });
  const insurance = dayWarning(papers.insuranceExpiresOn, today);
  if (insurance) warnings.push({ kind: "insurance", level: insurance });
  const km =
    papers.serviceDueKm === null || odometerKm === null
      ? null
      : odometerKm >= papers.serviceDueKm
        ? "due"
        : odometerKm >= papers.serviceDueKm - SERVICE_WARNING_KM
          ? "soon"
          : null;
  const service = worse(dayWarning(papers.serviceDueOn, today), km);
  if (service) warnings.push({ kind: "service", level: service });
  return warnings;
}
