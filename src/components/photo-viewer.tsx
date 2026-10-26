import { Image } from "expo-image";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconButton } from "@/components/icon-button";
import type { DocumentPhoto } from "@/domain/types";
import { useTranslation } from "@/i18n";

// One stored photo full screen, whole (contain) on the inverse background. Tap anywhere or the close button to go
// back. The modal's own fade is the only motion, so reduced motion needs nothing else.
export function PhotoViewer({
  photo,
  label,
  onClose,
}: {
  photo: DocumentPhoto | null;
  label: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={photo !== null} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View className="flex-1 bg-inverse">
        {photo ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t("photos.close")} onPress={onClose} className="flex-1">
            <Image
              source={{ uri: photo.url, cacheKey: photo.key }}
              contentFit="contain"
              style={{ flex: 1 }}
              accessibilityLabel={label}
              accessibilityIgnoresInvertColors
            />
          </Pressable>
        ) : null}
        <IconButton
          icon="close"
          variant="outline"
          accessibilityLabel={t("photos.close")}
          onPress={onClose}
          className="absolute right-4"
          style={{ top: insets.top + 8 }}
        />
      </View>
    </Modal>
  );
}
