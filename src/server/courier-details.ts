// Couriers' personal documents: a courier's own row, and the owner's view of every courier. Every query filters by
// firm. This is personal data: nothing here is ever logged, and only couriers (own row) and owners reach it.
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { courierDetails, documentPhotos } from "@/db/schema";
import { documentSummary, emptyDetails, sectionStates } from "@/domain/courier-details";
import {
  isPhotoKey,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  parsePhotoConfirm,
  parsePhotoQuery,
  parsePhotoRequest,
  photoPrefix,
  type PhotoTarget,
  type PhotoType,
} from "@/domain/photos";
import type { CourierDetails, CourierDocuments, CourierDocumentsList, DetailsSection, DocumentPhotos, PhotoSlot } from "@/domain/types";

import { apiError, firmCouriers, readJson, userNames } from "./auth";
import { memberIds } from "./people";
import { deleteObject, headObject, presignGet, presignPut } from "./storage";

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
  const [row, names, photos] = await Promise.all([rowOf(firmId, userId), userNames([userId]), photosOf(firmId, userId)]);
  const details = toDetails(row);
  return { userId, name: names.get(userId) ?? "", today, details, sections: sectionStates(details, today), photos };
}

function photoRows(firmId: string, userId: string) {
  return db
    .select()
    .from(documentPhotos)
    .where(and(eq(documentPhotos.firmId, firmId), eq(documentPhotos.userId, userId)));
}

/** The courier's stored photos with an hour-long signed URL each. */
async function photosOf(firmId: string, userId: string): Promise<DocumentPhotos> {
  const rows = await photoRows(firmId, userId);
  // Sign every URL first, then fill the map: merging while awaiting would let one slot overwrite another.
  const urls = await Promise.all(rows.map((row) => presignGet(row.objectKey)));
  const photos: DocumentPhotos = {};
  rows.forEach((row, i) => {
    const section = row.section as DetailsSection;
    photos[section] = { ...photos[section], [row.slot as PhotoSlot]: { key: row.objectKey, url: urls[i] } };
  });
  return photos;
}

function slotRow(firmId: string, userId: string, { section, slot }: PhotoTarget) {
  return and(
    eq(documentPhotos.firmId, firmId),
    eq(documentPhotos.userId, userId),
    eq(documentPhotos.section, section),
    eq(documentPhotos.slot, slot),
  );
}

/** A fresh key for the slot and a 5-minute URL to upload the photo to; nothing is stored until it's confirmed. */
export async function startPhoto(firmId: string, userId: string, target: PhotoTarget, contentType: PhotoType) {
  const key = photoPrefix(firmId, userId, target) + crypto.randomUUID();
  return { key, uploadUrl: await presignPut(key, contentType) };
}

/**
 * Keeps an uploaded photo: the key must be one this slot hands out and the file must exist, be an allowed size
 * and have been uploaded with a type. The slot's previous file is deleted. False when any of that fails (the
 * rejected file is deleted too).
 */
export async function confirmPhoto(
  firmId: string,
  userId: string,
  editorId: string,
  target: PhotoTarget,
  key: string,
): Promise<boolean> {
  if (!isPhotoKey(key, photoPrefix(firmId, userId, target))) return false;
  const object = await headObject(key);
  if (!object) return false;
  if (object.size === 0 || object.size > PHOTO_MAX_BYTES || !PHOTO_TYPES.includes(object.contentType as PhotoType)) {
    await deleteObject(key);
    return false;
  }
  const [previous] = await db.select().from(documentPhotos).where(slotRow(firmId, userId, target));
  const set = {
    objectKey: key,
    contentType: object.contentType as PhotoType,
    size: object.size,
    uploadedBy: editorId,
    uploadedAt: new Date(),
  };
  await db
    .insert(documentPhotos)
    .values({ firmId, userId, ...target, ...set })
    .onConflictDoUpdate({
      target: [documentPhotos.firmId, documentPhotos.userId, documentPhotos.section, documentPhotos.slot],
      set,
    });
  if (previous && previous.objectKey !== key) await deleteObject(previous.objectKey);
  return true;
}

/**
 * The photo routes for one courier, once the caller may work on them (the courier themselves, or the owner):
 * `POST { section, slot, contentType }` → `{ key, uploadUrl }`; `PUT { section, slot, key }` and
 * `DELETE ?section=&slot=` → the updated documents.
 */
export async function photoRoute(
  request: Request,
  { firmId, userId, editorId, today }: { firmId: string; userId: string; editorId: string; today: string },
): Promise<Response> {
  switch (request.method) {
    case "POST": {
      const body = parsePhotoRequest(await readJson(request));
      if (!body.ok) return apiError("invalid");
      const { contentType, ...target } = body.value;
      return Response.json(await startPhoto(firmId, userId, target, contentType));
    }
    case "PUT": {
      const body = parsePhotoConfirm(await readJson(request));
      if (!body.ok) return apiError("invalid");
      const { key, ...target } = body.value;
      if (!(await confirmPhoto(firmId, userId, editorId, target, key))) return apiError("invalid");
      break;
    }
    default: {
      const query = parsePhotoQuery(new URL(request.url).searchParams);
      if (!query.ok) return apiError("invalid");
      await removePhoto(firmId, userId, query.value);
    }
  }
  return Response.json(await documentsOf(firmId, userId, today));
}

/** Removes the slot's photo, the file and its row; removing an empty slot is fine. */
export async function removePhoto(firmId: string, userId: string, target: PhotoTarget): Promise<void> {
  const [row] = await db.delete(documentPhotos).where(slotRow(firmId, userId, target)).returning();
  if (row) await deleteObject(row.objectKey);
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
  const [rows, members, everyone] = await Promise.all([
    db.select().from(courierDetails).where(eq(courierDetails.firmId, firmId)),
    firmCouriers(firmId),
    memberIds(firmId),
  ]);
  const byUser = new Map(rows.map((r) => [r.userId, r]));
  const userIds = [...new Set([...members, ...byUser.keys()])];
  const names = await userNames(userIds);
  const couriers = userIds
    .map((userId) => ({
      userId,
      name: names.get(userId) ?? "",
      ...documentSummary(toDetails(byUser.get(userId)), today),
      former: !everyone.has(userId),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { today, couriers };
}

/** A courier the owner may see: a courier member of this firm, or someone with documents in it already. */
export async function isFirmCourier(firmId: string, userId: string): Promise<boolean> {
  return Boolean(await rowOf(firmId, userId)) || (await firmCouriers(firmId)).includes(userId);
}
