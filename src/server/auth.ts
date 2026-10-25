// Session → firm → role, for API routes only (it reads CLERK_SECRET_KEY). Firm and user come from the verified
// Clerk session token, never from the request body or URL.
import { createClerkClient } from "@clerk/backend";

import type { ApiErrorCode } from "@/domain/types";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) throw new Error("CLERK_SECRET_KEY is not set");

const clerk = createClerkClient({ secretKey, publishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY });

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
  server: 500,
};

export function apiError(code: ApiErrorCode): Response {
  return Response.json({ error: code }, { status: statusOf[code] });
}

export type Courier = { firmId: string; userId: string };

/** The signed-in courier of the session's active firm, or the error Response to return as is. */
export async function requireCourier(request: Request): Promise<Courier | Response> {
  const state = await clerk.authenticateRequest(request, { acceptsToken: "session_token" });
  if (!state.isAuthenticated) return apiError("unauthorized");
  const { userId, orgId, orgRole } = state.toAuth();
  if (!orgId) return apiError("noFirm");
  if (orgRole !== "org:courier") return apiError("role");
  return { firmId: orgId, userId };
}

export type Reviewer = { firmId: string; userId: string; role: "dispatcher" | "owner" };

/** A signed-in dispatcher or owner of the session's active firm, or the error Response to return as is. */
export async function requireReviewerSession(request: Request): Promise<Reviewer | Response> {
  const state = await clerk.authenticateRequest(request, { acceptsToken: "session_token" });
  if (!state.isAuthenticated) return apiError("unauthorized");
  const { userId, orgId, orgRole } = state.toAuth();
  if (!orgId) return apiError("noFirm");
  if (orgRole === "org:dispatcher") return { firmId: orgId, userId, role: "dispatcher" };
  if (orgRole === "org:owner") return { firmId: orgId, userId, role: "owner" };
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

/** User IDs of the firm's `org:courier` members, every page. */
export async function firmCouriers(firmId: string): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const { data, totalCount } = await clerk.organizations.getOrganizationMembershipList({
      organizationId: firmId,
      role: ["org:courier"],
      limit: 100,
      offset,
    });
    for (const m of data) if (m.publicUserData?.userId) ids.push(m.publicUserData.userId);
    if (offset + 100 >= totalCount) return ids;
  }
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
