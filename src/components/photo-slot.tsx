import { Image } from "expo-image";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Alert as NativeAlert, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { ActionSheet, type SheetAction } from "@/components/action-sheet";
import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { PHOTO_MAX_BYTES } from "@/domain/photos";
import type { DocumentPhoto } from "@/domain/types";
import { useTranslation } from "@/i18n";
import type { PickedPhoto } from "@/photos/upload";
import { useThemeColor } from "@/theme";

/** ID-1 card proportions (85.6 × 54 mm), the default for document photos. */
export const CARD_RATIO = 85.6 / 54;

// One stored photo (a document or a shift's vehicle check). Editable (with `onAdd`): tap to take one or pick one
// from the library, and to replace or remove it. A picked photo uploads right away, shown dimmed with a spinner
// until it's saved; a failure says so and the slot goes back to what it showed before. Read-only (no `onAdd`):
// tapping a photo opens it with `onView`, and an empty slot shows `emptyText` muted.
export function PhotoSlot({
  label,
  photo,
  uploadingUri,
  aspectRatio = CARD_RATIO,
  sources = "both",
  emptyText = label,
  onAdd,
  onRemove,
  onView,
}: {
  label: string;
  photo: DocumentPhoto | undefined;
  /** The local file while it uploads. */
  uploadingUri?: string;
  aspectRatio?: number;
  /** "camera": no library, so the photo is taken on the spot. */
  sources?: "both" | "camera";
  /** Shown in an empty slot; null shows only the camera icon (when the label sits outside the slot). */
  emptyText?: string | null;
  onAdd?: (photo: PickedPhoto) => Promise<ApiFailure | null>;
  onRemove?: () => Promise<ApiFailure | null>;
  onView?: (photo: DocumentPhoto) => void;
}) {
  const { t } = useTranslation();
  const spinner = useThemeColor("ink");
  const busy = uploadingUri !== undefined;
  const editable = onAdd !== undefined;
  const [choosing, setChoosing] = useState(false);

  const report = (failure: ApiFailure | null, kind: "upload" | "remove") => {
    if (!failure) return;
    const message = failure === "offline" ? "offline" : kind === "upload" ? "uploadError" : "removeError";
    NativeAlert.alert(label, t(`photos.${message}`));
  };

  const keep = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !onAdd) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > PHOTO_MAX_BYTES) return NativeAlert.alert(label, t("photos.tooLarge"));
    report(await onAdd({ uri: asset.uri, mimeType: asset.mimeType }), "upload");
  };

  const take = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return NativeAlert.alert(t("photos.deniedTitle"), t("photos.deniedCamera"));
    await keep(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 }));
  };

  const choose = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return NativeAlert.alert(t("photos.deniedTitle"), t("photos.deniedLibrary"));
    await keep(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 }));
  };

  const open = () => {
    if (!editable) {
      if (photo) onView?.(photo);
      return;
    }
    // Camera only and nothing to replace or remove: straight to the camera.
    if (sources === "camera" && !photo) return void take();
    setChoosing(true);
  };

  const actions: SheetAction[] = [
    { label: t("photos.take"), onPress: () => void take() },
    ...(sources === "both" ? [{ label: t("photos.choose"), onPress: () => void choose() }] : []),
    ...(photo && onRemove
      ? [
          {
            label: t("photos.remove"),
            destructive: true,
            onPress: () => void onRemove().then((failure) => report(failure, "remove")),
          },
        ]
      : []),
  ];

  // The signed URL changes on every load; caching by the object key keeps one download per photo.
  const source = busy ? { uri: uploadingUri } : photo ? { uri: photo.url, cacheKey: photo.key } : null;
  const pressable = editable || (photo !== undefined && onView !== undefined);

  return (
    <>
      <PressableScale
        accessibilityRole={pressable ? "button" : "image"}
        accessibilityLabel={label}
        accessibilityState={{ busy, disabled: !pressable }}
        disabled={busy || !pressable}
        onPress={open}
        className="flex-1"
        contentClassName={`overflow-hidden rounded-md ${editable ? "bg-secondary-soft" : "bg-neutral-soft"}`}
      >
        <View style={{ aspectRatio }} className="items-center justify-center gap-1 px-2">
          {source ? (
            <Image
              source={source}
              contentFit="cover"
              style={{ position: "absolute", inset: 0, opacity: busy ? 0.5 : 1 }}
              accessibilityIgnoresInvertColors
            />
          ) : editable ? (
            <>
              <Icon name="camera" color="secondary-ink" />
              {emptyText ? (
                <ThemedText variant="footnote" color="secondary-ink" numberOfLines={1}>
                  {emptyText}
                </ThemedText>
              ) : null}
            </>
          ) : emptyText ? (
            <ThemedText variant="footnote" color="ink-muted" numberOfLines={1}>
              {emptyText}
            </ThemedText>
          ) : null}
          {busy ? <ActivityIndicator color={spinner} /> : null}
        </View>
      </PressableScale>
      {editable ? (
        <ActionSheet
          visible={choosing}
          title={label}
          actions={actions}
          cancelLabel={t("fleet.cancel")}
          onClose={() => setChoosing(false)}
        />
      ) : null}
    </>
  );
}
