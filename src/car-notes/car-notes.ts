// The service log in the app, for mechanics and owners: pages of notes (filtered by car and type), one note with
// its photos, and saving or deleting a note. Photos are saved right away through `uploadPhoto`, like the talon.
import { useCallback, useEffect, useMemo, useState } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource } from "@/api/use-resource";
import type { CarNote, CarNoteInput, CarNotePhotoSlot, CarNotesPage, CarNoteType } from "@/domain/types";
import { useRefocus } from "@/garage/garage";
import { uploadPhoto, type PickedPhoto } from "@/photos/upload";

export type NotesFilter = { carId: string | null; type: CarNoteType | null };

type Log =
  | { status: "loading" }
  | { status: "failed"; failure: ApiFailure }
  | { status: "ready"; page: CarNotesPage; loadingMore: boolean; moreFailed: boolean };

function query(filter: NotesFilter, before?: string): string {
  const params = new URLSearchParams();
  if (filter.carId) params.set("carId", filter.carId);
  if (filter.type) params.set("type", filter.type);
  if (before) params.set("before", before);
  const text = params.toString();
  return text ? `/api/car-notes?${text}` : "/api/car-notes";
}

/**
 * The service log for a filter: the first page, then "more" appends the next. Reloads quietly on refocus. What's
 * loaded belongs to one filter's path, so a new filter shows "loading" until its own first page arrives.
 */
export function useCarNotes(filter: NotesFilter) {
  const api = useApi();
  const [loaded, setLoaded] = useState<{ path: string; log: Log } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const path = query(filter);
  const log = useMemo<Log>(() => (loaded?.path === path ? loaded.log : { status: "loading" }), [loaded, path]);

  useEffect(() => {
    let current = true;
    api<CarNotesPage>(path).then(
      (page) => {
        if (!current) return;
        setLoaded({ path, log: { status: "ready", page, loadingMore: false, moreFailed: false } });
        setRefreshing(false);
      },
      (error) => {
        if (!current) return;
        setLoaded((previous) =>
          previous?.path === path && previous.log.status === "ready"
            ? previous
            : { path, log: { status: "failed", failure: failureOf(error) } },
        );
        setRefreshing(false);
      },
    );
    return () => {
      current = false;
    };
  }, [api, path, attempt]);

  const reload = useCallback((quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoaded(null);
    setAttempt((a) => a + 1);
  }, []);
  useRefocus(reload);

  const more = useCallback(async () => {
    if (log.status !== "ready" || !log.page.next || log.loadingMore) return;
    const { page } = log;
    setLoaded({ path, log: { ...log, loadingMore: true, moreFailed: false } });
    try {
      const next = await api<CarNotesPage>(query(filter, page.next ?? undefined));
      const notes = [...page.notes, ...next.notes];
      setLoaded({ path, log: { status: "ready", page: { ...next, notes }, loadingMore: false, moreFailed: false } });
    } catch {
      setLoaded({ path, log: { status: "ready", page, loadingMore: false, moreFailed: true } });
    }
  }, [api, filter, log, path]);

  return { log, refreshing, reload, more };
}

/** Adds a note (with `carId`) or saves one whole (with `id`). Resolves the note, or the failure. */
export function useSaveNote() {
  const api = useApi();
  return useCallback(
    async (target: { id: string } | { carId: string }, input: CarNoteInput): Promise<CarNote | ApiFailure> => {
      try {
        return "id" in target
          ? await api<CarNote>(`/api/car-notes/${target.id}`, { method: "PATCH", body: input })
          : await api<CarNote>("/api/car-notes", { method: "POST", body: { carId: target.carId, ...input } });
      } catch (error) {
        return failureOf(error);
      }
    },
    [api],
  );
}

/** One note with its photos. A photo shows its local file (`uploading`) until it's kept. */
export function useCarNote(id: string | undefined) {
  const api = useApi();
  const path = id ? `/api/car-notes/${id}` : null;
  const { resource, reload, replace } = useResource<CarNote>(path);
  const [uploading, setUploading] = useState<Partial<Record<CarNotePhotoSlot, string>>>({});
  useRefocus(reload);

  const addPhoto = useCallback(
    async (slot: CarNotePhotoSlot, photo: PickedPhoto): Promise<ApiFailure | null> => {
      if (!path) return "notFound";
      setUploading((previous) => ({ ...previous, [slot]: photo.uri }));
      try {
        const note = await uploadPhoto<CarNote>(api, `${path}/photos`, { slot }, photo);
        replace(() => note);
        return null;
      } catch (error) {
        return failureOf(error);
      } finally {
        setUploading((previous) => ({ ...previous, [slot]: undefined }));
      }
    },
    [api, path, replace],
  );

  const removePhoto = useCallback(
    async (slot: CarNotePhotoSlot): Promise<ApiFailure | null> => {
      if (!path) return "notFound";
      try {
        const note = await api<CarNote>(`${path}/photos?slot=${slot}`, { method: "DELETE" });
        replace(() => note);
        return null;
      } catch (error) {
        return failureOf(error);
      }
    },
    [api, path, replace],
  );

  const remove = useCallback(async (): Promise<ApiFailure | null> => {
    if (!path) return "notFound";
    try {
      await api(path, { method: "DELETE" });
      return null;
    } catch (error) {
      return failureOf(error);
    }
  }, [api, path]);

  return { resource, reload, uploading, addPhoto, removePhoto, remove };
}
