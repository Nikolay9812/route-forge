// Data for the owner's pay rates under Profile. The provider wraps the Profile stack, so the list, a rate's
// history and the change sheet share one copy, and every successful save reloads it quietly.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useRef, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource, type Resource } from "@/api/use-resource";
import { useFirm } from "@/auth";
import type { RateKind } from "@/domain/pay-rates";
import type { PayRates, PayRateTarget } from "@/domain/types";

type Save = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<ApiFailure | null>;

type PayRatesValue = {
  resource: Resource<PayRates>;
  refreshing: boolean;
  reload: (quiet?: boolean) => void;
  save: Save;
};

const PayRatesContext = createContext<PayRatesValue | null>(null);

/** Loads only for owners: rates are salary data nobody else may read. */
export function PayRatesProvider({ children }: PropsWithChildren) {
  const { firm } = useFirm();
  const owner = firm.status === "ready" && firm.role === "owner";
  const api = useApi();
  const { resource, refreshing, reload } = useResource<PayRates>(owner ? "/api/pay-rates" : null);

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
    <PayRatesContext.Provider value={{ resource, refreshing, reload, save }}>{children}</PayRatesContext.Provider>
  );
}

function usePayRatesContext(): PayRatesValue {
  const value = useContext(PayRatesContext);
  if (!value) throw new Error("usePayRates needs a PayRatesProvider");
  return value;
}

/** The pay rates, reloaded quietly whenever the screen comes back into focus (not on its first focus). */
export function usePayRates() {
  const rates = usePayRatesContext();
  const { reload } = rates;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
  return rates;
}

export type RateInput = { effectiveFrom: string; kind: RateKind; amountMinor: number | null };

/** One target by its user ID (none for the firm default), plus schedule, edit and cancel. */
export function usePayRateActions(userId: string | undefined) {
  const { resource, save } = usePayRatesContext();
  const data = resource.status === "ready" ? resource.data : null;
  const courier = userId ? data?.couriers.find((c) => c.userId === userId) : undefined;
  const target: PayRateTarget | undefined = userId ? courier : data?.firmDefault;

  return {
    data,
    target,
    /** The courier's name; undefined for the firm default. */
    name: courier?.name,
    entry: (id: string | undefined) => target?.entries.find((e) => e.id === id),
    create: (input: RateInput) => save("/api/pay-rates", "POST", { userId: userId ?? null, ...input }),
    update: (id: string, input: RateInput) => save(`/api/pay-rates/${id}`, "PATCH", input),
    remove: (id: string) => save(`/api/pay-rates/${id}`, "DELETE"),
  };
}
