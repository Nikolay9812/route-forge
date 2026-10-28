// The user's firm (a Clerk Organization) and role in it. With no active firm, the first membership is activated
// so session tokens carry it. Users with no membership see their pending invitations to accept. The role lives in
// our database: FirmProvider asks `GET /api/me` once per user and firm, and again when the app comes back to the
// foreground, so a role change reaches the app then (the server applies it at once).
import { useAuth as useClerkAuth, useOrganizationList, useSession } from "@clerk/expo";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import type { MeView } from "@/domain/types";

export type FirmRole = "owner" | "dispatcher" | "courier" | "mechanic";

export type FirmInvitation = { id: string; firmName: string };

export type FirmState =
  | { status: "loading" }
  | { status: "none"; invitations: FirmInvitation[] }
  | { status: "error"; code: "offline" | "server" }
  | { status: "ready"; firmId: string; role: FirmRole };

/** Dispatchers and owners review shifts; everyone else logs their own. */
export function isReviewer(role: FirmRole | null): boolean {
  return role === "dispatcher" || role === "owner";
}

/** The active firm's ID, or null before one is active. Cheaper than useFirm when only the ID matters. */
export function useFirmId(): string | null {
  return useClerkAuth().orgId ?? null;
}

/** The role answer for one user in one firm (`key`), so a stale answer never shows for someone else. */
type RoleAnswer = { key: string; role: FirmRole } | { key: string; failure: "offline" | "server" };

function useFirmState() {
  const { isLoaded, orgId, userId } = useClerkAuth();
  const list = useOrganizationList({ userMemberships: true, userInvitations: { status: "pending" } });
  const memberships = list.userMemberships.data;
  const invitations = list.userInvitations.data;
  const firstFirm = memberships?.[0]?.organization.id;
  const { setActive } = list;
  const getToken = useSessionToken();
  const [answer, setAnswer] = useState<RoleAnswer | null>(null);
  const key = isLoaded && orgId && userId ? `${userId}:${orgId}` : null;
  const keyRef = useRef(key);

  // Before the effect that loads the role, which runs after it in the same commit.
  useEffect(() => {
    keyRef.current = key;
  }, [key]);

  useEffect(() => {
    if (isLoaded && !orgId && firstFirm && setActive) void setActive({ organization: firstFirm });
  }, [isLoaded, orgId, firstFirm, setActive]);

  /** Asks the server for the role. A failed refresh keeps a role already shown; only a first failure shows. */
  const loadRole = useCallback(async () => {
    const asked = keyRef.current;
    if (!asked) return;
    let next: RoleAnswer;
    try {
      // Refreshing an expired token is a network call too, so its failure also means offline.
      const token = await getToken();
      const response = await fetch("/api/me", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const body = (await response.json().catch(() => null)) as MeView | null;
      next = response.ok && body?.role ? { key: asked, role: body.role } : { key: asked, failure: "server" };
    } catch {
      next = { key: asked, failure: "offline" };
    }
    if (keyRef.current !== asked) return;
    setAnswer((current) => ("failure" in next && current?.key === asked && "role" in current ? current : next));
  }, [getToken]);

  useEffect(() => {
    if (key) void loadRole();
  }, [key, loadRole]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void loadRole();
    });
    return () => subscription.remove();
  }, [loadRole]);

  let state: FirmState;
  if (key) {
    const current = answer?.key === key ? answer : null;
    if (!current) state = { status: "loading" };
    else if ("role" in current) state = { status: "ready", firmId: orgId!, role: current.role };
    else state = { status: "error", code: current.failure };
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
    await Promise.all([userMemberships.revalidate?.(), userInvitations.revalidate?.(), loadRole()]);
  }, [userMemberships, userInvitations, loadRole]);

  /** Shows the spinner again and asks for the role once more (after an error). */
  const retry = useCallback(() => {
    setAnswer(null);
    void refresh();
  }, [refresh]);

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

  return { firm: state, refresh, retry, accept };
}

const FirmContext = createContext<ReturnType<typeof useFirmState> | null>(null);

/** Holds the firm and role for every screen, so they're asked for once. Mounted in the root layout. */
export function FirmProvider({ children }: { children: ReactNode }) {
  return <FirmContext.Provider value={useFirmState()}>{children}</FirmContext.Provider>;
}

export function useFirm() {
  const value = useContext(FirmContext);
  if (!value) throw new Error("useFirm needs FirmProvider");
  return value;
}

/** A fresh session token for API calls (it carries the active firm), or null when signed out. */
export function useSessionToken() {
  const { session } = useSession();
  return useCallback(async () => (session ? session.getToken() : null), [session]);
}
