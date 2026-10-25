// An owner's depots and cars. Every query filters by the owner's firm; rows of other firms behave as missing.
// Nothing is deleted: archiving sets `archived_at`, restoring clears it, and shifts keep pointing at both.
import { and, eq, exists, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { cars, depots } from "@/db/schema";
import type { CarCreate } from "@/domain/fleet";
import type { ApiErrorCode, Fleet, FleetCar, FleetDepot } from "@/domain/types";

type Result<T> = T | ApiErrorCode;

const depotColumns = { id: depots.id, name: depots.name, archivedAt: depots.archivedAt };
const carColumns = { id: cars.id, plate: cars.plate, depotId: cars.depotId, archivedAt: cars.archivedAt };

function toCar(row: { id: string; plate: string; depotId: string; archivedAt: Date | null }): FleetCar {
  return { id: row.id, plate: row.plate, depotId: row.depotId, archived: row.archivedAt !== null };
}

/** True for a unique-index violation, which a concurrent write with the same name or plate can still cause. */
function isUniqueViolation(error: unknown): boolean {
  const code = (e: unknown) => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined);
  return code(error) === "23505" || (error instanceof Error && code(error.cause) === "23505");
}

async function uniqueWrite<T>(write: () => Promise<T>): Promise<T | "taken"> {
  try {
    return await write();
  } catch (error) {
    if (isUniqueViolation(error)) return "taken";
    throw error;
  }
}

const activeDepot = (firmId: string, depotId: string) =>
  and(eq(depots.id, depotId), eq(depots.firmId, firmId), isNull(depots.archivedAt));

export async function fleetOf(firmId: string): Promise<Fleet> {
  const [depotRows, carRows] = await Promise.all([
    db.select(depotColumns).from(depots).where(eq(depots.firmId, firmId)).orderBy(sql`lower(${depots.name})`),
    db.select(carColumns).from(cars).where(eq(cars.firmId, firmId)).orderBy(cars.plate),
  ]);
  return {
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

async function carOf(firmId: string, id: string): Promise<FleetCar | null> {
  const [row] = await db
    .select(carColumns)
    .from(cars)
    .where(and(eq(cars.id, id), eq(cars.firmId, firmId)));
  return row ? toCar(row) : null;
}

export async function createCar(firmId: string, { plate, depotId }: CarCreate): Promise<Result<FleetCar>> {
  const [depot] = await db.select({ id: depots.id }).from(depots).where(activeDepot(firmId, depotId));
  if (!depot) return "invalid";
  if (await plateTaken(firmId, plate)) return "taken";
  const rows = await uniqueWrite(() => db.insert(cars).values({ firmId, plate, depotId }).returning(carColumns));
  return rows === "taken" ? rows : toCar(rows[0]);
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
      .returning(carColumns),
  );
  if (rows === "taken") return rows;
  return rows[0] ? toCar(rows[0]) : "invalid";
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
    .returning(carColumns);
  return rows[0] ? toCar(rows[0]) : "invalid";
}
