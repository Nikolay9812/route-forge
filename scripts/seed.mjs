// Development seed: firm settings, depots, cars (with papers), pay rates, courier documents (photos wiped from R2) and six months of past shifts for the firms below.
// Firms and members come from Clerk (looked up by organization name); everything else is written to the Neon
// branch in DATABASE_URL. Each run wipes and re-creates these firms' rows: development data is worthless.
// Run with `npm run db:seed`. The calendar is the same on every run of a day. Salary amounts are never printed.
import { neon } from "@neondatabase/serverless";

import { addMonths } from "../src/domain/calendar.ts";
import { addDays } from "../src/domain/courier-details.ts";
import { zonedTime } from "../src/domain/dates.ts";
import { lastDayOfMonth } from "../src/domain/fleet.ts";
import { deletePrefix } from "../src/server/storage.ts";

const MONTHS_BACK = 6;

const firms = [
  {
    name: "Ivanov Transport",
    currency: "EUR",
    timeZone: "Europe/Berlin",
    depots: ["HBW3", "HBW1", "HBW7"],
    // One car per depot, in the same order.
    cars: ["KH I 6004", "KH I 5120", "KH I 7732"],
    // Papers per car, in the same order: TÜV in months from the current one, insurance in days from today, the
    // service km ahead of the car's odometer. The first warns about TÜV (this month) and service (600 km to go),
    // the second about insurance (expired), the third has none, so courier.c at HBW7 sees no VIN.
    papers: [
      { vin: "ZFA250006SMC06228", tuvMonths: 0, insuranceDays: 200, serviceKmAhead: 600 },
      { vin: "WF0XXXTTGXKA12345", tuvMonths: 14, insuranceDays: -10, serviceKmAhead: 15_000 },
      null,
    ],
    // The firm default (hourly), in months relative to the current one: a mid-month change three months ago and
    // one in the current month.
    rates: [
      { month: -MONTHS_BACK, day: "01", hourlyMinor: 1400 },
      { month: -3, day: "15", hourlyMinor: 1450 },
      { month: 0, day: "01", hourlyMinor: 1500 },
      { month: 0, day: "15", hourlyMinor: 1600 },
    ],
    // Couriers with their own rate: courier.c is on a day rate from the 1st of last month.
    overrides: { "courier.c": [{ month: -1, day: "01", kind: "daily", amountMinor: 13000 }] },
    // courier.a drives in the dispatcher's depots only, courier.c only at HBW7 (outside them).
    depotsOf: { "courier.a": [0, 1], "courier.c": [2] },
    // Made-up documents, dates in days relative to today: courier.a has everything with an ID card expiring in
    // 20 days, courier.c has gaps and a Führungszeugnis that is 5 months old.
    details: {
      "courier.a": {
        id_number: "L01X00T47",
        nationality: "Bulgarian",
        place_of_birth: "Plovdiv",
        birth_date: "1994-03-12",
        gender: "male",
        id_address: "ul. Vasil Levski 5, 4000 Plovdiv",
        id_issued_on: -3630,
        id_expires_on: 20,
        licence_number: "B072RRE2I55",
        licence_classes: ["B", "C1"],
        licence_issued_on: -2900,
        licence_expires_on: 2400,
        street: "Hauptstraße 12",
        postcode: "76185",
        city: "Karlsruhe",
        tax_id: "12345678903",
        tax_class: 1,
        social_number: "12120394M005",
        health_insurer: "AOK Baden-Württemberg",
        health_number: "A123456780",
        criminal_record_issued_on: -40,
        bank_holder: "Courier A",
        iban: "DE89370400440532013000",
        phone: "+49 151 2345 6789",
        emergency_name: "Maria A",
        emergency_phone: "+359 88 123 4567",
      },
      "courier.c": {
        id_number: "T22000129",
        nationality: "Romanian",
        birth_date: "1990-11-02",
        gender: "female",
        id_issued_on: -1200,
        id_expires_on: 2400,
        tax_id: "98765432106",
        tax_class: 1,
        criminal_record_issued_on: -150,
        bank_holder: "Courier C",
        iban: "GB82WEST12345698765432",
      },
    },
  },
  {
    name: "Test Firm B",
    currency: "EUR",
    timeZone: "Europe/Berlin",
    depots: ["TFB1"],
    cars: ["B TF 100"],
    // The same VIN as Ivanov's first car: VINs are unique per firm only.
    papers: [{ vin: "ZFA250006SMC06228", tuvMonths: 8, insuranceDays: 90, serviceKmAhead: 20_000 }],
    rates: [{ month: -MONTHS_BACK, day: "01", hourlyMinor: 1200 }],
    overrides: {},
    depotsOf: {},
    details: { "courier.b": { phone: "+49 160 9876 5432", emergency_name: "Courier B Contact", emergency_phone: "+49 30 123456" } },
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

/** Members by role, e.g. { "org:courier": [{ id, identifier }] }, sorted by email: Clerk's own order isn't stable. */
async function membersOf(orgId) {
  const { data } = await clerk(`/organizations/${orgId}/memberships?limit=100`);
  const byRole = {};
  for (const m of data) {
    (byRole[m.role] ??= []).push({ id: m.public_user_data.user_id, identifier: m.public_user_data.identifier ?? "" });
  }
  for (const list of Object.values(byRole)) list.sort((a, b) => a.identifier.localeCompare(b.identifier));
  return byRole;
}

function todayIn(timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

/** A stable number in [0, 1) for the text (FNV-1a plus a murmur finalizer), so reruns give the same calendar. */
function rand(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 2 ** 32;
}

/** Calendar days from `from` up to but not including `to`, oldest first. */
function daysBetween(from, to) {
  const days = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) < to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** Weekdays minus about one in seven days off, plus every other Saturday (alternating between couriers). */
function worksOn(userId, c, date) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 0) return false;
  if (weekday === 6) return (Math.floor(Date.parse(`${date}T12:00:00Z`) / 604_800_000) + c) % 2 === 0;
  return rand(`off|${userId}|${date}`) >= 1 / 7;
}

for (const firm of firms) {
  const org = await findOrg(firm.name);
  const firmId = org.id;
  const members = await membersOf(firmId);
  const couriers = members["org:courier"] ?? [];
  const dispatchers = (members["org:dispatcher"] ?? []).map((m) => m.id);
  const owner = members["org:owner"]?.[0]?.id ?? null;
  const today = todayIn(firm.timeZone);
  const month = today.slice(0, 7);
  const lastMonth = addMonths(month, -1);

  await sql.transaction([
    sql`delete from shift_changes where firm_id = ${firmId}`,
    sql`delete from shift_photos where firm_id = ${firmId}`,
    sql`delete from shifts where firm_id = ${firmId}`,
    sql`delete from dispatcher_depots where firm_id = ${firmId}`,
    sql`delete from pay_rates where firm_id = ${firmId}`,
    sql`delete from courier_details where firm_id = ${firmId}`,
    sql`delete from document_photos where firm_id = ${firmId}`,
    sql`delete from car_photos where firm_id = ${firmId}`,
    sql`delete from cars where firm_id = ${firmId}`,
    sql`delete from depots where firm_id = ${firmId}`,
    sql`delete from firm_settings where firm_id = ${firmId}`,
    sql`insert into firm_settings (firm_id, currency, time_zone) values (${firmId}, ${firm.currency}, ${firm.timeZone})`,
  ]);
  // The firm's document and shift photos in R2 go with their rows; no photos are seeded.
  await deletePrefix(`firms/${firmId}/`);

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

  // Dispatchers manage the first two depots, so the last one (HBW7) is outside their reach.
  const managed = depots.slice(0, 2);
  for (const userId of dispatchers) {
    for (const depotId of managed) {
      await sql`insert into dispatcher_depots (firm_id, user_id, depot_id) values (${firmId}, ${userId}, ${depotId})`;
    }
  }
  // Reviews are signed by the first dispatcher when the depot is theirs, else by the owner.
  const reviewerFor = (depotIndex) =>
    dispatchers.length && depotIndex < managed.length ? dispatchers[0] : (owner ?? dispatchers[0] ?? null);

  // Rates are set by the owner (a placeholder ID for a firm without one).
  const setBy = owner ?? "seed";
  for (const rate of firm.rates) {
    await sql`
      insert into pay_rates (firm_id, user_id, effective_from, kind, amount_minor, set_by)
      values (${firmId}, null, ${`${addMonths(month, rate.month)}-${rate.day}`}, 'hourly', ${rate.hourlyMinor}, ${setBy})`;
  }
  for (const { id: userId, identifier } of couriers) {
    for (const rate of firm.overrides[identifier.split("+")[0]] ?? []) {
      await sql`
        insert into pay_rates (firm_id, user_id, effective_from, kind, amount_minor, set_by)
        values (${firmId}, ${userId}, ${`${addMonths(month, rate.month)}-${rate.day}`}, ${rate.kind}, ${rate.amountMinor}, ${setBy})`;
    }
  }

  // Documents, saved as if by the courier themselves. Column names are fixed text here, values are parameters.
  for (const { id: userId, identifier } of couriers) {
    const values = firm.details[identifier.split("+")[0]];
    if (!values) continue;
    const row = { firm_id: firmId, user_id: userId, updated_by: userId };
    for (const [column, value] of Object.entries(values)) {
      row[column] = column.endsWith("_on") ? addDays(today, value) : value;
    }
    const columns = Object.keys(row);
    const query = `insert into courier_details (${columns.join(", ")}) values (${columns.map((_, i) => `$${i + 1}`).join(", ")})`;
    await sql.query(query, Object.values(row));
  }

  // Which days each courier works, and each day's status.
  const days = daysBetween(`${addMonths(month, -MONTHS_BACK)}-01`, today);
  const plans = couriers.map(({ id: userId, identifier }, c) => {
    const depotChoices = firm.depotsOf[identifier.split("+")[0]] ?? depots.map((_, i) => i);
    const worked = days.filter((date) => worksOn(userId, c, date));
    const status = new Map(worked.map((date) => [date, "approved"]));
    // Current month, newest first: the newest two waiting, the fourth rejected for km.
    const current = worked.filter((d) => d.startsWith(month)).reverse();
    current.slice(0, 2).forEach((d) => status.set(d, "submitted"));
    if (current[3]) status.set(current[3], "rejected:km");
    // Last month: one rejected for packages and never fixed, one still waiting.
    const last = worked.filter((d) => d.startsWith(lastMonth));
    if (last.length > 2) {
      status.set(last[Math.floor(last.length / 2)], "rejected:packages");
      status.set(last[last.length - 2], "submitted");
    }
    // Two older approved shifts were corrected by a reviewer (end km).
    const corrected = new Set(
      [addMonths(month, -4), addMonths(month, -2)].map((m) => worked.find((d) => d.startsWith(m))).filter(Boolean),
    );
    return { userId, c, depotChoices, worked: new Set(worked), status, corrected, count: 0 };
  });

  // Day by day, so each car's odometer only grows.
  const odometer = cars.map((_, i) => 48_000 + i * 20_000);
  const inserts = [];
  const changes = [];
  for (const date of days) {
    for (const plan of plans) {
      if (!plan.worked.has(date)) continue;
      const { userId, c } = plan;
      const r = (key) => rand(`${key}|${userId}|${date}`);
      const depotIndex = plan.depotChoices[Math.floor(r("depot") * plan.depotChoices.length)];
      const carIndex = depotIndex % cars.length;
      const [status, reason] = plan.status.get(date).split(":");

      const startMinute = 345 + Math.floor(r("start") * 8) * 15; // 05:45–07:30 local
      const minutes = 390 + Math.floor(r("minutes") * 14) * 15; // 6:30–9:45
      const startedAt = new Date(zonedTime(date, startMinute, firm.timeZone));
      const finishedAt = new Date(startedAt.getTime() + minutes * 60_000);
      const reviewedAt = new Date(finishedAt.getTime() + (2 + c) * 3_600_000);
      const startKm = odometer[carIndex];
      const typedEndKm = startKm + 60 + Math.floor(r("km") * 40);
      const reviewer = status === "submitted" ? null : reviewerFor(depotIndex);
      // A correction needs someone to sign it: Test Firm B has no reviewers.
      const corrected = plan.corrected.has(date) && reviewer !== null;
      const endKm = corrected ? typedEndKm + 12 : typedEndKm;
      odometer[carIndex] = endKm + Math.floor(r("between") * 15);

      inserts.push(sql`
        insert into shifts (firm_id, user_id, date, status, depot_id, car_id, started_at, finished_at, minutes,
          start_km, end_km, loaded, returned, pickups, rejection_reasons, rejection_note, submitted_at, reviewed_at, reviewed_by)
        values (${firmId}, ${userId}, ${date}, ${status}, ${depots[depotIndex]}, ${cars[carIndex]},
          ${startedAt.toISOString()}, ${finishedAt.toISOString()}, ${minutes}, ${startKm}, ${endKm},
          ${120 + Math.floor(r("loaded") * 50)}, ${Math.floor(r("returned") * 9)}, ${Math.floor(r("pickups") * 4)},
          ${reason ? [reason] : null}, ${reason === "km" ? "Check the odometer photo." : null}, ${finishedAt.toISOString()},
          ${reviewer ? reviewedAt.toISOString() : null}, ${reviewer})`);
      if (corrected) {
        changes.push(sql`
          insert into shift_changes (firm_id, shift_id, changed_by, changed_at, field, old_value, new_value)
          select ${firmId}, id, ${reviewer}, ${new Date(reviewedAt.getTime() - 600_000).toISOString()}, 'endKm',
            ${String(typedEndKm)}, ${String(endKm)}
          from shifts where firm_id = ${firmId} and user_id = ${userId} and date = ${date}`);
      }
      plan.count++;
    }
  }
  const queries = [...inserts, ...changes];
  for (let i = 0; i < queries.length; i += 200) await sql.transaction(queries.slice(i, i + 200));

  // Papers last, so the service km can sit just ahead of each car's odometer (its highest submitted end km).
  for (const [i, papers] of firm.papers.entries()) {
    if (!papers) continue;
    await sql`
      update cars set vin = ${papers.vin}, tuv_due_on = ${lastDayOfMonth(addMonths(month, papers.tuvMonths))},
        insurance_expires_on = ${addDays(today, papers.insuranceDays)},
        service_due_km = coalesce((select max(end_km) from shifts where firm_id = ${firmId} and car_id = ${cars[i]}
          and status in ('submitted', 'approved')), 0) + ${papers.serviceKmAhead},
        papers_updated_at = now()
      where id = ${cars[i]}`;
  }

  const perCourier = couriers.map((m, i) => `${m.identifier.split("+")[0]} ${plans[i].count}`).join(", ");
  console.log(
    `${firm.name}: ${depots.length} depots, ${cars.length} cars, ${dispatchers.length} dispatchers, ` +
      `${inserts.length} shifts since ${days[0]} (${perCourier}), ${changes.length} corrected.`,
  );
}
