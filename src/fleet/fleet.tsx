// Data for the owner's depots and cars under Profile. The provider wraps the Profile stack, so the fleet screen
// and its add/edit sheets share one copy, and every successful save reloads it quietly.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource, type Resource } from "@/api/use-resource";
import { useFirm } from "@/auth";
import type { Fleet, FleetCar, FleetDepot } from "@/domain/types";

type Save = (path: string, method: "POST" | "PATCH", body: unknown) => Promise<ApiFailure | null>;

type FleetValue = {
  resource: Resource<Fleet>;
  refreshing: boolean;
  reload: (quiet?: boolean) => void;
  save: Save;
};

const FleetContext = createContext<FleetValue | null>(null);

/** Loads only for owners: nobody else may manage, or even read, the fleet. */
export function FleetProvider({ children }: PropsWithChildren) {
  const { firm } = useFirm();
  const owner = firm.status === "ready" && firm.role === "owner";
  const api = useApi();
  const { resource, refreshing, reload } = useResource<Fleet>(owner ? "/api/fleet" : null);

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

  return <FleetContext.Provider value={{ resource, refreshing, reload, save }}>{children}</FleetContext.Provider>;
}

function useFleetContext(): FleetValue {
  const value = useContext(FleetContext);
  if (!value) throw new Error("useFleet needs a FleetProvider");
  return value;
}

/** The fleet, reloaded quietly whenever the screen comes back into focus (not on its first focus). */
export function useFleet() {
  const fleet = useFleetContext();
  const { reload } = fleet;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
  return fleet;
}

/** Add, rename, move, archive and restore. Each resolves the failure code, or null once saved. */
export function useFleetActions() {
  const { resource, save } = useFleetContext();
  const fleet = resource.status === "ready" ? resource.data : null;

  return {
    fleet,
    depot: (id: string | undefined): FleetDepot | undefined => fleet?.depots.find((d) => d.id === id),
    car: (id: string | undefined): FleetCar | undefined =>
      fleet?.depots.flatMap((d) => d.cars).find((c) => c.id === id),
    addDepot: (name: string) => save("/api/fleet/depots", "POST", { name }),
    renameDepot: (id: string, name: string) => save(`/api/fleet/depots/${id}`, "PATCH", { name }),
    archiveDepot: (id: string, archived: boolean) => save(`/api/fleet/depots/${id}`, "PATCH", { archived }),
    addCar: (plate: string, depotId: string) => save("/api/fleet/cars", "POST", { plate, depotId }),
    updateCar: (id: string, change: { plate?: string; depotId?: string }) =>
      save(`/api/fleet/cars/${id}`, "PATCH", change),
    archiveCar: (id: string, archived: boolean) => save(`/api/fleet/cars/${id}`, "PATCH", { archived }),
  };
}
