// Today's shift for the Shifts stack (form and finish sheet): loaded from the API, started, autosaved while the
// courier types, and submitted. What the courier typed always stays on screen, whatever the network does.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import type { Bus, Firm, Shift, Station } from "@/domain/types";

import { emptyFields, fieldsOf, patchOf, type FieldName, type ShiftFields } from "./draft";

type TodayResponse = {
  firm: Firm;
  date: string;
  shift: Shift | null;
  /** Up to five shifts before today, newest first. */
  recent: Shift[];
  stations: Station[];
  buses: Bus[];
};

export type TodayLoad =
  | { status: "loading" }
  | ({ status: "ready" } & Omit<TodayResponse, "shift">)
  | { status: "error" | "offline" | "role" | "firmNotSetUp" };

export type ShiftPhase = "notStarted" | "inProgress" | "submitted";

/** The autosave line under the form. */
export type SaveState = "idle" | "saving" | "saved" | "offline" | "error";

const AUTOSAVE_DELAY = 800;

function phaseOf(shift: Shift | null): ShiftPhase {
  if (!shift) return "notStarted";
  return shift.status === "draft" || shift.status === "rejected" ? "inProgress" : "submitted";
}

function loadFailure(failure: ApiFailure): Exclude<TodayLoad["status"], "loading" | "ready"> {
  return failure === "offline" || failure === "role" || failure === "firmNotSetUp" ? failure : "error";
}

function useTodayShiftState() {
  const api = useApi();
  const [load, setLoad] = useState<TodayLoad>({ status: "loading" });
  const [shift, setShift] = useState<Shift | null>(null);
  const [fields, setFields] = useState<ShiftFields>(emptyFields);
  const [save, setSave] = useState<SaveState>("idle");
  const [attempt, setAttempt] = useState(0);

  // Autosave bookkeeping, read only in callbacks: the latest fields, which ones the server hasn't got yet,
  // the debounce timer and the save in progress (saves run one at a time).
  const latest = useRef(fields);
  const dirty = useRef(new Set<FieldName>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<ApiFailure | null> | null>(null);

  useEffect(() => {
    let current = true;
    api<TodayResponse>("/api/shifts/today").then(
      ({ shift: loaded, ...rest }) => {
        if (!current) return;
        const next = loaded ? fieldsOf(loaded) : emptyFields;
        latest.current = next;
        dirty.current.clear();
        setShift(loaded);
        setFields(next);
        setSave("idle");
        setLoad({ status: "ready", ...rest });
      },
      (error) => {
        if (current) setLoad({ status: loadFailure(failureOf(error)) });
      },
    );
    return () => {
      current = false;
    };
  }, [api, attempt]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const reload = useCallback(() => {
    setLoad({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  /** Sends every unsaved field now. Resolves null when everything is saved, or why it isn't. */
  const flush = useCallback(async (): Promise<ApiFailure | null> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (saving.current) await saving.current;
    const names = [...dirty.current];
    if (names.length === 0) return null;
    const sent = latest.current;
    const patch = patchOf(sent, names);
    // A value the server would refuse (e.g. returned above loaded): wait until the courier fixes it.
    if (!patch) return "invalid";

    setSave("saving");
    const run = api<Shift>("/api/shifts/today", { method: "PATCH", body: patch }).then(
      (updated) => {
        setShift(updated);
        // Fields typed again while this save was in flight stay dirty for the next one.
        for (const name of names) if (latest.current[name] === sent[name]) dirty.current.delete(name);
        setSave("saved");
        return null;
      },
      (error) => {
        const failure = failureOf(error);
        if (failure === "notEditable" || failure === "notFound") reload();
        setSave(failure === "offline" ? "offline" : "error");
        return failure;
      },
    );
    saving.current = run;
    try {
      return await run;
    } finally {
      saving.current = null;
    }
  }, [api, reload]);

  const phase = phaseOf(shift);

  /** Updates the form. During the shift the change is saved shortly after the courier stops typing. */
  const set = useCallback(
    (changes: Partial<ShiftFields>) => {
      latest.current = { ...latest.current, ...changes };
      setFields(latest.current);
      if (phase !== "inProgress") return;
      for (const name of Object.keys(changes) as FieldName[]) dirty.current.add(name);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_DELAY);
    },
    [phase, flush],
  );

  /** Starts the shift now. Resolves the failure, or null on success. */
  const start = useCallback(async (): Promise<ApiFailure | null> => {
    const f = latest.current;
    try {
      const started = await api<Shift>("/api/shifts/today", {
        method: "POST",
        body: { depotId: f.stationId, carId: f.busId, startKm: Number(f.startKm), loaded: Number(f.loaded) },
      });
      setShift(started);
      return null;
    } catch (error) {
      const failure = failureOf(error);
      // Started on another device: show that shift instead.
      if (failure === "exists") reload();
      return failure;
    }
  }, [api, reload]);

  /** Moves the start time (UTC milliseconds). Resolves the failure, or null on success. */
  const setStartTime = useCallback(
    async (at: number): Promise<ApiFailure | null> => {
      try {
        setShift(
          await api<Shift>("/api/shifts/today", { method: "PATCH", body: { startedAt: new Date(at).toISOString() } }),
        );
        return null;
      } catch (error) {
        return failureOf(error);
      }
    },
    [api],
  );

  /** Saves anything pending, then submits. Resolves the failure, or null on success. */
  const submit = useCallback(async (): Promise<ApiFailure | null> => {
    const unsaved = await flush();
    if (unsaved) return unsaved;
    try {
      setShift(await api<Shift>("/api/shifts/today/submit", { method: "POST" }));
      setSave("idle");
      return null;
    } catch (error) {
      return failureOf(error);
    }
  }, [api, flush]);

  return { load, shift, phase, fields, save, set, start, setStartTime, submit, retrySave: flush, reload };
}

type TodayShift = ReturnType<typeof useTodayShiftState>;

const TodayShiftContext = createContext<TodayShift | null>(null);

export function TodayShiftProvider({ children }: PropsWithChildren) {
  return <TodayShiftContext.Provider value={useTodayShiftState()}>{children}</TodayShiftContext.Provider>;
}

export function useTodayShift(): TodayShift {
  const value = useContext(TodayShiftContext);
  if (!value) throw new Error("useTodayShift must be used inside TodayShiftProvider.");
  return value;
}
