import { useRef } from "react";
import { Modal, Platform, Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/button";
import { ThemedText } from "@/components/themed-text";

export type SheetAction = { label: string; destructive?: boolean; onPress: () => void };

// A themed choice sheet at the bottom of the screen, instead of the system alert (which ignores the app's colors
// on Android). Tapping outside or Cancel closes it. A picked action runs once the sheet is gone, so it can open the
// camera or another modal. Long lists (e.g. timezones) scroll above Cancel. The modal's own fade is the only motion, so reduced motion needs nothing else.
export function ActionSheet({
  visible,
  title,
  actions,
  cancelLabel,
  onClose,
}: {
  visible: boolean;
  title: string;
  actions: SheetAction[];
  cancelLabel: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const pending = useRef<(() => void) | null>(null);

  const run = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };

  const pick = (action: SheetAction) => {
    pending.current = action.onPress;
    onClose();
    // iOS can't present the camera while this modal is still dismissing; onDismiss runs it there.
    if (Platform.OS !== "ios") run();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onDismiss={run} statusBarTranslucent>
      <View className="flex-1 justify-end bg-scrim">
        <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel} onPress={onClose} className="flex-1" />
        <View className="gap-2 rounded-t-lg bg-surface px-4 pt-5" style={{ paddingBottom: insets.bottom + 16 }}>
          <ThemedText variant="label" accessibilityRole="header" className="mb-1 px-2">
            {title}
          </ThemedText>
          <ScrollView style={{ maxHeight: height * 0.6 }} contentContainerClassName="gap-2" bounces={false}>
            {actions.map((action) => (
              <Button
                key={action.label}
                title={action.label}
                variant={action.destructive ? "destructive" : "secondary"}
                onPress={() => pick(action)}
              />
            ))}
          </ScrollView>
          <Button title={cancelLabel} variant="secondary" onPress={onClose} className="mt-2" />
        </View>
      </View>
    </Modal>
  );
}
