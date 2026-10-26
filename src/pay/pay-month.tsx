// The courier's pay, one month at a time, for the Pay stack: the Pay screen and its breakdown sheet share one
// loaded, paged state, so the sheet opens on data that's already there.
import { createContext, useContext, useState, type PropsWithChildren } from "react";

import { useCalendar } from "@/calendar/use-calendar";
import type { PayMonth } from "@/domain/types";

function usePayMonthState() {
  const state = useCalendar<PayMonth>("/api/pay");
  // The answer on screen when a pull to refresh started: it ends with a newer answer or a failure. A failed
  // refresh keeps the month on screen.
  const [refreshedFrom, setRefreshedFrom] = useState<PayMonth | null>(null);
  const { latest, failure, retry } = state;

  return {
    ...state,
    refreshing: refreshedFrom !== null && refreshedFrom === latest && failure === null,
    refresh: () => {
      setRefreshedFrom(latest);
      retry();
    },
  };
}

type PayMonthState = ReturnType<typeof usePayMonthState>;

const PayMonthContext = createContext<PayMonthState | null>(null);

export function PayMonthProvider({ children }: PropsWithChildren) {
  return <PayMonthContext.Provider value={usePayMonthState()}>{children}</PayMonthContext.Provider>;
}

export function usePayMonth(): PayMonthState {
  const value = useContext(PayMonthContext);
  if (!value) throw new Error("usePayMonth must be used inside PayMonthProvider.");
  return value;
}
