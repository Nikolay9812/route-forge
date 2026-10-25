// Drizzle Kit config, used only by `npm run db:push`. Schema changes are pushed, never migrated.
// Push goes over the direct (unpooled) connection, as Neon recommends for schema changes. The script loads
// .env.local with `node --env-file-if-exists`, so real env vars (CI) work too.
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set (run `neon env pull` or add it to .env.local)");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  casing: "snake_case",
  dbCredentials: { url },
  // Dev data is worthless, so pushes never stop to confirm (the script also passes --force for data loss).
  strict: false,
  verbose: true,
});
