# 07 · Drizzle ORM with Neon

Status: done

## Goal
API routes can query Neon Postgres through a typed Drizzle client, and schema changes reach the database with `npm run db:push`. No tables yet.

## Decisions
- Driver: Neon HTTP (`drizzle-orm/neon-http` + `@neondatabase/serverless`). Pure JS, so it bundles into Expo's server output and runs on EAS Hosting. Multi-statement atomic writes use `db.batch([...])` (interactive transactions aren't available over HTTP).
- Schema changes use `drizzle-kit push` only. No `drizzle-kit generate` or `migrate`, no `out` folder, no migrations folder (AGENTS.md rule).
- Packages: `drizzle-orm`, `@neondatabase/serverless` (dependencies), `drizzle-kit` (devDependency). No `dotenv`: `drizzle.config.ts` loads `.env.local` with Node's built-in `process.loadEnvFile` (Node 24 here). Expo CLI already loads `.env.local` for API routes in dev.
- Connection strings: the app client uses pooled `DATABASE_URL`. `drizzle-kit push` uses direct `DATABASE_URL_UNPOOLED`, as Neon recommends for schema changes.
- Files: `src/db/schema.ts` (table definitions, empty for now) and `src/db/index.ts` (the `db` client). Only API routes and local scripts import `@/db`, never screens, hooks or components.
- Casing: `casing: "snake_case"` in both the client and the config, so TS names are camelCase (`firmId`) and columns are snake_case (`firm_id`).
- Health check: `src/app/api/health+api.ts`, `GET` only. It runs `select 1` and returns `{ ok: true }` or `{ ok: false }` with status 503, never error details or data. It exists only in dev and returns 404 when `process.env.NODE_ENV === "production"`. That's an exception to "API routes verify the Clerk session", allowed because it touches no firm data. Delete it when the first real API route exists.
- `.env.example`: created with the variable names in `.env.local` and no values: `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`.
- Neon branch: `.env.local` stays on `main` for now, and pushing the empty schema there changes nothing. The first plan that adds tables creates a dev branch first (`neon checkout <name> --create`).

## Out of scope
- Domain tables (firms, depots, cars, shifts, pay rates, corrections). Each feature adds what it needs.
- Clerk session verification in API routes (comes with the first real route).
- Seeding, EAS Hosting deployment and production env variables.

## Steps
### 1. Install packages
Run `npx expo install drizzle-orm @neondatabase/serverless` and `npx expo install drizzle-kit -- --save-dev`. Done when they're in `package.json` and `npx expo-doctor` shows no new problems caused by them.

### 2. Config, schema, client
- `drizzle.config.ts` (repo root): call `process.loadEnvFile(".env.local")` only if the file exists, so CI with real env vars still works. Throw if `DATABASE_URL_UNPOOLED` is missing. Use `defineConfig({ dialect: "postgresql", schema: "./src/db/schema.ts", casing: "snake_case", dbCredentials: { url }, strict: true, verbose: true })`, with no `out`.
- `src/db/schema.ts`: a header comment saying tables live here, every firm-owned table has `firmId`, and changes ship with `npm run db:push`. No exports yet.
- `src/db/index.ts`: throw a clear error if `DATABASE_URL` is missing, then `export const db = drizzle({ client: neon(url), schema, casing: "snake_case" })`.
- `package.json` scripts: add `"db:push": "drizzle-kit push"` and nothing else DB-related.
Done when `npx tsc --noEmit` and `npx expo lint` pass.

### 3. Health route and env example
Add `src/app/api/health+api.ts` as described under Decisions, and add `.env.example`. Done when the route answers in dev (see Verification).

### 4. AGENTS.md
Apply the updates below.

## Verification
- `npx tsc --noEmit` and `npx expo lint` pass.
- `npm run db:push` connects to the `main` branch and reports no changes (empty schema).
- With Metro running (the user starts it), `curl http://localhost:8081/api/health` returns `{"ok":true}`.
- With `DATABASE_URL` pointed at a bad host temporarily: the route returns 503 `{"ok":false}`, and no URL or password appears in the response.
- `git ls-files` shows no `.env.local`, no `drizzle/` folder, and no migration files.
- `grep -r "@/db" src` shows imports only under `src/app/api/`.

## AGENTS.md updates
- Commands: add `npm run db:push   # push the Drizzle schema to the Neon branch in .env.local`.
- Who owns what → Data: Drizzle ORM over the Neon HTTP driver. The schema lives in `src/db/schema.ts` and the client `db` in `src/db/index.ts`, imported only by API routes and scripts. camelCase in TS, snake_case columns. Atomic multi-writes use `db.batch`. `drizzle-kit push` uses `DATABASE_URL_UNPOOLED`.
- Rules: the push-only rule already replaced the old migrations rule. Add that pushes go to a Neon dev branch before `main`.

## Result
Built as planned, with two deviations. `drizzle.config.ts` doesn't load `.env.local` itself, because Node's types aren't in the app tsconfig: the `db:push` script runs `node --env-file-if-exists=.env.local node_modules/drizzle-kit/bin.cjs push` instead. `src/db/index.ts` disables lint's `import/namespace` on the schema import until the first table exists. Type check, lint and `db:push` pass (no changes on `main`), and `select 1` through drizzle-orm/neon-http succeeds with the real URL and fails cleanly with a bad host. The `/api/health` route wasn't hit, because Metro wasn't running.
