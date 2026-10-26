import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Alert as NativeAlert, View } from "react-native";

import type { ApiFailure } from "@/api/client";
import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import type { PickedPhoto } from "@/documents/documents";
import { PHOTO_MAX_BYTES } from "@/domain/courier-details";
import type { DocumentPhoto } from "@/domain/types";
import { useTranslation } from "@/i18n";
import { useThemeColor } from "@/theme";

/** ID-1 card proportions (85.6 × 54 mm), for every document photo. */
const CARD_RATIO = 85.6 / 54;

// One photo of a document: tap to take one or pick one from the library, and to replace or remove it. A picked
// photo uploads right away, shown dimmed with a spinner until it's saved; a failure says so and the slot goes back
// to what it showed before.
export function PhotoSlot({
  label,
  photo,
  uploadingUri,
  onAdd,
  onRemove,
}: {
  label: string;
  photo: DocumentPhoto | undefined;
  /** The local file while it uploads. */
  uploadingUri: string | undefined;
  onAdd: (photo: PickedPhoto) => Promise<ApiFailure | null>;
  onRemove: () => Promise<ApiFailure | null>;
}) {
  const { t } = useTranslation();
  const spinner = useThemeColor("ink");
  const busy = uploadingUri !== undefined;

  const report = (failure: ApiFailure | null, kind: "upload" | "remove") => {
    if (!failure) return;
    const message = failure === "offline" ? "offline" : kind === "upload" ? "uploadError" : "removeError";
    NativeAlert.alert(label, t(`documents.photos.${message}`));
  };

  const keep = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > PHOTO_MAX_BYTES) return NativeAlert.alert(label, t("documents.photos.tooLarge"));
    report(await onAdd({ uri: asset.uri, mimeType: asset.mimeType }), "upload");
  };

  const take = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return NativeAlert.alert(t("documents.photos.deniedTitle"), t("documents.photos.deniedCamera"));
    await keep(await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 }));
  };

  const choose = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return NativeAlert.alert(t("documents.photos.deniedTitle"), t("documents.photos.deniedLibrary"));
    await keep(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 }));
  };

  const open = () =>
    NativeAlert.alert(label, undefined, [
      { text: t("documents.photos.take"), onPress: () => void take() },
      { text: t("documents.photos.choose"), onPress: () => void choose() },
      ...(photo
        ? [
            {
              text: t("documents.photos.remove"),
              style: "destructive" as const,
              onPress: () => void onRemove().then((failure) => report(failure, "remove")),
            },
          ]
        : []),
      { text: t("fleet.cancel"), style: "cancel" },
    ]);

  // The signed URL changes on every load; caching by the object key keeps one download per photo.
  const source = busy ? { uri: uploadingUri } : photo ? { uri: photo.url, cacheKey: photo.key } : null;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy }}
      disabled={busy}
      onPress={open}
      className="flex-1"
      contentClassName="overflow-hidden rounded-md bg-secondary-soft"
    >
      <View style={{ aspectRatio: CARD_RATIO }} className="items-center justify-center gap-1">
        {source ? (
          <Image
            source={source}
            contentFit="cover"
            style={{ position: "absolute", inset: 0, opacity: busy ? 0.5 : 1 }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <>
            <Icon name="camera" color="secondary-ink" />
            <ThemedText variant="footnote" color="secondary-ink">
              {label}
            </ThemedText>
          </>
        )}
        {busy ? <ActivityIndicator color={spinner} /> : null}
      </View>
    </PressableScale>
  );
}
