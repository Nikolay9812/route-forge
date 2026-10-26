// Couriers' personal documents: a courier's own row, and the owner's view of every courier. Every query filters by
// firm. This is personal data: nothing here is ever logged, and only couriers (own row) and owners reach it.
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { courierDetails } from "@/db/schema";
import { documentSummary, emptyDetails, sectionStates } from "@/domain/courier-details";
import type { CourierDetails, CourierDocuments, CourierDocumentsList } from "@/domain/types";

import { firmCouriers, userNames } from "./auth";

type Row = typeof courierDetails.$inferSelect;

function toDetails(row: Row | undefined): CourierDetails {
  if (!row) return emptyDetails;
  const details = { ...emptyDetails };
  for (const key of Object.keys(emptyDetails) as (keyof CourierDetails)[]) {
    (details as Record<string, unknown>)[key] = row[key];
  }
  return details;
}

async function rowOf(firmId: string, userId: string): Promise<Row | undefined> {
  const [row] = await db
    .select()
    .from(courierDetails)
    .where(and(eq(courierDetails.firmId, firmId), eq(courierDetails.userId, userId)));
  return row;
}

/** One courier's documents with each section's state; all fields null until their first save. */
export async function documentsOf(firmId: string, userId: string, today: string): Promise<CourierDocuments> {
  const [row, names] = await Promise.all([rowOf(firmId, userId), userNames([userId])]);
  const details = toDetails(row);
  return { userId, name: names.get(userId) ?? "", today, details, sections: sectionStates(details, today) };
}

/** Saves one section (the values already checked), creating the row on the first save. */
export async function saveDetails(
  firmId: string,
  userId: string,
  editorId: string,
  values: Partial<CourierDetails>,
): Promise<void> {
  const set = { ...values, updatedBy: editorId, updatedAt: new Date() };
  await db
    .insert(courierDetails)
    .values({ firmId, userId, ...set })
    .onConflictDoUpdate({ target: [courierDetails.firmId, courierDetails.userId], set });
}

/** The owner's Couriers list: every courier member plus anyone with documents in this firm, by name. */
export async function documentsList(firmId: string, today: string): Promise<CourierDocumentsList> {
  const [rows, members] = await Promise.all([
    db.select().from(courierDetails).where(eq(courierDetails.firmId, firmId)),
    firmCouriers(firmId),
  ]);
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  const userIds = [...new Set([...members, ...byUser.keys()])];
  const names = await userNames(userIds);
  const couriers = userIds
    .map((userId) => ({
      userId,
      name: names.get(userId) ?? "",
      ...documentSummary(toDetails(byUser.get(userId)), today),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { today, couriers };
}

/** A courier the owner may see: a courier member of this firm, or someone with documents in it already. */
export async function isFirmCourier(firmId: string, userId: string): Promise<boolean> {
  return Boolean(await rowOf(firmId, userId)) || (await firmCouriers(firmId)).includes(userId);
}
