// A car's registration certificate photo (the talon), owner-only. Callers check the car is the owner's firm's
// first, so every query here is by firm and that car. Keys and URLs are never logged.
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { carPhotos } from "@/db/schema";
import {
  carPhotoPrefix,
  isPhotoKey,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  parseCarPhotoConfirm,
  parseCarPhotoQuery,
  parseCarPhotoRequest,
  type PhotoType,
} from "@/domain/photos";
import type { CarPhotoSlot, DocumentPhoto } from "@/domain/types";

import { apiError, readJson } from "./auth";
import { deleteObject, headObject, presignGet, presignPut } from "./storage";

/** The car's stored photos with an hour-long signed URL each. */
export async function photosOfCar(firmId: string, carId: string): Promise<Partial<Record<CarPhotoSlot, DocumentPhoto>>> {
  const rows = await db
    .select({ slot: carPhotos.slot, objectKey: carPhotos.objectKey })
    .from(carPhotos)
    .where(and(eq(carPhotos.firmId, firmId), eq(carPhotos.carId, carId)));
  const urls = await Promise.all(rows.map((row) => presignGet(row.objectKey)));
  return Object.fromEntries(rows.map((row, i) => [row.slot, { key: row.objectKey, url: urls[i] }]));
}

function slotRow(firmId: string, carId: string, slot: CarPhotoSlot) {
  return and(eq(carPhotos.firmId, firmId), eq(carPhotos.carId, carId), eq(carPhotos.slot, slot));
}

/** The owner's firm, the checked car, and who is uploading. */
type Target = { firmId: string; userId: string; carId: string };

/**
 * Keeps an uploaded photo: the key must be one this slot hands out and the file must exist, be an allowed size
 * and type. The slot's previous file is deleted. False when any of that fails (the rejected file is deleted too).
 */
async function confirmCarPhoto({ firmId, userId, carId }: Target, slot: CarPhotoSlot, key: string) {
  if (!isPhotoKey(key, carPhotoPrefix(firmId, carId, slot))) return false;
  const object = await headObject(key);
  if (!object) return false;
  if (object.size === 0 || object.size > PHOTO_MAX_BYTES || !PHOTO_TYPES.includes(object.contentType as PhotoType)) {
    await deleteObject(key);
    return false;
  }
  const [previous] = await db.select().from(carPhotos).where(slotRow(firmId, carId, slot));
  const set = {
    objectKey: key,
    contentType: object.contentType as PhotoType,
    size: object.size,
    uploadedBy: userId,
    uploadedAt: new Date(),
  };
  await db
    .insert(carPhotos)
    .values({ firmId, carId, slot, ...set })
    .onConflictDoUpdate({ target: [carPhotos.firmId, carPhotos.carId, carPhotos.slot], set });
  if (previous && previous.objectKey !== key) await deleteObject(previous.objectKey);
  return true;
}

/**
 * The photo calls of one car: `POST { slot, contentType }` → `{ key, uploadUrl }`; `PUT { slot, key }` and
 * `DELETE ?slot=` → null once done (the route answers the car), or the error to return.
 */
export async function carPhotoChange(request: Request, target: Target): Promise<Response | null> {
  const { firmId, carId } = target;
  switch (request.method) {
    case "POST": {
      const body = parseCarPhotoRequest(await readJson(request));
      if (!body.ok) return apiError("invalid");
      const { slot, contentType } = body.value;
      const key = carPhotoPrefix(firmId, carId, slot) + crypto.randomUUID();
      return Response.json({ key, uploadUrl: await presignPut(key, contentType) });
    }
    case "PUT": {
      const body = parseCarPhotoConfirm(await readJson(request));
      if (!body.ok) return apiError("invalid");
      if (!(await confirmCarPhoto(target, body.value.slot, body.value.key))) return apiError("invalid");
      return null;
    }
    default: {
      const query = parseCarPhotoQuery(new URL(request.url).searchParams);
      if (!query.ok) return apiError("invalid");
      // Removing an empty slot is fine.
      const [row] = await db.delete(carPhotos).where(slotRow(firmId, carId, query.value.slot)).returning();
      if (row) await deleteObject(row.objectKey);
      return null;
    }
  }
}
