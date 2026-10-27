// The cars as a mechanic sees them: every active car of the firm with its papers and talon (read-only), the vehicle
// check photos of the last 7 days with who drove, and the latest service log notes. Never shift times, km driven,
// packages, statuses or pay. Every query filters by the session's firm; other firms' rows behave as missing.
import { and, desc, eq, gte, inArray, lte, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { carNotes, cars, depots, shiftPhotos, shifts } from "@/db/schema";
import { garageFrom } from "@/domain/car-notes";
import { carWarnings } from "@/domain/fleet";
import { EXPECTED_SHIFT_PHOTOS } from "@/domain/photos";
import type { Garage, GarageCarDetail, GarageCheck } from "@/domain/types";

import { userNames } from "./auth";
import { recentNotes } from "./car-notes";
import type { GarageContext } from "./context";
import { carDetail, fleetOf } from "./fleet";
import { photosOfShift } from "./shift-photos";

/** The firm's active depots with their active cars, sorted by name and plate. */
export async function garageOf(firmId: string, today: string): Promise<Garage> {
  const [fleet, lastNotes] = await Promise.all([
    fleetOf(firmId, today),
    db
      .select({ carId: carNotes.carId, last: max(carNotes.doneOn) })
      .from(carNotes)
      .where(eq(carNotes.firmId, firmId))
      .groupBy(carNotes.carId),
  ]);
  const lastNoteOn = new Map(lastNotes.map((n) => [n.carId, n.last]));
  return {
    today,
    depots: fleet.depots
      .filter((d) => !d.archived)
      .map((d) => ({
        id: d.id,
        name: d.name,
        cars: d.cars
          .filter((c) => !c.archived)
          .map((c) => ({
            id: c.id,
            plate: c.plate,
            odometerKm: c.odometerKm,
            warnings: carWarnings(c, today),
            lastNoteOn: lastNoteOn.get(c.id) ?? null,
          })),
      })),
  };
}

const photoCount = sql<number>`(select count(*)::int from ${shiftPhotos} where ${shiftPhotos.firmId} = ${shifts.firmId} and ${shiftPhotos.shiftId} = ${shifts.id} and ${inArray(shiftPhotos.slot, [...EXPECTED_SHIFT_PHOTOS])})`;

/** Shifts driven with this car from `garageFrom(today)` through today, newest first. */
function recentShifts(firmId: string, carId: string, today: string) {
  return and(eq(shifts.firmId, firmId), eq(shifts.carId, carId), gte(shifts.date, garageFrom(today)), lte(shifts.date, today));
}

/** One active car of the firm for a mechanic or owner, or null when it isn't one. */
export async function garageCar(ctx: GarageContext, carId: string): Promise<GarageCarDetail | null> {
  const { firmId, date: today } = ctx;
  const car = await carDetail(firmId, carId, today);
  if (!car || car.archived) return null;
  const [[depot], checks, notes] = await Promise.all([
    db.select({ name: depots.name }).from(depots).where(and(eq(depots.firmId, firmId), eq(depots.id, car.depotId))),
    db
      .select({ shiftId: shifts.id, date: shifts.date, userId: shifts.userId, photoCount })
      .from(shifts)
      .where(recentShifts(firmId, carId, today))
      .orderBy(desc(shifts.date), desc(shifts.startedAt)),
    recentNotes(ctx, carId),
  ]);
  const names = await userNames(checks.map((c) => c.userId));
  return {
    today,
    car: {
      id: car.id,
      plate: car.plate,
      depotName: depot?.name ?? "",
      papers: car.papers,
      odometerKm: car.odometerKm,
      warnings: carWarnings(car, today),
      photos: car.photos,
    },
    checks: checks.map((c) => ({
      shiftId: c.shiftId,
      date: c.date,
      courierName: names.get(c.userId) ?? "",
      photoCount: c.photoCount,
    })),
    notes,
  };
}

/** One vehicle check of an active firm car within the last 7 days, with signed photos; else null. */
export async function garageCheck({ firmId, date: today }: GarageContext, shiftId: string): Promise<GarageCheck | null> {
  const [row] = await db
    .select({ id: shifts.id, date: shifts.date, userId: shifts.userId, plate: cars.plate, archivedAt: cars.archivedAt })
    .from(shifts)
    .innerJoin(cars, and(eq(cars.id, shifts.carId), eq(cars.firmId, shifts.firmId)))
    .where(and(eq(shifts.firmId, firmId), eq(shifts.id, shiftId), gte(shifts.date, garageFrom(today)), lte(shifts.date, today)));
  if (!row || row.archivedAt) return null;
  const [names, photos] = await Promise.all([userNames([row.userId]), photosOfShift(firmId, row.id)]);
  return { shiftId: row.id, date: row.date, courierName: names.get(row.userId) ?? "", plate: row.plate, photos };
}
