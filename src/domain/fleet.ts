// Input rules for an owner's depots and cars: names and plates are normalised before they are checked or stored,
// and patches either change values or archive/restore, never both.

export const MAX_DEPOT_NAME = 60;
export const MAX_PLATE = 15;

/** Letters of any script (Cyrillic plates), digits, single spaces and hyphens. */
const PLATE = /^[\p{L}\p{N}](?:[\p{L}\p{N} -]*[\p{L}\p{N}])?$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Parsed<T> = { ok: true; value: T } | { ok: false };

export type DepotPatch = { name: string } | { archived: boolean };
export type CarCreate = { plate: string; depotId: string };
export type CarPatch = { plate?: string; depotId?: string } | { archived: boolean };

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

/** Body of "change car": a new plate and/or depot, or `{ archived }`. */
export function parseCarPatch(body: unknown): Parsed<CarPatch> {
  if (!isObject(body)) return { ok: false };
  const archive = parseArchive(body);
  if (archive) return archive;
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
