// One courier's month (calendar or pay), paged by month. Months already loaded stay in memory, so paging back and forth
// doesn't refetch; coming back to the screen or a new `revision` reloads the shown month quietly.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { addMonths } from "@/domain/calendar";
import { monthOf } from "@/domain/dates";

/** What paging needs from any month answer. */
export type PagedMonth = { month: string; today: string; firstMonth: string };

export type CalendarState<T extends PagedMonth> = {
  /** The shown month, null until the first answer says which month is current. */
  month: string | null;
  data: T | null;
  /** The newest answer of any month: firm, today and where paging stops. */
  latest: T | null;
  failure: ApiFailure | null;
  canPrev: boolean;
  canNext: boolean;
  prev: () => void;
  /** Shows that month ("YYYY-MM"); ignored outside firstMonth…the current month. */
  goTo: (month: string) => void;
  next: () => void;
  retry: () => void;
};

/** `base` is the API path without the month, e.g. "/api/calendar", "/api/team/<userId>" or "/api/pay". */
export function useCalendar<T extends PagedMonth>(base: string, revision: unknown = 0): CalendarState<T> {
  const api = useApi();
  const [month, setMonth] = useState<string | null>(null);
  const [months, setMonths] = useState<Record<string, T>>({});
  const [latest, setLatest] = useState<T | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  // Which reload each cached month was fetched in: a month is fetched again only after a reload.
  const fetchedIn = useRef<Record<string, string>>({});
  const generation = `${attempt}:${String(revision)}`;

  useEffect(() => {
    if (month && fetchedIn.current[month] === generation) return;
    let live = true;
    setFailure(null);
    api<T>(month ? `${base}?month=${month}` : base).then(
      (data) => {
        if (!live) return;
        fetchedIn.current[data.month] = generation;
        setMonths((all) => ({ ...all, [data.month]: data }));
        setLatest(data);
        if (!month) setMonth(data.month);
      },
      (error) => {
        if (live) setFailure(failureOf(error));
      },
    );
    return () => {
      live = false;
    };
  }, [api, base, month, generation]);

  // Quietly reload the shown month when the screen comes back into focus, but not on its first focus.
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) setAttempt((a) => a + 1);
      focusedBefore.current = true;
    }, []),
  );

  const current = latest ? monthOf(latest.today) : null;
  const canPrev = !!latest && !!month && month > latest.firstMonth;
  const canNext = !!current && !!month && month < current;

  return {
    month,
    data: month ? (months[month] ?? null) : null,
    latest,
    failure,
    canPrev,
    canNext,
    prev: useCallback(() => setMonth((m) => (m ? addMonths(m, -1) : m)), []),
    next: useCallback(() => setMonth((m) => (m ? addMonths(m, 1) : m)), []),
    goTo: useCallback(
      (target: string) => {
        if (latest && target >= latest.firstMonth && target <= monthOf(latest.today)) setMonth(target);
      },
      [latest],
    ),
    retry: useCallback(() => setAttempt((a) => a + 1), []),
  };
}
