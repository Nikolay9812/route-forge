import { useState } from "react";
import { Platform, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { PhotoSlot } from "@/components/photo-slot";
import { PhotoViewer } from "@/components/photo-viewer";
import { Surface } from "@/components/surface";
import { Tag } from "@/components/tag";
import { ThemedText } from "@/components/themed-text";
import { EXPECTED_SHIFT_PHOTOS, libraryAllowed, shiftPhotoGroups } from "@/domain/photos";
import type { DocumentPhoto, ShiftPhotos, ShiftPhotoSlot } from "@/domain/types";
import { useTranslation } from "@/i18n";
import type { PickedPhoto } from "@/photos/upload";
import { useShiftPhotos } from "@/shifts/shift-photos";

/** Vehicle check photos are landscape, like a phone held sideways. */
const PHOTO_RATIO = 4 / 3;

/** Taken expected photos as a count tag, the same everywhere a shift shows them. */
export function photoTag(count: number, t: ReturnType<typeof useTranslation>["t"]) {
  const total = EXPECTED_SHIFT_PHOTOS.length;
  if (count === 0) return { tone: "muted", label: t("review.photos.none") } as const;
  return { tone: count === total ? "done" : "muted", label: t("review.photos.some", { count, total }) } as const;
}

/**
 * The courier's own draft or rejected shift: photos are added and removed right away. There are no upload slots
 * on web (it would need bucket CORS), so there the card is read-only.
 */
export function OwnVehicleCheck({ shiftId, plate, photos }: { shiftId: string; plate: string; photos: ShiftPhotos }) {
  const own = useShiftPhotos(shiftId, photos);
  if (Platform.OS === "web") return <VehicleCheckCard plate={plate} photos={own.photos} />;
  return (
    <VehicleCheckCard
      plate={plate}
      photos={own.photos}
      editing={{ uploading: own.uploading, onAdd: own.add, onRemove: own.remove }}
    />
  );
}

type Editing = {
  uploading: Partial<Record<ShiftPhotoSlot, string>>;
  onAdd: (slot: ShiftPhotoSlot, photo: PickedPhoto) => Promise<ApiFailure | null>;
  onRemove: (slot: ShiftPhotoSlot) => Promise<ApiFailure | null>;
};

// A shift's vehicle check: the bus from four sides plus two extras, the logbook and Mentor score, and the diesel
// and AdBlue gauges, two per row with the slot name under each. With `editing` the courier adds photos (camera
// only, except Mentor); without it the card is read-only: a photo opens full screen, a missing expected photo
// says so, and empty extras are left out.
export function VehicleCheckCard({ plate, photos, editing }: { plate: string; photos: ShiftPhotos; editing?: Editing }) {
  const { t } = useTranslation();
  const [viewing, setViewing] = useState<{ photo: DocumentPhoto; slot: ShiftPhotoSlot } | null>(null);
  const taken = EXPECTED_SHIFT_PHOTOS.filter((slot) => photos[slot]).length;
  const shown = (slot: ShiftPhotoSlot) => editing || EXPECTED_SHIFT_PHOTOS.includes(slot) || photos[slot] !== undefined;

  const groups: { title: string | null; slots: ShiftPhotoSlot[] }[] = [
    { title: t("shiftPhotos.groups.bus", { plate }), slots: shiftPhotoGroups.bus.filter(shown) },
    { title: null, slots: [...shiftPhotoGroups.logbook, ...shiftPhotoGroups.mentor] },
    { title: t("shiftPhotos.groups.fuel"), slots: [...shiftPhotoGroups.fuel] },
  ];

  return (
    <Surface className="gap-4 p-5">
      <View className="gap-1">
        <View className="flex-row items-center justify-between gap-3">
          <ThemedText variant="title" accessibilityRole="header" className="flex-1">
            {t("shiftPhotos.title")}
          </ThemedText>
          <Tag
            size="sm"
            tone={taken === EXPECTED_SHIFT_PHOTOS.length ? "done" : "muted"}
            label={t("shiftPhotos.count", { count: taken, total: EXPECTED_SHIFT_PHOTOS.length })}
          />
        </View>
        {editing ? (
          <ThemedText variant="footnote" weight="regular">
            {t("shiftPhotos.optional")}
          </ThemedText>
        ) : null}
      </View>

      {groups.map(({ title, slots }, g) => (
        <View key={g} className="gap-2">
          {title ? <ThemedText variant="label">{title}</ThemedText> : null}
          {Array.from({ length: Math.ceil(slots.length / 2) }, (_, row) => slots.slice(row * 2, row * 2 + 2)).map(
            (pair, row) => (
              <View key={row} className="flex-row gap-3">
                {pair.map((slot) => {
                  const label = t(`shiftPhotos.slots.${slot}`);
                  return (
                    <View key={slot} className="flex-1 gap-1">
                      <PhotoSlot
                        label={label}
                        photo={photos[slot]}
                        aspectRatio={PHOTO_RATIO}
                        {...(editing
                          ? {
                              uploadingUri: editing.uploading[slot],
                              sources: libraryAllowed(slot) ? "both" : "camera",
                              emptyText: null,
                              onAdd: (photo: PickedPhoto) => editing.onAdd(slot, photo),
                              onRemove: () => editing.onRemove(slot),
                            }
                          : {
                              emptyText: t("shiftPhotos.missing"),
                              onView: (photo: DocumentPhoto) => setViewing({ photo, slot }),
                            })}
                      />
                      <ThemedText variant="footnote" numberOfLines={1}>
                        {label}
                      </ThemedText>
                    </View>
                  );
                })}
                {/* An odd last slot keeps the size of a pair. */}
                {pair.length === 1 ? <View className="flex-1" /> : null}
              </View>
            ),
          )}
        </View>
      ))}

      <PhotoViewer
        photo={viewing?.photo ?? null}
        label={viewing ? t(`shiftPhotos.slots.${viewing.slot}`) : ""}
        onClose={() => setViewing(null)}
      />
    </Surface>
  );
}
