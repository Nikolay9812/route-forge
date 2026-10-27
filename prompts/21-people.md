# 21 · People: invite, roles, depots, remove

Status: done

## Goal
The owner manages the firm's people in the app (Profile → People). They can invite someone by email as a courier or dispatcher, revoke a pending invitation, switch a member between courier and dispatcher, choose which depots a dispatcher manages, and remove someone from the firm. Removing someone keeps their history. Only the owner role itself still comes from the Clerk dashboard.

## Decisions
- **Clerk stays the source of truth** for memberships, roles and invitations. New owner-only API routes call it through the existing `@clerk/backend` client in `src/server/auth.ts` (v3.26: `createOrganizationInvitation`, `getOrganizationInvitationList`, `revokeOrganizationInvitation`, `getOrganizationMembershipList`, `updateOrganizationMembership`, `deleteOrganizationMembership`). The app never calls Clerk's organization admin APIs itself. Only `dispatcher_depots` lives in Postgres.
- **Adding = email invitation only.** The owner enters an email and a role, and Clerk sends the invite email (`inviterUserId` = owner, default 30-day expiry, no `redirectUrl`). The person signs up or signs in with that email and accepts it on the existing `NoFirm` screen, which already lists pending invitations. The owner never sets or sees a password.
- **The roles the owner can give are `org:courier` and `org:dispatcher` only.** Owners show up in the list but read-only. Any request that targets an owner, including the owner's own row, answers `notEditable`. Promoting someone to owner stays in the Clerk dashboard, so a firm can never lose its last owner from the app.
- **Edit = role + depots.** The owner never changes a person's name or email: those belong to the person's own Clerk account, which may be in other firms too. Personal details stay in Couriers → documents.
- **Dispatcher depots in the app.** A dispatcher's screen has a checklist of the firm's active depots. Saving replaces their active-depot rows in `dispatcher_depots` with one `db.batch` and leaves rows for archived depots alone. Depots can only be chosen once the person has joined: the user ID only exists after they accept. Until then the list shows a "No depots" warning tag on that dispatcher.
- **Changing a role** (courier ↔ dispatcher) clears that user's `dispatcher_depots` rows, so a new dispatcher always starts with no depots and the owner picks them. Their shifts, pay rates and documents stay as they are. The app asks to confirm in an `ActionSheet` first.
- **Remove = delete the Clerk membership and keep everything else.** Shifts, pay entries, documents and photos stay (salary history). The user's `dispatcher_depots` rows are deleted, since they only grant access. Their already-submitted shifts stay in Approvals and can still be reviewed and paid. If the same account is invited again later, they see their old data again because the Clerk user ID doesn't change. The app asks to confirm in an `ActionSheet` first.
- **"Former" tag:** Team-tab rows and owner Couriers rows for someone who is no longer a member of the firm (in any role) show a `Former` tag (`muted` tone). `TeamMember` and the couriers list entry gain `former: boolean`. Names still come from Clerk, since the user account itself isn't deleted.
- **Pending invitations:** listed with email, role and sent date. Tapping one offers Revoke in an `ActionSheet`. There is no Resend: revoke and invite again.
- **Access changes take effect within about a minute.** A removed or re-roled person keeps their current session token until it refreshes (Clerk tokens last 60 s). After that, API routes answer `noFirm` or `role`, and `useFirm()` moves them to `NoFirm` or the other role's tabs. There's no push.
- **Invite validation** (`src/domain/people.ts`, pure): trimmed and lowercased, up to 254 characters, a simple `local@domain.tld` shape, and `role` ∈ `courier | dispatcher`. Someone already in the firm, or with a pending invite there, answers `exists`. If Clerk's member quota is full, it answers a new error code `memberLimit` (409). Clerk errors are mapped by their `code`, and the exact codes are confirmed in step 2. Emails are personal data: never logged.
- **API (all `ownerContext`; everyone else gets `role`; a target outside the firm gets `notFound`):**
  - `GET /api/people` → `{ members: [{ userId, name, email, role, joinedAt, depotIds }], invitations: [{ id, email, role, createdAt }], depots: [{ id, name }] }`. Members include every role. `depotIds` is filled for dispatchers only, and `depots` lists active depots only.
  - `POST /api/people/invitations` `{ email, role }` → 201 with the invitation.
  - `DELETE /api/people/invitations/:id` → the updated list (like other deletes, which answer the resource). Revokes only a pending invitation of this firm, else `notFound`.
  - `PATCH /api/people/:userId` with either `{ role }` or `{ depotIds }` (exactly one key). `depotIds` is accepted only for a dispatcher and must all be this firm's active depots, else `invalid`. Answers the updated member.
  - `DELETE /api/people/:userId` → the updated list.
