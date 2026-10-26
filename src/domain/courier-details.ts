// Rules for a courier's personal documents, shared by API routes and the app. Each section is saved whole: the
// form sends every field of one section as typed, and `checkSection` normalises it or says what is wrong per field.
// Photos are stored apart from the fields: their slots, types and object keys are checked here too.
import type { CourierDetails, DetailsSection, Gender, PhotoSlot, SectionState, SectionWarning } from "./types";

type Field = keyof CourierDetails;
type Parsed<T> = { ok: true; value: T } | { ok: false };

export const detailsSections: readonly DetailsSection[] = [
  "idCard",
  "licence",
  "address",
  "tax",
  "social",
  "health",
  "criminalRecord",
  "bank",
  "contacts",
];

export const sectionFields: Record<DetailsSection, readonly Field[]> = {
  idCard: ["idNumber", "nationality", "placeOfBirth", "birthDate", "gender", "idAddress", "idIssuedOn", "idExpiresOn"],
  licence: ["licenceNumber", "licenceClasses", "licenceIssuedOn", "licenceExpiresOn"],
  address: ["street", "postcode", "city"],
  tax: ["taxId", "taxClass"],
  social: ["socialNumber"],
  health: ["healthInsurer", "healthNumber"],
  criminalRecord: ["criminalRecordIssuedOn"],
  bank: ["bankHolder", "iban"],
  contacts: ["phone", "emergencyName", "emergencyPhone"],
};

export const LICENCE_CLASSES = ["AM", "A1", "A2", "A", "B", "BE", "C1", "C1E", "C", "CE"] as const;
export const genders: readonly Gender[] = ["female", "male", "diverse"];
export const taxClasses = [1, 2, 3, 4, 5, 6] as const;

/** Days before an ID card or licence expires that it counts as expiring soon. */
export const EXPIRY_WARNING_DAYS = 30;
/** A Führungszeugnis older than this many months counts as too old. */
export const RECORD_MAX_MONTHS = 3;

/** Free-text fields and their longest length. */
const textLimits: Partial<Record<Field, number>> = {
  idNumber: 30,
  nationality: 80,
  placeOfBirth: 80,
  idAddress: 200,
  licenceNumber: 30,
  street: 200,
  city: 80,
  healthInsurer: 80,
  bankHolder: 80,
  emergencyName: 80,
};

export const emptyDetails: CourierDetails = {
  idNumber: null,
  nationality: null,
  placeOfBirth: null,
  birthDate: null,
  gender: null,
  idAddress: null,
  idIssuedOn: null,
  idExpiresOn: null,
  licenceNumber: null,
  licenceClasses: null,
  licenceIssuedOn: null,
  licenceExpiresOn: null,
  street: null,
  postcode: null,
  city: null,
  taxId: null,
  taxClass: null,
  socialNumber: null,
  healthInsurer: null,
  healthNumber: null,
  criminalRecordIssuedOn: null,
  bankHolder: null,
  iban: null,
  phone: null,
  emergencyName: null,
  emergencyPhone: null,
};

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar day as "YYYY-MM-DD" (no 2026-02-30), from 1900 on. */
function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DAY.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function utcDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  const date = utcDay(day);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** The same day n months earlier, clamped to the end of a shorter month (31 May − 3 months → 28/29 Feb). */
export function monthsBefore(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 - n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

function collapse(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function compact(text: string): string {
  return text.replace(/\s+/g, "").toUpperCase();
}

/** 11 digits, spaces ignored. */
export function normalizeTaxId(text: string): string | null {
  const value = text.replace(/\s+/g, "");
  return /^\d{11}$/.test(value) ? value : null;
}

/** 8 digits, a letter and 3 digits (e.g. 65 170839 J 003), spaces ignored. */
export function normalizeSocialNumber(text: string): string | null {
  const value = compact(text);
  return /^\d{8}[A-Z]\d{3}$/.test(value) ? value : null;
}

/** A letter and 9 digits (Krankenversichertennummer), spaces ignored. */
export function normalizeHealthNumber(text: string): string | null {
  const value = compact(text);
  return /^[A-Z]\d{9}$/.test(value) ? value : null;
}

/** An IBAN without spaces, uppercase, when its mod-97 checksum holds. */
export function normalizeIban(text: string): string | null {
  const value = compact(text);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(value)) return null;
  const digits = (value.slice(4) + value.slice(0, 4)).replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const digit of digits) rest = (rest * 10 + Number(digit)) % 97;
  return rest === 1 ? value : null;
}

