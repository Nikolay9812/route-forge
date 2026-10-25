// Development seed: firm settings, depots, cars, courier rates and a month of past shifts for the firms below.
// Firms and members come from Clerk (looked up by organization name); everything else is written to the Neon
// branch in DATABASE_URL. Each run wipes and re-creates these firms' rows: development data is worthless.
// Run with `npm run db:seed`. Salary amounts are never printed.
import { neon } from "@neondatabase/serverless";

const firms = [
  {
    name: "Ivanov Transport",
    currency: "EUR",
    timeZone: "Europe/Berlin",
    depots: ["HBW3", "HBW1", "HBW7"],
    cars: ["KH I 6004", "KH I 5120", "KH I 7732"],
    // €15.00/h from the 1st, €16.00/h from the 15th: every month shows a mid-month rate change.
    rates: [
      { day: "01", hourlyMinor: 1500 },
      { day: "15", hourlyMinor: 1600 },
    ],
  },
  {
    name: "Test Firm B",
    currency: "EUR",
    timeZone: "Europe/Berlin",
    depots: ["TFB1"],
    cars: ["B TF 100"],
    rates: [{ day: "01", hourlyMinor: 1200 }],
  },
];

const { CLERK_SECRET_KEY, DATABASE_URL } = process.env;
if (!CLERK_SECRET_KEY || !DATABASE_URL) throw new Error("CLERK_SECRET_KEY and DATABASE_URL must be set (.env.local).");

const sql = neon(DATABASE_URL);

async function clerk(path) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } });
  if (!res.ok) throw new Error(`Clerk ${path}: ${res.status}`);
  return res.json();
}

async function findOrg(name) {
  const { data } = await clerk(`/organizations?query=${encodeURIComponent(name)}&limit=10`);
  const org = data.find((o) => o.name === name);
  if (!org) throw new Error(`No Clerk organization named "${name}". Create it first.`);
  return org;
}

async function couriersOf(orgId) {
  const { data } = await clerk(`/organizations/${orgId}/memberships?limit=100`);
  return data.filter((m) => m.role === "org:courier").map((m) => m.public_user_data.user_id);
}

function todayIn(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

/** Weekdays of this month before today, newest first. */
function pastWeekdays(today) {
  const days = [];
  const [year, month, day] = today.split("-").map(Number);
  for (let d = day - 1; d >= 1; d--) {
    const date = new Date(Date.UTC(year, month - 1, d, 12));
    const weekday = date.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(date.toISOString().slice(0, 10));
  }
  return days;
}

for (const firm of firms) {
  const org = await findOrg(firm.name);
  const firmId = org.id;
  const couriers = await couriersOf(firmId);
  const today = todayIn(firm.timeZone);
  const month = today.slice(0, 7);

  await sql.transaction([
    sql`delete from shifts where firm_id = ${firmId}`,
    sql`delete from courier_rates where firm_id = ${firmId}`,
    sql`delete from cars where firm_id = ${firmId}`,
    sql`delete from depots where firm_id = ${firmId}`,
    sql`delete from firm_settings where firm_id = ${firmId}`,
    sql`insert into firm_settings (firm_id, currency, time_zone) values (${firmId}, ${firm.currency}, ${firm.timeZone})`,
  ]);

  const depots = [];
  for (const name of firm.depots) {
    const [row] = await sql`insert into depots (firm_id, name) values (${firmId}, ${name}) returning id`;
    depots.push(row.id);
  }
  const cars = [];
  for (const [i, plate] of firm.cars.entries()) {
    const [row] = await sql`
      insert into cars (firm_id, plate, depot_id) values (${firmId}, ${plate}, ${depots[i % depots.length]}) returning id`;
    cars.push(row.id);
  }

  let shiftCount = 0;
  for (const [c, userId] of couriers.entries()) {
    for (const rate of firm.rates) {
      await sql`
        insert into courier_rates (firm_id, user_id, effective_from, hourly_minor)
        values (${firmId}, ${userId}, ${`${month}-${rate.day}`}, ${rate.hourlyMinor})`;
    }

    // Newest two submitted, the fourth rejected, the rest approved. Times are rough: 06:00 UTC starts.
    const days = pastWeekdays(today);
    for (const [i, date] of days.entries()) {
      const day = Number(date.slice(8, 10));
      const status = i < 2 ? "submitted" : i === 3 ? "rejected" : "approved";
      const minutes = 420 + ((day * 37 + c * 11) % 8) * 15;
      const km = 60 + ((day * 7 + c * 5) % 40);
      const loaded = 120 + ((day * 13 + c * 3) % 50);
      const returned = (day * 3 + c) % 9;
      const startedAt = new Date(`${date}T06:00:00Z`);
      const finishedAt = new Date(startedAt.getTime() + minutes * 60_000);
      // The odometer grows ~100 km a day, so newer shifts start higher.
      const startKm = 48_000 + c * 10_000 + (days.length - i) * 100;
      await sql`
        insert into shifts (firm_id, user_id, date, status, depot_id, car_id, started_at, finished_at, minutes,
          start_km, end_km, loaded, returned, pickups, rejection_reason, submitted_at)
        values (${firmId}, ${userId}, ${date}, ${status}, ${depots[c % depots.length]}, ${cars[(c + i) % cars.length]},
          ${startedAt.toISOString()}, ${finishedAt.toISOString()}, ${minutes}, ${startKm}, ${startKm + km},
          ${loaded}, ${returned}, ${day % 4}, ${status === "rejected" ? "Kilometers don't match the odometer. Check and resend." : null},
          ${finishedAt.toISOString()})`;
      shiftCount++;
    }
  }

  console.log(
    `${firm.name}: ${depots.length} depots, ${cars.length} cars, ${couriers.length} couriers, ${shiftCount} past shifts.`,
  );
}
