# 05 · Clerk auth

Status: approved

## Goal
The custom auth screens from plan 04 run on real Clerk: email sign-up with a 6-digit email code, email + password sign-in, forgot password, and Google. Sessions survive an app restart, signed-out users can't reach `(app)`, and Sign out works. The Clerk MCP server is registered for Claude Code in this repo.

## Decisions
- **Clerk MCP server:** `claude mcp add clerk --scope project --transport http https://mcp.clerk.com/mcp`, which writes `.mcp.json` (checked in, holds no secrets). Each developer authenticates once with `/mcp` → clerk → Authenticate in an interactive session. Instance config changes below go through the MCP server once it's authenticated, otherwise through the already-linked Clerk CLI (`clerk` is logged in as the project owner and linked to `app_3L6J5cz75guwAmzEaTM0s9v0HLX`).
- **Clerk instance (development) changes:** turn on first name and last name as *optional* attributes, and set the password minimum length from 15 to 8. Nothing else changes. Already true and relied on: email + password required, email verified with `email_code` at sign-up, `reset_password_email_code` on, `oauth_google` on (Clerk's shared dev credentials), Native API on, captcha off, organizations off, test mode on.
- **SDK:** `@clerk/expo` 4.14 (already installed) and its current method-based API: `useSignUp()` / `useSignIn()` return `{ signUp|signIn, errors, fetchStatus }`, every method resolves to `{ error }`, `finalize()` activates the session. Never the legacy `prepareFirstFactor` / `setActive` API, except `useSSO()`, which still returns `{ createdSessionId, setActive }`.
- **Keep the adapter:** `src/auth/index.tsx` stays the only place that imports `@clerk/expo` hooks for auth flows. It keeps the same exported shapes the screens use (`useAuth`, `useSignUp`, `useSignIn`, `AuthError`, `isEmail`, `MIN_PASSWORD`), wraps Clerk, and maps Clerk errors to our `AuthError { code, field? }`. Screens change only where the flow itself changes. Raw Clerk messages are never shown.
- **Full name:** one field as designed. On submit it is trimmed and split at the first space: first word → `firstName`, the rest → `lastName` (empty if one word). Home shows Clerk's `user.fullName`.
- **Password minimum 8** in Clerk and in the client check, so the existing copy stays true. Clerk's breached-password check stays on and gets its own message.
- **Persistent sessions:** `tokenCache` from `@clerk/expo/token-cache` (already on `ClerkProvider`) needs `expo-secure-store`, which isn't installed. Add it with `npx expo install expo-secure-store`. On web Clerk uses its own cookies.
- **Loading:** the splash screen stays up until fonts are loaded *and* Clerk reports `isLoaded`, so a signed-in user never sees onboarding flash at a cold start. On the server's first web render Clerk isn't loaded, so the root renders nothing, same as before fonts load.
- **Routing:** unchanged `Stack.Protected` guards in the root layout, now driven by Clerk's `isSignedIn`. After `finalize()` or `setActive()` the guard flips and `index` redirects home; screens don't navigate after sign-in themselves.
- **Sign-up:** `signUp.password({ emailAddress, password, firstName, lastName })` → `signUp.verifications.sendEmailCode()` → `/verify?flow=sign-up` → `verifyEmailCode({ code })` → when `status === "complete"`, `finalize()`. The sign-up screen renders `<View nativeID="clerk-captcha" />` (Clerk's bot-protection mount point; captcha is off today but harmless and required if it's turned on).
- **Sign-in:** `signIn.password({ emailAddress, password })`. `complete` → `finalize()`. `needs_client_trust` (Clerk's new-device check) → `signIn.mfa.sendEmailCode()` → `/verify?flow=sign-in` → `signIn.mfa.verifyEmailCode({ code })` → `finalize()`. Any other status (`needs_second_factor`, `needs_protect_check`) shows the "Something went wrong" alert, because MFA and Protect are off for this instance.
- **Forgot password:** `signIn.create({ identifier })` → `signIn.resetPasswordEmailCode.sendCode()` → `/verify?flow=reset` → `verifyCode({ code })` (status `needs_new_password`) → `/new-password` → `submitPassword({ password, signOutOfOtherSessions: true })` → `finalize()`.
- **Verify screen:** the email shown comes from the live Clerk attempt (`signUp.emailAddress` or `signIn.identifier`), so a deep link or reload with no attempt still redirects back (to `/sign-up`, `/sign-in`, or `/forgot-password` by flow). Resend calls the same send method again.
- **Google:** the existing `GoogleButton` calls `useSSO().startSSOFlow({ strategy: "oauth_google" })` (browser flow, works in Expo Go and on web). On `createdSessionId` → `setActive({ session })`. A cancelled browser returns no session and shows nothing. Needs `npx expo install expo-auth-session expo-crypto` (`expo-web-browser` is already installed). The redirect is Clerk's default `routeforge://sso-callback` (`exp://…/--/sso-callback` in Expo Go). A tiny `src/app/sso-callback.tsx` redirects to `/` in case the OS delivers that link to the router instead of the browser session. A Google sign-up gets first and last name from Google.
- **Sign out:** `useAuth().signOut()` from Clerk. Home shows a loading state on the button while it runs. The guard then sends the user to onboarding.
- **Error mapping** (`errors[0].code` of the Clerk API error, `meta.paramName` for the field): `form_identifier_exists` → email; `form_identifier_not_found` → email; `form_password_incorrect` → password; `form_password_length_too_short` → password; `form_password_pwned` → password (new: "This password appeared in a data breach. Choose another."); `form_param_format_invalid` on email → email ("Enter a valid email address."); `strategy_for_user_invalid` → email (new: "This account uses Google. Continue with Google instead."); `form_code_incorrect` → code; `verification_expired` → code (new: "That code has expired. Send a new one."); `verification_failed` / `too_many_requests` → form alert (new: "Too many attempts. Wait a minute and try again."); network failures → `network_error` (offline alert); anything else → `unknown`. New strings in en, bg, de.
- **Remove the mock:** the demo account, the `424242` constant, the `@offline.test` trick and `AuthProvider` are deleted. For testing, Clerk test mode accepts any email containing `+clerk_test` (e.g. `maria+clerk_test@example.com`) with code `424242` and sends no email. Offline is tested with airplane mode.
- **Tenant isolation:** still not part of this plan. There's no API route or table yet. Firm and role from the verified session start with the first API route plan, together with turning on Clerk Organizations.

## Out of scope
Clerk Organizations (firms, roles, invitations), MFA, Clerk Protect checks, native Google sheet (`useSignInWithGoogle`), Apple, passkeys, biometrics, API routes and backend session verification, the production Clerk instance, account deletion and profile editing.

## Steps
### 1. Clerk MCP server and instance settings
- Run `claude mcp add clerk --scope project --transport http https://mcp.clerk.com/mcp` and confirm `.mcp.json` contains only the server name, transport and URL.
- If the MCP server is authenticated in this session, use its `get_instance_config` / `patch_instance_config`. Otherwise use the Clerk CLI (load the `clerk-cli` skill first). Change exactly: first name on and optional, last name on and optional, password `min_length` 8. Show the before/after of just those fields.
- Re-fetch `https://pleasing-parrot-9335.clerk.accounts.dev/v1/environment?_is_native=true` and check `first_name`/`last_name` are `on` and `password_settings.min_length` is 8.
Done when both checks pass. No app code changes.

### 2. Dependencies and root layout
- `npx expo install expo-secure-store expo-auth-session expo-crypto`. No other packages.
- Root `_layout.tsx`: drop `AuthProvider`. `RootStack` reads `isLoaded` and `isSignedIn` from Clerk's `useAuth()` and returns `null` until loaded. Hide the splash once fonts are ready and Clerk is loaded (a small `SplashGate` inside `ClerkProvider`). Keep the existing missing-key error.
- `index.tsx`: same redirect, with Clerk's `isSignedIn`.
- Add `src/app/sso-callback.tsx` → `<Redirect href="/" />`.
Done when lint and tsc pass and the app starts to onboarding when signed out.

### 3. Adapter (`src/auth/index.tsx`, `src/auth/errors.ts`)
Rewrite `src/auth/index.tsx` on Clerk with the shapes the screens use:
- `useAuth()` → `{ isLoaded, isSignedIn, user: { fullName, emailAddress } | null, signOut }` (from Clerk `useAuth` + `useUser`).
- `useSignUp()` → `{ signUp: { emailAddress, password({ fullName, emailAddress, password }), verifications: { sendEmailCode, verifyEmailCode({ code }) } } }`. `verifyEmailCode` calls `finalize()` when complete.
- `useSignIn()` → `{ signIn: { identifier, password({ emailAddress, password }) → { error, next: "done" | "verify" }, verifyEmailCode, resendEmailCode, sso(), resetPasswordEmailCode: { sendCode({ emailAddress }), verifyCode, submitPassword } } }`. `password()` returns `next: "verify"` after sending the client-trust code.
- `src/auth/errors.ts`: `toAuthError(error: unknown): AuthError`, per the mapping above. Extend `AuthErrorCode` with `form_password_pwned`, `form_param_format_invalid`, `strategy_for_user_invalid`, `verification_expired`, `too_many_attempts`, `unknown`.
- `MIN_PASSWORD` stays 8. Comment at the top says this file adapts Clerk to the screens' `{ error }` shape.
Done when tsc passes with the screens unchanged except where step 4 changes them.

### 4. Screens
- `sign-up.tsx`: add the `clerk-captcha` view below the Google button. No other changes.
- `sign-in.tsx`: on `next === "verify"` push `/verify?flow=sign-in`.
- `verify.tsx`: three flows (`sign-up`, `sign-in`, `reset`), email from the live attempt, redirect when missing, expired-code message under the boxes.
- `forgot-password.tsx`, `new-password.tsx`: same UI, Clerk calls through the adapter.
- `google-button.tsx`: `useSSO` through the adapter, no error for a cancel.
- `home.tsx`: Clerk user, async sign out with loading.
- `auth-errors.ts`: new codes → new keys. Add `auth.errors.passwordPwned`, `useGoogle`, `codeExpired`, `tooManyAttempts` to en, bg, de.
Done when lint and tsc pass.

### 5. Close out
Run Verification, write `## Result`, set `Status: done`, apply the AGENTS.md updates.

## Verification
- `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`.
- Environment endpoint shows names on and min length 8 (step 1).
- On the user's Samsung in Expo Go (ask before booting an emulator), with `maria+clerk_test@example.com` and code `424242`:
  1. Sign up "Maria Ivanova" → verify screen shows the email → wrong code `000000` → error, boxes clear → `424242` → home "Signed in as Maria Ivanova". The Clerk dashboard (or `clerk` CLI) shows the user with first Maria, last Ivanova.
  2. Force-close the app and reopen → straight to home (session persisted, no onboarding flash).
  3. Sign out → onboarding. Reopen the app → still onboarding.
  4. Sign in with the same account → home (or the verify screen first if Clerk asks for a new-device code, then home).
  5. Wrong password → error under password. Unknown email → error under email.
  6. Sign up again with the same email → "already exists".
  7. Sign up with password `password123` → breached-password error. 7 characters → length error before any request.
  8. Forgot password → code `424242` → new password → home. Sign out, sign in with the new password → home.
  9. Continue with Google → browser → pick an account → home with the Google name. Cancel the browser → back on the screen, no error.
  10. Airplane mode → sign in → offline alert, typed values stay.
  11. Signed in, open `routeforge:///sign-in` → home. Signed out, open `routeforge:///home` → onboarding. Open `/verify` with nothing pending → back to the start of that flow.
- Web (`npx expo start --web`): sign in and sign out once.
- Bulgarian and German: new error strings fit.

## AGENTS.md updates
- Expo section, replace the "Signed-out entry" line: `/` redirects by Clerk auth state. Signed-out users get onboarding and `(auth)`, signed-in users get `(app)`, guarded with `Stack.Protected` in the root layout. The splash stays until fonts and Clerk are loaded.
- Who owns what → Auth: screens use `src/auth/`, which adapts `@clerk/expo`'s current custom-flow API (`{ error }` results, `finalize()`) and maps Clerk error codes to translation keys. Screens never import Clerk auth hooks or show raw Clerk messages. Sessions persist through `tokenCache` (`expo-secure-store`). The Clerk MCP server is registered in `.mcp.json`. Instance settings change through it or the Clerk CLI, never by hand-editing app code to fit.
- Checks: auth flows are tested with Clerk test emails (`+clerk_test`, code `424242`).

## Result
Built steps 1–4. The Clerk MCP server is registered in `.mcp.json` (it needs `/mcp` → clerk → Authenticate once per developer). Instance settings were changed with the Clerk CLI because the MCP server can't sign in from a non-interactive session: first and last name on (optional), password minimum 15 → 8, confirmed on the public environment endpoint. `src/auth/` now wraps `@clerk/expo` 4.14 with the same shapes the screens used, so screen changes were small: new-device code step (`/verify?flow=sign-in`), captcha mount, async sign-out. Added `experimental.rethrowOfflineNetworkErrors` on `ClerkProvider`. Without it Clerk resolves offline requests as empty and the screens would hang instead of showing the offline alert. Lint, tsc, expo-doctor and an Android export pass, and the secret key is not in the bundle. Device flows are pending the user's run on their phone.
