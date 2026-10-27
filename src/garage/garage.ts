// Data for the mechanic's Cars tab: the firm's active cars, one car with its papers, recent vehicle checks and
// notes, and one vehicle check's photos. Each reloads quietly when its screen comes back into focus.
import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

import { useResource } from "@/api/use-resource";
import type { Garage, GarageCarDetail, GarageCheck } from "@/domain/types";

/** Reloads quietly on every focus after the first (coming back from a sheet or another screen). */
export function useRefocus(reload: (quiet?: boolean) => void) {
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
}

export function useGarage() {
  const garage = useResource<Garage>("/api/garage");
  useRefocus(garage.reload);
  return garage;
}

export function useGarageCar(id: string | undefined) {
  const car = useResource<GarageCarDetail>(id ? `/api/garage/cars/${id}` : null);
  useRefocus(car.reload);
  return car;
}

export function useGarageCheck(shiftId: string | undefined) {
  return useResource<GarageCheck>(shiftId ? `/api/garage/shifts/${shiftId}` : null);
}
