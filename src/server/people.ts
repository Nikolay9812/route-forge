// The owner's People screen: Clerk holds memberships, roles and invitations; Postgres holds only which depots a
// dispatcher manages. Owners hand out courier and dispatcher; any change to an owner answers notEditable.
// Emails are personal data: never logged (handle() logs only the error's name).
import { isClerkAPIResponseError } from "@clerk/backend/errors";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/db";
import { depots, dispatcherDepots } from "@/db/schema";
import type { AssignableRole, InviteInput } from "@/domain/people";
import type { ApiErrorCode, Firm, PendingInvitation, PeopleList, Person } from "@/domain/types";

import { clerk } from "./auth";

type Result<T> = T | ApiErrorCode;
type Role = Person["role"];

const fromClerk: Record<string, Role> = {
  "org:owner": "owner",
  "org:dispatcher": "dispatcher",
  "org:courier": "courier",
  "org:mechanic": "mechanic",
};
const toClerk: Record<AssignableRole, string> = {
  courier: "org:courier",
  dispatcher: "org:dispatcher",
  mechanic: "org:mechanic",
};

const USER_ID = /^user_[A-Za-z0-9]+$/;
const INVITATION_ID = /^orginv_[A-Za-z0-9]+$/;

type Member = Omit<Person, "depotIds">;
type ClerkMembership = Awaited<ReturnType<typeof clerk.organizations.getOrganizationMembershipList>>["data"][number];

function toMember(m: ClerkMembership): Member | null {
  const user = m.publicUserData;
  const role = fromClerk[m.role];
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

/** Every member of the firm in any role, every page. */
export async function memberships(firmId: string): Promise<Member[]> {
  const members: Member[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, totalCount } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: firmId,
      limit: 100,
      offset,
    });
    for (const m of data) {
      const member = toMember(m);
      if (member) members.push(member);
    }
    if (offset + 100 >= totalCount) return members;
  }
}

/** User IDs of everyone who is a member of the firm in any role. */
export async function memberIds(firmId: string): Promise<Set<string>> {
  return new Set((await memberships(firmId)).map((m) => m.userId));
}

async function memberOf(firmId: string, userId: string): Promise<Member | null> {
  if (!USER_ID.test(userId)) return null;
  const { data } = await clerk.organizations.getOrganizationMembershipList({ organizationId: firmId, userId: [userId] });
  return data[0] ? toMember(data[0]) : null;
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
      const role = fromClerk[i.role];
      if (role && role !== "owner")
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
  const [members, invitations, depotRows, byUser] = await Promise.all([
    memberships(firmId),
    pendingInvitations(firmId),
    activeDepots(firmId),
    depotIdsByUser(firmId),
  ]);
  return {
    firm,
    you: userId,
    members: members
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
  try {
    const i = await clerk.organizations.createOrganizationInvitation({
      organizationId: firmId,
      emailAddress: input.email,
      role: toClerk[input.role],
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

function clearDepots(firmId: string, userId: string) {
  return db.delete(dispatcherDepots).where(and(eq(dispatcherDepots.firmId, firmId), eq(dispatcherDepots.userId, userId)));
}

/** Courier ↔ dispatcher. A change clears the user's depot rows, so a new dispatcher starts with none. */
export async function setRole(firmId: string, userId: string, role: AssignableRole): Promise<Result<Person>> {
  const member = await changeable(firmId, userId);
  if (typeof member === "string") return member;
  if (member.role === role) return toPerson(firmId, member);
  await clerk.organizations.updateOrganizationMembership({ organizationId: firmId, userId, role: toClerk[role] });
  await clearDepots(firmId, userId);
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

/** Ends the membership. Shifts, pay entries and documents stay; only the depot rows (access) go. */
export async function removeMember(firmId: string, userId: string): Promise<Result<null>> {
  const member = await changeable(firmId, userId);
  if (typeof member === "string") return member;
  await clerk.organizations.deleteOrganizationMembership({ organizationId: firmId, userId });
  await clearDepots(firmId, userId);
  return null;
}
