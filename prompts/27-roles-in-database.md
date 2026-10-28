# 27 · Roles in the database

Status: done

## Goal
Owner, dispatcher, courier and mechanic become Route Forge's own roles, kept in a Neon table per firm and user.
Clerk keeps sign-in and firms (Organizations) but uses only its free built-in roles (`org:admin`, `org:member`).
That lets `clerk deploy` create the production instance on Clerk's free plan. For users the app works exactly as
it does today.

## Decisions
- Why: the free Clerk plan refuses `org:roles` (custom roles) and `app:allowed_memberships` (>20 members per org),
  so `clerk deploy` fails (plan 26, step 9). The user chose option B: no Enhanced B2B add-on for now. The free cap
  is 20 members per firm, which the user accepts. Paying later lifts the cap with no code change.
- New table `firm_members`: `id`, `firm_id`, `user_id`, `role` (pg enum `member_role`: owner, dispatcher, courier,
  mechanic), `set_by` (Clerk user ID, or `system` for automatic rows), `created_at`, `updated_at`. Unique
  (`firm_id`, `user_id`). It is the only source of the app role. Server code never reads `orgRole` again.
- **Access needs both** a role row and a current Clerk membership. The membership comes from the verified session
  token's active org (`orgId`), never from the request body or URL. A row alone gives nothing.
- Clerk's role only mirrors ownership: owners are `org:admin` and everyone else is `org:member`. Nothing reads it
  for permissions, except the creator rule below.
- **A new member's role** is decided once, when the server first sees a member with no row (the "claim"), in
  this order:
  1. Clerk role `org:admin` → `owner`. The creator of a firm gets `org:admin` (Clerk's `creator_role`).
  2. Else `role` in the membership's `publicMetadata` if it is courier, dispatcher or mechanic. Clerk copies an
     invitation's `publicMetadata` onto the membership when it is accepted (Clerk docs, "Invitations": invitation
     metadata is stored in `OrganizationMembership.publicMetadata`).
  3. Else `courier` (for example, someone added in the Clerk dashboard with no metadata).
  The claim inserts with `on conflict do nothing` and then reads the row back, so two claims at once can't disagree.
- **Invitations:** the app invites with Clerk role `org:member` and `publicMetadata: { role }`. The People list
  reads a pending invitation's role from that metadata; one without metadata shows as courier. On NoFirm,
  `accept()` stays Clerk's `invitation.accept()`. The next `GET /api/me` claims the row with the invited role.
- **Owners** (the user's choice: table + script): the app still never invites, changes or removes owners (it
  answers `notEditable`). Owners come from the creator rule, the seed, or a local script `npm run role:owner --
  <email> <firm name> add|remove`. The script writes the row and sets the Clerk membership to `org:admin` or
  `org:member` to match. It refuses to remove a firm's last owner. It runs against whichever instance and branch
  `.env.local` points at (for production, run it under the production env, like `db-push-prod`).
