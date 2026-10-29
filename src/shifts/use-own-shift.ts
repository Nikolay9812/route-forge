import { useCallback } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource } from "@/api/use-resource";
import type { Bus, Firm, Shift, ShiftPhotos, ShiftPhotoSlot, Station } from "@/domain/types";

import type { EditBody } from "./edit";

export type OwnShift = {
  firm: Firm;
  shift: Shift;
  photos: ShiftPhotos;
  expiredPhotos: ShiftPhotoSlot[];
  stations: Station[];
  buses: Bus[];
};

/** One of the courier's own shifts by id, and fixing it while it's rejected. */
export function useOwnShift(id: string) {
  const api = useApi();
  const own = useResource<OwnShift>(`/api/shifts/${id}`);
  const { replace, reload } = own;

  /** Saves the changes (if any), then resubmits. Resolves the failure, or null once submitted. */
  const resubmit = useCallback(
    async (changes: EditBody): Promise<ApiFailure | null> => {
      try {
        if (Object.keys(changes).length > 0) {
          const fixed = await api<Shift>(`/api/shifts/${id}`, { method: "PATCH", body: changes });
          replace((data) => ({ ...data, shift: fixed }));
        }
        const submitted = await api<Shift>(`/api/shifts/${id}/submit`, { method: "POST" });
        replace((data) => ({ ...data, shift: submitted }));
        return null;
      } catch (error) {
        const failure = failureOf(error);
        if (failure === "notEditable") reload();
        return failure;
      }
    },
    [api, id, replace, reload],
  );

  return { ...own, resubmit };
}
