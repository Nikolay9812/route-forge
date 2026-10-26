// Couriers' personal documents under Profile: a courier's own (`/api/details`) and, for owners, any courier's
// (`/api/couriers/:userId`). The provider wraps the Profile stack, so a section list and its form share one copy;
// a save swaps in the answer. Photos live only in this provider's memory until there is file storage.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource, type Resource } from "@/api/use-resource";
import type { CourierDetails, CourierDocuments, CourierDocumentsList, DetailsSection } from "@/domain/types";

export type PhotoSlot = "front" | "back" | "photo" | "page1" | "page2" | "page3";
type Photos = Partial<Record<DetailsSection, Partial<Record<PhotoSlot, string>>>>;
type Entry = { resource: Resource<CourierDocuments>; refreshing: boolean };

type DocumentsValue = {
  entries: Record<string, Entry>;
  load: (userId: string | undefined, quiet: boolean) => void;
  save: (userId: string | undefined, section: DetailsSection, values: Record<string, unknown>) => Promise<ApiFailure | null>;
  photos: Photos;
  setPhoto: (section: DetailsSection, slot: PhotoSlot, uri: string | null) => void;
};

const DocumentsContext = createContext<DocumentsValue | null>(null);

/** The own documents are keyed "me"; Clerk user IDs never collide with it. */
const keyOf = (userId: string | undefined) => userId ?? "me";
const pathOf = (userId: string | undefined) => (userId ? `/api/couriers/${userId}` : "/api/details");

/** Loads nothing by itself: each screen asks for the documents it shows. */
export function DocumentsProvider({ children }: PropsWithChildren) {
  const api = useApi();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [photos, setPhotos] = useState<Photos>({});

  const load = useCallback(
    (userId: string | undefined, quiet: boolean) => {
      const key = keyOf(userId);
      setEntries((previous) => ({
        ...previous,
        [key]:
          quiet && previous[key]
            ? { ...previous[key], refreshing: true }
            : { resource: { status: "loading" }, refreshing: false },
      }));
      api<CourierDocuments>(pathOf(userId)).then(
        (data) => setEntries((previous) => ({ ...previous, [key]: { resource: { status: "ready", data }, refreshing: false } })),
        (error) =>
          setEntries((previous) => {
            // A failed quiet reload keeps what's on screen.
            const kept = previous[key]?.resource;
            const resource: Resource<CourierDocuments> =
              kept?.status === "ready" ? kept : { status: "failed", failure: failureOf(error) };
            return { ...previous, [key]: { resource, refreshing: false } };
          }),
      );
    },
    [api],
  );

  const save = useCallback<DocumentsValue["save"]>(
    async (userId, section, values) => {
      try {
        const data = await api<CourierDocuments>(pathOf(userId), { method: "PATCH", body: { section, values } });
        setEntries((previous) => ({ ...previous, [keyOf(userId)]: { resource: { status: "ready", data }, refreshing: false } }));
        return null;
      } catch (error) {
        return failureOf(error);
      }
    },
    [api],
  );

  const setPhoto = useCallback((section: DetailsSection, slot: PhotoSlot, uri: string | null) => {
    setPhotos((previous) => {
      const slots = { ...previous[section] };
      if (uri) slots[slot] = uri;
      else delete slots[slot];
      return { ...previous, [section]: slots };
    });
  }, []);

  return (
    <DocumentsContext.Provider value={{ entries, load, save, photos, setPhoto }}>{children}</DocumentsContext.Provider>
  );
}

function useDocumentsContext(): DocumentsValue {
  const value = useContext(DocumentsContext);
  if (!value) throw new Error("useDocuments needs a DocumentsProvider");
  return value;
}

/**
 * The signed-in courier's documents (no `userId`) or, for an owner, that courier's. Loads on first use and
 * reloads quietly when the screen comes back into focus.
 */
export function useDocuments(userId?: string) {
  const { entries, load, save } = useDocumentsContext();
  const entry = entries[keyOf(userId)];
  const loaded = entry !== undefined;

  useEffect(() => {
    if (!loaded) load(userId, false);
  }, [loaded, load, userId]);

  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) load(userId, true);
      focusedBefore.current = true;
    }, [load, userId]),
  );

  return {
    resource: entry?.resource ?? ({ status: "loading" } as const),
    refreshing: entry?.refreshing ?? false,
    reload: (quiet = false) => load(userId, quiet),
    save: (section: DetailsSection, values: Partial<Record<keyof CourierDetails, unknown>>) => save(userId, section, values),
  };
}

/** Photos picked for one section on this phone (front/back or one photo), gone when the app closes. */
export function useSectionPhotos(section: DetailsSection) {
  const { photos, setPhoto } = useDocumentsContext();
  return {
    photos: photos[section] ?? {},
    setPhoto: (slot: PhotoSlot, uri: string | null) => setPhoto(section, slot, uri),
  };
}

/** The owner's Couriers list, reloaded quietly when it comes back into focus (after editing a courier). */
export function useCouriers() {
  const list = useResource<CourierDocumentsList>("/api/couriers");
  const { reload } = list;
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload(true);
      focusedBefore.current = true;
    }, [reload]),
  );
  return list;
}
