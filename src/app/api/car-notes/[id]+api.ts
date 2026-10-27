// One service log note: read it with its photos, change it (its author, within 7 days), or delete it (its author
// within 7 days, or the owner). Notes of other firms answer 404.
import { parseCarNote } from "@/domain/car-notes";
import { isId } from "@/domain/shift";
import { apiError, handle, readJson } from "@/server/auth";
import { deleteNote, noteDetail, updateNote } from "@/server/car-notes";
import { garageContext } from "@/server/context";

export function GET(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const note = await noteDetail(ctx, id);
    return note ? Response.json(note) : apiError("notFound");
  });
}

/** Body `{ type, doneOn, km, text }`, the whole note; answers it. */
export function PATCH(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const body = parseCarNote(await readJson(request), ctx.date);
    if (!body.ok) return apiError("invalid");
    const note = await updateNote(ctx, id, body.value);
    return typeof note === "string" ? apiError(note) : Response.json(note);
  });
}

/** Answers `{ deleted: true }`. */
export function DELETE(request: Request, { id }: Record<string, string>) {
  return handle(async () => {
    const ctx = await garageContext(request);
    if (ctx instanceof Response) return ctx;
    if (!isId(id)) return apiError("notFound");
    const done = await deleteNote(ctx, id);
    return typeof done === "string" ? apiError(done) : Response.json({ deleted: true });
  });
}
