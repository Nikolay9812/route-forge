// Domain shapes shared by API routes and the app. Dates are calendar days ("YYYY-MM-DD") in the firm's
// timezone, timestamps are ISO strings in UTC, working time is minutes, money is integer minor units.

export type ShiftStatus = "draft" | "submitted" | "approved" | "rejected";

export type Shift = {
  id: string;
  date: string;
  status: ShiftStatus;
  startedAt: string;
  /** Set on submit. */
  finishedAt: string | null;
  /** Working time, set on submit. */
  minutes: number | null;
  depot: { id: string; name: string };
  car: { id: string; plate: string };
  startKm: number;
  endKm: number | null;
  loaded: number;
  /** Packages brought back undelivered. Delivered is loaded − returned, never stored. */
  returned: number | null;
  /** Customer returns collected (Abholung). */
  pickups: number | null;
  /** Set when status is rejected. */
  rejectionReason?: string;
};

/** A courier's hourly rate from `effectiveFrom` until the next rate starts. */
export type Rate = { effectiveFrom: string; hourlyMinor: number };

export type Firm = { name: string; currency: string; timeZone: string };

export type Station = { id: string; name: string };

export type Bus = { id: string; plate: string };

/** The `error` code in API error bodies. Bodies never carry details beyond the code. */
export type ApiErrorCode =
  | "unauthorized"
  | "noFirm"
  | "role"
  | "firmNotSetUp"
  | "invalid"
  | "notFound"
  | "exists"
  | "notEditable"
  | "endKmMissing"
  | "endBelowStart"
  | "returnedAboveLoaded"
  | "server";
