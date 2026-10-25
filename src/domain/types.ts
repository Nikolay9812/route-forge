// Domain shapes shared by API routes and the app. Dates are calendar days ("YYYY-MM-DD") in the firm's
// timezone, timestamps are ISO strings in UTC, working time is minutes, money is integer minor units.
import type { MonthStats } from "./calendar";

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
  rejection?: Rejection;
  /** A dispatcher or owner changed a value after the courier submitted it. */
  corrected: boolean;
};

/** Why a dispatcher sent a shift back. Codes are translated in the app. */
export type RejectReason = "km" | "packages" | "busOrStation" | "time";

export type Rejection = { reasons: RejectReason[]; note: string | null };

/** One corrected field. Values are as stored: numbers as text, times as ISO, depot and car as names. */
export type ShiftChange = { field: ShiftField; from: string | null; to: string | null; byName: string; at: string };

export type ShiftField =
  | "depot"
  | "car"
  | "startedAt"
  | "finishedAt"
  | "startKm"
  | "endKm"
  | "loaded"
  | "returned"
  | "pickups";

/** A shift with its courier, as dispatchers and owners see it in the approvals list. */
export type ReviewItem = { shift: Shift; courierName: string };

/** A courier's hourly rate from `effectiveFrom` until the next rate starts. */
export type Rate = { effectiveFrom: string; hourlyMinor: number };

export type Firm = { name: string; currency: string; timeZone: string };

/** One month of a courier's shifts, oldest day first. `firstMonth` is where paging back stops. */
export type CalendarMonth = {
  firm: Firm;
  today: string;
  month: string;
  firstMonth: string;
  shifts: Shift[];
  stats: MonthStats;
};

export type Station = { id: string; name: string };

export type Bus = { id: string; plate: string };

/** A depot as its firm's owner manages it, with every car assigned to it (archived ones included). */
export type FleetDepot = { id: string; name: string; archived: boolean; cars: FleetCar[] };

export type FleetCar = { id: string; plate: string; depotId: string; archived: boolean };

/** Every depot of the firm, active and archived, sorted by name; cars sorted by plate. */
export type Fleet = { depots: FleetDepot[] };

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
  | "taken"
  | "depotHasCars"
  | "server";
