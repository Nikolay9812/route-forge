// Dev-only database check. It reads no firm data, so it skips the Clerk session check every other route needs.
// Delete it when the first real API route exists.
import { sql } from "drizzle-orm";

import { db } from "@/db";

export async function GET() {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
