// Data for the owner's Firm settings under Profile. The provider wraps the Profile stack, so the screen and the
// rules sheet share one copy, and every successful save reloads it quietly.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource, type Resource } from "@/api/use-resource";
import { useFirm } from "@/auth";
import type { FirmSettings, WorkRule } from "@/domain/types";

type Save = (path: string, method: "PUT" | "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<ApiFailure | null>;

type FirmSettingsValue = {
  resource: Resource<FirmSettings>;
  refreshing: boolean;
  reload: (quiet?: boolean) => void;
  save: Save;
};

const FirmSettingsContext = createContext<FirmSettingsValue | null>(null);

/** Loads only for owners: nobody else may read or change the firm's settings. */
export function FirmSettingsProvider({ children }: PropsWithChildren) {
  const { firm } = useFirm();
  const owner = firm.status === "ready" && firm.role === "owner";
  const api = useApi();
  const { resource, refreshing, reload } = useResource<FirmSettings>(owner ? "/api/firm" : null);

  const save = useCallback<Save>(
    async (path, method, body) => {
      try {
        await api(path, { method, body });
        reload(true);
        return null;
      } catch (error) {
        return failureOf(error);
      }
    },
    [api, reload],
  );

  return (
    <FirmSettingsContext.Provider value={{ resource, refreshing, reload, save }}>{children}</FirmSettingsContext.Provider>
  );
}

function useFirmSettingsContext(): FirmSettingsValue {
  const value = useContext(FirmSettingsContext);
  if (!value) throw new Error("useFirmSettings needs a FirmSettingsProvider");
  return value;
}

/** The settings, reloaded quietly whenever the screen comes back into focus (not on its first focus). */
export function useFirmSettings() {
  const settings = useFirmSettingsContext();
  const { reload } = settings;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
  return settings;
}

/** Currency and timezone, plus schedule, edit and cancel of rule entries. */
export function useFirmActions() {
  const { resource, save } = useFirmSettingsContext();
  const data = resource.status === "ready" ? resource.data : null;
  return {
    data,
    entry: (id: string | undefined) => data?.entries.find((e) => e.id === id),
    saveSettings: (input: { currency: string; timeZone: string }) => save("/api/firm/settings", "PUT", input),
    create: (rule: WorkRule) => save("/api/firm/rules", "POST", rule),
    update: (id: string, rule: WorkRule) => save(`/api/firm/rules/${id}`, "PATCH", rule),
    remove: (id: string) => save(`/api/firm/rules/${id}`, "DELETE"),
  };
}