- **Removed in the Clerk dashboard** (the user's choice: no webhooks): within about a minute the token stops
  carrying that firm (Clerk session tokens live 60 s). The member then gets `noFirm`, or `NoFirm` in the app, even
  though their row still exists. Stale rows are deleted (along with their `dispatcher_depots` rows):
  - when the owner loads People (`peopleList` already fetches every membership): rows of non-members go;
  - when the owner invites an email whose Clerk user has a row in this firm but no membership.
  Removing in the app deletes the Clerk membership, then the role row and depot rows in one `db.batch`. Shifts,
  pay and documents stay, and the person shows as "Former" as today.
- Known edge, accepted: someone removed in the dashboard, then re-added in the dashboard (not through the app's
  invite) before the owner opens People, gets their old role back. The fix is to open People first or use the
  app's invite.
- Courier lists (`firmCouriers`: Team, Pay rates, Couriers) are the `courier` rows that are also current Clerk
  members. That keeps "Former" as it is today.
- `ownsAFirm` (account deletion): any `owner` row of the user in a firm where they are still a Clerk member.
  Account deletion also deletes the user's `firm_members` rows in every firm. This is a by-user query, like the
  others in `account.ts`.
- **Client** (the user's choice: spinner, then offline error): `useFirm()` gets its role from a new
  `GET /api/me` → `{ firmId, role }` (it claims if needed). A `FirmProvider` in the root layout (inside
  `ClerkProvider`) fetches once per active firm and shares the result, so `/`, `(app)/_layout` and Profile don't
  each fetch. It refetches when the app comes to the foreground (`AppState` `active`), so a role change reaches the
  person's app then. The server applies it at once. While loading, the existing spinner shows. On failure, a new
  `status: "error"` state shows a `Notice` with the offline or server message and a Retry `Button`. Nothing is
  stored on the device.
- `GET /api/me` answers `noFirm` without an active org, and `role` with an org but no membership (stale token). It
  never answers a role for a firm the token doesn't name.
- The member limit stays handled as now: Clerk's `*quota_exceeded` → `memberLimit`. On the free plan it is now
  real (20, pending invitations may count).
- Moving roles back into Clerk later stays possible: a script would read `firm_members` and set custom roles. It is
  not part of this plan.
- Data: a clean state (the development project rule). `db:push` adds the table, then `db:seed` writes the rows. No
  backfill.

## Out of scope
- Clerk webhooks, the Enhanced B2B add-on, custom Clerk permissions.
- Any UI change except the role-loading error state.
- Owner management in the app (it stays a script).
- `clerk deploy` itself and the rest of plan 26 step 9/10: the user runs them after this plan.
- Hiding the member list that Clerk's frontend API gives `org:member` (names and emails of the firm's members).
  It shows no roles any more.

## Steps

### 1. Clerk development instance: make the built-in roles usable (dry run first)
Before any code, the dev instance must accept `org:member` and `org:admin`. It currently has
`creator_role: org:owner`, `domains_default_role: org:courier`, `initial_role_set_key: role_set:default` and
`max_allowed_memberships: 0` (`clerk config pull`, CLI 4.1.0).
- Discover how roles and role sets are managed: `clerk api ls role`, `clerk config schema`. Note that
  `GET /organization_roles` and `GET /role_sets` answered `resource_not_found` while planning. If they stay
  unreachable, do this part in the Clerk dashboard (Organizations → Roles) and show the user what to click.
- Make sure `org:admin` and `org:member` exist in the role set the instance uses.
- Show the user `clerk config patch --dry-run` for `creator_role: org:admin` and
  `domains_default_role: org:member` (and the default role for new members, if it lives in the role set). Apply it
  only after the user approves, then `clerk config pull` to confirm.
- Custom roles stay for now: the old code and test users still use them until step 4.
Done: built-in roles are assignable in dev, and the custom ones still exist.

### 2. Schema and the role module
- `src/db/schema.ts`: the `member_role` enum and the `firm_members` table, with doc comments like the other tables.
  Then `npm run db:push` (Neon dev).
- New `src/server/members.ts` (imports `db` and `clerk`):
  - `membershipOf(firmId, userId)`: the Clerk membership or null;
  - `roleOf(firmId, userId)`: the row's role, or else claim it from the membership (Decisions). Null when the
    person isn't a member;
  - `setMemberRole(firmId, userId, role, setBy)` (upsert), `forgetMember(firmId, userId)` (role row and depot rows,
    used by remove and the sweeps);
  - `roleRows(firmId)` for lists.
- `src/domain/people.ts`: the invitation metadata role parse (`roleFromMetadata(meta)` → assignable role or
  null), pure, with cases in `check:people-rules`.
Done: tsc and lint pass, and the table exists in dev.

### 3. Server: read roles from the table
- `src/server/auth.ts`: every `require*` helper authenticates, needs `orgId` (else `noFirm`), then calls
  `roleOf(orgId, userId)`. With no membership it answers `noFirm`, with the wrong role `role`. One shared
  `sessionRole(request)` replaces the four copies. `firmCouriers` = `courier` rows ∩ Clerk member IDs. The role
  is read on every request (one indexed query), never cached across requests.
- `src/server/people.ts`: drop `fromClerk`/`toClerk`. Members get their role from `roleRows` (a member with no
  row is claimed when listed). Invite with `role: "org:member"` and `publicMetadata: { role }`. Pending roles come
  from metadata. `peopleList` sweeps stale rows. `invite` forgets a non-member's stale row (by the Clerk user with
  that email). `changeable` reads the row (an owner → `notEditable`). `setRole` updates the row and clears depots
  in one batch, with no Clerk call. `removeMember` deletes the Clerk membership, then `forgetMember`. Update the
  header comment.
