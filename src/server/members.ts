// App roles per firm and user (`firm_members`). Clerk holds sign-in and membership only: owners are `org:admin`,
// everyone else `org:member`. A role row gives access only together with a Clerk membership, which API routes take
// from the verified session token's active org. A member with no row yet gets one on first sight (the claim):
// `org:admin` → owner, else the role their invitation carried (Clerk copies its `publicMetadata` onto the
// membership), else courier.
import { and, eq, inArray, notInArray } from "drizzle-orm";

import { db } from "@/db";
import { dispatcherDepots, firmMembers } from "@/db/schema";
import { roleFromMetadata } from "@/domain/people";
import type { Person } from "@/domain/types";

import { clerk } from "./clerk";

export type MemberRole = Person["role"];
export type ClerkMembership = Awaited<ReturnType<typeof clerk.organizations.getOrganizationMembershipList>>["data"][number];

const USER_ID = /^user_[A-Za-z0-9]+$/;

/** Every Clerk membership of the firm, every page. */
export async function clerkMemberships(firmId: string): Promise<ClerkMembership[]> {
  const all: ClerkMembership[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, totalCount } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: firmId,
      limit: 100,
      offset,
    });
    all.push(...data);
    if (offset + 100 >= totalCount) return all;
  }
}

/** The user's Clerk membership in the firm, or null. */
export async function membershipOf(firmId: string, userId: string): Promise<ClerkMembership | null> {
  if (!USER_ID.test(userId)) return null;
  const { data } = await clerk.organizations.getOrganizationMembershipList({ organizationId: firmId, userId: [userId] });
  return data[0] ?? null;
}

/** The role a member gets on first sight. */
function initialRole(membership: ClerkMembership): MemberRole {
  if (membership.role === "org:admin") return "owner";
  return roleFromMetadata(membership.publicMetadata) ?? "courier";
}

function rowsOf(firmId: string, userIds?: string[]) {
  return db
    .select({ userId: firmMembers.userId, role: firmMembers.role })
    .from(firmMembers)
    .where(and(eq(firmMembers.firmId, firmId), userIds ? inArray(firmMembers.userId, userIds) : undefined));
}

/**
 * The member's role, claiming it when they have no row yet; null when they aren't a member. Callers whose session
 * token names this firm already know the membership exists, so a row alone is enough for them.
 */
export async function roleOf(firmId: string, userId: string): Promise<MemberRole | null> {
  const [row] = await rowsOf(firmId, [userId]);
  if (row) return row.role;
  const membership = await membershipOf(firmId, userId);
  return membership ? (await rolesOf(firmId, [membership])).get(userId) ?? null : null;
}

/** Roles of these Clerk members, claiming rows for any without one. Two claims at once keep the first row. */
export async function rolesOf(firmId: string, memberships: ClerkMembership[]): Promise<Map<string, MemberRole>> {
  const ids = memberships.flatMap((m) => (m.publicUserData?.userId ? [m.publicUserData.userId] : []));
  if (ids.length === 0) return new Map();
  const roles = new Map((await rowsOf(firmId, ids)).map((r) => [r.userId, r.role]));
  const missing = memberships.filter((m) => m.publicUserData?.userId && !roles.has(m.publicUserData.userId));
  if (missing.length > 0) {
    await db
      .insert(firmMembers)
      .values(missing.map((m) => ({ firmId, userId: m.publicUserData!.userId, role: initialRole(m), setBy: "system" })))
      .onConflictDoNothing();
    for (const r of await rowsOf(firmId, missing.map((m) => m.publicUserData!.userId))) roles.set(r.userId, r.role);
  }
  return roles;
}

/** Sets the member's role (insert or replace), recording who set it. */
export function setMemberRole(firmId: string, userId: string, role: MemberRole, setBy: string) {
  return db
    .insert(firmMembers)
    .values({ firmId, userId, role, setBy })
    .onConflictDoUpdate({
      target: [firmMembers.firmId, firmMembers.userId],
      set: { role, setBy, updatedAt: new Date() },
    });
}

/** Deletes the user's role row and dispatcher depot rows in the firm (access only; their history stays). */
export async function forgetMember(firmId: string, userId: string): Promise<void> {
  await db.batch([
    db.delete(firmMembers).where(and(eq(firmMembers.firmId, firmId), eq(firmMembers.userId, userId))),
    db.delete(dispatcherDepots).where(and(eq(dispatcherDepots.firmId, firmId), eq(dispatcherDepots.userId, userId))),
  ]);
}

/** Deletes role and depot rows of everyone who is no longer a Clerk member (removed in the Clerk dashboard). */
export async function forgetFormerMembers(firmId: string, memberIds: string[]): Promise<void> {
  const former = (ids: typeof firmMembers.userId | typeof dispatcherDepots.userId) =>
    memberIds.length > 0 ? notInArray(ids, memberIds) : undefined;
  await db.batch([
    db.delete(firmMembers).where(and(eq(firmMembers.firmId, firmId), former(firmMembers.userId))),
    db.delete(dispatcherDepots).where(and(eq(dispatcherDepots.firmId, firmId), former(dispatcherDepots.userId))),
  ]);
}
