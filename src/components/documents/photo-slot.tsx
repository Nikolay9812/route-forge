import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Alert as NativeAlert, View } from "react-native";

import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/pressable-scale";
import { ThemedText } from "@/components/themed-text";
import { useTranslation } from "@/i18n";

/** ID-1 card proportions (85.6 × 54 mm), for every document photo. */
const CARD_RATIO = 85.6 / 54;

// One photo of a document: tap to take one or pick one from the library, and to replace or remove it. The image
// stays on this phone only (see `useSectionPhotos`).
export function PhotoSlot({
  label,
  uri,
  onChange,
}: {
  label: string;
  uri: string | undefined;
  onChange: (uri: string | null) => void;
}) {
  const { t } = useTranslation();

  const take = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return NativeAlert.alert(t("documents.photos.deniedTitle"), t("documents.photos.deniedCamera"));
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled) onChange(result.assets[0].uri);
  };

  const choose = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return NativeAlert.alert(t("documents.photos.deniedTitle"), t("documents.photos.deniedLibrary"));
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!result.canceled) onChange(result.assets[0].uri);
  };

  const open = () =>
    NativeAlert.alert(label, undefined, [
      { text: t("documents.photos.take"), onPress: () => void take() },
      { text: t("documents.photos.choose"), onPress: () => void choose() },
      ...(uri ? [{ text: t("documents.photos.remove"), style: "destructive" as const, onPress: () => onChange(null) }] : []),
      { text: t("fleet.cancel"), style: "cancel" },
    ]);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={open}
      className="flex-1"
      contentClassName="overflow-hidden rounded-md bg-secondary-soft"
    >
      <View style={{ aspectRatio: CARD_RATIO }} className="items-center justify-center gap-1">
        {uri ? (
          <Image source={{ uri }} contentFit="cover" style={{ position: "absolute", inset: 0 }} accessibilityIgnoresInvertColors />
        ) : (
          <>
            <Icon name="camera" color="secondary-ink" />
            <ThemedText variant="footnote" color="secondary-ink">
              {label}
            </ThemedText>
          </>
        )}
      </View>
    </PressableScale>
  );
}
