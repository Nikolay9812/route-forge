// The service log: notes a mechanic or the owner writes about work on a car. Every query filters by the session's
// firm. The author may change or delete a note for 7 days; the owner may delete any. Deleting removes the note's
// photos from R2 too (notes aren't salary history). Keys and URLs are never logged.
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { carNotePhotos, carNotes, cars } from "@/db/schema";
import { canEditNote, NOTE_PAGE, noteCursor, parseCursor, type NoteFilter } from "@/domain/car-notes";
import {
  carNotePhotoPrefix,
  isPhotoKey,
  PHOTO_MAX_BYTES,
  PHOTO_TYPES,
  parseCarNotePhotoConfirm,
  parseCarNotePhotoQuery,
  parseCarNotePhotoRequest,
  type PhotoType,
} from "@/domain/photos";
import type { ApiErrorCode, CarNote, CarNoteInput, CarNotePhotoSlot, CarNotesPage, CarNoteType, DocumentPhoto } from "@/domain/types";

import { apiError, readJson, userNames } from "./auth";
import type { GarageContext } from "./context";
import { deleteObject, deletePrefix, headObject, presignGet, presignPut } from "./storage";

type Result<T> = T | ApiErrorCode;
type Viewer = Pick<GarageContext, "firmId" | "userId" | "role" | "date">;

/** Notes are ordered and paged by the day of the work, then when they were written (to the millisecond), then ID. */
const createdMs = sql`date_trunc('milliseconds', ${carNotes.createdAt})`;

const noteColumns = {
  id: carNotes.id,
  carId: carNotes.carId,
  plate: cars.plate,
  type: carNotes.type,
  doneOn: carNotes.doneOn,
  km: carNotes.km,
  text: carNotes.text,
  createdBy: carNotes.createdBy,
  createdAt: carNotes.createdAt,
  updatedAt: carNotes.updatedAt,
  photoCount: sql<number>`(select count(*)::int from ${carNotePhotos} where ${carNotePhotos.firmId} = ${carNotes.firmId} and ${carNotePhotos.noteId} = ${carNotes.id})`,
};

type NoteRow = {
  id: string;
  carId: string;
  plate: string;
  type: string;
  doneOn: string;
  km: number | null;
  text: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  photoCount: number;
};

/** Notes with their car's plate; callers filter by firm. */
function notesQuery() {
  return db
    .select(noteColumns)
    .from(carNotes)
    .innerJoin(cars, and(eq(cars.id, carNotes.carId), eq(cars.firmId, carNotes.firmId)))
    .$dynamic();
}

const newestFirst = [desc(carNotes.doneOn), desc(createdMs), desc(carNotes.id)] as const;

async function toNotes(viewer: Viewer, rows: NoteRow[]): Promise<CarNote[]> {
  const names = await userNames(rows.map((r) => r.createdBy));
  return rows.map((row) => {
    const createdAt = row.createdAt.toISOString();
    const canEdit = canEditNote({ createdBy: row.createdBy, createdAt }, viewer.userId);
    return {
      id: row.id,
      carId: row.carId,
      plate: row.plate,
      type: row.type as CarNoteType,
      doneOn: row.doneOn,
      km: row.km,
      text: row.text,
      byName: names.get(row.createdBy) ?? "",
      createdAt,
      edited: row.updatedAt.getTime() !== row.createdAt.getTime(),
      canEdit,
      canDelete: canEdit || viewer.role === "owner",
      photoCount: row.photoCount,
    };
  });
}

/** A page of the firm's service log, newest first, plus every firm car for the filter. */
export async function notesPage(viewer: Viewer, filter: NoteFilter): Promise<CarNotesPage> {
  const cursor = filter.before ? parseCursor(filter.before) : null;
  const [rows, carRows] = await Promise.all([
    notesQuery()
      .where(
        and(
          eq(carNotes.firmId, viewer.firmId),
          filter.carId ? eq(carNotes.carId, filter.carId) : undefined,
          filter.type ? eq(carNotes.type, filter.type) : undefined,
          cursor
            ? sql`(${carNotes.doneOn}, ${createdMs}, ${carNotes.id}) < (${cursor.doneOn}::date, ${cursor.createdAt}::timestamptz, ${cursor.id}::uuid)`
            : undefined,
        ),
      )
      .orderBy(...newestFirst)
      .limit(NOTE_PAGE + 1),
    db.select({ id: cars.id, plate: cars.plate }).from(cars).where(eq(cars.firmId, viewer.firmId)).orderBy(cars.plate),
  ]);
  const notes = await toNotes(viewer, rows.slice(0, NOTE_PAGE));
  const last = notes.at(-1);
  return { today: viewer.date, notes, next: rows.length > NOTE_PAGE && last ? noteCursor(last) : null, cars: carRows };
}

