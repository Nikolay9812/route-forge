// Authed calls to this app's API routes. Relative URLs: in development Expo Router sends them to the dev server.
// Every failure becomes an ApiError with a code; "offline" means the request never got an answer.
import { useCallback } from "react";

import { useSessionToken } from "@/auth";
import type { ApiErrorCode } from "@/domain/types";

export type ApiFailure = ApiErrorCode | "offline";

export class ApiError extends Error {
  constructor(readonly code: ApiFailure) {
    super(code);
  }
}

export function failureOf(error: unknown): ApiFailure {
  return error instanceof ApiError ? error.code : "server";
}

type Request = { method?: "GET" | "POST" | "PATCH"; body?: unknown };

export function useApi() {
  const getToken = useSessionToken();

  return useCallback(
    async <T>(path: string, { method = "GET", body }: Request = {}): Promise<T> => {
      let response: Response;
      try {
        // Refreshing an expired token is a network call too, so its failure also means offline.
        const token = await getToken();
        if (!token) throw new ApiError("unauthorized");
        response = await fetch(path, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (error) {
        throw error instanceof ApiError ? error : new ApiError("offline");
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: ApiErrorCode } | null;
        throw new ApiError(payload?.error ?? "server");
      }
      return (await response.json()) as T;
    },
    [getToken],
  );
}