- `src/server/account.ts`: `ownsAFirm` from the table (∩ the user's Clerk memberships). `deleteAccount` also
  deletes the user's `firm_members` rows.
- `src/app/api/me+api.ts`: add `GET` → `{ firmId, role }` (`requireSession`, the token's `orgId`, `roleOf`).
  Add `MeView` to `src/domain/types.ts`.
- Grep: no `orgRole` and no `"org:owner|dispatcher|courier|mechanic"` left under `src/`.
Done: tsc and lint pass. With the dev server, `check:api` and `check:people` still pass after step 4's seed.
Build steps 3 and 4 back to back: until the seed writes rows, test users would claim from their old custom
Clerk roles and all become couriers.

### 4. Seed and check scripts
- `scripts/seed.mjs`: test users are listed by email with their role per firm: Ivanov: `owner`, `dispatcher`,
  `mechanic`, `courier.a`, `courier.c`; Firm B: `courier.b`. For each one, the seed sets the Clerk membership role
  (`org:admin` for the owner, `org:member` for the rest), clears the membership's `publicMetadata.role`, deletes the
  firm's `firm_members` rows and inserts them (`set_by: "seed"`). `members` (owner, dispatchers, couriers,
  mechanic) then come from this list instead of `membersOf` by Clerk role. The seed also revokes the firm's
  pending invitations that still carry a custom role.
- `scripts/check-people.mjs`: re-adding courier.c and Firm B's invite use `org:member` (plus the courier row).
  Assertions on Clerk roles become assertions on the API's roles. `scripts/check-account.mjs`: the temporary
  membership uses `org:member` plus a `firm_members` row. Check every other `scripts/check-*.mjs` for Clerk role
  strings. The pure `parseInvite({ role: "org:mechanic" })` case in `check-car-note-rules` stays (it tests
  rejection).
- New `scripts/role-owner.mjs` and `npm run role:owner` (Decisions). It refuses to remove the last owner.
- New `scripts/check-roles.mjs` and `npm run check:roles` (run `db:seed` first, dev only, leave courier.c alone
  while it runs):
  1. **The table decides:** set courier.a's Clerk role to `org:admin` → `/api/people` still answers `role` and
     `/api/me` says courier. Restore `org:member`. Change courier.c's row to `dispatcher` in SQL → `/api/approvals`
     answers 200 and `/api/shifts/today` answers `role`. Change it back.
  2. **Removed in Clerk loses access:** delete courier.c's membership through the Clerk API (as the dashboard
     would). A fresh token has no Ivanov org → `/api/me` and `/api/shifts/today` answer `noFirm`. A token minted
     for Ivanov anyway (`tokenFor(user, ivanov)`, if Clerk allows it) answers `noFirm` or `role`, never 200. The
     row still exists, and the owner's `GET /api/people` doesn't list courier.c and deletes the row. Re-add the
     membership (`org:member`) → `/api/me` claims courier and their shifts are still there.
  3. **Invitation role reaches the table:** a temporary `roles.check.<run>+clerk_test` user, a membership with
     `org:member` and `publicMetadata.role = mechanic` (what accepting an invitation leaves) → `/api/me` says
     mechanic and `/api/garage` answers 200. Then delete the user. The pending list shows a metadata-less
     invitation as courier.
  4. **Creator = owner:** a temporary user creates a temporary org (`created_by`) → `/api/me` says owner. Delete
     both.
  5. **No firm sees another's roles:** a row for courier.b in Ivanov (no membership) gives courier.b nothing in
     Ivanov. Firm B's tokens never list Ivanov people, and Ivanov's owner can't PATCH courier.b (`notFound`).
     Remove the row.
  Clean up everything in `finally`, as `check-people` does.
- `package.json` scripts plus the AGENTS.md command list.
Done: `db:seed`, then `check:roles` and `check:people` pass.

### 5. App: role from the server
- `src/auth/firm.tsx`: a `FirmProvider` holds the role state per active `orgId`. It fetches `GET /api/me` with the
  session token (a plain `fetch` like `useApi`; `src/api/client.ts` imports `@/auth`, so avoid a cycle) and
  refetches on `AppState` `active` and on Retry. `useFirm()` reads the context and adds
  `{ status: "error", code }`. `refresh()` also refetches the role. `accept()` refreshes the role after joining.
  Drop the `roles` map and `orgRole`.
- `src/app/_layout.tsx`: wrap the stack in `FirmProvider` inside `ClerkProvider`.
- `src/app/(app)/_layout.tsx` and `src/app/index.tsx`: handle `error` with a `Notice` and a Retry `Button`. Use the
  shared offline and server strings if they exist. Add `firm.roleFailed.*` in en, bg and de only if none fit.
  `index.tsx` shows the spinner until `ready`.
- Also update the comment on `useSessionToken` (the token no longer carries the role).
Done: tsc and lint pass. On the user's Samsung (they run Metro), each test user lands on the same tabs as before.

### 6. Clerk development instance: remove the custom roles (dry run first)
Only after steps 2–5 pass. Show the user every mutation as a dry run (`--dry-run` or a printed list) and apply it
after their approval:
- Check that no membership or pending invitation in the dev instance uses `org:owner`, `org:dispatcher`,
  `org:courier` or `org:mechanic`. List memberships per org through `clerk api`. Any left over gets `org:member` or
  `org:admin` (owners), or is revoked.
