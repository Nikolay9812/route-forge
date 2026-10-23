# 04 · Auth screens (mocked)

Status: approved

## Goal
A signed-out user can create an account, verify their email with a 6-digit code, sign in, reset a forgotten password, or continue with Google, then land on a placeholder home screen and sign out again. All auth is mocked behind one module shaped like Clerk's current custom-flow API, so the Clerk plan only replaces that module.

## Decisions
- The sign-up screen follows the attached design (a "roam" sample). The Apple button is dropped, and "roam" becomes the Route Forge wordmark `routeforge` (Design Board 01, as on onboarding). Copy is reworded for Route Forge.
- Sign-in, verify, forgot-password and new-password have no design. They reuse the sign-up screen's header, type, fields and buttons.
- Google button: kept, mocked. It uses Google's official "G" mark (`https://developers.google.com/identity/images/g-logo.png`, 200×204 PNG) saved as `assets/images/auth/google-g.png`, never redrawn.
- Verification: 6-digit email code. The mock accepts `424242` (Clerk's test code) and rejects anything else. Resend unlocks after 30 s.
- After sign-in or verification: a placeholder protected home `/(app)/home` showing "Signed in as {name}" and Sign out.
- Forgot password: a full mocked flow. Email → the same code screen → new password → signed in (Clerk signs the user in after a reset).
- Route guarding uses `Stack.Protected` (SDK 58): signed-out screens are guarded by `!isSignedIn`, `(app)` by `isSignedIn`. `/` redirects to `/home` or `/onboarding`.
- Mock session state lives in memory (React context) and resets on reload. No storage (the app is online only). Clerk handles persistence later.
- Mock API (`src/auth/`) mirrors Clerk: every action is `async` and returns `{ error: AuthError | null }`, where `AuthError = { code, field? }`. Codes match Clerk's: `form_identifier_exists`, `form_identifier_not_found`, `form_password_incorrect`, `form_password_length_too_short`, `form_code_incorrect`, `network_error`. Screens translate codes and never show raw messages. Each call waits about 700 ms so loading states are visible.
- Mock accounts: anyone who signed up this session, plus a demo account `courier@example.com` / `password123`, name "Demo Courier". Signing up with the demo email returns `form_identifier_exists`. Any email at `offline.test` returns `network_error`, to exercise the offline state.
- Client checks run on submit: name required, email shaped like an email, password ≥ 8 characters. A field's error clears when it is edited. Typed values always stay on screen after an error (online-only rule).
- **Tenant isolation is not part of this plan.** With mocked auth there is no verified session, firm, API route or table to protect. It is enforced server-side starting with the Clerk + first API route plan (firm and role from the verified Clerk session, `firm_id` on every query). Joining a firm (Clerk org invitations) is also out of scope.
- Proposed new tokens (values estimated from the image): `--spacing-field-labeled: 64px` (two-line field) and `--spacing-button-social: 48px` (Google button).
- New icons: `back` (iOS `chevron.left`, Android `chevron_left`) and `mail` (iOS `envelope`, Android `mail`). Full name uses the existing `profile` icon.

## Out of scope
Real Clerk, Apple sign-in, firm invites or org selection, session persistence, rate limiting, password strength meter, terms checkbox, a real home screen.

## Design (sign-up, from the image; values estimated)
Screen `bg-surface`, safe area top and bottom, content in a `ScrollView` (`keyboardShouldPersistTaps="handled"`) inside a `KeyboardAvoidingView` (iOS `padding`), `px-4`.
1. **Header row** (`h-ghost`, `mt-2`, space-between): back `IconButton` with a new `outline` variant (`bg-surface border border-border`) and new `size="sm"` (`size-ghost` = 44), icon `back`. On the right, the wordmark `routeforge` in `ThemedText variant="heading"` (extrabold weight). Back calls `router.back()`, or `/onboarding` when there's no history.
2. **Title** `mt-6`: `variant="display"`, "Create your account" (wraps to 2 lines as in the design).
3. **Intro** `mt-2`: `variant="body"`: "Join Route Forge to log your shifts, follow approvals and see your pay on any device."
4. **Fields** `mt-6 gap-3`: `TextField` with a new `label` prop. With a label the field is `h-field-labeled`, `rounded-md`, `bg-canvas`, icon at `size="md"`, and the label (`variant="caption"`, ink) sits above the input (input `text-body`, placeholder `ink-muted`). Focus and error states stay as they are.
   - Full name: icon `profile`, placeholder "e.g. Maria Ivanova", `autoComplete="name"`, `textContentType="name"`, return → next.
   - Email address: icon `mail`, placeholder "you@example.com", `keyboardType="email-address"`, `autoCapitalize="none"`, `autoComplete="email"`, return → next.
   - Password: icon `lock`, placeholder "At least 8 characters", `secureTextEntry` with the show/hide toggle, `autoComplete="new-password"`, `textContentType="newPassword"`, return → submit.
5. **Primary** `mt-6`: `Button` "Create account", `trailingIcon="arrow"`, loading while the request runs.
6. **Divider** `mt-6`: new `Divider` primitive: `h-px bg-border` lines on both sides of "or" (`variant="caption"`, ink-muted, `px-3`).
7. **Google** `mt-6`: `Button variant="secondary"` with new `size="social"` (`h-button-social`) and new `leading` slot (`expo-image` `size-5` of `google-g.png`, `gap-3` before the label): "Continue with Google".
8. **Footer** `mt-8 mb-4`, centered row: "Already have an account?" (`caption`, ink-muted) + `Link` "Sign in" (`caption`, semibold, ink, `underline`) → `/sign-in` (replace).
9. **Form error** (network or unknown): `Alert tone="danger"` (or `offline` for `network_error`) above the primary button, dismissible.

## Other screens (same header, title, intro, field and button styles)
- **Sign in** `/(auth)/sign-in`: "Welcome back" / "Sign in to log today's shift and check your hours." Email + password (`autoComplete="current-password"`). A right-aligned "Forgot password?" `Link` (`caption` semibold secondary-ink, `mt-3`) → `/forgot-password`. Primary "Sign in" + arrow, divider, Google, footer "New to Route Forge?" + "Create account" → `/sign-up` (replace). Wrong password → error under the password field. Unknown email → error under the email field.
- **Verify email** `/(auth)/verify?flow=sign-up|reset`: "Check your email" / "We sent a 6-digit code to {email}. Enter it below." A code input: one hidden `TextInput` (`keyboardType="number-pad"`, `maxLength={6}`, `autoComplete="one-time-code"`, `textContentType="oneTimeCode"`) behind 6 boxes (`flex-1 h-field rounded-md bg-canvas`, `gap-2`, digit in `variant="heading"`; active box `border-[1.5px] border-secondary-ink`, error boxes `border-danger`). Tapping the boxes focuses the input, and it auto-submits at 6 digits. Primary "Verify" (disabled under 6 digits). Below: "Didn't get it? Resend in 0:30" (caption, ink-muted), which becomes the link "Resend code" and shows a success `Alert` "New code sent". Wrong code → error "That code isn't right. Check the email and try again." and the boxes clear. Reached with no pending flow (deep link) → redirect to `/sign-up`.
- **Forgot password** `/(auth)/forgot-password`: "Reset your password" / "Enter your account email and we'll send you a code." Email field, primary "Send code" → `/verify?flow=reset`.
- **New password** `/(auth)/new-password`: "Choose a new password" / "Use at least 8 characters." Password field with toggle (`new-password`), primary "Save and sign in" → signed in.
- **Home** `/(app)/home`: `bg-canvas`, centered `heading` "Signed in as {name}", `body` with the email, secondary `Button` "Sign out" → guard flips → onboarding.

## Steps
### 1. Primitives, tokens, icons, asset
- `src/global.css`: add `--spacing-field-labeled: 64px` and `--spacing-button-social: 48px`.
- `icons.ts`: add `back` and `mail`.
- `TextField`: optional `label` prop (two-line layout above). Without a label, nothing changes.
- `IconButton`: `outline` variant and `size?: "md" | "sm"`.
- `Button`: `size="social"` (`h-button-social w-full px-6`, `button` text) and `leading?: ReactNode`, rendered inline before the title.
- New `src/components/divider.tsx` (`label?: string`).
- Download `google-g.png` into `assets/images/auth/` with a `CREDITS.md` (source URL, Google brand guidelines).
- Add every new primitive state to `/design-system`.
Done when lint and tsc pass and the design-system screen shows the new pieces.

### 2. Mock auth module
`src/auth/index.tsx`: `AuthProvider`, `useAuth()` → `{ isSignedIn, user, signOut }`, `useSignUp()` → `{ password({ fullName, emailAddress, password }), sendEmailCode(), verifyEmailCode({ code }), pending }`, `useSignIn()` → `{ password({ emailAddress, password }), sso({ strategy: "oauth_google" }), resetPasswordEmailCode.sendCode({ emailAddress }), resetPasswordEmailCode.verifyCode({ code }), resetPasswordEmailCode.submitPassword({ password }), pending }`. All return `Promise<{ error }>`. `src/auth/errors.ts` maps codes to translation keys. A comment at the top says this file is replaced by Clerk. Wrap the root layout in `AuthProvider`.

### 3. Routing
Root `_layout.tsx`: `Stack.Protected guard={!isSignedIn}` around `onboarding` and `(auth)`, `Stack.Protected guard={isSignedIn}` around `(app)`. `index.tsx` redirects by `isSignedIn`. `(auth)/_layout.tsx` → `headerShown: false` (the screens draw their own header). Delete `auth-placeholder.tsx`.

### 4. Screens
Sign-up per the Design section, then sign-in, verify, forgot-password, new-password, and home. Shared pieces go in `src/components/auth/` (`AuthHeader`, `AuthScreen` scroll/keyboard wrapper, `CodeInput`, `GoogleButton`). All strings go in en/bg/de under `auth.*` (replacing the placeholder keys).

## Verification
- `npx expo lint`, `npx tsc --noEmit`, `npx expo-doctor`.
- Android emulator (Expo Go, light and dark) and web at 393×852: screenshot sign-up and compare with the design. List the differences, fix, repeat. Screenshot every other screen.
- Flows:
  1. Onboarding → Create account → submit empty → three field errors.
  2. Short password → length error.
  3. Valid data → loading → verify screen shows the email.
  4. Wrong code → error and boxes clear.
  5. `424242` → home "Signed in as {name}".
  6. Sign out → onboarding.
  7. Sign in with that account → home.
  8. Wrong password → field error.
  9. Unknown email → field error.
  10. Sign up with `courier@example.com` → "already exists".
  11. Forgot password → code → new password → home.
  12. Google → home "Demo Courier".
  13. `x@offline.test` → offline alert, and typed values are still there.
  14. Signed in, open `/sign-in` by deep link → redirected to home.
  15. Signed out, open `/home` → redirected to onboarding.
  16. Open `/verify` with nothing pending → `/sign-up`.
- Bulgarian and German: no clipped titles or buttons.

## AGENTS.md updates
- Expo section: auth screens use the mock in `src/auth/` (Clerk-shaped `{ error }` results, error codes translated by key). The Clerk plan replaces only that module. Routes are guarded with `Stack.Protected` in the root layout.
- Building from designs: brand marks for third-party sign-in (Google "G") come from the provider's official asset, stored in `assets/images/auth/` with credits.
- Replace the "Signed-out entry" line: `/` redirects by auth state. Signed-out users get onboarding and `(auth)`, signed-in users get `(app)`.
