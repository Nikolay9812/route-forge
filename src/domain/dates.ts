// Calendar days and months in the firm's timezone, as "YYYY-MM-DD" strings that sort and compare as text.

function parts(timeZone: string, now: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return values as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

export function todayIn(timeZone: string, now = new Date()): string {
  const { year, month, day } = parts(timeZone, now);
  return `${year}-${month}-${day}`;
}

export function hourIn(timeZone: string, now = new Date()): number {
  return Number(parts(timeZone, now).hour);
}

/** Minutes since midnight in the firm's timezone, e.g. 450 at 07:30. */
export function minuteOfDayIn(timeZone: string, now = new Date()): number {
  const { hour, minute } = parts(timeZone, now);
  return Number(hour) * 60 + Number(minute);
}

/** "2026-10-25" → "2026-10". */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Noon UTC on the calendar day: formatting it in the firm's timezone always lands on the same day. */
export function dateAtNoon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** The same day n months later, clamped to the end of a shorter month (31 Jan + 1 month → 28/29 Feb). */
function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(d, last));
  return first.toISOString().slice(0, 10);
}

export type TimeUntil = { years: number; months: number; days: number; past: boolean };

/** Whole calendar years, months and days from `today` to `day`; `past` when `day` is before today. */
export function timeUntil(today: string, day: string): TimeUntil {
  const past = day < today;
  const [from, to] = past ? [day, today] : [today, day];
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  let months = (ty - fy) * 12 + (tm - fm);
  if (addMonths(from, months) > to) months -= 1;
  const days = Math.round((Date.parse(to) - Date.parse(addMonths(from, months))) / 86_400_000);
  return { years: Math.floor(months / 12), months: months % 12, days, past };
}

/** "7:30" or "07:30" → 450 minutes after midnight, or null if it isn't a valid time. */
export function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** How far the timezone's wall clock is ahead of UTC at an instant, in milliseconds. */
function offsetAt(timeZone: string, instant: number): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .map((part) => [part.type, part.value]),
  );
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return wall - (instant - (instant % 1000));
}

/** The UTC instant (ISO) when the firm's wall clock shows `minuteOfDay` on `date`. Twice-checked for DST changes. */
export function zonedTime(date: string, minuteOfDay: number, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const wall = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let instant = wall - offsetAt(timeZone, wall);
  instant = wall - offsetAt(timeZone, instant);
  return new Date(instant).toISOString();
}
