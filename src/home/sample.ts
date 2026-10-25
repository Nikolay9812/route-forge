// Sample month for Home until the shifts API exists. Built relative to today in the firm's timezone so it
// always looks current. Plates, depot and the rejection reason stand in for database data, so they aren't
// translated. Delete this file when useHomeSummary reads from the API.
import { dateAtNoon, monthOf } from "@/domain/dates";
import type { Firm, Rate, Shift } from "@/domain/types";

export type SampleScenario = "full" | "empty" | "error" | "offline";

export const sampleScenarios: readonly SampleScenario[] = ["full", "empty", "error", "offline"];

export const sampleFirm: Firm = { currency: "EUR", timeZone: "Europe/Sofia" };

const cars = ["CA 4821 KM", "CA 7310 PB"];
const depotName = "Sofia West";

/** €8.00/h, then €9.00/h from the 15th: every sample month shows a mid-month rate change. */
export function sampleRates(today: string): Rate[] {
  return [
    { effectiveFrom: "2000-01-01", hourlyMinor: 800 },
    { effectiveFrom: `${monthOf(today)}-15`, hourlyMinor: 900 },
  ];
}

function shift(date: string, status: Shift["status"], day: number): Shift {
  return {
    id: date,
    date,
    status,
    // Varied but deterministic: 7:00–8:45 in 15-minute steps.
    minutes: 420 + ((day * 37) % 8) * 15,
    packages: 110 + ((day * 13) % 50),
    km: 60 + ((day * 7) % 40),
    carPlate: cars[day % cars.length],
    depotName,
    ...(status === "rejected" ? { rejectionReason: "Kilometers don't match the odometer. Check and resend." } : {}),
  };
}

/** Weekdays from the 1st to yesterday, newest first: two submitted, the fourth rejected, the rest approved. */
export function sampleMonth(today: string): { today: Shift; past: Shift[] } {
  const month = monthOf(today);
  const todayDay = Number(today.slice(8, 10));
  const past: Shift[] = [];
  for (let day = todayDay - 1; day >= 1; day--) {
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = dateAtNoon(date).getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    const status = past.length < 2 ? "submitted" : past.length === 3 ? "rejected" : "approved";
    past.push(shift(date, status, day));
  }
  return { today: { ...shift(today, "draft", todayDay), minutes: 330, packages: 96, km: 52 }, past };
}
