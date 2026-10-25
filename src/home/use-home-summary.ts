import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { hourIn, todayIn } from "@/domain/dates";
import { monthTotals, type MonthTotals } from "@/domain/salary";
import type { Firm, Shift } from "@/domain/types";

import { sampleFirm, sampleMonth, sampleRates, sampleScenarios, type SampleScenario } from "./sample";

export type HomeData = {
  firm: Firm;
  /** Today's calendar day in the firm's timezone. */
  date: string;
  today: Shift | null;
  /** Up to five shifts before today, newest first. */
  recent: Shift[];
  /** This month, approved shifts only (pendingCount aside). */
  totals: MonthTotals;
};

/** hour is the firm-local hour for the greeting. Both it and the date are read after mount, so web hydration matches. */
export type HomeSummary =
  | { status: "loading" }
  | { status: "ready"; hour: number; data: HomeData }
  | { status: "error" | "offline"; hour: number };

function isScenario(value: unknown): value is SampleScenario {
  return sampleScenarios.includes(value as SampleScenario);
}

function load(scenario: SampleScenario): Exclude<HomeSummary, { status: "loading" }> {
  const firm = sampleFirm;
  const hour = hourIn(firm.timeZone);
  if (scenario === "error" || scenario === "offline") return { status: scenario, hour };

  const date = todayIn(firm.timeZone);
  const month = scenario === "empty" ? { today: null, past: [] } : sampleMonth(date);
  const shifts = month.today ? [month.today, ...month.past] : month.past;
  return {
    status: "ready",
    hour,
    data: { firm, date, today: month.today, recent: month.past.slice(0, 5), totals: monthTotals(shifts, sampleRates(date)) },
  };
}

/**
 * Home's data. Sample data for now: the shifts-API plan replaces the body and keeps this shape.
 * In development, `?sample=empty|error|offline` switches scenario.
 * `refresh` keeps what's on screen while reloading (pull to refresh); `retry` goes back to loading.
 */
export function useHomeSummary() {
  const { sample } = useLocalSearchParams<{ sample?: string }>();
  const scenario: SampleScenario = __DEV__ && isScenario(sample) ? sample : "full";
  const [summary, setSummary] = useState<HomeSummary>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Stands in for the network round trip, so the loading state is visible.
    const timer = setTimeout(() => {
      setSummary(load(scenario));
      setRefreshing(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [scenario, attempt]);

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