/** "DE89370400440532013000" → "DE89 3704 0044 0532 0130 00". */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, "$1 ");
}

/** `+`, digits, spaces, `-`, `/`, `(`, `)` with 6 to 20 digits; kept as typed, whitespace collapsed. */
export function normalizePhone(text: string): string | null {
  const value = collapse(text);
  if (!/^\+?[\d\s\-/()]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 6 && digits <= 20 ? value : null;
}

export type FieldProblem = "tooLong" | "format" | "future" | "beforeIssued";

export type SectionCheck =
  | { ok: true; value: Partial<CourierDetails> }
  | { ok: false; problems: Partial<Record<Field, FieldProblem>> };

/** What an empty text field, an empty array or `null` means: not set. */
function blank(value: unknown): boolean {
  return value === null || (typeof value === "string" && value.trim() === "") || (Array.isArray(value) && value.length === 0);
}

type One = { ok: true; value: unknown } | { ok: false; problem: FieldProblem } | null;

/** One field as typed → its stored value, a problem, or null when the type itself is wrong (a bad request). */
function checkField(field: Field, raw: unknown, today: string): One {
  if (blank(raw)) return { ok: true, value: null };
  const limit = textLimits[field];
  if (limit !== undefined) {
    if (typeof raw !== "string") return null;
    const value = collapse(raw);
    return value.length <= limit ? { ok: true, value } : { ok: false, problem: "tooLong" };
  }
  switch (field) {
    case "birthDate":
      if (typeof raw !== "string") return null;
      if (!isDay(raw)) return { ok: false, problem: "format" };
      return raw < today ? { ok: true, value: raw } : { ok: false, problem: "future" };
    case "idIssuedOn":
    case "licenceIssuedOn":
    case "criminalRecordIssuedOn":
      if (typeof raw !== "string") return null;
      if (!isDay(raw)) return { ok: false, problem: "format" };
      return raw <= today ? { ok: true, value: raw } : { ok: false, problem: "future" };
    case "idExpiresOn":
    case "licenceExpiresOn":
      if (typeof raw !== "string") return null;
      return isDay(raw) ? { ok: true, value: raw } : { ok: false, problem: "format" };
    case "gender":
      return genders.includes(raw as Gender) ? { ok: true, value: raw } : null;
    case "licenceClasses": {
      if (!Array.isArray(raw)) return null;
      const known = LICENCE_CLASSES as readonly unknown[];
      if (!raw.every((c) => known.includes(c))) return null;
      // Stored once each, in the licence's own order.
      return { ok: true, value: LICENCE_CLASSES.filter((c) => raw.includes(c)) };
    }
    case "taxClass":
      return (taxClasses as readonly unknown[]).includes(raw) ? { ok: true, value: raw } : null;
    case "postcode":
      if (typeof raw !== "string") return null;
      return /^\d{5}$/.test(raw.trim()) ? { ok: true, value: raw.trim() } : { ok: false, problem: "format" };
  }
  const normalize = {
    taxId: normalizeTaxId,
    socialNumber: normalizeSocialNumber,
    healthNumber: normalizeHealthNumber,
    iban: normalizeIban,
    phone: normalizePhone,
    emergencyPhone: normalizePhone,
  }[field as string];
  if (!normalize || typeof raw !== "string") return null;
  const value = normalize(raw);
  return value === null ? { ok: false, problem: "format" } : { ok: true, value };
}

/**
 * Every field of one section as typed (`input` has exactly the section's keys) → the values to store, or a
 * problem per field. Returns null when the input isn't shaped like the section at all.
 */
export function checkSection(section: DetailsSection, input: Record<string, unknown>, today: string): SectionCheck | null {
  const fields = sectionFields[section];
  const keys = Object.keys(input);
  if (keys.length !== fields.length || !fields.every((f) => keys.includes(f))) return null;

  const value: Partial<CourierDetails> = {};
  const problems: Partial<Record<Field, FieldProblem>> = {};
  for (const field of fields) {
    const result = checkField(field, input[field], today);
    if (result === null) return null;
    if (result.ok) (value as Record<string, unknown>)[field] = result.value;
    else problems[field] = result.problem;
  }
  for (const [issued, expires] of [
    ["idIssuedOn", "idExpiresOn"],
    ["licenceIssuedOn", "licenceExpiresOn"],
  ] as const) {
    const from = value[issued];
    const to = value[expires];
    if (from && to && to <= from && !problems[expires]) problems[expires] = "beforeIssued";
  }
  return Object.keys(problems).length > 0 ? { ok: false, problems } : { ok: true, value };
}

export type DetailsPatch = { section: DetailsSection; values: Partial<CourierDetails> };

/** Body of "save a section": `{ section, values }` with every field of that section, all valid. */
export function parseDetailsPatch(body: unknown, today: string): Parsed<DetailsPatch> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false };
  const { section, values, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || !detailsSections.includes(section as DetailsSection)) return { ok: false };
  if (typeof values !== "object" || values === null || Array.isArray(values)) return { ok: false };
  const checked = checkSection(section as DetailsSection, values as Record<string, unknown>, today);
  return checked?.ok ? { ok: true, value: { section: section as DetailsSection, values: checked.value } } : { ok: false };
}

