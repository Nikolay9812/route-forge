// Couriers' personal documents under Profile: a courier's own (`/api/details`) and, for owners, any courier's
// (`/api/couriers/:userId`). The provider wraps the Profile stack, so a section list and its form share one copy;
// a save swaps in the answer. Photos are saved right away (`uploadPhoto`), and keeping one answers the updated
// documents.
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import { useResource, type Resource } from "@/api/use-resource";
import type { CourierDetails, CourierDocuments, CourierDocumentsList, DetailsSection, PhotoSlot } from "@/domain/types";
import { uploadPhoto, type PickedPhoto } from "@/photos/upload";

type Entry = { resource: Resource<CourierDocuments>; refreshing: boolean };
/** Local previews of photos still uploading, per documents key, section and slot. */
type Uploading = Record<string, Partial<Record<DetailsSection, Partial<Record<PhotoSlot, string>>>>>;

type DocumentsValue = {
  entries: Record<string, Entry>;
  load: (userId: string | undefined, quiet: boolean) => void;
  save: (userId: string | undefined, section: DetailsSection, values: Record<string, unknown>) => Promise<ApiFailure | null>;
  uploading: Uploading;
  addPhoto: (userId: string | undefined, section: DetailsSection, slot: PhotoSlot, photo: PickedPhoto) => Promise<ApiFailure | null>;
  removePhoto: (userId: string | undefined, section: DetailsSection, slot: PhotoSlot) => Promise<ApiFailure | null>;
};

const DocumentsContext = createContext<DocumentsValue | null>(null);

/** The own documents are keyed "me"; Clerk user IDs never collide with it. */
const keyOf = (userId: string | undefined) => userId ?? "me";
const pathOf = (userId: string | undefined) => (userId ? `/api/couriers/${userId}` : "/api/details");

/** Loads nothing by itself: each screen asks for the documents it shows. */
export function DocumentsProvider({ children }: PropsWithChildren) {
  const api = useApi();
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [uploading, setUploading] = useState<Uploading>({});

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

  const show = useCallback((userId: string | undefined, data: CourierDocuments) => {
    setEntries((previous) => ({ ...previous, [keyOf(userId)]: { resource: { status: "ready", data }, refreshing: false } }));
  }, []);

  const save = useCallback<DocumentsValue["save"]>(
    async (userId, section, values) => {
      try {
        show(userId, await api<CourierDocuments>(pathOf(userId), { method: "PATCH", body: { section, values } }));
        return null;
      } catch (error) {
        return failureOf(error);
      }
    },
    [api, show],
  );

  const setPreview = useCallback((userId: string | undefined, section: DetailsSection, slot: PhotoSlot, uri: string | null) => {
    setUploading((previous) => {
      const key = keyOf(userId);
      const slots = { ...previous[key]?.[section] };
      if (uri) slots[slot] = uri;
      else delete slots[slot];
      return { ...previous, [key]: { ...previous[key], [section]: slots } };
    });
  }, []);

  const addPhoto = useCallback<DocumentsValue["addPhoto"]>(
    async (userId, section, slot, photo) => {
      setPreview(userId, section, slot, photo.uri);
      try {
        show(userId, await uploadPhoto<CourierDocuments>(api, `${pathOf(userId)}/photos`, { section, slot }, photo));
        return null;
      } catch (error) {
        return failureOf(error);
      } finally {
        setPreview(userId, section, slot, null);
      }
    },
    [api, setPreview, show],
  );

  const removePhoto = useCallback<DocumentsValue["removePhoto"]>(
    async (userId, section, slot) => {
      try {
        const query = new URLSearchParams({ section, slot }).toString();
        show(userId, await api<CourierDocuments>(`${pathOf(userId)}/photos?${query}`, { method: "DELETE" }));
        return null;
      } catch (error) {
        return failureOf(error);
      }
    },
    [api, show],
  );

  return (
    <DocumentsContext.Provider value={{ entries, load, save, uploading, addPhoto, removePhoto }}>
      {children}
    </DocumentsContext.Provider>
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

/** One section's photos: what's stored, local previews of uploads in flight, and adding or removing one. */
export function useSectionPhotos(userId: string | undefined, section: DetailsSection, documents: CourierDocuments) {
  const { uploading, addPhoto, removePhoto } = useDocumentsContext();
  return {
    stored: documents.photos[section] ?? {},
    uploading: uploading[keyOf(userId)]?.[section] ?? {},
    add: (slot: PhotoSlot, photo: PickedPhoto) => addPhoto(userId, section, slot, photo),
    remove: (slot: PhotoSlot) => removePhoto(userId, section, slot),
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
