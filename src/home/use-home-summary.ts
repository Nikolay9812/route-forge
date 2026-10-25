import { useCallback, useEffect, useState } from "react";

import { failureOf, useApi } from "@/api/client";
import { hourIn } from "@/domain/dates";
import type { MonthTotals } from "@/domain/salary";
import type { CourierRate, Firm, Shift } from "@/domain/types";

export type HomeData = {
  firm: Firm;
  /** Today's calendar day in the firm's timezone. */
  date: string;
  today: Shift | null;
  /** Up to five shifts before today, newest first. */
  recent: Shift[];
  /** This month, approved shifts only (pendingCount aside). */
  totals: MonthTotals;
  /** The courier's own pay rate today and the next scheduled change. */
  rate: CourierRate;
};

/** hour is the firm-local hour for the greeting (the device's when the firm didn't load). `role`: the user's role has no Home of its own yet. */
export type HomeSummary =
  | { status: "loading" }
  | { status: "ready"; hour: number; data: HomeData }
  | { status: "error" | "offline" | "role"; hour: number };

/**
 * Home's data from `GET /api/home`. `refresh` keeps what's on screen while reloading (pull to refresh);
 * `retry` goes back to loading. A failed refresh keeps the old data.
 */
export function useHomeSummary() {
  const api = useApi();
  const [summary, setSummary] = useState<HomeSummary>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async (): Promise<HomeSummary> => {
    try {
      const data = await api<HomeData>("/api/home");
      return { status: "ready", hour: hourIn(data.firm.timeZone), data };
    } catch (error) {
      const failure = failureOf(error);
      return {
        status: failure === "offline" ? "offline" : failure === "role" ? "role" : "error",
        hour: new Date().getHours(),
      };
    }
  }, [api]);

  useEffect(() => {
    let current = true;
    load().then((next) => {
      if (!current) return;
      setSummary((previous) => (next.status !== "ready" && previous.status === "ready" ? previous : next));
      setRefreshing(false);
    });
    return () => {
      current = false;
    };
  }, [load, attempt]);

  return {
    summary,
    refreshing,
    refresh: () => {
      setRefreshing(true);
      setAttempt((a) => a + 1);
    },
    retry: () => {
      setSummary({ status: "loading" });
      setAttempt((a) => a + 1);
    },
  };
}