/** The car's latest five notes. */
export async function recentNotes(viewer: Viewer, carId: string): Promise<CarNote[]> {
  const rows = await notesQuery()
    .where(and(eq(carNotes.firmId, viewer.firmId), eq(carNotes.carId, carId)))
    .orderBy(...newestFirst)
    .limit(5);
  return toNotes(viewer, rows);
}

async function photosOfNote(firmId: string, noteId: string): Promise<Partial<Record<CarNotePhotoSlot, DocumentPhoto>>> {
  const rows = await db
    .select({ slot: carNotePhotos.slot, objectKey: carNotePhotos.objectKey })
    .from(carNotePhotos)
    .where(and(eq(carNotePhotos.firmId, firmId), eq(carNotePhotos.noteId, noteId)));
  const urls = await Promise.all(rows.map((row) => presignGet(row.objectKey)));
  return Object.fromEntries(rows.map((row, i) => [row.slot, { key: row.objectKey, url: urls[i] }]));
}

/** One note of the firm with its signed photos, or null. */
export async function noteDetail(viewer: Viewer, id: string): Promise<CarNote | null> {
  const [row] = await notesQuery().where(and(eq(carNotes.firmId, viewer.firmId), eq(carNotes.id, id)));
  if (!row) return null;
  const [[note], photos] = await Promise.all([toNotes(viewer, [row]), photosOfNote(viewer.firmId, id)]);
  return { ...note, photos };
}

/** Adds a note to an active car of the firm. A car of another firm is `notFound`, an archived one `invalid`. */
export async function createNote(viewer: Viewer, input: CarNoteInput & { carId: string }): Promise<Result<CarNote>> {
  const [car] = await db
    .select({ id: cars.id, archivedAt: cars.archivedAt })
    .from(cars)
    .where(and(eq(cars.firmId, viewer.firmId), eq(cars.id, input.carId)));
  if (!car) return "notFound";
  if (car.archivedAt) return "invalid";
  const [row] = await db
    .insert(carNotes)
    .values({ firmId: viewer.firmId, ...input, createdBy: viewer.userId, updatedBy: viewer.userId })
    .returning({ id: carNotes.id });
  return (await noteDetail(viewer, row.id)) ?? "notFound";
}

async function noteRow(firmId: string, id: string) {
  const [row] = await db
    .select({ id: carNotes.id, carId: carNotes.carId, createdBy: carNotes.createdBy, createdAt: carNotes.createdAt })
    .from(carNotes)
    .where(and(eq(carNotes.firmId, firmId), eq(carNotes.id, id)));
  return row ?? null;
}

/** The note when the viewer may still change it; `notFound` outside the firm, `notEditable` after 7 days or for others. */
async function editableNote(viewer: Viewer, id: string) {
  const row = await noteRow(viewer.firmId, id);
  if (!row) return "notFound" as const;
  if (!canEditNote({ createdBy: row.createdBy, createdAt: row.createdAt.toISOString() }, viewer.userId)) return "notEditable" as const;
  return row;
}

/** Saves the note whole (the car stays). */
export async function updateNote(viewer: Viewer, id: string, input: CarNoteInput): Promise<Result<CarNote>> {
  const row = await editableNote(viewer, id);
  if (typeof row === "string") return row;
  await db
    .update(carNotes)
    .set({ ...input, updatedBy: viewer.userId, updatedAt: new Date() })
    .where(and(eq(carNotes.firmId, viewer.firmId), eq(carNotes.id, id)));
  return (await noteDetail(viewer, id)) ?? "notFound";
}

