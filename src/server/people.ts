// The owner's People screen: Clerk holds memberships and invitations; Postgres holds each member's role
// (`firm_members`, see ./members) and which depots a dispatcher manages. Owners hand out courier, dispatcher and
// mechanic; any change to an owner answers notEditable. An invitation carries its role in `publicMetadata.role`.
// Emails are personal data: never logged (handle() logs only the error's name).
import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { depots, dispatcherDepots } from "@/db/schema";
import { roleFromMetadata, type AssignableRole, type InviteInput } from "@/domain/people";
import type { ApiErrorCode, Firm, PendingInvitation, PeopleList, Person } from "@/domain/types";

import { clerk } from "./clerk";
import {
  clerkMemberships,
  forgetFormerMembers,
  forgetMember,
  membershipOf,
  rolesOf,
  setMemberRole,
  type ClerkMembership,
  type MemberRole,
} from "./members";

type Result<T> = T | ApiErrorCode;
type Role = MemberRole;

const INVITATION_ID = /^orginv_[A-Za-z0-9]+$/;

type Member = Omit<Person, "depotIds">;

function toMember(m: ClerkMembership, roles: Map<string, Role>): Member | null {
  const user = m.publicUserData;
  const role = user?.userId ? roles.get(user.userId) : undefined;
  if (!user?.userId || !role) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return {
    userId: user.userId,
    name: name || user.identifier,
    email: user.identifier,
    role,
    joinedAt: new Date(m.createdAt).toISOString(),
  };
}

function idsOf(all: ClerkMembership[]): string[] {
  return all.flatMap((m) => (m.publicUserData?.userId ? [m.publicUserData.userId] : []));
}

/**
 * Every member of the firm with their role. Rows of people who are no longer Clerk members (removed in the Clerk
 * dashboard) are deleted here, so they can't come back with an old role.
 */
async function members(firmId: string): Promise<Member[]> {
  const all = await clerkMemberships(firmId);
  const [roles] = await Promise.all([rolesOf(firmId, all), forgetFormerMembers(firmId, idsOf(all))]);
  return all.flatMap((m) => toMember(m, roles) ?? []);
}

/** User IDs of everyone who is a member of the firm in any role. */
export async function memberIds(firmId: string): Promise<Set<string>> {
  return new Set(idsOf(await clerkMemberships(firmId)));
}

async function memberOf(firmId: string, userId: string): Promise<Member | null> {
  const membership = await membershipOf(firmId, userId);
  return membership ? toMember(membership, await rolesOf(firmId, [membership])) : null;
}

async function pendingInvitations(firmId: string): Promise<PendingInvitation[]> {
  const invitations: PendingInvitation[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, totalCount } = await clerk.organizations.getOrganizationInvitationList({
      organizationId: firmId,
      status: ["pending"],
      limit: 100,
      offset,
    });
    for (const i of data) {
      // One sent from the Clerk dashboard has no role: it joins as a courier.
      const role = roleFromMetadata(i.publicMetadata) ?? "courier";
      invitations.push({ id: i.id, email: i.emailAddress, role, createdAt: new Date(i.createdAt).toISOString() });
    }
    if (offset + 100 >= totalCount) return invitations;
  }
}

function activeDepots(firmId: string) {
  return db
    .select({ id: depots.id, name: depots.name })
    .from(depots)
    .where(and(eq(depots.firmId, firmId), isNull(depots.archivedAt)))
    .orderBy(asc(depots.name));
}

/** Each dispatcher's active depots (archived ones are kept in the table but not shown or changed). */
async function depotIdsByUser(firmId: string, userIds?: string[]): Promise<Map<string, string[]>> {
  const rows = await db
    .select({ userId: dispatcherDepots.userId, depotId: dispatcherDepots.depotId })
    .from(dispatcherDepots)
    .innerJoin(depots, eq(depots.id, dispatcherDepots.depotId))
    .where(
      and(
        eq(dispatcherDepots.firmId, firmId),
        isNull(depots.archivedAt),
        userIds ? inArray(dispatcherDepots.userId, userIds) : undefined,
      ),
    )
    .orderBy(asc(depots.name));
  const byUser = new Map<string, string[]>();
  for (const r of rows) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r.depotId]);
  return byUser;
}

async function toPerson(firmId: string, member: Member): Promise<Person> {
  if (member.role !== "dispatcher") return { ...member, depotIds: [] };
  const byUser = await depotIdsByUser(firmId, [member.userId]);
  return { ...member, depotIds: byUser.get(member.userId) ?? [] };
}

const roleOrder: Record<Role, number> = { owner: 0, dispatcher: 1, mechanic: 2, courier: 3 };

