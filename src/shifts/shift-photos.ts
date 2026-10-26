// The vehicle check photos of one of the courier's own shifts, added and removed right away (the shift must be a
// draft or rejected). Starts from the photos the shift was loaded with; each change swaps in the API's answer.
import { useCallback, useState } from "react";

import { failureOf, useApi, type ApiFailure } from "@/api/client";
import type { ShiftPhotos, ShiftPhotoSlot } from "@/domain/types";
import { uploadPhoto, type PickedPhoto } from "@/photos/upload";

export function useShiftPhotos(shiftId: string, initial: ShiftPhotos) {
  const api = useApi();
  const [photos, setPhotos] = useState(initial);
  /** Local previews of photos still uploading. */
  const [uploading, setUploading] = useState<Partial<Record<ShiftPhotoSlot, string>>>({});

  // A reload (or another shift) brings its own photos.
  const [loaded, setLoaded] = useState(initial);
  if (loaded !== initial) {
    setLoaded(initial);
    setPhotos(initial);
  }

  const preview = useCallback((slot: ShiftPhotoSlot, uri: string | null) => {
    setUploading((previous) => {
      const next = { ...previous };
      if (uri) next[slot] = uri;
      else delete next[slot];
      return next;
    });
  }, []);

  const add = useCallback(
    async (slot: ShiftPhotoSlot, photo: PickedPhoto): Promise<ApiFailure | null> => {
      preview(slot, photo.uri);
      try {
        setPhotos(await uploadPhoto<ShiftPhotos>(api, `/api/shifts/${shiftId}/photos`, { slot }, photo));
        return null;
      } catch (error) {
        return failureOf(error);
      } finally {
        preview(slot, null);
      }
    },
    [api, preview, shiftId],
  );

  const remove = useCallback(
    async (slot: ShiftPhotoSlot): Promise<ApiFailure | null> => {
      try {
        setPhotos(await api<ShiftPhotos>(`/api/shifts/${shiftId}/photos?slot=${slot}`, { method: "DELETE" }));
        return null;
      } catch (error) {
        return failureOf(error);
      }
    },
    [api, shiftId],
  );

  return { photos, uploading, add, remove };
}
