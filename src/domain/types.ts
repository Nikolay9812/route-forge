// Domain shapes shared by API routes and the app. Dates are calendar days ("YYYY-MM-DD") in the firm's
// timezone, timestamps are ISO strings in UTC, working time is minutes, money is integer minor units.
import type { MonthStats } from "./calendar";
import type { MonthTotals } from "./salary";

export type ShiftStatus = "draft" | "submitted" | "approved" | "rejected";

export type Shift = {
  id: string;
  date: string;
  status: ShiftStatus;
  startedAt: string;
  /** Set on submit. */
  finishedAt: string | null;
  /** Shift time (finish − start), set on submit. */
  minutes: number | null;
  /** The automatic break from the firm's work rule on the shift's day; null until submitted. */
  breakMinutes: number | null;
  /** Shift time minus the break: what hours and hourly pay count. Null until submitted. */
  workedMinutes: number | null;
  depot: { id: string; name: string };
  /** The VIN is shown to the courier as a QR; null when the owner hasn't entered one. */
  car: { id: string; plate: string; vin: string | null };
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
  /** Vehicle check photos taken, out of the expected ones (`EXPECTED_SHIFT_PHOTOS`); extras don't count. */
  photoCount: number;
};

/** Why a dispatcher sent a shift back. Codes are translated in the app. */
export type RejectReason = "km" | "packages" | "busOrStation";

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

/** Hourly pays approved minutes × rate; daily pays the amount once per approved shift. */
export type PayKind = "hourly" | "daily";

/** A rate in force from `effectiveFrom` until the next entry of the same target starts. */
export type Rate = { effectiveFrom: string; kind: PayKind; amountMinor: number };

/** A courier's own entry. `firm` (no amount) means "follow the firm default" from that day. */
export type RateEntry = { effectiveFrom: string; kind: PayKind | "firm"; amountMinor: number | null };

/** Everything that decides one courier's pay: the firm default and their own entries. */
export type PaySchedule = { firm: Rate[]; own: RateEntry[] };

/** One entry as the owner sees it in a rate history. Only upcoming entries can be edited or cancelled. */
export type PayRateEntry = RateEntry & {
  id: string;
  upcoming: boolean;
  /** The entry in force today. */
  current: boolean;
  setByName: string;
  setAt: string;
};

/** The firm default or one courier: today's rate, the next scheduled one, and every entry, newest first. */
export type PayRateTarget = {
  current: Rate | null;
  next: Rate | null;
  /** A courier with no own entry in force today, or a `firm` entry. Always false for the firm default. */
  followsFirm: boolean;
  entries: PayRateEntry[];
};

export type PayRateCourier = PayRateTarget & { userId: string; name: string };

/** The owner's Pay rates screen. `today` is the firm's day, which decides upcoming vs started. */
export type PayRates = { firm: Firm; today: string; firmDefault: PayRateTarget; couriers: PayRateCourier[] };

export type Firm = { name: string; currency: string; timeZone: string };

/**
 * A firm's break and Spesen rule, in force from `effectiveFrom` until the next entry starts. A shift over
 * `breakAfterMinutes` loses `breakMinutes`, over `longBreakAfterMinutes` it loses `longBreakMinutes` in total.
 * An approved shift over `spesenAfterMinutes` (shift time, before the break) earns `spesenMinor`; 0 = no Spesen.
 */
export type WorkRule = {
  effectiveFrom: string;
  breakAfterMinutes: number;
  breakMinutes: number;
  longBreakAfterMinutes: number;
  longBreakMinutes: number;
  spesenAfterMinutes: number;
  spesenMinor: number;
};

/** One rule entry as the owner sees it in the history. Only upcoming entries can be edited or cancelled. */
export type WorkRuleEntry = WorkRule & { id: string; upcoming: boolean; current: boolean; setByName: string; setAt: string };

/** The owner's Firm settings. `locked`: the firm has shifts, so currency and timezone can't change. */
export type FirmSettings = {
  today: string;
  name: string;
  currency: string;
  timeZone: string;
  locked: boolean;
  rule: WorkRule | null;
  next: WorkRule | null;
  entries: WorkRuleEntry[];
};

/** One month of a courier's shifts, oldest day first. `firstMonth` is where paging back stops. */
export type CalendarMonth = {
  firm: Firm;
  today: string;
  month: string;
  firstMonth: string;
  shifts: Shift[];
  stats: MonthStats;
};

/** One approved or submitted shift in the Pay tab's tables. Pay is null until the shift is approved. */
export type PayDay = {
  shiftId: string;
  date: string;
  status: "approved" | "submitted";
  /** Worked time: shift time minus the break. */
  minutes: number;
  breakMinutes: number;
  /** Delivered packages. */
  packages: number;
  km: number;
  payMinor: number | null;
  /** Tax-free meal allowance; null until approved, like pay. */
  spesenMinor: number | null;
};

/** One earlier month in the Pay tab's recent months list: approved shifts only. */
export type MonthPay = { month: string; payMinor: number; approvedMinutes: number; approvedShifts: number };

/**
 * One month of the courier's own pay. Totals count approved shifts only; `rates` are the rates in force during
 * the month (up to today), and `next` is the upcoming change, only for the current month. Days newest first.
 * `recentMonths` are the 5 months before the current one (from `firstMonth`), newest first, the same in every answer.
 */