function expiryWarning(expiresOn: string | null, today: string): SectionWarning | null {
  if (!expiresOn) return null;
  if (expiresOn < today) return "expired";
  return expiresOn <= addDays(today, EXPIRY_WARNING_DAYS) ? "expiresSoon" : null;
}

export function sectionWarning(details: CourierDetails, section: DetailsSection, today: string): SectionWarning | null {
  switch (section) {
    case "idCard":
      return expiryWarning(details.idExpiresOn, today);
    case "licence":
      return expiryWarning(details.licenceExpiresOn, today);
    case "criminalRecord": {
      const issued = details.criminalRecordIssuedOn;
      return issued && issued < monthsBefore(today, RECORD_MAX_MONTHS) ? "tooOld" : null;
    }
    default:
      return null;
  }
}

/** Missing when nothing is set, complete when everything is (photos don't count). */
export function sectionState(details: CourierDetails, section: DetailsSection, today: string): SectionState {
  const fields = sectionFields[section];
  const set = fields.filter((f) => !blank(details[f])).length;
  const state = set === 0 ? "missing" : set === fields.length ? "complete" : "incomplete";
  return { state, warning: sectionWarning(details, section, today) };
}

export function sectionStates(details: CourierDetails, today: string): Record<DetailsSection, SectionState> {
  return Object.fromEntries(detailsSections.map((s) => [s, sectionState(details, s, today)])) as Record<
    DetailsSection,
    SectionState
  >;
}

/** Photo slots per section; the health card shows its front only, a Führungszeugnis can run to three pages. */
export const sectionPhotos: Partial<Record<DetailsSection, readonly PhotoSlot[]>> = {
  idCard: ["front", "back"],
  licence: ["front", "back"],
  address: ["photo"],
  tax: ["photo"],
  health: ["front"],
  criminalRecord: ["page1", "page2", "page3"],
};

export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp"] as const;
export type PhotoType = (typeof PHOTO_TYPES)[number];
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;

export type PhotoTarget = { section: DetailsSection; slot: PhotoSlot };

function photoTarget(section: unknown, slot: unknown): PhotoTarget | null {
  if (!detailsSections.includes(section as DetailsSection)) return null;
  const slots = sectionPhotos[section as DetailsSection] ?? [];
  return slots.includes(slot as PhotoSlot) ? { section: section as DetailsSection, slot: slot as PhotoSlot } : null;
}

function plainObject(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/** Body of "start an upload": `{ section, slot, contentType }`, a slot that section has and an allowed type. */
export function parsePhotoRequest(body: unknown): Parsed<PhotoTarget & { contentType: PhotoType }> {
  const object = plainObject(body);
  if (!object) return { ok: false };
  const { section, slot, contentType, ...rest } = object;
  const target = photoTarget(section, slot);
  if (!target || Object.keys(rest).length > 0 || !PHOTO_TYPES.includes(contentType as PhotoType)) return { ok: false };
  return { ok: true, value: { ...target, contentType: contentType as PhotoType } };
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** A key the server could have handed out for this slot: the prefix plus a UUID, nothing else. */
export function isPhotoKey(key: string, prefix: string): boolean {
  return key.startsWith(prefix) && UUID.test(key.slice(prefix.length));
}

/** Counts for the owner's Couriers list. */
export function documentSummary(details: CourierDetails, today: string) {
  const states = Object.values(sectionStates(details, today));
  return {
    complete: states.filter((s) => s.state === "complete").length,
    expired: states.filter((s) => s.warning === "expired").length,
    expiring: states.filter((s) => s.warning === "expiresSoon" || s.warning === "tooOld").length,
  };
}
