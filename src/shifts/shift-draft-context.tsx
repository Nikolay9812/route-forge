import { createContext, useContext, useMemo, useReducer, type PropsWithChildren } from "react";

import { emptyDraft, type ShiftDraft, type ShiftFields } from "./draft";

// In memory only: it survives tab switches and resets when the app reloads. The shifts API plan replaces it.
type Action =
  | { type: "set"; fields: Partial<ShiftFields> }
  | { type: "start"; at: number }
  | { type: "setStartTime"; at: number }
  | { type: "submitted"; at: number }
  | { type: "reset" };

function reducer(draft: ShiftDraft, action: Action): ShiftDraft {
  switch (action.type) {
    case "set":
      return draft.phase === "submitted" ? draft : { ...draft, ...action.fields };
    case "start":
      return { ...draft, phase: "inProgress", startedAt: action.at };
    case "setStartTime":
      return { ...draft, startedAt: action.at };
    case "submitted":
      return { ...draft, phase: "submitted", finishedAt: action.at };
    case "reset":
      return emptyDraft;
  }
}

export class OfflineError extends Error {}

type ShiftDraftValue = {
  draft: ShiftDraft;
  set: (fields: Partial<ShiftFields>) => void;
  start: () => void;
  setStartTime: (at: number) => void;
  /** Stands in for the API call. `offline` simulates a lost connection; nothing typed is lost. */
  submit: (options?: { offline?: boolean }) => Promise<void>;
  reset: () => void;
};

const ShiftDraftContext = createContext<ShiftDraftValue | null>(null);

export function ShiftDraftProvider({ children }: PropsWithChildren) {
  const [draft, dispatch] = useReducer(reducer, emptyDraft);

  const value = useMemo<ShiftDraftValue>(
    () => ({
      draft,
      set: (fields) => dispatch({ type: "set", fields }),
      start: () => dispatch({ type: "start", at: Date.now() }),
      setStartTime: (at) => dispatch({ type: "setStartTime", at }),
      submit: async (options) => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (options?.offline) throw new OfflineError();
        dispatch({ type: "submitted", at: Date.now() });
      },
      reset: () => dispatch({ type: "reset" }),
    }),
    [draft],
  );

  return <ShiftDraftContext.Provider value={value}>{children}</ShiftDraftContext.Provider>;
}

export function useShiftDraft(): ShiftDraftValue {
  const value = useContext(ShiftDraftContext);
  if (!value) throw new Error("useShiftDraft must be used inside ShiftDraftProvider.");
  return value;
}