- **Server code** lives in `src/server/people.ts`. Membership reads page through Clerk 100 at a time, like `firmCouriers`. Member names reuse `userNames`, and emails come from `publicUserData.identifier`.
- **UI** (no design attached; built from existing primitives like Depots & cars and Pay rates. Send a design if you want it to match one):
  - Profile → Firm group gets a new row **People** (icon `people-add`: `person.badge.plus` / `person_add`), placed before Couriers.
  - `profile/people`: an "Invite" header button. Below it, sections **Owners**, **Dispatchers**, **Couriers**, **Pending invitations** (an empty section is hidden). Each row shows the name, the email in `footnote`, and a "You" tag on the owner's own row. A dispatcher row's subtitle is "3 depots", or a `warning` "No depots" tag. Owner rows don't open anything. Other rows push `profile/person?userId=`. Loading, error (Retry), offline and empty states follow `fleet.tsx`.
  - `profile/invite` form sheet: email `TextField` (email keyboard, no autocapitalise), role `SegmentedControl` (Courier | Dispatcher), and a "Send invitation" `Button`. Errors show inline (`exists`, `memberLimit`, `invalid`, `offline`). On success it closes, and the list refreshes with the new pending row.
  - `profile/person`: a header with the name and email. A role `SegmentedControl` that confirms before saving. For dispatchers, a **Depots** `Surface` with one `Toggle` row per active depot and a Save button, enabled when something changed. Last, a destructive "Remove from firm" `Button` that confirms first, then pops back to the list. A failed save keeps the toggles as the owner set them and shows an `Alert`.
  - Hook: `usePeople()` in `src/people/`. It loads `/api/people` and exposes `invite`, `revoke`, `setRole`, `setDepots`, `remove`, each refreshing the list on success.
- All new strings go in en, bg and de under `people.*`.

## Out of scope
- Inviting or promoting owners, transferring ownership, and removing owners (still done in the Clerk dashboard).
- Editing names, emails, phone numbers or passwords.
- Picking depots at invite time (would need invitation metadata plus applying it when the invite is accepted, via a webhook).
- Resending invitations, custom invite email text, and invite links or QR codes.
- Couriers assigned to depots (couriers still pick the depot per shift).
- People who belong to several firms (`useFirm` still activates the first membership; it only shows invitations when there are none).
- Hard-deleting Clerk users and deleting a removed person's documents.
- Dispatchers managing people.

## Steps

### 1. Domain rules and error code
- `src/domain/people.ts` (pure, no imports except types): `AssignableRole = "courier" | "dispatcher"`, `MAX_EMAIL = 254`, `normalizeEmail`, `validEmail`, `parseInvite(body) → { email, role } | null`, `parsePersonPatch(body) → { role } | { depotIds: string[] } | null` (`depotIds` unique UUIDs, at most 100). Types `Person`, `PendingInvitation`, `PeopleList` in `src/domain/types.ts`. Add `memberLimit` to `ApiErrorCode` and `statusOf` (409).
- `scripts/check-people-rules.mjs` + `npm run check:people-rules`: email normalisation and edge cases, the role whitelist (rejects `owner`, `org:owner`, `admin`), the patch shape (both keys or neither → null).
- Done: `npm run check:people-rules`, lint and tsc pass.

### 2. Server and API routes
- `src/server/people.ts`: `memberships(firmId)` (all pages, every role), `peopleList(owner)`, `invite(owner, input)`, `revokeInvitation(owner, id)`, `setRole(owner, userId, role)`, `setDepots(owner, userId, depotIds)`, `removeMember(owner, userId)`. Each one loads the target membership first: missing → `notFound`, owner → `notEditable`. The Clerk call goes first, then the `dispatcher_depots` cleanup. A failed cleanup is harmless because rows only matter while the person is a dispatcher, and a role change clears them again.
- Map Clerk errors (an `isClerkAPIResponseError` check on `errors[0].code`) to `exists` / `memberLimit`, and anything else to the generic 500. Confirm the real codes by trying a duplicate invite and checking the instance's membership limit with the Clerk CLI (`clerk api` with `MSYS_NO_PATHCONV=1`). Record the codes in a comment.
- Routes: `src/app/api/people/index+api.ts` (GET), `people/invitations/index+api.ts` (POST), `people/invitations/[id]+api.ts` (DELETE), `people/[userId]+api.ts` (PATCH, DELETE). Each starts with `ownerContext` inside `handle`.
- `former`: `teamList` and `documentsList` mark entries whose user ID isn't among the firm's memberships (one `memberships()` call per request).
- Done: lint and tsc pass, and `curl` as owner returns the list.

