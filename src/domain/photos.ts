// Rules for stored photos, shared by API routes and the app: the allowed files, document photo slots, the
// vehicle check photos of a shift, and a car's registration certificate. Object keys are made by the server only; a key coming back from the app must be
// one the server could have handed out for that slot (its prefix plus a UUID).
import type { CarPhotoSlot, DetailsSection, PhotoSlot, ShiftPhotoSlot } from "./types";

type Parsed<T> = { ok: true; value: T } | { ok: false };

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

function plainObject(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function isPhotoType(value: unknown): value is PhotoType {
  return PHOTO_TYPES.includes(value as PhotoType);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A key the server could have handed out for this slot: the prefix plus a UUID, nothing else. */
export function isPhotoKey(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && UUID.test(key.slice(prefix.length));
}

// Document photos.

/** Photo slots per section; the health card shows its front only, a Führungszeugnis can run to three pages. */
export const sectionPhotos: Partial<Record<DetailsSection, readonly PhotoSlot[]>> = {
  idCard: ["front", "back"],
  licence: ["front", "back"],
  address: ["photo"],
  tax: ["photo"],
  health: ["front"],
  criminalRecord: ["page1", "page2", "page3"],
};

export type PhotoTarget = { section: DetailsSection; slot: PhotoSlot };

function photoTarget(section: unknown, slot: unknown): PhotoTarget | null {
  // Own keys only, so "constructor" and friends are no section.
  const slots = typeof section === "string" && Object.hasOwn(sectionPhotos, section) ? sectionPhotos[section as DetailsSection] : null;
  return slots?.includes(slot as PhotoSlot) ? { section: section as DetailsSection, slot: slot as PhotoSlot } : null;
}

/** Body of "start an upload": `{ section, slot, contentType }`, a slot that section has and an allowed type. */
export function parsePhotoRequest(body: unknown): Parsed<PhotoTarget & { contentType: PhotoType }> {
  const object = plainObject(body);
  if (!object) return { ok: false };
  const { section, slot, contentType, ...rest } = object;
  const target = photoTarget(section, slot);
  if (!target || Object.keys(rest).length > 0 || !isPhotoType(contentType)) return { ok: false };
  return { ok: true, value: { ...target, contentType } };
}

/** Body of "keep the uploaded photo": `{ section, slot, key }`; the key itself is checked against the prefix. */
export function parsePhotoConfirm(body: unknown): Parsed<PhotoTarget & { key: string }> {
  const object = plainObject(body);
  if (!object) return { ok: false };
  const { section, slot, key, ...rest } = object;
  const target = photoTarget(section, slot);
  if (!target || Object.keys(rest).length > 0 || typeof key !== "string") return { ok: false };
  return { ok: true, value: { ...target, key } };
}

/** Query of "remove a photo": `?section=&slot=`. */
export function parsePhotoQuery(params: URLSearchParams): Parsed<PhotoTarget> {
  const target = photoTarget(params.get("section"), params.get("slot"));
  return target ? { ok: true, value: target } : { ok: false };
}

/** Where one slot's photos live in the bucket; the firm and courier come from the session, never the request. */
export function photoPrefix(firmId: string, userId: string, { section, slot }: PhotoTarget): string {
  return `firms/${firmId}/couriers/${userId}/${section}/${slot}/`;
}

// Shift photos (the vehicle check).

export type ShiftPhotoGroup = "bus" | "logbook" | "mentor" | "fuel";

/** The vehicle check's slots in screen order, by group. */
export const shiftPhotoGroups: Record<ShiftPhotoGroup, readonly ShiftPhotoSlot[]> = {
  bus: ["front", "back", "left", "right", "extra1", "extra2"],
  logbook: ["logbook"],
  mentor: ["mentor"],
  fuel: ["diesel", "adblue"],
};

export const shiftPhotoSlots: readonly ShiftPhotoSlot[] = Object.values(shiftPhotoGroups).flat();

/** The slots a complete vehicle check fills; the two extra bus photos never count. */
export const EXPECTED_SHIFT_PHOTOS: readonly ShiftPhotoSlot[] = shiftPhotoSlots.filter(
  (s) => s !== "extra1" && s !== "extra2",
);

/** Mentor is a screenshot of the Mentor app; every other photo must be taken with the camera. */
export function libraryAllowed(slot: ShiftPhotoSlot): boolean {
  return slot === "mentor";
}

function shiftSlot(slot: unknown): ShiftPhotoSlot | null {
  return shiftPhotoSlots.includes(slot as ShiftPhotoSlot) ? (slot as ShiftPhotoSlot) : null;
}

/** Body of "start an upload": `{ slot, contentType }`. */
export function parseShiftPhotoRequest(body: unknown): Parsed<{ slot: ShiftPhotoSlot; contentType: PhotoType }> {
  const object = plainObject(body);
  if (!object) return { ok: false };
  const { slot, contentType, ...rest } = object;
  const target = shiftSlot(slot);
  if (!target || Object.keys(rest).length > 0 || !isPhotoType(contentType)) return { ok: false };
  return { ok: true, value: { slot: target, contentType } };
}

/** Body of "keep the uploaded photo": `{ slot, key }`; the key itself is checked against the prefix. */
export function parseShiftPhotoConfirm(body: unknown): Parsed<{ slot: ShiftPhotoSlot; key: string }> {
  const object = plainObject(body);
  if (!object) return { ok: false };
  const { slot, key, ...rest } = object;
  const target = shiftSlot(slot);
  if (!target || Object.keys(rest).length > 0 || typeof key !== "string") return { ok: false };
  return { ok: true, value: { slot: target, key } };
}

/** Query of "remove a photo": `?slot=`. */
export function parseShiftPhotoQuery(params: URLSearchParams): Parsed<{ slot: ShiftPhotoSlot }> {
  const slot = shiftSlot(params.get("slot"));
  return slot ? { ok: true, value: { slot } } : { ok: false };
}

/** Where one shift slot's photos live; the firm, courier and shift come from the session and the checked shift. */
export function shiftPhotoPrefix(firmId: string, userId: string, shiftId: string, slot: ShiftPhotoSlot): string {
  return `firms/${firmId}/couriers/${userId}/shifts/${shiftId}/${slot}/`;
}

// Car photos (owner-only).

export const carPhotoSlots: readonly CarPhotoSlot[] = ["talon"];

/** Zulassungsbescheinigung Teil I folded open, about 105 × 74 mm. */
export const TALON_RATIO = 105 / 74;

function carSlot(slot: unknown): CarPhotoSlot | null {
  return carPhotoSlots.includes(slot as CarPhotoSlot) ? (slot as CarPhotoSlot) : null;
}

/** Body of "start an upload": `{ slot, contentType }`. */
export function parseCarPhotoRequest(body: unknown): Parsed<{ slot: CarPhotoSlot; contentType: PhotoType }> {
  const object = plainObject(body);
  if (!object) return { ok: false };
  const { slot, contentType, ...rest } = object;
  const target = carSlot(slot);
  if (!target || Object.keys(rest).length > 0 || !isPhotoType(contentType)) return { ok: false };
  return { ok: true, value: { slot: target, contentType } };
}

/** Body of "keep the uploaded photo": `{ slot, key }`; the key itself is checked against the prefix. */
export function parseCarPhotoConfirm(body: unknown): Parsed<{ slot: CarPhotoSlot; key: string }> {
  const object = plainObject(body);
  if (!object) return { ok: false };
  const { slot, key, ...rest } = object;
  const target = carSlot(slot);
  if (!target || Object.keys(rest).length > 0 || typeof key !== "string") return { ok: false };
  return { ok: true, value: { slot: target, key } };
}

/** Query of "remove a photo": `?slot=`. */
export function parseCarPhotoQuery(params: URLSearchParams): Parsed<{ slot: CarPhotoSlot }> {
  const slot = carSlot(params.get("slot"));
  return slot ? { ok: true, value: { slot } } : { ok: false };
}

/** Where one car slot's photos live; the firm comes from the session and the car is checked to be the firm's. */
export function carPhotoPrefix(firmId: string, carId: string, slot: CarPhotoSlot): string {
  return `firms/${firmId}/cars/${carId}/${slot}/`;
}
