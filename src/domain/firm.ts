// Firm settings rules: the currencies and timezones an owner can pick, and the input rules of a work rule (the
// automatic break and Spesen). Pure and import-free at runtime; the math lives in salary.ts.
import type { WorkRule } from "./types";

/** All with two minor digits, which the money code assumes. */
export const CURRENCIES = ["EUR", "CHF", "PLN", "CZK", "GBP"] as const;

export const TIME_ZONES = [
  "Europe/Berlin",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/Sofia",
  "Europe/Bucharest",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/London",
] as const;

/** A new firm's settings until the owner picks others. */
export const DEFAULT_SETTINGS = { currency: "EUR", timeZone: "Europe/Berlin" } as const;

/** German law (ArbZG §4): over 6 h 30 min, over 9 h 45 min; Spesen €14.00 over 8 h away (Verpflegungsmehraufwand). */
export const LAW_DEFAULTS: Omit<WorkRule, "effectiveFrom"> = {
  breakAfterMinutes: 360,
  breakMinutes: 30,
  longBreakAfterMinutes: 540,
  longBreakMinutes: 45,
  spesenAfterMinutes: 480,
  spesenMinor: 1400,
};

export const MIN_AFTER_MINUTES = 60;
export const MAX_AFTER_MINUTES = 960;
export const MAX_BREAK_MINUTES = 120;
export const MAX_SPESEN_MINOR = 10000;

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^(\d{1,2})[:.](\d{2})$/;

type Parsed<T> = { ok: true; value: T } | { ok: false };

export function isCurrency(value: unknown): value is (typeof CURRENCIES)[number] {
  return CURRENCIES.includes(value as (typeof CURRENCIES)[number]);
}

export function isTimeZone(value: unknown): value is (typeof TIME_ZONES)[number] {
  return TIME_ZONES.includes(value as (typeof TIME_ZONES)[number]);
}

/** "6:00" or "6.00" → 360, or null. For the rule sheet's threshold fields. */
export function parseClock(text: string): number | null {
  const match = CLOCK.exec(text.trim());
  if (!match) return null;
  const minutes = Number(match[2]);
  return minutes < 60 ? Number(match[1]) * 60 + minutes : null;
}

function isDay(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DAY.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return y >= 2000 && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const whole = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** True when the fields fit together: the longer break starts later and is at least as long. */
export function validRule(rule: Omit<WorkRule, "effectiveFrom">): boolean {
  return (
    whole(rule.breakAfterMinutes, MIN_AFTER_MINUTES, MAX_AFTER_MINUTES) &&
    whole(rule.longBreakAfterMinutes, rule.breakAfterMinutes + 1, MAX_AFTER_MINUTES) &&
    whole(rule.breakMinutes, 0, MAX_BREAK_MINUTES) &&
    whole(rule.longBreakMinutes, rule.breakMinutes, MAX_BREAK_MINUTES) &&
    whole(rule.spesenAfterMinutes, MIN_AFTER_MINUTES, MAX_AFTER_MINUTES) &&
    whole(rule.spesenMinor, 0, MAX_SPESEN_MINOR)
  );
}

const RULE_KEYS = [
  "effectiveFrom",
  "breakAfterMinutes",
  "breakMinutes",
  "longBreakAfterMinutes",
  "longBreakMinutes",
  "spesenAfterMinutes",
  "spesenMinor",
] as const;

/** Body of scheduling or editing a rule entry: every field, saved whole. */
export function parseRule(body: unknown): Parsed<WorkRule> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false };
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== RULE_KEYS.length || !RULE_KEYS.every((key) => key in record)) return { ok: false };
  if (!isDay(record.effectiveFrom)) return { ok: false };
  const rule = record as WorkRule;
  return validRule(rule) ? { ok: true, value: { ...rule } } : { ok: false };
}

/** Body of changing currency and timezone. */
export function parseSettings(body: unknown): Parsed<{ currency: string; timeZone: string }> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false };
  const { currency, timeZone, ...rest } = body as Record<string, unknown>;
  if (Object.keys(rest).length > 0 || !isCurrency(currency) || !isTimeZone(timeZone)) return { ok: false };
  return { ok: true, value: { currency, timeZone } };
}
