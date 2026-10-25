import { useCallback, useEffect, useState } from "react";

import { failureOf, useApi, type ApiFailure } from "./client";

export type Resource<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "failed"; failure: ApiFailure };

/**
 * GET `path` and keep the result. `reload` refetches; it keeps what's on screen while it does when `quiet`
 * (pull to refresh, coming back to a screen). A failed quiet reload keeps the old data. `replace` swaps the data
 * after a write that returned it.
 */
export function useResource<T>(path: string | null, revision = 0) {
  const api = useApi();
  const [resource, setResource] = useState<Resource<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!path) return;
    let current = true;
    api<T>(path).then(
      (data) => {
        if (!current) return;
        setResource({ status: "ready", data });
        setRefreshing(false);
      },
      (error) => {
        if (!current) return;
        setResource((previous) =>
          previous.status === "ready" ? previous : { status: "failed", failure: failureOf(error) },
        );
        setRefreshing(false);
      },
    );
    return () => {
      current = false;
    };
  }, [api, path, attempt, revision]);

  const reload = useCallback((quiet = false) => {
    if (quiet) setRefreshing(true);
    else setResource({ status: "loading" });
    setAttempt((a) => a + 1);
  }, []);

  const replace = useCallback((update: (data: T) => T) => {
    setResource((previous) => (previous.status === "ready" ? { status: "ready", data: update(previous.data) } : previous));
  }, []);

  return { resource, refreshing, reload, replace };
}
