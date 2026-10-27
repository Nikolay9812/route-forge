// Rules for a car's service log: what a note holds, which days it may be dated, how long its author may change it,
// and which days of vehicle check photos a mechanic sees. Pure, shared by API routes, the app and Node scripts.
import type { CarNoteInput, CarNoteType } from "./types";

export const carNoteTypes = ["tyres", "oil", "brakes", "inspection", "repair", "other"] as const satisfies readonly CarNoteType[];
export const MAX_NOTE_TEXT = 1000;
export const MAX_NOTE_KM = 2_000_000;
/** The author may change or delete a note for this many days after writing it. */
export const NOTE_EDIT_DAYS = 7;
/** How far back a note may be dated. */
export const NOTE_MAX_BACK_DAYS = 365;
/** Days of vehicle check photos a mechanic sees: today and the six before. */
export const GARAGE_DAYS = 7;
/** Notes per page in the service log. */
export const NOTE_PAGE = 50;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;

type Parsed<T> = { ok: true; value: T } | { ok: false };

function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

function hasExactly(body: Record<string, unknown>, keys: string[]): boolean {
  const present = Object.keys(body);
  return present.length === keys.length && keys.every((key) => key in body);
}

/** The calendar day `days` after (or before, when negative) a "YYYY-MM-DD" day. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function validDay(value: unknown): value is string {
  return typeof value === "string" && DAY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && addDays(value, 0) === value;
}

export function isCarNoteType(value: unknown): value is CarNoteType {
  return carNoteTypes.includes(value as CarNoteType);
}

/** The first day of the mechanic's photo range; it ends on `today`. */
export function garageFrom(today: string): string {
  return addDays(today, -(GARAGE_DAYS - 1));
}

/** The earliest day a note written on `today` may carry. */
export function earliestNoteDay(today: string): string {
  return addDays(today, -NOTE_MAX_BACK_DAYS);
}

/**
 * Body of a note: exactly `{ type, doneOn, km, text }`. `doneOn` is today or up to a year back, `km` a whole
 * number or null, `text` trimmed (empty = null) and required for `other`.
 */
export function parseCarNote(body: unknown, today: string): Parsed<CarNoteInput> {
  if (!isObject(body) || !hasExactly(body, ["type", "doneOn", "km", "text"])) return { ok: false };
  const { type, doneOn, km, text } = body;
  if (!isCarNoteType(type) || !validDay(doneOn) || doneOn > today || doneOn < earliestNoteDay(today)) return { ok: false };
  if (km !== null && !(typeof km === "number" && Number.isInteger(km) && km >= 0 && km <= MAX_NOTE_KM)) return { ok: false };
  if (text !== null && typeof text !== "string") return { ok: false };
  const trimmed = text?.trim() || null;
  if (trimmed !== null && trimmed.length > MAX_NOTE_TEXT) return { ok: false };
  if (type === "other" && trimmed === null) return { ok: false };
  return { ok: true, value: { type, doneOn, km, text: trimmed } };
}

/** Body of "add a note": the note plus the car's UUID. */
export function parseCarNoteCreate(body: unknown, today: string): Parsed<CarNoteInput & { carId: string }> {
  if (!isObject(body)) return { ok: false };
  const { carId, ...note } = body;
  if (typeof carId !== "string" || !UUID.test(carId)) return { ok: false };
  const parsed = parseCarNote(note, today);
  return parsed.ok ? { ok: true, value: { ...parsed.value, carId: carId.toLowerCase() } } : parsed;
}

/** Whether `userId` may still change or delete a note: its author, within NOTE_EDIT_DAYS of writing it. */
export function canEditNote(note: { createdBy: string; createdAt: string }, userId: string, now = new Date()): boolean {
  return note.createdBy === userId && now.getTime() - Date.parse(note.createdAt) < NOTE_EDIT_DAYS * DAY_MS;
}

export type NoteFilter = { carId: string | null; type: CarNoteType | null; before: string | null };

/**
 * Query of the service log: `?carId=&type=&before=`, each optional. `before` is the cursor the previous page
 * answered (`doneOn|createdAt|id` of its last note).
 */
export function parseNoteFilter(params: URLSearchParams): Parsed<NoteFilter> {
  const carId = params.get("carId") || null;
  const type = params.get("type") || null;
  const before = params.get("before") || null;
  if (carId !== null && !UUID.test(carId)) return { ok: false };
  if (type !== null && !isCarNoteType(type)) return { ok: false };
  if (before !== null && parseCursor(before) === null) return { ok: false };
  return { ok: true, value: { carId: carId?.toLowerCase() ?? null, type, before } };
}

export type NoteCursor = { doneOn: string; createdAt: string; id: string };

export function noteCursor(note: NoteCursor): string {
  return `${note.doneOn}|${note.createdAt}|${note.id}`;
}

export function parseCursor(cursor: string): NoteCursor | null {
  const [doneOn, createdAt, id, ...rest] = cursor.split("|");
  if (rest.length > 0 || !validDay(doneOn) || !id || !UUID.test(id) || !createdAt || Number.isNaN(Date.parse(createdAt))) return null;
  return { doneOn, createdAt, id };
}
