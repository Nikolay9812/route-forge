// Vehicle check photos of a shift. Callers check the shift first (the courier's own through `ownShift`, a reviewer's
// through `shiftInScope`), so every query here is by firm and that shift. Keys and URLs are never logged.
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { shiftPhotos } from "@/db/schema";
import {
  isPhotoKey,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  parseShiftPhotoConfirm,
  parseShiftPhotoQuery,
  parseShiftPhotoRequest,
  shiftPhotoExpired,
  shiftPhotoPrefix,
  type PhotoType,
} from "@/domain/photos";
import type { Shift, ShiftPhotos, ShiftPhotoSlot, ShiftPhotoState } from "@/domain/types";

import { apiError, readJson } from "./auth";
import { deleteObject, keepUpload, presignGet, presignPut } from "./storage";

/**
 * The shift's photos: the live ones with an hour-long signed URL each, and the slots whose photo is past
 * `SHIFT_PHOTO_DAYS` (the bucket's lifecycle rule deletes the file; the row stays, so counts don't change).
 */
export async function shiftPhotoState(firmId: string, shiftId: string): Promise<ShiftPhotoState> {
  const rows = await db
    .select({ slot: shiftPhotos.slot, objectKey: shiftPhotos.objectKey, uploadedAt: shiftPhotos.uploadedAt })
    .from(shiftPhotos)
    .where(and(eq(shiftPhotos.firmId, firmId), eq(shiftPhotos.shiftId, shiftId)));
  const now = new Date();
  const live = rows.filter((row) => !shiftPhotoExpired(row.uploadedAt, now));
  const urls = await Promise.all(live.map((row) => presignGet(row.objectKey)));
  return {
    photos: Object.fromEntries(live.map((row, i) => [row.slot, { key: row.objectKey, url: urls[i] }])),
    expiredPhotos: rows.filter((row) => shiftPhotoExpired(row.uploadedAt, now)).map((row) => row.slot as ShiftPhotoSlot),
  };
}

/** The shift's live photos with an hour-long signed URL each. */
export async function photosOfShift(firmId: string, shiftId: string): Promise<ShiftPhotos> {
  return (await shiftPhotoState(firmId, shiftId)).photos;
}

function slotRow(firmId: string, shiftId: string, slot: ShiftPhotoSlot) {
  return and(eq(shiftPhotos.firmId, firmId), eq(shiftPhotos.shiftId, shiftId), eq(shiftPhotos.slot, slot));
}

/** The courier, their shift, and who is uploading; the shift is already checked to be theirs. */
type Owner = { firmId: string; userId: string; shiftId: string };

/**
 * Keeps an uploaded photo: the key must be one this slot hands out and the file must exist, be an allowed size
 * and type. The slot's previous file is deleted. False when any of that fails (the rejected file is deleted too).
 */
async function confirmShiftPhoto({ firmId, userId, shiftId }: Owner, slot: ShiftPhotoSlot, key: string) {
  if (!isPhotoKey(key, shiftPhotoPrefix(firmId, userId, shiftId, slot))) return false;
  const object = await keepUpload(key);
  if (!object) return false;
  if (object.size === 0 || object.size > PHOTO_MAX_BYTES || !PHOTO_TYPES.includes(object.contentType as PhotoType)) {
    await deleteObject(key);
    return false;
  }
  const [previous] = await db.select().from(shiftPhotos).where(slotRow(firmId, shiftId, slot));
  const set = {
    objectKey: key,
    contentType: object.contentType as PhotoType,
    size: object.size,
    uploadedBy: userId,
    uploadedAt: new Date(),
  };
  await db
    .insert(shiftPhotos)
    .values({ firmId, shiftId, userId, slot, ...set })
    .onConflictDoUpdate({ target: [shiftPhotos.firmId, shiftPhotos.shiftId, shiftPhotos.slot], set });
  if (previous && previous.objectKey !== key) await deleteObject(previous.objectKey);
  return true;
}

/**
 * The photo routes of one of the courier's own shifts: `POST { slot, contentType }` → `{ key, uploadUrl }`;
 * `PUT { slot, key }` and `DELETE ?slot=` → the shift's updated photos. Only a draft or rejected shift changes.
 */
export async function shiftPhotoRoute(request: Request, { firmId, userId }: { firmId: string; userId: string }, shift: Shift) {
  if (shift.status !== "draft" && shift.status !== "rejected") return apiError("notEditable");
  const owner = { firmId, userId, shiftId: shift.id };
  switch (request.method) {
    case "POST": {
      const body = parseShiftPhotoRequest(await readJson(request));
      if (!body.ok) return apiError("invalid");
      const { slot, contentType } = body.value;
      const key = shiftPhotoPrefix(firmId, userId, shift.id, slot) + crypto.randomUUID();
      return Response.json({ key, uploadUrl: await presignPut(key, contentType) });
    }
    case "PUT": {
      const body = parseShiftPhotoConfirm(await readJson(request));
      if (!body.ok) return apiError("invalid");
      if (!(await confirmShiftPhoto(owner, body.value.slot, body.value.key))) return apiError("invalid");
      break;
    }
    default: {
      const query = parseShiftPhotoQuery(new URL(request.url).searchParams);
      if (!query.ok) return apiError("invalid");
      // Removing an empty slot is fine.
      const [row] = await db.delete(shiftPhotos).where(slotRow(firmId, shift.id, query.value.slot)).returning();
      if (row) await deleteObject(row.objectKey);
    }
  }
  return Response.json(await photosOfShift(firmId, shift.id));
}
