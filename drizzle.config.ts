// Drizzle Kit config, used only by `npm run db:push`. Schema changes are pushed, never migrated.
// Push goes over the direct (unpooled) connection, as Neon recommends for schema changes. The script loads
// .env.local with `node --env-file-if-exists`, so real env vars (CI) work too.
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set (run `neon env pull` or add it to .env.local)");

// `db:push:prod` sets DRIZZLE_STRICT=1: production holds real payroll data, so every change is shown and confirmed,
// and only the main branch is allowed. Plain `db:push` is for the dev branch, whose data is worthless.
const production = process.env.DRIZZLE_STRICT === "1";
const branch = process.env.NEON_BRANCH;
if (production && branch !== "main") throw new Error("db:push:prod only pushes to the Neon main branch (NEON_BRANCH=main).");
if (!production && branch === "main") throw new Error("Use `npm run db:push:prod` for the Neon main branch.");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  casing: "snake_case",
  dbCredentials: { url },
  // Dev data is worthless, so dev pushes never stop to confirm (`db:push` also passes --force for data loss).
  strict: production,
  verbose: true,
});
