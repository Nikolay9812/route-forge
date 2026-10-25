// Today's shift while the courier fills it in. Number fields stay strings so the inputs show exactly what was
// typed; "" means not filled in yet. The shifts API plan moves the checks into src/domain/.
import { minuteOfDayIn } from "@/domain/dates";

export type ShiftPhase = "notStarted" | "inProgress" | "submitted";

export type ShiftFields = {
  station: string | null;
  bus: string | null;
  startKm: string;
  endKm: string;
  loaded: string;
  /** Delivered isn't typed: it is loaded − returned. */
  returned: string;
  pickups: string;
};

export type ShiftDraft = ShiftFields & {
  phase: ShiftPhase;
  /** UTC milliseconds, set by Start shift. */
  startedAt: number | null;
  /** UTC milliseconds, set by Submit shift. */
  finishedAt: number | null;
};

export const emptyDraft: ShiftDraft = {
  phase: "notStarted",
  startedAt: null,
  finishedAt: null,
  station: null,
  bus: null,
  startKm: "",
  endKm: "",
  loaded: "",
  returned: "",
  pickups: "",
};

/** Keeps digits only, so pasted "48 213" or "140." becomes a plain number string. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "").slice(0, 7);
}

function num(value: string): number | null {
  return value === "" ? null : Number(value);
}

/** End km − start km, or null until both are filled in. Negative when end is below start. */
export function kmDriven(draft: ShiftFields): number | null {
  const start = num(draft.startKm);
  const end = num(draft.endKm);
  return start === null || end === null ? null : end - start;
}

/** Loaded − returned (an empty returned counts as 0), or null until loaded is filled in. Negative when returned is above loaded. */
export function delivered(draft: ShiftFields): number | null {
  const loaded = num(draft.loaded);
  return loaded === null ? null : loaded - (num(draft.returned) ?? 0);
}

export function canStart(draft: ShiftFields): boolean {
  return !!draft.station && !!draft.bus && draft.startKm !== "" && draft.loaded !== "";
}

export function canFinish(draft: ShiftFields): boolean {
  const driven = kmDriven(draft);
  const count = delivered(draft);
  return canStart(draft) && driven !== null && driven >= 0 && count !== null && count >= 0;
}

/** "7:30" or "07:30" → 450 minutes after midnight, or null if it isn't a valid time. */
export function parseClock(text: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : null;
}

/** Today at the given firm-local minute of day, as UTC milliseconds, or null if that is in the future. */
export function todayAt(minuteOfDay: number, timeZone: string, now = new Date()): number | null {
  const current = minuteOfDayIn(timeZone, now);
  if (minuteOfDay > current) return null;
  const startOfMinute = now.getTime() - (now.getTime() % 60_000);
  return startOfMinute - (current - minuteOfDay) * 60_000;
}

/** Whole minutes between two UTC timestamps. */
export function elapsedMinutes(from: number, to: number): number {
  return Math.max(0, Math.floor((to - from) / 60_000));
}
