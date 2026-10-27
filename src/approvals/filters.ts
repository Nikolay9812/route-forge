// The Approvals filters and sort, remembered on this phone per firm (SecureStore), so switching firms never applies
// another firm's IDs. Saved as the list's own query string and read back through the server's parser, so anything
// malformed is dropped. Not on web: SecureStore isn't there, and the first render must match the server's.
import * as SecureStore from "expo-secure-store";
import { useCallback, useState } from "react";
import { Platform } from "react-native";

import { useFirmId } from "@/auth";
import { emptyReviewFilters, parseReviewQuery, reviewQuery, type ReviewFilters } from "@/domain/review-filters";

const keyOf = (firmId: string) => `approvalsFilters.${firmId}`;

function load(firmId: string | null): ReviewFilters {
  if (Platform.OS === "web" || !firmId) return emptyReviewFilters;
  try {
    const saved = SecureStore.getItem(keyOf(firmId));
    return (saved && parseReviewQuery(new URLSearchParams(saved))?.filters) || emptyReviewFilters;
  } catch {
    return emptyReviewFilters;
  }
}

function save(firmId: string | null, filters: ReviewFilters) {
  if (Platform.OS === "web" || !firmId) return;
  // "reviewed" keeps the status too. A failed save still filters for this session.
  SecureStore.setItemAsync(keyOf(firmId), reviewQuery("reviewed", filters)).catch(() => {});
}

export function useApprovalFilters() {
  const firmId = useFirmId();
  const [state, setState] = useState(() => ({ firmId, filters: load(firmId) }));

  // Another firm became active: start from what was saved for it (state adjusted while rendering).
  if (state.firmId !== firmId) setState({ firmId, filters: load(firmId) });

  const setFilters = useCallback(
    (update: (filters: ReviewFilters) => ReviewFilters) =>
      setState((previous) => {
        const filters = update(previous.filters);
        save(previous.firmId, filters);
        return { ...previous, filters };
      }),
    [],
  );

  return { filters: state.filters, setFilters };
}
