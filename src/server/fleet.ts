// An owner's depots and cars, with each car's papers. Every query filters by the owner's firm; rows of other firms
// behave as missing. Nothing is deleted: archiving sets `archived_at`, restoring clears it, and shifts keep
// pointing at both.
import { and, eq, exists, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { carPhotos, cars, depots, shifts } from "@/db/schema";
import { lastDayOfMonth, type CarCreate } from "@/domain/fleet";
import type { ApiErrorCode, CarDetail, CarPapers, Fleet, FleetCar, FleetDepot } from "@/domain/types";

import { photosOfCar } from "./car-photos";

type Result<T> = T | ApiErrorCode;

const depotColumns = { id: depots.id, name: depots.name, archivedAt: depots.archivedAt };
const carColumns = {
  id: cars.id,
  plate: cars.plate,
  depotId: cars.depotId,
  archivedAt: cars.archivedAt,
  vin: cars.vin,
  tuvDueOn: cars.tuvDueOn,
  insuranceExpiresOn: cars.insuranceExpiresOn,
  serviceDueOn: cars.serviceDueOn,
  serviceDueKm: cars.serviceDueKm,
  papersUpdatedAt: cars.papersUpdatedAt,
  // Drizzle leaves column names unqualified in a one-table select, so the subqueries name the outer car in full.
  /** The car's km now: the highest end km a courier submitted for it (rejected and draft shifts don't count). */
  odometerKm: sql<number | null>`(select max(${shifts.endKm}) from ${shifts} where ${shifts.firmId} = "cars"."firm_id" and ${shifts.carId} = "cars"."id" and ${shifts.status} in ('submitted', 'approved'))`,
  hasTalon: sql<boolean>`exists (select 1 from ${carPhotos} where ${carPhotos.firmId} = "cars"."firm_id" and ${carPhotos.carId} = "cars"."id")`,
};

type CarRow = {
  id: string;
  plate: string;
  depotId: string;
  archivedAt: Date | null;
  vin: string | null;
  tuvDueOn: string | null;
  insuranceExpiresOn: string | null;
  serviceDueOn: string | null;
  serviceDueKm: number | null;
  papersUpdatedAt: Date | null;
  odometerKm: number | null;
  hasTalon: boolean;
};

function toCar(row: CarRow): FleetCar {
  return {
    id: row.id,
    plate: row.plate,
    depotId: row.depotId,
    archived: row.archivedAt !== null,
    papers: {
      vin: row.vin,
      tuvDue: row.tuvDueOn?.slice(0, 7) ?? null,
      insuranceExpiresOn: row.insuranceExpiresOn,
      serviceDueOn: row.serviceDueOn,
      serviceDueKm: row.serviceDueKm,
    },
    odometerKm: row.odometerKm === null ? null : Number(row.odometerKm),
    hasTalon: row.hasTalon,
  };
}

/** True for a unique-index violation, which a concurrent write with the same name, plate or rate day can still cause. */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined);
  return code(error) === "23505" || (error instanceof Error && code(error.cause) === "23505");
}

export async function uniqueWrite<T>(write: () => Promise<T>): Promise<T | "taken"> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) return "taken";
    throw error;
  }
}

const activeDepot = (firmId: string, depotId: string) =>
  and(eq(depots.id, depotId), eq(depots.firmId, firmId), isNull(depots.archivedAt));

export async function fleetOf(firmId: string, today: string): Promise<Fleet> {
  const [depotRows, carRows] = await Promise.all([
    db.select(depotColumns).from(depots).where(eq(depots.firmId, firmId)).orderBy(sql`lower(${depots.name})`),
    db.select(carColumns).from(cars).where(eq(cars.firmId, firmId)).orderBy(cars.plate),
  ]);
  return {
    today,
    depots: depotRows.map((d) => ({
      id: d.id,
      name: d.name,
      archived: d.archivedAt !== null,
      cars: carRows.filter((c) => c.depotId === d.id).map(toCar),
    })),
  };
}

async function depotOf(firmId: string, id: string): Promise<FleetDepot | null> {
  const [row] = await db
    .select(depotColumns)
    .from(depots)
    .where(and(eq(depots.id, id), eq(depots.firmId, firmId)));
  if (!row) return null;
  const carRows = await db
    .select(carColumns)
    .from(cars)
    .where(and(eq(cars.firmId, firmId), eq(cars.depotId, id)))
    .orderBy(cars.plate);
  return { id: row.id, name: row.name, archived: row.archivedAt !== null, cars: carRows.map(toCar) };
}

async function depotNameTaken(firmId: string, name: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: depots.id })
    .from(depots)
    .where(
      and(
        eq(depots.firmId, firmId),
        sql`lower(${depots.name}) = lower(${name})`,
        exceptId ? ne(depots.id, exceptId) : undefined,
      ),
    );
  return rows.length > 0;
}

async function plateTaken(firmId: string, plate: string, exceptId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: cars.id })
    .from(cars)
    .where(
      and(eq(cars.firmId, firmId), sql`upper(${cars.plate}) = ${plate}`, exceptId ? ne(cars.id, exceptId) : undefined),
    );
  return rows.length > 0;
}

export async function createDepot(firmId: string, name: string): Promise<Result<FleetDepot>> {
  if (await depotNameTaken(firmId, name)) return "taken";
  const row = await uniqueWrite(() => db.insert(depots).values({ firmId, name }).returning(depotColumns));
  if (row === "taken") return row;
  return { id: row[0].id, name: row[0].name, archived: false, cars: [] };
}