/** Deletes the note, its photo rows and files: its author within 7 days, or the owner at any time. */
export async function deleteNote(viewer: Viewer, id: string): Promise<Result<null>> {
  const row = await noteRow(viewer.firmId, id);
  if (!row) return "notFound";
  const mine = canEditNote({ createdBy: row.createdBy, createdAt: row.createdAt.toISOString() }, viewer.userId);
  if (!mine && viewer.role !== "owner") return "notEditable";
  await db.batch([
    db.delete(carNotePhotos).where(and(eq(carNotePhotos.firmId, viewer.firmId), eq(carNotePhotos.noteId, id))),
    db.delete(carNotes).where(and(eq(carNotes.firmId, viewer.firmId), eq(carNotes.id, id))),
  ]);
  await deletePrefix(`firms/${viewer.firmId}/cars/${row.carId}/notes/${id}/`);
  return null;
}

function slotRow(firmId: string, noteId: string, slot: CarNotePhotoSlot) {
  return and(eq(carNotePhotos.firmId, firmId), eq(carNotePhotos.noteId, noteId), eq(carNotePhotos.slot, slot));
}

/**
 * Keeps an uploaded photo: the key must be one this slot hands out and the file must exist, be an allowed size
 * and type. The slot's previous file is deleted. False when any of that fails (the rejected file is deleted too).
 */
async function confirmNotePhoto(viewer: Viewer, note: { id: string; carId: string }, slot: CarNotePhotoSlot, key: string) {
  const { firmId, userId } = viewer;
  if (!isPhotoKey(key, carNotePhotoPrefix(firmId, note.carId, note.id, slot))) return false;
  const object = await headObject(key);
  if (!object) return false;
  if (object.size === 0 || object.size > PHOTO_MAX_BYTES || !PHOTO_TYPES.includes(object.contentType as PhotoType)) {
    await deleteObject(key);
    return false;
  }
  const [previous] = await db.select().from(carNotePhotos).where(slotRow(firmId, note.id, slot));
  const set = {
    objectKey: key,
    contentType: object.contentType as PhotoType,
    size: object.size,
    uploadedBy: userId,
    uploadedAt: new Date(),
  };
  await db
    .insert(carNotePhotos)
    .values({ firmId, noteId: note.id, slot, ...set })
    .onConflictDoUpdate({ target: [carNotePhotos.firmId, carNotePhotos.noteId, carNotePhotos.slot], set });
  if (previous && previous.objectKey !== key) await deleteObject(previous.objectKey);
  return true;
}

/**
 * The photo calls of one note, for its author within 7 days: `POST { slot, contentType }` → `{ key, uploadUrl }`;
 * `PUT { slot, key }` and `DELETE ?slot=` → the note with its photos.
 */
export async function notePhotoRoute(request: Request, viewer: Viewer, id: string): Promise<Response> {
  const note = await editableNote(viewer, id);
  if (typeof note === "string") return apiError(note);
  switch (request.method) {
    case "POST": {
      const body = parseCarNotePhotoRequest(await readJson(request));
      if (!body.ok) return apiError("invalid");
      const { slot, contentType } = body.value;
      const key = carNotePhotoPrefix(viewer.firmId, note.carId, note.id, slot) + crypto.randomUUID();
      return Response.json({ key, uploadUrl: await presignPut(key, contentType) });
    }
    case "PUT": {
      const body = parseCarNotePhotoConfirm(await readJson(request));
      if (!body.ok) return apiError("invalid");
      if (!(await confirmNotePhoto(viewer, note, body.value.slot, body.value.key))) return apiError("invalid");
      break;
    }
    default: {
      const query = parseCarNotePhotoQuery(new URL(request.url).searchParams);
      if (!query.ok) return apiError("invalid");
      // Removing an empty slot is fine.
      const [row] = await db.delete(carNotePhotos).where(slotRow(viewer.firmId, note.id, query.value.slot)).returning();
      if (row) await deleteObject(row.objectKey);
    }
  }
  const detail = await noteDetail(viewer, id);
  return detail ? Response.json(detail) : apiError("notFound");
}