export type PayMonth = {
  firm: Firm;
  today: string;
  month: string;
  firstMonth: string;
  totals: MonthTotals;
  rates: Rate[];
  next: Rate | null;
  days: PayDay[];
  recentMonths: MonthPay[];
};

export type Station = { id: string; name: string };

export type Bus = { id: string; plate: string };

/** A depot as its firm's owner manages it, with every car assigned to it (archived ones included). */
export type FleetDepot = { id: string; name: string; archived: boolean; cars: FleetCar[] };

export type FleetCar = {
  id: string;
  plate: string;
  depotId: string;
  archived: boolean;
  papers: CarPapers;
  /** The highest end km of a submitted or approved shift with this car, null without one. */
  odometerKm: number | null;
  hasTalon: boolean;
};

/** A car's papers, saved as a whole by the owner. Every field is optional (null = not set). */
export type CarPapers = {
  vin: string | null;
  /** TÜV (HU) due month, "YYYY-MM"; valid through its last day. */
  tuvDue: string | null;
  insuranceExpiresOn: string | null;
  serviceDueOn: string | null;
  serviceDueKm: number | null;
};

export type CarWarningKind = "tuv" | "insurance" | "service";

/** `soon`: within 30 days (or 1,000 km of the service km); `due`: the day or km has passed. */
export type CarWarning = { kind: CarWarningKind; level: "soon" | "due" };

export type CarPhotoSlot = "talon";

/** One car for its owner: the fleet row plus its signed talon photo, when the papers were saved last, and the firm's today. */
export type CarDetail = FleetCar & {
  photos: Partial<Record<CarPhotoSlot, DocumentPhoto>>;
  papersUpdatedAt: string | null;
  today: string;
};

/** Every depot of the firm, active and archived, sorted by name; cars sorted by plate. `today` is the firm's. */
export type Fleet = { today: string; depots: FleetDepot[] };

/** The sections of a courier's personal documents, in Profile order. */
export type DetailsSection =
  | "idCard"
  | "licence"
  | "address"
  | "tax"
  | "social"
  | "health"
  | "criminalRecord"
  | "bank"
  | "contacts";

export type Gender = "female" | "male" | "diverse";

/** A courier's personal documents. Every field is null until set; dates are calendar days. */
export type CourierDetails = {
  idNumber: string | null;
  nationality: string | null;
  placeOfBirth: string | null;
  birthDate: string | null;
  gender: Gender | null;
  idAddress: string | null;
  idIssuedOn: string | null;
  idExpiresOn: string | null;
  licenceNumber: string | null;
  licenceClasses: string[] | null;
  licenceIssuedOn: string | null;
  licenceExpiresOn: string | null;
  /** The registered address in Germany (Anmeldung), which can differ from the ID card. */
  street: string | null;
  postcode: string | null;
  city: string | null;
  /** Steuer-ID, 11 digits. */
  taxId: string | null;
  taxClass: number | null;
  /** Sozialversicherungsnummer. */
  socialNumber: string | null;
  healthInsurer: string | null;
  healthNumber: string | null;
  /** Führungszeugnis. */
  criminalRecordIssuedOn: string | null;
  bankHolder: string | null;
  iban: string | null;
  phone: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
};

export type SectionWarning = "expired" | "expiresSoon" | "tooOld";

export type SectionState = { state: "missing" | "incomplete" | "complete"; warning: SectionWarning | null };

/** A photo slot of a document section (which sections have which slots: `sectionPhotos` in `photos.ts`). */
export type PhotoSlot = "front" | "back" | "photo" | "page1" | "page2" | "page3";

/** A stored document photo: its object key (stable, for caching) and a short-lived signed URL to show it. */
export type DocumentPhoto = { key: string; url: string };

/** A vehicle check photo slot of a shift (groups and order: `shiftPhotoGroups`). */
export type ShiftPhotoSlot =
  | "front"
  | "back"
  | "left"
  | "right"
  | "extra1"
  | "extra2"
  | "logbook"
  | "mentor"
  | "diesel"
  | "adblue";

export type ShiftPhotos = Partial<Record<ShiftPhotoSlot, DocumentPhoto>>;

export type DocumentPhotos =Partial<Record<DetailsSection, Partial<Record<PhotoSlot, DocumentPhoto>>>>;

/** One courier's documents, for the courier themselves or their firm's owner. */
export type CourierDocuments = {
  userId: string;
  name: string;
  today: string;
  details: CourierDetails;
  sections: Record<DetailsSection, SectionState>;
  photos: DocumentPhotos;
};

/** A courier in the owner's Couriers list. `expiring` counts both `expiresSoon` and `tooOld` sections. */
export type CourierDocumentsItem = {
  userId: string;
  name: string;
  complete: number;
  expired: number;
  expiring: number;
  /** No longer a member of the firm (removed); their documents stay. */
  former: boolean;
};

export type CourierDocumentsList = { today: string; couriers: CourierDocumentsItem[] };

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
  | "memberLimit"
  | "server";

/** A member of the firm on the owner's People screen. `depotIds` is filled for dispatchers only. */
export type Person = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "dispatcher" | "courier";
  joinedAt: string;
  depotIds: string[];
};

export type PendingInvitation = { id: string; email: string; role: "dispatcher" | "courier"; createdAt: string };

/** Every member, the pending invitations, and the active depots a dispatcher can be given. */
export type PeopleList = {
  firm: Firm;
  /** The signed-in owner's user ID, to mark their own row. */
  you: string;
  members: Person[];
  invitations: PendingInvitation[];
  depots: { id: string; name: string }[];
};