export async function peopleList({ firm, firmId, userId }: { firm: Firm; firmId: string; userId: string }): Promise<PeopleList> {
  const [list, invitations, depotRows, byUser] = await Promise.all([
    members(firmId),
    pendingInvitations(firmId),
    activeDepots(firmId),
    depotIdsByUser(firmId),
  ]);
  return {
    firm,
    you: userId,
    members: list
      .map((m) => ({ ...m, depotIds: m.role === "dispatcher" ? (byUser.get(m.userId) ?? []) : [] }))
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || a.name.localeCompare(b.name)),
    invitations: invitations.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    depots: depotRows,
  };
}

/** Clerk error codes this screen answers with its own code; anything else is a 500. */
function clerkFailure(error: unknown): ApiErrorCode | null {
  if (!isClerkAPIResponseError(error)) return null;
  const code = error.errors[0]?.code ?? "";
  if (code === "already_a_member_in_organization" || code === "duplicate_record") return "exists";
  // Not seen on the dev instance (its firms have no member limit): any quota code counts.
  if (code.endsWith("quota_exceeded")) return "memberLimit";
  return null;
}

export async function invite(firmId: string, inviterId: string, input: InviteInput): Promise<Result<PendingInvitation>> {
  // Clerk replaces a pending invitation to the same email instead of refusing it, so check first.
  const [{ totalCount }, pending] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: firmId, emailAddress: [input.email], limit: 1 }),
    pendingInvitations(firmId),
  ]);
  if (totalCount > 0 || pending.some((i) => i.email.toLowerCase() === input.email)) return "exists";
  // Someone removed in the Clerk dashboard may still have a role row: drop it, so they join with the new role.
  const { data: users } = await clerk.users.getUserList({ emailAddress: [input.email], limit: 1 });
  if (users[0]) await forgetMember(firmId, users[0].id);
  try {
    const i = await clerk.organizations.createOrganizationInvitation({
      organizationId: firmId,
      emailAddress: input.email,
      role: "org:member",
      publicMetadata: { role: input.role },
      inviterUserId: inviterId,
    });
    return { id: i.id, email: i.emailAddress, role: input.role, createdAt: new Date(i.createdAt).toISOString() };
  } catch (error) {
    const code = clerkFailure(error);
    if (code) return code;
    throw error;
  }
}

/** Revokes one of this firm's pending invitations. */
export async function revokeInvitation(firmId: string, ownerId: string, id: string): Promise<Result<null>> {
  if (!INVITATION_ID.test(id)) return "notFound";
  const pending = await pendingInvitations(firmId);
  if (!pending.some((i) => i.id === id)) return "notFound";
  await clerk.organizations.revokeOrganizationInvitation({ organizationId: firmId, invitationId: id, requestingUserId: ownerId });
  return null;
}

/** The member the owner may change: in this firm, and not an owner. */
async function changeable(firmId: string, userId: string): Promise<Result<Member>> {
  const member = await memberOf(firmId, userId);
  if (!member) return "notFound";
  if (member.role === "owner") return "notEditable";
  return member;
}

/** Courier, dispatcher or mechanic. A change clears the user's depot rows, so a new dispatcher starts with none. */
export async function setRole(
  firmId: string,
  ownerId: string,
  userId: string,
  role: AssignableRole,
): Promise<Result<Person>> {
  const member = await changeable(firmId, userId);
  if (typeof member === "string") return member;
  if (member.role === role) return toPerson(firmId, member);
  await db.batch([
    setMemberRole(firmId, userId, role, ownerId),
    db.delete(dispatcherDepots).where(and(eq(dispatcherDepots.firmId, firmId), eq(dispatcherDepots.userId, userId))),
  ]);
  return { ...member, role, depotIds: [] };
}

/** Replaces a dispatcher's active depots; rows for archived depots stay. */
export async function setDepots(firmId: string, userId: string, depotIds: string[]): Promise<Result<Person>> {
  const member = await changeable(firmId, userId);
  if (typeof member === "string") return member;
  if (member.role !== "dispatcher") return "invalid";
  const active = new Set((await activeDepots(firmId)).map((d) => d.id));
  if (!depotIds.every((id) => active.has(id))) return "invalid";
  const activeIds = db
    .select({ id: depots.id })
    .from(depots)
    .where(and(eq(depots.firmId, firmId), isNull(depots.archivedAt)));
  const remove = db
    .delete(dispatcherDepots)
    .where(
      and(
        eq(dispatcherDepots.firmId, firmId),
        eq(dispatcherDepots.userId, userId),
        inArray(dispatcherDepots.depotId, activeIds),
      ),
    );
  if (depotIds.length === 0) await remove;
  else await db.batch([remove, db.insert(dispatcherDepots).values(depotIds.map((depotId) => ({ firmId, userId, depotId })))]);
  return toPerson(firmId, member);
}

/** Ends the membership. Shifts, pay entries and documents stay; only the role and depot rows (access) go. */
export async function removeMember(firmId: string, userId: string): Promise<Result<null>> {
  const member = await changeable(firmId, userId);
  if (typeof member === "string") return member;
  await clerk.organizations.deleteOrganizationMembership({ organizationId: firmId, userId });
  await forgetMember(firmId, userId);
  return null;
}