### 3. API checks
- `scripts/check-people.mjs` + `npm run check:people`, modelled on `check-fleet.mjs` (`lib/api-test.mjs` tokens for courier.a, courier.b/Firm B, dispatcher, owner):
  - courier and dispatcher get `role` on every route, and courier.b (Firm B) doesn't see Ivanov's people.
  - The owner lists members, sees the seeded dispatcher's `depotIds`, and sees no Firm B user.
  - Invite `people.check.<run>+clerk_test@example.com` as courier → 201. The same email again → `exists`. An existing member's email → `exists`. `role: "owner"` → `invalid`. Revoke → 200, and revoking again → `notFound`. A Firm B invitation ID → `notFound`.
  - PATCH and DELETE on the owner's own ID and on another owner → `notEditable`. A Firm B user ID → `notFound`.
  - `setDepots` on the dispatcher with a Firm B depot or an archived depot → `invalid`. With two Ivanov depots → saved, and the dispatcher's `GET /api/approvals` scope follows. Restore the original set at the end.
  - Role round trip on courier.c: → dispatcher (depots empty) → courier. The courier's shifts are unchanged afterwards.
  - Remove and re-add: remove courier.c → 200, and courier.c's next fresh token has no org (`tokenFor` fails or answers `noFirm`). The owner's Team list shows courier.c with `former: true`, and their shifts are still in Approvals. Then put courier.c back with the Clerk backend directly (`createOrganizationMembership`, role courier) so later checks and the seed still work.
- Done: `npm run check:people` all ✅.

### 4. App: hook, list, invite sheet
- `src/people/people.ts`: `usePeople()` over `useApi()`, shaped like `useFleet()`.
- Icon `people-add` in `src/components/icons.ts`. The Profile Firm group gets the People row.
- `src/app/(app)/profile/people.tsx`, `invite.tsx` (form sheet: register it in `profile/_layout.tsx` like the fleet sheets), plus row and section components in `src/components/people/`. The `Former` tag appears in the Team list rows and the Couriers list rows.
- Strings in en, bg and de.
- Done: lint and tsc pass. Ask the user to reload on their phone and check the list and invite flow.

### 5. App: person screen
- `src/app/(app)/profile/person.tsx`: header, role control with confirm, depot toggles + Save (dispatchers), and Remove with confirm. It handles loading, failure and a missing member (removed elsewhere → a "not in the firm" notice with Back).
- Done: lint and tsc pass. The user checks on their phone.

### 6. Close out
- Verification below, `## Result`, `Status: done`, and the AGENTS.md updates.

## Verification
- `npx expo lint`, `npx tsc --noEmit`, `npm run check:people-rules`, `npm run check:people`. Also the existing `check:api`, `check:approvals`, `check:calendar`, `check:fleet` and `check:details`, which all still pass, since `former` is additive.
- On the phone as owner (Ivanov): Profile → People shows owner (You), dispatcher with its depots count, and couriers a and c. Invite `new.courier+clerk_test@example.com` as courier → pending row appears. Revoke it → gone.
- Invite again, sign up with that email in the app (code 424242), accept on NoFirm → lands on courier Home. The owner refreshes People → they're under Couriers.
- Owner changes them to dispatcher → "No depots" tag. Tick one depot, Save → "1 depot". Within a minute the new dispatcher's app switches to Approvals/Team and shows only that depot's shifts.
- Owner removes them → they're gone from People. Within a minute their app shows NoFirm. Any shift they submitted is still in the owner's Approvals, and the owner's Team tab shows them as Former.
- Light and dark mode, plus the three languages on the People screens. Offline: the invite sheet keeps the typed email and shows the offline error.

## AGENTS.md updates
- **Organizations:** replace "People join by invitation from the Clerk dashboard" with: owners invite couriers and dispatchers by email in Profile → People, change their role (courier ↔ dispatcher), set a dispatcher's depots, and remove members (`/api/people*`, owner-only via Clerk's backend API). The owner role, and anything about owners, stays in the Clerk dashboard. A role change clears `dispatcher_depots`. Removing someone deletes only the membership and their depot rows, and their history shows as "Former".
- **API:** add the `/api/people` routes to the owner list, plus `memberLimit`.
- **Who sees what:** the owner row's "users" becomes "members (invite, courier/dispatcher role, dispatcher depots, remove; not owners)".
- **Commands:** `check:people-rules`, `check:people`.
- Keep the file under 150 lines: shorten the Profile stack sentence if needed.

## Result
Built as planned. Owners invite, revoke, switch courier ↔ dispatcher, set dispatcher depots and remove members in Profile → People. Removed people show as "Former" in Team and Couriers.
- Deviations: deletes answer the updated `PeopleList` (200), not 204, because `useApi()` always parses JSON and other deletes answer their resource. `PeopleList` also carries `firm` (for invite dates in the firm's timezone) and `you` (the owner's own row).
- Found while probing Clerk: a second invite to a pending email doesn't fail; Clerk replaces the first one. `invite()` checks the pending list first. The dev firms have no member limit (`maxAllowedMemberships` 0), so the `memberLimit` mapping (any `*quota_exceeded` code) is untested.
- Checks: `check:people-rules` ✅, `check:people` 42/42 ✅, and all existing suites pass. Running `check:people` while someone edits courier.c in the app breaks the other suites until courier.c is a courier again.