- Delete the four custom roles (through `clerk api` if the role endpoints are reachable, else in the dashboard),
  so only `org:admin` and `org:member` remain.
- `clerk config patch --dry-run` to set `max_allowed_memberships` back to the free plan's default. Find the value
  with `clerk config schema`; it is probably 5 or 20, while 0 means unlimited today.
- `clerk config pull`: confirm no custom roles and the default member limit. Rerun `db:seed` and every check.
Done: the dev instance uses only free features. The user reruns `clerk deploy` (domain routeforge.app).

## Verification
- `npx tsc --noEmit`, `npx expo lint`.
- Pure: `check:people-rules` (metadata role parse), `check:review-filters`, `check:car-rules`,
  `check:car-note-rules`, `check:work-time`, the salary check.
- `npm run db:push`, `npm run db:seed`, then with the dev server running, every check: `check:api`,
  `check:approvals`, `check:calendar`, `check:fleet`, `check:car-papers`, `check:pay`, `check:people`,
  `check:pay-rates`, `check:details`, `check:firm`, `check:garage`, `check:shift-photos`, `check:account`, and the
  new `check:roles` (table decides, removed in Clerk loses access, invitation role reaches the table, creator =
  owner, no firm sees another's roles).
- Rerun the whole set after step 6 (custom roles gone).
- `grep` for `orgRole` and the custom role keys under `src/`: none.
- End to end on the user's phone (they run Metro): sign in as each test user and see the same tabs and screens.
  As the owner, invite a new `+clerk_test` address as a dispatcher. Sign up with it and accept on NoFirm: it lands
  on Approvals. As the owner, change it to mechanic: after bringing the app back to the foreground it shows Cars.
  Remove it in the Clerk dashboard: within about a minute, NoFirm. Turn on airplane mode and cold-start the app:
  spinner, then the offline error with Retry, which recovers once you're back online.

## AGENTS.md updates
- **Who owns what → Auth, firms, and roles:** Clerk is the source of truth for sign-in and firm membership. The
  app role (owner, dispatcher, courier, mechanic) lives in Neon `firm_members`, and access needs both a row and
  the verified token's active org. This replaces "A user's role in that firm is a Clerk org role".
- **Organizations:** rewrite it. Clerk roles are only `org:admin` (owners) and `org:member` (everyone else; free
  plan, 20 members per firm). The role of a new member comes from the claim order (admin → owner, invitation
  `publicMetadata.role`, else courier). Invites carry the role in metadata. Owners come from the creator, the seed
  or `npm run role:owner`, never the app. Role changes reach the person's app when it next comes to the
  foreground, and the server applies them at once. Removing in the Clerk dashboard ends access within about a
  minute, and People sweeps stale rows. `useFirm()` gets the role from `GET /api/me` through `FirmProvider`.
  This replaces "Changes reach the person's session within about a minute", "New members default to courier,
  creators get owner", and "Anything about owners stays in the Clerk dashboard".
- **Data:** add `firm_members` to the table list.
- **API:** add `GET /api/me`, and say that the `require*` helpers read the role from `firm_members`.
- **Commands:** add `check:roles` and `role:owner`.
- Plan 26 Progress: note that step 9 waited for this plan.

## Result
Built on 2026-10-28. App roles live in `firm_members`, and the server never reads Clerk's role. The Clerk dev
instance has only `org:admin` and `org:member`, with a limit of 20 members on the instance and on each firm. After
a fresh `db:seed`, every check passes: the 6 pure checks plus 14 dev-server checks, 585 ✅ and 0 ❌, including the
27 of the new `check:roles`. Changes from the plan:
- Step 1: the role set already held `org:admin`/`org:member`. Its default and creator roles changed through Clerk's
  Backend API directly, because `clerk api` (CLI 4.1.0) answers "not found" for the role endpoints.
- `GET /api/me` with an org in the token but no membership answers `noFirm`, not `role`.
- The Clerk client moved to `src/server/clerk.ts`, so `members.ts` and `auth.ts` don't import each other.
- The seed doesn't clear membership metadata: the rows it writes decide, and the metadata is only read on a claim.
- Step 6: `POST /role_sets/role_set:default/roles/replace` moved members off each custom role (Clerk runs it as an
  async migration, so each call waited for the last one). Four members outside the seed (Test C's two owners and two
  of the user's own accounts in Ivanov) got role rows with their old roles first.
- `check:roles` gives its throwaway firm a `firm_settings` row: People answers `firmNotSetUp` without one.
- Not done by me: the on-device run on the user's Samsung (Verification, last bullet).
