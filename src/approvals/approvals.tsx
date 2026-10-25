// Data for the dispatcher's and owner's Approvals stack. A shared revision makes the list and the detail screen
// reload after a decision made elsewhere in the stack (e.g. the reject sheet).
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useRef, useState, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource } from "@/api/use-resource";
import type { Bus, Firm, PayKind, RejectReason, ReviewItem, Shift, ShiftChange, Station } from "@/domain/types";
import type { EditBody } from "@/shifts/edit";

export type ApprovalsView = "pending" | "reviewed";

export type ApprovalList = { firm: Firm; pendingCount: number; items: ReviewItem[] };

export type ApprovalDetail = {
  firm: Firm;
  shift: Shift;
  courierName: string;
  /** Pay for this shift at the rate on its day; null when the courier has no rate yet. */
  pay: { kind: PayKind; amountMinor: number; payMinor: number } | null;
  changes: ShiftChange[];
  stations: Station[];
  buses: Bus[];
};

const RevisionContext = createContext<{ revision: number; bump: () => void }>({ revision: 0, bump: () => {} });

export function ApprovalsProvider({ children }: PropsWithChildren) {
  const [revision, setRevision] = useState(0);
  const bump = useCallback(() => setRevision((r) => r + 1), []);
  return <RevisionContext.Provider value={{ revision, bump }}>{children}</RevisionContext.Provider>;
}

/** Reloads quietly whenever the screen comes back into focus, but not on its first focus. */
function useQuietReloadOnFocus(reload: (quiet?: boolean) => void) {
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
}

export function useApprovalList(view: ApprovalsView) {
  const { revision } = useContext(RevisionContext);
  const list = useResource<ApprovalList>(`/api/approvals?view=${view}`, revision);
  useQuietReloadOnFocus(list.reload);
  return list;
}

/** Approve, reject and correct one shift. Every success (and a lost race) reloads the stack's screens. */
export function useReviewActions(id: string) {
  const api = useApi();
  const { bump } = useContext(RevisionContext);

  /** Resolves the failure, or null once done. A 409 means someone else got there first: reload. */
  const act = useCallback(
    async (request: () => Promise<unknown>): Promise<ApiFailure | null> => {
      try {
        await request();
        bump();
        return null;
      } catch (error) {
        const failure = failureOf(error);
        if (failure === "notEditable" || failure === "notFound") bump();
        return failure;
      }
    },
    [bump],
  );

  const approve = useCallback(
    () => act(() => api<Shift>(`/api/approvals/${id}`, { method: "POST", body: { action: "approve" } })),
    [act, api, id],
  );
  const reject = useCallback(
    (reasons: RejectReason[], note: string | null) =>
      act(() => api<Shift>(`/api/approvals/${id}`, { method: "POST", body: { action: "reject", reasons, note } })),
    [act, api, id],
  );
  const correct = useCallback(
    (body: EditBody) => act(() => api<Shift>(`/api/approvals/${id}`, { method: "PATCH", body })),
    [act, api, id],
  );

  return { approve, reject, correct };
}

export function useApprovalDetail(id: string) {
  const { revision } = useContext(RevisionContext);
  const detail = useResource<ApprovalDetail>(`/api/approvals/${id}`, revision);
  return { ...detail, ...useReviewActions(id) };
}
