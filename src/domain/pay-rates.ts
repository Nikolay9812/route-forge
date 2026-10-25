// Input rules for an owner's pay rates. Amounts are typed as decimals and stored as integer minor units;
// a `firm` entry ("follow the firm default") has no amount and only exists for couriers.
import type { PayKind } from "./types";

export const MAX_AMOUNT_MINOR = 100000;

const AMOUNT = /^(\d{1,4})(?:[.,](\d{1,2}))?$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
/** Clerk user IDs. */
const USER_ID = /^user_[A-Za-z0-9]{1,64}$/;

type Parsed<T> = { ok: true; value: T } | { ok: false };

export type RateKind = PayKind | "firm";
export type RateCreate = { userId: string | null; effectiveFrom: string; kind: RateKind; amountMinor: number | null };
export type RatePatch = { effectiveFrom?: string; kind?: RateKind; amountMinor?: number | null };

/** "16,50", "16.5" or "16" → minor units, or null when it isn't an amount from 0.01 to 1,000.00. */
export function parseAmount(text: string): number | null {
  const match = AMOUNT.exec(text.trim());
  if (!match) return null;
  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return validAmount(minor) ? minor : null;
}

/** Minor units → "16.50" for prefilling the amount field. */
export function formatAmountInput(minor: number): string {
  return (minor / 100).toFixed(2);
}

export function validAmount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_AMOUNT_MINOR;
}

/** A real calendar day as "YYYY-MM-DD" (no 2026-02-30). */
export function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DAY.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function isKind(value: unknown): value is RateKind {
  return value === "hourly" || value === "daily" || value === "firm";
}

function isObject(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}

function hasOnly(body: Record<string, unknown>, keys: string[]): boolean {
  const present = Object.keys(body);
  return present.length > 0 && present.every((key) => keys.includes(key));
}

/** True when the kind, amount and target fit together: an amount exactly when it isn't `firm`, `firm` for couriers. */
export function consistentRate(userId: string | null, kind: RateKind, amountMinor: number | null): boolean {
  if (kind === "firm") return userId !== null && amountMinor === null;
  return validAmount(amountMinor);
}

/** Body of "schedule a change". `userId` null targets the firm default. */
export function parseRateCreate(body: unknown): Parsed<RateCreate> {
  if (!isObject(body) || !hasOnly(body, ["userId", "effectiveFrom", "kind", "amountMinor"])) return { ok: false };
  const { userId = null, effectiveFrom, kind, amountMinor = null } = body;
  if (userId !== null && (typeof userId !== "string" || !USER_ID.test(userId))) return { ok: false };
  if (!isDay(effectiveFrom) || !isKind(kind)) return { ok: false };
  if (amountMinor !== null && typeof amountMinor !== "number") return { ok: false };
  if (!consistentRate(userId, kind, amountMinor)) return { ok: false };
  return { ok: true, value: { userId, effectiveFrom, kind, amountMinor } };
}

/** Body of "edit an upcoming change": any of the fields; the merged entry is checked with `consistentRate`. */
export function parseRatePatch(body: unknown): Parsed<RatePatch> {
  if (!isObject(body) || !hasOnly(body, ["effectiveFrom", "kind", "amountMinor"])) return { ok: false };
  const value: RatePatch = {};
  if ("effectiveFrom" in body) {
    if (!isDay(body.effectiveFrom)) return { ok: false };
    value.effectiveFrom = body.effectiveFrom;
  }
  if ("kind" in body) {
    if (!isKind(body.kind)) return { ok: false };
    value.kind = body.kind;
  }
  if ("amountMinor" in body) {
    if (body.amountMinor !== null && !validAmount(body.amountMinor)) return { ok: false };
    value.amountMinor = body.amountMinor as number | null;
  }
  return { ok: true, value };
}
