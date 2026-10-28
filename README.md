# Route Forge

Shifts, hours and pay for courier teams. Couriers log their daily work, dispatchers approve it, mechanics keep the
service log, and owners see the whole firm, including salaries. One app serves many logistics firms.

Expo (React Native) app with Expo Router API routes, Clerk for sign-in, firms and roles, Neon Postgres through
Drizzle, and private photos in Cloudflare R2. `AGENTS.md` holds every decision that's still true. `prompts/` holds
the plan for each feature.

## Environments

|                                   | Clerk                    | Neon         | R2 bucket                   | API                                  |
| --------------------------------- | ------------------------ | ------------ | --------------------------- | ------------------------------------ |
| development (your machine)        | dev instance (`pk_test`) | `dev` branch | `route-forge-documents-dev` | the Metro dev server                 |
| preview (internal APK/TestFlight) | dev instance             | `dev` branch | `route-forge-documents-dev` | EAS Hosting, `preview` alias         |
| production (stores)               | production (`pk_live`)   | `main`       | `route-forge-documents`     | EAS Hosting, `https://route-forge.expo.app` |

Secrets live in `.env.local` (development) and `.env.production.local` (production database pushes), never in git,
and in the EAS environments for builds and the hosted API. `.env.example` lists the names.

## Develop

```bash
npm install
npx expo start              # scan the QR code with Expo Go
npm run db:push             # schema → Neon dev branch
npm run db:seed             # wipe and re-seed the test firms (dev branch only)
npx tsc --noEmit && npx expo lint
```

The `check:*` scripts in `package.json` test the API against the running dev server (dev branch only).

## Release

```bash
npm run db:push:prod                                   # schema → Neon main (asks before any data loss)
npx eas-cli@latest env:exec production "npx expo export -p web"   # production EXPO_PUBLIC_ values, not .env.local's
npx eas-cli@latest deploy --environment production --prod
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --platform all
```

Preview: the same with `preview` (`deploy --environment preview --alias preview`, no `--prod`), then
`npx eas-cli@latest build --profile preview --platform android` makes an APK against the dev services.

EAS Hosting can't deploy variables of the "secret" type: store the server keys as "sensitive".
