# 26 · Production launch readiness

Status: approved (2026-10-28; Sentry approved, account deletion keeps shifts and pay; build starts when the user says go)

## Goal
A store build of Route Forge works against its own production services: the API is hosted, the app reaches it, the
production Clerk, Neon and R2 are separate from development, and nothing a developer runs can wipe real data. The
app meets the store rules that block review (in-app account deletion, privacy policy), crashes are visible, and a
render crash never leaves a blank screen. The first real firm (Ivanov Transport) can then be invited.

## Decisions
- **Hosting:** API routes run on EAS Hosting (`web.output: "server"` is already set). Deploy with
  `npx expo export -p web` then `npx eas-cli@latest deploy --prod`. Server env vars (`CLERK_SECRET_KEY`,
  `DATABASE_URL`, `R2_*`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`) are EAS environment variables of the `production`
  environment, never in git. `.env` files aren't loaded by the server.
- **Origin:** `["expo-router", { "origin": "https://<prod-domain>" }]` in `app.json`, so the app's relative
  `fetch("/api/...")` reaches the hosted API in store builds. Development keeps using the dev server. The domain is
  an EAS Hosting custom domain (default proposal: `app.routeforge.<tld>`; the user picks it, see "You need to").
  `EXPO_UNSTABLE_DEPLOY_SERVER` isn't used: deploys stay a deliberate, separate step.
- **Environments:** three, each with its own services.
  | | Clerk | Neon | R2 bucket |
  |---|---|---|---|
  | development | dev instance (`pk_test`) | `dev` branch | `route-forge-documents-dev` |
  | preview (internal APK/TestFlight) | dev instance | `dev` branch | dev bucket |
  | production | production instance (`pk_live`) | `main` branch | `route-forge-documents` (EEUR) |
- **`eas.json`:** profiles `development` (dev client, internal), `preview` (internal distribution, Android APK for the
  user's Samsung), `production` (store; `autoIncrement: true`). `cli.appVersionSource: "remote"`, so EAS owns iOS
  `buildNumber` and Android `versionCode`. Each profile sets `environment` to the matching EAS environment.
- **Clerk production instance:** a copy of the dev settings: the custom roles `org:owner`, `org:dispatcher`,
  `org:courier`, `org:mechanic` (`org:admin`/`org:member` unused), default role courier, creator role owner,
  organization selection not forced, email + password + email code, Google with the firm's own OAuth client (Clerk's
  shared credentials aren't allowed in production), the `routeforge://` redirect allowlisted. No `+clerk_test`
  users in production.
- **Safety of scripts:** `db:seed` refuses to run unless `NEON_BRANCH === "dev"`, like the API checks
  (`scripts/lib/api-test.mjs`). `db:push` keeps `--force` for dev only. A new `db:push:prod` runs without
  `--force` and with `strict: true`, so drizzle-kit asks before any data loss, and refuses unless
  `NEON_BRANCH === "main"`.
- **Production data rules (replaces "Development project" in AGENTS.md):** once production holds a firm, its
  data is real payroll history. Schema changes go to `dev` first, then `compare_database_schema` against `main`,
  then `db:push:prod`. A change that would drop or rewrite columns with data needs a plan step of its own. Dev data
  stays worthless.
- **Account deletion (Apple 5.1.1(v), Google Play):** Profile → "Delete account", confirmed in an `ActionSheet`
  plus typing the word shown. `DELETE /api/me` (any role but owner): deletes the user's `courier_details` row, their
  `document_photos` rows and R2 files, `dispatcher_depots` rows, then the Clerk user
  (`clerk.users.deleteUser`). Shifts, pay, shift photos, service log notes and pay rate entries stay: they are
  salary history the firm must keep by law, and rows already show as "Former". Owners get `notEditable` and a
  message to contact support (deleting them would orphan the firm). Names of deleted users show as the translated
  "Deleted user" instead of the bare Clerk ID (`userNames` fallback). Google Play also needs a web page with the
  same steps. That page is a static page on the hosting domain at `/delete-account` (no sign-in, instructions
  only).
- **Privacy policy:** a static, server-rendered `/privacy` route in EN/BG/DE. The user supplies the legal text (or
  approves a draft). Linked from Profile and from sign-up. The store listings use its URL.
- **Error monitoring:** Sentry (`@sentry/react-native`, with its Expo config plugin) in the app, and
  `@sentry/cloudflare`-compatible capture in `handle()` on the server. Approved by the user. `sendDefaultPii: false`, no breadcrumbs of request bodies, `beforeSend` strips URLs' query strings
  (signed URLs) and any `amount`/`minor` fields. The server keeps logging only the error name, and Sentry gets the
  stack without the message.
- **Error boundary:** the root `_layout.tsx` exports an Expo Router `ErrorBoundary`: a themed screen with the
  translated "Something went wrong" and a Retry button (`retry()`), reported to Sentry.
- **Clerk `authorizedParties`:** every `authenticateRequest` passes `authorizedParties: [origin]` from
  `process.env.APP_ORIGIN` when set (the web build). Native session tokens carry no `azp`, so they still pass.
  The four `require*` helpers share one `authenticate(request)` function.
- **Abandoned uploads:** a presigned PUT that is never confirmed leaves a file. The production bucket gets an R2
  lifecycle rule that deletes objects with the `pending/` prefix after 1 day. Uploads go to
  `pending/{finalKey}`, and confirming copies the file to its real key and deletes the pending one. **Alternative,
  if the copy feels heavy:** a weekly script that lists keys and deletes those without a row. Default: the
  lifecycle rule.
- **Shift photo expiry** (postponed earlier, 2 weeks wanted) stays out of this plan, but the privacy policy states
  the current retention. Decide it before writing the policy text.
- **Web:** not offered to firms in v1 (photos don't work there). The server output still serves `/privacy`,
  `/delete-account` and the API.
- **OTA updates:** not in v1. `runtimeVersion` is left unset until EAS Update is planned.
- **README:** replaced with a short project README (what it is, the commands from AGENTS.md, the environments
  table above).

## Out of scope
- Store listings, screenshots and descriptions (the user does these in App Store Connect and Play Console).
- EAS Update, and EAS Workflows/CI.
- Moving NativeWind v5 and react-native-css off their release candidates (an accepted risk, revisited when stable).
- Shift photo expiry, rate limiting, and a data export for couriers (GDPR access requests are handled by the owner
  by hand for now).
- Firm onboarding beyond Ivanov Transport (still the Clerk dashboard).

## Steps
### 1. Make scripts safe for a real database
Add the `NEON_BRANCH === "dev"` guard at the top of `scripts/seed.mjs` (same message style as
`scripts/lib/api-test.mjs`). Add `db:push:prod` to `package.json`, with drizzle-kit run without `--force`. Read
`strict` from an env var in `drizzle.config.ts` (`DRIZZLE_STRICT=1` → `strict: true`) and refuse unless
`NEON_BRANCH === "main"`. Done: `NEON_BRANCH=main npm run db:seed` exits with the message before touching Clerk,
Neon or R2. `npm run db:push` on dev behaves as before.

### 2. Error boundary
Export `ErrorBoundary` from `src/app/_layout.tsx` (Expo Router's `ErrorBoundaryProps`: `error`, `retry`). It uses
`ThemedText`, `Button` and tokens only, and new strings `errors.crashTitle`, `errors.crashBody` and
`errors.crashRetry` in en/bg/de. It must render without fonts loaded (fall back to the system font) and without
Clerk. Done: throwing in a test screen in development shows the boundary, and Retry recovers.

### 3. Shared Clerk authentication with authorized parties
Factor `clerk.authenticateRequest` into one `authenticate(request)` in `src/server/auth.ts` that passes
`authorizedParties` when `APP_ORIGIN` is set. Add `APP_ORIGIN=` to `.env.example`. Done: all `check:*` scripts
pass on dev without `APP_ORIGIN`.

### 4. Account deletion
`src/app/api/me+api.ts` `DELETE` (any session with a firm; owner → `notEditable`), with server logic in
`src/server/account.ts`: R2 deletes first (`deleteObject` per document photo key), then `db.batch` of the row
deletes (filtered by `firm_id` and the session's user), then `clerk.users.deleteUser(userId)`. The client signs
out after success. Profile gets a "Delete account" row at the bottom (`danger` tone), an `ActionSheet` confirm, and
loading/error/offline states. `userNames` returns `""` for a missing user, and screens show
`t("people.deletedUser")`. New `npm run check:account` (dev only) creates a throwaway `+clerk_test` courier,
gives them documents and a photo, deletes them, and checks that the rows and R2 objects are gone, the shifts
remain, the owner gets `notEditable`, and the route without a session gets `unauthorized`. Done: the check passes,
lint and tsc pass.

### 5. Privacy and delete-account pages
`src/app/privacy.tsx` and `src/app/delete-account.tsx`: plain server-rendered pages in the app language, outside
the auth guard (add them to the root stack beside `onboarding`, reachable signed in or out). The text lives in the
translation files. Profile and sign-up link to `/privacy`. Done: both pages render on web export and in the app.
The privacy text is a marked placeholder until the user provides the final text.

### 6. Sentry (only if approved)
`npx expo install @sentry/react-native`, plus its config plugin in `app.json`. `Sentry.init` in the root layout with
the DSN from `EXPO_PUBLIC_SENTRY_DSN` (public by design), `sendDefaultPii: false` and the `beforeSend` scrubbing
above. Server: capture in `handle()` with the error name and stack only. Source maps upload during EAS Build
(`SENTRY_AUTH_TOKEN` as an EAS secret). Done: a test error from a preview build shows in Sentry without query
strings or amounts.

### 7. Upload staging for abandoned files
Change the key helpers in `src/domain/photos.ts` so the server hands out `pending/{key}` for PUT. The confirm step
(`confirm*Photo` in the four photo server modules) `HEAD`s the pending key, then copies it to the final key with an
R2 `CopyObject` (`x-amz-copy-source`, added to `src/server/storage.ts`) and deletes the pending one. Add a
`scripts/r2-lifecycle.mjs` that sets the 1-day `pending/` rule on a bucket via the Cloudflare API
(`CLOUDFLARE_API_TOKEN`). Run it on dev now and on production in step 9. Done: `check:details`,
`check:shift-photos`, `check:car-papers` and `check:garage` pass. A PUT that is never confirmed leaves only a
`pending/` object.

### 8. Build configuration
Create `eas.json` with the profiles and environments above. Add `origin` to the `expo-router` plugin in `app.json`
(the domain from "You need to"). Add the production variables to `.env.example` as names only. Rewrite `README.md`.
Done: `npx expo-doctor` is clean, `npx expo config --type public` shows the origin, and
`npx eas-cli@latest build --profile preview --platform android` produces an APK.

### 9. Production services and first deploy (with the user, step by step)
Create the Clerk production instance and copy the settings (the Clerk MCP once authorized, or the dashboard).
Push the schema to Neon `main` with `db:push:prod`. Create the R2 bucket `route-forge-documents` (EEUR) with its own
scoped token, and run the lifecycle script. Set the EAS `production` environment variables. Export and deploy, then
attach the custom domain. Done: `curl https://<prod-domain>/api/home` answers `{"error":"unauthorized"}` with 401.

### 10. Preview build on the Samsung, then production builds
Install the preview APK (dev services) and run the end-to-end check below. Then build `production` for both
platforms and submit to internal testing (TestFlight, Play internal track) against production services, with a
real owner account for Ivanov Transport.

## Verification
- `npx tsc --noEmit`, `npx expo lint` and `npx expo-doctor` are clean.
- Every `check:*` script passes on dev, plus the new `check:account`.
- `NEON_BRANCH=main npm run db:seed` refuses to run. `db:push:prod` asks before a destructive change (tested
  against a scratch Neon branch with a throwaway column and `NEON_BRANCH=main` set for that one run).
- The preview APK on the Samsung, against the hosted dev deployment: sign in with email and with Google, a courier
  starts, fills and submits a shift with photos, the dispatcher approves it, the owner sees pay, the mechanic adds a
  note. Airplane mode shows the offline state and keeps typed values.
- Account deletion: a test courier deletes their account. Their documents and photos are gone (R2 listing), their
  approved shift still shows in Approvals → Reviewed as "Deleted user", and the owner's Delete row answers with the
  support message.
- An error thrown in a preview build shows the error boundary and arrives in Sentry, scrubbed.
- An upload started and abandoned leaves a `pending/` object, which disappears after the lifecycle rule runs.
- Production: `/api/*` without a token answers 401, `/privacy` and `/delete-account` load, and the TestFlight/Play
  internal build signs in an owner on the production Clerk instance.

## AGENTS.md updates
- Replace the "Development project" rule under Rules with the production data rules above (dev stays worthless,
  main is real, and schema changes go dev → compare → `db:push:prod`).
- Commands: add `db:push:prod`, `check:account` and the deploy commands. Note that `db:seed` is dev-only.
- Who owns what → Data and Files: the three environments table. Uploads stage under `pending/` with a 1-day
  lifecycle rule.
- API: `DELETE /api/me`, `authorizedParties` via `APP_ORIGIN`.
- Expo: `origin` in the `expo-router` plugin, `eas.json` profiles, EAS environment variables, deploy with EAS
  Hosting, and the root `ErrorBoundary`.
- Domain → Who sees what: account deletion (not owners) keeps salary history.
- Sentry, if approved, under Who owns what (errors, scrubbed, never salaries or signed URLs).

## Progress (2026-10-29)
Steps 1–8 built on branch `chapter-22-production-launch`, not yet committed. Changes from the plan:
- Step 4: the confirm is the `ActionSheet` alone (its title says what's deleted and what stays); there's no typed
  word, since `ActionSheet` has no input. A user in several firms loses their documents in every firm, and owning
  any firm refuses the deletion. "Deleted user" is shown where a deleted courier, dispatcher or mechanic can still
  appear (approvals, corrections, team, garage checks, service log, pay rates). Firm rule and pay-rate entries are
  only ever set by owners, so they're left as they are.
- Step 6: app only. Sentry's Workers SDK has to wrap the worker entry, which EAS Hosting doesn't expose, so the
  server keeps logging the error name to the EAS Hosting dashboard (Crashes, Logs). No Sentry on the server for now.
- Step 7: done in `storage.ts` only: `presignPut` signs `pending/{key}`, and `keepUpload(key)` copies it to its key
  and deletes the pending copy. The rule script is `npm run r2:lifecycle` (applied to the dev bucket).
- Step 8: the domain is `https://route-forge.expo.app` (the user's choice). The origin is built in by `app.config.ts`
  from `APP_ORIGIN` per EAS environment, because preview and production builds need different servers. No
  `development` profile (it would need expo-dev-client). Server keys must be "sensitive", not "secret" (EAS Hosting
  can't deploy secrets). Production exports run under `eas env:exec production` so `EXPO_PUBLIC_` values come from
  production, not `.env.local`.
- Step 3 reverted: with `authorizedParties` set, Clerk refuses tokens without `azp`, and native session tokens have
  none (found on the preview deployment: every request answered 401). `APP_ORIGIN` now only builds the API origin
  into the app.
After a fresh `db:seed`, all 13 dev-server checks pass, including `check:account` (555 ✅, 0 ❌). Sentry project
`codewithantonio-hg/route-forge` (EU region) exists; its DSN is in `.env.local`, and org and project are in the
`@sentry/react-native` plugin in `app.json`. Not run yet: the preview APK (needs `eas init` under the user's Expo
account).

Step 9 (2026-10-28): the first `clerk deploy` failed because the free Clerk plan doesn't cover custom org roles
(`org:roles`) or more than 20 members per org (`app:allowed_memberships`). Roles moved to Neon in plan 27
(`prompts/27-roles-in-database.md`), and the dev instance now uses only `org:admin`/`org:member` with a limit of
20 members. Next: the user reruns `clerk deploy` (domain routeforge.app), then the rest of step 9 and step 10.
