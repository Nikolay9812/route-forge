// The user's firm (a Clerk Organization) and role in it. With no active firm, the first membership is activated
// so session tokens carry it. Users with no membership see their pending invitations to accept.
import { useAuth as useClerkAuth, useOrganizationList, useSession } from "@clerk/expo";
import { useCallback, useEffect } from "react";

export type FirmRole = "owner" | "dispatcher" | "courier" | "mechanic";

export type FirmInvitation = { id: string; firmName: string };

export type FirmState =
  | { status: "loading" }
  | { status: "none"; invitations: FirmInvitation[] }
  | { status: "ready"; firmId: string; role: FirmRole | null };

/** Dispatchers and owners review shifts; everyone else logs their own. */
export function isReviewer(role: FirmRole | null): boolean {
  return role === "dispatcher" || role === "owner";
}

const roles: Record<string, FirmRole> = {
  "org:owner": "owner",
  "org:dispatcher": "dispatcher",
  "org:courier": "courier",
  "org:mechanic": "mechanic",
};

export function useFirm() {
  const { isLoaded, orgId, orgRole } = useClerkAuth();
  const list = useOrganizationList({ userMemberships: true, userInvitations: { status: "pending" } });
  const memberships = list.userMemberships.data;
  const invitations = list.userInvitations.data;
  const firstFirm = memberships?.[0]?.organization.id;
  const { setActive } = list;

  useEffect(() => {
    if (isLoaded && !orgId && firstFirm && setActive) void setActive({ organization: firstFirm });
  }, [isLoaded, orgId, firstFirm, setActive]);

  let state: FirmState;
  if (isLoaded && orgId) {
    state = { status: "ready", firmId: orgId, role: (orgRole && roles[orgRole]) || null };
  } else if (!isLoaded || !list.isLoaded || memberships === undefined || firstFirm) {
    // Still loading, or the first membership is being activated.
    state = { status: "loading" };
  } else {
    state = {
      status: "none",
      invitations: (invitations ?? []).map((i) => ({ id: i.id, firmName: i.publicOrganizationData.name })),
    };
  }

  const { userMemberships, userInvitations } = list;
  const refresh = useCallback(async () => {
    await Promise.all([userMemberships.revalidate?.(), userInvitations.revalidate?.()]);
  }, [userMemberships, userInvitations]);

  /** Accepts an invitation; resolves false when it failed (offline, already used). */
  const accept = useCallback(
    async (id: string) => {
      const invitation = userInvitations.data?.find((i) => i.id === id);
      if (!invitation) return false;
      try {
        await invitation.accept();
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [userInvitations, refresh],
  );

  return { firm: state, refresh, accept };
}

/** A fresh session token for API calls (it carries the active firm and role), or null when signed out. */
export function useSessionToken() {
  const { session } = useSession();
  return useCallback(async () => (session ? session.getToken() : null), [session]);
}