export async function renameDepot(firmId: string, id: string, name: string): Promise<Result<FleetDepot>> {
  if (!(await depotOf(firmId, id))) return "notFound";
  if (await depotNameTaken(firmId, name, id)) return "taken";
  const written = await uniqueWrite(() =>
    db
      .update(depots)
      .set({ name })
      .where(and(eq(depots.id, id), eq(depots.firmId, firmId))),
  );
  if (written === "taken") return written;
  return (await depotOf(firmId, id)) ?? "notFound";
}

/** Archiving is refused while the depot still has active cars, so an active car never sits in an archived depot. */
export async function setDepotArchived(firmId: string, id: string, archived: boolean): Promise<Result<FleetDepot>> {
  if (!(await depotOf(firmId, id))) return "notFound";
  const activeCars = db
    .select({ id: cars.id })
    .from(cars)
    .where(and(eq(cars.firmId, firmId), eq(cars.depotId, id), isNull(cars.archivedAt)));
  const updated = await db
    .update(depots)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(depots.id, id), eq(depots.firmId, firmId), archived ? sql`not ${exists(activeCars)}` : undefined))
    .returning({ id: depots.id });
  if (updated.length === 0) return "depotHasCars";
  return (await depotOf(firmId, id)) ?? "notFound";
}

async function carRow(firmId: string, id: string): Promise<CarRow | null> {
  const [row] = await db
    .select(carColumns)
    .from(cars)
    .where(and(eq(cars.id, id), eq(cars.firmId, firmId)));
  return row ?? null;
}

/** True when the car is one of this firm's (archived ones included). */
export async function isFirmCar(firmId: string, id: string): Promise<boolean> {
  const rows = await db
    .select({ id: cars.id })
    .from(cars)
    .where(and(eq(cars.id, id), eq(cars.firmId, firmId)));
  return rows.length > 0;
}

/** One car with its signed talon photo, or null when it isn't this firm's. `today` is the firm's. */
export async function carDetail(firmId: string, id: string, today: string): Promise<CarDetail | null> {
  const [row, photos] = await Promise.all([carRow(firmId, id), photosOfCar(firmId, id)]);
  if (!row) return null;
  return { ...toCar(row), photos, papersUpdatedAt: row.papersUpdatedAt?.toISOString() ?? null, today };
}

async function vinTaken(firmId: string, vin: string, exceptId: string): Promise<boolean> {
  const rows = await db
    .select({ id: cars.id })
    .from(cars)
    .where(and(eq(cars.firmId, firmId), eq(cars.vin, vin), ne(cars.id, exceptId)));
  return rows.length > 0;
}

/** Saves the papers as a whole and who saved them; a VIN another car of the firm has is `taken`. */
export async function saveCarPapers(
  { firmId, userId, today }: { firmId: string; userId: string; today: string },
  id: string,
  papers: CarPapers,
): Promise<Result<CarDetail>> {
  if (!(await isFirmCar(firmId, id))) return "notFound";
  if (papers.vin && (await vinTaken(firmId, papers.vin, id))) return "taken";
  const written = await uniqueWrite(() =>
    db
      .update(cars)
      .set({
        vin: papers.vin,
        tuvDueOn: papers.tuvDue ? lastDayOfMonth(papers.tuvDue) : null,
        insuranceExpiresOn: papers.insuranceExpiresOn,
        serviceDueOn: papers.serviceDueOn,
        serviceDueKm: papers.serviceDueKm,
        papersUpdatedBy: userId,
        papersUpdatedAt: new Date(),
      })
      .where(and(eq(cars.id, id), eq(cars.firmId, firmId))),
  );
  if (written === "taken") return written;
  return (await carDetail(firmId, id, today)) ?? "notFound";
}

async function carOf(firmId: string, id: string): Promise<FleetCar | null> {
  const row = await carRow(firmId, id);
  return row ? toCar(row) : null;
}

export async function createCar(firmId: string, { plate, depotId }: CarCreate): Promise<Result<FleetCar>> {
  const [depot] = await db.select({ id: depots.id }).from(depots).where(activeDepot(firmId, depotId));
  if (!depot) return "invalid";
  if (await plateTaken(firmId, plate)) return "taken";
  const rows = await uniqueWrite(() => db.insert(cars).values({ firmId, plate, depotId }).returning({ id: cars.id }));
  if (rows === "taken") return rows;
  return (await carOf(firmId, rows[0].id)) ?? "notFound";
}

/** A new plate and/or depot. The depot must be an active one of this firm. */
export async function updateCar(
  firmId: string,
  id: string,
  change: { plate?: string; depotId?: string },
): Promise<Result<FleetCar>> {
  if (!(await carOf(firmId, id))) return "notFound";
  if (change.plate && (await plateTaken(firmId, change.plate, id))) return "taken";
  const depotOk = change.depotId
    ? exists(db.select({ id: depots.id }).from(depots).where(activeDepot(firmId, change.depotId)))
    : undefined;
  const rows = await uniqueWrite(() =>
    db
      .update(cars)
      .set(change)
      .where(and(eq(cars.id, id), eq(cars.firmId, firmId), depotOk))
      .returning({ id: cars.id }),
  );
  if (rows === "taken") return rows;
  return rows[0] ? ((await carOf(firmId, id)) ?? "notFound") : "invalid";
}

/** Restoring is refused while the car's depot is archived. */
export async function setCarArchived(firmId: string, id: string, archived: boolean): Promise<Result<FleetCar>> {
  if (!(await carOf(firmId, id))) return "notFound";
  const depotActive = exists(
    db
      .select({ id: depots.id })
      .from(depots)
      .where(and(eq(depots.id, cars.depotId), eq(depots.firmId, firmId), isNull(depots.archivedAt))),
  );
  const rows = await db
    .update(cars)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(cars.id, id), eq(cars.firmId, firmId), archived ? undefined : depotActive))
    .returning({ id: cars.id });
  return rows[0] ? ((await carOf(firmId, id)) ?? "notFound") : "invalid";
}
