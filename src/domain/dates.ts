// Calendar days and months in the firm's timezone, as "YYYY-MM-DD" strings that sort and compare as text.

function parts(timeZone: string, now: Date) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return values as Record<"year" | "month" | "day" | "hour", string>;
}

export function todayIn(timeZone: string, now = new Date()): string {
  const { year, month, day } = parts(timeZone, now);
  return `${year}-${month}-${day}`;
}

export function hourIn(timeZone: string, now = new Date()): number {
  return Number(parts(timeZone, now).hour);
}

/** "2026-10-25" → "2026-10". */
export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Noon UTC on the calendar day: formatting it in the firm's timezone always lands on the same day. */
export function dateAtNoon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}
