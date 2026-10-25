// Domain shapes shared by API routes and the app. Dates are calendar days ("YYYY-MM-DD") in the firm's
// timezone, working time is minutes, money is integer minor units (cents, stotinki).

export type ShiftStatus = "draft" | "submitted" | "approved" | "rejected";

export type Shift = {
  id: string;
  date: string;
  status: ShiftStatus;
  minutes: number;
  packages: number;
  km: number;
  carPlate: string;
  depotName: string;
  /** Set when status is rejected. */
  rejectionReason?: string;
};

/** A courier's hourly rate from `effectiveFrom` until the next rate starts. */
export type Rate = { effectiveFrom: string; hourlyMinor: number };

export type Firm = { currency: string; timeZone: string };
