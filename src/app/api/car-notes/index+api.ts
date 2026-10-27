// The firm's service log: read a page (filtered by car and type) or add a note to an active car. Mechanics and
// owners only.
import { parseCarNoteCreate, parseNoteFilter } from "@/domain/car-notes";
import { apiError, handle, readJson } from "@/server/auth";
import { createNote, notesPage } from "@/server/car-notes";
import { garageContext } from "@/server/context";

/** Query `?carId=&type=&before=`, each optional. */
export function GET(request: Request) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    const filter = parseNoteFilter(new URL(request.url).searchParams);
    if (!filter.ok) return apiError("invalid");
    return Response.json(await notesPage(ctx, filter.value));
  });
}

/** Body `{ carId, type, doneOn, km, text }`; answers the note (201). */
export function POST(request: Request) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    const body = parseCarNoteCreate(await readJson(request), ctx.date);
    if (!body.ok) return apiError("invalid");
    const note = await createNote(ctx, body.value);
    return typeof note === "string" ? apiError(note) : Response.json(note, { status: 201 });
  });
}
