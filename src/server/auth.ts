// Session → firm → role, for API routes only (it reads CLERK_SECRET_KEY). Firm and user come from the verified
// Clerk session token, never from the request body or URL; the role comes from `firm_members` (see ./members).
import type { ApiErrorCode } from "@/domain/types";

import { clerk } from "./clerk";
import { clerkMemberships, rolesOf, roleOf, type MemberRole } from "./members";

export { clerk };

// No `authorizedParties`: Clerk then refuses any token without an `azp` claim, and native app session tokens have
// none (there's no web origin), so it would lock the app out.
/** The verified session's user and active org, or null when the request has no valid session token. */
async function authenticate(request: Request) {
  const state = await clerk.authenticateRequest(request, { acceptsToken: "session_token" });
  return state.isAuthenticated ? state.toAuth() : null;
}

const statusOf: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  noFirm: 403,
  role: 403,
  firmNotSetUp: 403,
  invalid: 400,
  notFound: 404,
  exists: 409,
  notEditable: 409,
  endKmMissing: 409,
  endBelowStart: 409,
  returnedAboveLoaded: 409,
  taken: 409,
  depotHasCars: 409,
  memberLimit: 409,
  server: 500,
};

export function apiError(code: ApiErrorCode): Response {
  return Response.json({ error: code }, { status: statusOf[code] });
}

/** The signed-in user, with or without a firm (deleting one's own account), or the error Response to return as is. */
export async function requireSession(request: Request): Promise<{ userId: string } | Response> {
  const session = await authenticate(request);
  if (!session) return apiError("unauthorized");
  return { userId: session.userId };
}

type FirmSession = { firmId: string; userId: string; role: MemberRole };

/**
 * The session's user, active firm and their role in it, or the error Response to return as is. The token's active
 * org proves the Clerk membership (a member removed in Clerk loses it within a minute); a role row alone gives nothing.
 */
export async function requireFirmSession(request: Request): Promise<FirmSession | Response> {
  const session = await authenticate(request);
  if (!session) return apiError("unauthorized");
  const { userId, orgId } = session;
  if (!orgId) return apiError("noFirm");
  const role = await roleOf(orgId, userId);
  if (!role) return apiError("noFirm");
  return { firmId: orgId, userId, role };
}

export type Courier = { firmId: string; userId: string };

/** The signed-in courier of the session's active firm, or the error Response to return as is. */
export async function requireCourier(request: Request): Promise<Courier | Response> {
  const session = await requireFirmSession(request);
  if (session instanceof Response) return session;
  if (session.role !== "courier") return apiError("role");
  return { firmId: session.firmId, userId: session.userId };
}

export type Reviewer = { firmId: string; userId: string; role: "dispatcher" | "owner" };

/** A signed-in dispatcher or owner of the session's active firm, or the error Response to return as is. */
export async function requireReviewerSession(request: Request): Promise<Reviewer | Response> {
  const session = await requireFirmSession(request);
  if (session instanceof Response) return session;
  const { firmId, userId, role } = session;
  if (role === "dispatcher" || role === "owner") return { firmId, userId, role };
  return apiError("role");
}

export type Owner = { firmId: string; userId: string };

/** The signed-in owner of the session's active firm, or the error Response to return as is. */
export async function requireOwner(request: Request): Promise<Owner | Response> {
  const session = await requireFirmSession(request);
  if (session instanceof Response) return session;
  if (session.role !== "owner") return apiError("role");
  return { firmId: session.firmId, userId: session.userId };
}

export type GarageUser = { firmId: string; userId: string; role: "mechanic" | "owner" };

/** A signed-in mechanic or owner of the session's active firm (the cars and the service log), or the error. */
export async function requireGarageSession(request: Request): Promise<GarageUser | Response> {
  const session = await requireFirmSession(request);
  if (session instanceof Response) return session;
  const { firmId, userId, role } = session;
  if (role === "mechanic" || role === "owner") return { firmId, userId, role };
  return apiError("role");
}

const NAME_TTL = 10 * 60_000;
const names = new Map<string, { name: string; at: number }>();

/** Display names for Clerk user IDs ("First Last", else the email), cached for ten minutes per process. */
export async function userNames(ids: string[]): Promise<Map<string, string>> {
  const now = Date.now();
  const missing = [...new Set(ids)].filter((id) => {
    const hit = names.get(id);
    return !hit || now - hit.at > NAME_TTL;
  });
  if (missing.length > 0) {
    const { data } = await clerk.users.getUserList({ userId: missing, limit: missing.length });
    for (const user of data) {
      const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
      names.set(user.id, { name: full || user.primaryEmailAddress?.emailAddress || user.id, at: now });
    }
  }
  return new Map(ids.map((id) => [id, names.get(id)?.name ?? ""]));
}

/** User IDs of the firm's current members whose role is courier. */
export async function firmCouriers(firmId: string): Promise<string[]> {
  const roles = await rolesOf(firmId, await clerkMemberships(firmId));
  return [...roles].flatMap(([userId, role]) => (role === "courier" ? [userId] : []));
}

const firmNames = new Map<string, string>();

/** The firm's display name from its Clerk Organization, cached per server process. */
export async function firmName(firmId: string): Promise<string> {
  const cached = firmNames.get(firmId);
  if (cached) return cached;
  const org = await clerk.organizations.getOrganization({ organizationId: firmId });
  firmNames.set(firmId, org.name);
  return org.name;
}

/**
 * Runs a route body and turns anything unexpected into a bare 500. Only the error's name is logged, never its
 * message: database errors can quote values, and salary data must never reach logs.
 */
export async function handle(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run();
  } catch (error) {
    console.error(`API error: ${error instanceof Error ? error.name : "unknown"}`);
    return apiError("server");
  }
}

/** The request's JSON body, or undefined when it isn't valid JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}
